use vesper_core::Result;

pub struct UpdateRollback;

impl UpdateRollback {
    pub async fn restore(backup_path: &std::path::Path) -> Result<()> {
        Ok(())
    }

    pub async fn create_backup() -> Result<std::path::PathBuf> {
        Ok(std::path::PathBuf::new())
    }
}