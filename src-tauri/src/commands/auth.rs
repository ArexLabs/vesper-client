use crate::error::AppError;
use reqwest::Client;
use serde_json::json;
use tauri::command;

const MS_CLIENT_ID: &str = "00000000402b5328";
const MS_AUTH_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const MS_TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

#[command]
pub async fn microsoft_login() -> Result<String, String> {
    let client = Client::new();

    let redirect_uri = "http://localhost:3000/callback";
    let scope = "XboxLive.signin offline_access";

    let auth_url = format!(
        "{}?client_id={}&response_type=code&redirect_uri={}&scope={}",
        MS_AUTH_URL,
        MS_CLIENT_ID,
        redirect_uri,
        urlencoding::encode(scope)
    );

    tracing::info!("Starting Microsoft login flow");

    let code = request_auth_code(&auth_url).await?;

    let token_response = exchange_code_for_tokens(&client, &code).await?;
    let access_token = token_response["access_token"]
        .as_str()
        .ok_or("No access token in response")?
        .to_string();

    let username = get_user_info(&client, &access_token).await?;

    tracing::info!("Successfully logged in as: {}", username);
    Ok(username)
}

async fn request_auth_code(auth_url: &str) -> Result<String, String> {
    use tauri::Manager;

    let (tx, rx) = tokio::sync::oneshot::channel();

    tokio::spawn(async move {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
            .await
            .map_err(|e| format!("Failed to bind: {}", e))?;

        tracing::info!("Opening browser for Microsoft login");

        if let Err(e) = open::that(auth_url) {
            tracing::error!("Failed to open browser: {}", e);
        }

        match listener.accept().await {
            Ok((stream, _)) => {
                let code = parse_callback_code(stream).await?;
                let _ = tx.send(Ok(code));
            }
            Err(e) => {
                let _ = tx.send(Err(format!("Failed to accept connection: {}", e)));
            }
        }

        Ok::<(), String>(())
    });

    rx.await.map_err(|e| e.to_string())?
}

async fn exchange_code_for_tokens(
    client: &Client,
    code: &str,
) -> Result<serde_json::Value, String> {
    let params = [
        ("client_id", MS_CLIENT_ID),
        ("code", code),
        ("grant_type", "authorization_code"),
        ("redirect_uri", "http://localhost:3000/callback"),
    ];

    let response = client
        .post(MS_TOKEN_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed: {}", err_text));
    }

    let token_data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    Ok(token_data)
}

async fn get_user_info(client: &Client, access_token: &str) -> Result<String, String> {
    let response = client
        .get("https://graph.microsoft.com/v1.0/me")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Ok("Player".to_string());
    }

    let user_data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;

    let username = user_data["displayName"]
        .as_str()
        .unwrap_or("Player")
        .to_string();

    Ok(username)
}

async fn parse_callback_code(mut stream: tokio::net::TcpStream) -> Result<String, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let mut buf = vec![0u8; 4096];
    let n = stream.read(&mut buf).await.map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buf[..n]);

    let code = request
        .lines()
        .find_map(|line| {
            if line.contains("GET") && line.contains("code=") {
                line.split("code=")
                    .nth(1)
                    .and_then(|s| s.split(' ').next())
                    .and_then(|s| s.split('&').next())
                    .map(|s| s.trim().to_string())
            } else {
                None
            }
        })
        .ok_or("No authorization code found in callback")?;

    let response = b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body><h1>Login successful! You can close this window.</h1></body></html>";
    stream
        .write_all(response)
        .await
        .map_err(|e| e.to_string())?;
    stream.flush().await.map_err(|e| e.to_string())?;

    Ok(code)
}
