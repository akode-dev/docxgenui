import { open, save } from "@tauri-apps/plugin-dialog";
import type { SelectedFile } from "../types";

interface FileType {
  name: string;
  extensions: string[];
}

export async function pickFile(
  title: string,
  fileType: FileType,
): Promise<SelectedFile | null> {
  const selected = await open({
    title,
    multiple: false,
    directory: false,
    filters: [fileType],
  });
  return typeof selected === "string" ? toSelectedFile(selected) : null;
}

export async function pickDirectory(title: string): Promise<string | null> {
  const selected = await open({
    title,
    multiple: false,
    directory: true,
  });
  return typeof selected === "string" ? selected : null;
}

export async function pickOutput(
  title: string,
  fileType: FileType,
  defaultPath?: string,
): Promise<SelectedFile | null> {
  const options = {
    title,
    filters: [fileType],
    ...(defaultPath === undefined ? {} : { defaultPath }),
  };
  const selected = await save(options);
  return typeof selected === "string" ? toSelectedFile(selected) : null;
}

export function toSelectedFile(path: string): SelectedFile {
  const normalized = path.replaceAll("\\", "/");
  return {
    path,
    name: normalized.split("/").pop() ?? path,
  };
}

export function suggestedOutput(
  source: SelectedFile | null,
  extension: "docx" | "md" | "model.json",
): string | undefined {
  if (source === null) {
    return undefined;
  }

  const normalized = source.path.replaceAll("\\", "/");
  const separatorIndex = normalized.lastIndexOf("/");
  const directory =
    separatorIndex >= 0 ? source.path.slice(0, separatorIndex + 1) : "";
  const baseName = source.name.replace(/\.[^.]+$/u, "");
  return `${directory}${baseName}.${extension}`;
}
