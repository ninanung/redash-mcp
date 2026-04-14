import { RedashClient } from "@/redash-client.js";
import type { ToolResult } from "@/interfaces/tools.js";

interface Check {
  name: string;
  status: "ok" | "fail" | "skip";
  detail: string;
}

export async function handleSelfTest(client: RedashClient): Promise<ToolResult> {
  const checks: Check[] = [];

  checks.push({
    name: "env.REDASH_URL",
    status: process.env.REDASH_URL ? "ok" : "fail",
    detail: process.env.REDASH_URL ?? "(not set)",
  });

  checks.push({
    name: "env.REDASH_API_KEY",
    status: process.env.REDASH_API_KEY ? "ok" : "fail",
    detail: process.env.REDASH_API_KEY ? "(set)" : "(not set)",
  });

  const allowed = client.getAllowedDataSources();
  checks.push({
    name: "env.REDASH_ALLOWED_DS",
    status: "ok",
    detail: allowed ? allowed.join(",") : "(all allowed)",
  });

  try {
    const sources = await client.listDataSources();
    checks.push({
      name: "api.list_data_sources",
      status: "ok",
      detail: `${sources.length} data source(s) reachable`,
    });

    if (sources.length > 0) {
      const target = sources[0];
      try {
        const schema = await client.getSchema(target.id);
        checks.push({
          name: `api.get_schema(${target.id})`,
          status: "ok",
          detail: `${schema.length} tables`,
        });
      } catch (err) {
        checks.push({
          name: `api.get_schema(${target.id})`,
          status: "fail",
          detail: client.formatError(err),
        });
      }
    } else {
      checks.push({
        name: "api.get_schema",
        status: "skip",
        detail: "no data sources to probe",
      });
    }
  } catch (err) {
    checks.push({
      name: "api.list_data_sources",
      status: "fail",
      detail: client.formatError(err),
    });
  }

  const icon = (s: Check["status"]) =>
    s === "ok" ? "✓" : s === "skip" ? "-" : "✗";
  const body = checks
    .map((c) => `${icon(c.status)} ${c.name}: ${c.detail}`)
    .join("\n");

  const hasFail = checks.some((c) => c.status === "fail");
  return {
    content: [
      {
        type: "text",
        text: `Self-test ${hasFail ? "FAILED" : "OK"}\n\n${body}`,
      },
    ],
    isError: hasFail,
  };
}
