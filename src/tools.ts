import { MetadataCache } from "@/metadata-cache.js";
import { ClientRegistry } from "@/client-registry.js";
import type { ToolDefinition, ToolResult } from "@/interfaces/tools.js";
import type {
  GetSchemaArgs,
  ExecuteQueryArgs,
  ExploreColumnArgs,
  FindMappingArgs,
  SaveQueryArgs,
  GetCacheArgs,
  ListSavedQueriesArgs,
  GetSavedQueryArgs,
  ExecuteSavedQueryArgs,
  SampleRowsArgs,
  DescribeTableArgs,
  FindTableArgs,
  JoinHintsArgs,
  UpdateQueryArgs,
  ListDashboardsArgs,
  GetDashboardArgs,
  ExplainQueryArgs,
  ExportMetadataCacheArgs,
  ImportMetadataCacheArgs,
} from "@/interfaces/tool-args.js";
import { handleListDataSources } from "@/tools/list-data-sources.js";
import { handleGetSchema } from "@/tools/get-schema.js";
import { handleExecuteQuery } from "@/tools/execute-query.js";
import { handleExploreColumn } from "@/tools/explore-column.js";
import { handleFindMapping } from "@/tools/find-mapping.js";
import { handleSaveQuery } from "@/tools/save-query.js";
import { handleGetCache } from "@/tools/get-cache.js";
import { handleListSavedQueries } from "@/tools/list-saved-queries.js";
import { handleGetSavedQuery } from "@/tools/get-saved-query.js";
import { handleExecuteSavedQuery } from "@/tools/execute-saved-query.js";
import { handleSampleRows } from "@/tools/sample-rows.js";
import { handleSelfTest } from "@/tools/self-test.js";
import { handleDescribeTable } from "@/tools/describe-table.js";
import { handleFindTable } from "@/tools/find-table.js";
import { handleJoinHints } from "@/tools/join-hints.js";
import { handleUpdateQuery } from "@/tools/update-query.js";
import { handleListDashboards } from "@/tools/list-dashboards.js";
import { handleGetDashboard } from "@/tools/get-dashboard.js";
import { handleExplainQuery } from "@/tools/explain-query.js";
import { handleExportMetadataCache } from "@/tools/export-metadata-cache.js";
import { handleImportMetadataCache } from "@/tools/import-metadata-cache.js";

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "list_data_sources",
      description: "List Redash data sources.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "self_test",
      description:
        "Check MCP server health: environment variables, Redash connectivity, and schema access.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_schema",
      description:
        "Fetch table/column schema for a data source. Cached for fast repeated calls. Use keywords to filter tables.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: {
            type: "number",
            description: "Data source ID",
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description:
              "Keywords to filter table names (e.g. ['order', 'user'])",
          },
          refresh: {
            type: "boolean",
            description: "If true, bypass cache and refetch",
          },
        },
        required: ["data_source_id"],
      },
    },
    {
      name: "execute_query",
      description:
        "Execute SQL and return results. Async job polling is handled internally. If no LIMIT is present, max_rows (default 1000) is auto-injected.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: {
            type: "number",
            description: "Data source ID",
          },
          query: {
            type: "string",
            description: "SQL to run (SELECT/WITH only)",
          },
          max_rows: {
            type: "number",
            description:
              "Max rows to auto-inject when LIMIT is absent (default 1000). To get the full result, specify LIMIT in the query yourself.",
          },
          save_csv: {
            type: "string",
            description:
              "If set, save results to a CSV file at this path. Use to keep large results out of the model context.",
          },
          timeout_ms: {
            type: "number",
            description:
              "Query execution timeout in ms (default 120000). Can also be set via REDASH_QUERY_TIMEOUT_MS env var.",
          },
          offset: {
            type: "number",
            description:
              "Pagination OFFSET. Applied only when LIMIT is auto-injected (errors if the query already has LIMIT). Without ORDER BY, row ordering is not guaranteed.",
          },
          summarize: {
            type: "string",
            enum: ["auto", "always", "never"],
            description:
              "auto (default): summarize when row count exceeds REDASH_SUMMARIZE_THRESHOLD (default 500) / always: always summarize / never: always return full rows. When save_csv is set, auto does not summarize.",
          },
        },
        required: ["data_source_id", "query"],
      },
    },
    {
      name: "explore_column",
      description:
        "Fetch DISTINCT values and counts for columns. Use before writing a WHERE clause to check column types and values. Multiple columns can be explored at once.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: {
            type: "number",
            description: "Data source ID",
          },
          columns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                table: {
                  type: "string",
                  description: "Table name (schema.table)",
                },
                column: { type: "string", description: "Column name" },
                partition_filter: {
                  type: "string",
                  description:
                    "Partition filter (e.g. p_ymd = '20260413'). Required for large tables.",
                },
              },
              required: ["table", "column"],
            },
            description: "Columns to explore",
          },
          limit: {
            type: "number",
            description: "Max distinct values per column (default 20)",
          },
        },
        required: ["data_source_id", "columns"],
      },
    },
    {
      name: "explain_query",
      description:
        "Run EXPLAIN to inspect the execution plan without running the query. Use to preview cost/scan scope. Engine support varies — if it fails, run engine-specific syntax directly.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: { type: "number", description: "Data source ID" },
          query: { type: "string", description: "SQL to EXPLAIN" },
        },
        required: ["data_source_id", "query"],
      },
    },
    {
      name: "describe_table",
      description:
        "Fetch column list and sample rows for a table in one call. A shortcut combining get_schema + sample_rows.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: { type: "number", description: "Data source ID" },
          table: { type: "string", description: "Table name (schema.table)" },
          sample_limit: { type: "number", description: "Sample row count (default 5)" },
          partition_filter: {
            type: "string",
            description: "Partition filter (required for large tables)",
          },
        },
        required: ["data_source_id", "table"],
      },
    },
    {
      name: "find_table",
      description:
        "Find tables by column name, or filter by a table-name keyword. Use to locate join candidates or find which table contains a specific field.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: { type: "number", description: "Data source ID" },
          column: {
            type: "string",
            description: "Column name to search for (e.g. user_id)",
          },
          table_keyword: {
            type: "string",
            description: "Table-name keyword filter (e.g. order)",
          },
        },
        required: ["data_source_id"],
      },
    },
    {
      name: "join_hints",
      description:
        "Suggest join candidates — tables that share column names with the target table. Does not guarantee true FK relationships; verify types and values separately.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: { type: "number", description: "Data source ID" },
          table: { type: "string", description: "Base table name" },
        },
        required: ["data_source_id", "table"],
      },
    },
    {
      name: "sample_rows",
      description:
        "Fetch sample rows for a table (default 5). Use to see column structure and actual value shapes at once. Unlike explore_column (DISTINCT only), this returns raw rows.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: { type: "number", description: "Data source ID" },
          table: {
            type: "string",
            description: "Table name (schema.table)",
          },
          limit: { type: "number", description: "Sample row count (default 5)" },
          partition_filter: {
            type: "string",
            description:
              "Partition filter (e.g. p_ymd = '20260413'). Required for large tables.",
          },
          columns: {
            type: "array",
            items: { type: "string" },
            description: "Columns to select (defaults to *)",
          },
        },
        required: ["data_source_id", "table"],
      },
    },
    {
      name: "find_mapping",
      description:
        "Automatically locate and query the mapping table for a numeric code column. Use to find out what a code value means.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: {
            type: "number",
            description: "Data source ID",
          },
          table: {
            type: "string",
            description:
              "Source table that contains the code column (e.g. bh_idusme.order_total)",
          },
          column: {
            type: "string",
            description: "Code column name (e.g. lastest_state)",
          },
        },
        required: ["data_source_id", "table", "column"],
      },
    },
    {
      name: "save_query",
      description:
        "Save a SQL query to Redash. description and tags can also be specified.",
      inputSchema: {
        type: "object",
        properties: {
          data_source_id: { type: "number", description: "Data source ID" },
          name: { type: "string", description: "Query name" },
          query: { type: "string", description: "SQL to save" },
          description: {
            type: "string",
            description: "Query description (optional)",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags (optional)",
          },
        },
        required: ["data_source_id", "name", "query"],
      },
    },
    {
      name: "update_query",
      description:
        "Update an existing saved query's name/query/description/tags. Only the provided fields are updated.",
      inputSchema: {
        type: "object",
        properties: {
          query_id: { type: "number", description: "Query ID" },
          name: { type: "string", description: "New name" },
          query: { type: "string", description: "New SQL" },
          description: { type: "string", description: "New description" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "New tags",
          },
        },
        required: ["query_id"],
      },
    },
    {
      name: "list_saved_queries",
      description:
        "List saved queries in Redash. Supports keyword search and data-source filtering. Use to start from queries the team has already validated.",
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string", description: "Title/description search" },
          data_source_id: {
            type: "number",
            description: "Filter by data source",
          },
          page: { type: "number", description: "Page number (default 1)" },
          page_size: { type: "number", description: "Page size (default 25)" },
        },
      },
    },
    {
      name: "get_saved_query",
      description: "Fetch SQL and metadata of a saved query.",
      inputSchema: {
        type: "object",
        properties: {
          query_id: { type: "number", description: "Query ID" },
        },
        required: ["query_id"],
      },
    },
    {
      name: "execute_saved_query",
      description:
        "Execute a saved query and return results. Pass query parameters via parameters.",
      inputSchema: {
        type: "object",
        properties: {
          query_id: { type: "number", description: "Query ID" },
          parameters: {
            type: "object",
            description: "Query parameters (e.g. { \"date\": \"2026-01-01\" })",
            additionalProperties: true,
          },
          max_rows: {
            type: "number",
            description: "Max rows to include (default 1000)",
          },
        },
        required: ["query_id"],
      },
    },
    {
      name: "list_dashboards",
      description:
        "List Redash dashboards. Use to reference existing metric definitions.",
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string", description: "Title/description search" },
          page: { type: "number", description: "Page number (default 1)" },
          page_size: { type: "number", description: "Page size (default 25)" },
        },
      },
    },
    {
      name: "get_dashboard",
      description:
        "Fetch a dashboard's widgets and the query IDs they reference. Use the returned query IDs with execute_saved_query to rerun them.",
      inputSchema: {
        type: "object",
        properties: {
          id: {
            type: ["string", "number"],
            description: "Dashboard ID or slug",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "export_metadata_cache",
      description:
        "Export the metadata cache to a JSON file. Use to share with teammates or back up.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Output file path (e.g. ./metadata-cache-backup.json)",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "import_metadata_cache",
      description:
        "Import the metadata cache from a JSON file. mode=merge (default) merges into existing entries; mode=replace replaces everything.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Input JSON file path" },
          mode: {
            type: "string",
            enum: ["merge", "replace"],
            description: "merge (default): merge / replace: replace all",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "get_cache",
      description:
        "Inspect the stored metadata cache. Reveals column types/values, mapping tables, and recommended tables.",
      inputSchema: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description:
              "Search keyword (e.g. 'membership', 'order_total.lastest_state'). If omitted, returns full summary.",
          },
        },
      },
    },
  ];
}

export async function handleToolCall(
  name: string,
  rawArgs: Record<string, unknown>,
  registry: ClientRegistry,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  const { instance, ...args } = rawArgs as Record<string, unknown> & {
    instance?: string;
  };
  const ctx = registry.resolve(
    typeof instance === "string" ? instance : undefined
  );
  const client = ctx.client;
  const schemaCache = ctx.schemaCache;

  switch (name) {
    case "list_data_sources":
      return handleListDataSources(client);
    case "get_schema":
      return handleGetSchema(args as GetSchemaArgs, client, schemaCache, metadataCache);
    case "execute_query":
      return handleExecuteQuery(args as ExecuteQueryArgs, client, schemaCache);
    case "explore_column":
      return handleExploreColumn(args as ExploreColumnArgs, client, metadataCache);
    case "find_mapping":
      return handleFindMapping(args as FindMappingArgs, client, schemaCache, metadataCache);
    case "save_query":
      return handleSaveQuery(args as SaveQueryArgs, client);
    case "get_cache":
      return handleGetCache(args as GetCacheArgs, metadataCache);
    case "list_saved_queries":
      return handleListSavedQueries(args as ListSavedQueriesArgs, client);
    case "get_saved_query":
      return handleGetSavedQuery(args as GetSavedQueryArgs, client);
    case "execute_saved_query":
      return handleExecuteSavedQuery(args as ExecuteSavedQueryArgs, client);
    case "sample_rows":
      return handleSampleRows(args as SampleRowsArgs, client);
    case "self_test":
      return handleSelfTest(client);
    case "describe_table":
      return handleDescribeTable(args as DescribeTableArgs, client, schemaCache);
    case "find_table":
      return handleFindTable(args as FindTableArgs, client, schemaCache);
    case "join_hints":
      return handleJoinHints(args as JoinHintsArgs, client, schemaCache);
    case "update_query":
      return handleUpdateQuery(args as UpdateQueryArgs, client);
    case "list_dashboards":
      return handleListDashboards(args as ListDashboardsArgs, client);
    case "get_dashboard":
      return handleGetDashboard(args as GetDashboardArgs, client);
    case "explain_query":
      return handleExplainQuery(args as ExplainQueryArgs, client);
    case "export_metadata_cache":
      return handleExportMetadataCache(args as ExportMetadataCacheArgs, metadataCache);
    case "import_metadata_cache":
      return handleImportMetadataCache(args as ImportMetadataCacheArgs, metadataCache);
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}
