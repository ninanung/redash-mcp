import { RedashClient } from "@/redash-client.js";
import { MetadataCache, isStale } from "@/metadata-cache.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { ExploreColumnArgs } from "@/interfaces/tool-args.js";

export async function handleExploreColumn(
  args: ExploreColumnArgs,
  client: RedashClient,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  const { data_source_id: dataSourceId, columns, refresh } = args;
  const limit = args.limit ?? 20;

  // 캐시 확인: refresh가 아니면 캐시된 컬럼은 스킵
  const cached: string[] = [];
  const toQuery: typeof columns = [];

  for (const c of columns) {
    const key = `${c.table}.${c.column}`;
    const hit = !refresh ? metadataCache.getColumn(dataSourceId, key) : null;
    if (hit && !isStale(hit.updatedAt)) {
      cached.push(key);
    } else {
      toQuery.push(c);
    }
  }

  // 캐시된 결과 먼저 출력 준비
  const output: string[] = [];

  for (const key of cached) {
    const info = metadataCache.getColumn(dataSourceId, key)!;
    const typeHint =
      info.type === "integer"
        ? "integer (숫자 리터럴로 비교)"
        : "varchar (문자열로 비교)";
    output.push(`\n[${key}] [캐시됨] (추정 타입: ${typeHint})`);
    for (const v of info.values) {
      output.push(`  ${v.val} : ${v.cnt.toLocaleString()}건`);
    }
  }

  // 캐시 미스된 컬럼만 실제 조회
  if (toQuery.length > 0) {
    const parts = toQuery.map((c) => {
      const where = c.partition_filter ? `WHERE ${c.partition_filter}` : "";
      return `SELECT '${c.table}.${c.column}' AS col, CAST(${c.column} AS varchar) AS val, COUNT(*) AS cnt FROM ${c.table} ${where} GROUP BY CAST(${c.column} AS varchar) ORDER BY cnt DESC LIMIT ${limit}`;
    });

    const sql = parts.join("\nUNION ALL\n");
    const result = await client.executeAdhocQuery(sql, dataSourceId);
    const rows = result.query_result.data.rows;

    // 컬럼별 그룹핑
    const grouped = new Map<string, { val: string; cnt: number }[]>();
    for (const row of rows) {
      const col = row.col as string;
      if (!grouped.has(col)) grouped.set(col, []);
      grouped.get(col)!.push({
        val: row.val as string,
        cnt: row.cnt as number,
      });
    }

    // 타입 추정, 출력, 캐시 저장
    for (const [col, values] of grouped) {
      const allNumeric = values.every((v) => /^\d+$/.test(v.val));
      const colType = allNumeric ? "integer" : "varchar";
      const typeHint = allNumeric
        ? "integer (숫자 리터럴로 비교)"
        : "varchar (문자열로 비교)";

      output.push(`\n[${col}] [새로 조회] (추정 타입: ${typeHint})`);
      for (const v of values) {
        output.push(`  ${v.val} : ${v.cnt.toLocaleString()}건`);
      }

      // 캐시 저장
      metadataCache.setColumn(dataSourceId, col, {
        type: colType,
        values,
        updatedAt: new Date().toISOString().slice(0, 10),
      });
    }
  }

  return { content: [{ type: "text", text: output.join("\n") }] };
}
