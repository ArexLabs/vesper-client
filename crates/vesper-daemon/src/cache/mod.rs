pub mod modrs;

pub struct CacheManager;

impl CacheManager {
    pub fn new() -> Self {
        Self
    }

    pub fn calculate_size(&self, path: &std::path::Path) -> std::io::Result<u64> {
        let mut size = 0;
        if path.is_dir() {
            for entry in std::fs::read_dir(path)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_dir() {
                    size += self.calculate_size(&path)?;
                } else {
                    size += std::fs::metadata(&path)?.len();
                }
            }
        }
        Ok(size)
    }
}