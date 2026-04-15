use reqwest::Client;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use futures::StreamExt;
use vesper_core::download::{DownloadTask, DownloadStatus, DownloadProgress};
use vesper_core::Result;

pub struct Downloader {
    client: Client,
    tasks: Arc<RwLock<HashMap<String, DownloadTask>>>,
    max_concurrent: usize,
}

impl Downloader {
    pub fn new(max_concurrent: usize) -> Self {
        let client = Client::builder()
            .pool_max_idle_per_host(max_concurrent)
            .build()
            .expect("valid client");
        
        Self {
            client,
            tasks: Arc::new(RwLock::new(HashMap::new())),
            max_concurrent,
        }
    }

    pub async fn add_task(&self, task: DownloadTask) {
        let mut tasks = self.tasks.write().await;
        tasks.insert(task.id.to_string(), task);
    }

    pub async fn start_download(
        &self,
        task_id: &str,
    ) -> Result<futures::channel::mpsc::Receiver<DownloadProgress>> {
        let tasks = self.tasks.read().await;
        let task = tasks.get(task_id)
            .ok_or_else(|| vesper_core::Error::not_found("Task not found"))?
            .clone();
        drop(tasks);

        let (tx, rx) = futures::channel::mpsc::channel(100);
        let client = self.client.clone();
        let task_id = task_id.to_string();

        tokio::spawn(async move {
            if let Err(e) = self.download_file(client, task, tx).await {
                tracing::error!("Download failed: {}", e);
            }
        });

        Ok(rx)
    }

    async fn download_file(
        &self,
        client: Client,
        task: DownloadTask,
        progress_tx: futures::channel::mpsc::Sender<DownloadProgress>,
    ) -> Result<()> {
        let response = client.get(&task.url).send().await
            .map_err(|e| vesper_core::Error::network(e.to_string()))?;

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();
        let mut chunk_index: u32 = 0;

        while let Some(chunk) = stream.next().await {
            let data = chunk.map_err(|e| vesper_core::Error::network(e.to_string()))?;
            downloaded += data.len() as u64;
            chunk_index += 1;

            let progress = DownloadProgress {
                task_id: task.id.clone(),
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                chunks_completed: chunk_index,
                chunks_total: (total_size / task.chunk_size as u64) as u32,
                speed_bps: 0,
            };

            progress_tx.send(progress).await.ok();
        }

        Ok(())
    }

    pub async fn cancel(&self, task_id: &str) -> Result<()> {
        let mut tasks = self.tasks.write().await;
        if let Some(task) = tasks.get_mut(task_id) {
            task.status = DownloadStatus::Cancelled;
        }
        Ok(())
    }

    pub async fn get_progress(&self, task_id: &str) -> Result<Option<DownloadProgress>> {
        let tasks = self.tasks.read().await;
        Ok(tasks.get(task_id).map(|_| DownloadProgress {
            task_id: vesper_core::DownloadId::new(),
            downloaded_bytes: 0,
            total_bytes: 0,
            chunks_completed: 0,
            chunks_total: 0,
            speed_bps: 0,
        }))
    }
}