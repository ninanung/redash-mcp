import type { RedashSchemaTable } from "@/interfaces/redash-client.js";

export interface CacheEntry {
  tables: RedashSchemaTable[];
  /** Epoch ms when this entry was fetched from Redash. */
  fetchedAt: number;
}
