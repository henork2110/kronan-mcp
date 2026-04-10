import type { PublicSearchHit } from "../kronan/types.js";
import type { Ingredient } from "../recipes/database.js";
import { KronanClient } from "../kronan/client.js";

export type BudgetMode = "cheapest" | "balanced" | "premium";

export interface MatchedItem {
  ingredient: string;
  searchedFor: string;
  product: PublicSearchHit | null;
  quantity: number;
  estimatedTotal: number;
  note?: string;
}

export interface RecipePlan {
  recipeName: string;
  servings: number;
  items: MatchedItem[];
  totalEstimate: number;
  missing: string[];
}

// Get effective price (discounted if on sale, else base price)
export function effectivePrice(p: PublicSearchHit): number {
  return p.detail?.onSale ? p.detail.discountedPrice : p.price;
}

// Score a product against a desired ingredient
function scoreProduct(product: PublicSearchHit, ingredientName: string): number {
  const productNameLower = product.name.toLowerCase();
  const ingredientLower = ingredientName.toLowerCase();
  let score = 0;

  if (productNameLower === ingredientLower) score += 100;
  else if (productNameLower.includes(ingredientLower)) score += 50;
  else {
    const words = ingredientLower.split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && productNameLower.includes(word)) score += 20;
    }
  }

  if (product.detail?.onSale) score += 5;
  if (product.temporaryShortage) score -= 30;
  if (product.pricePerKilo !== null) score += 2;

  return score;
}

function estimateQuantity(product: PublicSearchHit, neededAmount: number, unit: string): number {
  const nameLower = product.name.toLowerCase();
  if ((unit === "g" && neededAmount > 400) || (unit === "ml" && neededAmount > 400)) {
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
  let bestProduct: PublicSearchHit | null = null;
  let bestScore = -1;

  for (const term of ingredient.searchTerms) {
    try {
      // Use withDetail: true to get sale prices
      const results = await client.searchProducts(term, 10, 1, true);
      if (!results.hits.length) continue;

      for (const product of results.hits) {
        const score = scoreProduct(product, ingredient.name);
        const price = effectivePrice(product);

        if (score > bestScore) {
          bestProduct = product;
          bestScore = score;
        } else if (budgetMode === "cheapest" && bestProduct && score >= bestScore - 10) {
          const bestPrice = effectivePrice(bestProduct);
          if (price < bestPrice) {
            bestProduct = product;
            bestScore = score;
          }
        }
      }

      if (bestScore >= 50) break;
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
  const price = effectivePrice(bestProduct);

  return {
    ingredient: ingredient.name,
    searchedFor: ingredient.searchTerms[0],
    product: bestProduct,
    quantity: qty,
    estimatedTotal: price * qty,
  };
}

export async function matchIngredients(
  client: KronanClient,
  ingredients: Ingredient[],
  budgetMode: BudgetMode = "balanced"
): Promise<MatchedItem[]> {
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
  return { recipeName, servings, items, totalEstimate, missing };
}

export function formatPrice(isk: number): string {
  return `${isk.toLocaleString("is-IS")} kr`;
}

export function formatPlan(plan: RecipePlan): string {
  const lines: string[] = [`**${plan.recipeName}** (${plan.servings} servings)\n`];

  for (const item of plan.items) {
    if (item.product) {
      const price = effectivePrice(item.product);
      const saleTag = item.product.detail?.onSale ? " 🔖 on sale" : "";
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
