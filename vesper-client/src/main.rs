use std::rc::Rc;
use std::sync::Arc;

use tokio::sync::{mpsc, Semaphore};

use vesper_core::auth::bedrock::{BedrockAuthManager, find_mcpelauncher};
use vesper_core::auth::keys::{DeviceKeys, IdentityKeys};
use vesper_core::auth::AuthManager;
use vesper_core::bridge::commands::{BackendCommand, ModSource};
use vesper_core::bridge::updates::UiUpdate;
use vesper_core::config::instance::LoaderType;
use vesper_core::config::VesperConfig;
use vesper_core::instances::InstanceManager;
use vesper_core::launcher::GameInstaller;
use vesper_core::mods::downloader::ModManager;

slint::include_modules!();

const MS_CLIENT_ID: &str = "c36a9fb6-4f2a-41ff-90bd-ae7cc92031eb";

fn main() -> Result<(), slint::PlatformError> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(false)
        .init();

    tracing::info!("Vesper Client starting up");

    let config = VesperConfig::load().unwrap_or_else(|e| {
        tracing::warn!("Failed to load config, using defaults: {e}");
        VesperConfig::default()
    });

    let ui = AppWindow::new()?;

    // P2-2: Use bounded channels for backpressure
    let (cmd_tx, mut cmd_rx) = mpsc::channel::<BackendCommand>(64);
    let (update_tx, update_rx) = mpsc::channel::<UiUpdate>(128);

    setup_ui_callbacks(&ui, &cmd_tx);

    let backend_handle = {
        let update_tx = update_tx.clone();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .unwrap();

            rt.block_on(async move {
                let instance_manager = match InstanceManager::new() {
                    Ok(im) => Arc::new(im),
                    Err(e) => {
                        tracing::error!("Failed to initialize instance manager: {e}");
                        return;
                    }
                };

                let auth_manager = match AuthManager::new(MS_CLIENT_ID.to_string()) {
                    Ok(am) => Arc::new(am),
                    Err(e) => {
                        tracing::error!("Failed to initialize auth manager: {e}");
                        return;
                    }
                };

                let mod_manager = match ModManager::new(instance_manager.as_ref().clone(), None) {
                    Ok(mm) => Arc::new(mm),
                    Err(e) => {
                        tracing::warn!("Mod manager init failed (CurseForge disabled): {e}");
                        return;
                    }
                };

                // P2-5: Limit concurrent task spawning
                let semaphore = Arc::new(Semaphore::new(8));

                while let Some(cmd) = cmd_rx.recv().await {
                    let update_tx = update_tx.clone();
                    let instance_manager = Arc::clone(&instance_manager);
                    let auth_manager = Arc::clone(&auth_manager);
                    let mod_manager = Arc::clone(&mod_manager);
                    let permit = semaphore.clone().acquire_owned().await.unwrap();

                    tokio::spawn(async move {
                        let _permit = permit;
                        handle_command(
                            cmd,
                            &update_tx,
                            &instance_manager,
                            &auth_manager,
                            &mod_manager,
                        )
                        .await;
                    });
                }
            });
        })
    };

    let ui_weak = ui.as_weak();
    slint::spawn_local(async move {
        let mut update_rx = update_rx;
        while let Some(update) = update_rx.recv().await {
            let ui_weak = ui_weak.clone();
            let _ = ui_weak.upgrade_in_event_loop(move |ui| {
                apply_ui_update(&ui, update);
            });
        }
    })
    .map_err(|e| slint::PlatformError::Other(e.to_string()))?;

    // P3-4: Use owned config directly instead of Rc<RefCell<>>
    if let Some(active_id) = &config.active_profile_id {
        if let Some(p) = config.profiles.iter().find(|p| p.id == *active_id) {
            ui.set_is_logged_in(true);
            ui.set_username(p.display_name.as_str().into());
        }
    }

    ui.run()?;

    drop(cmd_tx);
    drop(update_tx);
    let _ = backend_handle.join();

    Ok(())
}

fn setup_ui_callbacks(ui: &AppWindow, cmd_tx: &mpsc::Sender<BackendCommand>) {
    // P0 Error 3: Slint `login-requested()` takes 0 args — default to "Java"
    let tx = cmd_tx.clone();
    ui.on_login_requested(move || {
        if tx.try_send(BackendCommand::AuthStartBrowserLogin {
            account_type: "Java".to_string(),
        }).is_err() {
            tracing::warn!("Backend channel closed — login command dropped");
        }
    });

    let tx = cmd_tx.clone();
    ui.on_logout_requested(move || {
        if tx.try_send(BackendCommand::AuthLogout).is_err() {
            tracing::warn!("Backend channel closed — logout command dropped");
        }
    });

    let tx = cmd_tx.clone();
    ui.on_instance_create_requested(move |name, mc_version, loader, loader_version| {
        let loader_type = LoaderType::from_str_loose(&loader);
        if tx.try_send(BackendCommand::InstanceCreate {
            name: name.to_string(),
            mc_version: mc_version.to_string(),
            loader: loader_type,
            loader_version: {
                let v = loader_version.to_string();
                if v.is_empty() { None } else { Some(v) }
            },
        }).is_err() {
            tracing::warn!("Backend channel closed — instance create command dropped");
        }
    });

    let tx = cmd_tx.clone();
    ui.on_instance_delete_requested(move |id| {
        if tx.try_send(BackendCommand::InstanceDelete {
            id: id.to_string(),
        }).is_err() {
            tracing::warn!("Backend channel closed — instance delete command dropped");
        }
    });

    let tx = cmd_tx.clone();
    ui.on_instance_launch_requested(move |id| {
        if tx.try_send(BackendCommand::LaunchStart {
            instance_id: id.to_string(),
        }).is_err() {
            tracing::warn!("Backend channel closed — launch command dropped");
        }
    });

    ui.on_toggle_create_form(move || {
        // handled in UI state
    });

    let tx = cmd_tx.clone();
    ui.on_mod_search_requested(move |query, source| {
        let src = if source.to_string() == "CurseForge" {
            ModSource::CurseForge
        } else {
            ModSource::Modrinth
        };
        if tx.try_send(BackendCommand::ModSearch {
            query: query.to_string(),
            source: src,
        }).is_err() {
            tracing::warn!("Backend channel closed — mod search command dropped");
        }
    });

    let tx = cmd_tx.clone();
    ui.on_mod_download_requested(move |project_id, file_id, name, source| {
        let src = if source.to_string() == "CurseForge" {
            ModSource::CurseForge
        } else {
            ModSource::Modrinth
        };
        // P1-5: TODO — pass the actual selected instance ID from the UI
        if tx.try_send(BackendCommand::ModDownload {
            instance_id: String::from("default"),
            project_id: project_id.to_string(),
            file_id: file_id.to_string(),
            file_name: name.to_string(),
            source: src,
        }).is_err() {
            tracing::warn!("Backend channel closed — mod download command dropped");
        }
    });

    // P2-1: Route settings save through command channel instead of blocking UI thread
    let tx = cmd_tx.clone();
    ui.on_settings_save_requested(move |java_path, max_memory, jvm_args, width, height| {
        if tx.try_send(BackendCommand::SettingsSave {
            java_path: java_path.to_string(),
            max_memory: max_memory as u32,
            jvm_args: jvm_args.to_string(),
            window_width: width as u32,
            window_height: height as u32,
        }).is_err() {
            tracing::warn!("Backend channel closed — settings save command dropped");
        }
    });

    // P1-6: Send DetectJava command instead of AuthGetStatus
    let tx = cmd_tx.clone();
    ui.on_settings_detect_java(move || {
        if tx.try_send(BackendCommand::DetectJava).is_err() {
            tracing::warn!("Backend channel closed — detect java command dropped");
        }
    });

    let tx = cmd_tx.clone();
    ui.on_navigate(move |_page| {
        if tx.try_send(BackendCommand::InstanceList).is_err() {
            tracing::warn!("Backend channel closed — navigate command dropped");
        }
    });

    // P0 Error 4: `on_bedrock_launch` does not exist in Slint UI — removed
}

async fn handle_command(
    cmd: BackendCommand,
    update_tx: &mpsc::Sender<UiUpdate>,
    instance_manager: &InstanceManager,
    auth_manager: &vesper_core::auth::AuthManager,
    mod_manager: &ModManager,
) {
    match cmd {
        BackendCommand::AuthStartBrowserLogin { account_type } => {
            handle_browser_login(update_tx, auth_manager, account_type).await;
        }
        BackendCommand::AuthRefreshToken => {}
        BackendCommand::AuthLogout => {
            if update_tx.send(UiUpdate::AuthLoggedOut).await.is_err() {
                tracing::warn!("UI update channel closed — auth logged out dropped");
            }
        }
        BackendCommand::AuthGetStatus => {
            if update_tx.send(UiUpdate::AuthStatus {
                is_logged_in: false,
                profile: None,
            }).await.is_err() {
                tracing::warn!("UI update channel closed — auth status dropped");
            }
        }

        BackendCommand::InstanceCreate {
            name,
            mc_version,
            loader,
            loader_version,
        } => {
            match instance_manager.create(&name, &mc_version, loader, loader_version) {
                Ok(info) => {
                    let _ = update_tx.send(UiUpdate::InstanceCreated {
                        id: info.id.clone(),
                        name: info.config.name,
                    }).await;
                    let _ = update_tx.send(UiUpdate::SystemMessage {
                        text: format!("Instance '{}' created successfully", info.id),
                    }).await;
                }
                Err(e) => {
                    let _ = update_tx.send(UiUpdate::InstanceError {
                        message: e.to_string(),
                    }).await;
                }
            }
        }

        BackendCommand::InstanceList => {
            match instance_manager.list() {
                Ok(instances) => {
                    let _ = update_tx.send(UiUpdate::InstanceListResult(instances)).await;
                }
                Err(e) => {
                    let _ = update_tx.send(UiUpdate::InstanceError {
                        message: e.to_string(),
                    }).await;
                }
            }
        }

        BackendCommand::InstanceDelete { id } => {
            match instance_manager.delete(&id) {
                Ok(()) => {
                    let _ = update_tx.send(UiUpdate::InstanceDeleted { id }).await;
                }
                Err(e) => {
                    let _ = update_tx.send(UiUpdate::InstanceError {
                        message: e.to_string(),
                    }).await;
                }
            }
        }

        BackendCommand::ModSearch { query, source } => {
            match mod_manager.search(&query, source).await {
                Ok(mods) => {
                    let _ = update_tx.send(UiUpdate::ModSearchResults(mods)).await;
                }
                Err(e) => {
                    let _ = update_tx.send(UiUpdate::ModError {
                        message: e.to_string(),
                    }).await;
                }
            }
        }

        BackendCommand::ModDownload {
            instance_id,
            project_id,
            file_id,
            file_name,
            source,
        } => {
            let _ = update_tx.send(UiUpdate::ModDownloadProgress {
                project_name: file_name.clone(),
                progress: 0.0,
            }).await;

            match mod_manager
                .download_mod(&instance_id, &project_id, &file_id, &file_name, source)
                .await
            {
                Ok(()) => {
                    let _ = update_tx.send(UiUpdate::ModDownloadComplete {
                        project_name: file_name,
                    }).await;
                }
                Err(e) => {
                    let _ = update_tx.send(UiUpdate::ModError {
                        message: e.to_string(),
                    }).await;
                }
            }
        }

        BackendCommand::ModListInstalled { instance_id } => {
            match mod_manager.list_installed(&instance_id) {
                Ok(mods) => {
                    let installed: Vec<_> = mods
                        .iter()
                        .filter_map(|p| {
                            p.file_stem()
                                .and_then(|n| n.to_str())
                                .map(|name| {
                                    vesper_core::bridge::updates::InstalledModInfo {
                                        name: name.to_string(),
                                        version: String::new(),
                                        source: "Local".into(),
                                    }
                                })
                        })
                        .collect();
                    let _ = update_tx.send(UiUpdate::ModListResult(installed)).await;
                }
                Err(e) => {
                    let _ = update_tx.send(UiUpdate::ModError {
                        message: e.to_string(),
                    }).await;
                }
            }
        }

        BackendCommand::LaunchInstall { instance_id } => {
            let installer = GameInstaller::new(instance_manager, update_tx.clone());
            match installer.install(&instance_id).await {
                Ok(_version_id) => {
                    let _ = update_tx.send(UiUpdate::InstallComplete).await;
                }
                Err(e) => {
                    let _ = update_tx.send(UiUpdate::LaunchError {
                        message: e.to_string(),
                    }).await;
                }
            }
        }

        BackendCommand::LaunchStart { instance_id } => {
            let installer = GameInstaller::new(instance_manager, update_tx.clone());

            let _ = update_tx.send(UiUpdate::InstallProgress {
                stage: "Installing game files...".into(),
                progress: 0.0,
            }).await;

            match installer.install(&instance_id).await {
                Ok(_version_id) => {
                    let _ = update_tx.send(UiUpdate::InstallProgress {
                        stage: "Launching Minecraft...".into(),
                        progress: 1.0,
                    }).await;

                    match installer.launch(&instance_id, "java", 4096).await {
                        Ok(_pid) => {
                            let _ = update_tx.send(UiUpdate::LaunchStarted).await;
                        }
                        Err(e) => {
                            let _ = update_tx.send(UiUpdate::LaunchError {
                                message: e.to_string(),
                            }).await;
                        }
                    }
                }
                Err(e) => {
                    let _ = update_tx.send(UiUpdate::LaunchError {
                        message: e.to_string(),
                    }).await;
                }
            }
        }

        BackendCommand::BedrockLaunch { profile_id: _ } => {
            match find_mcpelauncher() {
                Some(path) => {
                    tracing::info!("Found mcpelauncher at {path}");
                    let game_dir = directories::ProjectDirs::from("", "", "Vesper Client")
                        .map(|d| d.data_dir().join("bedrock").to_string_lossy().to_string())
                        .unwrap_or_else(|| "~/.local/share/vesper-client/bedrock".into());

                    match vesper_core::auth::bedrock::launch_mcpelauncher(&game_dir) {
                        Ok(_child) => {
                            let _ = update_tx.send(UiUpdate::BedrockLaunched).await;
                        }
                        Err(e) => {
                            let _ = update_tx.send(UiUpdate::BedrockLaunchError {
                                message: e.to_string(),
                            }).await;
                        }
                    }
                }
                None => {
                    let _ = update_tx.send(UiUpdate::BedrockLauncherNotFound).await;
                }
            }
        }

        BackendCommand::BedrockDetectLauncher => {
            match find_mcpelauncher() {
                Some(path) => {
                    let _ = update_tx.send(UiUpdate::BedrockLauncherFound { path }).await;
                }
                None => {
                    let _ = update_tx.send(UiUpdate::BedrockLauncherNotFound).await;
                }
            }
        }

        // P1-6: Handle DetectJava command
        BackendCommand::DetectJava => {
            match VesperConfig::detect_java() {
                Some(path) => {
                    let _ = update_tx.send(UiUpdate::SystemMessage {
                        text: format!("Java found at: {}", path.display()),
                    }).await;
                }
                None => {
                    let _ = update_tx.send(UiUpdate::SystemMessage {
                        text: "Java not found".into(),
                    }).await;
                }
            }
        }

        // P2-1: Handle SettingsSave through command channel
        BackendCommand::SettingsSave {
            java_path,
            max_memory,
            jvm_args,
            window_width,
            window_height,
        } => {
            let mut config = VesperConfig::load().unwrap_or_default();
            config.java_path = if java_path.is_empty() { None } else { Some(java_path) };
            config.max_memory_mb = max_memory;
            config.jvm_args = if jvm_args.is_empty() { None } else { Some(jvm_args) };
            config.window_width = window_width;
            config.window_height = window_height;
            if let Err(e) = config.save() {
                tracing::error!("Failed to save settings: {e}");
            }
        }
    }
}

async fn handle_browser_login(
    update_tx: &mpsc::Sender<UiUpdate>,
    auth_manager: &vesper_core::auth::AuthManager,
    account_type: String, // P0 Error 2: owned String to move into tokio::spawn
) {
    let is_bedrock = account_type.eq_ignore_ascii_case("bedrock");

    let (auth_url, csrf_state, pkce_verifier, port) = match auth_manager.start_browser_login().await {
        Ok(v) => v,
        Err(e) => {
            let _ = update_tx.send(UiUpdate::AuthError {
                message: e.to_string(),
            }).await;
            return;
        }
    };

    let _ = update_tx.send(UiUpdate::AuthBrowserLoginStarted).await;

    if let Err(e) = open::that(auth_url.as_str()) {
        tracing::error!("Failed to open browser: {e}");
        let _ = update_tx.send(UiUpdate::AuthError {
            message: format!("Failed to open browser: {e}"),
        }).await;
        return;
    }

    let update_tx = update_tx.clone();
    let auth = Arc::new(auth_manager.clone_auth());
    tokio::spawn(async move {
        tracing::info!("Starting browser login (type={account_type}) on port {port}");
        match auth
            .complete_browser_login(port, &pkce_verifier, &csrf_state)
            .await
        {
            Ok(tokens) => {
                tracing::info!("MS auth completed successfully");

                if is_bedrock {
                    let device_keys = DeviceKeys::generate();
                    let identity_keys = IdentityKeys::generate();

                    let bedrock_auth = BedrockAuthManager::new();
                    match bedrock_auth
                        .full_bedrock_auth(
                            &tokens.access_token,
                            &device_keys,
                            &identity_keys,
                        )
                        .await
                    {
                        Ok(bedrock_result) => {
                            let bedrock_profile = bedrock_result.tokens.profile.clone();
                            let profile = vesper_core::auth::models::AuthProfile {
                                id: bedrock_profile.xuid.clone(),
                                display_name: bedrock_profile.display_name.clone(),
                                email: None,
                                account_type: vesper_core::auth::models::AccountType::Bedrock,
                                minecraft_username: Some(bedrock_profile.display_name.clone()),
                                minecraft_uuid: None,
                                xbox_gamertag: None,
                                bedrock_profile: Some(bedrock_profile),
                                device_keys: Some(device_keys),
                                identity_keys: Some(identity_keys),
                            };
                            let _ = update_tx.send(UiUpdate::AuthSuccess { profile }).await;
                        }
                        Err(e) => {
                            tracing::error!("Bedrock auth failed: {e}");
                            let _ = update_tx.send(UiUpdate::AuthError {
                                message: format!("Bedrock auth failed: {e}"),
                            }).await;
                        }
                    }
                } else {
                    if let Some(mc_profile) = &tokens.mc_profile {
                        let profile = vesper_core::auth::models::AuthProfile {
                            id: mc_profile.id.clone(),
                            display_name: mc_profile.name.clone(),
                            email: None,
                            account_type: vesper_core::auth::models::AccountType::Java,
                            minecraft_username: Some(mc_profile.name.clone()),
                            minecraft_uuid: Some(mc_profile.id.clone()),
                            xbox_gamertag: None,
                            bedrock_profile: None,
                            device_keys: None,
                            identity_keys: None,
                        };
                        let _ = update_tx.send(UiUpdate::AuthSuccess { profile }).await;
                    }
                }
            }
            Err(e) => {
                let _ = update_tx.send(UiUpdate::AuthError {
                    message: e.to_string(),
                }).await;
            }
        }
    });
}

fn apply_ui_update(ui: &AppWindow, update: UiUpdate) {
    match update {
        UiUpdate::AuthBrowserLoginStarted => {
            ui.set_is_polling(true);
            ui.set_auth_error(slint::SharedString::default());
        }
        UiUpdate::AuthSuccess { profile } => {
            ui.set_is_logged_in(true);
            ui.set_is_polling(false);
            ui.set_username(profile.display_name.as_str().into());
        }
        UiUpdate::AuthError { message } => {
            ui.set_is_polling(false);
            ui.set_auth_error(message.as_str().into());
            tracing::error!("Auth error: {message}");
        }
        UiUpdate::AuthLoggedOut => {
            ui.set_is_logged_in(false);
            ui.set_is_polling(false);
            ui.set_username(slint::SharedString::default());
        }
        UiUpdate::AuthStatus {
            is_logged_in,
            profile,
        } => {
            ui.set_is_logged_in(is_logged_in);
            if let Some(p) = profile {
                ui.set_username(p.display_name.as_str().into());
            }
        }

        UiUpdate::InstanceListResult(instances) => {
            let entries: Vec<InstanceEntry> = instances
                .into_iter()
                .map(|inst| InstanceEntry {
                    id: inst.id.into(),
                    name: inst.config.name.into(),
                    mc_version: inst.config.mc_version.into(),
                    loader: inst.config.loader_type.to_string().into(),
                    last_played: inst.config.last_played.unwrap_or_default().into(),
                })
                .collect();
            ui.set_instances(Rc::new(slint::VecModel::from(entries)).into());
        }
        UiUpdate::InstanceCreated { id: _, name: _ } => {
            ui.set_show_create_form(false);
        }
        UiUpdate::InstanceDeleted { id: _ } => {}
        UiUpdate::InstanceError { message } => {
            tracing::error!("Instance error: {message}");
        }

        UiUpdate::ModSearchResults(mods) => {
            ui.set_is_searching(false);
            let entries: Vec<ModEntry> = mods
                .into_iter()
                .map(|m| ModEntry {
                    project_id: m.project_id.into(),
                    name: m.name.into(),
                    description: m.description.into(),
                    downloads: m.downloads.to_string().into(),
                    source: m.source.to_string().into(),
                })
                .collect();
            ui.set_search_results(Rc::new(slint::VecModel::from(entries)).into());
        }
        UiUpdate::ModDownloadProgress {
            project_name,
            progress,
        } => {
            ui.set_downloading_mod(project_name.as_str().into());
            ui.set_download_progress(progress);
        }
        UiUpdate::ModDownloadComplete { project_name: _ } => {
            ui.set_downloading_mod(slint::SharedString::default());
            ui.set_download_progress(0.0);
        }
        UiUpdate::ModListResult(mods) => {
            let entries: Vec<ModEntry> = mods
                .into_iter()
                .map(|m| ModEntry {
                    project_id: m.name.clone().into(),
                    name: m.name.into(),
                    description: m.version.into(),
                    downloads: String::new().into(),
                    source: m.source.into(),
                })
                .collect();
            ui.set_installed_mods(Rc::new(slint::VecModel::from(entries)).into());
        }
        UiUpdate::ModError { message } => {
            ui.set_is_searching(false);
            tracing::error!("Mod error: {message}");
        }

        UiUpdate::InstallProgress { stage, progress } => {
            ui.set_launch_overlay_visible(true);
            ui.set_launch_stage(stage.as_str().into());
            ui.set_launch_progress(progress);
        }
        UiUpdate::InstallComplete => {
            ui.set_launch_stage("Installation complete".into());
            ui.set_launch_progress(1.0);
        }
        UiUpdate::LaunchStarted => {
            ui.set_launch_overlay_visible(false);
            ui.set_launch_stage(slint::SharedString::default());
            ui.set_launch_progress(0.0);
        }
        UiUpdate::LaunchError { message } => {
            ui.set_launch_overlay_visible(false);
            tracing::error!("Launch error: {message}");
        }

        // P0 Error 5: Handle Bedrock UiUpdate variants
        UiUpdate::BedrockLauncherFound { path } => {
            tracing::info!("Bedrock launcher found at: {path}");
        }
        UiUpdate::BedrockLauncherNotFound => {
            tracing::warn!("Bedrock launcher not found");
        }
        UiUpdate::BedrockLaunched => {
            tracing::info!("Bedrock launcher started");
        }
        UiUpdate::BedrockLaunchError { message } => {
            tracing::error!("Bedrock launch error: {message}");
        }

        UiUpdate::SystemMessage { text } => {
            tracing::info!("System: {text}");
        }
    }
}
