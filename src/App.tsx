import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  Boxes,
  ChevronRight,
  FileText,
  FolderOpen,
  HelpCircle,
  Layers3,
  LockKeyhole,
  RefreshCw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { FilePicker } from "./components/FilePicker";
import { StatusPanel, type LocalStatus } from "./components/StatusPanel";
import { TemplateHelpDialog } from "./components/TemplateHelpDialog";
import { TemplateSummary } from "./components/TemplateSummary";
import {
  getLogInfo,
  openLogFolder,
  openProjectPage,
  runBackend,
} from "./lib/backend";
import {
  pickDirectory,
  pickFile,
  pickOutput,
  suggestedOutput,
} from "./lib/files";
import type {
  BackendResponse,
  ConversionData,
  ExtractionData,
  HealthData,
  InspectionData,
  LogInfo,
  RenderData,
  SelectedFile,
} from "./types";

type Workspace = "create" | "extract";
type CreateMode = "quick" | "template";

const markdownType = { name: "Markdown", extensions: ["md", "markdown"] };
const docxType = { name: "Word document", extensions: ["docx"] };
const jsonType = { name: "JSON model", extensions: ["json"] };

function App() {
  const [workspace, setWorkspace] = useState<Workspace>("create");
  const [createMode, setCreateMode] = useState<CreateMode>("quick");
  const [health, setHealth] = useState<HealthData | null>(null);
  const [logInfo, setLogInfo] = useState<LogInfo | null>(null);
  const [status, setStatus] = useState<LocalStatus>({
    kind: "idle",
    message: "Choose your files. Documents stay on this device.",
  });
  const [busy, setBusy] = useState(false);

  const [markdown, setMarkdown] = useState<SelectedFile | null>(null);
  const [styleReference, setStyleReference] =
    useState<SelectedFile | null>(null);
  const [template, setTemplate] = useState<SelectedFile | null>(null);
  const [model, setModel] = useState<SelectedFile | null>(null);
  const [wordOutput, setWordOutput] = useState<SelectedFile | null>(null);
  const [inspection, setInspection] = useState<InspectionData | null>(null);

  const [sourceDocument, setSourceDocument] =
    useState<SelectedFile | null>(null);
  const [markdownOutput, setMarkdownOutput] =
    useState<SelectedFile | null>(null);
  const [assetsDirectory, setAssetsDirectory] = useState<string | null>(null);
  const [templateAssetsRoot, setTemplateAssetsRoot] = useState<string | null>(
    null,
  );

  const [includeToc, setIncludeToc] = useState(false);
  const [validateOutput, setValidateOutput] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [headingOffset, setHeadingOffset] = useState(0);
  const [strictTemplate, setStrictTemplate] = useState(false);
  const [showTemplateHelp, setShowTemplateHelp] = useState(false);

  useEffect(() => {
    let active = true;
    void getLogInfo()
      .then((info) => {
        if (active) {
          setLogInfo(info);
        }
      })
      .catch(() => {
        if (active) {
          setLogInfo(null);
        }
      });
    void runBackend<HealthData>("health")
      .then((response) => {
        if (active && response.ok && response.data) {
          setHealth(response.data);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setHealth(null);
          setStatus({
            kind: "error",
            message: "The document engine could not start.",
            hint: bridgeErrorMessage(error),
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const actionLabel = useMemo(() => {
    if (workspace === "extract") {
      return "Extract Markdown";
    }
    return createMode === "quick" ? "Create Word document" : "Render template";
  }, [createMode, workspace]);

  async function chooseMarkdown() {
    const selected = await pickFile("Choose Markdown", markdownType);
    if (selected) {
      setMarkdown(selected);
      setWordOutput(null);
      setStatus({
        kind: "idle",
        message: "Markdown selected. Choose an output path when ready.",
      });
    }
  }

  async function chooseStyleReference() {
    const selected = await pickFile("Choose a Word style reference", docxType);
    if (selected) {
      setStyleReference(selected);
    }
  }

  async function chooseTemplate() {
    const selected = await pickFile("Choose a DocxGen template", docxType);
    if (!selected) {
      return;
    }

    setTemplate(selected);
    setInspection(null);
    setStatus({ kind: "working", message: "Inspecting template contract…" });
    try {
      const response = await runBackend<InspectionData>("inspect", {
        templatePath: selected.path,
      });
      setStatus({ kind: "result", result: response });
      if (response.ok && response.data) {
        setInspection(response.data);
      }
    } catch (error: unknown) {
      setStatus({
        kind: "error",
        message: "Could not reach the document backend.",
        hint: bridgeErrorMessage(error),
      });
    }
  }

  async function chooseModel() {
    const selected = await pickFile("Choose a JSON model", jsonType);
    if (selected) {
      setModel(selected);
    }
  }

  async function chooseWordOutput() {
    const selected = await pickOutput(
      "Save Word document",
      docxType,
      suggestedOutput(markdown ?? template, "docx"),
    );
    if (selected) {
      setWordOutput(selected);
    }
  }

  async function chooseSourceDocument() {
    const selected = await pickFile("Choose a Word document", docxType);
    if (selected) {
      setSourceDocument(selected);
      setMarkdownOutput(null);
    }
  }

  async function chooseMarkdownOutput() {
    const selected = await pickOutput(
      "Save extracted Markdown",
      markdownType,
      suggestedOutput(sourceDocument, "md"),
    );
    if (selected) {
      setMarkdownOutput(selected);
    }
  }

  async function chooseAssetsDirectory() {
    const selected = await pickDirectory("Choose a folder for extracted images");
    if (selected) {
      setAssetsDirectory(selected);
    }
  }

  async function chooseTemplateAssetsRoot() {
    const selected = await pickDirectory(
      "Choose the folder containing referenced Markdown and images",
    );
    if (selected) {
      setTemplateAssetsRoot(selected);
    }
  }

  async function execute() {
    const validationError = validateForm();
    if (validationError) {
      setStatus({
        kind: "error",
        message: validationError,
        hint: "Complete the highlighted workflow from top to bottom.",
      });
      return;
    }

    setBusy(true);
    setStatus({
      kind: "working",
      message:
        workspace === "extract"
          ? "Reading Word semantics and exporting Markdown…"
          : "Rendering the Word document locally…",
    });

    try {
      let response: BackendResponse;
      if (workspace === "extract") {
        response = await runBackend<ExtractionData>("extract", {
          documentPath: sourceDocument!.path,
          outputPath: markdownOutput!.path,
          assetsDirectory,
          overwrite,
        });
      } else if (createMode === "quick") {
        response = await runBackend<ConversionData>("convert", {
          markdownPath: markdown!.path,
          outputPath: wordOutput!.path,
          styleReferencePath: styleReference?.path ?? null,
          headingOffset,
          includeToc,
          validateOutput,
          overwrite,
        });
      } else {
        response = await runBackend<RenderData>("render", {
          templatePath: template!.path,
          markdownPath: markdown?.path ?? null,
          modelPath: model?.path ?? null,
          outputPath: wordOutput!.path,
          assetsRoot: templateAssetsRoot,
          headingOffset,
          strict: strictTemplate,
          validateOutput,
          overwrite,
        });
      }
      setStatus({ kind: "result", result: response });
    } catch (error: unknown) {
      setStatus({
        kind: "error",
        message: "The desktop bridge did not return a result.",
        hint: bridgeErrorMessage(error),
      });
    } finally {
      setBusy(false);
    }
  }

  function validateForm(): string | null {
    if (workspace === "extract") {
      if (!sourceDocument) {
        return "Choose the Word document to extract.";
      }
      if (!markdownOutput) {
        return "Choose where the Markdown file should be saved.";
      }
      return null;
    }

    if (createMode === "quick" && !markdown) {
      return "Choose the Markdown file to convert.";
    }
    if (createMode === "template") {
      if (!template) {
        return "Choose a placeholder-bearing Word template.";
      }
      if (!markdown && !model) {
        return "Add Markdown, a JSON model, or both for the template.";
      }
    }
    if (!wordOutput) {
      return "Choose where the Word document should be saved.";
    }
    return null;
  }

  function switchWorkspace(next: Workspace) {
    setWorkspace(next);
    setStatus({
      kind: "idle",
      message:
        next === "create"
          ? "Build a Word document locally from Markdown."
          : "Extract semantic Markdown and embedded images from Word.",
    });
  }

  async function showLogs() {
    try {
      await openLogFolder();
    } catch (error: unknown) {
      setStatus({
        kind: "error",
        message: "Could not open the diagnostic log folder.",
        hint: bridgeErrorMessage(error),
      });
    }
  }

  async function showProject(project: "engine" | "desktop") {
    try {
      await openProjectPage(project);
    } catch (error: unknown) {
      setStatus({
        kind: "error",
        message: "Could not open the project page.",
        hint: bridgeErrorMessage(error),
      });
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Layers3 size={22} strokeWidth={2.4} />
          </div>
          <div>
            <strong>DocxGen</strong>
            <span>Desktop</span>
          </div>
        </div>
        <div className="privacy-note">
          <LockKeyhole size={15} />
          Local &amp; private
        </div>
        <div className="runtime-pill" title={health?.runtime}>
          <span className={health ? "runtime-dot online" : "runtime-dot"} />
          {health ? `Core ${health.docxGenVersion}` : "Starting engine"}
        </div>
      </header>

      <main className="app-main">
        <section className="hero">
          <div>
            <span className="eyebrow">Local document conversion</span>
            <h1>
              Convert Markdown and Word documents.
            </h1>
          </div>
          <p>
            Create a DOCX from Markdown, fill a Word template, or extract
            editable Markdown from an existing document. No Office
            installation, upload, or account required.
          </p>
        </section>

        <nav className="workspace-tabs" aria-label="Conversion direction">
          <button
            className={workspace === "create" ? "active" : ""}
            type="button"
            onClick={() => switchWorkspace("create")}
          >
            <FileText size={19} />
            <span>
              <strong>Markdown → Word</strong>
              <small>Create a polished DOCX</small>
            </span>
          </button>
          <button
            className={workspace === "extract" ? "active" : ""}
            type="button"
            onClick={() => switchWorkspace("extract")}
          >
            <BookOpenText size={19} />
            <span>
              <strong>Word → Markdown</strong>
              <small>Recover portable content</small>
            </span>
          </button>
        </nav>

        <section className="workspace-card">
          {workspace === "create" ? (
            <>
              <div className="mode-selector">
                <button
                  className={createMode === "quick" ? "active" : ""}
                  type="button"
                  onClick={() => setCreateMode("quick")}
                >
                  <Sparkles size={18} />
                  <span>
                    <strong>Quick conversion</strong>
                    <small>Markdown with optional Word styling</small>
                  </span>
                </button>
                <button
                  className={createMode === "template" ? "active" : ""}
                  type="button"
                  onClick={() => setCreateMode("template")}
                >
                  <Boxes size={18} />
                  <span>
                    <strong>Template document</strong>
                    <small>Placeholders, model data, branding</small>
                  </span>
                </button>
              </div>

              <div className="workflow">
                <div className="workflow-step">
                  <span className="step-number">1</span>
                  <div className="step-content">
                    <div className="step-heading">
                      <div>
                        <h2>
                          {createMode === "quick"
                            ? "Choose your content"
                            : "Load the document template"}
                        </h2>
                        <p>
                          {createMode === "quick"
                            ? "Markdown keeps chapters, lists, tables, links, code, and local images easy to edit."
                            : "DocxGen reads placeholders before rendering, so the required data contract is visible."}
                        </p>
                      </div>
                    </div>

                    {createMode === "quick" ? (
                      <FilePicker
                        label="Markdown source"
                        description="A .md file with your document content"
                        value={markdown}
                        acceptLabel="Choose Markdown"
                        disabled={busy}
                        onPick={chooseMarkdown}
                        onClear={() => setMarkdown(null)}
                      />
                    ) : (
                      <>
                        <FilePicker
                          label="Word template"
                          description="A .docx file containing DocxGen placeholders"
                          value={template}
                          acceptLabel="Choose template"
                          disabled={busy}
                          onPick={chooseTemplate}
                          onClear={() => {
                            setTemplate(null);
                            setInspection(null);
                          }}
                        />
                        {inspection ? (
                          <TemplateSummary inspection={inspection} />
                        ) : null}
                      </>
                    )}
                  </div>
                </div>

                <div className="workflow-divider">
                  <ChevronRight size={16} />
                </div>

                <div className="workflow-step">
                  <span className="step-number">2</span>
                  <div className="step-content">
                    <div className="step-heading">
                      <div>
                        <h2>
                          {createMode === "quick"
                            ? "Choose the visual style"
                            : "Add content and structured data"}
                        </h2>
                        <p>
                          {createMode === "quick"
                            ? "Without a reference, DocxGen creates a clean neutral document."
                            : "Plain Markdown fills ds.Body. JSON supplies cover fields, Document Control, collections, and other placeholders."}
                        </p>
                      </div>
                      {createMode === "template" ? (
                        <button
                          className="help-button"
                          type="button"
                          onClick={() => setShowTemplateHelp(true)}
                        >
                          <HelpCircle size={16} />
                          Template field guide
                        </button>
                      ) : null}
                    </div>

                    {createMode === "quick" ? (
                      <FilePicker
                        label="Word style reference"
                        description="Styles, headers, footers, and page setup from a .docx"
                        value={styleReference}
                        acceptLabel="Choose reference"
                        optional
                        disabled={busy}
                        onPick={chooseStyleReference}
                        onClear={() => setStyleReference(null)}
                      />
                    ) : (
                      <div className="stacked-pickers">
                        <FilePicker
                          label="Markdown body"
                          description="Unanchored Markdown fills ds.Body; anchored sections can fill multiple slots"
                          value={markdown}
                          acceptLabel="Choose Markdown"
                          optional
                          disabled={busy}
                          onPick={chooseMarkdown}
                          onClear={() => setMarkdown(null)}
                        />
                        <FilePicker
                          label="JSON model"
                          description="Structured values for template fields; omit ds.Body when Markdown is selected"
                          value={model}
                          acceptLabel="Choose model"
                          optional
                          disabled={busy}
                          onPick={chooseModel}
                          onClear={() => setModel(null)}
                        />
                        <div className="directory-picker">
                          <div className="file-picker-icon" aria-hidden="true">
                            <FolderOpen size={21} />
                          </div>
                          <div className="file-picker-copy">
                            <div className="file-picker-title">
                              <span>Referenced files folder</span>
                              <span className="optional-badge">Optional</span>
                            </div>
                            <span
                              className={
                                templateAssetsRoot
                                  ? "file-path selected-directory"
                                  : "file-picker-description"
                              }
                              title={templateAssetsRoot ?? undefined}
                            >
                              {templateAssetsRoot ??
                                "Used by $mdFile, $file, and local Markdown images"}
                            </span>
                          </div>
                          <div className="file-picker-actions">
                            {templateAssetsRoot ? (
                              <button
                                className="icon-button"
                                type="button"
                                aria-label="Clear referenced files folder"
                                disabled={busy}
                                onClick={() => setTemplateAssetsRoot(null)}
                              >
                                ×
                              </button>
                            ) : null}
                            <button
                              className="secondary-button compact"
                              type="button"
                              disabled={busy}
                              onClick={() => void chooseTemplateAssetsRoot()}
                            >
                              <FolderOpen size={17} />
                              {templateAssetsRoot ? "Change" : "Choose folder"}
                            </button>
                          </div>
                        </div>
                        {markdown && model ? (
                          <div className="inline-advice">
                            The selected Markdown supplies <code>ds.Body</code>.
                            Do not also define <code>data.ds.Body</code> in JSON:
                            an explicit JSON value takes precedence.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                <div className="workflow-divider">
                  <ChevronRight size={16} />
                </div>

                <div className="workflow-step">
                  <span className="step-number">3</span>
                  <div className="step-content">
                    <div className="step-heading">
                      <div>
                        <h2>Save the Word document</h2>
                        <p>
                          Existing files are protected unless overwrite is
                          explicitly enabled.
                        </p>
                      </div>
                    </div>
                    <FilePicker
                      label="DOCX output"
                      description="Choose a destination for the generated document"
                      value={wordOutput}
                      acceptLabel="Choose output"
                      output
                      disabled={busy}
                      onPick={chooseWordOutput}
                      onClear={() => setWordOutput(null)}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="workflow extract-workflow">
              <div className="workflow-step">
                <span className="step-number">1</span>
                <div className="step-content">
                  <div className="step-heading">
                    <div>
                      <h2>Choose the Word document</h2>
                      <p>
                        Headings, emphasis, links, lists, tables, code, and
                        embedded images are extracted semantically.
                      </p>
                    </div>
                  </div>
                  <FilePicker
                    label="DOCX source"
                    description="A macro-free .docx document"
                    value={sourceDocument}
                    acceptLabel="Choose document"
                    disabled={busy}
                    onPick={chooseSourceDocument}
                    onClear={() => setSourceDocument(null)}
                  />
                </div>
              </div>

              <div className="workflow-divider">
                <ChevronRight size={16} />
              </div>

              <div className="workflow-step">
                <span className="step-number">2</span>
                <div className="step-content">
                  <div className="step-heading">
                    <div>
                      <h2>Choose the Markdown output</h2>
                      <p>
                        Embedded images go into a companion assets folder and
                        use portable relative paths.
                      </p>
                    </div>
                  </div>
                  <div className="stacked-pickers">
                    <FilePicker
                      label="Markdown output"
                      description="Choose where the extracted .md file should be saved"
                      value={markdownOutput}
                      acceptLabel="Choose output"
                      output
                      disabled={busy}
                      onPick={chooseMarkdownOutput}
                      onClear={() => setMarkdownOutput(null)}
                    />
                    <div className="directory-picker">
                      <div className="file-picker-icon" aria-hidden="true">
                        <FolderOpen size={21} />
                      </div>
                      <div className="file-picker-copy">
                        <div className="file-picker-title">
                          <span>Image assets folder</span>
                          <span className="optional-badge">Optional</span>
                        </div>
                        <span
                          className={
                            assetsDirectory
                              ? "file-path selected-directory"
                              : "file-picker-description"
                          }
                          title={assetsDirectory ?? undefined}
                        >
                          {assetsDirectory ??
                            "Defaults to <output-name>.assets beside Markdown"}
                        </span>
                      </div>
                      <button
                        className="secondary-button compact"
                        type="button"
                        disabled={busy}
                        onClick={() => void chooseAssetsDirectory()}
                      >
                        <FolderOpen size={17} />
                        {assetsDirectory ? "Change" : "Choose folder"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="options-bar">
            <details>
              <summary>
                <Settings2 size={17} />
                Conversion options
              </summary>
              <div className="options-grid">
                {workspace === "create" ? (
                  <>
                    <label>
                      <span>Heading offset</span>
                      <select
                        value={headingOffset}
                        disabled={busy}
                        onChange={(event) =>
                          setHeadingOffset(Number(event.target.value))
                        }
                      >
                        <option value={0}>Keep heading levels</option>
                        <option value={1}>Shift down by 1</option>
                        <option value={2}>Shift down by 2</option>
                      </select>
                    </label>
                    {createMode === "quick" ? (
                      <label className="check-option">
                        <input
                          type="checkbox"
                          checked={includeToc}
                          disabled={busy}
                          onChange={(event) =>
                            setIncludeToc(event.target.checked)
                          }
                        />
                        <span>
                          <strong>Include Word table of contents</strong>
                          <small>Word updates it when the document opens</small>
                        </span>
                      </label>
                    ) : (
                      <label className="check-option">
                        <input
                          type="checkbox"
                          checked={strictTemplate}
                          disabled={busy}
                          onChange={(event) =>
                            setStrictTemplate(event.target.checked)
                          }
                        />
                        <span>
                          <strong>Require every template placeholder</strong>
                          <small>
                            Leave off to remove intentionally empty optional
                            fields
                          </small>
                        </span>
                      </label>
                    )}
                    <label className="check-option">
                      <input
                        type="checkbox"
                        checked={validateOutput}
                        disabled={busy}
                        onChange={(event) =>
                          setValidateOutput(event.target.checked)
                        }
                      />
                      <span>
                        <strong>Validate generated DOCX</strong>
                        <small>Recommended before sharing a document</small>
                      </span>
                    </label>
                  </>
                ) : null}
                <label className="check-option danger-option">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    disabled={busy}
                    onChange={(event) => setOverwrite(event.target.checked)}
                  />
                  <span>
                    <strong>Allow replacing output files</strong>
                    <small>Source documents are never modified</small>
                  </span>
                </label>
              </div>
            </details>
          </div>

          <footer className="action-footer">
            <StatusPanel status={status} onOpenLogs={() => void showLogs()} />
            <button
              className="primary-button"
              type="button"
              disabled={busy}
              onClick={() => void execute()}
            >
              {busy ? <RefreshCw className="spin" size={19} /> : null}
              {actionLabel}
              {!busy ? <ArrowRight size={19} /> : null}
            </button>
          </footer>
        </section>

        <footer className="app-footer">
          <span>
            Powered by{" "}
            <button
              className="footer-link"
              type="button"
              onClick={() => void showProject("engine")}
            >
              Akode.DocxGen
            </button>{" "}
            · Offline by default
          </span>
          <button
            className="footer-link"
            type="button"
            title={logInfo?.filePath ?? "Local diagnostic log"}
            onClick={() => void showLogs()}
          >
            Open logs
          </button>
          <button
            className="footer-link"
            type="button"
            onClick={() => void showProject("desktop")}
          >
            Source &amp; issues
          </button>
          <span>DOCX extraction preserves meaning, not page geometry.</span>
        </footer>
      </main>
      {showTemplateHelp ? (
        <TemplateHelpDialog onClose={() => setShowTemplateHelp(false)} />
      ) : null}
    </div>
  );
}

function bridgeErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return detail.trim().length > 0
    ? `${detail} Your source files were not modified.`
    : "Restart DocxGen UI and try again. Your source files were not modified.";
}

export default App;
