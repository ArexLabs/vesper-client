use vesper_core::cache::CacheEntry;

pub struct CacheService;

impl CacheService {
    pub fn new() -> Self {
        Self
    }

    pub async fn get_status(&self) -> CacheStatus {
        CacheStatus {
            total_size_bytes: 0,
            version_manifest_size: 0,
            asset_size: 0,
            library_size: 0,
            mod_size: 0,
        }
    }

    pub async fn clear(&self, cache_type: Option<&str>) -> Result<u64, vesper_core::Error> {
        Ok(0)
    }
}

pub struct CacheStatus {
    pub total_size_bytes: u64,
    pub version_manifest_size: u64,
    pub asset_size: u64,
    pub library_size: u64,
    pub mod_size: u64,
}