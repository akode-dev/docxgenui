import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import {
  getLogInfo,
  openLogFolder,
  openProjectPage,
  runBackend,
} from "./lib/backend";

vi.mock("./lib/backend", () => ({
  getLogInfo: vi.fn(),
  openLogFolder: vi.fn(),
  openProjectPage: vi.fn(),
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
const mockedGetLogInfo = vi.mocked(getLogInfo);
const mockedOpenLogFolder = vi.mocked(openLogFolder);
const mockedOpenProjectPage = vi.mocked(openProjectPage);

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetLogInfo.mockResolvedValue({
      filePath: "C:\\Logs\\docxgen-ui.log",
      directoryPath: "C:\\Logs",
    });
    mockedOpenLogFolder.mockResolvedValue();
    mockedOpenProjectPage.mockResolvedValue();
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
        backendVersion: "0.1.1",
        docxGenVersion: "2.2.0",
        runtime: ".NET 10",
        operatingSystem: "Test",
      },
    });
  });

  it("presents the two conversion directions and runtime status", async () => {
    render(<App />);

    expect(screen.getByText("Local & private")).toBeInTheDocument();
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
      expect(screen.getByText("Core 2.2.0")).toBeInTheDocument();
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

  it("opens local logs and the DocxGen engine page through fixed native commands", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open logs" }));
    fireEvent.click(screen.getByRole("button", { name: "Akode.DocxGen" }));

    await waitFor(() => {
      expect(mockedOpenLogFolder).toHaveBeenCalledOnce();
      expect(mockedOpenProjectPage).toHaveBeenCalledWith("engine");
    });
  });

  it("explains template placeholders without leaving the workflow", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /Template document/u }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Template field guide" }),
    );

    expect(
      screen.getByRole("dialog", { name: "What to put in a Word template" }),
    ).toBeInTheDocument();
    expect(screen.getByText("{{ds.Body}:MD}")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Require every template placeholder/u),
    ).not.toHaveLength(0);
  });
});
