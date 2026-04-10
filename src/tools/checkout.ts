import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../context.js";
import { formatPrice } from "../matching/matcher.js";
import type { PublicCheckout } from "../kronan/types.js";

function formatCheckout(checkout: PublicCheckout): string {
  if (!checkout.lines.length) return "Your cart is empty.";

  const lines = checkout.lines.map((line) => {
    const unitPrice = line.product.onSale ? line.product.discountedPrice : line.product.price;
    const sale = line.product.onSale ? " 🔖" : "";
    const shortage = line.product.temporaryShortage ? " ⚠️" : "";
    const sub = line.substitution ? " (sub allowed)" : "";
    return `• **${line.product.name}**${sale}${shortage} × ${line.quantity} — ${formatPrice(line.total)} [line ID: ${line.id}]${sub}`;
  });

  const fees = [
    checkout.baggingFee ? `Bagging fee: ${formatPrice(checkout.baggingFee)}` : null,
    checkout.serviceFee ? `Service fee: ${formatPrice(checkout.serviceFee)}` : null,
    checkout.shippingFee ? `Shipping: ${formatPrice(checkout.shippingFee)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `**Your cart** (${checkout.lines.length} items):`,
    "",
    lines.join("\n"),
    "",
    `Subtotal: ${formatPrice(checkout.subtotal)}`,
    fees || null,
    `**Total: ${formatPrice(checkout.total)}**`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function registerCheckoutTools(server: McpServer) {
  server.tool(
    "get_checkout",
    "Get the current active cart with all items, quantities, and total price.",
    {},
    async () => {
      const client = getClient();
      const checkout = await client.getCheckout();
      return { content: [{ type: "text", text: formatCheckout(checkout) }] };
    }
  );

  server.tool(
    "add_items_to_checkout",
    "Add items to the cart without removing existing items.",
    {
      items: z.array(
        z.object({
          sku: z.string().describe("Product SKU"),
          quantity: z.number().int().min(1).max(500).default(1),
          substitution: z.boolean().default(true).describe("Allow substitution if out of stock"),
        })
      ),
    },
    async ({ items }) => {
      const client = getClient();
      const checkout = await client.setCheckoutLines({ lines: items, replace: false });
      return {
        content: [{ type: "text", text: `✅ Items added to cart.\n\n${formatCheckout(checkout)}` }],
      };
    }
  );

  server.tool(
    "replace_checkout_lines",
    "Replace ALL items in the cart with a new set. Clears the existing cart first.",
    {
      items: z.array(
        z.object({
          sku: z.string(),
          quantity: z.number().int().min(1).max(500).default(1),
          substitution: z.boolean().default(true),
        })
      ),
    },
    async ({ items }) => {
      const client = getClient();
      const checkout = await client.setCheckoutLines({ lines: items, replace: true });
      return {
        content: [{ type: "text", text: `✅ Cart replaced.\n\n${formatCheckout(checkout)}` }],
      };
    }
  );

  server.tool(
    "remove_item_from_checkout",
    "Remove a specific product from the cart by SKU.",
    {
      sku: z.string().describe("Product SKU to remove"),
    },
    async ({ sku }) => {
      const client = getClient();
      const current = await client.getCheckout();

      const target = current.lines.find((l) => l.product.sku === sku);
      if (!target) {
        return {
          content: [{
            type: "text",
            text: `⚠️ Item not found in cart (SKU: ${sku}).\n\n${formatCheckout(current)}`,
          }],
        };
      }

      // Build full line list keeping every existing sku at its current quantity,
      // except the target which is set to 0 (= remove). Must use replace:true with
      // a NON-EMPTY array — Krónan silently ignores empty-array clears.
      const lines = current.lines.map((l) => ({
        sku: l.product.sku,
        quantity: l.product.sku === sku ? 0 : l.quantity,
        substitution: l.substitution,
      }));

      await client.setCheckoutLines({ lines, replace: true });
      const updated = await client.getCheckout();

      return {
        content: [{
          type: "text",
          text: `✅ Removed ${target.product.name}.\n\n${formatCheckout(updated)}`,
        }],
      };
    }
  );

  server.tool(
    "clear_checkout",
    "Remove ALL items from the cart.",
    {},
    async () => {
      const client = getClient();
      const current = await client.getCheckout();

      if (!current.lines.length) {
        return { content: [{ type: "text", text: "Cart is already empty." }] };
      }

      // Krónan silently ignores { lines: [], replace: true }. The working pattern
      // is a NON-EMPTY array where each existing sku is sent with quantity: 0.
      const zeroLines = current.lines.map((l) => ({ sku: l.product.sku, quantity: 0 }));
      await client.setCheckoutLines({ lines: zeroLines, replace: true });

      return { content: [{ type: "text", text: "✅ Cart cleared." }] };
    }
  );

  server.tool(
    "find_cheaper_checkout_alternatives",
    "For each item in the cart, search for a cheaper alternative. Shows potential savings before making any changes.",
    {},
    async () => {
      const client = getClient();
      const checkout = await client.getCheckout();

      if (!checkout.lines.length) {
        return { content: [{ type: "text", text: "Your cart is empty." }] };
      }

      const suggestions: string[] = ["**Cheaper alternatives for your cart:**\n"];
      let totalSavings = 0;

      for (const line of checkout.lines) {
        const currentPrice = line.product.onSale ? line.product.discountedPrice : line.product.price;
        const results = await client.searchProducts(line.product.name, 10, 1, true);

        const cheaper = results.hits
          .filter((p) => p.sku !== line.product.sku && !p.temporaryShortage)
          .map((p) => ({ product: p, price: p.detail?.onSale ? p.detail.discountedPrice : p.price }))
          .filter((p) => p.price < currentPrice)
          .sort((a, b) => a.price - b.price)[0];

        if (cheaper) {
          const savings = (currentPrice - cheaper.price) * line.quantity;
          totalSavings += savings;
          suggestions.push(
            `• **${line.product.name}** (${formatPrice(currentPrice)}) → **${cheaper.product.name}** (${formatPrice(cheaper.price)}) — saves ${formatPrice(savings)} [SKU: ${cheaper.product.sku}]`
          );
        } else {
          suggestions.push(`• **${line.product.name}** — already best price found`);
        }
      }

      if (totalSavings > 0) {
        suggestions.push(`\n💰 **Potential total savings: ${formatPrice(totalSavings)}**`);
        suggestions.push("\nUse add_items_to_checkout or replace_checkout_lines to apply changes.");
      } else {
        suggestions.push("\nNo cheaper alternatives found.");
      }

      return { content: [{ type: "text", text: suggestions.join("\n") }] };
    }
  );
}
