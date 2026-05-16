pub mod commands;
pub mod error;
pub mod models;
pub mod secure_storage;
pub mod services;

use std::collections::HashMap;
use std::sync::Mutex;

use commands::auth::{
  auth_begin_microsoft_device_login, auth_get_status, auth_logout_microsoft,
  auth_poll_microsoft_device_login, microsoft_login, AuthState,
};
use commands::instance::create_instance;

pub fn run() {
  let _ = keyring::use_native_store(false);

  tauri::Builder::default()
    .manage(AuthState {
      sessions: Mutex::new(HashMap::new()),
    })
    .invoke_handler(tauri::generate_handler![
      create_instance,
      microsoft_login,
      auth_get_status,
      auth_begin_microsoft_device_login,
      auth_poll_microsoft_device_login,
      auth_logout_microsoft,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
