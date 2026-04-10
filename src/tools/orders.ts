import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../context.js";
import { formatPrice } from "../matching/matcher.js";

export function registerOrderTools(server: McpServer) {
  server.tool(
    "list_orders",
    "List past orders with dates, totals, and status.",
    {
      limit: z.number().int().min(1).max(50).default(10),
      offset: z.number().int().min(0).default(0),
    },
    async ({ limit, offset }) => {
      const client = getClient();
      const result = await client.listOrders(limit, offset);

      if (!result.results.length) {
        return { content: [{ type: "text", text: "No orders found." }] };
      }

      const lines = result.results.map((o) => {
        const date = new Date(o.created).toLocaleDateString("is-IS");
        return `• [${o.token}] ${date} — ${o.status} — ${formatPrice(o.total)}`;
      });

      return {
        content: [{ type: "text", text: `**Order history** (${result.count} total):\n\n${lines.join("\n")}` }],
      };
    }
  );

  server.tool(
    "get_order",
    "Get full details of a specific order including all line items.",
    {
      token: z.string().describe("Order token (from list_orders)"),
    },
    async ({ token }) => {
      const client = getClient();
      const order = await client.getOrder(token);
      const date = new Date(order.created).toLocaleDateString("is-IS");

      const lines = order.lines.map((l) => {
        const mutable = l.isMutable ? "" : " (locked)";
        return `• ${l.productName} × ${l.quantity} — ${formatPrice(l.total)} [ID: ${l.id}]${mutable}`;
      });

      const text = [
        `**Order ${order.token}**`,
        `Date: ${date}`,
        `Status: ${order.status}`,
        order.type ? `Type: ${order.type}` : null,
        order.deliveryDate ? `Delivery: ${order.deliveryDate}` : null,
        `Can modify: ${order.allowAlterOrderLines ? "Yes" : "No"}`,
        "",
        lines.join("\n"),
        "",
        order.discount ? `Discount: -${formatPrice(order.discount)}` : null,
        `**Total: ${formatPrice(order.total)}**`,
      ]
        .filter((l) => l !== null)
        .join("\n");

      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "delete_order_lines",
    "Remove specific line items from a modifiable order.",
    {
      order_token: z.string().describe("Order token"),
      line_ids: z.array(z.number().int()).describe("Line IDs to delete (from get_order)"),
    },
    async ({ order_token, line_ids }) => {
      const client = getClient();
      const order = await client.deleteOrderLines(order_token, line_ids);
      return {
        content: [{ type: "text", text: `✅ Lines removed. New total: ${formatPrice(order.total)}` }],
      };
    }
  );

  server.tool(
    "toggle_order_substitution",
    "Toggle substitution allowance on specific order lines.",
    {
      order_token: z.string().describe("Order token"),
      line_ids: z.array(z.number().int()).describe("Line IDs to toggle"),
    },
    async ({ order_token, line_ids }) => {
      const client = getClient();
      await client.toggleOrderLineSubstitution(order_token, line_ids);
      return {
        content: [{ type: "text", text: `✅ Substitution toggled for lines ${line_ids.join(", ")}.` }],
      };
    }
  );

  server.tool(
    "lower_order_quantities",
    "Reduce all specified order lines to the same target quantity.",
    {
      order_token: z.string().describe("Order token"),
      line_ids: z.array(z.number().int()).describe("Line IDs to reduce"),
      quantity: z.number().int().min(0).describe("New quantity (must be lower than current; 0 removes the line)"),
    },
    async ({ order_token, line_ids, quantity }) => {
      const client = getClient();
      const order = await client.lowerOrderLineQuantities(order_token, line_ids, quantity);
      return {
        content: [{ type: "text", text: `✅ Quantities updated. New total: ${formatPrice(order.total)}` }],
      };
    }
  );
}
