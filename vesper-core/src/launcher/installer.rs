use crate::bridge::updates::UiUpdate;
use crate::config::instance::InstanceConfig;
use crate::error::{CoreError, CoreResult};
use crate::instances::InstanceManager;
use mc_launcher_core::prelude::*;
use tokio::sync::mpsc;

pub struct GameInstaller {
    instance_manager: InstanceManager,
    progress_tx: mpsc::Sender<UiUpdate>,
}

impl GameInstaller {
    pub fn new(
        instance_manager: &InstanceManager,
        progress_tx: mpsc::Sender<UiUpdate>,
    ) -> Self {
        Self {
            instance_manager: instance_manager.clone(),
            progress_tx,
        }
    }

    pub async fn install(&self, instance_id: &str) -> CoreResult<String> {
        let config = self.instance_manager.get(instance_id)?;
        let mc_dir = self.instance_manager.minecraft_dir(instance_id);

        let request = build_install_request(&config);
        let progress_tx = self.progress_tx.clone();

        let version_id = tokio::task::spawn_blocking(move || {
            let launcher = Launcher::new(&mc_dir);
            let mut reporter = UiProgressReporter::new(progress_tx);

            let result = launcher
                .install_with_progress(request, &mut reporter)
                .map_err(|e| CoreError::Launcher(e.to_string()))?;

            Ok::<String, CoreError>(result.version_id)
        })
        .await
        .map_err(|e| CoreError::Launcher(format!("Install task panicked: {e}")))??;

        Ok(version_id)
    }

    pub async fn launch(
        &self,
        instance_id: &str,
        java_path: &str,
        _memory_mb: u32,
    ) -> CoreResult<u32> {
        let config = self.instance_manager.get(instance_id)?;
        let mc_dir = self.instance_manager.minecraft_dir(instance_id);
        let java_path = java_path.to_string();

        let (executable, args, working_dir) = tokio::task::spawn_blocking(move || {
            let launcher = Launcher::new(&mc_dir);
            let request = build_install_request(&config);
            let install_result = launcher
                .install(request)
                .map_err(|e| CoreError::Launcher(format!("Pre-launch install failed: {e}")))?;
            let version = launcher
                .load_version(&install_result.version_id)
                .map_err(|e| CoreError::Launcher(format!("Failed to load version: {e}")))?;

            let launch_options = LaunchOptions {
                account: Account::offline("VesperPlayer"),
                java_executable: Some(java_path.into()),
                ..Default::default()
            };

            let launch_command = launcher
                .build_launch_command_from_version(&version, launch_options)
                .map_err(|e| CoreError::Launcher(format!("Failed to build launch command: {e}")))?;

            Ok::<_, CoreError>((
                launch_command.executable,
                launch_command.args,
                launch_command.working_dir,
            ))
        })
        .await
        .map_err(|e| CoreError::Launcher(format!("Launch task panicked: {e}")))??;

        tracing::info!("Launching Minecraft: {executable:?} {args:?}");

        // Use tokio::process::Command for non-blocking spawn
        let mut child = tokio::process::Command::new(&executable)
            .args(&args)
            .current_dir(&working_dir)
            .spawn()
            .map_err(|e| CoreError::Launcher(format!("Failed to spawn Minecraft: {e}")))?;

        let pid = child.id().unwrap_or(0);
        tokio::spawn(async move {
            let _ = child.wait().await;
        });

        Ok(pid)
    }
}

fn build_install_request(config: &InstanceConfig) -> InstallRequest {
    use crate::config::instance::LoaderType;

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

struct UiProgressReporter {
    tx: mpsc::Sender<UiUpdate>,
    last_update: std::time::Instant,
}

impl UiProgressReporter {
    fn new(tx: mpsc::Sender<UiUpdate>) -> Self {
        Self {
            tx,
            last_update: std::time::Instant::now(),
        }
    }
}

impl ProgressReporter for UiProgressReporter {
    fn report(&mut self, event: ProgressEvent) {
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
                progress: -1.0,
            },
            ProgressEvent::TaskFinished { label } => UiUpdate::InstallProgress {
                stage: format!("{label} complete"),
                progress: 1.0,
            },
            _ => return,
        };

        let _ = self.tx.try_send(update);
    }
}
