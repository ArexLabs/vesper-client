use eframe::egui;
use vesper_proto::InstanceInfo;

pub struct InstanceCard {
    instance: InstanceInfo,
}

impl InstanceCard {
    pub fn new(instance: InstanceInfo) -> Self {
        Self { instance }
    }

    pub fn render(&self, ui: &mut egui::Ui) -> bool {
        let response = ui.collapsible(&self.instance.name, |ui| {
            ui.label(format!("Version: {}", self.instance.game_version));
            ui.label(format!("Loader: {}", self.instance.loader));
            ui.label(if self.instance.running { "Running" } else { "Stopped" });
        });

        response.inner.content().clicked()
    }
}