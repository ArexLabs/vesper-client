use crate::config::instance::{InstanceConfig, InstanceInfo, LoaderType};
use crate::config::instances_dir;
use crate::error::{CoreError, CoreResult};
use std::fs;
use std::path::PathBuf;

#[derive(Clone)]
pub struct InstanceManager {
    base_dir: PathBuf,
}

impl InstanceManager {
    pub fn new() -> CoreResult<Self> {
        let base_dir = instances_dir()?;
        Ok(Self { base_dir })
    }

    pub fn create(
        &self,
        name: &str,
        mc_version: &str,
        loader_type: LoaderType,
        loader_version: Option<String>,
    ) -> CoreResult<InstanceInfo> {
        let id = self.generate_id(name);

        let instance_dir = self.base_dir.join(&id);
        if instance_dir.exists() {
            return Err(CoreError::InstanceAlreadyExists(id));
        }

        fs::create_dir_all(instance_dir.join("mods"))?;
        fs::create_dir_all(instance_dir.join(".minecraft"))?;

        let config = InstanceConfig::new(
            name.to_string(),
            mc_version.to_string(),
            loader_type,
            loader_version,
        );

        let toml_content = toml::to_string_pretty(&config)?;
        fs::write(instance_dir.join("instance.toml"), toml_content)?;

        Ok(InstanceInfo { id, config })
    }

    pub fn list(&self) -> CoreResult<Vec<InstanceInfo>> {
        let mut instances = Vec::new();

        if !self.base_dir.exists() {
            return Ok(instances);
        }

        for entry in fs::read_dir(&self.base_dir)? {
            let entry = entry?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let toml_path = path.join("instance.toml");
            if !toml_path.exists() {
                continue;
            }

            let contents = fs::read_to_string(&toml_path)?;
            match toml::from_str::<InstanceConfig>(&contents) {
                Ok(config) => {
                    let id = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();
                    instances.push(InstanceInfo { id, config });
                }
                Err(e) => {
                    tracing::warn!("Failed to parse instance config at {}: {e}", toml_path.display());
                }
            }
        }

        instances.sort_by(|a, b| a.config.name.cmp(&b.config.name));
        Ok(instances)
    }

    pub fn get(&self, id: &str) -> CoreResult<InstanceConfig> {
        let toml_path = self.base_dir.join(id).join("instance.toml");
        if !toml_path.exists() {
            return Err(CoreError::InstanceNotFound(id.to_string()));
        }
        let contents = fs::read_to_string(&toml_path)?;
        let config: InstanceConfig = toml::from_str(&contents)?;
        Ok(config)
    }

    pub fn update(&self, id: &str, config: &InstanceConfig) -> CoreResult<()> {
        let toml_path = self.base_dir.join(id).join("instance.toml");
        if !toml_path.exists() {
            return Err(CoreError::InstanceNotFound(id.to_string()));
        }
        let toml_content = toml::to_string_pretty(config)?;
        fs::write(&toml_path, toml_content)?;
        Ok(())
    }

    pub fn delete(&self, id: &str) -> CoreResult<()> {
        let instance_dir = self.base_dir.join(id);
        if !instance_dir.exists() {
            return Err(CoreError::InstanceNotFound(id.to_string()));
        }
        fs::remove_dir_all(&instance_dir)?;
        Ok(())
    }

    pub fn minecraft_dir(&self, id: &str) -> PathBuf {
        self.base_dir.join(id).join(".minecraft")
    }

    pub fn mods_dir(&self, id: &str) -> PathBuf {
        self.base_dir.join(id).join("mods")
    }

    pub fn instance_dir(&self, id: &str) -> PathBuf {
        self.base_dir.join(id)
    }

    fn generate_id(&self, name: &str) -> String {
        let slug: String = name
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '-' || c == '_' {
                    c.to_ascii_lowercase()
                } else if c == ' ' {
                    '-'
                } else {
                    '_'
                }
            })
            .collect();

        let uuid_suffix = {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut hasher = DefaultHasher::new();
            name.hash(&mut hasher);
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos();
            now.hash(&mut hasher);
            format!("{:x}", hasher.finish()).chars().take(6).collect::<String>()
        };

        format!("{slug}-{uuid_suffix}")
    }
}
