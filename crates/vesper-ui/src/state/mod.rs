use eframe::egui;
use std::collections::HashMap;
use vesper_core::ident::{InstanceId, AccountId};
use vesper_proto::InstanceInfo;

pub struct UiState {
    pub instances: HashMap<String, InstanceInfo>,
    pub selected_instance: Option<String>,
    pub loading: bool,
    pub error: Option<String>,
}

impl UiState {
    pub fn new() -> Self {
        Self {
            instances: HashMap::new(),
            selected_instance: None,
            loading: false,
            error: None,
        }
    }

    pub fn update(&mut self, _ctx: &egui::Context) {
    }

    pub fn set_loading(&mut self, loading: bool) {
        self.loading = loading;
    }

    pub fn set_error(&mut self, error: Option<String>) {
        self.error = error;
    }
}