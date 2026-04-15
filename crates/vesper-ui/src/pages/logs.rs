use eframe::egui;
use crate::state::UiState;

pub struct LogsPage;

impl LogsPage {
    pub fn new() -> Self {
        Self
    }

    pub fn render(&mut self, ui: &mut egui::Ui, _state: &mut UiState) {
        ui.heading("Logs");
        ui.separator();

        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.label("No logs available");
        });
    }
}