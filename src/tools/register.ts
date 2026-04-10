import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerIdentityTools } from "./identity.js";
import { registerProductTools } from "./products.js";
import { registerCheckoutTools } from "./checkout.js";
import { registerOrderTools } from "./orders.js";
import { registerListTools } from "./lists.js";
import { registerStatsTools } from "./stats.js";
import { registerNoteTools } from "./notes.js";
import { registerRecipeTools } from "./recipes.js";

export function registerAllTools(server: McpServer) {
  registerIdentityTools(server);
  registerProductTools(server);
  registerCheckoutTools(server);
  registerOrderTools(server);
  registerListTools(server);
  registerStatsTools(server);
  registerNoteTools(server);
  registerRecipeTools(server);
}
