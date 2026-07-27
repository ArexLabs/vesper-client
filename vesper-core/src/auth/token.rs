use crate::auth::models::StoredTokens;
use crate::config::global::VesperConfig;
use crate::error::CoreResult;

pub fn store_tokens(config: &mut VesperConfig, _tokens: StoredTokens, _profile_id: &str) -> CoreResult<()> {
    config.save()?;
    Ok(())
}

pub fn is_token_expired(tokens: &StoredTokens) -> bool {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    tokens.expires_at <= now + 300
}
