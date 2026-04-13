import axios, { AxiosInstance, AxiosError } from "axios";

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
    const res = await this.client.get("/api/data_sources");
    return res.data;
  }

  async getSchema(dataSourceId: number): Promise<RedashSchemaTable[]> {
    const res = await this.client.get(
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

    const res = await this.client.post("/api/query_results", payload);

    if (res.data.job) {
      return await this.pollJob(res.data.job.id);
    }

    return res.data;
  }

  async saveQuery(
    name: string,
    query: string,
    dataSourceId: number
  ): Promise<RedashSavedQuery> {
    const res = await this.client.post("/api/queries", {
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
      const res = await this.client.get(`/api/jobs/${jobId}`);
      const job = res.data.job;

      if (job.status === 3) {
        if (job.query_result_id) {
          const result = await this.client.get(
            `/api/query_results/${job.query_result_id}`
          );
          return result.data;
        }
        return job.result;
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
      const e = error as AxiosError;
      if (e.response) {
        const data = e.response.data as Record<string, unknown>;
        const msg = data?.message || data?.error || JSON.stringify(data);
        return `Redash API error (${e.response.status}): ${msg}`;
      }
      if (e.request) {
        return `No response from Redash: ${e.message}`;
      }
      return `Request error: ${e.message}`;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
