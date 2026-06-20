//! Controller Manager — Session 24
//!
//! Handles:
//!   - HID device polling for Stadia & DualShock 4 controllers
//!   - Input report translation to virtual Xbox 360 format
//!   - ViGEmBus virtual gamepad lifecycle (spawn/destroy/re-plug)
//!   - HidHide CLI integration (whitelist, device hiding, cloak toggle)
//!   - Reconnection Watcher & Failproof: auto-detect new Bluetooth instance IDs,
//!     dynamically register in HidHide, PnP-restart the physical device, re-plug virtual

use hidapi::HidApi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;
use tracing::{debug, error, info, warn};
use vigem_client::Client as VigemClient;

// ─────────────────────────────────────────────────────────────
//  Device ID constants
// ─────────────────────────────────────────────────────────────

/// Google Stadia Controller — USB & Bluetooth modes
const STADIA_VID: u16 = 0x18D1;
const STADIA_PID_USB: u16 = 0x9400;
const STADIA_PID_BT: u16 = 0x9401;

/// DualShock 4 — first gen & second gen
const DS4_VID: u16 = 0x054C;
const DS4_PID_GEN1: u16 = 0x05C4;
const DS4_PID_GEN2: u16 = 0x09CC;

const POLL_INTERVAL_MS: u64 = 500;
const VIRTUAL_REPLUG_DELAY_MS: u64 = 500;

// ─────────────────────────────────────────────────────────────
//  Public types
// ─────────────────────────────────────────────────────────────

/// Frontend-visible controller status payload emitted as `controller-status`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControllerStatus {
    pub controllers: Vec<ControllerInfo>,
    pub hidhide_available: bool,
    pub vigembus_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControllerInfo {
    pub id: String,
    pub name: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub connection_type: ConnectionType,
    pub emulation_active: bool,
    pub path: String,
    pub is_hidden: bool,
    pub is_xbox: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionType {
    Usb,
    Bluetooth,
}

/// Real-time button/axis state for the Controller Test visualizer
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[allow(dead_code)]
pub struct ControllerTestState {
    pub controller_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub product_id: Option<u16>,
    /// Buttons bitmask — matches Xbox 360 XUSB_REPORT wButtons layout
    pub buttons: u16,
    /// Left trigger [0..255]
    pub left_trigger: u8,
    /// Right trigger [0..255]
    pub right_trigger: u8,
    /// Left thumbstick X [-32768..32767]
    pub left_x: i16,
    /// Left thumbstick Y [-32768..32767]
    pub left_y: i16,
    /// Right thumbstick X [-32768..32767]
    pub right_x: i16,
    /// Right thumbstick Y [-32768..32767]
    pub right_y: i16,
    /// Optional extra button 1 (e.g. Stadia Assistant)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_btn_1: Option<bool>,
    /// Optional extra button 2 (e.g. Stadia Capture)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_btn_2: Option<bool>,
}

/// Shared manager state used by Tauri commands
#[allow(dead_code)]
pub struct ControllerManagerState {
    pub active: bool,
    /// Map of device path → emulation enabled flag
    pub emulation_enabled: HashMap<String, bool>,
    /// Map of device path → physical hiding enabled state (local fallback state)
    pub physical_hiding_enabled: HashMap<String, bool>,
    /// Tracks last known instance IDs for reconnect detection
    pub known_instance_ids: HashMap<String, String>,
    pub active_emulations: HashMap<String, tokio::sync::oneshot::Sender<()>>,
    /// List of connected gamepads detected by gilrs watcher
    pub gilrs_controllers: Vec<ControllerInfo>,
}

impl ControllerManagerState {
    pub fn new() -> Self {
        Self {
            active: false,
            emulation_enabled: HashMap::new(),
            physical_hiding_enabled: HashMap::new(),
            known_instance_ids: HashMap::new(),
            active_emulations: HashMap::new(),
            gilrs_controllers: Vec::new(),
        }
    }
}

impl Default for ControllerManagerState {
    fn default() -> Self {
        Self::new()
    }
}

pub type SharedControllerState = Arc<Mutex<ControllerManagerState>>;

// ─────────────────────────────────────────────────────────────
//  Input mapping utilities (pure, unit-testable)
// ─────────────────────────────────────────────────────────────

/// Convert a raw u8 axis [0..255] (where 128 = center) to i16 Xbox range [-32768..32767]
#[allow(dead_code)]
pub fn map_u8_axis_to_i16(raw: u8) -> i16 {
    let centered: i16 = (raw as i16) - 128;
    // Scale from [-128..127] to [-32768..32767]
    (centered as i32 * 32767 / 127).clamp(-32768, 32767) as i16
}

/// Convert a raw u8 trigger [0..255] directly to Xbox trigger u8 [0..255]  
/// (Xbox triggers are already 0-255, just a passthrough with saturation)
#[allow(dead_code)]
pub fn map_trigger_passthrough(raw: u8) -> u8 {
    raw
}

/// Convert DS4 axes [0..255, center=128] to Xbox i16 [-32768..32767]
/// DS4 Y-axis is inverted relative to Xbox (up=0 on DS4, up=32767 on Xbox)
#[allow(dead_code)]
pub fn map_ds4_y_axis(raw: u8) -> i16 {
    // DS4 up = 0, down = 255 → Xbox up = +32767, down = -32768 (inverted)
    let centered: i16 = 128 - (raw as i16);
    (centered as i32 * 32767 / 128).clamp(-32768, 32767) as i16
}

/// Convert DS4 trigger [0..255] to Xbox trigger [0..255]
#[allow(dead_code)]
pub fn map_ds4_trigger(raw: u8) -> u8 {
    raw
}

/// Parse a Stadia USB HID input report (64-byte report) into ControllerTestState
/// Stadia USB report layout (report ID 0x03):
/// Byte 0: report ID
/// Byte 1: DPad + some buttons  
/// Byte 2-3: button bits
/// Bytes 4-11: axes (LX, LY, RX, RY, L2, R2)
#[allow(dead_code)]
pub fn parse_stadia_usb_report(report: &[u8], controller_id: &str) -> Option<ControllerTestState> {
    if report.len() < 10 {
        return None;
    }
    // Stadia USB report ID 0x03
    let offset = if report[0] == 0x03 { 1 } else { 0 };
    if report.len() < offset + 10 {
        return None;
    }

    let dpad_buttons = report[offset];
    let buttons_byte1 = report[offset + 1];
    let buttons_byte2 = report[offset + 2];

    let lx = report[offset + 3];
    let ly = report[offset + 4];
    let rx = report[offset + 5];
    let ry = report[offset + 6];
    let l2 = report[offset + 7];
    let r2 = report[offset + 8];

    // Map DPad to Xbox XUSB buttons (bitmask matches XUSB_REPORT wButtons)
    let mut buttons: u16 = 0;

    // DPad (lower nibble of byte 0): 0=up, 1=up-right, 2=right, 3=down-right, 4=down, 5=down-left, 6=left, 7=up-left, 8=neutral
    let dpad = dpad_buttons & 0x0F;
    if matches!(dpad, 0 | 1 | 7) {
        buttons |= 0x0001;
    } // DPAD_UP
    if matches!(dpad, 3..=5) {
        buttons |= 0x0002;
    } // DPAD_DOWN
    if matches!(dpad, 5..=7) {
        buttons |= 0x0004;
    } // DPAD_LEFT
    if matches!(dpad, 1..=3) {
        buttons |= 0x0008;
    } // DPAD_RIGHT

    // Buttons from byte1 (buf[2])
    if buttons_byte1 & 0x40 != 0 {
        buttons |= 0x0020;
    } // Options → Back (0x0020)
    if buttons_byte1 & 0x20 != 0 {
        buttons |= 0x0010;
    } // Menu → Start (0x0010)
    if buttons_byte1 & 0x10 != 0 {
        buttons |= 0x0400;
    } // Home → Guide (0x0400)
    if buttons_byte1 & 0x80 != 0 {
        buttons |= 0x0080;
    } // Stick.Right → R3 (0x0080)

    // Buttons from byte2 (buf[3])
    if buttons_byte2 & 0x01 != 0 {
        buttons |= 0x0040;
    } // Stick.Left → L3 (0x0040)
    if buttons_byte2 & 0x02 != 0 {
        buttons |= 0x0200;
    } // Bumper.Right → RB (0x0200)
    if buttons_byte2 & 0x04 != 0 {
        buttons |= 0x0100;
    } // Bumper.Left → LB (0x0100)
    if buttons_byte2 & 0x08 != 0 {
        buttons |= 0x8000;
    } // Button.Y → Y (0x8000)
    if buttons_byte2 & 0x10 != 0 {
        buttons |= 0x4000;
    } // Button.X → X (0x4000)
    if buttons_byte2 & 0x20 != 0 {
        buttons |= 0x2000;
    } // Button.B → B (0x2000)
    if buttons_byte2 & 0x40 != 0 {
        buttons |= 0x1000;
    } // Button.A → A (0x1000)

    let extra_btn_1 = Some(buttons_byte1 & 0x02 != 0); // Assistant
    let extra_btn_2 = Some(buttons_byte1 & 0x01 != 0); // Capture

    Some(ControllerTestState {
        controller_id: controller_id.to_string(),
        vendor_id: Some(STADIA_VID),
        product_id: Some(STADIA_PID_USB),
        buttons,
        left_trigger: map_trigger_passthrough(l2),
        right_trigger: map_trigger_passthrough(r2),
        left_x: map_u8_axis_to_i16(lx),
        left_y: map_ds4_y_axis(ly),
        right_x: map_u8_axis_to_i16(rx),
        right_y: map_ds4_y_axis(ry),
        extra_btn_1,
        extra_btn_2,
    })
}

/// Parse a DualShock 4 USB HID input report into ControllerTestState
/// DS4 USB report ID 0x01:
/// Byte 0: Report ID (0x01)
/// Byte 1: LX, Byte 2: LY, Byte 3: RX, Byte 4: RY
/// Byte 5: DPad (low nibble) + buttons, Byte 6: buttons, Byte 7: buttons
/// Byte 8: L2, Byte 9: R2
#[allow(dead_code)]
pub fn parse_ds4_usb_report(report: &[u8], controller_id: &str) -> Option<ControllerTestState> {
    if report.len() < 10 {
        return None;
    }
    let offset = if report[0] == 0x01 { 1 } else { 0 };
    if report.len() < offset + 10 {
        return None;
    }

    let lx = report[offset];
    let ly = report[offset + 1];
    let rx = report[offset + 2];
    let ry = report[offset + 3];

    let dpad_buttons = report[offset + 4];
    let buttons_byte2 = report[offset + 5];
    let buttons_byte3 = report[offset + 6];

    let l2 = report[offset + 7];
    let r2 = report[offset + 8];

    let mut buttons: u16 = 0;
    let dpad = dpad_buttons & 0x0F;
    if matches!(dpad, 0 | 1 | 7) {
        buttons |= 0x0001;
    } // DPAD_UP
    if matches!(dpad, 3..=5) {
        buttons |= 0x0002;
    } // DPAD_DOWN
    if matches!(dpad, 5..=7) {
        buttons |= 0x0004;
    } // DPAD_LEFT
    if matches!(dpad, 1..=3) {
        buttons |= 0x0008;
    } // DPAD_RIGHT

    if dpad_buttons & 0x10 != 0 {
        buttons |= 0x4000;
    } // Square → X (0x4000)
    if dpad_buttons & 0x20 != 0 {
        buttons |= 0x1000;
    } // Cross → A (0x1000)
    if dpad_buttons & 0x40 != 0 {
        buttons |= 0x2000;
    } // Circle → B (0x2000)
    if dpad_buttons & 0x80 != 0 {
        buttons |= 0x8000;
    } // Triangle → Y (0x8000)

    if buttons_byte2 & 0x01 != 0 {
        buttons |= 0x0100;
    } // L1 → LB
    if buttons_byte2 & 0x02 != 0 {
        buttons |= 0x0200;
    } // R1 → RB
    if buttons_byte2 & 0x10 != 0 {
        buttons |= 0x0020;
    } // Share → Back
    if buttons_byte2 & 0x20 != 0 {
        buttons |= 0x0010;
    } // Options → Start
    if buttons_byte2 & 0x40 != 0 {
        buttons |= 0x0040;
    } // L3 → Left Thumb
    if buttons_byte2 & 0x80 != 0 {
        buttons |= 0x0080;
    } // R3 → Right Thumb

    let _ = buttons_byte3; // PS + Touchpad not mapped to Xbox

    Some(ControllerTestState {
        controller_id: controller_id.to_string(),
        vendor_id: Some(DS4_VID),
        product_id: Some(DS4_PID_GEN1),
        buttons,
        left_trigger: map_ds4_trigger(l2),
        right_trigger: map_ds4_trigger(r2),
        left_x: map_u8_axis_to_i16(lx),
        left_y: map_ds4_y_axis(ly),
        right_x: map_u8_axis_to_i16(rx),
        right_y: map_ds4_y_axis(ry),
        extra_btn_1: None,
        extra_btn_2: None,
    })
}

// ─────────────────────────────────────────────────────────────
//  HidHide CLI integration
// ─────────────────────────────────────────────────────────────

const HIDHIDE_CLI_PATH: &str =
    "C:\\Program Files\\Nefarius Software Solutions\\HidHide\\x64\\HidHideCLI.exe";

/// Run a HidHideCLI.exe command and log the result. Non-blocking.
fn run_hidhide_cli(args: &[&str]) -> Result<(), String> {
    match std::process::Command::new(HIDHIDE_CLI_PATH)
        .args(args)
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                info!("HidHideCLI {:?} → OK", args);
                Ok(())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let err_msg = if !stderr.is_empty() {
                    stderr
                } else if !stdout.is_empty() {
                    stdout
                } else {
                    format!("Exit code: {:?}", output.status.code())
                };

                // Fallback to elevated PowerShell if direct execution fails with Access is denied (0x0005)
                if err_msg.contains("0x0005") || err_msg.contains("Access is denied") {
                    info!("HidHideCLI direct access denied. Retrying with elevated PowerShell runas...");
                    let cli_args = args
                        .iter()
                        .map(|s| format!("'{}'", s))
                        .collect::<Vec<String>>()
                        .join(", ");
                    let ps_command = format!(
                        "Start-Process -FilePath '{}' -ArgumentList @({}) -Verb RunAs -WindowStyle Hidden -Wait",
                        HIDHIDE_CLI_PATH,
                        cli_args
                    );
                    match std::process::Command::new("powershell")
                        .args(["-NoProfile", "-Command", &ps_command])
                        .output()
                    {
                        Ok(ps_output) => {
                            if ps_output.status.success() {
                                info!("HidHideCLI elevated via PowerShell {:?} → OK", args);
                                return Ok(());
                            } else {
                                let ps_stderr = String::from_utf8_lossy(&ps_output.stderr)
                                    .trim()
                                    .to_string();
                                warn!("Elevated HidHide CLI failed: {}", ps_stderr);
                                return Err(format!(
                                    "Elevated HidHide command failed: {}",
                                    ps_stderr
                                ));
                            }
                        }
                        Err(e) => {
                            error!("Failed to launch elevated PowerShell: {}", e);
                            return Err(format!("Failed to launch elevated PowerShell: {}", e));
                        }
                    }
                }

                warn!("HidHideCLI {:?} failed: {}", args, err_msg);
                Err(format!("HidHide command failed: {}", err_msg))
            }
        }
        Err(e) => {
            let err_msg = format!("HidHideCLI not found or failed to launch: {}", e);
            warn!("{}", err_msg);
            Err(err_msg)
        }
    }
}

/// Check whether HidHideCLI.exe is available on this machine
pub fn is_hidhide_available() -> bool {
    std::path::Path::new(HIDHIDE_CLI_PATH).exists()
}

/// Check whether ViGEmBus driver is available by attempting to open a client
pub fn is_vigembus_available() -> bool {
    VigemClient::connect().is_ok()
}

/// Register an application executable path in HidHide's whitelist
pub fn hidhide_whitelist_app(exe_path: &str) -> Result<(), String> {
    run_hidhide_cli(&["--app-reg", exe_path])
}

/// Hide a device by its Device Instance ID
pub fn hidhide_hide_device(instance_id: &str) -> Result<(), String> {
    run_hidhide_cli(&["--dev-hide", instance_id])
}

/// Show (un-hide) a device by its Device Instance ID
pub fn hidhide_show_device(instance_id: &str) -> Result<(), String> {
    run_hidhide_cli(&["--dev-show", instance_id])
}

/// Enable the HidHide device firewall cloak
pub fn hidhide_cloak_on() -> Result<(), String> {
    run_hidhide_cli(&["--cloak-on"])
}

/// Disable the HidHide device firewall cloak
pub fn hidhide_cloak_off() -> Result<(), String> {
    run_hidhide_cli(&["--cloak-off"])
}

/// Helper to convert a raw HID path (e.g. `\\\\?\\hid#vid_18d1&pid_9400#8&af8d9d&0&0000#{...}`)
/// to a Device Instance ID (e.g. `HID\\VID_18D1&PID_9400\\8&af8d9d&0&0000`)
pub fn hid_path_to_instance_id(path: &str) -> Option<String> {
    // If hidapi formatted path starts with VID:PID: prefix, e.g. "18d1:9400:\\?\HID#..."
    // Find the start of the Windows device path prefix "\\?\" or "\?\" or similar
    let path_to_parse = if let Some(idx) = path.find("\\\\?\\") {
        &path[idx..]
    } else if let Some(idx) = path.find("\\?\\") {
        &path[idx..]
    } else {
        path
    };

    let clean = path_to_parse
        .trim_start_matches("\\\\?\\")
        .trim_start_matches("\\?\\");
    let parts: Vec<&str> = clean.split('#').collect();
    if parts.len() < 3 {
        return None;
    }
    let enumerator = parts[0].to_uppercase();
    let dev_id = parts[1].to_uppercase();
    let instance = parts[2];
    let clean_instance = instance.split('{').next()?.trim_end_matches('#');
    Some(format!("{}\\{}\\{}", enumerator, dev_id, clean_instance))
}

/// Canonicalize any HID path or instance ID to an uppercase instance ID format
/// e.g. converts \\?\HID#VID_18D1&PID_9400#8&af8d9d&0&0000#{...} or HID#VID_... or HID\VID_...
/// to standard HID\VID_18D1&PID_9400\8&AF8D9D&0&0000 format.
pub fn canonicalize_hid_id(id: &str) -> String {
    if let Some(canonical) = hid_path_to_instance_id(id) {
        canonical.to_uppercase()
    } else {
        id.replace(['/', '#'], "\\").to_uppercase()
    }
}

/// Retrieve the list of currently hidden device instance IDs from HidHide
/// Parse a single line from HidHideCLI output, stripping "--dev-hide" and outer quotes
pub fn parse_hidhide_line(l: &str) -> String {
    let mut trimmed = l.trim();
    if trimmed.starts_with("--dev-hide") {
        trimmed = trimmed["--dev-hide".len()..].trim();
    }
    if ((trimmed.starts_with('"') && trimmed.ends_with('"'))
        || (trimmed.starts_with('\'') && trimmed.ends_with('\'')))
        && trimmed.len() >= 2
    {
        trimmed = &trimmed[1..trimmed.len() - 1];
    }
    trimmed.to_string()
}

/// Retrieve the list of currently hidden device instance IDs from HidHide
pub fn get_hidhide_hidden_devices() -> Result<Vec<String>, String> {
    if !is_hidhide_available() {
        return Ok(Vec::new());
    }
    match std::process::Command::new(HIDHIDE_CLI_PATH)
        .arg("--dev-list")
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                Ok(stdout
                    .lines()
                    .map(parse_hidhide_line)
                    .filter(|l| !l.is_empty())
                    .collect())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let err_msg = if stderr.is_empty() {
                    String::from_utf8_lossy(&output.stdout).to_string()
                } else {
                    stderr.to_string()
                };
                Err(format!("HidHideCLI failed: {}", err_msg.trim()))
            }
        }
        Err(e) => Err(format!("Failed to execute HidHideCLI: {e}")),
    }
}

// ─────────────────────────────────────────────────────────────
//  PnP device restart via pnputil
// ─────────────────────────────────────────────────────────────

/// Restart a physical device by its Device Instance ID using pnputil.
/// Requires Administrator privileges — caller is responsible for elevation.
pub fn pnp_restart_device(device_instance_id: &str) -> bool {
    info!("PnP restart device: {}", device_instance_id);
    match std::process::Command::new("pnputil")
        .args(["/restart-device", device_instance_id])
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                info!(
                    "pnputil /restart-device succeeded for: {}",
                    device_instance_id
                );
                true
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                warn!("pnputil /restart-device failed: {}", stderr);
                false
            }
        }
        Err(e) => {
            error!("Failed to run pnputil: {}", e);
            false
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  Background controller watcher
// ─────────────────────────────────────────────────────────────

/// Helper to determine if a controller is natively supported as an Xbox controller
pub fn is_native_xbox_controller(vid: u16, name: &str) -> bool {
    let name_lower = name.to_lowercase();
    vid == 0x045E
        || name_lower.contains("xbox")
        || name_lower.contains("x-box")
        || name_lower.contains("x360")
        || name_lower.contains("xinput")
        || name_lower.contains("x-input")
}

/// Returns all currently connected target controller infos (de-duplicated by instance ID)
fn enumerate_controllers(hid_api: &HidApi) -> Vec<hidapi::DeviceInfo> {
    let mut seen = std::collections::HashSet::new();
    hid_api
        .device_list()
        .filter(|d| {
            // Include known Stadia and DS4 controllers
            let matches = (d.vendor_id() == STADIA_VID
                && (d.product_id() == STADIA_PID_USB || d.product_id() == STADIA_PID_BT))
                || (d.vendor_id() == DS4_VID
                    && (d.product_id() == DS4_PID_GEN1 || d.product_id() == DS4_PID_GEN2))
                // OR any Generic Desktop Gamepad (0x05) or Joystick (0x04)
                || (d.usage_page() == 1 && (d.usage() == 4 || d.usage() == 5));
            if !matches {
                return false;
            }
            let path = d.path().to_string_lossy().to_string();
            let canon = canonicalize_hid_id(&path);
            seen.insert(canon)
        })
        .cloned()
        .collect()
}

fn device_name_from_ids(vid: u16, pid: u16) -> &'static str {
    match (vid, pid) {
        (STADIA_VID, STADIA_PID_USB) => "Stadia Controller (USB)",
        (STADIA_VID, STADIA_PID_BT) => "Stadia Controller (Bluetooth)",
        (DS4_VID, DS4_PID_GEN1) => "DualShock 4 Gen 1",
        (DS4_VID, DS4_PID_GEN2) => "DualShock 4 Gen 2",
        _ => "Unknown Controller",
    }
}

fn connection_type_from_pid(vid: u16, pid: u16) -> ConnectionType {
    match (vid, pid) {
        (STADIA_VID, STADIA_PID_BT) => ConnectionType::Bluetooth,
        _ => ConnectionType::Usb,
    }
}

/// Full failproof reconnect cycle for a single device:
/// 1. Register new Instance ID in HidHide
/// 2. PnP restart the physical device
/// 3. Sleep 500ms
/// 4. Re-plug the virtual Xbox controller
pub async fn run_failproof_cycle(instance_id: &str, _exe_path: &str, hide_physical: bool) {
    info!(
        "Running failproof reconnect cycle for: {}, hide_physical={}",
        instance_id, hide_physical
    );

    // Step 1: Hide/Show the new instance ID via HidHide
    if is_hidhide_available() {
        if hide_physical {
            let _ = hidhide_hide_device(instance_id);
        } else {
            let _ = hidhide_show_device(instance_id);
        }
        // Refresh cloak to force-flush driver filter
        let _ = hidhide_cloak_off();
        sleep(Duration::from_millis(100)).await;
        let _ = hidhide_cloak_on();
    }

    // Step 2: PnP restart the physical controller
    // This forces Windows and active apps to drop any uncloaked device handles
    let _restarted = pnp_restart_device(instance_id);

    // Step 3: Wait for Windows to re-enumerate behind HidHide
    sleep(Duration::from_millis(VIRTUAL_REPLUG_DELAY_MS)).await;

    info!("Failproof cycle complete for: {}", instance_id);
    // Step 4: virtual re-plug is handled at the emulation session level
    // (the polling loop will detect the controller and reconnect the ViGEm handle)
}

/// Spawns a background task for emulation of a controller at raw_path
pub fn start_emulation(
    app_handle: AppHandle,
    state: SharedControllerState,
    controller_path: String,
    vid: u16,
    pid: u16,
) -> Result<(), String> {
    info!("start_emulation for: {}", controller_path);
    let mut st = state.lock().map_err(|e| format!("Lock error: {e}"))?;

    // Check if emulation for this path is already active
    if st.active_emulations.contains_key(&controller_path) {
        info!("Emulation already active for path: {}", controller_path);
        return Ok(());
    }

    // Set emulation enabled in the state
    st.emulation_enabled.insert(controller_path.clone(), true);

    let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();
    st.active_emulations
        .insert(controller_path.clone(), cancel_tx);

    let controller_path_clone = controller_path.clone();
    let state_clone = state.clone();

    tauri::async_runtime::spawn(async move {
        info!("Emulation thread started for: {}", controller_path_clone);

        // 1. Connect to ViGEm client
        let client = match vigem_client::Client::connect() {
            Ok(c) => c,
            Err(e) => {
                error!("ViGEm Client::connect() failed: {}", e);
                let mut st = state_clone.lock().unwrap();
                st.active_emulations.remove(&controller_path_clone);
                st.emulation_enabled
                    .insert(controller_path_clone.clone(), false);
                return;
            }
        };

        // 2. Create and plug in virtual controller
        let mut target =
            vigem_client::Xbox360Wired::new(client, vigem_client::TargetId::XBOX360_WIRED);
        if let Err(e) = target.plugin() {
            error!("ViGEm target plugin failed: {}", e);
            let mut st = state_clone.lock().unwrap();
            st.active_emulations.remove(&controller_path_clone);
            st.emulation_enabled
                .insert(controller_path_clone.clone(), false);
            return;
        }
        if let Err(e) = target.wait_ready() {
            error!("ViGEm target wait_ready failed: {}", e);
            let _ = target.unplug();
            let mut st = state_clone.lock().unwrap();
            st.active_emulations.remove(&controller_path_clone);
            st.emulation_enabled
                .insert(controller_path_clone.clone(), false);
            return;
        }

        // 3. Open physical HID device
        let hid_api = match HidApi::new() {
            Ok(a) => a,
            Err(e) => {
                error!("HidApi::new() failed for emulation: {}", e);
                let _ = target.unplug();
                let mut st = state_clone.lock().unwrap();
                st.active_emulations.remove(&controller_path_clone);
                st.emulation_enabled
                    .insert(controller_path_clone.clone(), false);
                return;
            }
        };

        let c_path = match std::ffi::CString::new(controller_path_clone.as_bytes()) {
            Ok(cp) => cp,
            Err(e) => {
                error!("CString conversion failed: {}", e);
                let _ = target.unplug();
                let mut st = state_clone.lock().unwrap();
                st.active_emulations.remove(&controller_path_clone);
                st.emulation_enabled
                    .insert(controller_path_clone.clone(), false);
                return;
            }
        };

        let mut device_opt = None;
        let mut retries = 0;
        while retries < 5 {
            match hid_api.open_path(&c_path) {
                Ok(d) => {
                    device_opt = Some(d);
                    break;
                }
                Err(e) => {
                    retries += 1;
                    warn!(
                        "Failed to open physical HID device (attempt {}/5): {}. Retrying in 100ms...",
                        retries, e
                    );
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            }
        }

        let device = match device_opt {
            Some(d) => d,
            None => {
                error!("Failed to open physical HID device after 5 attempts");
                let _ = target.unplug();
                let mut st = state_clone.lock().unwrap();
                st.active_emulations.remove(&controller_path_clone);
                st.emulation_enabled
                    .insert(controller_path_clone.clone(), false);
                return;
            }
        };

        let controller_id = format!(
            "{:04x}:{:04x}:{}",
            vid,
            pid,
            &controller_path_clone[..controller_path_clone.len().min(20)]
        );
        let mut buf = [0u8; 64];

        loop {
            // Check cancellation
            if cancel_rx.try_recv().is_ok() {
                info!(
                    "Emulation thread received stop signal for: {}",
                    controller_path_clone
                );
                break;
            }

            // Read report (10ms timeout)
            match device.read_timeout(&mut buf, 10) {
                Ok(bytes_read) if bytes_read > 0 => {
                    let report = &buf[..bytes_read];
                    let test_state_opt = if vid == STADIA_VID {
                        parse_stadia_usb_report(report, &controller_id)
                    } else if vid == DS4_VID {
                        parse_ds4_usb_report(report, &controller_id)
                    } else {
                        None
                    };

                    if let Some(ts) = test_state_opt {
                        let gamepad = vigem_client::XGamepad {
                            buttons: vigem_client::XButtons(ts.buttons),
                            left_trigger: ts.left_trigger,
                            right_trigger: ts.right_trigger,
                            thumb_lx: ts.left_x,
                            thumb_ly: ts.left_y,
                            thumb_rx: ts.right_x,
                            thumb_ry: ts.right_y,
                        };

                        if let Err(e) = target.update(&gamepad) {
                            debug!("ViGEm target update failed: {}", e);
                        }

                        let _ = app_handle.emit("controller-test-state", &ts);
                    }
                }
                Ok(_) => {}
                Err(e) => {
                    warn!(
                        "Read error from physical controller {}: {}",
                        controller_path_clone, e
                    );
                    break;
                }
            }
        }

        let _ = target.unplug();
        info!("Emulation thread stopped for: {}", controller_path_clone);

        let mut st = state_clone.lock().unwrap();
        st.active_emulations.remove(&controller_path_clone);
    });

    Ok(())
}

/// Stops the background emulation task for a controller path
pub fn stop_emulation(state: SharedControllerState, controller_path: String) -> Result<(), String> {
    info!("stop_emulation for: {}", controller_path);
    let mut st = state.lock().map_err(|e| format!("Lock error: {e}"))?;

    st.emulation_enabled.insert(controller_path.clone(), false);

    if let Some(cancel_tx) = st.active_emulations.remove(&controller_path) {
        let _ = cancel_tx.send(());
        info!(
            "Sent cancel signal to emulation thread for: {}",
            controller_path
        );
    }

    Ok(())
}

/// Spawn a background thread that polls gamepad events using the gilrs library
/// and emits them as "controller-test-state" to support testing any connected gamepad.
pub fn spawn_gilrs_watcher(app_handle: AppHandle, state: SharedControllerState) {
    tauri::async_runtime::spawn_blocking(move || {
        use gilrs::{Axis, Button, EventType, Gilrs};
        let mut gilrs = match Gilrs::new() {
            Ok(g) => g,
            Err(e) => {
                error!("Failed to initialize gilrs: {}", e);
                return;
            }
        };

        // Populate initial connected gamepads list in shared state
        {
            let mut st = state.lock().unwrap();
            st.gilrs_controllers = gilrs
                .gamepads()
                .map(|(gid, gamepad)| {
                    let vid = gamepad.vendor_id().unwrap_or(0);
                    let pid = gamepad.product_id().unwrap_or(0);
                    let path = format!("gilrs-{}", gid);
                    let name = gamepad.name().to_string();
                    let is_xbox = is_native_xbox_controller(vid, &name);
                    ControllerInfo {
                        id: format!("gilrs-{}", gid),
                        name,
                        vendor_id: vid,
                        product_id: pid,
                        connection_type: ConnectionType::Usb,
                        emulation_active: false,
                        path,
                        is_hidden: false,
                        is_xbox,
                    }
                })
                .collect();
        }

        info!("gilrs watcher thread spawned successfully");
        let mut loop_counter = 0;

        #[cfg(target_os = "windows")]
        use windows::Win32::UI::Input::XboxController::{XInputGetState, XINPUT_STATE};
        #[cfg(target_os = "windows")]
        let mut last_xinput_states: [Option<XINPUT_STATE>; 4] = [None, None, None, None];

        loop {
            loop_counter += 1;
            if loop_counter % 500 == 0 {
                let gp_names: Vec<String> = gilrs
                    .gamepads()
                    .map(|(_, gp)| gp.name().to_string())
                    .collect();
                tracing::info!("Gilrs watcher loop alive. Gamepads list: {:?}", gp_names);
            }
            while let Some(event) = gilrs.next_event() {
                let id = event.id;
                tracing::info!("Gilrs watcher event: id={:?}, event={:?}", id, event.event);
                match event.event {
                    EventType::Connected => {
                        let mut st = state.lock().unwrap();
                        st.gilrs_controllers = gilrs
                            .gamepads()
                            .map(|(gid, gamepad)| {
                                let vid = gamepad.vendor_id().unwrap_or(0);
                                let pid = gamepad.product_id().unwrap_or(0);
                                let path = format!("gilrs-{}", gid);
                                let name = gamepad.name().to_string();
                                let is_xbox = is_native_xbox_controller(vid, &name);
                                ControllerInfo {
                                    id: format!("gilrs-{}", gid),
                                    name,
                                    vendor_id: vid,
                                    product_id: pid,
                                    connection_type: ConnectionType::Usb,
                                    emulation_active: false,
                                    path,
                                    is_hidden: false,
                                    is_xbox,
                                }
                            })
                            .collect();
                    }
                    EventType::Disconnected => {
                        let mut st = state.lock().unwrap();
                        st.gilrs_controllers
                            .retain(|c| c.path != format!("gilrs-{}", id));
                    }
                    _ => {}
                }

                if let Some(gamepad) = gilrs.connected_gamepad(id) {
                    // Build ControllerTestState
                    let mut buttons: u16 = 0;
                    if gamepad.is_pressed(Button::DPadUp) {
                        buttons |= 0x0001;
                    }
                    if gamepad.is_pressed(Button::DPadDown) {
                        buttons |= 0x0002;
                    }
                    if gamepad.is_pressed(Button::DPadLeft) {
                        buttons |= 0x0004;
                    }
                    if gamepad.is_pressed(Button::DPadRight) {
                        buttons |= 0x0008;
                    }
                    if gamepad.is_pressed(Button::Start) {
                        buttons |= 0x0010;
                    }
                    if gamepad.is_pressed(Button::Select) {
                        buttons |= 0x0020;
                    }
                    if gamepad.is_pressed(Button::LeftThumb) {
                        buttons |= 0x0040;
                    }
                    if gamepad.is_pressed(Button::RightThumb) {
                        buttons |= 0x0080;
                    }
                    if gamepad.is_pressed(Button::LeftTrigger) {
                        buttons |= 0x0100;
                    }
                    if gamepad.is_pressed(Button::RightTrigger) {
                        buttons |= 0x0200;
                    }
                    if gamepad.is_pressed(Button::Mode) {
                        buttons |= 0x0400;
                    }
                    if gamepad.is_pressed(Button::South) {
                        buttons |= 0x1000;
                    }
                    if gamepad.is_pressed(Button::East) {
                        buttons |= 0x2000;
                    }
                    if gamepad.is_pressed(Button::West) {
                        buttons |= 0x4000;
                    }
                    if gamepad.is_pressed(Button::North) {
                        buttons |= 0x8000;
                    }

                    let left_trigger = (gamepad.value(Axis::LeftZ) * 255.0) as u8;
                    let right_trigger = (gamepad.value(Axis::RightZ) * 255.0) as u8;

                    let left_x = (gamepad.value(Axis::LeftStickX) * 32767.0) as i16;
                    let left_y = (gamepad.value(Axis::LeftStickY) * 32767.0) as i16;
                    let right_x = (gamepad.value(Axis::RightStickX) * 32767.0) as i16;
                    let right_y = (gamepad.value(Axis::RightStickY) * 32767.0) as i16;

                    let ts = ControllerTestState {
                        controller_id: format!("gilrs-{}", id),
                        vendor_id: Some(gamepad.vendor_id().unwrap_or(0)),
                        product_id: Some(gamepad.product_id().unwrap_or(0)),
                        buttons,
                        left_trigger,
                        right_trigger,
                        left_x,
                        left_y,
                        right_x,
                        right_y,
                        extra_btn_1: Some(false),
                        extra_btn_2: Some(false),
                    };

                    let _ = app_handle.emit("controller-test-state", &ts);
                }
            }

            // Poll XInput on Windows (bypasses RawInput focus issues for Xbox controllers)
            #[cfg(target_os = "windows")]
            {
                for i in 0..4 {
                    let mut state = XINPUT_STATE::default();
                    let res = unsafe { XInputGetState(i, &mut state) };
                    if res == 0 {
                        // ERROR_SUCCESS
                        let state_changed = match &last_xinput_states[i as usize] {
                            Some(last) => last.dwPacketNumber != state.dwPacketNumber,
                            None => true,
                        };

                        if state_changed {
                            last_xinput_states[i as usize] = Some(state);

                            let gp = state.Gamepad;
                            let ts = ControllerTestState {
                                controller_id: format!("gilrs-{}", i),
                                vendor_id: Some(0x045E),  // Xbox VID
                                product_id: Some(0x028E), // Xbox 360 PID
                                buttons: gp.wButtons.0,
                                left_trigger: gp.bLeftTrigger,
                                right_trigger: gp.bRightTrigger,
                                left_x: gp.sThumbLX,
                                left_y: gp.sThumbLY,
                                right_x: gp.sThumbRX,
                                right_y: gp.sThumbRY,
                                extra_btn_1: Some(false),
                                extra_btn_2: Some(false),
                            };

                            let _ = app_handle.emit("controller-test-state", &ts);
                        }
                    } else {
                        last_xinput_states[i as usize] = None;
                    }
                }
            }

            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    });
}

/// Spawn the background controller watcher task. This is a long-running tokio task.
pub fn spawn_controller_watcher(app_handle: AppHandle, state: SharedControllerState) {
    // Spawn the gilrs input watcher for generic testing support
    spawn_gilrs_watcher(app_handle.clone(), state.clone());

    tauri::async_runtime::spawn(async move {
        info!("Controller watcher started");

        // Retrieve current exe path for HidHide whitelist
        let exe_path = std::env::current_exe()
            .ok()
            .and_then(|p| p.to_str().map(|s| s.to_string()))
            .unwrap_or_default();

        // Register our executable in HidHide whitelist on startup
        if is_hidhide_available() && !exe_path.is_empty() {
            let _ = hidhide_whitelist_app(&exe_path);
            let _ = hidhide_cloak_on();
        }

        let mut last_seen_paths: HashMap<String, String> = HashMap::new();
        let mut is_first_run = true;

        loop {
            // Re-create HidApi each iteration to get fresh device list
            let api = match HidApi::new() {
                Ok(a) => a,
                Err(e) => {
                    warn!("HidApi::new() failed during poll: {}", e);
                    sleep(Duration::from_millis(POLL_INTERVAL_MS)).await;
                    continue;
                }
            };

            let devices = enumerate_controllers(&api);
            let vigembus_ok = is_vigembus_available();
            let hidhide_ok = is_hidhide_available();
            let hidden_list_result = if hidhide_ok {
                get_hidhide_hidden_devices()
            } else {
                Ok(Vec::new())
            };

            let mut controllers: Vec<ControllerInfo> = Vec::new();
            let mut current_paths: HashMap<String, String> = HashMap::new();

            for dev in &devices {
                let path = dev.path().to_string_lossy().to_string();
                let vid = dev.vendor_id();
                let pid = dev.product_id();
                let controller_id =
                    format!("{:04x}:{:04x}:{}", vid, pid, &path[..path.len().min(20)]);

                // Check if this is a newly appeared device (reconnect detection)
                let is_new = !last_seen_paths.contains_key(&path);
                current_paths.insert(path.clone(), controller_id.clone());

                let emulation_active = {
                    let st = state.lock().unwrap();
                    *st.emulation_enabled.get(&path).unwrap_or(&false)
                };

                if is_new && emulation_active {
                    if is_first_run {
                        info!("Boot controller detected with emulation enabled: {} — starting emulation directly", controller_id);
                        let _ = start_emulation(
                            app_handle.clone(),
                            state.clone(),
                            path.clone(),
                            vid,
                            pid,
                        );
                    } else {
                        // New device appeared while emulation was enabled → trigger failproof
                        info!(
                            "Reconnect detected for: {} — triggering failproof cycle",
                            controller_id
                        );
                        let instance_clone = path.clone();
                        let exe_clone = exe_path.clone();
                        let app_clone = app_handle.clone();
                        let state_clone = state.clone();
                        let hide_physical = {
                            let st = state.lock().unwrap();
                            *st.physical_hiding_enabled.get(&path).unwrap_or(&false)
                        };
                        tauri::async_runtime::spawn(async move {
                            run_failproof_cycle(&instance_clone, &exe_clone, hide_physical).await;
                            let _ = start_emulation(
                                app_clone.clone(),
                                state_clone,
                                instance_clone.clone(),
                                vid,
                                pid,
                            );
                            let _ =
                                app_clone.emit("controller-reconnect-complete", &instance_clone);
                        });
                    }
                } else if !is_new && emulation_active {
                    // Check if emulation loop is running, start if not
                    let is_running = {
                        let st = state.lock().unwrap();
                        st.active_emulations.contains_key(&path)
                    };
                    if !is_running {
                        info!(
                            "Emulation enabled for connected device {}, starting loop",
                            controller_id
                        );
                        let _ = start_emulation(
                            app_handle.clone(),
                            state.clone(),
                            path.clone(),
                            vid,
                            pid,
                        );
                    }
                }

                let canon_instance_id = canonicalize_hid_id(&path);
                let is_hidden = match &hidden_list_result {
                    Ok(list) => list
                        .iter()
                        .any(|h| canonicalize_hid_id(h) == canon_instance_id),
                    Err(_) => {
                        let st = state.lock().unwrap();
                        *st.physical_hiding_enabled.get(&path).unwrap_or(&false)
                    }
                };

                let name = match dev.product_string() {
                    Some(s) if !s.trim().is_empty() => s.to_string(),
                    _ => device_name_from_ids(vid, pid).to_string(),
                };
                let is_xbox = is_native_xbox_controller(vid, &name);

                controllers.push(ControllerInfo {
                    id: controller_id,
                    name,
                    vendor_id: vid,
                    product_id: pid,
                    connection_type: connection_type_from_pid(vid, pid),
                    emulation_active,
                    path: path.clone(),
                    is_hidden,
                    is_xbox,
                });
            }

            // Merge with gilrs-detected controllers to support generic gamepads (like Xbox 360, PS4/PS5, Stadia)
            let gilrs_controllers = {
                let st = state.lock().unwrap();
                st.gilrs_controllers.clone()
            };

            for gc in gilrs_controllers {
                let already_present = controllers
                    .iter()
                    .any(|c| c.vendor_id == gc.vendor_id && c.product_id == gc.product_id);
                if !already_present {
                    controllers.push(gc);
                }
            }

            last_seen_paths = current_paths;
            is_first_run = false;

            // Emit status update to frontend
            let status = ControllerStatus {
                controllers,
                hidhide_available: hidhide_ok,
                vigembus_available: vigembus_ok,
            };

            if let Err(e) = app_handle.emit("controller-status", &status) {
                debug!("Failed to emit controller-status: {}", e);
            }

            sleep(Duration::from_millis(POLL_INTERVAL_MS)).await;
        }
    });
}

// ─────────────────────────────────────────────────────────────
//  Tauri Commands
// ─────────────────────────────────────────────────────────────

/// Get current controller and driver status
#[tauri::command]
pub fn get_controller_status(
    state: tauri::State<'_, SharedControllerState>,
) -> Result<serde_json::Value, String> {
    tracing::info!("get_controller_status invoked");

    let hidhide = is_hidhide_available();
    let vigembus = is_vigembus_available();
    let hidden_list_result = if hidhide {
        get_hidhide_hidden_devices()
    } else {
        Ok(Vec::new())
    };

    let hid_api = HidApi::new().map_err(|e| format!("HidApi error: {e}"))?;
    let devices = enumerate_controllers(&hid_api);

    let (emulation_enabled, physical_hiding_enabled, gilrs_controllers) = {
        let st = state.lock().map_err(|e| format!("Lock error: {e}"))?;
        (
            st.emulation_enabled.clone(),
            st.physical_hiding_enabled.clone(),
            st.gilrs_controllers.clone(),
        )
    };

    let mut controllers: Vec<ControllerInfo> = devices
        .iter()
        .map(|d| {
            let path = d.path().to_string_lossy().to_string();
            let vid = d.vendor_id();
            let pid = d.product_id();
            let controller_id = format!("{:04x}:{:04x}:{}", vid, pid, &path[..path.len().min(20)]);
            let emulation_active = *emulation_enabled.get(&path).unwrap_or(&false);
            let name = match d.product_string() {
                Some(s) if !s.trim().is_empty() => s.to_string(),
                _ => device_name_from_ids(vid, pid).to_string(),
            };
            let is_xbox = is_native_xbox_controller(vid, &name);
            let canon_instance_id = canonicalize_hid_id(&path);
            let is_hidden = match &hidden_list_result {
                Ok(list) => list
                    .iter()
                    .any(|h| canonicalize_hid_id(h) == canon_instance_id),
                Err(_) => *physical_hiding_enabled.get(&path).unwrap_or(&false),
            };
            ControllerInfo {
                id: controller_id,
                name,
                vendor_id: vid,
                product_id: pid,
                connection_type: connection_type_from_pid(vid, pid),
                emulation_active,
                path: path.clone(),
                is_hidden,
                is_xbox,
            }
        })
        .collect();

    for gc in gilrs_controllers {
        let already_present = controllers
            .iter()
            .any(|c| c.vendor_id == gc.vendor_id && c.product_id == gc.product_id);
        if !already_present {
            controllers.push(gc);
        }
    }

    Ok(serde_json::json!({
        "controllers": controllers,
        "hidhide_available": hidhide,
        "vigembus_available": vigembus,
    }))
}

/// Toggle emulation on/off for a specific controller path
#[tauri::command]
pub async fn toggle_controller_emulation(
    controller_path: String,
    enable: bool,
    state: tauri::State<'_, SharedControllerState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    info!(
        "toggle_controller_emulation: path={} enable={}",
        controller_path, enable
    );

    let (vid, pid) = {
        let hid_api = HidApi::new().map_err(|e| format!("HidApi error: {e}"))?;
        let devices = enumerate_controllers(&hid_api);
        let matching_dev = devices
            .iter()
            .find(|d| d.path().to_string_lossy() == controller_path);
        match matching_dev {
            Some(d) => (d.vendor_id(), d.product_id()),
            None => {
                let mut st = state.lock().map_err(|e| format!("Lock error: {e}"))?;
                st.emulation_enabled.insert(controller_path.clone(), enable);
                if !enable {
                    if let Some(cancel_tx) = st.active_emulations.remove(&controller_path) {
                        let _ = cancel_tx.send(());
                    }
                }
                return Ok(());
            }
        }
    };

    if enable {
        if is_hidhide_available() {
            if let Some(instance_id) = hid_path_to_instance_id(&controller_path) {
                hidhide_hide_device(&instance_id)?;
                hidhide_cloak_on()?;
                if let Ok(mut st) = state.lock() {
                    st.physical_hiding_enabled
                        .insert(controller_path.clone(), true);
                }
            }
        }
        start_emulation(app_handle, state.inner().clone(), controller_path, vid, pid)?;
    } else {
        if is_hidhide_available() {
            if let Some(instance_id) = hid_path_to_instance_id(&controller_path) {
                hidhide_show_device(&instance_id)?;
                // Refresh cloak to force-flush driver filter and make it immediately visible
                let _ = hidhide_cloak_off();
                tokio::time::sleep(Duration::from_millis(100)).await;
                let _ = hidhide_cloak_on();
                // Re-plug/restart physical device to force Windows re-enumeration
                let _ = pnp_restart_device(&instance_id);

                if let Ok(mut st) = state.lock() {
                    st.physical_hiding_enabled
                        .insert(controller_path.clone(), false);
                }
            }
        }
        stop_emulation(state.inner().clone(), controller_path)?;
    }

    Ok(())
}

/// Manual command to hide/show a physical controller via HidHide
#[tauri::command]
pub async fn toggle_physical_device_hiding(
    controller_path: String,
    hide: bool,
    state: tauri::State<'_, SharedControllerState>,
) -> Result<(), String> {
    info!(
        "toggle_physical_device_hiding: path={} hide={}",
        controller_path, hide
    );
    if !is_hidhide_available() {
        return Err("HidHide is not available".to_string());
    }

    if let Some(instance_id) = hid_path_to_instance_id(&controller_path) {
        if hide {
            hidhide_hide_device(&instance_id)?;
            hidhide_cloak_on()?;
        } else {
            hidhide_show_device(&instance_id)?;
            // Refresh cloak to force-flush driver filter and make it immediately visible
            let _ = hidhide_cloak_off();
            tokio::time::sleep(Duration::from_millis(100)).await;
            let _ = hidhide_cloak_on();
            // Re-plug/restart physical device to force Windows re-enumeration
            let _ = pnp_restart_device(&instance_id);
        }
        if let Ok(mut st) = state.lock() {
            st.physical_hiding_enabled.insert(controller_path, hide);
        }
        Ok(())
    } else {
        Err("Failed to parse Device Instance ID from path".to_string())
    }
}

/// Manual "Fix Double Input" failproof trigger — runs the full failproof cycle
/// for all currently emulation-enabled controllers.
#[tauri::command]
pub async fn fix_double_input(
    state: tauri::State<'_, SharedControllerState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    info!("fix_double_input command invoked");

    let hid_api = HidApi::new().map_err(|e| format!("HidApi error: {e}"))?;
    let devices = enumerate_controllers(&hid_api);

    let exe_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.to_str().map(|s| s.to_string()))
        .unwrap_or_default();

    for dev in devices {
        let path = dev.path().to_string_lossy().to_string();
        let emulation_active = {
            let st = state.lock().map_err(|e| format!("Lock error: {e}"))?;
            *st.emulation_enabled.get(&path).unwrap_or(&false)
        };

        if emulation_active {
            let path_clone = path.clone();
            let exe_clone = exe_path.clone();
            let app_clone = app_handle.clone();
            let state_clone = state.inner().clone();
            let vid = dev.vendor_id();
            let pid = dev.product_id();
            let hide_physical = {
                let st = state.lock().map_err(|e| format!("Lock error: {e}"))?;
                *st.physical_hiding_enabled.get(&path).unwrap_or(&false)
            };
            tauri::async_runtime::spawn(async move {
                let _ = stop_emulation(state_clone.clone(), path_clone.clone());
                run_failproof_cycle(&path_clone, &exe_clone, hide_physical).await;
                let _ =
                    start_emulation(app_clone.clone(), state_clone, path_clone.clone(), vid, pid);
                let _ = app_clone.emit("fix-double-input-complete", &path_clone);
            });
        }
    }

    Ok(())
}

/// Get just the driver availability status (for quick UI status badge check)
#[tauri::command]
pub fn get_hidhide_status() -> Result<serde_json::Value, String> {
    tracing::info!("get_hidhide_status invoked");
    Ok(serde_json::json!({
        "hidhide_available": is_hidhide_available(),
        "vigembus_available": is_vigembus_available(),
    }))
}

// ─────────────────────────────────────────────────────────────
//  Unit Tests
// ─────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Axis mapping ──────────────────────────────────────────

    #[test]
    fn test_axis_center_maps_near_zero() {
        let result = map_u8_axis_to_i16(128);
        assert!(
            result.abs() <= 258,
            "Center (128) should map near 0, got {result}"
        );
    }

    #[test]
    fn test_axis_min_maps_to_negative() {
        let result = map_u8_axis_to_i16(0);
        assert!(
            result < -32000,
            "Min (0) should map to large negative, got {result}"
        );
    }

    #[test]
    fn test_axis_max_maps_to_positive() {
        let result = map_u8_axis_to_i16(255);
        assert!(
            result > 32000,
            "Max (255) should map to large positive, got {result}"
        );
    }

    #[test]
    fn test_trigger_passthrough() {
        assert_eq!(map_trigger_passthrough(0), 0);
        assert_eq!(map_trigger_passthrough(128), 128);
        assert_eq!(map_trigger_passthrough(255), 255);
    }

    #[test]
    fn test_ds4_y_axis_inversion() {
        // DS4 up=0 → Xbox up=positive; DS4 down=255 → Xbox down=negative
        let up = map_ds4_y_axis(0);
        let down = map_ds4_y_axis(255);
        assert!(
            up > 0,
            "DS4 up (raw=0) should map to positive Xbox Y, got {up}"
        );
        assert!(
            down < 0,
            "DS4 down (raw=255) should map to negative Xbox Y, got {down}"
        );
    }

    #[test]
    fn test_ds4_y_axis_center() {
        let center = map_ds4_y_axis(128);
        assert!(
            center.abs() <= 512,
            "DS4 center Y should be near 0, got {center}"
        );
    }

    // ── DS4 report parsing ────────────────────────────────────

    #[test]
    fn test_parse_ds4_report_too_short_returns_none() {
        let short_report = [0u8; 5];
        let result = parse_ds4_usb_report(&short_report, "test");
        assert!(result.is_none(), "Short report should return None");
    }

    #[test]
    fn test_parse_ds4_report_neutral_state() {
        // Minimal valid DS4 report: report ID + axes at center + no buttons
        let mut report = vec![0x01u8; 12];
        report[0] = 0x01; // Report ID
        report[1] = 128; // LX center
        report[2] = 128; // LY center
        report[3] = 128; // RX center
        report[4] = 128; // RY center
        report[5] = 0x08; // DPad = 8 (neutral) + no face buttons
        report[6] = 0x00; // No L1/R1/Share/Options/L3/R3
        report[7] = 0x00; // No PS/Touch
        report[8] = 0x00; // L2 = 0
        report[9] = 0x00; // R2 = 0

        let state = parse_ds4_usb_report(&report, "ctrl-1");
        assert!(
            state.is_some(),
            "Valid DS4 report should parse successfully"
        );
        let s = state.unwrap();
        assert_eq!(s.controller_id, "ctrl-1");
        assert_eq!(s.left_trigger, 0);
        assert_eq!(s.right_trigger, 0);
        // No directional buttons should be set for neutral dpad
        assert_eq!(s.buttons & 0x000F, 0, "No dpad bits should be set");
    }

    #[test]
    fn test_parse_ds4_report_dpad_up() {
        let mut report = vec![0x01u8; 12];
        report[5] = 0x00; // DPad = 0 (up)

        let state = parse_ds4_usb_report(&report, "ctrl-1").unwrap();
        assert!(state.buttons & 0x0001 != 0, "DPAD_UP should be set");
    }

    #[test]
    fn test_parse_ds4_report_a_button() {
        // Cross button = A on Xbox (0x1000)
        let mut report = vec![0x00u8; 12];
        report[0] = 0x01; // Report ID
        report[5] = 0x08 | 0x20; // DPad neutral (8) + Cross bit (0x20)

        let state = parse_ds4_usb_report(&report, "ctrl-1").unwrap();
        assert_eq!(state.buttons, 0x1000);
    }

    // ── Stadia report parsing ─────────────────────────────────

    #[test]
    fn test_parse_stadia_report_too_short_returns_none() {
        let short_report = [0u8; 3];
        let result = parse_stadia_usb_report(&short_report, "stadia");
        assert!(result.is_none(), "Short Stadia report should return None");
    }

    #[test]
    fn test_parse_stadia_neutral_state() {
        let mut report = vec![0x03u8; 12];
        report[0] = 0x03; // Report ID
        report[1] = 0x08; // DPad neutral (0x08)
        report[2] = 0x00;
        report[3] = 0x00;
        report[4] = 128; // LX center
        report[5] = 128; // LY center
        report[6] = 128; // RX center
        report[7] = 128; // RY center
        report[8] = 0; // L2
        report[9] = 0; // R2

        let state = parse_stadia_usb_report(&report, "stadia-1");
        assert!(state.is_some(), "Valid Stadia report should parse");
        let s = state.unwrap();
        assert_eq!(s.controller_id, "stadia-1");
    }

    #[test]
    fn test_hid_path_to_instance_id() {
        let path =
            "\\\\?\\hid#vid_18d1&pid_9400#8&af8d9d&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}";
        let expected = "HID\\VID_18D1&PID_9400\\8&af8d9d&0&0000";
        assert_eq!(hid_path_to_instance_id(path), Some(expected.to_string()));

        let path2 =
            "\\?\\HID#VID_054C&PID_05C4#7&123456&0&0000#{4D1E55B2-F16F-11CF-88CB-001111000030}";
        let expected2 = "HID\\VID_054C&PID_05C4\\7&123456&0&0000";
        assert_eq!(hid_path_to_instance_id(path2), Some(expected2.to_string()));

        // Test with hidapi prefix
        let path3 =
            "18d1:9400:\\\\?\\hid#vid_18d1&pid_9400#8&af8d9d&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}";
        assert_eq!(hid_path_to_instance_id(path3), Some(expected.to_string()));
    }

    #[test]
    fn test_parse_stadia_report_buttons() {
        let mut report = vec![0x03u8; 12];
        report[0] = 0x03;
        report[1] = 0x08; // DPad neutral
        report[2] = 0x10 | 0x80; // Home (Guide) + R3 (0x80)
        report[3] = 0x04 | 0x08; // LB (0x04) + Y (0x08)

        let state = parse_stadia_usb_report(&report, "stadia").unwrap();
        // Guide = 0x0400, LB = 0x0100, Y = 0x8000, R3 = 0x0080
        let expected_buttons = 0x0400 | 0x0100 | 0x8000 | 0x0080;
        assert_eq!(state.buttons, expected_buttons);
        assert_eq!(state.extra_btn_1, Some(false));
        assert_eq!(state.extra_btn_2, Some(false));
    }

    #[test]
    fn test_canonicalize_hid_id() {
        let raw_path =
            "\\\\?\\HID#VID_18D1&PID_9400#8&af8d9d&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}";
        let instance_id = "HID\\VID_18D1&PID_9400\\8&AF8D9D&0&0000";
        assert_eq!(canonicalize_hid_id(raw_path), instance_id);
        assert_eq!(
            canonicalize_hid_id("HID\\VID_18D1&PID_9400\\8&af8d9d&0&0000"),
            instance_id
        );
        assert_eq!(
            canonicalize_hid_id("HID#VID_18D1&PID_9400#8&af8d9d&0&0000"),
            instance_id
        );
    }

    #[test]
    fn test_parse_stadia_report_home_button() {
        let mut report = vec![0x03u8; 12];
        report[0] = 0x03;
        report[1] = 0x08; // DPad neutral
        report[2] = 0x40; // Options (Back)
        report[3] = 0x00;

        let state = parse_stadia_usb_report(&report, "stadia").unwrap();
        assert_eq!(state.buttons, 0x0020); // Back
    }

    // ── Driver detection (runs in non-Windows CI too, just returns false) ──

    #[test]
    fn test_hidhide_available_returns_bool() {
        // This is a CI-safe test — just verifies the function returns without panicking
        let _ = is_hidhide_available();
    }

    #[test]
    fn test_vigembus_available_returns_bool() {
        let _ = is_vigembus_available();
    }

    #[test]
    fn test_parse_hidhide_line() {
        assert_eq!(
            parse_hidhide_line("--dev-hide \"HID\\VID_18D1&PID_9400\\8\""),
            "HID\\VID_18D1&PID_9400\\8"
        );
        assert_eq!(
            parse_hidhide_line("--dev-hide 'HID\\VID_18D1&PID_9400\\8'"),
            "HID\\VID_18D1&PID_9400\\8"
        );
        assert_eq!(
            parse_hidhide_line("  --dev-hide   \"HID\\VID_18D1&PID_9400\\8\"   "),
            "HID\\VID_18D1&PID_9400\\8"
        );
        assert_eq!(
            parse_hidhide_line("HID\\VID_18D1&PID_9400\\8"),
            "HID\\VID_18D1&PID_9400\\8"
        );
    }

    #[test]
    fn test_is_hidden_matching_with_real_log_data() {
        let hidden_list = vec![
            "18d1:9400:\\\\?\\HID#{00001812-00".to_string(),
            "HID\\{00001812-0000-1000-8000-00805F9B34FB}_DEV_VID&0218D1_PID&9400_REV&0100_D06321B71B2A\\a&999a5c0&0&0000".to_string(),
            "\\\\?\\HID#{00001812-0000-1000-8000-00805f9b34fb}_Dev_VID&0218d1_PID&9400_REV&0100_d06321b71b2a#a&35264b82&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}".to_string()
        ];

        // Connected device path 1:
        let connected_path_1 = "18d1:9400:\\\\?\\HID#{00001812-0000-1000-8000-00805F9B34FB}_DEV_VID&0218D1_PID&9400_REV&0100_D06321B71B2A#a&999a5c0&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}";
        let canon_instance_id_1 = canonicalize_hid_id(connected_path_1);
        let is_hidden_1 = hidden_list
            .iter()
            .any(|h| canonicalize_hid_id(h) == canon_instance_id_1);
        assert!(
            is_hidden_1,
            "Connected path 1 should match the second item in the hidden list!"
        );

        // Connected device path 2:
        let connected_path_2 = "18d1:9400:\\\\?\\HID#{00001812-0000-1000-8000-00805F9B34FB}_DEV_VID&0218D1_PID&9400_REV&0100_D06321B71B2A#a&35264b82&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}";
        let canon_instance_id_2 = canonicalize_hid_id(connected_path_2);
        let is_hidden_2 = hidden_list
            .iter()
            .any(|h| canonicalize_hid_id(h) == canon_instance_id_2);
        assert!(
            is_hidden_2,
            "Connected path 2 should match the third item in the hidden list!"
        );
    }

    #[test]
    fn test_hidhide_fallback_on_error() {
        let mut state = ControllerManagerState::new();
        let path = "some_device_path".to_string();
        state.physical_hiding_enabled.insert(path.clone(), true);

        let canon_instance_id = canonicalize_hid_id(&path);
        let hidden_list_result: Result<Vec<String>, String> = Err("Access denied".to_string());

        let is_hidden = match &hidden_list_result {
            Ok(list) => list
                .iter()
                .any(|h| canonicalize_hid_id(h) == canon_instance_id),
            Err(_) => *state.physical_hiding_enabled.get(&path).unwrap_or(&false),
        };

        assert!(
            is_hidden,
            "Should fallback to physical_hiding_enabled state and return true!"
        );
    }

    #[test]
    fn test_gilrs_controllers_merging() {
        let mut state = ControllerManagerState::new();

        let gilrs_controller = ControllerInfo {
            id: "gilrs-1".to_string(),
            name: "Generic Gamepad".to_string(),
            vendor_id: 0x1234,
            product_id: 0x5678,
            connection_type: ConnectionType::Usb,
            emulation_active: false,
            path: "gilrs-1".to_string(),
            is_hidden: false,
            is_xbox: false,
        };
        state.gilrs_controllers.push(gilrs_controller.clone());

        let mut controllers: Vec<ControllerInfo> = Vec::new();

        for gc in state.gilrs_controllers {
            let already_present = controllers
                .iter()
                .any(|c| c.vendor_id == gc.vendor_id && c.product_id == gc.product_id);
            if !already_present {
                controllers.push(gc);
            }
        }

        assert_eq!(controllers.len(), 1);
        assert_eq!(controllers[0].id, "gilrs-1");
        assert_eq!(controllers[0].name, "Generic Gamepad");
        assert_eq!(controllers[0].vendor_id, 0x1234);
    }
}
