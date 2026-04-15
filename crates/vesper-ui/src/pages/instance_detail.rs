use eframe::egui;
use crate::state::UiState;

pub struct InstanceDetailPage {
    selected_instance_id: Option<String>,
}

impl InstanceDetailPage {
    pub fn new() -> Self {
        Self {
            selected_instance_id: None,
        }
    }

    pub fn render(&mut self, ui: &mut egui::Ui, state: &mut UiState) {
        if let Some(id) = &state.selected_instance {
            if let Some(instance) = state.instances.get(id) {
                ui.heading(&instance.name);
                ui.separator();

                ui.label(format!("Game Version: {}", instance.game_version));
                ui.label(format!("Loader: {}", instance.loader));
                ui.label(format!("Java: {}", instance.java_version));

                ui.separator();

                if instance.running {
                    if ui.button("Stop").clicked() {
                    }
                } else {
                    if ui.button("Play").clicked() {
                    }
                }

                if ui.button("Edit").clicked() {
                }

                if ui.button("Delete").clicked() {
                }
            }
        } else {
            ui.label("Select an instance to view details");
        }
    }
}