import { RedashClient } from "@/redash-client.js";
import { SchemaCache } from "@/schema-cache.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { JoinHintsArgs } from "@/interfaces/tool-args.js";

export async function handleJoinHints(
  args: JoinHintsArgs,
  client: RedashClient,
  schemaCache: SchemaCache
): Promise<ToolResult> {
  const { data_source_id: dataSourceId, table } = args;

  const tables = await schemaCache.getSchema(client, dataSourceId);
  const target = tables.find((t) => t.name === table);

  if (!target) {
    return {
      content: [
        { type: "text", text: `테이블을 찾을 수 없습니다: ${table}` },
      ],
      isError: true,
    };
  }

  const targetColsLower = target.columns.map((c) => c.toLowerCase());
  const hints = tables
    .filter((t) => t.name !== table)
    .map((t) => {
      const shared = t.columns.filter((c) =>
        targetColsLower.includes(c.toLowerCase())
      );
      return { table: t.name, shared_columns: shared };
    })
    .filter((h) => h.shared_columns.length > 0)
    .sort((a, b) => b.shared_columns.length - a.shared_columns.length);

  const body = {
    table,
    target_columns: target.columns,
    join_candidates: hints,
    candidate_count: hints.length,
    note:
      "shared_columns는 단순 컬럼명 일치 기반이며, 실제 외래키 관계를 보장하지 않습니다. 타입·값을 explore_column으로 검증하세요.",
  };

  return {
    content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
  };
}
