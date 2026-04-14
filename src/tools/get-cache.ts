import { MetadataCache, isStale } from "@/metadata-cache.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { GetCacheArgs } from "@/interfaces/tool-args.js";

export async function handleGetCache(
  args: GetCacheArgs,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  const { keyword } = args;

  if (!keyword) {
    return {
      content: [{ type: "text", text: metadataCache.getSummary() }],
    };
  }

  const output: string[] = [];

  // 컬럼 캐시 검색
  const columns = metadataCache.searchColumns(keyword);
  if (Object.keys(columns).length > 0) {
    output.push("## Columns");
    for (const [key, info] of Object.entries(columns)) {
      const typeHint =
        info.type === "integer"
          ? "integer (compare as numeric literal)"
          : "varchar (compare as string)";
      const staleTag = isStale(info.updatedAt) ? " [stale]" : "";
      output.push(`\n[${key}] (${typeHint}) — ${info.updatedAt}${staleTag}`);
      for (const v of info.values) {
        output.push(`  ${v.val} : ${v.cnt.toLocaleString()} rows`);
      }
    }
  }

  // 매핑 캐시 검색
  const mappings = metadataCache.searchMappings(keyword);
  if (Object.keys(mappings).length > 0) {
    output.push("\n## Mappings");
    for (const [key, info] of Object.entries(mappings)) {
      const header = Object.keys(info.entries[0] ?? {}).join(" | ");
      const rows = info.entries.map((r) => Object.values(r).join(" | "));
      const staleTag = isStale(info.updatedAt) ? " [stale]" : "";
      output.push(`\n[${key}] → ${info.mappingTable} — ${info.updatedAt}${staleTag}`);
      output.push(header);
      output.push("─".repeat(header.length));
      output.push(rows.join("\n"));
    }
  }

  // 테이블 추천 검색
  const recs = metadataCache.searchTableRecommendations(keyword);
  if (Object.keys(recs).length > 0) {
    output.push("\n## Table recommendations");
    for (const [key, rec] of Object.entries(recs)) {
      const staleTag = isStale(rec.updatedAt) ? " [stale]" : "";
      output.push(
        `\n"${key}" → ${rec.recommended} (${rec.reason}) — ${rec.updatedAt}${staleTag}`
      );
      if (rec.avoid) {
        for (const [t, reason] of Object.entries(rec.avoid)) {
          output.push(`  ⚠ avoid: ${t} — ${reason}`);
        }
      }
    }
  }

  if (output.filter((l) => l.trim()).length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No cache entries match "${keyword}".\n${metadataCache.getSummary()}`,
        },
      ],
    };
  }

  return { content: [{ type: "text", text: output.join("\n") }] };
}
