import * as fs from "fs";
import * as path from "path";
import * as os from "os";
export type {
  ColumnInfo,
  MappingInfo,
  TableRecommendation,
} from "@/interfaces/metadata-cache.js";
import type {
  ColumnInfo,
  MappingInfo,
  TableRecommendation,
  CacheData,
} from "@/interfaces/metadata-cache.js";

const CACHE_DIR = path.join(os.homedir(), ".redash-mcp");
const CACHE_FILE = path.join(CACHE_DIR, "metadata-cache.json");

function dsKey(dataSourceId: number, key: string): string {
  return `ds${dataSourceId}:${key}`;
}

function ttlDays(): number | null {
  const raw = process.env.REDASH_METADATA_TTL_DAYS;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isStale(updatedAt: string): boolean {
  const days = ttlDays();
  if (days === null) return false;
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t > days * 24 * 60 * 60 * 1000;
}

export class MetadataCache {
  private data: CacheData;

  constructor() {
    this.data = this.load();
  }

  // --- Column cache ---

  getColumn(dataSourceId: number, key: string): ColumnInfo | null {
    return this.data.columns[dsKey(dataSourceId, key)] ?? null;
  }

  setColumn(dataSourceId: number, key: string, info: ColumnInfo): void {
    this.data.columns[dsKey(dataSourceId, key)] = info;
    this.save();
  }

  deleteColumn(dataSourceId: number, key: string): void {
    delete this.data.columns[dsKey(dataSourceId, key)];
    this.save();
  }

  // --- Mapping cache ---

  getMapping(dataSourceId: number, key: string): MappingInfo | null {
    return this.data.mappings[dsKey(dataSourceId, key)] ?? null;
  }

  setMapping(dataSourceId: number, key: string, info: MappingInfo): void {
    this.data.mappings[dsKey(dataSourceId, key)] = info;
    this.save();
  }

  deleteMapping(dataSourceId: number, key: string): void {
    delete this.data.mappings[dsKey(dataSourceId, key)];
    this.save();
  }

  // --- Table recommendation cache ---

  getTableRecommendation(
    dataSourceId: number,
    keyword: string
  ): TableRecommendation | null {
    return this.data.tables[dsKey(dataSourceId, keyword.toLowerCase())] ?? null;
  }

  setTableRecommendation(
    dataSourceId: number,
    keyword: string,
    rec: TableRecommendation
  ): void {
    this.data.tables[dsKey(dataSourceId, keyword.toLowerCase())] = rec;
    this.save();
  }

  deleteTableRecommendation(dataSourceId: number, keyword: string): void {
    delete this.data.tables[dsKey(dataSourceId, keyword.toLowerCase())];
    this.save();
  }

  // --- Search ---

  searchColumns(keyword: string): Record<string, ColumnInfo> {
    const lower = keyword.toLowerCase();
    const result: Record<string, ColumnInfo> = {};
    for (const [key, info] of Object.entries(this.data.columns)) {
      if (key.toLowerCase().includes(lower)) {
        result[key] = info;
      }
    }
    return result;
  }

  searchMappings(keyword: string): Record<string, MappingInfo> {
    const lower = keyword.toLowerCase();
    const result: Record<string, MappingInfo> = {};
    for (const [key, info] of Object.entries(this.data.mappings)) {
      if (key.toLowerCase().includes(lower)) {
        result[key] = info;
      }
    }
    return result;
  }

  searchTableRecommendations(
    keyword: string
  ): Record<string, TableRecommendation> {
    const lower = keyword.toLowerCase();
    const result: Record<string, TableRecommendation> = {};
    for (const [key, info] of Object.entries(this.data.tables)) {
      if (key.toLowerCase().includes(lower)) {
        result[key] = info;
      }
    }
    return result;
  }

  // --- Summary ---

  getSummary(): string {
    const colCount = Object.keys(this.data.columns).length;
    const mapCount = Object.keys(this.data.mappings).length;
    const tblCount = Object.keys(this.data.tables).length;
    return `캐시 현황: 컬럼 ${colCount}건, 매핑 ${mapCount}건, 테이블추천 ${tblCount}건`;
  }

  // --- Export / Import ---

  exportTo(filePath: string): { columns: number; mappings: number; tables: number } {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(this.data, null, 2), "utf-8");
    return {
      columns: Object.keys(this.data.columns).length,
      mappings: Object.keys(this.data.mappings).length,
      tables: Object.keys(this.data.tables).length,
    };
  }

  importFrom(
    filePath: string,
    mode: "merge" | "replace" = "merge"
  ): { columns: number; mappings: number; tables: number } {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<CacheData>;
    const incoming: CacheData = {
      columns: parsed.columns ?? {},
      mappings: parsed.mappings ?? {},
      tables: parsed.tables ?? {},
    };
    if (mode === "replace") {
      this.data = incoming;
    } else {
      this.data = {
        columns: { ...this.data.columns, ...incoming.columns },
        mappings: { ...this.data.mappings, ...incoming.mappings },
        tables: { ...this.data.tables, ...incoming.tables },
      };
    }
    this.save();
    return {
      columns: Object.keys(incoming.columns).length,
      mappings: Object.keys(incoming.mappings).length,
      tables: Object.keys(incoming.tables).length,
    };
  }

  // --- Persistence ---

  private load(): CacheData {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, "utf-8");
        return JSON.parse(raw);
      }
    } catch {
      // corrupted file, start fresh
    }
    return { columns: {}, mappings: {}, tables: {} };
  }

  private save(): void {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    // atomic write: write to temp file then rename
    const tmpFile = CACHE_FILE + ".tmp";
    fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), "utf-8");
    fs.renameSync(tmpFile, CACHE_FILE);
  }
}
