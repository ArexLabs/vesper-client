# Concurrent Download Pipeline

Vesper Client uses `futures-util` (v0.3) to implement bounded concurrent mod downloads. This document covers the pipeline design, concurrency limits, progress reporting, and error handling.

## Pipeline Architecture

```
Vec<ModDownloadTarget>
    |
    v
stream::iter(downloads)
    .map(|target| async move {
        // 1. Fetch bytes from source
        // 2. Write to {instance}/mods/{name}.jar
        // 3. Send ModDownloadComplete
    })
    .buffer_unordered(4)   // <-- concurrency limit
    .collect::<Vec<_>>()
    .await
```

The pipeline converts a `Vec` of download targets into an async stream, maps each to a download task, buffers up to 4 in-flight downloads, and collects all results.

## Concurrency Limit

`buffer_unordered(4)` allows up to 4 simultaneous downloads. This value was chosen to balance:
- Network throughput (most connections have bandwidth limits)
- System resource usage (memory, file descriptors)
- User experience (progress updates for multiple mods)

```rust
let results: Vec<CoreResult<()>> = stream::iter(downloads)
    .map(|target| async move {
        // download and write logic
    })
    .buffer_unordered(4)
    .collect()
    .await;
```

## Download Target

```rust
pub struct ModDownloadTarget {
    pub project_id: String,
    pub file_id: String,
    pub file_name: String,
    pub source: ModSource,
    pub project_name: String,
}
```

## Progress Reporting

Each completed download sends a `UiUpdate::ModDownloadComplete` through the progress channel:

```rust
let _ = progress_tx.send(UiUpdate::ModDownloadComplete {
    project_name: target.project_name,
});
```

Progress is reported per-file (complete), not as byte-level streaming progress. The UI shows which mod was downloaded and can update a list accordingly.

## Error Handling in Streams

Each download returns `CoreResult<()>`. The stream collects all results, and errors are propagated after all downloads complete:

```rust
let results: Vec<CoreResult<()>> = stream::iter(downloads)
    .map(|target| async move {
        let data = match target.source {
            ModSource::Modrinth => self.modrinth.download_file(&target.file_id).await?,
            ModSource::CurseForge => self.curseforge.as_ref()
                .ok_or_else(|| CoreError::ModDownload("CurseForge API key not configured".into()))?
                .download_file(&target.project_id, &target.file_id).await?
        };

        let filename = if target.file_name.ends_with(".jar") {
            target.file_name.clone()
        } else {
            format!("{}.jar", target.file_name)
        };

        let path = mods_dir.join(&filename);
        fs::write(&path, data).await?;

        let _ = progress_tx.send(UiUpdate::ModDownloadComplete {
            project_name: target.project_name,
        });

        Ok(())
    })
    .buffer_unordered(4)
    .collect()
    .await;

// After all downloads complete, check for errors
for result in results {
    result?;
}
```

Error handling strategy:
- Individual download failures do not cancel other in-flight downloads
- All downloads are allowed to complete (success or failure)
- After all downloads finish, the first error is propagated back to the caller
- The caller sends `UiUpdate::ModError` with the error message to the UI

## Single Mod Download

For single mod downloads, `download_mod` provides a simpler path:

```rust
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
            self.curseforge.as_ref()
                .ok_or_else(|| CoreError::ModDownload("CurseForge API key not configured".into()))?
                .download_file(project_id, file_id).await?
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
```

## Installed Mod Listing

Installed mods are discovered by scanning the instance's `mods/` directory for `.jar` files:

```rust
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
```

The `handle_command` function maps these paths to `InstalledModInfo` structs using the file stem as the mod name.
