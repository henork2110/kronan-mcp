import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../context.js";

export function registerNoteTools(server: McpServer) {
  server.tool(
    "get_shopping_note",
    "Get the current shopping note (freeform list, used in Scan & Go).",
    {},
    async () => {
      const client = getClient();
      const note = await client.getShoppingNote();

      if (!note.lines.length) {
        return { content: [{ type: "text", text: "Your shopping note is empty." }] };
      }

      const lines = note.lines.map((l) => {
        const done = l.isCompleted ? "✅" : "⬜";
        const label = l.text ?? l.product?.name ?? l.product?.sku ?? "—";
        const qty = l.quantity ? ` × ${l.quantity}` : "";
        const sku = l.product?.sku ? ` [SKU: ${l.product.sku}]` : "";
        return `${done} ${label}${qty}${sku} [token: ${l.token}]`;
      });

      return {
        content: [{ type: "text", text: `**Shopping note:**\n\n${lines.join("\n")}` }],
      };
    }
  );

  server.tool(
    "add_shopping_note_line",
    "Add a line to the shopping note. Can be freeform text, a product SKU, or both.",
    {
      text: z.string().max(3000).optional().describe("Freeform text (e.g. '2 liters of milk')"),
      sku: z.string().max(32).optional().describe("Link to a specific product SKU"),
      quantity: z.number().int().min(0).optional().describe("Quantity"),
    },
    async ({ text, sku, quantity }) => {
      const client = getClient();
      await client.addShoppingNoteLine({ text, sku, quantity });
      return { content: [{ type: "text", text: "✅ Added to shopping note." }] };
    }
  );

  server.tool(
    "update_shopping_note_line",
    "Update an existing line in the shopping note.",
    {
      token: z.string().describe("Line token (from get_shopping_note)"),
      text: z.string().max(255).optional(),
      quantity: z.number().int().min(0).optional(),
    },
    async ({ token, text, quantity }) => {
      const client = getClient();
      await client.changeShoppingNoteLine({ token, text, quantity });
      return { content: [{ type: "text", text: "✅ Shopping note line updated." }] };
    }
  );

  server.tool(
    "delete_shopping_note_line",
    "Delete a line from the shopping note.",
    {
      token: z.string().describe("Line token (from get_shopping_note)"),
    },
    async ({ token }) => {
      const client = getClient();
      await client.deleteShoppingNoteLine(token);
      return { content: [{ type: "text", text: "✅ Line removed from shopping note." }] };
    }
  );

  server.tool(
    "toggle_shopping_note_line_complete",
    "Mark a shopping note line as complete or incomplete.",
    {
      token: z.string().describe("Line token (from get_shopping_note)"),
    },
    async ({ token }) => {
      const client = getClient();
      await client.toggleCompleteOnLine(token);
      return { content: [{ type: "text", text: "✅ Line completion toggled." }] };
    }
  );

  server.tool(
    "clear_shopping_note",
    "Delete all lines from the shopping note.",
    {},
    async () => {
      const client = getClient();
      await client.clearShoppingNote();
      return { content: [{ type: "text", text: "✅ Shopping note cleared." }] };
    }
  );

  server.tool(
    "reorder_shopping_note",
    "Reorder shopping note lines by providing their tokens in the desired order.",
    {
      tokens: z.array(z.string()).describe("Line tokens in desired order (from get_shopping_note)"),
    },
    async ({ tokens }) => {
      const client = getClient();
      await client.changePlacement(tokens);
      return { content: [{ type: "text", text: "✅ Shopping note reordered." }] };
    }
  );

  server.tool(
    "sort_shopping_note_for_store",
    "Sort the shopping note by store aisle layout for efficient in-store shopping.",
    {},
    async () => {
      const client = getClient();
      const eligible = await client.checkStoreProductOrderEligibility();
      if (!eligible) {
        return {
          content: [
            {
              type: "text",
              text: "Cannot sort by store layout — make sure items are linked to product SKUs first.",
            },
          ],
        };
      }
      await client.applyStoreProductOrder();
      return { content: [{ type: "text", text: "✅ Shopping note sorted by store layout." }] };
    }
  );

  server.tool(
    "get_archived_shopping_note_lines",
    "Get completed/archived lines from the shopping note.",
    {},
    async () => {
      const client = getClient();
      const archived = await client.getArchivedShoppingNoteLines();
      if (!archived.length) {
        return { content: [{ type: "text", text: "No archived lines." }] };
      }
      const lines = archived.map(
        (l) => `• ${l.text} (completed ${l.completedCount}×) [token: ${l.token}]`
      );
      return { content: [{ type: "text", text: `**Archived lines:**\n\n${lines.join("\n")}` }] };
    }
  );
}
