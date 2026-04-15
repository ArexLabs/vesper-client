use eframe::egui;

pub struct ProgressIndicator {
    pub label: String,
    pub progress: f32,
}

impl ProgressIndicator {
    pub fn new(label: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            progress: 0.0,
        }
    }

    pub fn set_progress(&mut self, progress: f32) {
        self.progress = progress.clamp(0.0, 1.0);
    }

    pub fn render(&self, ui: &mut egui::Ui) {
        ui.label(&self.label);
        ui.add(egui::ProgressBar::new(self.progress).show_percentage());
    }
}