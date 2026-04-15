use eframe::Application;

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 720.0])
            .with_min_inner_size([800.0, 600.0])
            .with_title("Vesper Launcher"),
        ..Default::default()
    };

    eframe::run_native(
        "Vesper Launcher",
        options,
        Box::new(|cc| Ok(Box::new(vesper_ui::app::VesperApp::new(cc)))),
    )
}