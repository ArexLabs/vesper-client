use eframe::egui;

pub fn dark_theme() -> egui::Visuals {
    egui::Visuals {
        dark_mode: true,
        ..Default::default()
    }
}

pub fn light_theme() -> egui::Visuals {
    egui::Visuals {
        dark_mode: false,
        ..Default::default()
    }
}