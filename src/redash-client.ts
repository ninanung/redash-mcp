import axios, { AxiosInstance } from "axios";
export type {
  RedashColumn,
  RedashQueryResult,
  RedashDataSource,
  RedashSchemaTable,
  RedashSavedQuery,
} from "@/interfaces/redash-client.js";
import type {
  RedashQueryResult,
  RedashDataSource,
  RedashSchemaTable,
  RedashSavedQuery,
  RedashSavedQueryListResponse,
  RedashSchemaResponse,
  RedashJobResponse,
  RedashJobStatusResponse,
} from "@/interfaces/redash-client.js";

export class RedashClient {
  private client: AxiosInstance;
  private allowedDataSources: Set<number> | null;

  constructor(
    url: string,
    apiKey: string,
    options: { timeout?: number; allowedDataSources?: number[] } = {}
  ) {
    const { timeout = 30000, allowedDataSources } = options;
    this.client = axios.create({
      baseURL: url,
      headers: { Authorization: `Key ${apiKey}` },
      timeout,
    });
    this.allowedDataSources =
      allowedDataSources && allowedDataSources.length > 0
        ? new Set(allowedDataSources)
        : null;
  }

  assertDataSourceAllowed(dataSourceId: number): void {
    if (this.allowedDataSources && !this.allowedDataSources.has(dataSourceId)) {
      const allowed = [...this.allowedDataSources].join(", ");
      throw new Error(
        `data_source_id ${dataSourceId}는 허용되지 않았습니다. REDASH_ALLOWED_DS=${allowed}`
      );
    }
  }

  getAllowedDataSources(): number[] | null {
    return this.allowedDataSources ? [...this.allowedDataSources] : null;
  }

  async listDataSources(): Promise<RedashDataSource[]> {
    const res = await this.client.get<RedashDataSource[]>("/api/data_sources");
    if (this.allowedDataSources) {
      return res.data.filter((d) => this.allowedDataSources!.has(d.id));
    }
    return res.data;
  }

  async getSchema(dataSourceId: number): Promise<RedashSchemaTable[]> {
    this.assertDataSourceAllowed(dataSourceId);
    const res = await this.client.get<RedashSchemaResponse>(
      `/api/data_sources/${dataSourceId}/schema`
    );
    return res.data.schema ?? [];
  }

  async executeAdhocQuery(
    query: string,
    dataSourceId: number
  ): Promise<RedashQueryResult> {
    this.assertDataSourceAllowed(dataSourceId);
    const payload = {
      query,
      data_source_id: dataSourceId,
      max_age: 0,
      parameters: {},
    };

    const res = await this.client.post<RedashJobResponse>("/api/query_results", payload);

    if (res.data.job) {
      return await this.pollJob(res.data.job.id);
    }

    return { query_result: res.data.query_result! };
  }

  async saveQuery(
    name: string,
    query: string,
    dataSourceId: number,
    options: {
      description?: string;
      tags?: string[];
    } = {}
  ): Promise<RedashSavedQuery> {
    this.assertDataSourceAllowed(dataSourceId);
    const payload: Record<string, unknown> = {
      name,
      query,
      data_source_id: dataSourceId,
    };
    if (options.description !== undefined) payload.description = options.description;
    if (options.tags !== undefined) payload.tags = options.tags;
    const res = await this.client.post<RedashSavedQuery>("/api/queries", payload);
    return res.data;
  }

  async updateQuery(
    queryId: number,
    updates: {
      name?: string;
      query?: string;
      description?: string;
      tags?: string[];
    }
  ): Promise<RedashSavedQuery> {
    const res = await this.client.post<RedashSavedQuery>(
      `/api/queries/${queryId}`,
      updates
    );
    return res.data;
  }

  async listSavedQueries(params: {
    q?: string;
    page?: number;
    pageSize?: number;
    dataSourceId?: number;
  } = {}): Promise<RedashSavedQueryListResponse> {
    const query: Record<string, string | number> = {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 25,
    };
    if (params.q) query.q = params.q;
    const res = await this.client.get<RedashSavedQueryListResponse>(
      "/api/queries",
      { params: query }
    );
    const data = res.data;
    if (params.dataSourceId !== undefined) {
      data.results = data.results.filter(
        (q) => q.data_source_id === params.dataSourceId
      );
    }
    if (this.allowedDataSources) {
      data.results = data.results.filter((q) =>
        this.allowedDataSources!.has(q.data_source_id)
      );
    }
    return data;
  }

  async getSavedQuery(queryId: number): Promise<RedashSavedQuery> {
    const res = await this.client.get<RedashSavedQuery>(
      `/api/queries/${queryId}`
    );
    return res.data;
  }

  async executeSavedQuery(
    queryId: number,
    parameters: Record<string, unknown> = {}
  ): Promise<RedashQueryResult> {
    const saved = await this.getSavedQuery(queryId);
    this.assertDataSourceAllowed(saved.data_source_id);
    const res = await this.client.post<RedashJobResponse>(
      `/api/queries/${queryId}/results`,
      { parameters, max_age: 0 }
    );
    if (res.data.job) {
      return await this.pollJob(res.data.job.id);
    }
    return { query_result: res.data.query_result! };
  }

  private async pollJob(
    jobId: string,
    timeout = 120000,
    interval = 1500
  ): Promise<RedashQueryResult> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const res = await this.client.get<RedashJobStatusResponse>(`/api/jobs/${jobId}`);
      const job = res.data.job;

      if (job.status === 3) {
        if (job.query_result_id) {
          const result = await this.client.get<RedashQueryResult>(
            `/api/query_results/${job.query_result_id}`
          );
          return result.data;
        }
        return job.result!;
      }

      if (job.status === 4) {
        throw new Error(`Query failed: ${job.error || "Unknown error"}`);
      }

      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`Query timed out after ${timeout}ms`);
  }

  formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        const data = error.response.data as Record<string, unknown>;
        const msg = data?.message || data?.error || JSON.stringify(data);
        return `Redash API error (${error.response.status}): ${msg}`;
      }
      if (error.request) {
        return `No response from Redash: ${error.message}`;
      }
      return `Request error: ${error.message}`;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
