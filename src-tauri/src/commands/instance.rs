use crate::commands::auth::{get_stored_access_token, get_stored_profile};
use crate::services::minecraft::{self, LaunchInput, LaunchOutput};
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
    match crate::services::mod_resolver::resolve_sodium_version(&game_version, &loader).await {
      Ok(sodium_file) => {
        let mods_dir = instance_dir.join("mods");
        match crate::services::downloader::Downloader::download(&sodium_file.url, &mods_dir, true)
          .await
        {
          Ok(_) => tracing::info!("Sodium installed to {:?}", mods_dir),
          Err(e) => tracing::warn!("Sodium installation failed: {}", e),
        }
      }
      Err(e) => tracing::warn!("Failed to resolve Sodium version: {}", e),
    }
  }

  Ok(())
}

#[command]
pub async fn launch_instance(
  instance_id: String,
  input: LaunchInput,
) -> Result<LaunchOutput, String> {
  let access_token = get_stored_access_token();

  match access_token {
    Some(token) => {
      // Logged in — launch Minecraft
      let profile = get_stored_profile()
        .ok_or_else(|| "No Microsoft profile found. Please re-authenticate.".to_string())?;

      let minecraft_username = profile
        .minecraft_username
        .clone()
        .ok_or_else(|| {
          "No Minecraft username found. Make sure you own Minecraft and have signed in."
            .to_string()
        })?;

      let player_uuid = profile.id.clone();

      minecraft::prepare_and_launch(input, &token, &minecraft_username, &player_uuid).await
    }
    None => {
      // Not logged in — launch a simple process that prints the message
      let message = "You are not logged into your Microsoft Account. Minecraft won't launch! heh";
      let preview = vec![
        "echo".to_string(),
        message.to_string(),
      ];

      launch_message_process(message)?;

      Ok(LaunchOutput {
        status: "launcher-opened".to_string(),
        instance_id,
        command_preview: preview,
        note: message.to_string(),
      })
    }
  }
}

fn launch_message_process(message: &str) -> Result<(), String> {
  let result = if cfg!(target_os = "windows") {
    // Windows: use PowerShell for a message box
    std::process::Command::new("powershell")
      .args([
        "-Command",
        &format!(
          "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('{}')",
          message.replace('\'', "''")
        ),
      ])
      .stdout(std::process::Stdio::null())
      .stderr(std::process::Stdio::null())
      .spawn()
  } else if cfg!(target_os = "macos") {
    // macOS: use osascript dialog
    std::process::Command::new("osascript")
      .args([
        "-e",
        &format!("display dialog \"{}\" buttons {{\"OK\"}} default button \"OK\"", message),
      ])
      .stdout(std::process::Stdio::null())
      .stderr(std::process::Stdio::null())
      .spawn()
  } else {
    // Linux: try zenity, then xmessage, then notify-send
    let mut result = std::process::Command::new("zenity")
      .args(["--info", "--text", message])
      .stdout(std::process::Stdio::null())
      .stderr(std::process::Stdio::null())
      .spawn();

    if result.is_err() {
      result = std::process::Command::new("xmessage")
        .args([message])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();
    }

    result
  };

  match result {
    Ok(_) => Ok(()),
    Err(e) => {
      // Fallback: just log the message
      tracing::warn!("Could not show dialog ({}): {}", e, message);
      eprintln!("{}", message);
      Ok(())
    }
  }
}
