import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import type { BackendResponse } from "../types";
import type { BackendDiagnostic } from "../types";

export type LocalStatus =
  | { kind: "idle"; message: string }
  | { kind: "working"; message: string }
  | { kind: "error"; message: string; hint?: string }
  | { kind: "result"; result: BackendResponse };

interface StatusPanelProps {
  status: LocalStatus;
  onOpenLogs: () => void;
}

export function StatusPanel({ status, onOpenLogs }: StatusPanelProps) {
  if (status.kind === "idle") {
    return (
      <aside className="status-panel status-idle" aria-live="polite">
        <div className="status-marker" />
        <span>{status.message}</span>
      </aside>
    );
  }

  if (status.kind === "working") {
    return (
      <aside className="status-panel status-working" aria-live="polite">
        <LoaderCircle className="spin" size={19} />
        <span>{status.message}</span>
      </aside>
    );
  }

  if (status.kind === "error") {
    return (
      <aside className="status-panel status-error" role="alert">
        <AlertCircle size={19} />
        <div>
          <strong>{status.message}</strong>
          {status.hint ? <span>{status.hint}</span> : null}
          <button className="status-link" type="button" onClick={onOpenLogs}>
            Open diagnostic logs
          </button>
        </div>
      </aside>
    );
  }

  const { result } = status;
  const diagnostics = result.diagnostics;
  const groups = groupDiagnostics(diagnostics);
  const warningCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning",
  ).length;
  return (
    <aside
      className={`status-panel ${result.ok ? "status-success" : "status-error"}`}
      role={result.ok ? "status" : "alert"}
    >
      {result.ok ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
      <div className="status-result-copy">
        <strong>{result.message}</strong>
        {result.outputPath ? (
          <span className="result-path">{result.outputPath}</span>
        ) : null}
        {result.hint ? <span>{result.hint}</span> : null}
        {result.errorCode ? (
          <span className="error-code">Error code: {result.errorCode}</span>
        ) : null}
        {diagnostics.length > 0 ? (
          <details open={!result.ok}>
            <summary>
              {result.ok ? (
                <AlertTriangle size={15} />
              ) : (
                <AlertCircle size={15} />
              )}
              {result.ok && warningCount === diagnostics.length
                ? `${warningCount} warning${warningCount === 1 ? "" : "s"}`
                : `${diagnostics.length} issue${diagnostics.length === 1 ? "" : "s"}`}
              {groups.length < diagnostics.length
                ? ` · ${groups.length} type${groups.length === 1 ? "" : "s"}`
                : ""}
            </summary>
            {result.ok && warningCount > 0 ? (
              <span className="diagnostic-intro">
                {result.operation === "extract"
                  ? "The output was created. Warnings describe content that Word and Markdown represent differently."
                  : result.operation === "render"
                    ? "The output was created. Warnings identify optional fields left empty or Word fields that update when opened."
                    : "The output was created. Warnings identify omitted constructs or Word fields that update when opened."}
              </span>
            ) : null}
            <ul className="diagnostic-list">
              {groups.map((group) => (
                <li key={group.code}>
                  <div className="diagnostic-label">
                    <code>{group.code}</code>
                    {group.count > 1 ? <span>×{group.count}</span> : null}
                  </div>
                  <div className="diagnostic-copy">
                    <span>{group.summary}</span>
                    {group.paths.length > 0 ? (
                      <small>
                        {group.paths.slice(0, 5).join(", ")}
                        {group.paths.length > 5
                          ? `, and ${group.paths.length - 5} more`
                          : ""}
                      </small>
                    ) : null}
                    <small>{group.hint}</small>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {!result.ok ? (
          <button className="status-link" type="button" onClick={onOpenLogs}>
            Open diagnostic logs
          </button>
        ) : null}
      </div>
      <span className="duration">{result.durationMilliseconds} ms</span>
    </aside>
  );
}

interface DiagnosticGroup {
  code: string;
  count: number;
  summary: string;
  hint: string;
  paths: string[];
}

const friendlySummaries: Record<string, string> = {
  "W-EXT-002":
    "Word page-layout markers were omitted because Markdown preserves content, not page geometry.",
  "W-EXT-003":
    "Word-only fields, such as table-of-contents page references, were omitted from Markdown.",
  "W-EXT-004":
    "The first table row was treated as the Markdown header. Check it if the source table had no header.",
  "W-OUT-002":
    "The document contains fields such as a table of contents that Word updates after opening.",
  "W-MDL-007":
    "Optional template fields were left empty and removed from the generated document.",
  "W-MRG-001":
    "The JSON model defines the same field as Markdown, so the JSON value takes precedence.",
};

function groupDiagnostics(
  diagnostics: BackendDiagnostic[],
): DiagnosticGroup[] {
  const grouped = new Map<string, BackendDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    const existing = grouped.get(diagnostic.code);
    if (existing) {
      existing.push(diagnostic);
    } else {
      grouped.set(diagnostic.code, [diagnostic]);
    }
  }

  return Array.from(grouped.entries()).map(([code, items]) => {
    const first = items[0];
    if (!first) {
      throw new Error(`Diagnostic group '${code}' is empty.`);
    }

    const paths = items
      .map((item) => item.path)
      .filter((path): path is string => Boolean(path))
      .map(formatDiagnosticPath)
      .filter((path, index, all) => all.indexOf(path) === index);
    return {
      code,
      count: items.length,
      summary:
        code === "E-MDL-003"
          ? `${items.length} template field${items.length === 1 ? " has" : "s have"} no value.`
          : (friendlySummaries[code] ?? first.message),
      hint:
        code === "E-MDL-003"
          ? "Add the listed values in the JSON model. Schema-required fields remain mandatory; turn strict mode off only to leave optional placeholders empty."
          : first.hint,
      paths,
    };
  });
}

function formatDiagnosticPath(path: string): string {
  if (!path.startsWith("/data/")) {
    return path;
  }

  return path
    .slice("/data/".length)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .join(".");
}
