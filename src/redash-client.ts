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
  RedashSchemaResponse,
  RedashJobResponse,
  RedashJobStatusResponse,
} from "@/interfaces/redash-client.js";

export class RedashClient {
  private client: AxiosInstance;

  constructor(url: string, apiKey: string, timeout = 30000) {
    this.client = axios.create({
      baseURL: url,
      headers: { Authorization: `Key ${apiKey}` },
      timeout,
    });
  }

  async listDataSources(): Promise<RedashDataSource[]> {
    const res = await this.client.get<RedashDataSource[]>("/api/data_sources");
    return res.data;
  }

  async getSchema(dataSourceId: number): Promise<RedashSchemaTable[]> {
    const res = await this.client.get<RedashSchemaResponse>(
      `/api/data_sources/${dataSourceId}/schema`
    );
    return res.data.schema ?? [];
  }

  async executeAdhocQuery(
    query: string,
    dataSourceId: number
  ): Promise<RedashQueryResult> {
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
    dataSourceId: number
  ): Promise<RedashSavedQuery> {
    const res = await this.client.post<RedashSavedQuery>("/api/queries", {
      name,
      query,
      data_source_id: dataSourceId,
    });
    return res.data;
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
