use vesper_core::Result;

pub struct UpdateApplicator;

impl UpdateApplicator {
    pub async fn apply(update_info: &super::check::UpdateInfo) -> Result<()> {
        Ok(())
    }

    pub async fn rollback(backup_path: &std::path::Path) -> Result<()> {
        Ok(())
    }

    pub fn verify_integrity(data: &[u8], expected_sha256: &str) -> bool {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = hasher.finalize();
        hex::encode(result) == expected_sha256.to_lowercase()
    }
}