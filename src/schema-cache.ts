import { RedashClient } from "@/redash-client.js";
import type { RedashSchemaTable } from "@/interfaces/redash-client.js";
import type { CacheEntry } from "@/interfaces/schema-cache.js";

const DEFAULT_TTL = 30 * 60 * 1000; // 30분

export class SchemaCache {
  private cache = new Map<number, CacheEntry>();
  private ttl: number;

  constructor(ttlMs = DEFAULT_TTL) {
    this.ttl = ttlMs;
  }

  async getSchema(
    client: RedashClient,
    dataSourceId: number,
    forceRefresh = false
  ): Promise<RedashSchemaTable[]> {
    const cached = this.cache.get(dataSourceId);

    if (!forceRefresh && cached && Date.now() - cached.fetchedAt < this.ttl) {
      return cached.tables;
    }

    const tables = await client.getSchema(dataSourceId);
    this.cache.set(dataSourceId, { tables, fetchedAt: Date.now() });
    return tables;
  }

  /**
   * 테이블명으로 필터링하여 반환
   */
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

  /**
   * 테이블명 목록만 반환 (선별용)
   */
  getTableNames(tables: RedashSchemaTable[]): string[] {
    return tables.map((t) => t.name);
  }

  isCached(dataSourceId: number): boolean {
    const cached = this.cache.get(dataSourceId);
    return !!cached && Date.now() - cached.fetchedAt < this.ttl;
  }
}
