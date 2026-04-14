import { RedashClient } from "@/redash-client.js";
import { SchemaCache } from "@/schema-cache.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { FindTableArgs } from "@/interfaces/tool-args.js";

export async function handleFindTable(
  args: FindTableArgs,
  client: RedashClient,
  schemaCache: SchemaCache
): Promise<ToolResult> {
  const {
    data_source_id: dataSourceId,
    column,
    table_keyword: tableKeyword,
  } = args;

  if (!column && !tableKeyword) {
    return {
      content: [
        {
          type: "text",
          text: "Specify at least one of column or table_keyword.",
        },
      ],
      isError: true,
    };
  }

  const tables = await schemaCache.getSchema(client, dataSourceId);
  const colLower = column?.toLowerCase();
  const tblLower = tableKeyword?.toLowerCase();

  const matches = tables
    .filter((t) => {
      const tblMatch = tblLower ? t.name.toLowerCase().includes(tblLower) : true;
      const colMatch = colLower
        ? t.columns.some((c) => c.toLowerCase().includes(colLower))
        : true;
      return tblMatch && colMatch;
    })
    .map((t) => ({
      table: t.name,
      matched_columns: colLower
        ? t.columns.filter((c) => c.toLowerCase().includes(colLower))
        : undefined,
      column_count: t.columns.length,
    }));

  const body = {
    data_source_id: dataSourceId,
    filters: { column, table_keyword: tableKeyword },
    matches,
    match_count: matches.length,
  };

  return {
    content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
  };
}
