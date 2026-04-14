import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { RedashClient } from "@/redash-client.js";
import { SchemaCache } from "@/schema-cache.js";
import { MetadataCache } from "@/metadata-cache.js";
import { getToolDefinitions, handleToolCall } from "@/tools.js";
import { logger } from "@/logger.js";

const REDASH_URL = process.env.REDASH_URL;
const REDASH_API_KEY = process.env.REDASH_API_KEY;
const REDASH_ALLOWED_DS = process.env.REDASH_ALLOWED_DS;

if (!REDASH_URL || !REDASH_API_KEY) {
  console.error(
    "REDASH_URL and REDASH_API_KEY environment variables are required."
  );
  process.exit(1);
}

const allowedDataSources = REDASH_ALLOWED_DS
  ? REDASH_ALLOWED_DS.split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n))
  : undefined;

const client = new RedashClient(REDASH_URL, REDASH_API_KEY, {
  allowedDataSources,
});
const schemaCache = new SchemaCache();
const metadataCache = new MetadataCache();

const server = new Server(
  { name: "redash-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: getToolDefinitions() };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const started = Date.now();
  logger.debug(`tool call: ${name}`, args);

  try {
    const result = await handleToolCall(name, args ?? {}, client, schemaCache, metadataCache);
    logger.info(`tool ${name} done in ${Date.now() - started}ms`);
    return result;
  } catch (error) {
    logger.error(`tool ${name} failed:`, client.formatError(error));
    return {
      content: [
        { type: "text" as const, text: `Error: ${client.formatError(error)}` },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(
    `redash-mcp started (log level: ${logger.level}, allowed DS: ${
      client.getAllowedDataSources()?.join(",") ?? "all"
    })`
  );
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
