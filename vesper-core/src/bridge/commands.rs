use crate::config::instance::LoaderType;

#[derive(Debug, Clone)]
pub enum BackendCommand {
    AuthStartBrowserLogin {
        account_type: String,
    },
    AuthRefreshToken,
    AuthLogout,
    AuthGetStatus,

    InstanceCreate {
        name: String,
        mc_version: String,
        loader: LoaderType,
        loader_version: Option<String>,
    },
    InstanceList,
    InstanceDelete {
        id: String,
    },

    ModSearch {
        query: String,
        source: ModSource,
    },
    ModDownload {
        instance_id: String,
        project_id: String,
        file_id: String,
        file_name: String,
        source: ModSource,
    },
    ModListInstalled {
        instance_id: String,
    },

    LaunchInstall {
        instance_id: String,
    },
    LaunchStart {
        instance_id: String,
    },

    BedrockLaunch {
        profile_id: String,
    },
    BedrockDetectLauncher,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ModSource {
    Modrinth,
    CurseForge,
}

impl std::fmt::Display for ModSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ModSource::Modrinth => write!(f, "Modrinth"),
            ModSource::CurseForge => write!(f, "CurseForge"),
        }
    }
}
