export type ParameterValueSource = "passed" | "default";

export interface ResolvedParameter {
  name: string;
  value: unknown;
  source: ParameterValueSource;
}
