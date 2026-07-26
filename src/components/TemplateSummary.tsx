import { Braces, CircleAlert, Fingerprint } from "lucide-react";
import type { InspectionData } from "../types";

interface TemplateSummaryProps {
  inspection: InspectionData;
}

export function TemplateSummary({ inspection }: TemplateSummaryProps) {
  return (
    <div className="template-summary">
      <div className="template-summary-heading">
        <div>
          <span className="eyebrow">Template contract</span>
          <strong>
            {inspection.placeholders.length} placeholder
            {inspection.placeholders.length === 1 ? "" : "s"} detected
          </strong>
        </div>
        <span className="template-identity">
          {inspection.templateId ?? "Unversioned template"}
          {inspection.templateVersion
            ? ` · ${inspection.templateVersion}`
            : ""}
        </span>
      </div>

      {inspection.placeholders.length === 0 ? (
        <div className="template-advice">
          <CircleAlert size={17} />
          This file has no DocxGen placeholders. Use it as a style reference in
          Quick conversion.
        </div>
      ) : (
        <div className="placeholder-grid">
          {inspection.placeholders.slice(0, 8).map((placeholder) => (
            <div className="placeholder-chip" key={placeholder.path}>
              <Braces size={14} />
              <span>{placeholder.path}</span>
              <small>
                {placeholder.kind} ·{" "}
                {placeholder.required ? "required" : "optional"}
              </small>
            </div>
          ))}
          {inspection.placeholders.length > 8 ? (
            <span className="more-placeholders">
              +{inspection.placeholders.length - 8} more
            </span>
          ) : null}
        </div>
      )}

      <div className="template-hash" title={inspection.templateHash}>
        <Fingerprint size={14} />
        <code>{inspection.templateHash.slice(0, 16)}…</code>
      </div>
    </div>
  );
}
