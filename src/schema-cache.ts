import { RedashClient } from "@/redash-client.js";
import type { RedashSchemaTable } from "@/interfaces/redash-client.js";
import type { CacheEntry } from "@/interfaces/schema-cache.js";

export class SchemaCache {
  private cache = new Map<number, CacheEntry>();

  async getSchema(
    client: RedashClient,
    dataSourceId: number,
    forceRefresh = false
  ): Promise<RedashSchemaTable[]> {
    const cached = this.cache.get(dataSourceId);

    if (!forceRefresh && cached) {
      return cached.tables;
    }

    const tables = await client.getSchema(dataSourceId);
    this.cache.set(dataSourceId, { tables });
    return tables;
  }

  invalidate(dataSourceId: number): void {
    this.cache.delete(dataSourceId);
  }

  filterTables(
    tables: RedashSchemaTable[],
    keywords: string[]
  ): RedashSchemaTable[] {
    const lower = keywords.map((k) => k.toLowerCase());
    return tables.filter((t) => {
      const name = t.name.toLowerCase();
      return lower.some((kw) => name.includes(kw));
    });
  }

  getTableNames(tables: RedashSchemaTable[]): string[] {
    return tables.map((t) => t.name);
  }

  isCached(dataSourceId: number): boolean {
    return this.cache.has(dataSourceId);
  }
}
