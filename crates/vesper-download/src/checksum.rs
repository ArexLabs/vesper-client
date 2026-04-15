use sha2::{Sha1, Digest};

pub fn verify_checksum(data: &[u8], expected: &str) -> bool {
    let mut hasher = Sha1::new();
    hasher.update(data);
    let result = hasher.finalize();
    hex::encode(result) == expected.to_lowercase()
}

pub fn compute_checksum(data: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}