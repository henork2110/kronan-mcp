import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../context.js";
import { formatPrice } from "../matching/matcher.js";

function formatCheckout(checkout: {
  token: string;
  lines: Array<{
    id: number;
    quantity: number;
    product: { name: string; sku: string; price: number; discountedPrice: number; onSale: boolean; temporaryShortage: boolean };
    total: number;
    substitution: boolean;
  }>;
  total: number;
  subtotal: number;
  baggingFee: number;
  serviceFee: number;
  shippingFee: number;
}): string {
  if (!checkout.lines.length) {
    return "Your cart is empty.";
  }

  const lines = checkout.lines.map((line) => {
    const unitPrice = line.product.onSale ? line.product.discountedPrice : line.product.price;
    const sub = line.substitution ? " (substitution allowed)" : "";
    const shortage = line.product.temporaryShortage ? " ⚠️" : "";
    return `• **${line.product.name}**${shortage} × ${line.quantity} — ${formatPrice(line.total)} [line ID: ${line.id}]${sub}`;
  });

  const fees = [
    checkout.baggingFee ? `Bagging fee: ${formatPrice(checkout.baggingFee)}` : null,
    checkout.serviceFee ? `Service fee: ${formatPrice(checkout.serviceFee)}` : null,
    checkout.shippingFee ? `Shipping fee: ${formatPrice(checkout.shippingFee)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `**Your cart** (${checkout.lines.length} items):`,
    "",
    lines.join("\n"),
    "",
    `Subtotal: ${formatPrice(checkout.subtotal)}`,
    fees,
    `**Total: ${formatPrice(checkout.total)}**`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function registerCheckoutTools(server: McpServer) {
  server.tool(
    "get_checkout",
    "Get the current active cart/checkout with all items, quantities, and total price.",
    {},
    async () => {
      const client = getClient();
      const checkout = await client.getCheckout();
      return { content: [{ type: "text", text: formatCheckout(checkout) }] };
    }
  );

  server.tool(
    "add_items_to_checkout",
    "Add items to the cart without removing existing items. Use this to add products to an existing cart.",
    {
      items: z
        .array(
          z.object({
            sku: z.string().describe("Product SKU"),
            quantity: z.number().int().min(1).max(500).default(1).describe("Quantity"),
            substitution: z
              .boolean()
              .default(true)
              .describe("Allow substitution if out of stock"),
          })
        )
        .describe("Items to add"),
    },
    async ({ items }) => {
      const client = getClient();
      const checkout = await client.setCheckoutLines({ lines: items, replace: false });
      return {
        content: [
          {
            type: "text",
            text: `✅ Items added to cart.\n\n${formatCheckout(checkout)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "replace_checkout_lines",
    "Replace ALL items in the cart with a new set of items. Use with care — this clears the existing cart first.",
    {
      items: z
        .array(
          z.object({
            sku: z.string().describe("Product SKU"),
            quantity: z.number().int().min(1).max(500).default(1),
            substitution: z.boolean().default(true),
          })
        )
        .describe("New cart contents"),
    },
    async ({ items }) => {
      const client = getClient();
      const checkout = await client.setCheckoutLines({ lines: items, replace: true });
      return {
        content: [
          {
            type: "text",
            text: `✅ Cart replaced.\n\n${formatCheckout(checkout)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "remove_item_from_checkout",
    "Remove a specific item from the cart by setting its quantity to 0.",
    {
      sku: z.string().describe("Product SKU to remove"),
    },
    async ({ sku }) => {
      const client = getClient();
      // Get current cart first
      const current = await client.getCheckout();
      const remaining = current.lines
        .filter((l) => l.product.sku !== sku)
        .map((l) => ({
          sku: l.product.sku,
          quantity: l.quantity,
          substitution: l.substitution,
        }));

      const checkout = await client.setCheckoutLines({ lines: remaining, replace: true });
      return {
        content: [{ type: "text", text: `✅ Item removed.\n\n${formatCheckout(checkout)}` }],
      };
    }
  );

  server.tool(
    "find_cheaper_checkout_alternatives",
    "For each item in the current cart, search for a cheaper alternative product. Returns suggestions with potential savings.",
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
        const currentPrice = line.product.onSale
          ? line.product.discountedPrice
          : line.product.price;
        const results = await client.searchProducts(line.product.name, 10);

        const cheaper = results.results
          .filter((p) => p.sku !== line.product.sku && !p.temporaryShortage)
          .map((p) => ({
            product: p,
            effectivePrice: p.onSale ? p.discountedPrice : p.price,
          }))
          .filter((p) => p.effectivePrice < currentPrice)
          .sort((a, b) => a.effectivePrice - b.effectivePrice)[0];

        if (cheaper) {
          const savings = (currentPrice - cheaper.effectivePrice) * line.quantity;
          totalSavings += savings;
          suggestions.push(
            `• **${line.product.name}** (${formatPrice(currentPrice)}) → **${cheaper.product.name}** (${formatPrice(cheaper.effectivePrice)}) — saves ${formatPrice(savings)} [SKU: ${cheaper.product.sku}]`
          );
        } else {
          suggestions.push(`• **${line.product.name}** — already the best price found`);
        }
      }

      if (totalSavings > 0) {
        suggestions.push(`\n💰 **Potential total savings: ${formatPrice(totalSavings)}**`);
        suggestions.push("\nTo apply any swap, use replace_checkout_lines or add_items_to_checkout with the new SKUs.");
      } else {
        suggestions.push("\nNo cheaper alternatives found for your current cart.");
      }

      return { content: [{ type: "text", text: suggestions.join("\n") }] };
    }
  );
}
