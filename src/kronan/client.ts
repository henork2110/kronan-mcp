import type {
  PublicMe,
  PublicProductDetail,
  PublicCheckout,
  PublicLinesAddInput,
  PublicOrder,
  PublicOrderSummary,
  PublicProductList,
  PublicProductListDetail,
  PublicShoppingNote,
  PublicShoppingNoteLineArchived,
  PublicProductPurchaseStats,
  PaginatedResult,
  SearchResult,
  PublicCategory,
  PublicCategoryProductList,
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
    const headers: Record<string, string> = {
      Authorization: `AccessToken ${this.token}`,
      Accept: "application/json",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401) throw new Error("Invalid or expired Krónan token. Please check your API key in Poke Connections.");
      if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
      if (res.status === 404) throw new Error(`Not found: ${path}`);
      throw new Error(`Krónan API error ${res.status}: ${text}`);
    }

    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return undefined as T;
    }
    return res.json() as Promise<T>;
  }

  // Identity — returns array, unwrap first element
  async getMe(): Promise<PublicMe> {
    const result = await this.request<PublicMe[]>("GET", "/me/");
    return result[0];
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

  getCategoryProducts(slug: string, page = 1) {
    return this.request<PublicCategoryProductList>(
      "GET",
      `/categories/${encodeURIComponent(slug)}/products/?page=${page}`
    );
  }

  // Checkout — returns array, unwrap first element
  async getCheckout(): Promise<PublicCheckout> {
    const result = await this.request<PublicCheckout[]>("GET", "/checkout/");
    return result[0];
  }

  setCheckoutLines(input: PublicLinesAddInput) {
    return this.request<PublicCheckout>("POST", "/checkout/lines/", input);
  }

  // Orders
  listOrders(limit = 15, offset = 0) {
    return this.request<PaginatedResult<PublicOrderSummary>>(
      "GET",
      `/orders/?limit=${limit}&offset=${offset}`
    );
  }

  getOrder(token: string) {
    return this.request<PublicOrder>("GET", `/orders/${encodeURIComponent(token)}/`);
  }

  deleteOrderLines(orderToken: string, lineIds: number[]) {
    return this.request<PublicOrder>(
      "POST",
      `/orders/${encodeURIComponent(orderToken)}/delete-lines/`,
      { lineIds }
    );
  }

  toggleOrderLineSubstitution(orderToken: string, lineIds: number[]) {
    return this.request<PublicOrder>(
      "POST",
      `/orders/${encodeURIComponent(orderToken)}/lines-toggle-substitution/`,
      { lineIds }
    );
  }

  // Lowers all specified lines to the same target quantity
  lowerOrderLineQuantities(orderToken: string, lineIds: number[], quantity: number) {
    return this.request<PublicOrder>(
      "POST",
      `/orders/${encodeURIComponent(orderToken)}/lower-quantity-lines/`,
      { lineIds, quantity }
    );
  }

  // Product lists
  listProductLists(limit = 15, offset = 0) {
    return this.request<PaginatedResult<PublicProductList>>(
      "GET",
      `/product-lists/?limit=${limit}&offset=${offset}`
    );
  }

  createProductList(name: string, description = "") {
    return this.request<PublicProductList>("POST", "/product-lists/", { name, description });
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
    return this.request<PublicProductListDetail>(
      "POST",
      `/product-lists/${encodeURIComponent(token)}/update-item/`,
      { sku, quantity }
    );
  }

  sortProductListItems(token: string) {
    return this.request<PublicProductListDetail>(
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

  setPurchaseStatIgnored(id: number, isIgnored: boolean) {
    return this.request<PublicProductPurchaseStats>(
      "PATCH",
      `/product-purchase-stats/${id}/set-ignored/`,
      { isIgnored }
    );
  }

  // Shopping notes — returns array, unwrap first element
  async getShoppingNote(): Promise<PublicShoppingNote> {
    const result = await this.request<PublicShoppingNote[]>("GET", "/shopping-notes/");
    return result[0];
  }

  addShoppingNoteLine(data: { text?: string; sku?: string; quantity?: number }) {
    return this.request<PublicShoppingNote>("POST", "/shopping-notes/add-line/", data);
  }

  changeShoppingNoteLine(data: {
    token?: string;
    text?: string;
    quantity?: number;
  }) {
    return this.request<PublicShoppingNote>("PATCH", "/shopping-notes/change-line/", data);
  }

  // Reorder uses query params, not request body
  changePlacement(lineTokens: string[]) {
    const params = lineTokens.map((t) => `lines_tokens=${encodeURIComponent(t)}`).join("&");
    return this.request<PublicShoppingNote>("PATCH", `/shopping-notes/change-placement/?${params}`);
  }

  // Delete line uses query param
  deleteShoppingNoteLine(lineToken: string) {
    return this.request<void>(
      "DELETE",
      `/shopping-notes/delete-line/?token=${encodeURIComponent(lineToken)}`
    );
  }

  deleteArchivedShoppingNoteLine(lineToken: string) {
    return this.request<void>(
      "DELETE",
      `/shopping-notes/delete-line-archived/?token=${encodeURIComponent(lineToken)}`
    );
  }

  clearShoppingNote() {
    return this.request<void>("DELETE", "/shopping-notes/delete-shopping-note/");
  }

  toggleCompleteOnLine(lineToken: string) {
    return this.request<PublicShoppingNote>(
      "PATCH",
      "/shopping-notes/toggle-complete-on-line/",
      { token: lineToken }
    );
  }

  getArchivedShoppingNoteLines() {
    return this.request<PublicShoppingNoteLineArchived[]>("GET", "/shopping-notes/lines-archived/");
  }

  async checkStoreProductOrderEligibility(): Promise<boolean> {
    try {
      await this.request<void>("GET", "/shopping-notes/is-eligible-for-store-product-order/");
      return true; // 204 = eligible
    } catch {
      return false;
    }
  }

  applyStoreProductOrder() {
    return this.request<PublicShoppingNote>("POST", "/shopping-notes/store-product-order/", {});
  }
}
