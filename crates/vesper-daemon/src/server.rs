use tonic::transport::{Server, Identity, ServerTlsConfig, Uri};
use std::net::SocketAddr;
use crate::services::DaemonService;

pub struct DaemonServer {
    addr: SocketAddr,
}

impl DaemonServer {
    pub fn new() -> anyhow::Result<Self> {
        let addr = "127.0.0.1:50051".parse()?;
        Ok(Self { addr })
    }

    pub async fn run(&self) -> anyhow::Result<()> {
        tracing::info!("Starting gRPC server on {}", self.addr);

        let service = DaemonService::new();

        Server::builder()
            .add_service(vesper_proto::daemon_service_server::DaemonServiceServer::new(service))
            .serve(self.addr)
            .await?;

        Ok(())
    }
}