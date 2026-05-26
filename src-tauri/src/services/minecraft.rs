use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchInput {
  pub instance_id: String,
  pub name: String,
  pub mc_version: String,
  pub loader: String,
  pub java_path: String,
  pub memory_mb_min: u32,
  pub memory_mb_max: u32,
  pub jvm_args: Vec<String>,
  pub window_width: u32,
  pub window_height: u32,
  pub fullscreen: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchOutput {
  pub status: String,
  pub instance_id: String,
  pub command_preview: Vec<String>,
  pub note: String,
}

// ---------------------------------------------------------------------------
// Mojang metadata types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct VersionManifest {
  versions: Vec<ManifestVersion>,
}

#[derive(Deserialize)]
struct ManifestVersion {
  id: String,
  url: String,
}

#[derive(Deserialize)]
struct VersionMeta {
  #[serde(rename = "assetIndex")]
  asset_index: AssetIndex,
  downloads: VersionDownloads,
  libraries: Vec<Library>,
  #[serde(rename = "mainClass")]
  main_class: String,
  #[serde(rename = "minecraftArguments")]
  minecraft_arguments: Option<String>,
  arguments: Option<ArgsStructure>,
}

#[derive(Deserialize)]
struct AssetIndex {
  id: String,
  url: String,
}

#[derive(Deserialize)]
struct VersionDownloads {
  client: DownloadEntry,
}

#[derive(Deserialize)]
struct DownloadEntry {
  url: String,
}

#[derive(Deserialize)]
struct Library {
  name: String,
  downloads: Option<LibraryDownloads>,
  rules: Option<Vec<Rule>>,
}

#[derive(Deserialize)]
struct LibraryDownloads {
  artifact: Option<Artifact>,
  classifiers: Option<HashMap<String, Artifact>>,
}

#[derive(Deserialize)]
struct Artifact {
  path: String,
  url: String,
}

#[derive(Deserialize)]
struct Rule {
  action: String,
  os: Option<OsRule>,
}

#[derive(Deserialize)]
struct OsRule {
  name: Option<String>,
  arch: Option<String>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum ArgEntry {
  String(String),
  RuleArg {
    rules: Option<Vec<Rule>>,
    value: ArgValue,
  },
}

#[derive(Deserialize)]
#[serde(untagged)]
enum ArgValue {
  String(String),
  Array(Vec<String>),
}

#[derive(Deserialize)]
struct ArgsStructure {
  game: Option<Vec<ArgEntry>>,
  jvm: Option<Vec<ArgEntry>>,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERSION_MANIFEST_URL: &str =
  "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
const ASSETS_BASE_URL: &str = "https://resources.download.minecraft.net";

// ---------------------------------------------------------------------------
// Main launch function
// ---------------------------------------------------------------------------

pub async fn prepare_and_launch(
  input: LaunchInput,
  access_token: &str,
  minecraft_username: &str,
  player_uuid: &str,
) -> Result<LaunchOutput, String> {
  let home = dirs::home_dir().ok_or("No home directory found")?;
  let vesper_dir = home.join(".vesper");
  let instance_dir = vesper_dir.join("instances").join(&sanitize_name(&input.name));

  tokio::fs::create_dir_all(&instance_dir)
    .await
    .map_err(|e| format!("Failed to create instance dir: {}", e))?;

  // 1. Resolve version -> get version metadata URL
  let version_url = resolve_version(&input.mc_version).await?;

  // 2. Download version metadata
  let meta = download_json::<VersionMeta>(&version_url).await?;

  // 3. Setup directories
  let libs_dir = instance_dir.join("libraries");
  let versions_dir = instance_dir.join("versions").join(&input.mc_version);
  let natives_dir = instance_dir.join("natives");
  let assets_dir = vesper_dir.join("assets");
  let assets_objects_dir = assets_dir.join("objects");

  for d in [&libs_dir, &versions_dir, &natives_dir, &assets_objects_dir] {
    tokio::fs::create_dir_all(d)
      .await
      .map_err(|e| format!("Failed to create directory {:?}: {}", d, e))?;
  }

  // 4. Download client jar
  let client_jar = versions_dir.join(format!("{}.jar", input.mc_version));
  if !client_jar.exists() {
    download_file(&meta.downloads.client.url, &client_jar).await?;
  }

  // 5. Download asset index
  let asset_index_path = assets_dir.join("indexes").join(format!("{}.json", meta.asset_index.id));
  tokio::fs::create_dir_all(asset_index_path.parent().unwrap())
    .await
    .map_err(|e| e.to_string())?;
  if !asset_index_path.exists() {
    download_file(&meta.asset_index.url, &asset_index_path).await?;
  }

  // 6. Download libraries and build classpath
  let os_name = current_os_name();
  let arch = current_arch();
  let mut classpath: Vec<PathBuf> = Vec::new();

  for lib in &meta.libraries {
    if let Some(rules) = &lib.rules {
      if !rules_allow(rules, os_name, arch) {
        continue;
      }
    }

    if let Some(dl) = &lib.downloads {
      // Main artifact
      if let Some(artifact) = &dl.artifact {
        let lib_path = libs_dir.join(&artifact.path);
        if !lib_path.exists() {
          tokio::fs::create_dir_all(lib_path.parent().unwrap())
            .await
            .map_err(|e| e.to_string())?;
          download_file(&artifact.url, &lib_path).await?;
        }
        classpath.push(lib_path);
      }

      // Natives
      if let Some(classifiers) = &dl.classifiers {
        let native_key = format!("natives-{}", os_name);
        if let Some(native_artifact) = classifiers.get(&native_key) {
          let native_path = libs_dir.join(&native_artifact.path);
          if !native_path.exists() {
            tokio::fs::create_dir_all(native_path.parent().unwrap())
              .await
              .map_err(|e| e.to_string())?;
            download_file(&native_artifact.url, &native_path).await?;
          }
          extract_native_jar(&native_path, &natives_dir).await?;
        }
      }
    }
  }

  classpath.push(client_jar);

  // 7. Build classpath string
  let cp_separator = if cfg!(target_os = "windows") { ";" } else { ":" };
  let cp_string = classpath
    .iter()
    .map(|p| p.to_string_lossy().to_string())
    .collect::<Vec<_>>()
    .join(cp_separator);

  // 8. Build native dir JVM arg (already extracted)
  let natives_arg = format!(
    "-Djava.library.path={}",
    natives_dir.to_string_lossy()
  );

  // 9. Build full command
  let mut cmd = Vec::new();
  cmd.push(input.java_path.clone());
  cmd.push(format!("-Xms{}M", input.memory_mb_min));
  cmd.push(format!("-Xmx{}M", input.memory_mb_max));
  for arg in &input.jvm_args {
    cmd.push(arg.clone());
  }

  // Add JVM arguments from version meta
  if let Some(args) = &meta.arguments {
    if let Some(jvm) = &args.jvm {
      for entry in jvm {
        let resolved = resolve_arg_entry(entry, os_name, arch);
        if let Some(vals) = resolved {
          for v in vals {
            // Replace tokens in JVM args
            let v = v
              .replace("${natives_directory}", &natives_dir.to_string_lossy().to_string())
              .replace("${library_directory}", &libs_dir.to_string_lossy().to_string())
              .replace("${classpath}", &cp_string)
              .replace("${launcher_name}", "vesper")
              .replace("${launcher_version}", "0.4.2")
              .replace("${classpath_separator}", cp_separator);
            // Skip classpath JVM argument since we handle it ourselves
            if v == "-cp" || v == "-classpath" {
              continue;
            }
            if v.starts_with("-Djava.library.path=") && v != natives_arg {
              cmd.push(natives_arg.clone());
              continue;
            }
            // Handle classpath token in value
            if !v.contains("${classpath}") {
              cmd.push(v);
            }
          }
        }
      }
    }
  }

  cmd.push(natives_arg);
  cmd.push("-cp".to_string());
  cmd.push(cp_string);
  cmd.push(meta.main_class.clone());

  // Minecraft game arguments
  let game_ctx = GameContext {
    username: minecraft_username,
    uuid: player_uuid,
    access_token,
    version: &input.mc_version,
    game_dir: &instance_dir.to_string_lossy(),
    assets_dir: &assets_dir.to_string_lossy(),
    asset_index: &meta.asset_index.id,
    user_type: "msa",
    window_width: Some(input.window_width),
    window_height: Some(input.window_height),
  };

  if let Some(args) = &meta.arguments {
    let game_args = resolve_game_args(&args.game, os_name, arch, &game_ctx);
    cmd.extend(game_args);
  } else if let Some(ref legacy_args) = meta.minecraft_arguments {
    let resolved = resolve_legacy_args(legacy_args, &game_ctx);
    cmd.extend(resolved);
  }

  let preview: Vec<String> = cmd.iter().take(12).cloned().collect();

  // 10. Launch process
  let child = std::process::Command::new(&cmd[0])
    .args(&cmd[1..])
    .stdout(std::process::Stdio::null())
    .stderr(std::process::Stdio::null())
    .spawn()
    .map_err(|e| format!("Failed to launch Minecraft: {}", e))?;

  Ok(LaunchOutput {
    status: "launcher-opened".to_string(),
    instance_id: input.instance_id,
    command_preview: preview,
    note: format!(
      "Minecraft {} launched (PID: {}, username: {})",
      input.mc_version, child.id(), minecraft_username
    ),
  })
}

// ---------------------------------------------------------------------------
// Version resolution
// ---------------------------------------------------------------------------

async fn resolve_version(version_id: &str) -> Result<String, String> {
  let manifest: VersionManifest =
    download_json(VERSION_MANIFEST_URL).await?;

  // First try exact match
  for v in &manifest.versions {
    if v.id == version_id {
      return Ok(v.url.clone());
    }
  }

  // Fallback: try latest release
  if let Some(latest) = manifest.versions.iter().find(|v| v.id == version_id) {
    return Ok(latest.url.clone());
  }

  Err(format!(
    "Minecraft version '{}' not found in manifest",
    version_id
  ))
}

// ---------------------------------------------------------------------------
// OS/arch helpers
// ---------------------------------------------------------------------------

fn current_os_name() -> &'static str {
  match std::env::consts::OS {
    "linux" => "linux",
    "macos" => "osx",
    "windows" => "windows",
    other => other,
  }
}

fn current_arch() -> &'static str {
  match std::env::consts::ARCH {
    "x86_64" => "x86_64",
    "aarch64" | "arm64" => "arm64",
    "x86" => "x86",
    other => other,
  }
}

fn rules_allow(rules: &[Rule], os_name: &str, arch: &str) -> bool {
  if rules.is_empty() {
    return true;
  }
  let mut allowed = false;
  for rule in rules {
    let matches = match &rule.os {
      None => true,
      Some(os) => {
        let name_match = os
          .name
          .as_ref()
          .map_or(true, |n| n == os_name);
        let arch_match = os
          .arch
          .as_ref()
          .map_or(true, |a| a == arch);
        name_match && arch_match
      }
    };
    if !matches {
      continue;
    }
    match rule.action.as_str() {
      "allow" => allowed = true,
      "disallow" => allowed = false,
      _ => {}
    }
  }
  allowed
}

// ---------------------------------------------------------------------------
// Argument resolution
// ---------------------------------------------------------------------------

struct GameContext<'a> {
  username: &'a str,
  uuid: &'a str,
  access_token: &'a str,
  version: &'a str,
  game_dir: &'a str,
  assets_dir: &'a str,
  asset_index: &'a str,
  user_type: &'a str,
  window_width: Option<u32>,
  window_height: Option<u32>,
}

fn resolve_arg_entry(entry: &ArgEntry, os_name: &str, arch: &str) -> Option<Vec<String>> {
  match entry {
    ArgEntry::String(s) => Some(vec![s.clone()]),
    ArgEntry::RuleArg { rules, value } => {
      if let Some(rules_list) = rules {
        if !rules_allow(rules_list, os_name, arch) {
          return None;
        }
      }
      match value {
        ArgValue::String(s) => Some(vec![s.clone()]),
        ArgValue::Array(arr) => Some(arr.clone()),
      }
    }
  }
}

fn resolve_game_args(
  args: &Option<Vec<ArgEntry>>,
  os_name: &str,
  arch: &str,
  ctx: &GameContext,
) -> Vec<String> {
  let mut result = Vec::new();
  let Some(entries) = args else {
    return result;
  };
  for entry in entries {
    let resolved = resolve_arg_entry(entry, os_name, arch);
    if let Some(vals) = resolved {
      for v in vals {
        let v = replace_game_tokens(&v, ctx);
        result.push(v);
      }
    }
  }
  result
}

fn resolve_legacy_args(args: &str, ctx: &GameContext) -> Vec<String> {
  // Split on spaces, respecting the fact that tokens like ${...} shouldn't be split
  let parts = shell_split(args);
  parts
    .iter()
    .map(|p| replace_game_tokens(p, ctx))
    .collect()
}

fn replace_game_tokens(arg: &str, ctx: &GameContext) -> String {
  arg
    .replace("${auth_player_name}", ctx.username)
    .replace("${auth_uuid}", ctx.uuid)
    .replace("${auth_access_token}", ctx.access_token)
    .replace("${auth_session}", ctx.access_token)
    .replace("${version_name}", ctx.version)
    .replace("${game_directory}", ctx.game_dir)
    .replace("${game_assets}", ctx.assets_dir)
    .replace("${assets_root}", ctx.assets_dir)
    .replace("${assets_index_name}", ctx.asset_index)
    .replace("${user_properties}", "{}")
    .replace("${user_type}", ctx.user_type)
    .replace(
      "${resolution_width}",
      &ctx.window_width.map_or("854".to_string(), |w| w.to_string()),
    )
    .replace(
      "${resolution_height}",
      &ctx.window_height.map_or("480".to_string(), |h| h.to_string()),
    )
}

fn shell_split(input: &str) -> Vec<String> {
  let mut result = Vec::new();
  let mut current = String::new();
  let mut in_quote = false;
  let mut in_token = false;

  for c in input.chars() {
    match c {
      '"' => in_quote = !in_quote,
      ' ' if !in_quote => {
        if !current.is_empty() {
          result.push(current.clone());
          current.clear();
        }
        in_token = false;
      }
      '$' if !in_quote => {
        in_token = true;
        current.push(c);
      }
      other => {
        current.push(other);
        if in_token && other == '}' {
          in_token = false;
        }
      }
    }
  }
  if !current.is_empty() {
    result.push(current);
  }
  result
}

// ---------------------------------------------------------------------------
// Native extraction
// ---------------------------------------------------------------------------

async fn extract_native_jar(jar_path: &Path, output_dir: &Path) -> Result<(), String> {
  let content = tokio::fs::read(jar_path)
    .await
    .map_err(|e| format!("Failed to read native jar: {}", e))?;

  let reader = std::io::Cursor::new(&content);
  let mut archive =
    zip::ZipArchive::new(reader).map_err(|e| format!("Failed to open native zip: {}", e))?;

  let extract_extensions = &["so", "dll", "dylib", "jnilib"];

  for i in 0..archive.len() {
    let mut file = archive.by_index(i).map_err(|e| format!("Zip entry error: {}", e))?;
    let name = file.name().to_string();

    if name.contains('/') || name.contains('\\') {
      continue;
    }

    let ext = name.rsplit('.').next().unwrap_or("");
    if !extract_extensions.contains(&ext) {
      continue;
    }

    let out_path = output_dir.join(&name);
    let mut out_file = tokio::fs::File::create(&out_path)
      .await
      .map_err(|e| format!("Failed to create native file: {}", e))?;

    let mut data = Vec::new();
    file.read_to_end(&mut data)
      .map_err(|e| format!("Failed to read zip entry: {}", e))?;

    tokio::io::AsyncWriteExt::write_all(&mut out_file, &data)
      .await
      .map_err(|e| format!("Failed to write native file: {}", e))?;
  }

  Ok(())
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

async fn download_json<T: for<'de> Deserialize<'de>>(url: &str) -> Result<T, String> {
  let client = reqwest::Client::builder()
    .user_agent("vesper-client/1.0")
    .build()
    .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

  let resp = client
    .get(url)
    .send()
    .await
    .map_err(|e| format!("HTTP request failed for {}: {}", url, e))?;

  if !resp.status().is_success() {
    return Err(format!("HTTP {} for {}", resp.status(), url));
  }

  resp
    .json::<T>()
    .await
    .map_err(|e| format!("Failed to parse JSON from {}: {}", url, e))
}

async fn download_file(url: &str, dest: &Path) -> Result<(), String> {
  let client = reqwest::Client::builder()
    .user_agent("vesper-client/1.0")
    .build()
    .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

  let resp = client
    .get(url)
    .send()
    .await
    .map_err(|e| format!("HTTP request failed for {}: {}", url, e))?;

  if !resp.status().is_success() {
    return Err(format!("HTTP {} for {}", resp.status(), url));
  }

  let content = resp
    .bytes()
    .await
    .map_err(|e| format!("Failed to read response body from {}: {}", url, e))?;

  tokio::fs::write(dest, &content)
    .await
    .map_err(|e| format!("Failed to write to {:?}: {}", dest, e))
}

fn sanitize_name(name: &str) -> String {
  name
    .chars()
    .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' { c } else { '_' })
    .collect::<String>()
    .trim()
    .to_string()
}
