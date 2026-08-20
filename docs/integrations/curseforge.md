# CurseForge Integration

Vesper Client integrates with the CurseForge mod repository via the `furse` crate (v1.x). CurseForge requires an API key, so this integration is optional and only enabled when a key is provided.

## Client Setup

```rust
use furse::Furse;

pub struct CurseForgeClient {
    client: Furse,
}

impl CurseForgeClient {
    pub fn new(api_key: &str) -> CoreResult<Self> {
        let client = Furse::new(api_key);
        Ok(Self { client })
    }
}
```

The `Furse` client requires a valid CurseForge API key passed at construction time.

## Search API Usage (Client-Side Filtering)

CurseForge's API does not support text search directly. The client fetches all mods and filters locally:

```rust
pub async fn search(&self, query: &str) -> CoreResult<Vec<ModInfo>> {
    let results = self.client
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
            file_id: m.latest_files
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
```

The filter checks both `name` and `summary` fields, case-insensitive.

## File Download URL Resolution

CurseForge requires a two-step download: first resolve the download URL, then fetch the bytes:

```rust
pub async fn download_file(&self, mod_id: &str, file_id: &str) -> CoreResult<Vec<u8>> {
    let mid: i32 = mod_id.parse()
        .map_err(|_| CoreError::ModDownload("Invalid CurseForge mod ID".into()))?;
    let fid: i32 = file_id.parse()
        .map_err(|_| CoreError::ModDownload("Invalid CurseForge file ID".into()))?;

    // Step 1: Resolve download URL
    let url = self.client
        .file_download_url(mid, fid)
        .await
        .map_err(|e| CoreError::ModDownload(format!("CurseForge URL fetch failed: {e}")))?;

    // Step 2: Download bytes
    let data = reqwest::get(url)
        .await?
        .bytes()
        .await?;

    Ok(data.to_vec())
}
```

Mod and file IDs are parsed as `i32` for the CurseForge API.

## ModInfo Mapping

Same unified `ModInfo` struct as Modrinth:

```rust
ModInfo {
    project_id: m.id.to_string(),       // CurseForge numeric ID as string
    file_id: latest_file.id.to_string(), // primary file ID
    name: m.name,
    description: m.summary,
    version: String::new(),
    downloads: m.download_count as u64,
    icon_url: m.logo.map(|l| l.thumbnail_url.to_string()),
    source: ModSource::CurseForge,
}
```

## ModManager Integration

The `ModManager` conditionally initializes CurseForge:

```rust
pub fn new(instance_manager: InstanceManager, curseforge_api_key: Option<&str>) -> CoreResult<Self> {
    let modrinth = ModrinthClient::new()?;
    let curseforge = curseforge_api_key
        .map(CurseForgeClient::new)
        .transpose()?;
    Ok(Self { modrinth, curseforge, instance_manager })
}
```

Search dispatches based on `ModSource`:

```rust
pub async fn search(&self, query: &str, source: ModSource) -> CoreResult<Vec<ModInfo>> {
    match source {
        ModSource::Modrinth => self.modrinth.search(query).await,
        ModSource::CurseForge => {
            self.curseforge
                .as_ref()
                .ok_or_else(|| CoreError::ModDownload("CurseForge API key not configured".into()))?
                .search(query)
                .await
        }
    }
}
```

Without an API key, CurseForge commands return `ModDownload("CurseForge API key not configured")`.
