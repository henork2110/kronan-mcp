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

export interface PublicProductDetail extends PublicProduct {
  description: string;
  image: string;
  qtyPerBaseCompUnit: number | null;
  countryOfOrigin: string | null;
  tags: PublicProductTag[];
}

export interface PublicProductTag {
  name: string;
  slug: string;
}

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
  quantity: number;
  substitution?: boolean;
}

export interface PublicLinesAddInput {
  lines: PublicLineInput[];
  replace: boolean;
}

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
}

export interface PublicShoppingNoteLine {
  token: string;
  text: string | null;
  sku: string | null;
  quantity: number | null;
  completed: boolean;
}

export interface PublicShoppingNote {
  token: string;
  name: string;
  lines: PublicShoppingNoteLine[];
}

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

export interface PublicMe {
  type: "user" | "customer_group";
  name: string;
}

export interface PublicProductPurchaseStats {
  id: number;
  sku: string;
  productName: string;
  thumbnail: string;
  lastPurchased: string;
  ignored: boolean;
}

export interface PaginatedResult<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SearchResult {
  count: number;
  page: number;
  pageCount: number;
  hasNextPage: boolean;
  hits: PublicProduct[];
}

export interface PublicCategory {
  name: string;
  slug: string;
  children?: PublicCategory[];
}
