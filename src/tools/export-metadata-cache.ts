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
        text: `Cache export complete: ${filePath}\n${counts.columns} columns, ${counts.mappings} mappings, ${counts.tables} table recommendations`,
      },
    ],
  };
}
