import { MetadataCache } from "@/metadata-cache.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { ImportMetadataCacheArgs } from "@/interfaces/tool-args.js";

export async function handleImportMetadataCache(
  args: ImportMetadataCacheArgs,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  const { path: filePath, mode } = args;
  const effectiveMode = mode ?? "merge";
  const counts = metadataCache.importFrom(filePath, effectiveMode);
  return {
    content: [
      {
        type: "text",
        text: `캐시 가져오기 완료 (${effectiveMode}): ${filePath}\n추가된 항목 — 컬럼 ${counts.columns}건, 매핑 ${counts.mappings}건, 테이블추천 ${counts.tables}건`,
      },
    ],
  };
}
