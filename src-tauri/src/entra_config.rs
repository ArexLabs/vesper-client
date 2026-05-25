use std::env;

/// Microsoft Entra ID configuration for the Vesper Launcher.
///
/// IMPORTANT: Register your own app at https://portal.azure.com -> Microsoft Entra ID
/// -> App registrations -> New registration. Use the generated client ID here.
///
/// Supported account types must be:
///   "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)
///    and personal Microsoft accounts (e.g. Skype, Xbox)"
///
/// Under Authentication -> Advanced settings -> "Allow public client flows" = Yes.
/// No redirect URI is required for Device Code Flow.
pub struct EntraConfig {
  /// Your own app registration client ID from Azure Portal.
  pub client_id: String,
  /// The OAuth 2.0 authority. Use /common to support both MSA and organizational accounts.
  pub authority: String,
  /// Device Code Flow endpoint (v2.0).
  pub device_code_url: String,
  /// Token endpoint (v2.0).
  pub token_url: String,
  /// Microsoft Graph API endpoint for user info.
  pub graph_url: &'static str,
}

impl EntraConfig {
  /// Load configuration from environment variables or defaults.
  ///
  /// In production, set VESPER_AZURE_CLIENT_ID in your build environment.
  /// In development, you can use a .env file or the default from Cargo features.
  pub fn from_env() -> Self {
    let client_id = env::var("VESPER_AZURE_CLIENT_ID")
      .unwrap_or_else(|_| "YOUR_CLIENT_ID_HERE".to_string());

    Self::new(client_id)
  }

  pub fn new(client_id: String) -> Self {
    let authority = "https://login.microsoftonline.com/common".to_string();
    let device_code_url = format!("{}/oauth2/v2.0/devicecode", authority);
    let token_url = format!("{}/oauth2/v2.0/token", authority);

    Self {
      client_id,
      authority,
      device_code_url,
      token_url,
      graph_url: "https://graph.microsoft.com/v1.0",
    }
  }

  /// Default scopes for Minecraft/Xbox Live authentication.
  pub fn scopes() -> &'static [&'static str] {
    &[
      "XboxLive.signin",
      "offline_access",
      "openid",
      "profile",
      "email",
    ]
  }

  /// Scopes as a space-separated string for OAuth requests.
  pub fn scope_string() -> String {
    Self::scopes().join(" ")
  }
}
