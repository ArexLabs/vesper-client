use eframe::egui;
use crate::state::UiState;
use crate::pages::{InstancesPage, InstanceDetailPage, AccountsPage, SettingsPage, LogsPage};
use crate::services::DaemonClient;

pub struct VesperApp {
    state: UiState,
    daemon_client: DaemonClient,
    current_page: Page,
    instances_page: InstancesPage,
    detail_page: InstanceDetailPage,
    accounts_page: AccountsPage,
    settings_page: SettingsPage,
    logs_page: LogsPage,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Page {
    Instances,
    InstanceDetail,
    Accounts,
    Settings,
    Logs,
}

impl VesperApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        Self {
            state: UiState::new(),
            daemon_client: DaemonClient::new(),
            current_page: Page::Instances,
            instances_page: InstancesPage::new(),
            detail_page: InstanceDetailPage::new(),
            accounts_page: AccountsPage::new(),
            settings_page: SettingsPage::new(),
            logs_page: LogsPage::new(),
        }
    }
}

impl eframe::App for VesperApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.state.update(ctx);

        egui::TopBottomPanel::top("top_panel").show(ctx, |ui| {
            self.top_bar(ui);
        });

        egui::SidePanel::left("side_panel").default_width(200.0).show(ctx, |ui| {
            self.side_panel(ui);
        });

        egui::CentralPanel::default().show(ctx, |ui| {
            match self.current_page {
                Page::Instances => self.instances_page.render(ui, &mut self.state),
                Page::InstanceDetail => self.detail_page.render(ui, &mut self.state),
                Page::Accounts => self.accounts_page.render(ui, &mut self.state),
                Page::Settings => self.settings_page.render(ui, &mut self.state),
                Page::Logs => self.logs_page.render(ui, &mut self.state),
            }
        });
    }
}

impl VesperApp {
    fn top_bar(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.label(egui::RichText::new("Vesper Launcher").heading());
            ui.separator();
            ui.label("Connected");
        });
    }

    fn side_panel(&mut self, ui: &mut egui::Ui) {
        ui.heading("Navigation");
        ui.separator();

        let instances_selected = self.current_page == Page::Instances;
        if ui.selectable_label(instances_selected, "Instances").clicked() {
            self.current_page = Page::Instances;
        }

        let accounts_selected = self.current_page == Page::Accounts;
        if ui.selectable_label(accounts_selected, "Accounts").clicked() {
            self.current_page = Page::Accounts;
        }

        let settings_selected = self.current_page == Page::Settings;
        if ui.selectable_label(settings_selected, "Settings").clicked() {
            self.current_page = Page::Settings;
        }

        let logs_selected = self.current_page == Page::Logs;
        if ui.selectable_label(logs_selected, "Logs").clicked() {
            self.current_page = Page::Logs;
        }
    }
}