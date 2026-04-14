type ToolArgs = Record<string, unknown>;

export interface GetSchemaArgs extends ToolArgs {
  data_source_id: number;
  keywords?: string[];
  refresh?: boolean;
}

export interface ExecuteQueryArgs extends ToolArgs {
  data_source_id: number;
  query: string;
  max_rows?: number;
  save_csv?: string;
  timeout_ms?: number;
}

export interface ExploreColumnArgs extends ToolArgs {
  data_source_id: number;
  columns: {
    table: string;
    column: string;
    partition_filter?: string;
  }[];
  limit?: number;
  refresh?: boolean;
}

export interface FindMappingArgs extends ToolArgs {
  data_source_id: number;
  table: string;
  column: string;
  refresh?: boolean;
}

export interface SaveQueryArgs extends ToolArgs {
  data_source_id: number;
  name: string;
  query: string;
  description?: string;
  tags?: string[];
}

export interface UpdateQueryArgs extends ToolArgs {
  query_id: number;
  name?: string;
  query?: string;
  description?: string;
  tags?: string[];
}

export interface ListDashboardsArgs extends ToolArgs {
  q?: string;
  page?: number;
  page_size?: number;
}

export interface GetDashboardArgs extends ToolArgs {
  id: string | number;
}

export interface ExplainQueryArgs extends ToolArgs {
  data_source_id: number;
  query: string;
}

export interface GetCacheArgs extends ToolArgs {
  keyword?: string;
}

export interface ListSavedQueriesArgs extends ToolArgs {
  q?: string;
  data_source_id?: number;
  page?: number;
  page_size?: number;
}

export interface GetSavedQueryArgs extends ToolArgs {
  query_id: number;
}

export interface ExecuteSavedQueryArgs extends ToolArgs {
  query_id: number;
  parameters?: Record<string, unknown>;
  max_rows?: number;
}

export interface SampleRowsArgs extends ToolArgs {
  data_source_id: number;
  table: string;
  limit?: number;
  partition_filter?: string;
  columns?: string[];
}

export interface DescribeTableArgs extends ToolArgs {
  data_source_id: number;
  table: string;
  sample_limit?: number;
  partition_filter?: string;
}

export interface FindTableArgs extends ToolArgs {
  data_source_id: number;
  column?: string;
  table_keyword?: string;
}

export interface JoinHintsArgs extends ToolArgs {
  data_source_id: number;
  table: string;
}

export interface ExportMetadataCacheArgs extends ToolArgs {
  path: string;
}

export interface ImportMetadataCacheArgs extends ToolArgs {
  path: string;
  mode?: "merge" | "replace";
}
