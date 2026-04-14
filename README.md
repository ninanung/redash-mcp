# redash-mcp

[![npm version](https://img.shields.io/npm/v/@seungje.jun/redash-mcp.svg)](https://www.npmjs.com/package/@seungje.jun/redash-mcp)
[![license](https://img.shields.io/npm/l/@seungje.jun/redash-mcp.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@seungje.jun/redash-mcp.svg)](https://nodejs.org)

Expose the Redash API as an MCP (Model Context Protocol) server. Schema, column values, and code-to-label mappings are cached — in memory for schema and persistently on disk for metadata — so repeated lookups skip redundant Redash calls and the model can compose queries without re-exploring the database every time.

[한국어 문서 / Korean README](./README_kr.md)

## Installation & Setup

### npx (no installation required)

Add the following to `~/.mcp.json`.

```json
{
  "mcpServers": {
    "redash": {
      "command": "npx",
      "args": ["@seungje.jun/redash-mcp"],
      "env": {
        "REDASH_URL": "https://redash.example.com",
        "REDASH_API_KEY": "your-key"
      }
    }
  }
}
```

### Build from source

```bash
git clone https://github.com/ninanung/redash-mcp.git
cd redash-mcp
npm install
npm run build
```

Add the following to `~/.mcp.json`.

```json
{
  "mcpServers": {
    "redash": {
      "command": "node",
      "args": ["/path/to/redash-mcp/dist/cli.js"],
      "env": {
        "REDASH_URL": "https://redash.example.com",
        "REDASH_API_KEY": "your-key"
      }
    }
  }
}
```

Restart Claude Code to activate the MCP tools.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `REDASH_URL` | Redash server URL |
| `REDASH_API_KEY` | Redash API Key |
| `REDASH_ALLOWED_DS` | (optional) Comma-separated list of allowed data source IDs (e.g. `1,3,7`). When set, all other IDs are blocked and `list_data_sources` only returns allowed ones. |
| `REDASH_MCP_LOG` | (optional) Log level: `debug`, `info` (default), `warn`, `error`, `silent`. Logs go to stderr to avoid corrupting the MCP stdio channel. |
| `REDASH_MCP_AUDIT_LOG` | (optional) Audit log file path. Defaults to `~/.redash-mcp/audit.log`. Set to `off` to disable. Each line is a JSON record with tool name, args, duration, status. |
| `REDASH_QUERY_TIMEOUT_MS` | (optional) Default query timeout in ms (default 120000). Override per-call via `execute_query`'s `timeout_ms` argument. |

## Tools

| Tool | Description |
|------|-------------|
| `list_data_sources` | List available data sources |
| `self_test` | Diagnostic check — verifies env vars, Redash connectivity, and schema access |
| `get_schema` | Fetch table/column schema (keyword filter, cached) |
| `execute_query` | Run SQL (only `SELECT`/`WITH` allowed; job polling handled automatically; auto-injects `LIMIT max_rows` — default 1000 — when the query has none) |
| `explain_query` | Run `EXPLAIN` for a query without executing it — inspect cost / scan plan before a heavy run (engine-specific support) |
| `explore_column` | Inspect unique values/counts and infer column types (supports multiple columns at once) |
| `sample_rows` | Return a few raw rows from a table (default 5) to inspect real column values at a glance |
| `describe_table` | Combined schema + sample rows for a single table |
| `find_table` | Find tables by column name and/or table-name keyword (useful when locating join targets) |
| `join_hints` | List other tables that share column names with the given table — candidate join keys |
| `find_mapping` | Automatically find mapping tables for numeric code columns |
| `save_query` | Save a SQL query to Redash (supports `description` and `tags`) |
| `update_query` | Update `name`/`query`/`description`/`tags` of an existing saved query |
| `list_saved_queries` | List queries already saved in Redash (supports search + data source filter) |
| `get_saved_query` | Fetch SQL and metadata of a saved query by ID |
| `execute_saved_query` | Run a saved query by ID with optional parameters |
| `list_dashboards` | List Redash dashboards (search supported) |
| `get_dashboard` | Fetch widgets of a dashboard and the query IDs they reference |
| `get_cache` | Read the metadata cache (column types/values, mapping tables, recommended tables) |

## Usage Example

A typical natural-language flow, as orchestrated by the MCP client:

1. User: "Find me the orders table and show yesterday's revenue."
2. `list_data_sources` → pick the target `data_source_id`.
3. `get_schema` with keyword `order` → locate candidate tables/columns.
4. `explore_column` on status/type columns → understand enum values and infer types.
5. `find_mapping` on code columns (e.g. `status_cd`) → resolve numeric codes to labels.
6. `execute_query` → run the final `SELECT` and return rows.
7. (Optional) `save_query` → persist the SQL back to Redash.

Subsequent runs reuse the metadata cache, so step 4–5 often short-circuits via `get_cache`.

## Safety & Constraints

- **Read-only SQL**: only statements starting with `SELECT` or `WITH` are allowed. DML/DDL keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `MERGE`, `GRANT`, `REVOKE`, `CALL`, `EXEC`, ...) are rejected even if buried inside a CTE. Multiple statements separated by semicolons are also blocked. Comments and string literals are stripped before the scan to prevent keyword-smuggling.
- **Row-limit guardrail**: `execute_query` auto-injects `LIMIT max_rows` (default 1000) when the query has no LIMIT, preventing accidental full-table scans from blowing up the model context. Override with the `max_rows` argument or include an explicit `LIMIT` in the SQL.
- **CSV export**: pass `save_csv: "/path/to/out.csv"` to `execute_query` to write the full result to disk instead of (or in addition to) returning it through the model context.
- **Automatic schema recovery**: if a query fails with a "table/column not found" style error, the schema cache for that data source is invalidated, refreshed, and the updated table list is returned so the model can retry.
- **Job polling**: Redash async jobs are polled until completion; only the final result is returned to the client.
- **No write API**: the server does not expose any endpoint that mutates Redash state other than `save_query` (creating a new saved query).

## Data Source Selection

- `data_source_id` is a **required argument** on every query-related tool (`execute_query`, `get_schema`, `explore_column`, `find_mapping`, `save_query`).
- Call `list_data_sources` first to discover available IDs; the MCP client is expected to pass the chosen ID explicitly.
- There is no implicit "default data source" — this is intentional, to avoid accidentally querying the wrong database when multiple sources are configured.
- Set `REDASH_ALLOWED_DS=1,3,7` to restrict the server to specific data source IDs. Any other ID is rejected before hitting Redash, and `list_data_sources` / `list_saved_queries` return only the allowed subset.

## Cache

- **Schema cache**: in-memory, kept alive while the server runs. Refreshed automatically when a query execution hits a table/column error. Manual refresh is available via `refresh: true` on `get_schema`.
- **Metadata cache**: persisted to `~/.redash-mcp/metadata-cache.json`. Results from `explore_column` and `find_mapping` are stored automatically and reused on subsequent lookups.

### Cache Location & Reset

| Cache | Location | Reset |
|-------|----------|-------|
| Schema | in-memory (per server process) | restart the MCP server, or call `get_schema` with `refresh: true` |
| Metadata | `~/.redash-mcp/metadata-cache.json` | delete the file (`rm ~/.redash-mcp/metadata-cache.json`) — it will be recreated on the next write |

The metadata cache file is a plain JSON document — safe to inspect, edit, or back up manually.

## License

[MIT](./LICENSE)
