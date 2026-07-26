use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    sync::Mutex,
    time::{Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::ShellExt;

const ALLOWED_OPERATIONS: [&str; 5] = ["health", "inspect", "convert", "render", "extract"];
const LOG_FILE_NAME: &str = "docxgen-ui.log";
const PREVIOUS_LOG_FILE_NAME: &str = "docxgen-ui.previous.log";
const MAX_LOG_BYTES: u64 = 1024 * 1024;
static LOG_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendRequest {
    operation: String,
    payload: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LogInfo {
    file_path: String,
    directory_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OperationLog {
    timestamp_unix_ms: u64,
    level: &'static str,
    event: &'static str,
    operation: String,
    success: bool,
    duration_ms: u64,
    error_code: Option<String>,
    diagnostic_codes: Vec<String>,
}

#[tauri::command]
async fn run_backend(app: AppHandle, request: BackendRequest) -> Result<Value, String> {
    let operation = request.operation.clone();
    let started = Instant::now();
    let result = run_backend_inner(&app, request).await;
    let (success, error_code, diagnostic_codes) = match &result {
        Ok(response) => response_summary(response),
        Err(_) => (false, Some("DESKTOP-BRIDGE".to_owned()), Vec::new()),
    };
    let entry = OperationLog {
        timestamp_unix_ms: unix_timestamp_ms(),
        level: if success { "information" } else { "error" },
        event: "backend-operation",
        operation,
        success,
        duration_ms: elapsed_milliseconds(started),
        error_code,
        diagnostic_codes,
    };
    let _ = append_log(&app, &entry);
    result
}

async fn run_backend_inner(app: &AppHandle, request: BackendRequest) -> Result<Value, String> {
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

#[tauri::command]
fn get_log_info(app: AppHandle) -> Result<LogInfo, String> {
    let file = ensure_log_file(&app)?;
    let directory = file
        .parent()
        .ok_or_else(|| "The application log directory could not be resolved.".to_owned())?;
    Ok(LogInfo {
        file_path: file.to_string_lossy().into_owned(),
        directory_path: directory.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn open_log_folder(app: AppHandle) -> Result<(), String> {
    let file = ensure_log_file(&app)?;
    let directory = file
        .parent()
        .ok_or_else(|| "The application log directory could not be resolved.".to_owned())?;
    app.opener()
        .open_path(directory.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|error| format!("Could not open the application log directory: {error}"))
}

#[tauri::command]
fn open_project_page(app: AppHandle, project: String) -> Result<(), String> {
    let url =
        project_url(&project).ok_or_else(|| format!("Unsupported project link '{project}'."))?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| format!("Could not open the project page: {error}"))
}

fn project_url(project: &str) -> Option<&'static str> {
    match project {
        "engine" => Some("https://github.com/akode-dev/docxgen"),
        "desktop" => Some("https://github.com/akode-dev/docxgenui"),
        _ => None,
    }
}

fn response_summary(response: &Value) -> (bool, Option<String>, Vec<String>) {
    let success = response.get("ok").and_then(Value::as_bool).unwrap_or(false);
    let error_code = response
        .get("errorCode")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let diagnostic_codes = response
        .get("diagnostics")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|diagnostic| diagnostic.get("code").and_then(Value::as_str))
        .map(ToOwned::to_owned)
        .collect();
    (success, error_code, diagnostic_codes)
}

fn ensure_log_file(app: &AppHandle) -> Result<PathBuf, String> {
    let path = log_path(app)?;
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| format!("Could not create the application log: {error}"))?;
    Ok(path)
}

fn log_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_log_dir()
        .map_err(|error| format!("Could not resolve the application log directory: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create the application log directory: {error}"))?;
    Ok(directory.join(LOG_FILE_NAME))
}

fn append_log(app: &AppHandle, entry: &OperationLog) -> Result<(), String> {
    let _guard = LOG_LOCK
        .lock()
        .map_err(|_| "The application log lock is unavailable.".to_owned())?;
    let path = log_path(app)?;
    let mut encoded = serde_json::to_vec(entry)
        .map_err(|error| format!("Could not serialize the application log entry: {error}"))?;
    encoded.push(b'\n');
    rotate_log_if_needed(&path, encoded.len() as u64)?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| format!("Could not open the application log: {error}"))?;
    file.write_all(&encoded)
        .map_err(|error| format!("Could not write the application log: {error}"))
}

fn rotate_log_if_needed(path: &PathBuf, incoming_bytes: u64) -> Result<(), String> {
    let size = match fs::metadata(path) {
        Ok(metadata) => metadata.len(),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Could not inspect the application log: {error}")),
    };
    if size.saturating_add(incoming_bytes) <= MAX_LOG_BYTES {
        return Ok(());
    }

    let previous = path.with_file_name(PREVIOUS_LOG_FILE_NAME);
    if previous.exists() {
        fs::remove_file(&previous)
            .map_err(|error| format!("Could not rotate the previous application log: {error}"))?;
    }
    fs::rename(path, previous)
        .map_err(|error| format!("Could not rotate the application log: {error}"))
}

fn unix_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn elapsed_milliseconds(started: Instant) -> u64 {
    started.elapsed().as_millis().try_into().unwrap_or(u64::MAX)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            run_backend,
            get_log_info,
            open_log_folder,
            open_project_page
        ])
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

    #[test]
    fn project_links_are_fixed_and_unknown_values_are_rejected() {
        assert_eq!(
            project_url("engine"),
            Some("https://github.com/akode-dev/docxgen")
        );
        assert_eq!(
            project_url("desktop"),
            Some("https://github.com/akode-dev/docxgenui")
        );
        assert_eq!(project_url("https://example.com"), None);
    }

    #[test]
    fn response_summary_contains_codes_but_not_document_data() {
        let response = serde_json::json!({
            "ok": false,
            "errorCode": "E-EXT-001",
            "outputPath": "C:\\Users\\Example\\private.md",
            "diagnostics": [
                {
                    "code": "W-EXT-002",
                    "message": "Private document content"
                }
            ]
        });

        let summary = response_summary(&response);

        assert!(!summary.0);
        assert_eq!(summary.1.as_deref(), Some("E-EXT-001"));
        assert_eq!(summary.2, vec!["W-EXT-002"]);
    }

    #[test]
    fn full_log_rotates_to_one_previous_file() {
        let directory = std::env::temp_dir().join(format!(
            "docxgen-ui-log-test-{}-{}",
            std::process::id(),
            unix_timestamp_ms()
        ));
        fs::create_dir(&directory).expect("create isolated log test directory");
        let current = directory.join(LOG_FILE_NAME);
        fs::write(&current, vec![b'x'; MAX_LOG_BYTES as usize]).expect("write isolated test log");

        rotate_log_if_needed(&current, 1).expect("rotate full test log");

        assert!(!current.exists());
        let previous = directory.join(PREVIOUS_LOG_FILE_NAME);
        assert!(previous.exists());

        fs::remove_file(previous).expect("remove isolated test log");
        fs::remove_dir(directory).expect("remove isolated log test directory");
    }
}
