import {
  CheckCircle2,
  FileInput,
  FileOutput,
  FolderOpen,
  X,
} from "lucide-react";
import type { SelectedFile } from "../types";

interface FilePickerProps {
  label: string;
  description: string;
  value: SelectedFile | null;
  acceptLabel: string;
  output?: boolean;
  optional?: boolean;
  disabled?: boolean;
  onPick: () => void | Promise<void>;
  onClear?: () => void;
}

export function FilePicker({
  label,
  description,
  value,
  acceptLabel,
  output = false,
  optional = false,
  disabled = false,
  onPick,
  onClear,
}: FilePickerProps) {
  const Icon = output ? FileOutput : FileInput;

  return (
    <div className={`file-picker ${value ? "has-file" : ""}`}>
      <div className="file-picker-icon" aria-hidden="true">
        {value ? <CheckCircle2 size={21} /> : <Icon size={21} />}
      </div>
      <div className="file-picker-copy">
        <div className="file-picker-title">
          <span>{label}</span>
          {optional ? <span className="optional-badge">Optional</span> : null}
        </div>
        {value ? (
          <>
            <strong className="file-name">{value.name}</strong>
            <span className="file-path" title={value.path}>
              {value.path}
            </span>
          </>
        ) : (
          <span className="file-picker-description">{description}</span>
        )}
      </div>
      <div className="file-picker-actions">
        {value && onClear ? (
          <button
            className="icon-button"
            type="button"
            aria-label={`Clear ${label}`}
            disabled={disabled}
            onClick={onClear}
          >
            <X size={17} />
          </button>
        ) : null}
        <button
          className="secondary-button compact"
          type="button"
          disabled={disabled}
          onClick={() => void onPick()}
        >
          <FolderOpen size={17} />
          {value ? "Change" : acceptLabel}
        </button>
      </div>
    </div>
  );
}
