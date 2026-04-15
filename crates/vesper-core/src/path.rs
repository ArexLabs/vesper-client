use directories::ProjectDirs;
use std::path::PathBuf;
use once_cell::sync::Lazy;

pub static VESPER_DIRS: Lazy<VesperDirs> = Lazy::new(VesperDirs::new);

pub struct VesperDirs {
    pub data_dir: PathBuf,
    pub config_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub instances_dir: PathBuf,
    pub log_dir: PathBuf,
}

impl VesperDirs {
    fn new() -> Self {
        let proj = ProjectDirs::from("com", "vesper", "vesper")
            .expect("Failed to determine project directories");
        
        let data_dir = proj.data_dir().to_path_buf();
        let config_dir = proj.config_dir().to_path_buf();
        let cache_dir = dirs::cache_dir().unwrap_or_else(|| data_dir.join("cache"));
        let instances_dir = data_dir.join("instances");
        let log_dir = data_dir.join("logs");

        Self {
            data_dir,
            config_dir,
            cache_dir,
            instances_dir,
            log_dir,
        }
    }

    pub fn ensure_dirs(&self) -> std::io::Result<()> {
        use std::fs;
        fs::create_dir_all(&self.data_dir)?;
        fs::create_dir_all(&self.config_dir)?;
        fs::create_dir_all(&self.cache_dir)?;
        fs::create_dir_all(&self.instances_dir)?;
        fs::create_dir_all(&self.log_dir)?;
        Ok(())
    }

    pub fn cache_subdir(&self, name: &str) -> PathBuf {
        self.cache_dir.join(name)
    }
}

#[cfg(feature = "dirs")]
extern crate dirs;

#[cfg(not(feature = "dirs"))]
mod dirs {
    use std::path::PathBuf;
    pub fn cache_dir() -> Option<PathBuf> {
        std::env::var("XDG_CACHE_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| std::env::var("LOCALAPPDATA").ok().map(PathBuf::from))
    }
}