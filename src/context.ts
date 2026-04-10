import { AsyncLocalStorage } from "async_hooks";
import { KronanClient } from "./kronan/client.js";

export const tokenStore = new AsyncLocalStorage<string>();

export function getClient(): KronanClient {
  const token = tokenStore.getStore();
  if (!token) {
    throw new Error(
      "No Krónan token found. Please add your Krónan API key in Poke Settings → Connections."
    );
  }
  return new KronanClient(token);
}
