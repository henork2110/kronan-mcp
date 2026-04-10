import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient } from "../context.js";

export function registerIdentityTools(server: McpServer) {
  server.tool(
    "get_me",
    "Get the current authenticated Krónan user or customer group identity.",
    {},
    async () => {
      const client = getClient();
      const me = await client.getMe();
      return {
        content: [
          {
            type: "text",
            text: `Logged in as: **${me.name}** (${me.type})`,
          },
        ],
      };
    }
  );
}
