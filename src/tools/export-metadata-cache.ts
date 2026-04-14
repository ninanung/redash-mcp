import { MetadataCache } from "@/metadata-cache.js";
import type { ToolResult } from "@/interfaces/tools.js";
import type { ExportMetadataCacheArgs } from "@/interfaces/tool-args.js";

export async function handleExportMetadataCache(
  args: ExportMetadataCacheArgs,
  metadataCache: MetadataCache
): Promise<ToolResult> {
  const { path: filePath } = args;
  const counts = metadataCache.exportTo(filePath);
  return {
    content: [
      {
        type: "text",
        text: `캐시 내보내기 완료: ${filePath}\n컬럼 ${counts.columns}건, 매핑 ${counts.mappings}건, 테이블추천 ${counts.tables}건`,
      },
    ],
  };
}
