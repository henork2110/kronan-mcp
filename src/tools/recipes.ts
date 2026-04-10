import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../context.js";
import { findRecipe, scaleIngredients, type Ingredient } from "../recipes/database.js";
import {
  matchIngredients,
  buildPlanSummary,
  formatPlan,
  formatPrice,
  type BudgetMode,
} from "../matching/matcher.js";

const budgetModeSchema = z
  .enum(["cheapest", "balanced", "premium"])
  .default("balanced")
  .describe("Product selection preference: cheapest / balanced / premium");

export function registerRecipeTools(server: McpServer) {
  server.tool(
    "resolve_recipe",
    "Look up the ingredients for a recipe by name. Returns a normalized ingredient list without searching for products.",
    {
      recipe_name: z.string().describe("Recipe name (e.g. 'chicken alfredo', 'tacos', 'kjötsúpa')"),
      servings: z.number().int().min(1).max(20).default(2).describe("Number of servings"),
      exclusions: z
        .array(z.string())
        .default([])
        .describe("Ingredients to exclude (e.g. ['mushrooms', 'pork'])"),
    },
    async ({ recipe_name, servings, exclusions }) => {
      const recipe = findRecipe(recipe_name);

      if (!recipe) {
        return {
          content: [
            {
              type: "text",
              text: `Recipe "${recipe_name}" not found in the built-in library.\n\nTry build_recipe_cart with a list of ingredients instead, or search for individual products with search_products.`,
            },
          ],
        };
      }

      const scaled = scaleIngredients(recipe, servings);
      const filtered = exclusions.length
        ? scaled.filter(
            (ing) =>
              !exclusions.some((ex) =>
                ing.name.toLowerCase().includes(ex.toLowerCase())
              )
          )
        : scaled;

      const lines = filtered.map(
        (ing) =>
          `• ${ing.name}: ${ing.amount} ${ing.unit}${ing.optional ? " (optional)" : ""}`
      );

      return {
        content: [
          {
            type: "text",
            text: [
              `**${recipe.name}** — ${servings} servings`,
              "",
              lines.join("\n"),
              recipe.pantryItems.length
                ? `\n🏠 Assumed at home: ${recipe.pantryItems.join(", ")}`
                : "",
            ].join("\n"),
          },
        ],
      };
    }
  );

  server.tool(
    "build_recipe_cart",
    "Find all ingredients for a recipe and match them to Krónan products. Returns a full shopping plan with product names, prices, and total estimate. Does NOT add to cart — use add_items_to_checkout after confirming.",
    {
      recipe_name: z
        .string()
        .describe("Recipe name (e.g. 'chicken alfredo', 'tacos', 'kjötsúpa')"),
      servings: z.number().int().min(1).max(20).default(2).describe("Number of servings"),
      exclusions: z
        .array(z.string())
        .default([])
        .describe("Ingredients to skip (e.g. ['mushrooms', 'dairy'])"),
      budget_mode: budgetModeSchema,
    },
    async ({ recipe_name, servings, exclusions, budget_mode }) => {
      const client = getClient();
      const recipe = findRecipe(recipe_name);

      if (!recipe) {
        return {
          content: [
            {
              type: "text",
              text: `Recipe "${recipe_name}" not found.\n\nAvailable recipes: Chicken Alfredo, Bolognese, Carbonara, Tacos, Kjötsúpa, Plokkfiskur, Pizza, Chicken Curry, Salmon, Pancakes, Hamburgers, Tomato Soup, Caesar Salad, Stir Fry, Oatmeal.\n\nOr provide ingredients manually using match_ingredients_to_products.`,
            },
          ],
        };
      }

      const scaled = scaleIngredients(recipe, servings);
      const ingredients = exclusions.length
        ? scaled.filter(
            (ing) =>
              !exclusions.some((ex) =>
                ing.name.toLowerCase().includes(ex.toLowerCase())
              )
          )
        : scaled;

      const matched = await matchIngredients(client, ingredients, budget_mode as BudgetMode);
      const plan = buildPlanSummary(recipe.name, servings, matched);

      const cartItems = matched
        .filter((m) => m.product)
        .map((m) => ({
          sku: m.product!.sku,
          quantity: m.quantity,
        }));

      const cartJson = JSON.stringify(cartItems, null, 2);

      return {
        content: [
          {
            type: "text",
            text: [
              formatPlan(plan),
              "",
              "To add these to your cart, use **add_items_to_checkout** with:",
              "```json",
              cartJson,
              "```",
            ].join("\n"),
          },
        ],
      };
    }
  );

  server.tool(
    "match_ingredients_to_products",
    "Search Krónan for a custom list of ingredients and return the best-matching products. Use this when you have a list of ingredients that aren't in the recipe database.",
    {
      ingredients: z
        .array(
          z.object({
            name: z.string().describe("Ingredient name"),
            amount: z.number().default(1).describe("Amount needed"),
            unit: z.string().default("pcs").describe("Unit (g, ml, pcs, etc.)"),
            search_terms: z
              .array(z.string())
              .optional()
              .describe("Optional search terms to try"),
          })
        )
        .describe("List of ingredients to match"),
      budget_mode: budgetModeSchema,
    },
    async ({ ingredients, budget_mode }) => {
      const client = getClient();

      const ings: Ingredient[] = ingredients.map((i) => ({
        name: i.name,
        amount: i.amount,
        unit: i.unit,
        searchTerms: i.search_terms?.length ? i.search_terms : [i.name],
      }));

      const matched = await matchIngredients(client, ings, budget_mode as BudgetMode);
      const plan = buildPlanSummary("Custom list", ingredients.length, matched);

      const cartItems = matched
        .filter((m) => m.product)
        .map((m) => ({ sku: m.product!.sku, quantity: m.quantity }));

      return {
        content: [
          {
            type: "text",
            text: [
              formatPlan(plan),
              "",
              "Ready to add to cart:",
              "```json",
              JSON.stringify(cartItems, null, 2),
              "```",
            ].join("\n"),
          },
        ],
      };
    }
  );

  server.tool(
    "find_cheaper_alternatives",
    "Search for cheaper alternatives to a specific product or ingredient.",
    {
      product_name: z
        .string()
        .describe("Product or ingredient to find cheaper alternatives for"),
      current_sku: z
        .string()
        .optional()
        .describe("Current product SKU to exclude from results"),
      max_results: z.number().int().min(1).max(10).default(5),
    },
    async ({ product_name, current_sku, max_results }) => {
      const client = getClient();
      const results = await client.searchProducts(product_name, 20);

      let candidates = results.results.filter(
        (p) => p.sku !== current_sku && !p.temporaryShortage
      );

      // Sort by effective price
      candidates.sort((a, b) => {
        const priceA = a.onSale ? a.discountedPrice : a.price;
        const priceB = b.onSale ? b.discountedPrice : b.price;
        return priceA - priceB;
      });

      candidates = candidates.slice(0, max_results);

      if (!candidates.length) {
        return { content: [{ type: "text", text: `No alternatives found for "${product_name}".` }] };
      }

      const lines = candidates.map((p) => {
        const price = p.onSale ? p.discountedPrice : p.price;
        const sale = p.onSale ? ` 🔖 (was ${formatPrice(p.price)})` : "";
        const perKilo = p.pricePerKilo ? ` — ${formatPrice(p.pricePerKilo)}/kg` : "";
        return `• **${p.name}** [${p.sku}] — ${formatPrice(price)}${sale}${perKilo}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `**Cheaper alternatives for "${product_name}":**\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.tool(
    "list_available_recipes",
    "List all built-in recipes that can be used with build_recipe_cart.",
    {},
    async () => {
      const { RECIPES } = await import("../recipes/database.js");
      const lines = RECIPES.map(
        (r) =>
          `• **${r.name}** (base: ${r.servings} servings) — also: ${r.aliases.slice(1, 3).join(", ")}`
      );
      return {
        content: [
          {
            type: "text",
            text: `**Available recipes (${RECIPES.length}):**\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );
}
