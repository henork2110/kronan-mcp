import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../context.js";
import { formatPrice, effectivePrice } from "../matching/matcher.js";

export function registerProductTools(server: McpServer) {
  server.tool(
    "search_products",
    "Search for products in the Krónan grocery store. Returns matching products with names, prices, and availability.",
    {
      query: z.string().describe("Search query (e.g. 'chicken breast', 'pasta', 'mjólk')"),
      page_size: z.number().int().min(1).max(50).default(10).describe("Number of results per page"),
      page: z.number().int().min(1).default(1).describe("Page number"),
      with_detail: z.boolean().default(false).describe("Include sale prices and tags"),
    },
    async ({ query, page_size, page, with_detail }) => {
      const client = getClient();
      const results = await client.searchProducts(query, page_size, page, with_detail);

      if (!results.hits.length) {
        return { content: [{ type: "text", text: `No products found for "${query}".` }] };
      }

      const lines = results.hits.map((p) => {
        const price = with_detail ? effectivePrice(p) : p.price;
        const sale = with_detail && p.detail?.onSale
          ? ` (was ${formatPrice(p.price)}, now ${formatPrice(p.detail.discountedPrice)}) 🔖`
          : "";
        const shortage = p.temporaryShortage ? " ⚠️ shortage" : "";
        return `• **${p.name}** [SKU: ${p.sku}] — ${formatPrice(price)}${sale}${shortage}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.count} result(s) for "${query}" (page ${results.page}/${results.pageCount}):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_product",
    "Get full details for a specific product by SKU — description, tags, country of origin, and pricing.",
    {
      sku: z.string().describe("Product SKU"),
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
    "List all product categories in Krónan, including subcategories.",
    {},
    async () => {
      const client = getClient();
      const cats = await client.getCategories();

      const lines = cats.flatMap((c) => {
        const top = `• **${c.name}** (${c.slug})`;
        const subs = (c.children ?? []).map((ch) => `  → ${ch.name} (${ch.slug})`);
        return [top, ...subs];
      });

      return {
        content: [{ type: "text", text: `**Categories:**\n\n${lines.join("\n")}` }],
      };
    }
  );

  server.tool(
    "get_category_products",
    "Get products listed under a specific category.",
    {
      slug: z.string().describe("Category slug (from list_categories)"),
      page: z.number().int().min(1).default(1).describe("Page number (48 products per page)"),
    },
    async ({ slug, page }) => {
      const client = getClient();
      const results = await client.getCategoryProducts(slug, page);

      if (!results.products.length) {
        return { content: [{ type: "text", text: `No products found in category "${slug}".` }] };
      }

      const lines = results.products.map((p) => {
        const price = p.onSale ? p.discountedPrice : p.price;
        const sale = p.onSale ? " 🔖" : "";
        return `• **${p.name}** [${p.sku}] — ${formatPrice(price)}${sale}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `**${results.name}** (${results.count} products, page ${results.page}/${results.pageCount}):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );
}
