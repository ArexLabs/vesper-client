use eframe::egui;
use crate::state::UiState;

pub struct SettingsPage {
    cache_size_gb: f64,
    max_downloads: u32,
    auto_backup: bool,
    backup_schedule: String,
}

impl SettingsPage {
    pub fn new() -> Self {
        Self {
            cache_size_gb: 10.0,
            max_downloads: 5,
            auto_backup: true,
            backup_schedule: "9.0".to_string(),
        }
    }

    pub fn render(&mut self, ui: &mut egui::Ui, _state: &mut UiState) {
        ui.heading("Settings");
        ui.separator();

        ui.label("Cache");
        ui.add(egui::Slider::new(&mut self.cache_size_gb, 1.0..=50.0).text("Max Cache Size (GB)"));
        ui.separator();

        ui.label("Downloads");
        ui.add(egui::Slider::new(&mut self.max_downloads, 1..=10).text("Max Concurrent Downloads"));
        ui.separator();

        ui.label("Backups");
        ui.checkbox(&mut self.auto_backup, "Enable Auto Backup");
        if self.auto_backup {
            ui.text_edit_singleline(&mut self.backup_schedule);
            ui.label("Schedule (decimal time, e.g., 9.0 for 9:00)");
        }
    }
}