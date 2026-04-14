import { RedashClient } from "@/redash-client.js";
import { SchemaCache } from "@/schema-cache.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { DescribeTableArgs } from "@/interfaces/tool-args.js";

export async function handleDescribeTable(
  args: DescribeTableArgs,
  client: RedashClient,
  schemaCache: SchemaCache
): Promise<ToolResult> {
  const {
    data_source_id: dataSourceId,
    table,
    sample_limit: sampleLimit = 5,
    partition_filter: partitionFilter,
  } = args;

  const tables = await schemaCache.getSchema(client, dataSourceId);
  const target = tables.find((t) => t.name === table);

  if (!target) {
    return {
      content: [
        {
          type: "text",
          text: `테이블을 찾을 수 없습니다: ${table}. get_schema로 이름을 확인해주세요.`,
        },
      ],
      isError: true,
    };
  }

  const where = partitionFilter ? `\nWHERE ${partitionFilter}` : "";
  const sql = `SELECT *\nFROM ${table}${where}\nLIMIT ${sampleLimit}`;
  let sampleRows: Record<string, unknown>[] = [];
  let sampleError: string | null = null;

  try {
    const result = await client.executeAdhocQuery(sql, dataSourceId);
    sampleRows = result.query_result.data.rows;
  } catch (err) {
    sampleError = client.formatError(err);
  }

  const body = {
    table,
    columns: target.columns,
    column_count: target.columns.length,
    sample_rows: sampleRows,
    sample_error: sampleError,
  };

  return {
    content: [
      { type: "text", text: JSON.stringify(body, null, 2) },
      {
        type: "text",
        text: `샘플 쿼리:\n\`\`\`sql\n${sql}\n\`\`\``,
      },
    ],
  };
}
