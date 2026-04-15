use eframe::egui;
use crate::state::UiState;

pub struct InstancesPage {
    new_instance_name: String,
    new_instance_version: String,
    new_instance_loader: String,
}

impl InstancesPage {
    pub fn new() -> Self {
        Self {
            new_instance_name: String::new(),
            new_instance_version: String::from("1.21.1"),
            new_instance_loader: String::from("vanilla"),
        }
    }

    pub fn render(&mut self, ui: &mut egui::Ui, state: &mut UiState) {
        ui.heading("Instances");
        ui.separator();

        if ui.button("Create New Instance").clicked() {
            ui.memory_mut().toggle_debug_expand();
        }

        ui.separator();
        ui.label(format!("Loaded instances: {}", state.instances.len()));

        egui::ScrollArea::vertical().show(ui, |ui| {
            for (id, instance) in &state.instances {
                let response = ui.collapsible(instance.name.clone(), |ui| {
                    ui.label(format!("Game Version: {}", instance.game_version));
                    ui.label(format!("Loader: {}", instance.loader));
                    ui.label(if instance.running { "Running" } else { "Stopped" });
                });

                if response.inner.content().clicked() {
                    state.selected_instance = Some(id.clone());
                }
            }
        });
    }
}