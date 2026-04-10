import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../context.js";

export function registerStatsTools(server: McpServer) {
  server.tool(
    "get_purchase_stats",
    "Get the user's purchase history — products they buy most often, ordered by recency.",
    {
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    },
    async ({ limit, offset }) => {
      const client = getClient();
      const result = await client.getPurchaseStats(limit, offset);

      if (!result.results.length) {
        return { content: [{ type: "text", text: "No purchase history found." }] };
      }

      const lines = result.results
        .filter((s) => !s.isIgnored)
        .map((s) => {
          const date = s.lastPurchaseDate
            ? new Date(s.lastPurchaseDate).toLocaleDateString("is-IS")
            : "unknown";
          return `• **${s.product.name}** [SKU: ${s.product.sku}] — bought ${s.purchaseCount}× — last: ${date}`;
        });

      return {
        content: [
          {
            type: "text",
            text: `**Your purchase history** (${result.count} items):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.tool(
    "hide_from_purchase_history",
    "Hide or restore a product in your purchase history.",
    {
      id: z.number().int().describe("Purchase stat ID (from get_purchase_stats)"),
      is_ignored: z.boolean().default(true).describe("True to hide, false to restore"),
    },
    async ({ id, is_ignored }) => {
      const client = getClient();
      await client.setPurchaseStatIgnored(id, is_ignored);
      return {
        content: [
          {
            type: "text",
            text: `✅ Item ${is_ignored ? "hidden from" : "restored to"} purchase history.`,
          },
        ],
      };
    }
  );
}
