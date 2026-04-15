use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;
use tokio::io::AsyncBufReadExt;
use tracing::{info, error, warn};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_target(false)
        .init();

    info!("Vesper supervisor starting...");

    let daemon_path = std::env::current_exe()?
        .parent()?
        .join("vesper-daemon");

    if !daemon_path.exists() {
        error!("Daemon not found at {:?}", daemon_path);
        return Ok(());
    }

    loop {
        info!("Starting daemon process...");

        let mut child = Command::new(&daemon_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let pid = child.id();
        info!("Daemon started with PID {}", pid);

        let status = child.wait().await;
        
        match status {
            Ok(exit_status) => {
                if !exit_status.success() {
                    warn!("Daemon exited with status: {}", exit_status);
                }
            }
            Err(e) => {
                error!("Daemon process error: {}", e);
            }
        }

        info!("Daemon stopped, restarting in 5 seconds...");
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}