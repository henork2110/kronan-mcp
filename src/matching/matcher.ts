import type { PublicProduct } from "../kronan/types.js";
import type { Ingredient } from "../recipes/database.js";
import { KronanClient } from "../kronan/client.js";

export type BudgetMode = "cheapest" | "balanced" | "premium";

export interface MatchedItem {
  ingredient: string;
  searchedFor: string;
  product: PublicProduct | null;
  quantity: number; // number of packs/units to buy
  estimatedTotal: number; // ISK
  note?: string;
}

export interface RecipePlan {
  recipeName: string;
  servings: number;
  items: MatchedItem[];
  totalEstimate: number;
  missing: string[];
}

// Score a product against a desired ingredient
function scoreProduct(product: PublicProduct, ingredientName: string): number {
  const productNameLower = product.name.toLowerCase();
  const ingredientLower = ingredientName.toLowerCase();
  let score = 0;

  // Exact name match
  if (productNameLower === ingredientLower) score += 100;
  // Name contains ingredient
  else if (productNameLower.includes(ingredientLower)) score += 50;
  // Ingredient contains product name word
  else {
    const words = ingredientLower.split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && productNameLower.includes(word)) score += 20;
    }
  }

  // Prefer items on sale
  if (product.onSale) score += 5;

  // Penalize shortage
  if (product.temporaryShortage) score -= 30;

  // Prefer items with price per kilo (usually more informative)
  if (product.pricePerKilo !== null) score += 2;

  return score;
}

// Estimate how many units to buy for a needed amount
function estimateQuantity(
  product: PublicProduct,
  neededAmount: number,
  unit: string
): number {
  // Simple heuristic: default to 1, increase if needed amount seems large
  // Products are opaque in size from search alone, so we buy 1 unless clearly needing more
  const nameLower = product.name.toLowerCase();

  // If it looks like a small item and we need a lot, suggest 2
  if (
    (unit === "g" && neededAmount > 400) ||
    (unit === "ml" && neededAmount > 400)
  ) {
    // Many Icelandic products are 250–500g packs; buy 2 if needed > 400g and pack is likely 250g
    if (nameLower.includes("250") || nameLower.includes("200g")) {
      return Math.ceil(neededAmount / 250);
    }
  }

  return 1;
}

export async function matchIngredient(
  client: KronanClient,
  ingredient: Ingredient,
  budgetMode: BudgetMode = "balanced"
): Promise<MatchedItem> {
  let bestProduct: PublicProduct | null = null;
  let bestScore = -1;

  // Try each search term until we find a good match
  for (const term of ingredient.searchTerms) {
    try {
      const results = await client.searchProducts(term, 10);
      if (!results.hits.length) continue;

      for (const product of results.hits) {
        const score = scoreProduct(product, ingredient.name);
        if (score > bestScore) {
          // Budget mode adjustments
          const effectivePrice = product.onSale
            ? product.discountedPrice
            : product.price;

          if (budgetMode === "cheapest" && bestProduct) {
            const bestEffectivePrice = bestProduct.onSale
              ? bestProduct.discountedPrice
              : bestProduct.price;
            // Only switch if cheaper AND still relevant
            if (score >= bestScore - 10 && effectivePrice < bestEffectivePrice) {
              bestProduct = product;
              bestScore = score;
            } else if (score > bestScore) {
              bestProduct = product;
              bestScore = score;
            }
          } else {
            bestProduct = product;
            bestScore = score;
          }
        }
      }

      if (bestScore >= 50) break; // Good enough match found
    } catch {
      // Continue to next search term
    }
  }

  if (!bestProduct) {
    return {
      ingredient: ingredient.name,
      searchedFor: ingredient.searchTerms[0],
      product: null,
      quantity: 0,
      estimatedTotal: 0,
      note: "Not found — you may need to add this manually",
    };
  }

  const qty = estimateQuantity(bestProduct, ingredient.amount, ingredient.unit);
  const unitPrice = bestProduct.onSale
    ? bestProduct.discountedPrice
    : bestProduct.price;

  return {
    ingredient: ingredient.name,
    searchedFor: ingredient.searchTerms[0],
    product: bestProduct,
    quantity: qty,
    estimatedTotal: unitPrice * qty,
  };
}

export async function matchIngredients(
  client: KronanClient,
  ingredients: Ingredient[],
  budgetMode: BudgetMode = "balanced"
): Promise<MatchedItem[]> {
  // Match sequentially to respect rate limits
  const results: MatchedItem[] = [];
  for (const ing of ingredients) {
    const match = await matchIngredient(client, ing, budgetMode);
    results.push(match);
  }
  return results;
}

export function buildPlanSummary(
  recipeName: string,
  servings: number,
  items: MatchedItem[]
): RecipePlan {
  const missing = items.filter((i) => !i.product).map((i) => i.ingredient);
  const totalEstimate = items.reduce((sum, i) => sum + i.estimatedTotal, 0);

  return {
    recipeName,
    servings,
    items,
    totalEstimate,
    missing,
  };
}

export function formatPrice(isk: number): string {
  return `${isk.toLocaleString("is-IS")} kr`;
}

export function formatPlan(plan: RecipePlan): string {
  const lines: string[] = [
    `**${plan.recipeName}** (${plan.servings} servings)\n`,
  ];

  for (const item of plan.items) {
    if (item.product) {
      const price = item.product.onSale
        ? item.product.discountedPrice
        : item.product.price;
      const saleTag = item.product.onSale ? " 🔖 on sale" : "";
      lines.push(
        `• ${item.ingredient}: **${item.product.name}** — ${formatPrice(price)} × ${item.quantity} = ${formatPrice(item.estimatedTotal)}${saleTag}`
      );
    } else {
      lines.push(`• ${item.ingredient}: ❌ not found`);
    }
  }

  lines.push(`\n**Total estimate: ${formatPrice(plan.totalEstimate)}**`);

  if (plan.missing.length > 0) {
    lines.push(`\n⚠️ Could not find: ${plan.missing.join(", ")}`);
  }

  return lines.join("\n");
}
