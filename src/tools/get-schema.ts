import { RedashClient } from "@/redash-client.js";
import { SchemaCache } from "@/schema-cache.js";
import { MetadataCache } from "@/metadata-cache.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { GetSchemaArgs } from "@/interfaces/tool-args.js";

export async function handleGetSchema(
  args: GetSchemaArgs,
  client: RedashClient,
  schemaCache: SchemaCache,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  const { data_source_id: dataSourceId, keywords, refresh } = args;

  // 키워드가 있으면 테이블 추천 캐시 확인
  const recommendations: string[] = [];
  if (keywords && keywords.length > 0 && !refresh) {
    for (const kw of keywords) {
      const rec = metadataCache.getTableRecommendation(dataSourceId, kw);
      if (rec) {
        const avoidInfo = rec.avoid
          ? Object.entries(rec.avoid)
              .map(([t, reason]) => `  ⚠ ${t}: ${reason}`)
              .join("\n")
          : "";
        recommendations.push(
          `[캐시 추천] "${kw}" → ${rec.recommended} (${rec.reason})${avoidInfo ? "\n" + avoidInfo : ""}`
        );
      }
    }
  }

  const tables = await schemaCache.getSchema(client, dataSourceId, refresh);

  let filtered = tables;
  if (keywords && keywords.length > 0) {
    filtered = schemaCache.filterTables(tables, keywords);
  }

  if (filtered.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `매칭되는 테이블이 없습니다. 전체 ${tables.length}개 테이블 중 키워드와 일치하는 항목 없음.`,
        },
      ],
    };
  }

  const recPrefix =
    recommendations.length > 0
      ? recommendations.join("\n") + "\n\n"
      : "";

  // 테이블이 100개 초과면 이름만 반환
  if (filtered.length > 100) {
    const names = schemaCache.getTableNames(filtered);
    return {
      content: [
        {
          type: "text",
          text: `${recPrefix}${filtered.length}개 테이블 (이름만 표시):\n${names.join("\n")}`,
        },
      ],
    };
  }

  const output = filtered
    .map((t) => `${t.name}: ${t.columns.join(", ")}`)
    .join("\n");

  const cached = schemaCache.isCached(dataSourceId);
  const prefix = cached && !refresh ? "[캐시됨] " : "[새로 조회] ";

  return {
    content: [
      {
        type: "text",
        text: `${recPrefix}${prefix}${filtered.length}개 테이블:\n${output}`,
      },
    ],
  };
}
