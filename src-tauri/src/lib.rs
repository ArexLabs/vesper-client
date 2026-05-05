// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod error;
pub mod models;
pub mod services;
pub mod commands;

use commands::instance::create_instance;
use commands::auth::microsoft_login;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            create_instance,
            microsoft_login
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
