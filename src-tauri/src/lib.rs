pub mod commands;
pub mod error;
pub mod models;
pub mod secure_storage;
pub mod services;

use commands::auth::microsoft_login;
use commands::instance::create_instance;

pub fn run() {
    let _ = keyring::use_native_store(false);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![create_instance, microsoft_login])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
