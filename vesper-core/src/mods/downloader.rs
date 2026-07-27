use crate::bridge::commands::ModSource;
use crate::error::{CoreError, CoreResult};
use crate::instances::InstanceManager;
use crate::mods::curseforge::CurseForgeClient;
use crate::mods::modrinth::ModrinthClient;
use crate::mods::ModInfo;
use futures_util::stream::{self, StreamExt};
use std::path::PathBuf;
use tokio::fs;
use tokio::sync::mpsc;

pub struct ModManager {
    modrinth: ModrinthClient,
    curseforge: Option<CurseForgeClient>,
    instance_manager: InstanceManager,
}

impl ModManager {
    pub fn new(
        instance_manager: InstanceManager,
        curseforge_api_key: Option<&str>,
    ) -> CoreResult<Self> {
        let modrinth = ModrinthClient::new()?;
        let curseforge = curseforge_api_key.map(CurseForgeClient::new).transpose()?;
        Ok(Self {
            modrinth,
            curseforge,
            instance_manager,
        })
    }

    pub async fn search(&self, query: &str, source: ModSource) -> CoreResult<Vec<ModInfo>> {
        match source {
            ModSource::Modrinth => self.modrinth.search(query).await,
            ModSource::CurseForge => {
                self.curseforge
                    .as_ref()
                    .ok_or_else(|| {
                        CoreError::ModDownload("CurseForge API key not configured".into())
                    })?
                    .search(query)
                    .await
            }
        }
    }

    pub async fn download_mod(
        &self,
        instance_id: &str,
        project_id: &str,
        file_id: &str,
        file_name: &str,
        source: ModSource,
    ) -> CoreResult<()> {
        let data = match source {
            ModSource::Modrinth => self.modrinth.download_file(file_id).await?,
            ModSource::CurseForge => {
                self.curseforge
                    .as_ref()
                    .ok_or_else(|| {
                        CoreError::ModDownload("CurseForge API key not configured".into())
                    })?
                    .download_file(project_id, file_id)
                    .await?
            }
        };

        let mods_dir = self.instance_manager.mods_dir(instance_id);
        fs::create_dir_all(&mods_dir).await?;

        let filename = if file_name.ends_with(".jar") {
            file_name.to_string()
        } else {
            format!("{file_name}.jar")
        };

        let path = mods_dir.join(&filename);
        fs::write(&path, data).await?;
        Ok(())
    }

    pub async fn download_mods_concurrent(
        &self,
        instance_id: &str,
        downloads: Vec<ModDownloadTarget>,
        progress_tx: mpsc::UnboundedSender<crate::bridge::updates::UiUpdate>,
    ) -> CoreResult<()> {
        let mods_dir = self.instance_manager.mods_dir(instance_id);
        fs::create_dir_all(&mods_dir).await?;

        let results: Vec<CoreResult<()>> = stream::iter(downloads)
            .map(|target| {
                let progress_tx = progress_tx.clone();
                let mods_dir = mods_dir.clone();
                async move {
                    let data = match target.source {
                        ModSource::Modrinth => {
                            self.modrinth.download_file(&target.file_id).await?
                        }
                        ModSource::CurseForge => {
                            self.curseforge
                                .as_ref()
                                .ok_or_else(|| {
                                    CoreError::ModDownload(
                                        "CurseForge API key not configured".into(),
                                    )
                                })?
                                .download_file(&target.project_id, &target.file_id)
                                .await?
                        }
                    };

                    let filename = if target.file_name.ends_with(".jar") {
                        target.file_name.clone()
                    } else {
                        format!("{}.jar", target.file_name)
                    };

                    let path = mods_dir.join(&filename);
                    fs::write(&path, data).await?;

                    let _ = progress_tx.send(
                        crate::bridge::updates::UiUpdate::ModDownloadComplete {
                            project_name: target.project_name,
                        },
                    );

                    Ok(())
                }
            })
            .buffer_unordered(4)
            .collect()
            .await;

        for result in results {
            result?;
        }

        Ok(())
    }

    pub fn list_installed(&self, instance_id: &str) -> CoreResult<Vec<PathBuf>> {
        let mods_dir = self.instance_manager.mods_dir(instance_id);
        if !mods_dir.exists() {
            return Ok(Vec::new());
        }

        let mut jars: Vec<PathBuf> = std::fs::read_dir(&mods_dir)?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().map(|e| e == "jar").unwrap_or(false))
            .collect();

        jars.sort();
        Ok(jars)
    }
}

pub struct ModDownloadTarget {
    pub project_id: String,
    pub file_id: String,
    pub file_name: String,
    pub source: ModSource,
    pub project_name: String,
}
