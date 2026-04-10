export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  searchTerms: string[]; // Krónan search queries to try
  category?: string;
  optional?: boolean;
}

export interface Recipe {
  name: string;
  aliases: string[];
  servings: number; // base servings this ingredient list is for
  ingredients: Ingredient[];
  pantryItems: string[]; // assumed to be at home already
}

export const RECIPES: Recipe[] = [
  {
    name: "Chicken Alfredo",
    aliases: ["chicken alfredo", "kjúklinga alfredo", "alfredo"],
    servings: 4,
    ingredients: [
      { name: "Chicken breast", amount: 600, unit: "g", searchTerms: ["chicken breast", "kjúklingabringa"] },
      { name: "Fettuccine", amount: 400, unit: "g", searchTerms: ["fettuccine", "pasta fettuccine"] },
      { name: "Heavy cream", amount: 500, unit: "ml", searchTerms: ["heavy cream", "whipping cream", "rjómi"] },
      { name: "Parmesan", amount: 100, unit: "g", searchTerms: ["parmesan", "parmigiano"] },
      { name: "Butter", amount: 50, unit: "g", searchTerms: ["butter", "smjör"] },
      { name: "Garlic", amount: 3, unit: "cloves", searchTerms: ["garlic", "hvítlaukur"] },
    ],
    pantryItems: ["salt", "pepper", "olive oil"],
  },
  {
    name: "Bolognese",
    aliases: ["bolognese", "spaghetti bolognese", "spagettí bolognese", "meat sauce pasta"],
    servings: 4,
    ingredients: [
      { name: "Ground beef", amount: 500, unit: "g", searchTerms: ["ground beef", "hakk", "milled beef"] },
      { name: "Spaghetti", amount: 400, unit: "g", searchTerms: ["spaghetti"] },
      { name: "Crushed tomatoes", amount: 400, unit: "g", searchTerms: ["crushed tomatoes", "tomato sauce", "tómatsósa"] },
      { name: "Onion", amount: 1, unit: "pc", searchTerms: ["onion", "laukur"] },
      { name: "Carrot", amount: 1, unit: "pc", searchTerms: ["carrot", "gulrót"] },
      { name: "Celery", amount: 2, unit: "stalks", searchTerms: ["celery", "sellerí"] },
      { name: "Tomato paste", amount: 2, unit: "tbsp", searchTerms: ["tomato paste", "tómatpúré"] },
      { name: "Red wine", amount: 150, unit: "ml", searchTerms: ["red wine", "rauðvín"], optional: true },
    ],
    pantryItems: ["salt", "pepper", "olive oil", "garlic"],
  },
  {
    name: "Carbonara",
    aliases: ["carbonara", "pasta carbonara", "spagettí carbonara"],
    servings: 4,
    ingredients: [
      { name: "Spaghetti", amount: 400, unit: "g", searchTerms: ["spaghetti"] },
      { name: "Pancetta or bacon", amount: 200, unit: "g", searchTerms: ["pancetta", "bacon"] },
      { name: "Eggs", amount: 4, unit: "pcs", searchTerms: ["eggs", "egg", "egg", "egg xl"] },
      { name: "Parmesan", amount: 100, unit: "g", searchTerms: ["parmesan", "pecorino"] },
    ],
    pantryItems: ["salt", "black pepper", "garlic"],
  },
  {
    name: "Tacos",
    aliases: ["tacos", "taco", "chicken tacos", "beef tacos"],
    servings: 4,
    ingredients: [
      { name: "Ground beef or chicken", amount: 500, unit: "g", searchTerms: ["ground beef", "hakk", "chicken breast"] },
      { name: "Taco shells or tortillas", amount: 1, unit: "pack", searchTerms: ["taco shells", "tortilla", "taco"] },
      { name: "Taco seasoning", amount: 1, unit: "pack", searchTerms: ["taco seasoning", "taco krydd"] },
      { name: "Shredded cheese", amount: 200, unit: "g", searchTerms: ["shredded cheese", "grated cheese", "ristaður ostur"] },
      { name: "Sour cream", amount: 200, unit: "ml", searchTerms: ["sour cream", "rjómaostur", "creme fraiche"] },
      { name: "Salsa", amount: 1, unit: "jar", searchTerms: ["salsa"] },
      { name: "Lettuce", amount: 1, unit: "head", searchTerms: ["lettuce", "salat", "iceberg"] },
      { name: "Tomato", amount: 2, unit: "pcs", searchTerms: ["tomato", "tómatur"] },
    ],
    pantryItems: ["salt", "olive oil"],
  },
  {
    name: "Kjötsúpa",
    aliases: ["kjötsúpa", "lamb soup", "icelandic lamb soup", "íslensk kjötsúpa"],
    servings: 6,
    ingredients: [
      { name: "Lamb", amount: 1000, unit: "g", searchTerms: ["lamb", "lambakjöt", "lamb neck", "lamb shoulder"] },
      { name: "Potato", amount: 500, unit: "g", searchTerms: ["potato", "kartafla"] },
      { name: "Turnip", amount: 200, unit: "g", searchTerms: ["turnip", "næpa"] },
      { name: "Carrot", amount: 3, unit: "pcs", searchTerms: ["carrot", "gulrót"] },
      { name: "Onion", amount: 1, unit: "pc", searchTerms: ["onion", "laukur"] },
      { name: "Swede / rutabaga", amount: 200, unit: "g", searchTerms: ["swede", "kálrót"] },
      { name: "Rice", amount: 100, unit: "g", searchTerms: ["rice", "hrísgrjón"], optional: true },
    ],
    pantryItems: ["salt", "pepper", "water"],
  },
  {
    name: "Plokkfiskur",
    aliases: ["plokkfiskur", "fish stew", "icelandic fish stew", "plokkur"],
    servings: 4,
    ingredients: [
      { name: "Cod or haddock", amount: 600, unit: "g", searchTerms: ["cod", "þorskur", "haddock", "ýsa"] },
      { name: "Potato", amount: 600, unit: "g", searchTerms: ["potato", "kartafla"] },
      { name: "Onion", amount: 1, unit: "pc", searchTerms: ["onion", "laukur"] },
      { name: "Milk", amount: 300, unit: "ml", searchTerms: ["milk", "mjólk"] },
      { name: "Butter", amount: 50, unit: "g", searchTerms: ["butter", "smjör"] },
      { name: "Flour", amount: 3, unit: "tbsp", searchTerms: ["flour", "hveiti"] },
    ],
    pantryItems: ["salt", "pepper"],
  },
  {
    name: "Pizza Margherita",
    aliases: ["pizza", "margherita", "homemade pizza"],
    servings: 4,
    ingredients: [
      { name: "Pizza dough or base", amount: 1, unit: "pack", searchTerms: ["pizza dough", "pizza base", "pizzadeig"] },
      { name: "Tomato sauce / passata", amount: 200, unit: "ml", searchTerms: ["passata", "tomato sauce", "pizza sauce"] },
      { name: "Mozzarella", amount: 250, unit: "g", searchTerms: ["mozzarella"] },
      { name: "Fresh basil", amount: 1, unit: "bunch", searchTerms: ["basil", "basil", "ferskur basil"], optional: true },
    ],
    pantryItems: ["salt", "olive oil", "oregano"],
  },
  {
    name: "Chicken Curry",
    aliases: ["chicken curry", "kjúklinga curry", "curry"],
    servings: 4,
    ingredients: [
      { name: "Chicken breast", amount: 600, unit: "g", searchTerms: ["chicken breast", "kjúklingabringa"] },
      { name: "Coconut milk", amount: 400, unit: "ml", searchTerms: ["coconut milk", "kókósmjólk"] },
      { name: "Curry paste or powder", amount: 3, unit: "tbsp", searchTerms: ["curry paste", "curry powder", "curry"] },
      { name: "Onion", amount: 1, unit: "pc", searchTerms: ["onion", "laukur"] },
      { name: "Crushed tomatoes", amount: 200, unit: "g", searchTerms: ["crushed tomatoes", "tómatsósa"] },
      { name: "Rice", amount: 300, unit: "g", searchTerms: ["rice", "hrísgrjón", "basmati"] },
    ],
    pantryItems: ["salt", "oil", "garlic", "ginger"],
  },
  {
    name: "Salmon with vegetables",
    aliases: ["salmon", "lax", "lax með grænmeti", "baked salmon", "salmon dinner"],
    servings: 4,
    ingredients: [
      { name: "Salmon fillet", amount: 700, unit: "g", searchTerms: ["salmon fillet", "laxaflak", "lax"] },
      { name: "Broccoli", amount: 300, unit: "g", searchTerms: ["broccoli"] },
      { name: "Potato", amount: 500, unit: "g", searchTerms: ["potato", "kartafla"] },
      { name: "Lemon", amount: 1, unit: "pc", searchTerms: ["lemon", "sítróna"] },
      { name: "Butter", amount: 30, unit: "g", searchTerms: ["butter", "smjör"] },
    ],
    pantryItems: ["salt", "pepper", "olive oil", "garlic"],
  },
  {
    name: "Pancakes",
    aliases: ["pancakes", "pönnukökur", "crepes", "breakfast pancakes"],
    servings: 4,
    ingredients: [
      { name: "Flour", amount: 300, unit: "g", searchTerms: ["flour", "hveiti"] },
      { name: "Eggs", amount: 3, unit: "pcs", searchTerms: ["eggs", "egg"] },
      { name: "Milk", amount: 500, unit: "ml", searchTerms: ["milk", "mjólk"] },
      { name: "Butter", amount: 50, unit: "g", searchTerms: ["butter", "smjör"] },
      { name: "Sugar", amount: 2, unit: "tbsp", searchTerms: ["sugar", "sykur"] },
    ],
    pantryItems: ["salt", "vanilla"],
  },
  {
    name: "Hamburgers",
    aliases: ["hamburger", "burger", "burgers", "homemade burger"],
    servings: 4,
    ingredients: [
      { name: "Ground beef", amount: 600, unit: "g", searchTerms: ["ground beef", "hakk"] },
      { name: "Burger buns", amount: 4, unit: "pcs", searchTerms: ["burger bun", "hamburgarabrauð"] },
      { name: "Cheese slices", amount: 4, unit: "slices", searchTerms: ["cheese slices", "ostur"] },
      { name: "Lettuce", amount: 1, unit: "head", searchTerms: ["lettuce", "salat"] },
      { name: "Tomato", amount: 2, unit: "pcs", searchTerms: ["tomato", "tómatur"] },
      { name: "Red onion", amount: 1, unit: "pc", searchTerms: ["red onion", "rauðlaukur"] },
      { name: "Ketchup", amount: 1, unit: "bottle", searchTerms: ["ketchup"], optional: true },
      { name: "Mustard", amount: 1, unit: "bottle", searchTerms: ["mustard", "sinnep"], optional: true },
    ],
    pantryItems: ["salt", "pepper"],
  },
  {
    name: "Tomato Soup",
    aliases: ["tomato soup", "tómatssúpa", "creamy tomato soup"],
    servings: 4,
    ingredients: [
      { name: "Crushed tomatoes", amount: 800, unit: "g", searchTerms: ["crushed tomatoes", "tómatstappa"] },
      { name: "Onion", amount: 1, unit: "pc", searchTerms: ["onion", "laukur"] },
      { name: "Heavy cream", amount: 200, unit: "ml", searchTerms: ["cream", "rjómi"] },
      { name: "Vegetable stock", amount: 500, unit: "ml", searchTerms: ["vegetable stock", "grænmetiskraftur"] },
    ],
    pantryItems: ["salt", "pepper", "olive oil", "garlic", "sugar", "basil"],
  },
  {
    name: "Caesar Salad",
    aliases: ["caesar salad", "caesar", "chicken caesar"],
    servings: 4,
    ingredients: [
      { name: "Romaine lettuce", amount: 1, unit: "head", searchTerms: ["romaine", "lettuce", "salat"] },
      { name: "Parmesan", amount: 60, unit: "g", searchTerms: ["parmesan"] },
      { name: "Caesar dressing", amount: 1, unit: "bottle", searchTerms: ["caesar dressing", "caesar"] },
      { name: "Croutons", amount: 100, unit: "g", searchTerms: ["croutons"] },
      { name: "Chicken breast", amount: 400, unit: "g", searchTerms: ["chicken breast", "kjúklingabringa"], optional: true },
    ],
    pantryItems: [],
  },
  {
    name: "Stir Fry",
    aliases: ["stir fry", "stir-fry", "noodle stir fry", "vegetable stir fry", "wok"],
    servings: 4,
    ingredients: [
      { name: "Noodles or rice", amount: 400, unit: "g", searchTerms: ["noodles", "egg noodles", "rice"] },
      { name: "Chicken or beef strips", amount: 500, unit: "g", searchTerms: ["chicken breast", "beef strips", "kjúklingur"] },
      { name: "Mixed vegetables / stir fry mix", amount: 400, unit: "g", searchTerms: ["stir fry vegetables", "wok vegetables", "frozen vegetables"] },
      { name: "Soy sauce", amount: 4, unit: "tbsp", searchTerms: ["soy sauce", "sójasósa"] },
      { name: "Sesame oil", amount: 2, unit: "tbsp", searchTerms: ["sesame oil", "sesamolía"], optional: true },
    ],
    pantryItems: ["garlic", "ginger", "oil"],
  },
  {
    name: "Oatmeal",
    aliases: ["oatmeal", "porridge", "hafragrautur", "breakfast oats"],
    servings: 2,
    ingredients: [
      { name: "Oats", amount: 200, unit: "g", searchTerms: ["oats", "hafrar", "oatmeal"] },
      { name: "Milk or plant milk", amount: 400, unit: "ml", searchTerms: ["milk", "mjólk", "oat milk"] },
      { name: "Banana", amount: 1, unit: "pc", searchTerms: ["banana"], optional: true },
      { name: "Berries", amount: 100, unit: "g", searchTerms: ["berries", "ber", "frozen berries"], optional: true },
    ],
    pantryItems: ["salt", "honey", "cinnamon"],
  },
];

export function findRecipe(query: string): Recipe | null {
  const q = query.toLowerCase().trim();
  return (
    RECIPES.find(
      (r) =>
        r.name.toLowerCase() === q ||
        r.aliases.some((a) => a.toLowerCase() === q)
    ) ??
    RECIPES.find(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.aliases.some((a) => a.toLowerCase().includes(q)) ||
        q.includes(r.name.toLowerCase())
    ) ??
    null
  );
}

export function scaleIngredients(
  recipe: Recipe,
  targetServings: number
): Ingredient[] {
  const factor = targetServings / recipe.servings;
  return recipe.ingredients.map((ing) => ({
    ...ing,
    amount: Math.ceil(ing.amount * factor),
  }));
}
