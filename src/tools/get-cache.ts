import { MetadataCache } from "@/metadata-cache.js";
import type { ToolResult } from "@/interfaces/tools.js";

export async function handleGetCache(
  args: Record<string, unknown>,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  const keyword = args.keyword as string | undefined;

  if (!keyword) {
    return {
      content: [{ type: "text", text: metadataCache.getSummary() }],
    };
  }

  const output: string[] = [];

  // 컬럼 캐시 검색
  const columns = metadataCache.searchColumns(keyword);
  if (Object.keys(columns).length > 0) {
    output.push("## 컬럼 정보");
    for (const [key, info] of Object.entries(columns)) {
      const typeHint =
        info.type === "integer"
          ? "integer (숫자 리터럴로 비교)"
          : "varchar (문자열로 비교)";
      output.push(`\n[${key}] (${typeHint}) — ${info.updatedAt}`);
      for (const v of info.values) {
        output.push(`  ${v.val} : ${v.cnt.toLocaleString()}건`);
      }
    }
  }

  // 매핑 캐시 검색
  const mappings = metadataCache.searchMappings(keyword);
  if (Object.keys(mappings).length > 0) {
    output.push("\n## 매핑 정보");
    for (const [key, info] of Object.entries(mappings)) {
      const header = Object.keys(info.entries[0] ?? {}).join(" | ");
      const rows = info.entries.map((r) => Object.values(r).join(" | "));
      output.push(`\n[${key}] → ${info.mappingTable} — ${info.updatedAt}`);
      output.push(header);
      output.push("─".repeat(header.length));
      output.push(rows.join("\n"));
    }
  }

  // 테이블 추천 검색
  const recs = metadataCache.searchTableRecommendations(keyword);
  if (Object.keys(recs).length > 0) {
    output.push("\n## 테이블 추천");
    for (const [key, rec] of Object.entries(recs)) {
      output.push(
        `\n"${key}" → ${rec.recommended} (${rec.reason}) — ${rec.updatedAt}`
      );
      if (rec.avoid) {
        for (const [t, reason] of Object.entries(rec.avoid)) {
          output.push(`  ⚠ 비추천: ${t} — ${reason}`);
        }
      }
    }
  }

  if (output.filter((l) => l.trim()).length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `"${keyword}"와 일치하는 캐시가 없습니다.\n${metadataCache.getSummary()}`,
        },
      ],
    };
  }

  return { content: [{ type: "text", text: output.join("\n") }] };
}
