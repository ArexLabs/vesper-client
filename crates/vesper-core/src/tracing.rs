use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use std::path::Path;

pub fn init_logs(log_dir: &Path) -> anyhow::Result<()> {
    std::fs::create_dir_all(log_dir)?;

    let file_appender = RollingFileAppender::new(
        Rotation::DAILY,
        log_dir,
        "vesper.log",
    );

    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,vesper=debug"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer()
            .with_writer(non_blocking)
            .with_ansi(false)
            .with_target(true)
            .with_thread_ids(true)
            .with_file(true)
            .with_line_number(true))
        .with(tracing_subscriber::fmt::layer()
            .with_writer(std::io::stderr)
            .with_target(true)
            .with_thread_ids(false)
            .with_file(false)
            .with_line_number(false))
        .init();

    Ok(())
}

pub fn init_test_logs() {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("debug"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer())
        .init();
}