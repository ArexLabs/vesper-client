use crate::error::{AppError, DownloadError};
use reqwest::Url;
use std::path::{Path, PathBuf};
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;

pub struct Downloader;

impl Downloader {
    pub async fn download(
        file_url: &str,
        dest_dir: &Path,
        enable_deduplication: bool,
    ) -> Result<PathBuf, AppError> {
        let parsed_url = Url::parse(file_url).map_err(|_| DownloadError::InvalidUrl)?;
        let filename = parsed_url
            .path_segments()
            .and_then(|segments| segments.rev().next())
            .ok_or(DownloadError::InvalidUrl)?;
        let dest_path = dest_dir.join(filename);

        if enable_deduplication && dest_path.exists() {
            return Err(DownloadError::Duplicate.into());
        }

        fs::create_dir_all(dest_dir).await?;

        let response = reqwest::get(parsed_url).await?;
        if !response.status().is_success() {
            return Err(AppError::ModrinthApi(
                response.error_for_status().unwrap_err(),
            ));
        }

        let mut dest_file = File::create(&dest_path).await?;
        let content = response.bytes().await?;
        dest_file.write_all(&content).await?;

        Ok(dest_path)
    }
}
