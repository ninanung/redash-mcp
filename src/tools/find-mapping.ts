import { RedashClient } from "@/redash-client.js";
import { SchemaCache } from "@/schema-cache.js";
import { MetadataCache, isStale } from "@/metadata-cache.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { FindMappingArgs } from "@/interfaces/tool-args.js";

export async function handleFindMapping(
  args: FindMappingArgs,
  client: RedashClient,
  schemaCache: SchemaCache,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  const { data_source_id: dataSourceId, table, column, refresh } = args;

  const cacheKey = `${table}.${column}`;

  // 캐시 확인
  if (!refresh) {
    const hit = metadataCache.getMapping(dataSourceId, cacheKey);
    if (hit && !isStale(hit.updatedAt)) {
      const header = Object.keys(hit.entries[0] ?? {}).join(" | ");
      const rows = hit.entries.map((r) => Object.values(r).join(" | "));
      return {
        content: [
          {
            type: "text",
            text: `[캐시됨] 매핑 테이블: ${hit.mappingTable}\n\n${header}\n${"─".repeat(header.length)}\n${rows.join("\n")}`,
          },
        ],
      };
    }
  }

  const tables = await schemaCache.getSchema(client, dataSourceId);

  // 테이블명에서 schema 부분 제거
  const shortTable = table.includes(".")
    ? table.split(".").pop()!
    : table;

  // 1순위: _mapping 패턴
  const patterns = [
    `${shortTable}_${column}_mapping`,
    `${shortTable}_${column}`,
    `${column}_mapping`,
    `${column}_master`,
    `${column}_code`,
  ];

  const candidates: string[] = [];
  for (const pattern of patterns) {
    for (const t of tables) {
      if (t.name.toLowerCase().endsWith(pattern)) {
        candidates.push(t.name);
      }
    }
  }

  // 2순위: 컬럼 2~4개 + 관련 키워드
  if (candidates.length === 0) {
    for (const t of tables) {
      const name = t.name.toLowerCase();
      const cols = t.columns.length;
      if (
        cols >= 2 &&
        cols <= 4 &&
        (name.includes(column) || name.includes(shortTable)) &&
        (name.includes("mapping") ||
          name.includes("master") ||
          name.includes("code") ||
          name.includes("type") ||
          name.includes("enum"))
      ) {
        candidates.push(t.name);
      }
    }
  }

  // 3순위: 못 찾음
  if (candidates.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `매핑 테이블을 찾지 못했습니다.\n탐색 패턴: ${patterns.join(", ")}\n사용자에게 코드값의 의미를 직접 확인하세요.`,
        },
      ],
    };
  }

  // 첫 번째 후보 조회
  const mappingTable = candidates[0];
  const sql = `SELECT * FROM ${mappingTable} ORDER BY 1 LIMIT 50`;

  const result = await client.executeAdhocQuery(sql, dataSourceId);
  const data = result.query_result.data;

  const header = data.columns.map((c) => c.name).join(" | ");
  const rows = data.rows.map((r) =>
    data.columns.map((c) => String(r[c.name] ?? "")).join(" | ")
  );

  // 캐시 저장
  const entries = data.rows.map((r) => {
    const entry: Record<string, string> = {};
    for (const c of data.columns) {
      entry[c.name] = String(r[c.name] ?? "");
    }
    return entry;
  });

  metadataCache.setMapping(dataSourceId, cacheKey, {
    mappingTable,
    entries,
    updatedAt: new Date().toISOString().slice(0, 10),
  });

  return {
    content: [
      {
        type: "text",
        text: `[새로 조회] 매핑 테이블: ${mappingTable}\n${candidates.length > 1 ? `(다른 후보: ${candidates.slice(1).join(", ")})\n` : ""}\n${header}\n${"─".repeat(header.length)}\n${rows.join("\n")}`,
      },
    ],
  };
}
