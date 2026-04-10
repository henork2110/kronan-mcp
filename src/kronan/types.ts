export interface PublicProductTag {
  slug: string;
  name: string;
}

// Base product shape used in checkout, product lists, categories
export interface PublicProduct {
  sku: string;
  name: string;
  thumbnail: string;
  price: number;
  discountedPrice: number;
  discountPercent: number;
  onSale: boolean;
  priceInfo: string | null;
  chargedByWeight: boolean;
  pricePerKilo: number | null;
  baseComparisonUnit: string | null;
  temporaryShortage: boolean;
}

// Full product detail (GET /products/{sku}/)
export interface PublicProductDetail extends PublicProduct {
  description: string;
  image: string;
  qtyPerBaseCompUnit: number | null;
  countryOfOrigin: string | null;
  tags: PublicProductTag[];
}

// Search hit — discount info is nested inside `detail` only when withDetail: true
export interface PublicSearchDetail {
  discountedPrice: number;
  discountPercent: number;
  onSale: boolean;
  tags: PublicProductTag[];
}

export interface PublicSearchHit {
  sku: string;
  name: string;
  price: number;
  thumbnail: string | null;
  temporaryShortage: boolean;
  priceInfo: string | null;
  chargedByWeight: boolean;
  pricePerKilo: number | null;
  baseComparisonUnit: string | null;
  detail: PublicSearchDetail | null; // only present when withDetail: true
}

export interface SearchResult {
  count: number;
  page: number;
  pageCount: number;
  hasNextPage: boolean;
  hits: PublicSearchHit[];
}

// Checkout
export interface PublicCheckoutLine {
  id: number;
  quantity: number;
  product: PublicProduct;
  total: number;
  price: number;
  substitution: boolean;
}

export interface PublicCheckout {
  token: string;
  lines: PublicCheckoutLine[];
  total: number;
  subtotal: number;
  baggingFee: number;
  serviceFee: number;
  shippingFee: number;
  shippingFeeCutoff: number;
}

export interface PublicLineInput {
  sku: string;
  quantity?: number;
  substitution?: boolean;
}

export interface PublicLinesAddInput {
  lines: PublicLineInput[];
  replace?: boolean;
}

// Orders
export interface PublicOrderLine {
  id: number;
  productName: string;
  sku: string;
  quantity: number;
  quantityOrdered: number;
  unitPrice: number;
  substitution: boolean;
  substitutionForLineId: number | null;
  isMutable: boolean;
  isLastChance: boolean;
  thumbnail: string;
  total: number;
}

export interface PublicOrder {
  token: string;
  created: string;
  status: string;
  type: string | null;
  total: number;
  discount: number;
  deliveryDate: string | null;
  allowAlterOrderLines: boolean;
  lines: PublicOrderLine[];
}

export interface PublicOrderSummary {
  token: string;
  created: string;
  status: string;
  type: string | null;
  total: number;
  discount: number;
  deliveryDate: string | null;
  allowAlterOrderLines: boolean;
}

// Shopping notes
export interface PublicShoppingNoteProduct {
  sku: string | null;
  name: string;
  description: string;
  thumbnail: string;
}

export interface PublicShoppingNoteLine {
  token: string;
  text: string | null;
  quantity: number | null;
  product: PublicShoppingNoteProduct | null;
  placement: number;
  isCompleted: boolean;
}

export interface PublicShoppingNote {
  token: string;
  name: string;
  lines: PublicShoppingNoteLine[];
}

export interface PublicShoppingNoteLineArchived {
  token: string;
  text: string;
  completedCount: number;
}

// Product lists
export interface PublicProductListItem {
  id: number;
  quantity: number;
  product: PublicProduct;
}

export interface PublicProductList {
  id: number;
  name: string;
  token: string;
  description: string;
}

export interface PublicProductListDetail extends PublicProductList {
  items: PublicProductListItem[];
}

// Purchase stats
export interface PublicProductPurchaseStats {
  id: number;
  product: PublicProduct;
  purchaseCount: number;
  quantityPurchased: number;
  averagePurchaseQuantity: number | null;
  lastPurchaseQuantity: number;
  averagePurchaseIntervalDays: number | null;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  isIgnored: boolean;
}

// Me
export interface PublicMe {
  type: "user" | "customer_group";
  name: string;
}

// Categories
export interface PublicCategoryLevel2 {
  slug: string;
  name: string;
}

export interface PublicCategoryLevel1 {
  slug: string;
  name: string;
  children: PublicCategoryLevel2[];
}

export interface PublicCategory {
  slug: string;
  name: string;
  backgroundImage: string | null;
  icon: string | null;
  children: PublicCategoryLevel1[];
}

export interface PublicCategoryProductList {
  name: string;
  count: number;
  page: number;
  pageCount: number;
  hasNextPage: boolean;
  products: PublicProduct[];
}

// Pagination wrapper (used by orders, product-lists, stats)
export interface PaginatedResult<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
