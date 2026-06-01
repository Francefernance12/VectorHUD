use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use sha2::{Digest, Sha256};
use std::sync::OnceLock;
use tauri::command;

// Cache the machine ID so we don't query it repeatedly
static MACHINE_KEY: OnceLock<[u8; 32]> = OnceLock::new();

fn get_machine_key() -> &'static [u8; 32] {
    MACHINE_KEY.get_or_init(|| {
        let uid = machine_uid::get().unwrap_or_else(|_| "fallback-machine-id-1234".to_string());
        let mut hasher = Sha256::new();
        hasher.update(uid.as_bytes());
        let result = hasher.finalize();
        let mut key = [0u8; 32];
        key.copy_from_slice(&result);
        key
    })
}

/// Encrypts plaintext and returns base64 string "nonce:ciphertext"
#[command]
pub fn encrypt_data(plaintext: String) -> Result<String, String> {
    if plaintext.is_empty() {
        return Ok("".to_string());
    }

    let key = Key::<Aes256Gcm>::from_slice(get_machine_key());
    let cipher = Aes256Gcm::new(key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng); // 96-bits; unique per message

    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);

    Ok(STANDARD.encode(combined))
}

/// Decrypts base64 string "nonce:ciphertext" and returns plaintext
#[command]
pub fn decrypt_data(encoded: String) -> Result<String, String> {
    if encoded.is_empty() {
        return Ok("".to_string());
    }

    let combined = STANDARD
        .decode(encoded)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if combined.len() < 12 {
        return Err("Invalid ciphertext length".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let key = Key::<Aes256Gcm>::from_slice(get_machine_key());
    let cipher = Aes256Gcm::new(key);

    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext_bytes)
        .map_err(|e| format!("Invalid UTF-8 in decrypted data: {}", e))
}
