import express from "express";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { tokenStore } from "./context.js";
import { registerAllTools } from "./tools/register.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

const app = express();
app.use(express.json());

// Track active MCP sessions: sessionId → transport
const sessions = new Map<string, StreamableHTTPServerTransport>();

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "kronan-mcp",
    version: "1.0.0",
  });
  registerAllTools(server);
  return server;
}

function extractToken(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  if (auth.startsWith("AccessToken ")) return auth.slice(12).trim();
  return auth.trim();
}

// MCP endpoint — POST (new session or existing session message)
app.post("/mcp", async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      error: "No Krónan API key provided. Add your Krónan access token in Poke Settings → Connections.",
    });
    return;
  }

  const existingSessionId = req.headers["mcp-session-id"] as string | undefined;

  let transport = existingSessionId ? sessions.get(existingSessionId) : undefined;

  if (!transport) {
    // New session
    const sessionId = existingSessionId ?? randomUUID();
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
    });

    const server = createMcpServer();
    await server.connect(transport);
    sessions.set(sessionId, transport);

    // Clean up on close
    transport.onclose = () => {
      sessions.delete(sessionId);
    };
  }

  await tokenStore.run(token, () =>
    (transport as StreamableHTTPServerTransport).handleRequest(req, res, req.body)
  );
});

// MCP endpoint — GET (SSE stream for server-sent events)
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: "Missing mcp-session-id header" });
    return;
  }

  const transport = sessions.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing Krónan API key" });
    return;
  }

  await tokenStore.run(token, () =>
    (transport as StreamableHTTPServerTransport).handleRequest(req, res)
  );
});

// MCP endpoint — DELETE (close session)
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId) {
    const transport = sessions.get(sessionId);
    if (transport) {
      await transport.close();
      sessions.delete(sessionId);
    }
  }
  res.status(200).end();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", sessions: sessions.size });
});

app.listen(PORT, () => {
  console.log(`Krónan MCP server running on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
