import type {
  PublicMe,
  PublicProduct,
  PublicProductDetail,
  PublicCheckout,
  PublicLinesAddInput,
  PublicOrder,
  PublicOrderSummary,
  PublicProductList,
  PublicProductListDetail,
  PublicShoppingNote,
  PublicProductPurchaseStats,
  PaginatedResult,
  SearchResult,
  PublicCategory,
} from "./types.js";

const BASE_URL = "https://api.kronan.is/api/v1";

export class KronanClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `AccessToken ${this.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401) throw new Error("Invalid or expired Krónan token. Please check your API key in Poke Connections.");
      if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
      if (res.status === 404) throw new Error(`Not found: ${path}`);
      throw new Error(`Krónan API error ${res.status}: ${text}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  // Identity
  getMe() {
    return this.request<PublicMe>("GET", "/me/");
  }

  // Products
  searchProducts(query: string, pageSize = 20, page = 1, withDetail = false) {
    return this.request<SearchResult>("POST", "/products/search/", {
      query,
      pageSize,
      page,
      withDetail,
    });
  }

  getProduct(sku: string) {
    return this.request<PublicProductDetail>("GET", `/products/${encodeURIComponent(sku)}/`);
  }

  // Categories
  getCategories() {
    return this.request<PublicCategory[]>("GET", "/categories/");
  }

  getCategoryProducts(slug: string, pageSize = 48, page = 1) {
    return this.request<{ count: number; results: PublicProduct[] }>(
      "GET",
      `/categories/${encodeURIComponent(slug)}/products/?page=${page}&pageSize=${pageSize}`
    );
  }

  // Checkout
  getCheckout() {
    return this.request<PublicCheckout>("GET", "/checkout/");
  }

  setCheckoutLines(lines: PublicLinesAddInput) {
    return this.request<PublicCheckout>("POST", "/checkout/lines/", lines);
  }

  // Orders
  listOrders(limit = 10, offset = 0) {
    return this.request<PaginatedResult<PublicOrderSummary>>(
      "GET",
      `/orders/?limit=${limit}&offset=${offset}`
    );
  }

  getOrder(token: string) {
    return this.request<PublicOrder>("GET", `/orders/${encodeURIComponent(token)}/`);
  }

  deleteOrderLines(orderToken: string, lineIds: number[]) {
    return this.request<void>("POST", `/orders/${encodeURIComponent(orderToken)}/delete-lines/`, {
      line_ids: lineIds,
    });
  }

  toggleOrderLineSubstitution(orderToken: string, lineIds: number[]) {
    return this.request<void>(
      "POST",
      `/orders/${encodeURIComponent(orderToken)}/lines-toggle-substitution/`,
      { line_ids: lineIds }
    );
  }

  lowerOrderLineQuantities(
    orderToken: string,
    lines: { id: number; quantity: number }[]
  ) {
    return this.request<void>(
      "POST",
      `/orders/${encodeURIComponent(orderToken)}/lower-quantity-lines/`,
      { lines }
    );
  }

  // Product lists
  listProductLists() {
    return this.request<PublicProductList[]>("GET", "/product-lists/");
  }

  createProductList(name: string, description = "") {
    return this.request<PublicProductList>("POST", "/product-lists/", {
      name,
      description,
    });
  }

  getProductList(token: string) {
    return this.request<PublicProductListDetail>(
      "GET",
      `/product-lists/${encodeURIComponent(token)}/`
    );
  }

  updateProductList(token: string, data: { name?: string; description?: string }) {
    return this.request<PublicProductList>(
      "PATCH",
      `/product-lists/${encodeURIComponent(token)}/`,
      data
    );
  }

  deleteProductList(token: string) {
    return this.request<void>("DELETE", `/product-lists/${encodeURIComponent(token)}/`);
  }

  deleteAllProductListItems(token: string) {
    return this.request<void>(
      "DELETE",
      `/product-lists/${encodeURIComponent(token)}/delete-all-items/`
    );
  }

  updateProductListItem(token: string, sku: string, quantity: number) {
    return this.request<void>(
      "POST",
      `/product-lists/${encodeURIComponent(token)}/update-item/`,
      { sku, quantity }
    );
  }

  sortProductListItems(token: string) {
    return this.request<void>(
      "POST",
      `/product-lists/${encodeURIComponent(token)}/sort-items/`,
      {}
    );
  }

  // Purchase stats
  getPurchaseStats(limit = 20, offset = 0) {
    return this.request<PaginatedResult<PublicProductPurchaseStats>>(
      "GET",
      `/product-purchase-stats/?limit=${limit}&offset=${offset}`
    );
  }

  setPurchaseStatIgnored(id: number, ignored: boolean) {
    return this.request<void>(
      "PATCH",
      `/product-purchase-stats/${id}/set-ignored/`,
      { ignored }
    );
  }

  // Shopping notes
  getShoppingNote() {
    return this.request<PublicShoppingNote>("GET", "/shopping-notes/");
  }

  addShoppingNoteLine(data: { text?: string; sku?: string; quantity?: number }) {
    return this.request<PublicShoppingNote>("POST", "/shopping-notes/add-line/", data);
  }

  changeShoppingNoteLine(data: {
    token: string;
    text?: string;
    sku?: string;
    quantity?: number;
  }) {
    return this.request<PublicShoppingNote>("PATCH", "/shopping-notes/change-line/", data);
  }

  changePlacement(tokens: string[]) {
    return this.request<PublicShoppingNote>("PATCH", "/shopping-notes/change-placement/", {
      tokens,
    });
  }

  deleteShoppingNoteLine(token: string) {
    return this.request<void>("DELETE", "/shopping-notes/delete-line/", { token });
  }

  deleteArchivedShoppingNoteLine(token: string) {
    return this.request<void>("DELETE", "/shopping-notes/delete-line-archived/", { token });
  }

  clearShoppingNote() {
    return this.request<void>("DELETE", "/shopping-notes/delete-shopping-note/");
  }

  toggleCompleteOnLine(token: string) {
    return this.request<PublicShoppingNote>(
      "PATCH",
      "/shopping-notes/toggle-complete-on-line/",
      { token }
    );
  }

  getArchivedShoppingNoteLines() {
    return this.request<PublicShoppingNote>("GET", "/shopping-notes/lines-archived/");
  }

  checkStoreProductOrderEligibility() {
    return this.request<{ eligible: boolean; errors: unknown[] }>(
      "GET",
      "/shopping-notes/is-eligible-for-store-product-order/"
    );
  }

  applyStoreProductOrder() {
    return this.request<PublicShoppingNote>(
      "POST",
      "/shopping-notes/store-product-order/",
      {}
    );
  }
}
