use serde::{Deserialize, Serialize};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use base64::Engine;

const NONCE_SIZE: usize = 12;
const KEY_SIZE: usize = 32;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
}

pub struct AccountEncryptor {
    cipher: Aes256Gcm,
}

impl AccountEncryptor {
    pub fn new(key: &[u8; KEY_SIZE]) -> Self {
        let cipher = Aes256Gcm::new_from_slice(key).expect("valid key");
        Self { cipher }
    }

    pub fn from_password(password: &str, salt: &[u8]) -> Self {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        hasher.update(salt);
        let result = hasher.finalize();
        let mut key = [0u8; KEY_SIZE];
        key.copy_from_slice(&result);
        Self::new(&key)
    }

    pub fn encrypt(&self, plaintext: &[u8]) -> EncryptedData {
        let mut nonce_bytes = [0u8; NONCE_SIZE];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = self.cipher.encrypt(nonce, plaintext).expect("encryption success");
        EncryptedData {
            nonce: nonce_bytes.to_vec(),
            ciphertext,
        }
    }

    pub fn decrypt(&self, data: &EncryptedData) -> Option<Vec<u8>> {
        let nonce = Nonce::from_slice(&data.nonce);
        self.cipher.decrypt(nonce, data.cipher.as_ref()).ok()
    }
}

pub fn derive_key(password: &str, salt: &[u8]) -> [u8; KEY_SIZE] {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(salt);
    let result = hasher.finalize();
    let mut key = [0u8; KEY_SIZE];
    key.copy_from_slice(&result);
    key
}