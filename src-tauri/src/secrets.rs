use keyring::{Entry, Error};
use serde::Serialize;

const KEYCHAIN_SERVICE: &str = "dev.memoir.desktop";
const GITHUB_TOKEN_USER: &str = "github-token";

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct GitHubTokenStatus {
    configured: bool,
    masked: Option<String>,
}

#[tauri::command]
pub fn get_github_token_status() -> Result<GitHubTokenStatus, String> {
    let token = load_github_token()?;
    Ok(github_token_status(token.as_deref()))
}

#[tauri::command]
pub fn save_github_token(token: String) -> Result<GitHubTokenStatus, String> {
    let token = token.trim();
    if token.is_empty() {
        clear_github_token()?;
        return Ok(github_token_status(None));
    }

    github_token_entry()?
        .set_password(token)
        .map_err(|error| format!("无法保存 GitHub Token 到系统钥匙串: {error}"))?;
    Ok(github_token_status(Some(token)))
}

pub fn load_github_token() -> Result<Option<String>, String> {
    match github_token_entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("无法读取系统钥匙串中的 GitHub Token: {error}")),
    }
}

fn clear_github_token() -> Result<(), String> {
    match github_token_entry()?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("无法清空系统钥匙串中的 GitHub Token: {error}")),
    }
}

fn github_token_entry() -> Result<Entry, String> {
    Entry::new(KEYCHAIN_SERVICE, GITHUB_TOKEN_USER)
        .map_err(|error| format!("无法访问系统钥匙串: {error}"))
}

fn github_token_status(token: Option<&str>) -> GitHubTokenStatus {
    let token = token.unwrap_or_default().trim();
    GitHubTokenStatus {
        configured: !token.is_empty(),
        masked: mask_secret(token),
    }
}

fn mask_secret(secret: &str) -> Option<String> {
    let secret = secret.trim();
    if secret.is_empty() {
        return None;
    }

    let chars = secret.chars().collect::<Vec<_>>();
    if chars.len() <= 12 {
        return Some("••••".to_string());
    }

    let head = chars.iter().take(8).collect::<String>();
    let tail = chars
        .iter()
        .skip(chars.len().saturating_sub(4))
        .collect::<String>();
    Some(format!("{head}••••{tail}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_github_token_without_leaking_full_value() {
        assert_eq!(mask_secret("").as_deref(), None);
        assert_eq!(mask_secret("short").as_deref(), Some("••••"));
        assert_eq!(
            mask_secret("github_pat_1234567890").as_deref(),
            Some("github_p••••7890")
        );
    }
}
