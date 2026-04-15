use eframe::egui;
use crate::state::UiState;

pub struct AccountsPage;

impl AccountsPage {
    pub fn new() -> Self {
        Self
    }

    pub fn render(&mut self, ui: &mut egui::Ui, _state: &mut UiState) {
        ui.heading("Accounts");
        ui.separator();

        if ui.button("Add Microsoft Account").clicked() {
        }

        if ui.button("Add Cracked Account").clicked() {
        }

        ui.separator();
        ui.label("No accounts configured");
    }
}