use crate::services::downloader::Downloader;
use crate::services::mod_resolver::resolve_sodium_version;
use tauri::command;

#[command]
pub async fn create_instance(
    name: String,
    game_version: String,
    loader: String,
    include_sodium: bool,
) -> Result<(), String> {
    let home_dir = dirs::home_dir().ok_or("Failed to resolve home directory")?;
    let instance_dir = home_dir.join(".vesper").join("instances").join(&name);

    std::fs::create_dir_all(&instance_dir).map_err(|e| e.to_string())?;

    if include_sodium {
        match resolve_sodium_version(&game_version, &loader).await {
            Ok(sodium_file) => {
                let mods_dir = instance_dir.join("mods");
                match Downloader::download(&sodium_file.url, &mods_dir, true).await {
                    Ok(_) => tracing::info!("Sodium installed to {:?}", mods_dir),
                    Err(e) => tracing::warn!("Sodium installation failed: {}", e),
                }
            }
            Err(e) => tracing::warn!("Failed to resolve Sodium version: {}", e),
        }
    }

    Ok(())
}
