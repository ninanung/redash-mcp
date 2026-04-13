type ToolArgs = Record<string, unknown>;

export interface GetSchemaArgs extends ToolArgs {
  data_source_id: number;
  keywords?: string[];
  refresh?: boolean;
}

export interface ExecuteQueryArgs extends ToolArgs {
  data_source_id: number;
  query: string;
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
}

export interface GetCacheArgs extends ToolArgs {
  keyword?: string;
}
