import { RedashClient } from "@/redash-client.js";
import { SchemaCache } from "@/schema-cache.js";
import { MetadataCache, isStale } from "@/metadata-cache.js";
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
      if (rec && !isStale(rec.updatedAt)) {
        const avoidInfo = rec.avoid
          ? Object.entries(rec.avoid)
              .map(([t, reason]) => `  ⚠ ${t}: ${reason}`)
              .join("\n")
          : "";
        recommendations.push(
          `[cached recommendation] "${kw}" → ${rec.recommended} (${rec.reason})${avoidInfo ? "\n" + avoidInfo : ""}`
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
          text: `No matching tables. Out of ${tables.length} tables, none match the keywords.`,
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
          text: `${recPrefix}${filtered.length} tables (names only):\n${names.join("\n")}`,
        },
      ],
    };
  }

  const output = filtered
    .map((t) => `${t.name}: ${t.columns.join(", ")}`)
    .join("\n");

  const cached = schemaCache.isCached(dataSourceId);
  const prefix = cached && !refresh ? "[cached] " : "[fresh] ";

  return {
    content: [
      {
        type: "text",
        text: `${recPrefix}${prefix}${filtered.length} tables:\n${output}`,
      },
    ],
  };
}
