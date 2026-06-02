use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};
use windows::core::Result as WinResult;use serde::Serialize;
use tauri::command;

#[derive(Serialize, Clone)]
pub struct MediaMetadata {
    pub title: String,
    pub artist: String,
    pub album_artist: String,
    pub is_playing: bool,
}

#[command]
pub async fn get_current_media() -> Result<Option<MediaMetadata>, String> {
    match get_media_impl().await {
        Ok(meta) => Ok(meta),
        Err(e) => {
            tracing::warn!("Failed to get media info: {}", e);
            Ok(None)
        }
    }
}

async fn get_media_impl() -> WinResult<Option<MediaMetadata>> {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.await?;
    let session = manager.GetCurrentSession()?;

    let playback_info = session.GetPlaybackInfo()?;
    let status = playback_info.PlaybackStatus()?;
    let is_playing = status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;

    let media_props = session.TryGetMediaPropertiesAsync()?.await?;

    let title = media_props.Title()?.to_string_lossy();
    let artist = media_props.Artist()?.to_string_lossy();
    let album_artist = media_props.AlbumArtist()?.to_string_lossy();

    if title.is_empty() {
        return Ok(None);
    }

    Ok(Some(MediaMetadata {
        title,
        artist,
        album_artist,
        is_playing,
    }))
}

#[command]
pub async fn media_play_pause() -> Result<(), String> {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| e.to_string())?
        .await
        .map_err(|e| e.to_string())?;
    
    if let Ok(session) = manager.GetCurrentSession() {
        let _ = session.TryTogglePlayPauseAsync().map_err(|e| e.to_string())?.await;
    }
    Ok(())
}

#[command]
pub async fn media_next() -> Result<(), String> {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| e.to_string())?
        .await
        .map_err(|e| e.to_string())?;
    
    if let Ok(session) = manager.GetCurrentSession() {
        let _ = session.TrySkipNextAsync().map_err(|e| e.to_string())?.await;
    }
    Ok(())
}

#[command]
pub async fn media_prev() -> Result<(), String> {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| e.to_string())?
        .await
        .map_err(|e| e.to_string())?;
    
    if let Ok(session) = manager.GetCurrentSession() {
        let _ = session.TrySkipPreviousAsync().map_err(|e| e.to_string())?.await;
    }
    Ok(())
}
