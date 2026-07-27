use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use p256::ecdsa::SigningKey as P256SigningKey;
use p256::elliptic_curve::rand_core::OsRng;
use p256::EncodedPoint;
use p384::ecdsa::SigningKey as P384SigningKey;
use p384::EncodedPoint as P384EncodedPoint;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceKeys {
    #[serde(with = "serde_p256_secret")]
    signing_key: Vec<u8>,
    #[serde(with = "serde_base64")]
    pub public_x: Vec<u8>,
    #[serde(with = "serde_base64")]
    pub public_y: Vec<u8>,
    pub device_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityKeys {
    #[serde(with = "serde_p384_secret")]
    signing_key: Vec<u8>,
    #[serde(with = "serde_base64")]
    pub public_key_der: Vec<u8>,
}

impl DeviceKeys {
    pub fn generate() -> Self {
        let signing_key = P256SigningKey::random(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let encoded: EncodedPoint = verifying_key.into();
        let (x, y) = split_point(&encoded);
        let device_id = uuid::Uuid::new_v4().to_string();
        Self {
            signing_key: signing_key.to_bytes().to_vec(),
            public_x: x,
            public_y: y,
            device_id,
        }
    }

    pub fn signing_key(&self) -> P256SigningKey {
        P256SigningKey::from_bytes(self.signing_key.as_slice().into())
            .expect("invalid stored P-256 key")
    }

    pub fn proof_key_jwk(&self) -> serde_json::Value {
        serde_json::json!({
            "kty": "EC",
            "crv": "P-256",
            "use": "sig",
            "alg": "ES256",
            "x": URL_SAFE_NO_PAD.encode(&self.public_x),
            "y": URL_SAFE_NO_PAD.encode(&self.public_y),
        })
    }

    pub fn device_id_braces(&self) -> String {
        format!("{{{}}}", self.device_id)
    }

    pub fn sign(&self, data: &[u8]) -> Vec<u8> {
        use p256::ecdsa::signature::DigestSigner;
        let hasher = Sha256::new().chain_update(data);
        let sig: p256::ecdsa::Signature = self.signing_key().sign_digest(hasher);
        let r = sig.r().to_bytes();
        let s = sig.s().to_bytes();
        let mut out = Vec::with_capacity(64);
        out.extend_from_slice(&r);
        out.extend_from_slice(&s);
        out
    }
}

impl IdentityKeys {
    pub fn generate() -> Self {
        let signing_key = P384SigningKey::random(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let encoded: P384EncodedPoint = verifying_key.into();
        let der = encode_spki_der_p384(&encoded);
        Self {
            signing_key: signing_key.to_bytes().to_vec(),
            public_key_der: der,
        }
    }

    pub fn signing_key(&self) -> P384SigningKey {
        P384SigningKey::from_bytes(self.signing_key.as_slice().into())
            .expect("invalid stored P-384 key")
    }

    pub fn public_key_base64(&self) -> String {
        URL_SAFE_NO_PAD.encode(&self.public_key_der)
    }

    pub fn sign_jwt(&self, payload: &serde_json::Value) -> String {
        use p384::ecdsa::signature::DigestSigner;
        let header = serde_json::json!({
            "typ": "JWT",
            "alg": "ES384"
        });
        let header_b64 = URL_SAFE_NO_PAD.encode(header.to_string().as_bytes());
        let payload_b64 = URL_SAFE_NO_PAD.encode(payload.to_string().as_bytes());
        let signing_input = format!("{header_b64}.{payload_b64}");
        let hasher = Sha256::new().chain_update(signing_input.as_bytes());
        let sig: p384::ecdsa::Signature = self.signing_key().sign_digest(hasher);
        let r = sig.r().to_bytes();
        let s = sig.s().to_bytes();
        let mut sig_bytes = Vec::with_capacity(96);
        sig_bytes.extend_from_slice(&r);
        sig_bytes.extend_from_slice(&s);
        let sig_b64 = URL_SAFE_NO_PAD.encode(&sig_bytes);
        format!("{signing_input}.{sig_b64}")
    }
}

pub fn build_xbox_signature(
    device_keys: &DeviceKeys,
    method: &str,
    path: &str,
    authorization: &str,
    body: &str,
) -> String {
    let now_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let filetime = (now_secs + 11644473600) * 10_000_000u64;

    let policy: u32 = 1;
    let method_bytes = method.as_bytes();
    let path_bytes = path.as_bytes();
    let auth_bytes = authorization.as_bytes();
    let body_bytes = body.as_bytes();

    let mut buf = Vec::new();
    buf.extend_from_slice(&policy.to_le_bytes());
    buf.push(0);
    buf.extend_from_slice(&filetime.to_le_bytes());
    buf.push(0);
    buf.extend_from_slice(&(method_bytes.len() as u32).to_le_bytes());
    buf.push(0);
    buf.extend_from_slice(method_bytes);
    buf.push(0);
    buf.extend_from_slice(&(path_bytes.len() as u32).to_le_bytes());
    buf.push(0);
    buf.extend_from_slice(path_bytes);
    buf.push(0);
    buf.extend_from_slice(&(auth_bytes.len() as u32).to_le_bytes());
    buf.push(0);
    buf.extend_from_slice(auth_bytes);
    buf.push(0);
    buf.extend_from_slice(&(body_bytes.len() as u32).to_le_bytes());
    buf.push(0);
    buf.extend_from_slice(body_bytes);
    buf.push(0);

    let sig_raw = device_keys.sign(&buf);

    let mut out = Vec::with_capacity(76);
    out.extend_from_slice(&1u32.to_le_bytes());
    out.extend_from_slice(&filetime.to_le_bytes());
    out.extend_from_slice(&sig_raw);

    URL_SAFE_NO_PAD.encode(&out)
}

fn split_point(ep: &EncodedPoint) -> (Vec<u8>, Vec<u8>) {
    let bytes = ep.as_bytes();
    let x = bytes[1..33].to_vec();
    let y = bytes[33..65].to_vec();
    (x, y)
}

fn encode_spki_der_p384(ep: &P384EncodedPoint) -> Vec<u8> {
    let point_bytes = ep.as_bytes();
    let x = &point_bytes[1..49];
    let y = &point_bytes[49..97];

    let mut der = Vec::new();
    der.push(0x30);
    der.push(0x81);
    der.push(0x9b);

    der.push(0x30);
    der.push(0x13);
    der.push(0x06);
    der.extend_from_slice(&[0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);
    der.push(0x06);
    der.extend_from_slice(&[0x05, 0x2b, 0x81, 0x04, 0x00, 0x22]);

    der.push(0x03);
    der.push(0x81);
    der.push(0x83);
    der.push(0x00);

    der.push(0x04);
    der.extend_from_slice(x);
    der.extend_from_slice(y);

    der
}

mod serde_p256_secret {
    use serde::{Deserialize, Deserializer, Serializer};
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&URL_SAFE_NO_PAD.encode(bytes))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        URL_SAFE_NO_PAD.decode(&s).map_err(serde::de::Error::custom)
    }
}

mod serde_p384_secret {
    use serde::{Deserialize, Deserializer, Serializer};
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&URL_SAFE_NO_PAD.encode(bytes))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        URL_SAFE_NO_PAD.decode(&s).map_err(serde::de::Error::custom)
    }
}

mod serde_base64 {
    use serde::{Deserialize, Deserializer, Serializer};
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&URL_SAFE_NO_PAD.encode(bytes))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        URL_SAFE_NO_PAD.decode(&s).map_err(serde::de::Error::custom)
    }
}
