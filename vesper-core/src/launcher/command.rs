use std::process::{Child, Command};

use crate::error::{CoreError, CoreResult};

#[derive(Debug)]
pub struct LaunchConfig {
    pub executable: String,
    pub args: Vec<String>,
    pub working_dir: String,
}

pub fn spawn_minecraft(config: &LaunchConfig) -> CoreResult<Child> {
    let mut cmd = Command::new(&config.executable);
    cmd.args(&config.args);

    if !config.working_dir.is_empty() {
        cmd.current_dir(&config.working_dir);
    }

    cmd.spawn()
        .map_err(|e| CoreError::Launcher(format!("Failed to spawn process: {e}")))
}
