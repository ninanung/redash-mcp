export interface RedashColumn {
  name: string;
  type: string;
  friendly_name: string;
}

export interface RedashQueryResult {
  query_result: {
    id: number;
    data_source_id: number;
    query: string;
    data: {
      columns: RedashColumn[];
      rows: Record<string, unknown>[];
    };
    runtime: number;
  };
}

export interface RedashDataSource {
  id: number;
  name: string;
  type: string;
}

export interface RedashSchemaTable {
  name: string;
  columns: string[];
}

export interface RedashSavedQuery {
  id: number;
  name: string;
  query: string;
  data_source_id: number;
}
