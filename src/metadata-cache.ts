import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * 컬럼 탐색 결과 캐시
 */
export interface ColumnInfo {
  type: "integer" | "varchar";
  values: { val: string; cnt: number }[];
  updatedAt: string;
}

/**
 * 매핑 테이블 캐시
 */
export interface MappingInfo {
  mappingTable: string;
  entries: Record<string, string>[]; // [{ id: "1", state: "주문완료" }, ...]
  updatedAt: string;
}

/**
 * 테이블 추천 캐시
 */
export interface TableRecommendation {
  recommended: string;
  reason: string;
  avoid?: Record<string, string>; // { "table_name": "사유" }
  updatedAt: string;
}

interface CacheData {
  columns: Record<string, ColumnInfo>; // key: "schema.table.column"
  mappings: Record<string, MappingInfo>; // key: "schema.table.column"
  tables: Record<string, TableRecommendation>; // key: keyword (e.g. "membership")
}

const CACHE_DIR = path.join(os.homedir(), ".redash-mcp");
const CACHE_FILE = path.join(CACHE_DIR, "metadata-cache.json");

export class MetadataCache {
  private data: CacheData;

  constructor() {
    this.data = this.load();
  }

  // --- Column cache ---

  getColumn(key: string): ColumnInfo | null {
    return this.data.columns[key] ?? null;
  }

  setColumn(key: string, info: ColumnInfo): void {
    this.data.columns[key] = info;
    this.save();
  }

  deleteColumn(key: string): void {
    delete this.data.columns[key];
    this.save();
  }

  // --- Mapping cache ---

  getMapping(key: string): MappingInfo | null {
    return this.data.mappings[key] ?? null;
  }

  setMapping(key: string, info: MappingInfo): void {
    this.data.mappings[key] = info;
    this.save();
  }

  deleteMapping(key: string): void {
    delete this.data.mappings[key];
    this.save();
  }

  // --- Table recommendation cache ---

  getTableRecommendation(keyword: string): TableRecommendation | null {
    return this.data.tables[keyword.toLowerCase()] ?? null;
  }

  setTableRecommendation(
    keyword: string,
    rec: TableRecommendation
  ): void {
    this.data.tables[keyword.toLowerCase()] = rec;
    this.save();
  }

  deleteTableRecommendation(keyword: string): void {
    delete this.data.tables[keyword.toLowerCase()];
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
