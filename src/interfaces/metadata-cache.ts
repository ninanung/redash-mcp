export interface ColumnInfo {
  type: "integer" | "varchar";
  values: { val: string; cnt: number }[];
  updatedAt: string;
}

export interface MappingInfo {
  mappingTable: string;
  entries: Record<string, string>[];
  updatedAt: string;
}

export interface TableRecommendation {
  recommended: string;
  reason: string;
  avoid?: Record<string, string>;
  updatedAt: string;
}

export interface CacheData {
  columns: Record<string, ColumnInfo>;
  mappings: Record<string, MappingInfo>;
  tables: Record<string, TableRecommendation>;
}
