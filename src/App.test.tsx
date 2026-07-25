import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { runBackend } from "./lib/backend";

vi.mock("./lib/backend", () => ({
  runBackend: vi.fn(),
}));

vi.mock("./lib/files", () => ({
  pickFile: vi.fn(),
  pickDirectory: vi.fn(),
  pickOutput: vi.fn(),
  suggestedOutput: vi.fn(),
  toSelectedFile: vi.fn(),
}));

const mockedRunBackend = vi.mocked(runBackend);

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRunBackend.mockResolvedValue({
      ok: true,
      operation: "health",
      message: "Ready",
      hint: null,
      errorCode: null,
      outputPath: null,
      durationMilliseconds: 0,
      diagnostics: [],
      data: {
        backendVersion: "0.1.0",
        docxGenVersion: "2.1.1",
        runtime: ".NET 10",
        operatingSystem: "Test",
      },
    });
  });

  it("presents the two conversion directions and runtime status", async () => {
    render(<App />);

    expect(
      screen.getByRole("button", { name: /Markdown → Word/u }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Word → Markdown/u }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Quick conversion/u }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Template document/u }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Core 2.1.1")).toBeInTheDocument();
    });
  });

  it("guides an incomplete extraction instead of invoking the backend", async () => {
    render(<App />);
    await waitFor(() => expect(mockedRunBackend).toHaveBeenCalledTimes(1));

    fireEvent.click(
      screen.getByRole("button", { name: /Word → Markdown/u }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Extract Markdown" }),
    );

    expect(
      screen.getByText("Choose the Word document to extract."),
    ).toBeInTheDocument();
    expect(mockedRunBackend).toHaveBeenCalledTimes(1);
  });
});
