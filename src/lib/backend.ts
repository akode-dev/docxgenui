import { invoke } from "@tauri-apps/api/core";
import type {
  BackendRequest,
  BackendResponse,
  Operation,
} from "../types";

export async function runBackend<TData>(
  operation: Operation,
  payload: Record<string, unknown> = {},
): Promise<BackendResponse<TData>> {
  const request: BackendRequest = { operation, payload };
  return invoke<BackendResponse<TData>>("run_backend", { request });
}
