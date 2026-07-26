import {
  AlertCircle,
  CheckCircle2,
  FileJson2,
  LoaderCircle,
  WandSparkles,
} from "lucide-react";
import type {
  BackendResponse,
  InspectionData,
  PreflightData,
} from "../types";

interface TemplateReadinessProps {
  inspection: InspectionData;
  response: BackendResponse<PreflightData> | null;
  busy: boolean;
  bridgeError: string | null;
  hasInputs: boolean;
  disabled: boolean;
  onChooseModel: () => void;
  onCreateModel: () => void;
}

export function TemplateReadiness({
  inspection,
  response,
  busy,
  bridgeError,
  hasInputs,
  disabled,
  onChooseModel,
  onCreateModel,
}: TemplateReadinessProps) {
  const requiredCount = inspection.placeholders.filter(
    (placeholder) => placeholder.required,
  ).length;
  const missing = response?.diagnostics.filter(
    (diagnostic) =>
      diagnostic.severity === "error" && diagnostic.code === "E-MDL-003",
  );
  const missingPaths = (missing ?? [])
    .map((diagnostic) => diagnostic.path)
    .filter((path): path is string => Boolean(path))
    .map(formatPath);
  const missingCount = missing?.length ?? 0;

  let state: "idle" | "working" | "ready" | "error" = "idle";
  let title = "Template requirements";
  let description =
    requiredCount === 0
      ? "This template has no schema-required fields. Optional placeholders may be left empty."
      : `${requiredCount} field${requiredCount === 1 ? " is" : "s are"} required by the template schema. Add content to validate them.`;

  if (!hasInputs) {
    description += " Select Markdown, a JSON model, or both to continue.";
  } else if (busy) {
    state = "working";
    title = "Checking template inputs…";
    description =
      "DocxGen is validating the selected Markdown and JSON without creating a document.";
  } else if (bridgeError) {
    state = "error";
    title = "Template inputs could not be checked.";
    description = bridgeError;
  } else if (response?.ok) {
    state = "ready";
    title = "Template inputs are ready.";
    const optionalCount = response.data?.unboundPaths.length ?? 0;
    description =
      optionalCount > 0
        ? `${optionalCount} optional field${optionalCount === 1 ? " will" : "s will"} be left empty.`
        : "All detected placeholders used by this render have values.";
  } else if (response && !response.ok) {
    state = "error";
    if (missingCount > 0) {
      title = `${missingCount} required template field${missingCount === 1 ? " is" : "s are"} missing.`;
      description =
        "Add the listed values in a JSON model. Schema-required fields cannot be bypassed by turning strict mode off.";
    } else {
      title = "Template inputs need attention.";
      description =
        response.hint ??
        "Correct the selected Markdown or JSON model before rendering.";
    }
  }

  return (
    <section
      className={`template-readiness readiness-${state}`}
      aria-live="polite"
    >
      <div className="readiness-icon" aria-hidden="true">
        {state === "working" ? (
          <LoaderCircle className="spin" size={19} />
        ) : state === "ready" ? (
          <CheckCircle2 size={19} />
        ) : state === "error" ? (
          <AlertCircle size={19} />
        ) : (
          <FileJson2 size={19} />
        )}
      </div>
      <div className="readiness-copy">
        <strong>{title}</strong>
        <span>{description}</span>
        {missingPaths.length > 0 ? (
          <small>
            {missingPaths.slice(0, 5).join(", ")}
            {missingPaths.length > 5
              ? `, and ${missingPaths.length - 5} more`
              : ""}
          </small>
        ) : null}
      </div>
      <div className="readiness-actions">
        <button
          className="secondary-button compact"
          type="button"
          disabled={disabled}
          onClick={onChooseModel}
        >
          <FileJson2 size={16} />
          Choose JSON model
        </button>
        <button
          className="secondary-button compact"
          type="button"
          disabled={disabled}
          onClick={onCreateModel}
        >
          <WandSparkles size={16} />
          Create model from template
        </button>
      </div>
    </section>
  );
}

function formatPath(path: string): string {
  if (!path.startsWith("/data/")) {
    return path;
  }

  return path
    .slice("/data/".length)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .join(".");
}
