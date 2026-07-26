import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateReadiness } from "./TemplateReadiness";
import type { BackendResponse, InspectionData, PreflightData } from "../types";

const inspection: InspectionData = {
  templateHash: "sha256:test",
  templateId: "handbook",
  templateVersion: "1.0.0",
  placeholders: [
    {
      path: "ds.Body",
      kind: "Markdown",
      formatter: "MD",
      formatterArguments: null,
      required: false,
      locations: ["main"],
    },
    {
      path: "ds.Document.Title",
      kind: "Text",
      formatter: null,
      formatterArguments: null,
      required: true,
      locations: ["main"],
    },
  ],
  requiredStyles: [],
  unsupportedForStaticAnalysis: [],
};

describe("TemplateReadiness", () => {
  it("shows all missing required paths and model actions", () => {
    const choose = vi.fn();
    const create = vi.fn();
    const response: BackendResponse<PreflightData> = {
      ok: false,
      operation: "preflight",
      message: "1 template field is required for this render.",
      hint: "Add the value.",
      errorCode: "E-MDL-003",
      outputPath: null,
      durationMilliseconds: 12,
      diagnostics: [
        {
          code: "E-MDL-003",
          severity: "error",
          message: "Missing",
          hint: "Add it",
          path: "/data/ds/Document/Title",
        },
      ],
      data: null,
    };

    render(
      <TemplateReadiness
        inspection={inspection}
        response={response}
        busy={false}
        bridgeError={null}
        hasInputs
        disabled={false}
        onChooseModel={choose}
        onCreateModel={create}
      />,
    );

    expect(
      screen.getByText("1 required template field is missing."),
    ).toBeInTheDocument();
    expect(screen.getByText("ds.Document.Title")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Choose JSON model" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create model from template" }),
    );
    expect(choose).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
  });

  it("explains that optional values may remain empty", () => {
    const response: BackendResponse<PreflightData> = {
      ok: true,
      operation: "preflight",
      message: "Template inputs are ready.",
      hint: null,
      errorCode: null,
      outputPath: null,
      durationMilliseconds: 10,
      diagnostics: [],
      data: {
        templateHash: "sha256:test",
        boundPaths: ["ds.Body"],
        unboundPaths: ["ds.Document.Description"],
      },
    };

    render(
      <TemplateReadiness
        inspection={inspection}
        response={response}
        busy={false}
        bridgeError={null}
        hasInputs
        disabled={false}
        onChooseModel={vi.fn()}
        onCreateModel={vi.fn()}
      />,
    );

    expect(screen.getByText("Template inputs are ready.")).toBeInTheDocument();
    expect(
      screen.getByText("1 optional field will be left empty."),
    ).toBeInTheDocument();
  });
});
