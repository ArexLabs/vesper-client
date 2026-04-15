use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let log_dir = directories::ProjectDirs::from("com", "vesper", "vesper")
        .map(|d| d.data_dir().join("logs"))
        .unwrap_or_else(|| std::path::PathBuf::from("logs"));

    std::fs::create_dir_all(&log_dir)?;

    let file_appender = tracing_appender::rolling::RollingFileAppender::new(
        tracing_appender::rolling::Rotation::DAILY,
        &log_dir,
        "vesper-daemon.log",
    );

    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(tracing_subscriber::fmt::layer().with_writer(non_blocking).with_ansi(false))
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stderr))
        .init();

    tracing::info!("Vesper daemon starting...");

    let server = vesper_daemon::server::DaemonServer::new().await?;
    server.run().await?;

    Ok(())
}