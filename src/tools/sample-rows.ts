import { RedashClient } from "@/redash-client.js";
import { getMaskedColumns, maskRow } from "@/masking.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { SampleRowsArgs } from "@/interfaces/tool-args.js";

export async function handleSampleRows(
  args: SampleRowsArgs,
  client: RedashClient
): Promise<ToolResult> {
  const {
    data_source_id: dataSourceId,
    table,
    limit = 5,
    partition_filter: partitionFilter,
    columns,
  } = args;

  const colList = columns && columns.length > 0 ? columns.join(", ") : "*";
  const where = partitionFilter ? `WHERE ${partitionFilter}\n` : "";
  const sql = `SELECT ${colList}\nFROM ${table}\n${where}LIMIT ${limit}`;

  const result = await client.executeAdhocQuery(sql, dataSourceId);
  const data = result.query_result.data;

  const columnNames = data.columns.map((c) => c.name);
  const maskedCols = getMaskedColumns(columnNames);
  if (maskedCols.length > 0) {
    data.rows = data.rows.map((r) => maskRow(r, columnNames));
  }

  const resultJson = JSON.stringify(
    {
      table,
      columns: data.columns.map((c) => ({ name: c.name, type: c.type })),
      rows: data.rows,
      row_count: data.rows.length,
    },
    null,
    2
  );

  return {
    content: [
      { type: "text", text: resultJson },
      {
        type: "text",
        text: `Executed SQL:\n\`\`\`sql\n${sql}\n\`\`\``,
      },
    ],
  };
}
