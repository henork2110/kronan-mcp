import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../context.js";
import { formatPrice } from "../matching/matcher.js";

export function registerProductTools(server: McpServer) {
  server.tool(
    "search_products",
    "Search for products in the Krónan grocery store. Returns matching products with names, prices, and availability.",
    {
      query: z.string().describe("Search query (e.g. 'chicken breast', 'pasta', 'mjólk')"),
      limit: z.number().int().min(1).max(50).default(10).describe("Number of results to return"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    },
    async ({ query, limit, offset }) => {
      const client = getClient();
      const results = await client.searchProducts(query, limit, offset, false);

      if (!results.results.length) {
        return { content: [{ type: "text", text: `No products found for "${query}".` }] };
      }

      const lines = results.results.map((p) => {
        const price = p.onSale ? p.discountedPrice : p.price;
        const sale = p.onSale ? ` (was ${formatPrice(p.price)}, now ${formatPrice(p.discountedPrice)})` : "";
        const shortage = p.temporaryShortage ? " ⚠️ temporary shortage" : "";
        return `• **${p.name}** [SKU: ${p.sku}] — ${formatPrice(price)}${sale}${shortage}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.count} result(s) for "${query}" (showing ${results.results.length}):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_product",
    "Get full details for a specific product by SKU, including description, tags, country of origin, and price info.",
    {
      sku: z.string().describe("Product SKU identifier"),
    },
    async ({ sku }) => {
      const client = getClient();
      const p = await client.getProduct(sku);

      const price = p.onSale ? p.discountedPrice : p.price;
      const details = [
        `**${p.name}**`,
        `SKU: ${p.sku}`,
        `Price: ${formatPrice(price)}${p.onSale ? ` (on sale from ${formatPrice(p.price)})` : ""}`,
        p.pricePerKilo ? `Price per kilo: ${formatPrice(p.pricePerKilo)}` : null,
        p.countryOfOrigin ? `Origin: ${p.countryOfOrigin}` : null,
        p.description ? `\n${p.description}` : null,
        p.tags?.length ? `Tags: ${p.tags.map((t) => t.name).join(", ")}` : null,
        p.temporaryShortage ? "⚠️ Temporary shortage" : null,
      ]
        .filter(Boolean)
        .join("\n");

      return { content: [{ type: "text", text: details }] };
    }
  );

  server.tool(
    "list_categories",
    "List all product categories in Krónan.",
    {},
    async () => {
      const client = getClient();
      const cats = await client.getCategories();

      const lines = cats.map((c) => {
        const children = (c.children ?? []).map((ch) => `  → ${ch.name} (${ch.slug})`).join("\n");
        return `• **${c.name}** (${c.slug})${children ? "\n" + children : ""}`;
      });

      return {
        content: [{ type: "text", text: `**Categories:**\n\n${lines.join("\n")}` }],
      };
    }
  );

  server.tool(
    "get_category_products",
    "Get products listed under a specific category slug.",
    {
      slug: z.string().describe("Category slug (from list_categories)"),
      limit: z.number().int().min(1).max(48).default(20).describe("Number of results"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    },
    async ({ slug, limit, offset }) => {
      const client = getClient();
      const results = await client.getCategoryProducts(slug, limit, offset);

      if (!results.results.length) {
        return { content: [{ type: "text", text: `No products found in category "${slug}".` }] };
      }

      const lines = results.results.map((p) => {
        const price = p.onSale ? p.discountedPrice : p.price;
        const sale = p.onSale ? " 🔖" : "";
        return `• **${p.name}** [${p.sku}] — ${formatPrice(price)}${sale}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `**${slug}** (${results.count} products, showing ${results.results.length}):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );
}
