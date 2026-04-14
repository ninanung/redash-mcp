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
  description?: string | null;
  tags?: string[];
  updated_at?: string;
}

export interface RedashSavedQueryListResponse {
  count: number;
  page: number;
  page_size: number;
  results: RedashSavedQuery[];
}

export interface RedashSchemaResponse {
  schema: RedashSchemaTable[];
}

export interface RedashDashboardSummary {
  id: number;
  slug: string;
  name: string;
  tags?: string[];
  updated_at?: string;
}

export interface RedashDashboardListResponse {
  count: number;
  page: number;
  page_size: number;
  results: RedashDashboardSummary[];
}

export interface RedashDashboardWidget {
  id: number;
  text?: string | null;
  visualization?: {
    id: number;
    name: string;
    type: string;
    query?: RedashSavedQuery;
  } | null;
}

export interface RedashDashboardDetail extends RedashDashboardSummary {
  widgets: RedashDashboardWidget[];
}

export interface RedashJobResponse {
  job?: {
    id: string;
    status: number;
    error?: string;
    query_result_id?: number;
    result?: RedashQueryResult;
  };
  query_result?: RedashQueryResult["query_result"];
}

export interface RedashJobStatusResponse {
  job: {
    id: string;
    status: number;
    error?: string;
    query_result_id?: number;
    result?: RedashQueryResult;
  };
}
