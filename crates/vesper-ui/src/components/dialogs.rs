use eframe::egui;

pub struct Dialog {
    pub title: String,
    pub message: String,
}

impl Dialog {
    pub fn confirm(title: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            message: message.into(),
        }
    }

    pub fn render(&self, ui: &mut egui::Ui) {
        egui::Window::new(&self.title)
            .collapsible(false)
            .resizable(false)
            .show(ui, |ui| {
                ui.label(&self.message);
                ui.horizontal(|ui| {
                    if ui.button("OK").clicked() {
                    }
                    if ui.button("Cancel").clicked() {
                    }
                });
            });
    }
}