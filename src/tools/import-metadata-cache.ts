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
        text: `Cache import complete (${effectiveMode}): ${filePath}\nAdded — ${counts.columns} columns, ${counts.mappings} mappings, ${counts.tables} table recommendations`,
      },
    ],
  };
}
