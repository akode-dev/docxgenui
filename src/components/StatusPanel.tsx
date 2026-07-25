import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import type { BackendResponse } from "../types";

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
              {diagnostics.length} diagnostic
              {diagnostics.length === 1 ? "" : "s"}
            </summary>
            <ul className="diagnostic-list">
              {diagnostics.map((diagnostic) => (
                <li
                  key={`${diagnostic.code}-${diagnostic.path ?? diagnostic.message}`}
                >
                  <code>{diagnostic.code}</code>
                  <span>{diagnostic.message}</span>
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
