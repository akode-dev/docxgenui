import { useEffect, useRef } from "react";
import { Braces, FileImage, FileText, ListTree, X } from "lucide-react";

interface TemplateHelpDialogProps {
  onClose: () => void;
}

export function TemplateHelpDialog({ onClose }: TemplateHelpDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="template-help-dialog"
      aria-labelledby="template-help-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">Template field guide</span>
          <h2 id="template-help-title">What to put in a Word template</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Close template field guide"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <p className="dialog-intro">
        Type placeholders directly in Word. Keep Markdown and image placeholders
        in an otherwise empty paragraph.
      </p>

      <div className="field-guide-grid">
        <article>
          <Braces size={18} />
          <div>
            <strong>Text and metadata</strong>
            <code>{"{{ds.Document.Title}}"}</code>
            <span>Use for titles, dates, versions, names, and other values.</span>
          </div>
        </article>
        <article>
          <FileText size={18} />
          <div>
            <strong>Markdown section</strong>
            <code>{"{{ds.Body}:MD}"}</code>
            <span>
              The selected Markdown file fills <code>ds.Body</code>.
            </span>
          </div>
        </article>
        <article>
          <FileImage size={18} />
          <div>
            <strong>Variable image</strong>
            <code>{"{{ds.ClientLogo}:IMG(alt=Client logo)}"}</code>
            <span>
              Bind with <code>{'{ "$file": "logo.png" }'}</code>.
            </span>
          </div>
        </article>
        <article>
          <ListTree size={18} />
          <div>
            <strong>Repeated rows or sections</strong>
            <code>{"{{#ds.Revisions}} … {{/ds.Revisions}}"}</code>
            <span>Bind the path to a JSON array of objects.</span>
          </div>
        </article>
      </div>

      <div className="dialog-note">
        <strong>Optional fields</strong>
        <span>
          Leave “Require every template placeholder” off to remove unbound
          optional fields. An adjacent template schema can still mark selected
          fields as required.
        </span>
      </div>

      <div className="dialog-note">
        <strong>Markdown and JSON together</strong>
        <span>
          Omit <code>data.ds.Body</code> from JSON when a Markdown body is
          selected. Use “Referenced files folder” for paths in{" "}
          <code>$mdFile</code>, <code>$file</code>, and local images.
        </span>
      </div>

      <button className="secondary-button dialog-close" type="button" onClick={onClose}>
        Got it
      </button>
    </dialog>
  );
}
