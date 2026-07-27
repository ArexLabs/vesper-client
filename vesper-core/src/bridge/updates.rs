use crate::auth::models::AuthProfile;
use crate::config::instance::InstanceInfo;
use crate::mods::ModInfo;

#[derive(Debug, Clone)]
pub enum UiUpdate {
    AuthBrowserLoginStarted,
    AuthSuccess {
        profile: AuthProfile,
    },
    AuthError {
        message: String,
    },
    AuthLoggedOut,
    AuthStatus {
        is_logged_in: bool,
        profile: Option<AuthProfile>,
    },

    InstanceListResult(Vec<InstanceInfo>),
    InstanceCreated {
        id: String,
        name: String,
    },
    InstanceDeleted {
        id: String,
    },
    InstanceError {
        message: String,
    },

    ModSearchResults(Vec<ModInfo>),
    ModDownloadProgress {
        project_name: String,
        progress: f32,
    },
    ModDownloadComplete {
        project_name: String,
    },
    ModListResult(Vec<InstalledModInfo>),
    ModError {
        message: String,
    },

    InstallProgress {
        stage: String,
        progress: f32,
    },
    InstallComplete,
    LaunchStarted,
    LaunchError {
        message: String,
    },

    BedrockLauncherFound {
        path: String,
    },
    BedrockLauncherNotFound,
    BedrockLaunched,
    BedrockLaunchError {
        message: String,
    },

    SystemMessage {
        text: String,
    },
}

#[derive(Debug, Clone)]
pub struct InstalledModInfo {
    pub name: String,
    pub version: String,
    pub source: String,
}
