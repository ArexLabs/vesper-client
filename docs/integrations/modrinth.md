# Modrinth Integration

Vesper Client integrates with the Modrinth mod repository via the `ferinth` crate (v2.x).

## Client Setup

```rust
use ferinth::Ferinth;

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
}
```

The client is initialized with the application name, version, and project URL per Modrinth's API guidelines.

## Search API Usage

```rust
pub async fn search(&self, query: &str) -> CoreResult<Vec<ModInfo>> {
    let response = self.client
        .search(query, &Sort::Relevance, vec![])
        .await
        .map_err(|e| CoreError::ModDownload(format!("Modrinth search failed: {e}")))?;

    let mods: Vec<ModInfo> = response.hits
        .into_iter()
        .map(|hit| ModInfo {
            project_id: hit.project_id,
            file_id: String::new(),  // populated later on download
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
```

Search results are sorted by relevance by default. The `ferinth` crate handles query encoding and pagination internally.

## Version Listing

```rust
pub async fn get_versions(
    &self,
    project_id: &str,
) -> CoreResult<Vec<(String, String, String)>> {
    let versions = self.client
        .version_list(project_id)
        .await
        .map_err(|e| CoreError::ModDownload(format!("Modrinth versions fetch failed: {e}")))?;

    Ok(versions.into_iter().map(|v| {
        let file = v.files.into_iter().next();
        (
            v.id,              // version ID
            v.version_number,  // semantic version string
            file.map(|f| f.filename).unwrap_or_default(),  // primary file name
        )
    }).collect())
}
```

Returns a tuple of `(version_id, version_number, filename)` for each available version.

## File Download

```rust
pub async fn download_file(&self, version_id: &str) -> CoreResult<Vec<u8>> {
    let version = self.client
        .version_get(version_id)
        .await
        .map_err(|e| CoreError::ModDownload(format!("Modrinth version fetch failed: {e}")))?;

    let file = version.files
        .into_iter()
        .next()
        .ok_or_else(|| CoreError::ModDownload("No downloadable file found".into()))?;

    let data = reqwest::get(file.url)
        .await?
        .bytes()
        .await?;

    Ok(data.to_vec())
}
```

The download fetches the version metadata, extracts the first file's download URL, and downloads the bytes directly via `reqwest`.

## ModInfo Mapping

All Modrinth results are mapped to a unified `ModInfo` struct:

```rust
pub struct ModInfo {
    pub project_id: String,
    pub file_id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub source: ModSource,
}
```

For search results, `file_id` and `version` are empty strings. They are populated when the user selects a specific version for download.
