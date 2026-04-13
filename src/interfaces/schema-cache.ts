import type { RedashSchemaTable } from "@/interfaces/redash-client.js";

export interface CacheEntry {
  tables: RedashSchemaTable[];
  fetchedAt: number;
}
