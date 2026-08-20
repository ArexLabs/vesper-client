# Minecraft Integration

Vesper Client uses `mc-launcher-core` (v0.1) as the backbone for installing game files, resolving mod loader dependencies, and building launch commands.

## mc-launcher-core Integration

The `GameInstaller` struct wraps `mc-launcher-core`'s `Launcher` and bridges it to the Vesper Client's async world and UI progress system.

```rust
pub struct GameInstaller {
    instance_manager: InstanceManager,
    progress_tx: mpsc::UnboundedSender<UiUpdate>,
}
```

## Profile Resolution

The `LoaderType` enum determines which mod loader to install:

```rust
pub enum LoaderType {
    Vanilla,
    Fabric,
    NeoForge,
}
```

`LoaderType::from_str_loose()` accepts flexible string input from the UI:

```rust
impl LoaderType {
    pub fn from_str_loose(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "fabric" => LoaderType::Fabric,
            "neoforge" | "neo_forge" | "neo-forge" => LoaderType::NeoForge,
            _ => LoaderType::Vanilla,
        }
    }
}
```

## Install Request Building

`build_install_request` converts an `InstanceConfig` into an `mc-launcher-core` `InstallRequest`:

```rust
fn build_install_request(config: &InstanceConfig) -> InstallRequest {
    let loader = match config.loader_type {
        LoaderType::Vanilla => None,
        LoaderType::Fabric => Some(LoaderSpec::Fabric {
            version: match &config.loader_version {
                Some(v) => LoaderVersion::Exact(v.clone()),
                None => LoaderVersion::LatestStable,
            },
        }),
        LoaderType::NeoForge => Some(LoaderSpec::NeoForge {
            version: match &config.loader_version {
                Some(v) => LoaderVersion::Exact(v.clone()),
                None => LoaderVersion::LatestStable,
            },
        }),
    };

    InstallRequest {
        minecraft_version: config.mc_version.clone(),
        loader,
        java: JavaInstallPolicy::Auto,
    }
}
```

## Game Installation Flow

Installation runs inside `spawn_blocking` because `mc-launcher-core`'s install is synchronous:

```rust
pub async fn install(&self, instance_id: &str) -> CoreResult<String> {
    let config = self.instance_manager.get(instance_id)?;
    let mc_dir = self.instance_manager.minecraft_dir(instance_id);
    let request = build_install_request(&config);

    let version_id = tokio::task::spawn_blocking(move || {
        let launcher = Launcher::new(&mc_dir);
        let mut reporter = UiProgressReporter::new(progress_tx);

        let result = launcher
            .install_with_progress(request, &mut reporter)
            .map_err(|e| CoreError::Launcher(e.to_string()))?;

        Ok::<String, CoreError>(result.version_id)
    })
    .await??;

    Ok(version_id)
}
```

The `.minecraft` directory is located at `{data_dir}/instances/{id}/.minecraft/`.

## Launch Command Construction

The `launch` method performs a pre-launch install, loads the version, and spawns the game process:

```rust
pub async fn launch(&self, instance_id: &str, java_path: &str, _memory_mb: u32) -> CoreResult<u32> {
    let config = self.instance_manager.get(instance_id)?;
    let mc_dir = self.instance_manager.minecraft_dir(instance_id);
    let launcher = Launcher::new(&mc_dir);

    let request = build_install_request(&config);
    let install_result = launcher.install(request)?;

    let version = launcher.load_version(&install_result.version_id)?;

    let launch_options = LaunchOptions {
        account: Account::offline("VesperPlayer"),
        java_executable: Some(java_path.into()),
        ..Default::default()
    };

    let launch_command = launcher.build_launch_command_from_version(&version, launch_options)?;

    let mut child = std::process::Command::new(&launch_command.executable)
        .args(&launch_command.args)
        .current_dir(&launch_command.working_dir)
        .spawn()?;

    let pid = child.id();
    tokio::task::spawn_blocking(move || { let _ = child.wait(); });

    Ok(pid)
}
```

Key details:
- The game runs with an offline account (`"VesperPlayer"`) by default
- The child process is spawned on the OS thread and its wait is handled by `spawn_blocking`
- The PID is returned to the UI via `UiUpdate::LaunchStarted`

## Progress Reporting

`UiProgressReporter` implements `mc-launcher-core`'s `ProgressReporter` trait and bridges progress events to `UiUpdate`:

```rust
struct UiProgressReporter {
    tx: mpsc::UnboundedSender<UiUpdate>,
    last_update: std::time::Instant,
}

impl ProgressReporter for UiProgressReporter {
    fn report(&mut self, event: ProgressEvent) {
        // Throttle to max once per 100ms
        if self.last_update.elapsed() < std::time::Duration::from_millis(100) {
            return;
        }
        self.last_update = std::time::Instant::now();

        let update = match event {
            ProgressEvent::StageStarted { stage } => UiUpdate::InstallProgress {
                stage: format!("{stage:?}"),
                progress: 0.0,
            },
            ProgressEvent::TaskStarted { label, .. } => UiUpdate::InstallProgress {
                stage: format!("Downloading {label}..."),
                progress: -1.0,  // indeterminate
            },
            ProgressEvent::TaskFinished { label } => UiUpdate::InstallProgress {
                stage: format!("{label} complete"),
                progress: 1.0,
            },
            _ => return,
        };

        let _ = self.tx.send(update);
    }
}
```

Progress updates are throttled to 100ms intervals to avoid flooding the UI channel. A `progress` value of `-1.0` signals an indeterminate progress bar to the UI.

## Launch + Install Sequence in handle_command

The `LaunchStart` command chains install and launch:

```rust
BackendCommand::LaunchStart { instance_id } => {
    let installer = GameInstaller::new(instance_manager, update_tx.clone());

    let _ = update_tx.send(UiUpdate::InstallProgress {
        stage: "Installing game files...".into(),
        progress: 0.0,
    });

    match installer.install(&instance_id).await {
        Ok(_version_id) => {
            let _ = update_tx.send(UiUpdate::InstallProgress {
                stage: "Launching Minecraft...".into(),
                progress: 1.0,
            });
            match installer.launch(&instance_id, "java", 4096).await {
                Ok(_pid) => { let _ = update_tx.send(UiUpdate::LaunchStarted); }
                Err(e) => { let _ = update_tx.send(UiUpdate::LaunchError { message: e.to_string() }); }
            }
        }
        Err(e) => { let _ = update_tx.send(UiUpdate::LaunchError { message: e.to_string() }); }
    }
}
```
