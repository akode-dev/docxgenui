import { invoke } from "@tauri-apps/api/core";
import type {
  BackendRequest,
  BackendResponse,
  LogInfo,
  Operation,
} from "../types";

export async function runBackend<TData>(
  operation: Operation,
  payload: Record<string, unknown> = {},
): Promise<BackendResponse<TData>> {
  const request: BackendRequest = { operation, payload };
  return invoke<BackendResponse<TData>>("run_backend", { request });
}

export async function getLogInfo(): Promise<LogInfo> {
  return invoke<LogInfo>("get_log_info");
}

export async function openLogFolder(): Promise<void> {
  return invoke<void>("open_log_folder");
}

export async function openProjectPage(
  project: "engine" | "desktop",
): Promise<void> {
  return invoke<void>("open_project_page", { project });
}
