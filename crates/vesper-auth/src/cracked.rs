use vesper_core::account::{Account, CrackedProfile, AccountType};
use uuid::Uuid;
use vesper_core::Result;

pub fn create_cracked_account(username: String) -> Result<Account> {
    let uuid = generate_offline_uuid(&username);
    Ok(Account::new_cracked(username, uuid))
}

fn generate_offline_uuid(username: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    "OfflinePlayer".hash(&mut hasher);
    username.hash(&mut hasher);
    let hash = hasher.finish();
    
    let bytes = hash.to_le_bytes();
    let mut uuid_bytes = [0u8; 16];
    uuid_bytes[..8].copy_from_slice(&bytes);
    uuid_bytes[8..].copy_from_slice(&bytes);
    
    let (d1, d2) = u128::from_le_bytes(uuid_bytes).overflowing_add(3);
    Uuid::from_u128(d1).to_string()
}