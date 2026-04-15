use tonic::{Request, Response, Status};
use vesper_core::instance::{InstanceMetadata, InstanceFolder};
use vesper_core::ident::InstanceId;
use vesper_core::Result;
use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;

pub struct InstanceService {
    instances: Arc<RwLock<HashMap<String, InstanceMetadata>>>,
}

impl InstanceService {
    pub fn new() -> Self {
        Self {
            instances: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn list_instances(&self) -> Vec<InstanceMetadata> {
        let instances = self.instances.read().await;
        instances.values().cloned().collect()
    }

    pub async fn get_instance(&self, id: &InstanceId) -> Option<InstanceMetadata> {
        let instances = self.instances.read().await;
        instances.get(&id.to_string()).cloned()
    }

    pub async fn create_instance(&self, name: String, game_version: String, loader: vesper_core::instance::Loader) -> Result<InstanceMetadata> {
        let metadata = InstanceMetadata::new(name, game_version, loader);
        let mut instances = self.instances.write().await;
        instances.insert(metadata.id.to_string(), metadata.clone());
        Ok(metadata)
    }

    pub async fn delete_instance(&self, id: &InstanceId) -> Result<()> {
        let mut instances = self.instances.write().await;
        instances.remove(&id.to_string());
        Ok(())
    }
}

#[async_trait]
impl vesper_proto::daemon_service_server::DaemonService for InstanceService {
    async fn list_instances(
        &self,
        request: Request<()>,
    ) -> Result<Response<vesper_proto::ListInstancesResponse>, Status> {
        let instances = self.list_instances().await;
        let infos: Vec<vesper_proto::InstanceInfo> = instances
            .iter()
            .map(|i| vesper_proto::InstanceInfo {
                id: i.id.to_string(),
                name: i.name.clone(),
                game_version: i.game_version.clone(),
                loader: i.loader.loader_id().to_string(),
                loader_version: "".to_string(),
                java_path: i.java_version.as_ref().map(|j| j.path.clone()).unwrap_or_default(),
                java_version: i.java_version.as_ref().map(|j| j.version.clone()).unwrap_or_default(),
                running: i.running,
                play_time_seconds: i.play_time_seconds,
                last_played: i.last_played.map(|t| t.to_rfc3339()).unwrap_or_default(),
                created_at: i.created_at.to_rfc3339(),
                folder_path: "".to_string(),
            })
            .collect();

        Ok(Response::new(vesper_proto::ListInstancesResponse { instances: infos }))
    }

    async fn get_instance(
        &self,
        request: Request<vesper_proto::GetInstanceRequest>,
    ) -> Result<Response<vesper_proto::InstanceInfo>, Status> {
        let req = request.into_inner();
        let id: InstanceId = req.instance_id.parse().map_err(|_| Status::invalid_argument("Invalid ID"))?;
        
        let instance = self.get_instance(&id).await
            .ok_or_else(|| Status::not_found("Instance not found"))?;

        Ok(Response::new(vesper_proto::InstanceInfo {
            id: instance.id.to_string(),
            name: instance.name,
            game_version: instance.game_version,
            loader: instance.loader.loader_id().to_string(),
            loader_version: "".to_string(),
            java_path: instance.java_version.as_ref().map(|j| j.path.clone()).unwrap_or_default(),
            java_version: instance.java_version.as_ref().map(|j| j.version.clone()).unwrap_or_default(),
            running: instance.running,
            play_time_seconds: instance.play_time_seconds,
            last_played: instance.last_played.map(|t| t.to_rfc3339()).unwrap_or_default(),
            created_at: instance.created_at.to_rfc3339(),
            folder_path: "".to_string(),
        }))
    }

    async fn create_instance(
        &self,
        request: Request<vesper_proto::CreateInstanceRequest>,
    ) -> Result<Response<vesper_proto::InstanceInfo>, Status> {
        let req = request.into_inner();
        let loader = vesper_core::instance::Loader::from_loader_id(&req.loader)
            .ok_or_else(|| Status::invalid_argument("Invalid loader"))?;

        let instance = self.create_instance(req.name, req.game_version, loader)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(vesper_proto::InstanceInfo {
            id: instance.id.to_string(),
            name: instance.name,
            game_version: instance.game_version,
            loader: instance.loader.loader_id().to_string(),
            loader_version: "".to_string(),
            java_path: "".to_string(),
            java_version: "".to_string(),
            running: false,
            play_time_seconds: 0,
            last_played: "".to_string(),
            created_at: instance.created_at.to_rfc3339(),
            folder_path: "".to_string(),
        }))
    }
}