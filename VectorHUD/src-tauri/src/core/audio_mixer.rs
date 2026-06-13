use serde::Serialize;
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use tauri::command;
use windows::core::{ComInterface, Result as WinResult};
use windows::Win32::Foundation::{CloseHandle, BOOL, MAX_PATH};
use windows::Win32::Media::Audio::Endpoints::{IAudioEndpointVolume, IAudioMeterInformation};
use windows::Win32::Media::Audio::{
    eCapture, eConsole, eRender, IAudioSessionControl2, IAudioSessionManager2, IMMDevice,
    IMMDeviceEnumerator, ISimpleAudioVolume, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::Win32::System::Threading::PROCESS_QUERY_LIMITED_INFORMATION;

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

    // Get Sessions across all active render endpoints
    let mut sessions = Vec::new();
    let mut seen_pids = std::collections::HashSet::new();

    if let Ok(collection) = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) {
        if let Ok(count) = collection.GetCount() {
            for i in 0..count {
                if let Ok(dev) = collection.Item(i) {
                    if let Ok(session_manager) =
                        dev.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None)
                    {
                        if let Ok(session_enumerator) = session_manager.GetSessionEnumerator() {
                            if let Ok(session_count) = session_enumerator.GetCount() {
                                for j in 0..session_count {
                                    if let Ok(session) = session_enumerator.GetSession(j) {
                                        if let Ok(session2) =
                                            session.cast::<IAudioSessionControl2>()
                                        {
                                            if let Ok(pid) = session2.GetProcessId() {
                                                if pid == 0 || seen_pids.contains(&pid) {
                                                    continue;
                                                }

                                                let simple_volume: ISimpleAudioVolume =
                                                    match session.cast() {
                                                        Ok(v) => v,
                                                        Err(_) => continue,
                                                    };
                                                let vol =
                                                    simple_volume.GetMasterVolume().unwrap_or(0.0);
                                                let muted = simple_volume
                                                    .GetMute()
                                                    .unwrap_or(BOOL::from(false));

                                                let name = get_process_name(pid);

                                                sessions.push(AudioSession {
                                                    process_id: pid,
                                                    name,
                                                    volume: vol,
                                                    muted: muted == BOOL::from(true),
                                                });
                                                seen_pids.insert(pid);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
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

unsafe fn get_process_name_via_snapshot(target_pid: u32) -> Option<String> {
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };

    if Process32FirstW(snapshot, &mut entry).as_bool() {
        loop {
            if entry.th32ProcessID == target_pid {
                let name = String::from_utf16_lossy(&entry.szExeFile);
                let trimmed = name.trim_matches('\0').to_string();
                let _ = CloseHandle(snapshot);
                return Some(trimmed);
            }
            if !Process32NextW(snapshot, &mut entry).as_bool() {
                break;
            }
        }
    }
    let _ = CloseHandle(snapshot);
    None
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
            if let Some(name) = path.split('\\').next_back() {
                return name.to_string();
            }
        }
    }

    if let Some(name) = get_process_name_via_snapshot(pid) {
        return name;
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
    let collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
    let count = collection.GetCount()?;

    for i in 0..count {
        if let Ok(device) = collection.Item(i) {
            if let Ok(session_manager) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None)
            {
                if let Ok(session_enumerator) = session_manager.GetSessionEnumerator() {
                    if let Ok(session_count) = session_enumerator.GetCount() {
                        for j in 0..session_count {
                            if let Ok(session) = session_enumerator.GetSession(j) {
                                if let Ok(session2) = session.cast::<IAudioSessionControl2>() {
                                    if let Ok(pid) = session2.GetProcessId() {
                                        if pid == target_pid {
                                            let simple_volume: ISimpleAudioVolume =
                                                session.cast()?;
                                            simple_volume
                                                .SetMasterVolume(volume, std::ptr::null())?;
                                        }
                                    }
                                }
                            }
                        }
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
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
        let device: IMMDevice = enumerator
            .GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| e.to_string())?;
        let endpoint_volume: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| e.to_string())?;
        endpoint_volume
            .SetMasterVolumeLevelScalar(volume, std::ptr::null())
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[command]
pub async fn toggle_master_mute() -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
        let device: IMMDevice = enumerator
            .GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| e.to_string())?;
        let endpoint_volume: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| e.to_string())?;

        let current_mute = endpoint_volume.GetMute().map_err(|e| e.to_string())?;
        let new_mute = if current_mute == BOOL::from(true) {
            BOOL::from(false)
        } else {
            BOOL::from(true)
        };
        endpoint_volume
            .SetMute(new_mute, std::ptr::null())
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[command]
pub async fn toggle_app_mute(pid: u32) -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        toggle_app_mute_impl(pid).map_err(|e| e.to_string())
    }
}

unsafe fn toggle_app_mute_impl(target_pid: u32) -> WinResult<()> {
    let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
    let collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
    let count = collection.GetCount()?;

    for i in 0..count {
        if let Ok(device) = collection.Item(i) {
            if let Ok(session_manager) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None)
            {
                if let Ok(session_enumerator) = session_manager.GetSessionEnumerator() {
                    if let Ok(session_count) = session_enumerator.GetCount() {
                        for j in 0..session_count {
                            if let Ok(session) = session_enumerator.GetSession(j) {
                                if let Ok(session2) = session.cast::<IAudioSessionControl2>() {
                                    if let Ok(pid) = session2.GetProcessId() {
                                        if pid == target_pid {
                                            let simple_volume: ISimpleAudioVolume =
                                                session.cast()?;
                                            let current_mute = simple_volume
                                                .GetMute()
                                                .unwrap_or(BOOL::from(false));
                                            let new_mute = if current_mute == BOOL::from(true) {
                                                BOOL::from(false)
                                            } else {
                                                BOOL::from(true)
                                            };
                                            simple_volume.SetMute(new_mute, std::ptr::null())?;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

#[derive(Serialize, Clone)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Serialize, Clone)]
pub struct AudioDevicesLists {
    pub inputs: Vec<AudioDevice>,
    pub outputs: Vec<AudioDevice>,
}

#[command]
pub async fn get_audio_devices() -> Result<AudioDevicesLists, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;

        let default_output_id = enumerator
            .GetDefaultAudioEndpoint(eRender, eConsole)
            .and_then(|d| d.GetId())
            .map(|id| {
                let s = id.as_wide();
                OsString::from_wide(s).to_string_lossy().to_string()
            })
            .unwrap_or_default();

        let default_input_id = enumerator
            .GetDefaultAudioEndpoint(eCapture, eConsole)
            .and_then(|d| d.GetId())
            .map(|id| {
                let s = id.as_wide();
                OsString::from_wide(s).to_string_lossy().to_string()
            })
            .unwrap_or_default();

        let input_devices =
            windows_record::enumerate_audio_input_devices().map_err(|e| e.to_string())?;

        let output_devices =
            windows_record::enumerate_audio_output_devices().map_err(|e| e.to_string())?;

        let inputs = input_devices
            .into_iter()
            .map(|d| AudioDevice {
                is_default: d.id == default_input_id,
                id: d.id,
                name: d.name,
            })
            .collect();

        let outputs = output_devices
            .into_iter()
            .map(|d| AudioDevice {
                is_default: d.id == default_output_id,
                id: d.id,
                name: d.name,
            })
            .collect();

        Ok(AudioDevicesLists { inputs, outputs })
    }
}

#[command]
pub async fn get_microphone_volume() -> Result<f32, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
        let device: IMMDevice = enumerator
            .GetDefaultAudioEndpoint(eCapture, eConsole)
            .map_err(|e| e.to_string())?;
        let endpoint_volume: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| e.to_string())?;
        let vol = endpoint_volume
            .GetMasterVolumeLevelScalar()
            .map_err(|e| e.to_string())?;
        Ok(vol)
    }
}

#[command]
pub async fn set_microphone_volume(volume: f32) -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
        let device: IMMDevice = enumerator
            .GetDefaultAudioEndpoint(eCapture, eConsole)
            .map_err(|e| e.to_string())?;
        let endpoint_volume: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| e.to_string())?;
        endpoint_volume
            .SetMasterVolumeLevelScalar(volume, std::ptr::null())
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[command]
pub async fn get_microphone_mute() -> Result<bool, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
        let device: IMMDevice = enumerator
            .GetDefaultAudioEndpoint(eCapture, eConsole)
            .map_err(|e| e.to_string())?;
        let endpoint_volume: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| e.to_string())?;
        let muted = endpoint_volume.GetMute().map_err(|e| e.to_string())?;
        Ok(muted == BOOL::from(true))
    }
}

#[command]
pub async fn set_microphone_mute(muted: bool) -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
        let device: IMMDevice = enumerator
            .GetDefaultAudioEndpoint(eCapture, eConsole)
            .map_err(|e| e.to_string())?;
        let endpoint_volume: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| e.to_string())?;
        endpoint_volume
            .SetMute(BOOL::from(muted), std::ptr::null())
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[command]
pub async fn get_audio_peak_levels() -> Result<(f32, f32), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;

        let mut play_peak = 0.0f32;
        let mut record_peak = 0.0f32;

        if let Ok(play_dev) = enumerator.GetDefaultAudioEndpoint(eRender, eConsole) {
            if let Ok(meter) = play_dev.Activate::<IAudioMeterInformation>(CLSCTX_ALL, None) {
                if let Ok(peak) = meter.GetPeakValue() {
                    play_peak = peak;
                }
            }
        }

        if let Ok(rec_dev) = enumerator.GetDefaultAudioEndpoint(eCapture, eConsole) {
            if let Ok(meter) = rec_dev.Activate::<IAudioMeterInformation>(CLSCTX_ALL, None) {
                if let Ok(peak) = meter.GetPeakValue() {
                    record_peak = peak;
                }
            }
        }

        Ok((play_peak, record_peak))
    }
}
