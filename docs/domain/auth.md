# Authentication

Vesper Client supports two authentication paths: Microsoft OAuth2 for Java Edition and a multi-step Bedrock Edition chain. Both flows begin with a Microsoft browser login.

## MS OAuth2 Browser Login Flow

```
User clicks Login
    |
    v
start_browser_login()
    |-- Bind TcpListener to 127.0.0.1:0 (OS picks port)
    |-- Drop listener (free the port)
    |-- Generate PKCE challenge + verifier
    |-- Build authorize URL with XboxLive.SignIn + offline_access scopes
    |-- Return (auth_url, csrf_state, pkce_verifier, port)
    |
    v
Open browser to Microsoft authorize URL
    |
    v
complete_browser_login(port, pkce_verifier, expected_state)
    |-- Re-bind TcpListener to 127.0.0.1:{port}
    |-- Wait for HTTP callback (300s timeout)
    |-- Parse ?code=...&state=... from callback URL
    |-- Validate CSRF state matches
    |-- Exchange authorization code for MS access token + refresh token
    |-- Call exchange_for_minecraft():
    |   |-- xbox_live_auth() -> Xbox Live token
    |   |-- xsts_auth() -> XSTS token + user hash
    |   |-- mc_login() -> Minecraft access token
    |   └-- mc_get_profile() -> McProfile (UUID, name, skins)
    |-- Return StoredTokens
    |
    v
UiUpdate::AuthSuccess { profile } sent to UI
```

### PKCE Implementation

The browser login uses PKCE (Proof Key for Code Exchange) for security:

```rust
let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

// In authorize URL construction:
.client.authorize_url(CsrfToken::new_random)
    .add_scope(Scope::new("XboxLive.SignIn"))
    .add_scope(Scope::new("XboxLive.offline_access"))
    .set_pkce_challenge(pkce_challenge)
    .add_extra_param("prompt", "select_account")
    .url();

// In token exchange:
let pkce_verifier = PkceCodeVerifier::new(pkce_verifier_secret.to_string());
client.exchange_code(AuthorizationCode::new(code))
    .set_pkce_verifier(pkce_verifier)
    .request_async(&self.http_client)
    .await?;
```

The PKCE verifier is generated at `start_browser_login` time, returned as a string, and passed back to `complete_browser_login` after the browser redirect.

## Xbox Live -> XSTS -> Minecraft Token Exchange

```rust
async fn exchange_for_minecraft(&self, ms_access_token: &str) -> CoreResult<(String, McProfile)> {
    let xbox_token = self.xbox_live_auth(ms_access_token).await?;
    let (xsts_token, uhs) = self.xsts_auth(&xbox_token).await?;
    let mc_token = self.mc_login(&xsts_token, &uhs).await?;
    let mc_profile = self.mc_get_profile(&mc_token).await?;
    Ok((mc_token, mc_profile))
}
```

### Xbox Live Auth

```rust
let body = serde_json::json!({
    "Properties": {
        "AuthMethod": "RPS",
        "SiteName": "user.auth.xboxlive.com",
        "RpsTicket": format!("d={ms_token}")
    },
    "RelyingParty": "http://auth.xboxlive.com",
    "TokenType": "JWT"
});
```

### XSTS Auth

```rust
let body = serde_json::json!({
    "Properties": {
        "SandboxId": "RETAIL",
        "UserTokens": [xbox_token]
    },
    "RelyingParty": "rp://api.minecraftservices.com/",
    "TokenType": "JWT"
});
```

XSTS errors with `XErr` codes indicate the account may not own Minecraft.

### Minecraft Login

```rust
let identity_token = format!("XBL3.0 x={uhs};{xsts_token}");
let body = serde_json::json!({ "identityToken": identity_token });
// POST to https://api.minecraftservices.com/authentication/login_with_xbox
```

### Minecraft Profile Fetch

```rust
// GET https://api.minecraftservices.com/minecraft/profile with Bearer token
// Returns: { id, name, skins: [{ id, state, url, variant }] }
```

## Device Code Flow

An alternative login method using device code authorization:

```rust
pub async fn start_device_code_flow(&self) -> CoreResult<(
    StandardDeviceAuthorizationResponse,
    String,       // user_code
    String,       // verification_uri
    u64,          // expires_in seconds
)> {
    let details = self.oauth_client
        .exchange_device_code()
        .add_scope(Scope::new("XboxLive.SignIn"))
        .add_scope(Scope::new("XboxLive.offline_access"))
        .request_async(&self.http_client)
        .await?;
    // ...
}

pub async fn poll_device_code(&self, details: &StandardDeviceAuthorizationResponse) -> CoreResult<StoredTokens> {
    let token_result = self.oauth_client
        .exchange_device_access_token(details)
        .request_async(&self.http_client, sleep_fn, None)
        .await?;
    // Then same exchange_for_minecraft() chain
}
```

The device code flow polls Microsoft's token endpoint until the user completes authorization on a separate device.

## Bedrock Edition Auth Chain

Bedrock authentication requires a multi-step chain with cryptographic device and identity keys.

### Full Auth Sequence

```
full_bedrock_auth(ms_access_token, device_keys, identity_keys)
    |
    v
1. device_auth(device_keys)
    |-- POST /device/authenticate with ProofOfPossession
    |-- DeviceType: "Android", includes proof key JWK
    |-- Xbox signature over POST body
    |-- Returns: (device_token, device_id)
    |
    v
2. sisu_authorize(device_keys, ms_access_token, device_token)
    |-- POST /authorize at sisu.xboxlive.com
    |-- AccessToken: "t={ms_access_token}"
    |-- AppId: "0000000048183522"
    |-- Returns: (xsts_token, user_hash, user_token, title_token)
    |
    v
3. get_bedrock_cert_chain(identity_keys, xsts_token, user_hash)
    |-- POST to multiplayer.minecraft.net/authentication
    |-- Authorization: "XBL3.0 x={user_hash};{xsts_token}"
    |-- identityPublicKey: base64-encoded P-384 SPKI DER
    |-- Returns: Vec<String> (JWT cert chain, minimum 2 elements)
    |
    v
4. extract_profile_from_cert(cert_chain[1])
    |-- Decode JWT payload (base64)
    |-- Extract extraData.XUID, displayName, titleId
    |
    v
5. playfab_login(user_hash, xsts_token)
    |-- XSTS auth with relying party: minecraft.playfabapi.com
    |-- PlayFab LoginWithXbox
    |-- Returns: (session_ticket, playfab_auth_header)
    |
    v
Returns BedrockAuthResult with all tokens and profile
```

### Cryptographic Keys

**Device Keys** (P-256 / ES256):
- Generated once per auth session via `DeviceKeys::generate()`
- Used for Xbox proof-of-possession signatures
- Contains: signing key, public x/y coordinates, UUID device ID
- Signs Xbox request bodies with SHA-256 + ECDSA

**Identity Keys** (P-384 / ES384):
- Generated once per auth session via `IdentityKeys::generate()`
- Used for Bedrock cert chain and JWT signing
- Contains: signing key, public key in SPKI DER format
- Signs JWTs with SHA-256 + ECDSA (P-384)

### Xbox Signature Construction

```rust
pub fn build_xbox_signature(
    device_keys: &DeviceKeys,
    method: &str,
    path: &str,
    authorization: &str,
    body: &str,
) -> String {
    // Build binary payload:
    // [policy(4)] [0] [filetime(8)] [0] [method_len(4)] [0] [method] [0] ...
    // Sign with P-256 ECDSA
    // Return: base64(version(4) + filetime(8) + signature(64))
}
```

## Token Storage and Expiration

```rust
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64,           // Unix timestamp
    pub scope: String,
    pub token_type: String,
    pub mc_access_token: Option<String>,
    pub mc_profile: Option<McProfile>,
}
```

Token expiration check (5-minute buffer):

```rust
pub fn is_token_expired(tokens: &StoredTokens) -> bool {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    tokens.expires_at <= now + 300
}
```

Token refresh uses the stored `refresh_token` to exchange for new MS tokens, then re-runs the full Minecraft exchange chain.

## AuthManager Initialization

```rust
pub struct AuthManager {
    http_client: reqwest::Client,
    oauth_client: OauthClient,
    client_id: String,
}

impl AuthManager {
    pub fn new(client_id: String) -> CoreResult<Self> {
        let auth_url = AuthUrl::new(MS_AUTH_URL)?;
        let device_auth_url = DeviceAuthorizationUrl::new(MS_DEVICE_CODE_URL)?;
        let token_url = TokenUrl::new(MS_TOKEN_URL)?;

        let oauth_client = BasicClient::new(ClientId::new(client_id))
            .set_auth_uri(auth_url)
            .set_device_authorization_url(device_auth_url)
            .set_token_uri(token_url);

        Ok(Self { http_client, oauth_client, client_id })
    }
}
```

The MS Client ID is hardcoded in `main.rs`:

```rust
const MS_CLIENT_ID: &str = "c36a9fb6-4f2a-41ff-90bd-ae7cc92031eb";
```
