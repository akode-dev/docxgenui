export type Operation = "health" | "inspect" | "convert" | "render" | "extract";

export interface BackendDiagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  hint: string;
  path: string | null;
}

export interface BackendResponse<TData = unknown> {
  ok: boolean;
  operation: string;
  message: string;
  hint: string | null;
  errorCode: string | null;
  outputPath: string | null;
  durationMilliseconds: number;
  diagnostics: BackendDiagnostic[];
  data: TData | null;
}

export interface HealthData {
  backendVersion: string;
  docxGenVersion: string;
  runtime: string;
  operatingSystem: string;
}

export interface PlaceholderData {
  path: string;
  kind: string;
  formatter: string | null;
  formatterArguments: string | null;
  required: boolean;
  locations: string[];
}

export interface InspectionData {
  templateHash: string;
  templateId: string | null;
  templateVersion: string | null;
  placeholders: PlaceholderData[];
  requiredStyles: string[];
  unsupportedForStaticAnalysis: string[];
}

export interface ConversionData {
  sections: number;
  headings: number;
  tables: number;
  images: number;
  codeBlocks: number;
  validated: boolean;
}

export interface RenderData extends ConversionData {
  templateHash: string;
  boundPaths: string[];
  unboundPaths: string[];
}

export interface ExtractionData {
  assetsDirectory: string;
  paragraphs: number;
  headings: number;
  listItems: number;
  tables: number;
  images: number;
}

export interface BackendRequest {
  operation: Operation;
  payload: Record<string, unknown>;
}

export interface SelectedFile {
  path: string;
  name: string;
}
