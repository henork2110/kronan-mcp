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
      const before = current.lines.length;

      // Build new list excluding this SKU, then replace entire cart
      const remaining = current.lines
        .filter((l) => l.product.sku !== sku)
        .map((l) => ({ sku: l.product.sku, quantity: l.quantity, substitution: l.substitution }));

      await client.setCheckoutLines({ lines: remaining, replace: true });

      // Re-fetch to confirm actual server state
      const updated = await client.getCheckout();
      const after = updated.lines.length;
      const removed = before - after;

      return {
        content: [{
          type: "text",
          text: removed > 0
            ? `✅ Item removed (${before} → ${after} items).\n\n${formatCheckout(updated)}`
            : `⚠️ Item not found in cart (SKU: ${sku}). Cart unchanged.\n\n${formatCheckout(updated)}`,
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

      // Replace with empty list — confirmed working pattern from Krónan CLI
      await client.setCheckoutLines({ lines: [], replace: true });

      // Re-fetch to confirm actual server state
      const updated = await client.getCheckout();

      return {
        content: [{
          type: "text",
          text: updated.lines.length === 0
            ? `✅ Cart cleared.`
            : `⚠️ Cart still has ${updated.lines.length} items after clear attempt.\n\n${formatCheckout(updated)}`,
        }],
      };
    }
  );

  server.tool(
    "debug_cart_clear",
    "Diagnostic tool: attempts to clear the cart and returns the raw HTTP status + response body from Krónan so we can see what the API actually says.",
    {},
    async () => {
      const client = getClient();

      // First get current cart
      const before = await client.getCheckout();

      // Call rawRequest directly to see the real response
      const raw = await client.rawRequest("POST", "/checkout/lines/", {
        lines: [],
        replace: true,
      }).then((data: unknown) => ({ ok: true, data }))
        .catch((err: Error) => ({ ok: false, error: err.message }));

      // Re-fetch to see actual state
      const after = await client.getCheckout();

      return {
        content: [{
          type: "text",
          text: [
            `**Before:** ${before.lines.length} items, total ${formatPrice(before.total)}`,
            `**API response:** ${JSON.stringify(raw, null, 2)}`,
            `**After re-fetch:** ${after.lines.length} items, total ${formatPrice(after.total)}`,
          ].join("\n\n"),
        }],
      };
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
