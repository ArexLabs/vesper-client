pub mod commands;
pub mod entra_config;
pub mod error;
pub mod models;
pub mod secure_storage;
pub mod services;

use std::collections::HashMap;
use std::sync::Mutex;

use commands::auth::{
  auth_begin_microsoft_device_login, auth_cancel_device_login, auth_get_status,
  auth_logout_microsoft, auth_poll_microsoft_device_login, auth_refresh_token, microsoft_login,
  AuthState,
};
use commands::instance::{create_instance, launch_instance};
use entra_config::EntraConfig;

pub fn run() {
  let _ = dotenvy::dotenv();
  let _ = keyring::use_native_store(false);

  let entra_config = EntraConfig::from_env();

  tauri::Builder::default()
    .manage(AuthState {
      sessions: Mutex::new(HashMap::new()),
    })
    .manage(entra_config)
    .invoke_handler(tauri::generate_handler![
      create_instance,
      launch_instance,
      microsoft_login,
      auth_get_status,
      auth_begin_microsoft_device_login,
      auth_poll_microsoft_device_login,
      auth_cancel_device_login,
      auth_refresh_token,
      auth_logout_microsoft,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
