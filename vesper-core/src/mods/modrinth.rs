use crate::bridge::commands::ModSource;
use crate::error::{CoreError, CoreResult};
use crate::mods::ModInfo;
use ferinth::Ferinth;
use ferinth::structures::search::Sort;

pub struct ModrinthClient {
    client: Ferinth<()>,
}

impl ModrinthClient {
    pub fn new() -> CoreResult<Self> {
        let client = Ferinth::<()>::new(
            "vesper-client",
            Some(env!("CARGO_PKG_VERSION")),
            Some("https://github.com/VOMLabs/vesper-client"),
        );
        Ok(Self { client })
    }

    pub async fn search(&self, query: &str) -> CoreResult<Vec<ModInfo>> {
        let response = self
            .client
            .search(query, &Sort::Relevance, vec![])
            .await
            .map_err(|e| CoreError::ModDownload(format!("Modrinth search failed: {e}")))?;

        let mods: Vec<ModInfo> = response
            .hits
            .into_iter()
            .map(|hit| ModInfo {
                project_id: hit.project_id,
                file_id: String::new(),
                name: hit.title,
                description: hit.description,
                version: String::new(),
                downloads: hit.downloads as u64,
                icon_url: hit.icon_url.map(|u| u.to_string()),
                source: ModSource::Modrinth,
            })
            .collect();

        Ok(mods)
    }

    pub async fn get_versions(
        &self,
        project_id: &str,
    ) -> CoreResult<Vec<(String, String, String)>> {
        let versions = self
            .client
            .version_list(project_id)
            .await
            .map_err(|e| CoreError::ModDownload(format!("Modrinth versions fetch failed: {e}")))?;

        Ok(versions
            .into_iter()
            .map(|v| {
                let file = v.files.into_iter().next();
                (
                    v.id,
                    v.version_number,
                    file.map(|f| f.filename).unwrap_or_default(),
                )
            })
            .collect())
    }

    pub async fn download_file(&self, version_id: &str) -> CoreResult<Vec<u8>> {
        let version = self
            .client
            .version_get(version_id)
            .await
            .map_err(|e| CoreError::ModDownload(format!("Modrinth version fetch failed: {e}")))?;

        let file = version
            .files
            .into_iter()
            .next()
            .ok_or_else(|| CoreError::ModDownload("No downloadable file found".into()))?;

        let data = reqwest::get(file.url)
            .await
            .map_err(|e| CoreError::ModDownload(format!("Modrinth download failed: {e}")))?
            .bytes()
            .await
            .map_err(|e| CoreError::ModDownload(format!("Modrinth download read failed: {e}")))?;

        Ok(data.to_vec())
    }
}
