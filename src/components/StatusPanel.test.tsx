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
