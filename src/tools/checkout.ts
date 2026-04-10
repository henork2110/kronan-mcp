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

      const line = current.lines.find((l) => l.product.sku === sku);
      if (!line) {
        return {
          content: [{
            type: "text",
            text: `⚠️ Item not found in cart (SKU: ${sku}). Cart unchanged.\n\n${formatCheckout(current)}`,
          }],
        };
      }

      // Use lower-quantity-lines with quantity: 0 to delete the line (replace: true + filtered
      // list is silently ignored by the server when the result would be an empty or changed list)
      try {
        await client.lowerCheckoutLineQuantities(current.token, [line.id], 0);
      } catch {
        // Fallback: replace entire cart without this SKU
        const remaining = current.lines
          .filter((l) => l.product.sku !== sku)
          .map((l) => ({ sku: l.product.sku, quantity: l.quantity, substitution: l.substitution }));
        await client.setCheckoutLines({ lines: remaining, replace: true });
      }

      const updated = await client.getCheckout();
      const after = updated.lines.length;
      const removed = before - after;

      return {
        content: [{
          type: "text",
          text: removed > 0
            ? `✅ Item removed (${before} → ${after} items).\n\n${formatCheckout(updated)}`
            : `⚠️ Attempted removal but cart still shows ${after} items.\n\n${formatCheckout(updated)}`,
        }],
      };
    }
  );

  server.tool(
    "clear_checkout",
    "Remove ALL items from the cart. Returns full diagnostic info.",
    {},
    async () => {
      const client = getClient();
      const current = await client.getCheckout();

      const log: string[] = [];
      const unwrapRaw = (r: unknown) => {
        const c = Array.isArray(r) ? (r as any[])[0] : (r as any);
        return c?.lines?.length ?? "?";
      };

      log.push(`**BEFORE:** ${current.lines.length} items, total ${formatPrice(current.total)}, token: \`${current.token}\``);

      if (!current.lines.length) {
        return { content: [{ type: "text", text: "Cart is already empty." }] };
      }

      // === Strategy A: replace:true with each existing sku at quantity 0 ===
      // Non-empty array bypasses empty-guard, quantity 0 should be interpreted as "remove"
      log.push(`\n**Strategy A:** replace:true with each sku at quantity:0 (non-empty array, qty=0)`);
      try {
        const zeroLines = current.lines.map((l) => ({ sku: l.product.sku, quantity: 0 }));
        const rA = await client.rawRequest("POST", "/checkout/lines/", { lines: zeroLines, replace: true });
        log.push(`→ 200 OK, response lines: ${unwrapRaw(rA)}`);
      } catch (e) {
        log.push(`→ failed: ${(e as Error).message}`);
      }
      const afterA = await client.getCheckout();
      log.push(`**After A:** ${afterA.lines.length} items`);

      if (afterA.lines.length === 0) {
        log.push(`\n✅ **CLEARED via Strategy A**`);
        return { content: [{ type: "text", text: log.join("\n") }] };
      }

      // === Strategy B: replace:true with a SINGLE existing sku at quantity 1 ===
      // Critical test: does replace:true even work to reduce cart size?
      const firstSku = afterA.lines[0].product.sku;
      log.push(`\n**Strategy B:** replace:true with single sku [${firstSku}] at quantity:1 (tests if replace works at all)`);
      try {
        const rB = await client.rawRequest("POST", "/checkout/lines/", {
          lines: [{ sku: firstSku, quantity: 1 }],
          replace: true,
        });
        log.push(`→ 200 OK, response lines: ${unwrapRaw(rB)}`);
      } catch (e) {
        log.push(`→ failed: ${(e as Error).message}`);
      }
      const afterB = await client.getCheckout();
      log.push(`**After B:** ${afterB.lines.length} items`);

      // === Strategy C: replace:true with empty array (the classic) ===
      log.push(`\n**Strategy C:** replace:true with [] (classic)`);
      try {
        const rC = await client.rawRequest("POST", "/checkout/lines/", { lines: [], replace: true });
        log.push(`→ 200 OK, response lines: ${unwrapRaw(rC)}`);
      } catch (e) {
        log.push(`→ failed: ${(e as Error).message}`);
      }
      const afterC = await client.getCheckout();
      log.push(`**After C:** ${afterC.lines.length} items`);

      // === Strategy D: PATCH /checkout/lines/ (undocumented method) ===
      log.push(`\n**Strategy D:** PATCH /checkout/lines/ {lines: [], replace: true} (undocumented)`);
      try {
        const rD = await client.rawRequest("PATCH", "/checkout/lines/", { lines: [], replace: true });
        log.push(`→ success, response lines: ${unwrapRaw(rD)}`);
      } catch (e) {
        log.push(`→ failed: ${(e as Error).message}`);
      }
      const afterD = await client.getCheckout();
      log.push(`**After D:** ${afterD.lines.length} items`);

      // === Strategy E: DELETE /checkout/lines/ (undocumented method) ===
      log.push(`\n**Strategy E:** DELETE /checkout/lines/ (undocumented)`);
      try {
        const rE = await client.rawRequest("DELETE", "/checkout/lines/");
        log.push(`→ success, response: ${JSON.stringify(rE).slice(0, 200)}`);
      } catch (e) {
        log.push(`→ failed: ${(e as Error).message}`);
      }
      const final = await client.getCheckout();
      log.push(`\n**FINAL:** ${final.lines.length} items, total ${formatPrice(final.total)}`);

      return { content: [{ type: "text", text: log.join("\n") }] };
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
