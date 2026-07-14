mod serial;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![
      serial::fc_serial_list_ports,
      serial::fc_serial_open,
      serial::fc_serial_write,
      serial::fc_serial_read,
      serial::fc_serial_close,
    ])
    .setup(|app| {
      // Self-update from GitHub Releases (desktop only; mobile uses app stores).
      #[cfg(desktop)]
      app
        .handle()
        .plugin(tauri_plugin_updater::Builder::new().build())?;

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
