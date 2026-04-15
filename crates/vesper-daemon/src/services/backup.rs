use vesper_core::backup::{Backup, BackupSchedule};

pub struct BackupService;

impl BackupService {
    pub fn new() -> Self {
        Self
    }

    pub async fn create_backup(&self, instance_id: &str, message: &str) -> Result<Backup, vesper_core::Error> {
        Ok(Backup::new(
            vesper_core::ident::InstanceId::new(),
            message.to_string(),
            "abc123".to_string(),
        ))
    }

    pub async fn list_backups(&self, instance_id: &str) -> Vec<Backup> {
        vec![]
    }

    pub async fn restore_backup(&self, instance_id: &str, backup_id: &str) -> Result<(), vesper_core::Error> {
        Ok(())
    }
}