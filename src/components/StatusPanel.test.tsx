import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { StatusPanel } from "./StatusPanel";

it("shows error codes, diagnostics, and a local log action", () => {
  const openLogs = vi.fn();
  render(
    <StatusPanel
      onOpenLogs={openLogs}
      status={{
        kind: "result",
        result: {
          ok: false,
          operation: "extract",
          message: "DOCX extraction failed.",
          hint: "Review the diagnostics.",
          errorCode: "E-EXT-001",
          outputPath: null,
          durationMilliseconds: 812,
          diagnostics: [
            {
              code: "E-EXT-001",
              severity: "error",
              message: "The DOCX document could not be extracted.",
              hint: "Use a valid DOCX.",
              path: "/word/document.xml",
            },
          ],
          data: null,
        },
      }}
    />,
  );

  expect(screen.getByText("Error code: E-EXT-001")).toBeInTheDocument();
  expect(
    screen.getByText("The DOCX document could not be extracted."),
  ).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "Open diagnostic logs" }),
  );
  expect(openLogs).toHaveBeenCalledOnce();
});

it("groups repeated extraction warnings and explains that output was created", () => {
  render(
    <StatusPanel
      onOpenLogs={vi.fn()}
      status={{
        kind: "result",
        result: {
          ok: true,
          operation: "extract",
          message: "Markdown and embedded images extracted.",
          hint: null,
          errorCode: null,
          outputPath: "document.md",
          durationMilliseconds: 400,
          diagnostics: [
            {
              code: "W-EXT-003",
              severity: "warning",
              message: "The Word field 'PAGEREF first' was omitted.",
              hint: "No action is required.",
              path: null,
            },
            {
              code: "W-EXT-003",
              severity: "warning",
              message: "The Word field 'PAGEREF second' was omitted.",
              hint: "No action is required.",
              path: null,
            },
          ],
          data: null,
        },
      }}
    />,
  );

  fireEvent.click(screen.getByText("2 warnings · 1 type"));

  expect(screen.getByText("×2")).toBeInTheDocument();
  expect(
    screen.getByText(/table-of-contents page references/u),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/The output was created/u),
  ).toBeInTheDocument();
});
