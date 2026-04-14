import { RedashClient } from "@/redash-client.js";
import { SchemaCache } from "@/schema-cache.js";

export interface InstanceContext {
  name: string;
  client: RedashClient;
  schemaCache: SchemaCache;
}

interface InstanceConfig {
  name: string;
  url: string;
  api_key: string;
  allowed_data_sources?: number[];
}

export class ClientRegistry {
  private instances = new Map<string, InstanceContext>();
  private defaultName: string;

  constructor(defaultName: string) {
    this.defaultName = defaultName;
  }

  add(name: string, client: RedashClient): void {
    this.instances.set(name, { name, client, schemaCache: new SchemaCache() });
  }

  resolve(name?: string): InstanceContext {
    const key = name ?? this.defaultName;
    const ctx = this.instances.get(key);
    if (!ctx) {
      const available = Array.from(this.instances.keys()).join(", ");
      throw new Error(
        `Unknown Redash instance: "${key}". 사용 가능한 인스턴스: ${available}`
      );
    }
    return ctx;
  }

  names(): string[] {
    return Array.from(this.instances.keys());
  }
}

export function buildRegistryFromEnv(): ClientRegistry {
  const raw = process.env.REDASH_INSTANCES;
  if (raw) {
    const parsed = JSON.parse(raw) as InstanceConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("REDASH_INSTANCES는 비어있지 않은 배열이어야 합니다.");
    }
    const registry = new ClientRegistry(parsed[0].name);
    for (const cfg of parsed) {
      if (!cfg.name || !cfg.url || !cfg.api_key) {
        throw new Error(
          `REDASH_INSTANCES 항목에 name/url/api_key가 모두 필요합니다: ${JSON.stringify(cfg)}`
        );
      }
      registry.add(
        cfg.name,
        new RedashClient(cfg.url, cfg.api_key, {
          allowedDataSources: cfg.allowed_data_sources,
        })
      );
    }
    return registry;
  }

  const url = process.env.REDASH_URL;
  const apiKey = process.env.REDASH_API_KEY;
  if (!url || !apiKey) {
    throw new Error(
      "REDASH_INSTANCES 또는 REDASH_URL/REDASH_API_KEY 환경변수가 필요합니다."
    );
  }

  const allowedRaw = process.env.REDASH_ALLOWED_DS;
  const allowedDataSources = allowedRaw
    ? allowedRaw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n))
    : undefined;

  const registry = new ClientRegistry("default");
  registry.add(
    "default",
    new RedashClient(url, apiKey, { allowedDataSources })
  );
  return registry;
}
