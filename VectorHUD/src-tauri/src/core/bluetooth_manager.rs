//! Bluetooth Manager — Session 24
//!
//! Handles:
//!   - BLE peripheral scanning via btleplug
//!   - GATT Battery Service (0x180F / 0x2A19) reads for BLE devices
//!   - Win32 PnP enumeration for Classic Bluetooth devices (no battery in v1)
//!   - Periodic `bluetooth-devices-update` event emission to frontend

use btleplug::api::{Central, CharPropFlags, Manager as _, Peripheral, ScanFilter};
use btleplug::platform::Manager;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;
use tracing::{debug, info, warn};
use uuid::Uuid;

// Battery Service UUID and Characteristic UUID (GATT standard)
#[allow(dead_code)]
const BATTERY_SERVICE_UUID: Uuid = Uuid::from_u128(0x0000180f_0000_1000_8000_00805f9b34fb);
const BATTERY_LEVEL_CHAR_UUID: Uuid = Uuid::from_u128(0x00002a19_0000_1000_8000_00805f9b34fb);

const BT_SCAN_DURATION_SECS: u64 = 5;
const BT_POLL_INTERVAL_SECS: u64 = 30;

// ─────────────────────────────────────────────────────────────
//  Public types
// ─────────────────────────────────────────────────────────────

/// Frontend-visible Bluetooth device info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BluetoothDevice {
    pub id: String,
    pub name: String,
    /// "controller" | "headset" | "keyboard" | "mouse" | "generic"
    pub device_type: String,
    pub is_connected: bool,
    /// Battery percentage for BLE devices. None for Classic BT in v1.
    pub battery_percent: Option<u8>,
    pub connection_mode: BluetoothConnectionMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BluetoothConnectionMode {
    Le,
    Classic,
}

// ─────────────────────────────────────────────────────────────
//  Device type heuristics
// ─────────────────────────────────────────────────────────────

/// Best-effort classify a device by its name
fn classify_device_type(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.contains("controller")
        || lower.contains("gamepad")
        || lower.contains("stadia")
        || lower.contains("dualshock")
        || lower.contains("dualsense")
        || lower.contains("xbox")
        || lower.contains("joycon")
        || lower.contains("pro controller")
    {
        "controller"
    } else if lower.contains("headset")
        || lower.contains("headphone")
        || lower.contains("airpod")
        || lower.contains("buds")
        || lower.contains("earphone")
        || lower.contains("sound")
        || lower.contains("speaker")
    {
        "headset"
    } else if lower.contains("keyboard") || lower.contains("kbd") {
        "keyboard"
    } else if lower.contains("mouse") || lower.contains("trackpad") {
        "mouse"
    } else {
        "generic"
    }
}

// ─────────────────────────────────────────────────────────────
//  BLE scanner
// ─────────────────────────────────────────────────────────────

/// Scan for BLE peripherals and attempt to read battery levels.
/// Returns a list of BluetoothDevice for each found peripheral.
async fn scan_ble_devices() -> Vec<BluetoothDevice> {
    let manager = match Manager::new().await {
        Ok(m) => m,
        Err(e) => {
            warn!("btleplug Manager::new() failed: {}", e);
            return Vec::new();
        }
    };

    let adapters = match manager.adapters().await {
        Ok(a) => a,
        Err(e) => {
            warn!("Failed to enumerate BT adapters: {}", e);
            return Vec::new();
        }
    };

    let adapter = match adapters.into_iter().next() {
        Some(a) => a,
        None => {
            debug!("No Bluetooth adapters found");
            return Vec::new();
        }
    };

    // Start scan
    if let Err(e) = adapter.start_scan(ScanFilter::default()).await {
        warn!("BLE scan start failed: {}", e);
        return Vec::new();
    }

    sleep(Duration::from_secs(BT_SCAN_DURATION_SECS)).await;

    if let Err(e) = adapter.stop_scan().await {
        debug!("BLE scan stop failed (non-critical): {}", e);
    }

    let peripherals = match adapter.peripherals().await {
        Ok(p) => p,
        Err(e) => {
            warn!("Failed to list peripherals: {}", e);
            return Vec::new();
        }
    };

    let mut devices = Vec::new();

    for peripheral in &peripherals {
        let properties = match peripheral.properties().await {
            Ok(Some(p)) => p,
            _ => continue,
        };

        let name = properties
            .local_name
            .unwrap_or_else(|| "Unknown Device".to_string());
        let id = peripheral.id().to_string();
        let is_connected = peripheral.is_connected().await.unwrap_or(false);
        let device_type = classify_device_type(&name).to_string();

        // Attempt battery read for connected devices
        let battery_percent = if is_connected {
            read_battery_level(peripheral).await
        } else {
            None
        };

        devices.push(BluetoothDevice {
            id,
            name,
            device_type,
            is_connected,
            battery_percent,
            connection_mode: BluetoothConnectionMode::Le,
        });
    }

    info!("BLE scan complete — found {} peripherals", devices.len());
    devices
}

/// Attempt to read the GATT Battery Level characteristic from a connected peripheral.
async fn read_battery_level<P: Peripheral>(peripheral: &P) -> Option<u8> {
    // Ensure services are discovered
    if let Err(e) = peripheral.discover_services().await {
        debug!("discover_services failed: {}", e);
        return None;
    }

    let characteristics = peripheral.characteristics();

    // Look for the Battery Level characteristic
    let battery_char = characteristics.iter().find(|c| {
        c.uuid == BATTERY_LEVEL_CHAR_UUID && c.properties.contains(CharPropFlags::READ)
    })?;

    match peripheral.read(battery_char).await {
        Ok(data) if !data.is_empty() => {
            let level = data[0].clamp(0, 100);
            debug!("Battery level read: {}%", level);
            Some(level)
        }
        Ok(_) => None,
        Err(e) => {
            debug!("Battery read failed: {}", e);
            None
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  Classic Bluetooth & Unified Scanner
// ─────────────────────────────────────────────────────────────

/// Scan for Classic Bluetooth devices using PowerShell to filter out offline paired devices
async fn scan_classic_bluetooth_devices() -> Vec<BluetoothDevice> {
    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};

    let script = r#"$devices = Get-PnpDevice -Class Bluetooth; $results = @(); foreach ($dev in $devices) { if ($dev.InstanceId -like 'BTHLE\DEV_*' -or $dev.InstanceId -like 'BTHENUM\DEV_*') { $statusVal = ($dev | Get-PnpDeviceProperty -KeyName 'DEVPKEY_Device_DevNodeStatus').Data; if ($statusVal -ne $null -and !($statusVal -band 0x02000000)) { $results += [PSCustomObject]@{ id = $dev.InstanceId; name = $dev.FriendlyName } } } }; if ($results.Count -gt 0) { $results | ConvertTo-Json -Compress } else { '[]' }"#;

    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-Command", script])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = match cmd.output() {
        Ok(out) => out,
        Err(e) => {
            warn!("Failed to execute PowerShell script: {}", e);
            return Vec::new();
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        warn!("PowerShell exited with error: {}", stderr);
        return Vec::new();
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() || stdout == "[]" {
        return Vec::new();
    }

    #[derive(Deserialize)]
    struct PsBluetoothDevice {
        id: String,
        name: String,
    }

    let ps_devices: Vec<PsBluetoothDevice> = if stdout.starts_with('[') {
        serde_json::from_str(&stdout).unwrap_or_default()
    } else {
        if let Ok(single) = serde_json::from_str::<PsBluetoothDevice>(&stdout) {
            vec![single]
        } else {
            Vec::new()
        }
    };

    ps_devices
        .into_iter()
        .map(|d| {
            let dev_type = classify_device_type(&d.name).to_string();
            BluetoothDevice {
                id: d.id,
                name: d.name,
                device_type: dev_type,
                is_connected: true,
                battery_percent: None,
                connection_mode: BluetoothConnectionMode::Classic,
            }
        })
        .collect()
}

/// Scan BLE + Classic and merge them
async fn scan_all_bluetooth_devices() -> Vec<BluetoothDevice> {
    let mut ble_devices = scan_ble_devices().await;
    let classic_devices = scan_classic_bluetooth_devices().await;

    for classic in classic_devices {
        if let Some(dup_idx) = ble_devices
            .iter()
            .position(|ble| ble.name.to_lowercase() == classic.name.to_lowercase())
        {
            ble_devices[dup_idx].is_connected =
                ble_devices[dup_idx].is_connected || classic.is_connected;
        } else {
            ble_devices.push(classic);
        }
    }

    // Sort so connected devices are at the top
    ble_devices.sort_by_key(|b| std::cmp::Reverse(b.is_connected));

    ble_devices
}

// ─────────────────────────────────────────────────────────────
//  Background BT watcher
// ─────────────────────────────────────────────────────────────

/// Spawn the Bluetooth device watcher. Runs every BT_POLL_INTERVAL_SECS seconds.
pub fn spawn_bluetooth_watcher(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        info!("Bluetooth watcher started");

        loop {
            let devices = scan_all_bluetooth_devices().await;

            if let Err(e) = app_handle.emit("bluetooth-devices-update", &devices) {
                debug!("Failed to emit bluetooth-devices-update: {}", e);
            }

            sleep(Duration::from_secs(BT_POLL_INTERVAL_SECS)).await;
        }
    });
}

// ─────────────────────────────────────────────────────────────
//  Tauri Commands
// ─────────────────────────────────────────────────────────────

/// Manually trigger a BLE + Classic scan and return results to the caller.
#[tauri::command]
pub async fn get_bluetooth_devices() -> Result<Vec<BluetoothDevice>, String> {
    info!("get_bluetooth_devices invoked");
    let devices = scan_all_bluetooth_devices().await;
    Ok(devices)
}

// ─────────────────────────────────────────────────────────────
//  Unit Tests
// ─────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_controller() {
        assert_eq!(classify_device_type("Stadia Controller"), "controller");
        assert_eq!(
            classify_device_type("Xbox Wireless Controller"),
            "controller"
        );
        assert_eq!(classify_device_type("DualShock 4"), "controller");
        assert_eq!(
            classify_device_type("Nintendo Pro Controller"),
            "controller"
        );
    }

    #[test]
    fn test_classify_headset() {
        assert_eq!(classify_device_type("Sony WH-1000XM5 Headset"), "headset");
        assert_eq!(classify_device_type("AirPods Pro"), "headset");
        assert_eq!(classify_device_type("Galaxy Buds Live"), "headset");
    }

    #[test]
    fn test_classify_keyboard() {
        assert_eq!(
            classify_device_type("Logitech MX Keys Keyboard"),
            "keyboard"
        );
        assert_eq!(classify_device_type("Apple KBD"), "keyboard");
    }

    #[test]
    fn test_classify_mouse() {
        assert_eq!(classify_device_type("MX Master 3 Mouse"), "mouse");
        assert_eq!(classify_device_type("Magic Trackpad"), "mouse");
    }

    #[test]
    fn test_classify_generic() {
        assert_eq!(classify_device_type("Unknown BT Device"), "generic");
        assert_eq!(classify_device_type("LE-XYZ-0123"), "generic");
    }

    #[test]
    fn test_bluetooth_device_serialization() {
        // Ensure the BluetoothDevice struct serializes cleanly to JSON
        let device = BluetoothDevice {
            id: "test-id".to_string(),
            name: "Test Controller".to_string(),
            device_type: "controller".to_string(),
            is_connected: true,
            battery_percent: Some(78),
            connection_mode: BluetoothConnectionMode::Le,
        };

        let json = serde_json::to_string(&device).expect("Serialization failed");
        assert!(json.contains("\"is_connected\":true"));
        assert!(json.contains("\"battery_percent\":78"));
        assert!(json.contains("\"connection_mode\":\"le\""));
    }

    #[test]
    fn test_bluetooth_device_no_battery_serialization() {
        let device = BluetoothDevice {
            id: "headset-1".to_string(),
            name: "Sony WH Headset".to_string(),
            device_type: "headset".to_string(),
            is_connected: true,
            battery_percent: None,
            connection_mode: BluetoothConnectionMode::Classic,
        };

        let json = serde_json::to_string(&device).expect("Serialization failed");
        assert!(json.contains("\"battery_percent\":null"));
        assert!(json.contains("\"connection_mode\":\"classic\""));
    }
}
