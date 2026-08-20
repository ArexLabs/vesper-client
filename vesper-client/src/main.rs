mod ui;

use std::sync::{Arc, Mutex};

use anyhow::Result;
use gpui::{AppContext, Application, WindowBounds, WindowOptions, px};
use tokio::sync::mpsc;

use ui::login_view::LoginView;

use vesper_core::bridge::commands::BackendCommand;
use vesper_core::bridge::updates::UiUpdate;

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(false)
        .init();

    tracing::info!("Vesper Client starting up (GPUI)");

    // Shared state for async auth updates
    let latest_update: Arc<Mutex<Option<UiUpdate>>> = Arc::new(Mutex::new(None));

    // MPSC channel for commands (not actively used in prototype — auth runs inline)
    let (cmd_tx, _cmd_rx) = mpsc::channel::<BackendCommand>(64);

    Application::new()
        .run(move |cx| {
            let bounds = gpui::Bounds::new(
                gpui::Point::new(px(100.0), px(100.0)),
                gpui::Size::new(px(1100.0), px(700.0)),
            );

            cx.open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    ..Default::default()
                },
                |_, cx| cx.new(|_cx| LoginView::new(cmd_tx, latest_update)),
            )
            .unwrap();
        });

    Ok(())
}
