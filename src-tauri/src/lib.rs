use std::fs;
use std::path::PathBuf;

use tauri::Manager;
use tauri_plugin_log::{Builder as LogBuilder, Target, TargetKind};
use log::LevelFilter;

#[tauri::command]
fn import_project_cover(
  app: tauri::AppHandle,
  project_id: String,
  source_path: String,
) -> Result<String, String> {
  // appDataDir (уже app-specific)
  let mut base: PathBuf = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?;

  // твой ROOT_DIR = "ficwriter"
  base.push("ficwriter");
  base.push("projects");
  base.push(&project_id);
  base.push("assets");

  fs::create_dir_all(&base).map_err(|e| e.to_string())?;

  // расширение
  let ext = source_path
    .rsplit('.')
    .next()
    .unwrap_or("png")
    .to_lowercase();

  let filename = format!("cover.{}", ext);
  let mut dest = base.clone();
  dest.push(&filename);

  fs::copy(&source_path, &dest).map_err(|e| e.to_string())?;

  // вернуть rel путь как в твоём проекте
  Ok(format!("assets/{}", filename))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(
      LogBuilder::new()
        .level(LevelFilter::Info)
        .targets([
          Target::new(TargetKind::LogDir { file_name: None }),
          Target::new(TargetKind::Webview),
          Target::new(TargetKind::Stdout),
        ])
        .build(),
    )
    .invoke_handler(tauri::generate_handler![import_project_cover])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
