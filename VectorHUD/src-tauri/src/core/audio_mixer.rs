use serde::Serialize;
use tauri::command;
use windows::core::{Result as WinResult, ComInterface};
use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioSessionControl2, IAudioSessionEnumerator, IAudioSessionManager2, IMMDevice, IMMDeviceEnumerator, ISimpleAudioVolume, MMDeviceEnumerator
};
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::Win32::System::Threading::PROCESS_QUERY_LIMITED_INFORMATION;
use windows::Win32::Foundation::{CloseHandle, MAX_PATH, BOOL};

#[derive(Serialize, Clone)]
pub struct AudioSession {
    pub process_id: u32,
    pub name: String,
    pub volume: f32,
    pub muted: bool,
}

#[derive(Serialize, Clone)]
pub struct SystemAudio {
    pub master_volume: f32,
    pub master_muted: bool,
    pub sessions: Vec<AudioSession>,
}

#[command]
pub async fn get_audio_mixer_state() -> Result<SystemAudio, String> {
    unsafe {
        // Initialize COM
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let res = get_audio_state_impl();
        // We don't strictly CoUninitialize here because Tauri might be using COM, 
        // but typically it's fine if we initialized it. 
        // Or we use a safe COM wrapper. 
        res.map_err(|e| e.to_string())
    }
}

unsafe fn get_audio_state_impl() -> WinResult<SystemAudio> {
    let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
    let device: IMMDevice = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;

    // Get Master Volume
    let endpoint_volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)?;
    let master_volume = endpoint_volume.GetMasterVolumeLevelScalar()?;
    let master_muted = endpoint_volume.GetMute()? == BOOL::from(true);

    // Get Sessions
    let session_manager: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None)?;
    let session_enumerator: IAudioSessionEnumerator = session_manager.GetSessionEnumerator()?;
    
    let count = session_enumerator.GetCount()?;
    let mut sessions = Vec::new();

    for i in 0..count {
        if let Ok(session) = session_enumerator.GetSession(i) {
            if let Ok(session2) = session.cast::<IAudioSessionControl2>() {
                if let Ok(pid) = session2.GetProcessId() {
                    if pid == 0 { continue; }
                    
                    let simple_volume: ISimpleAudioVolume = session.cast()?;
                    let vol = simple_volume.GetMasterVolume().unwrap_or(0.0);
                    let muted = simple_volume.GetMute().unwrap_or(BOOL::from(false));

                    let name = get_process_name(pid);

                    sessions.push(AudioSession {
                        process_id: pid,
                        name,
                        volume: vol,
                        muted: muted == BOOL::from(true),
                    });
                }
            }
        }
    }

    Ok(SystemAudio {
        master_volume,
        master_muted,
        sessions,
    })
}

unsafe fn get_process_name(pid: u32) -> String {
    use windows::Win32::System::ProcessStatus::GetProcessImageFileNameW;
    use windows::Win32::System::Threading::OpenProcess;
    
    if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
        let mut buffer = [0u16; MAX_PATH as usize];
        let len = GetProcessImageFileNameW(handle, &mut buffer);
        let _ = CloseHandle(handle);
        if len > 0 {
            let path = String::from_utf16_lossy(&buffer[..len as usize]);
            if let Some(name) = path.split('\\').last() {
                return name.to_string();
            }
        }
    }
    format!("Unknown ({})", pid)
}

#[command]
pub async fn set_app_volume(pid: u32, volume: f32) -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        set_app_volume_impl(pid, volume).map_err(|e| e.to_string())
    }
}

unsafe fn set_app_volume_impl(target_pid: u32, volume: f32) -> WinResult<()> {
    let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
    let device: IMMDevice = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
    let session_manager: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None)?;
    let session_enumerator: IAudioSessionEnumerator = session_manager.GetSessionEnumerator()?;
    
    let count = session_enumerator.GetCount()?;

    for i in 0..count {
        if let Ok(session) = session_enumerator.GetSession(i) {
            if let Ok(session2) = session.cast::<IAudioSessionControl2>() {
                if let Ok(pid) = session2.GetProcessId() {
                    if pid == target_pid {
                        let simple_volume: ISimpleAudioVolume = session.cast()?;
                        simple_volume.SetMasterVolume(volume, std::ptr::null())?;
                        return Ok(());
                    }
                }
            }
        }
    }
    Ok(())
}

#[command]
pub async fn set_master_volume(volume: f32) -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| e.to_string())?;
        let device: IMMDevice = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| e.to_string())?;
        let endpoint_volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)
            .map_err(|e| e.to_string())?;
        endpoint_volume.SetMasterVolumeLevelScalar(volume, std::ptr::null())
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
