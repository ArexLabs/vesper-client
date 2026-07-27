pub mod curseforge;
pub mod downloader;
pub mod modrinth;

pub use downloader::ModManager;

#[derive(Debug, Clone)]
pub struct ModInfo {
    pub project_id: String,
    pub file_id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub source: crate::bridge::commands::ModSource,
}
