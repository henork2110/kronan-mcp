import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../context.js";

export function registerStatsTools(server: McpServer) {
  server.tool(
    "get_purchase_stats",
    "Get the user's purchase history — products they buy most often, ordered by recency.",
    {
      limit: z.number().int().min(1).max(50).default(20).describe("Number of items to return"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    },
    async ({ limit, offset }) => {
      const client = getClient();
      const result = await client.getPurchaseStats(limit, offset);

      if (!result.results.length) {
        return { content: [{ type: "text", text: "No purchase history found." }] };
      }

      const lines = result.results
        .filter((s) => !s.ignored)
        .map((s) => {
          const date = new Date(s.lastPurchased).toLocaleDateString("is-IS");
          return `• **${s.productName}** [SKU: ${s.sku}] — last bought ${date}`;
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
    "Hide a product from appearing in your purchase history.",
    {
      id: z.number().int().describe("Purchase stat ID (from get_purchase_stats)"),
      ignored: z.boolean().default(true).describe("True to hide, false to show again"),
    },
    async ({ id, ignored }) => {
      const client = getClient();
      await client.setPurchaseStatIgnored(id, ignored);
      return {
        content: [{ type: "text", text: `✅ Item ${ignored ? "hidden from" : "restored to"} purchase history.` }],
      };
    }
  );
}
