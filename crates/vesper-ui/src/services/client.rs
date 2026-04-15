use vesper_proto::daemon_service_client::DaemonServiceClient;
use vesper_proto::*;
use tonic::transport::Channel;

pub struct DaemonClient {
    client: Option<DaemonServiceClient<Channel>>,
}

impl DaemonClient {
    pub fn new() -> Self {
        Self { client: None }
    }

    pub async fn connect(&mut self) -> Result<(), String> {
        let channel = Channel::from_static("http://127.0.0.1:50051")
            .connect()
            .await
            .map_err(|e| e.to_string())?;

        self.client = Some(DaemonServiceClient::new(channel));
        Ok(())
    }

    pub async fn health_check(&mut self) -> Result<bool, String> {
        if self.client.is_none() {
            self.connect().await?;
        }

        if let Some(ref mut client) = self.client {
            let request = tonic::Request::new(HealthCheckRequest {
                client_version: env!("CARGO_PKG_VERSION").to_string(),
            });
            
            match client.health_check(request).await {
                Ok(response) => Ok(response.into_inner().healthy),
                Err(e) => Err(e.to_string()),
            }
        } else {
            Err("Not connected".to_string())
        }
    }

    pub async fn list_instances(&mut self) -> Result<Vec<InstanceInfo>, String> {
        if self.client.is_none() {
            self.connect().await?;
        }

        if let Some(ref mut client) = self.client {
            let request = tonic::Request::new(());
            match client.list_instances(request).await {
                Ok(response) => Ok(response.into_inner().instances),
                Err(e) => Err(e.to_string()),
            }
        } else {
            Err("Not connected".to_string())
        }
    }

    pub async fn create_instance(
        &mut self,
        name: String,
        game_version: String,
        loader: String,
    ) -> Result<InstanceInfo, String> {
        if self.client.is_none() {
            self.connect().await?;
        }

        if let Some(ref mut client) = self.client {
            let request = tonic::Request::new(CreateInstanceRequest {
                name,
                game_version,
                loader,
                loader_version: "".to_string(),
                java_path: "".to_string(),
            });
            
            match client.create_instance(request).await {
                Ok(response) => Ok(response.into_inner()),
                Err(e) => Err(e.to_string()),
            }
        } else {
            Err("Not connected".to_string())
        }
    }
}