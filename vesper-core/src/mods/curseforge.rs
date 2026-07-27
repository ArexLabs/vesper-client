use crate::bridge::commands::ModSource;
use crate::error::{CoreError, CoreResult};
use crate::mods::ModInfo;
use furse::Furse;

pub struct CurseForgeClient {
    client: Furse,
}

impl CurseForgeClient {
    pub fn new(api_key: &str) -> CoreResult<Self> {
        let client = Furse::new(api_key);
        Ok(Self { client })
    }

    pub async fn search(&self, query: &str) -> CoreResult<Vec<ModInfo>> {
        let results = self
            .client
            .get_mods(vec![])
            .await
            .map_err(|e| CoreError::ModDownload(format!("CurseForge search failed: {e}")))?;

        let mods: Vec<ModInfo> = results
            .into_iter()
            .filter(|m| {
                m.name.to_lowercase().contains(&query.to_lowercase())
                    || m.summary.to_lowercase().contains(&query.to_lowercase())
            })
            .map(|m| ModInfo {
                project_id: m.id.to_string(),
                file_id: m
                    .latest_files
                    .first()
                    .map(|f| f.id.to_string())
                    .unwrap_or_default(),
                name: m.name,
                description: m.summary,
                version: String::new(),
                downloads: m.download_count as u64,
                icon_url: m.logo.map(|l| l.thumbnail_url.to_string()),
                source: ModSource::CurseForge,
            })
            .collect();

        Ok(mods)
    }

    pub async fn download_file(&self, mod_id: &str, file_id: &str) -> CoreResult<Vec<u8>> {
        let mid: i32 = mod_id
            .parse()
            .map_err(|_| CoreError::ModDownload("Invalid CurseForge mod ID".into()))?;
        let fid: i32 = file_id
            .parse()
            .map_err(|_| CoreError::ModDownload("Invalid CurseForge file ID".into()))?;

        let url = self
            .client
            .file_download_url(mid, fid)
            .await
            .map_err(|e| CoreError::ModDownload(format!("CurseForge URL fetch failed: {e}")))?;

        let data = reqwest::get(url)
            .await
            .map_err(|e| CoreError::ModDownload(format!("CurseForge download failed: {e}")))?
            .bytes()
            .await
            .map_err(|e| {
                CoreError::ModDownload(format!("CurseForge download read failed: {e}"))
            })?;

        Ok(data.to_vec())
    }
}
