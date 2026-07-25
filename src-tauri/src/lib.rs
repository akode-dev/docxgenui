use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

const ALLOWED_OPERATIONS: [&str; 5] = ["health", "inspect", "convert", "render", "extract"];

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendRequest {
    operation: String,
    payload: Value,
}

#[tauri::command]
async fn run_backend(app: AppHandle, request: BackendRequest) -> Result<Value, String> {
    if !ALLOWED_OPERATIONS.contains(&request.operation.as_str()) {
        return Err(format!(
            "Unsupported backend operation '{}'.",
            request.operation
        ));
    }

    let encoded = URL_SAFE_NO_PAD.encode(
        serde_json::to_vec(&request)
            .map_err(|error| format!("Could not serialize the backend request: {error}"))?,
    );

    let output = app
        .shell()
        .sidecar("docxgen-ui-backend")
        .map_err(|error| format!("Could not locate the DocxGen backend: {error}"))?
        .args(["--request", &encoded])
        .output()
        .await
        .map_err(|error| format!("Could not start the DocxGen backend: {error}"))?;

    let stdout = String::from_utf8(output.stdout)
        .map_err(|_| "The DocxGen backend returned invalid UTF-8.".to_owned())?;
    let response: Value = serde_json::from_str(stdout.trim()).map_err(|error| {
        let stderr = String::from_utf8_lossy(&output.stderr);
        format!(
            "The DocxGen backend returned an invalid response: {error}. {}",
            stderr.trim()
        )
    })?;

    Ok(response)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![run_backend])
        .run(tauri::generate_context!())
        .expect("error while running DocxGen UI");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn supported_operations_are_explicit_and_unique() {
        let mut operations = ALLOWED_OPERATIONS.to_vec();
        operations.sort_unstable();
        operations.dedup();

        assert_eq!(operations.len(), 5);
        assert!(operations.contains(&"convert"));
        assert!(operations.contains(&"extract"));
    }
}
