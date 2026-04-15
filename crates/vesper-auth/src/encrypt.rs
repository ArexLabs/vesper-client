pub struct AccountEncryptor;

impl AccountEncryptor {
    pub fn encrypt(key: &[u8; 32], data: &[u8]) -> Vec<u8> {
        use aes_gcm::{
            aead::{Aead, KeyInit},
            Aes256Gcm, Nonce,
        };
        use rand::RngCore;
        
        let cipher = Aes256Gcm::new_from_slice(key).expect("valid key");
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let ciphertext = cipher.encrypt(nonce, data).expect("encryption success");
        
        let mut result = nonce_bytes.to_vec();
        result.extend(ciphertext);
        result
    }

    pub fn decrypt(key: &[u8; 32], data: &[u8]) -> Option<Vec<u8>> {
        use aes_gcm::{
            aead::{Aead, KeyInit},
            Aes256Gcm, Nonce,
        };
        
        if data.len() < 12 {
            return None;
        }
        
        let cipher = Aes256Gcm::new_from_slice(key).expect("valid key");
        let nonce = Nonce::from_slice(&data[..12]);
        let ciphertext = &data[12..];
        
        cipher.decrypt(nonce, ciphertext).ok()
    }
}