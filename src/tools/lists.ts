import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../context.js";
import { formatPrice } from "../matching/matcher.js";

export function registerListTools(server: McpServer) {
  server.tool(
    "list_product_lists",
    "Get all saved product lists for the current user.",
    {},
    async () => {
      const client = getClient();
      const result = await client.listProductLists();

      if (!result.results.length) {
        return { content: [{ type: "text", text: "No saved product lists yet." }] };
      }

      const lines = result.results.map(
        (l) => `• **${l.name}** [token: ${l.token}]${l.description ? ` — ${l.description}` : ""}`
      );
      return { content: [{ type: "text", text: `**Your product lists:**\n\n${lines.join("\n")}` }] };
    }
  );

  server.tool(
    "get_product_list",
    "Get all items in a specific saved product list.",
    {
      token: z.string().describe("Product list token (from list_product_lists)"),
    },
    async ({ token }) => {
      const client = getClient();
      const list = await client.getProductList(token);

      if (!list.items.length) {
        return { content: [{ type: "text", text: `**${list.name}** is empty.` }] };
      }

      const lines = list.items.map((item) => {
        const price = item.product.onSale ? item.product.discountedPrice : item.product.price;
        return `• **${item.product.name}** × ${item.quantity} — ${formatPrice(price)} each [SKU: ${item.product.sku}]`;
      });

      return {
        content: [
          {
            type: "text",
            text: `**${list.name}**${list.description ? `\n${list.description}` : ""}\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.tool(
    "create_product_list",
    "Create a new saved product list.",
    {
      name: z.string().max(100).describe("List name"),
      description: z.string().default("").describe("Optional description"),
    },
    async ({ name, description }) => {
      const client = getClient();
      const list = await client.createProductList(name, description);
      return {
        content: [{ type: "text", text: `✅ Created list **${list.name}** [token: ${list.token}]` }],
      };
    }
  );

  server.tool(
    "add_item_to_product_list",
    "Add or update a product in a saved list. Set quantity to 0 to remove it.",
    {
      list_token: z.string().describe("Product list token"),
      sku: z.string().describe("Product SKU"),
      quantity: z.number().int().min(0).default(1),
    },
    async ({ list_token, sku, quantity }) => {
      const client = getClient();
      await client.updateProductListItem(list_token, sku, quantity);
      const action = quantity === 0 ? "Removed" : `Added × ${quantity}`;
      return { content: [{ type: "text", text: `✅ ${action} SKU ${sku} in list.` }] };
    }
  );

  server.tool(
    "update_product_list",
    "Rename or update the description of a product list.",
    {
      token: z.string().describe("Product list token"),
      name: z.string().max(100).optional(),
      description: z.string().optional(),
    },
    async ({ token, name, description }) => {
      const client = getClient();
      const list = await client.updateProductList(token, { name, description });
      return { content: [{ type: "text", text: `✅ Updated list: **${list.name}**` }] };
    }
  );

  server.tool(
    "delete_product_list",
    "Permanently delete a saved product list.",
    {
      token: z.string().describe("Product list token"),
    },
    async ({ token }) => {
      const client = getClient();
      await client.deleteProductList(token);
      return { content: [{ type: "text", text: "✅ Product list deleted." }] };
    }
  );

  server.tool(
    "sort_product_list",
    "Sort a product list by store department layout for efficient in-store shopping.",
    {
      token: z.string().describe("Product list token"),
    },
    async ({ token }) => {
      const client = getClient();
      await client.sortProductListItems(token);
      return { content: [{ type: "text", text: "✅ List sorted by store layout." }] };
    }
  );
}
