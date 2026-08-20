# Testing

## cargo test Workflow

```bash
# Run all tests
cargo test

# Run tests in a specific crate
cargo test -p vesper-core
cargo test -p vesper-client

# Run a specific test
cargo test test_name

# Run with output shown
cargo test -- --nocapture

# Run tests matching a pattern
cargo test auth
```

## Integration Test Patterns

Tests should be organized at the crate level. Add tests in `src/` files using `#[cfg(test)]` modules or in a top-level `tests/` directory for integration tests.

### Unit Test Example

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_instance_id_generation() {
        let manager = InstanceManager::new().unwrap();
        let id = manager.generate_id("My World");
        assert!(id.starts_with("my-world-"));
        assert!(id.len() > 10);
    }

    #[test]
    fn test_loader_type_from_str() {
        assert_eq!(LoaderType::from_str_loose("Fabric"), LoaderType::Fabric);
        assert_eq!(LoaderType::from_str_loose("neoforge"), LoaderType::NeoForge);
        assert_eq!(LoaderType::from_str_loose("neo-forge"), LoaderType::NeoForge);
        assert_eq!(LoaderType::from_str_loose("anything"), LoaderType::Vanilla);
    }

    #[test]
    fn test_token_expiry() {
        let tokens = StoredTokens {
            access_token: "test".into(),
            refresh_token: "test".into(),
            expires_at: 0,  // already expired
            scope: String::new(),
            token_type: String::new(),
            mc_access_token: None,
            mc_profile: None,
        };
        assert!(is_token_expired(&tokens));
    }

    #[test]
    fn test_progress_fraction() {
        let update = ProgressUpdate::TaskProgress {
            task: "download".into(),
            current: 50,
            total: Some(100),
        };
        assert_eq!(update.fraction(), 0.5);
    }
}
```

### Test Helper Patterns

```rust
// Creating test configs
fn test_instance_config() -> InstanceConfig {
    InstanceConfig::new(
        "Test Instance".into(),
        "1.21.50".into(),
        LoaderType::Vanilla,
        None,
    )
}

// Creating test ModInfo
fn test_mod_info() -> ModInfo {
    ModInfo {
        project_id: "proj-1".into(),
        file_id: "file-1".into(),
        name: "Test Mod".into(),
        description: "A test mod".into(),
        version: "1.0.0".into(),
        downloads: 1000,
        icon_url: None,
        source: ModSource::Modrinth,
    }
}
```

## Mock Strategies for External APIs

External API calls (Microsoft auth, Modrinth, CurseForge, Minecraft services) should be mocked at the HTTP client level.

### Mocking reqwest

The `AuthManager` and `ModrinthClient` both use `reqwest::Client` internally. For unit tests, consider:

1. **Trait-based abstraction**: Define a trait for HTTP operations and implement it for both real and mock clients
2. **Test servers**: Use `axum` or `warp` to spin up local test servers
3. **Response fixtures**: Store API responses as JSON files and return them from mocks

```rust
// Example: mock-style test for token expiry logic
#[test]
fn test_config_default_memory() {
    let config = VesperConfig::default();
    // Should be between 1024 and 8192 MB
    assert!(config.max_memory_mb >= 1024);
    assert!(config.max_memory_mb <= 8192);
}

#[test]
    fn test_instance_config_serialization() {
    let config = test_instance_config();
    let toml = toml::to_string_pretty(&config).unwrap();
    let parsed: InstanceConfig = toml::from_str(&toml).unwrap();
    assert_eq!(parsed.name, config.name);
    assert_eq!(parsed.mc_version, config.mc_version);
}
```

### Key Areas to Mock

| Component | What to Mock | Why |
|---|---|---|
| `AuthManager` | MS OAuth responses | Avoids real auth in tests |
| `ModrinthClient` | Search/download responses | Avoids network calls |
| `CurseForgeClient` | Search/download responses | Avoids network calls |
| `mc-launcher-core` | Install progress events | Tests progress reporting |
| `GameInstaller` | Filesystem operations | Tests without game files |

## Manual Testing Checklist

### Authentication
- [ ] Java Edition browser login completes successfully
- [ ] Bedrock Edition browser login completes successfully
- [ ] Auth error displays correctly in UI
- [ ] Logout clears state properly
- [ ] Token refresh works after expiry

### Instance Management
- [ ] Create instance with Vanilla loader
- [ ] Create instance with Fabric loader
- [ ] Create instance with NeoForge loader
- [ ] List instances shows all created
- [ ] Delete instance removes directory
- [ ] Duplicate instance names produce unique IDs

### Game Launch
- [ ] Install downloads correct files
- [ ] Progress bar updates during install
- [ ] Game launches with correct Java path
- [ ] Game launches with correct memory settings
- [ ] Launch error displays in UI

### Mod Management
- [ ] Modrinth search returns results
- [ ] CurseForge search returns results (with API key)
- [ ] Single mod download completes
- [ ] Multiple concurrent downloads complete
- [ ] Downloaded mods appear in instance mods directory
- [ ] Mod list shows installed mods

### Cross-Platform
- [ ] Config directory created correctly on Linux
- [ ] Config directory created correctly on macOS
- [ ] Config directory created correctly on Windows
- [ ] Instance isolation prevents file conflicts
