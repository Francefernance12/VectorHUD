import { useEffect, useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  Gamepad2,
  Bluetooth,
  Zap,
  RefreshCw,
  CheckCircle,
  XCircle,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  AlertTriangle,
  Headphones,
  Keyboard,
  Mouse,
  MonitorSmartphone,
  Info,
} from 'lucide-react';
import { logger } from '../../utils/logger';
import { useToastStore } from '../../store/toastStore';

// ─────────────────────────────────────────────────────────────
//  Types (mirror Rust structs)
// ─────────────────────────────────────────────────────────────

interface ControllerInfo {
  id: string;
  name: string;
  vendor_id: number;
  product_id: number;
  connection_type: 'usb' | 'bluetooth';
  emulation_active: boolean;
  path: string;
  is_hidden: boolean;
  is_xbox: boolean;
}

interface ControllerStatus {
  controllers: ControllerInfo[];
  hidhide_available: boolean;
  vigembus_available: boolean;
}

interface ControllerTestState {
  controller_id: string;
  vendor_id?: number;
  product_id?: number;
  buttons: number;
  left_trigger: number;
  right_trigger: number;
  left_x: number;
  left_y: number;
  right_x: number;
  right_y: number;
  extra_btn_1?: boolean; // Assistant
  extra_btn_2?: boolean; // Capture
}

interface BluetoothDevice {
  id: string;
  name: string;
  device_type: 'controller' | 'headset' | 'keyboard' | 'mouse' | 'generic';
  is_connected: boolean;
  battery_percent: number | null;
  connection_mode: 'le' | 'classic';
}

// Xbox 360 XUSB_REPORT wButtons bitmask constants
const XUSB = {
  DPAD_UP: 0x0001,
  DPAD_DOWN: 0x0002,
  DPAD_LEFT: 0x0004,
  DPAD_RIGHT: 0x0008,
  START: 0x0010,
  BACK: 0x0020,
  LEFT_THUMB: 0x0040,
  RIGHT_THUMB: 0x0080,
  LB: 0x0100,
  RB: 0x0200,
  GUIDE: 0x0400,
  A: 0x1000,
  B: 0x2000,
  X: 0x4000,
  Y: 0x8000,
};

// ─────────────────────────────────────────────────────────────
//  Battery icon helper
// ─────────────────────────────────────────────────────────────

function BatteryIcon({ level }: { level: number | null }) {
  if (level === null) return null;
  const color =
    level >= 60 ? 'text-accent-green' : level >= 30 ? 'text-accent-amber' : 'text-red-500';
  const Icon =
    level >= 80
      ? BatteryFull
      : level >= 50
      ? BatteryMedium
      : level >= 20
      ? BatteryLow
      : BatteryWarning;
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon size={13} />
      {level}%
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
//  Bluetooth device icon helper
// ─────────────────────────────────────────────────────────────

function DeviceTypeIcon({ type }: { type: BluetoothDevice['device_type'] }) {
  const cls = 'text-zinc-400';
  switch (type) {
    case 'controller': return <Gamepad2 size={15} className={cls} />;
    case 'headset': return <Headphones size={15} className={cls} />;
    case 'keyboard': return <Keyboard size={15} className={cls} />;
    case 'mouse': return <Mouse size={15} className={cls} />;
    default: return <MonitorSmartphone size={15} className={cls} />;
  }
}

// ─────────────────────────────────────────────────────────────
//  Xbox SVG Visualizer (Controller Test Tab)
// ─────────────────────────────────────────────────────────────

function ControllerVisualizer({ testState }: { testState: ControllerTestState | null }) {
  const pressed = (mask: number) =>
    testState ? (testState.buttons & mask) !== 0 : false;

  const extraPressed = (num: 1 | 2) => {
    if (!testState) return false;
    return num === 1 ? !!testState.extra_btn_1 : !!testState.extra_btn_2;
  };

  // Convert i16 axis to SVG translation (range ±8)
  const axisToOffset = (val: number) => (val / 32767) * 10;

  const lx = testState ? axisToOffset(testState.left_x) : 0;
  const ly = testState ? axisToOffset(testState.left_y) : 0;
  const rx = testState ? axisToOffset(testState.right_x) : 0;
  const ry = testState ? axisToOffset(testState.right_y) : 0;
  const lt = testState ? testState.left_trigger / 255 : 0;
  const rt = testState ? testState.right_trigger / 255 : 0;

  const btnCls = (active: boolean) =>
    active ? 'fill-accent-green drop-shadow-[0_0_4px_rgba(74,246,38,0.9)]' : 'fill-zinc-700';

  return (
    <svg
      id="controller-visualizer-svg"
      viewBox="0 0 320 200"
      className="w-full select-none"
      aria-label="Controller button visualizer"
    >
      {/* Controller body */}
      <ellipse cx="160" cy="110" rx="140" ry="70" className="fill-zinc-900 stroke-zinc-700 stroke-2" />
      <ellipse cx="100" cy="125" rx="55" ry="45" className="fill-zinc-800 stroke-zinc-700 stroke-1" />
      <ellipse cx="220" cy="125" rx="55" ry="45" className="fill-zinc-800 stroke-zinc-700 stroke-1" />

      {/* Left trigger fill bar */}
      <rect x="36" y="38" width="40" height="8" rx="4" className="fill-zinc-800 stroke-zinc-600 stroke-1" />
      <rect x="36" y="38" width={40 * lt} height="8" rx="4" className="fill-accent-green transition-all duration-100" />
      <text x="56" y="30" textAnchor="middle" className="fill-zinc-400 font-mono" fontSize="7">LT</text>

      {/* Right trigger fill bar */}
      <rect x="244" y="38" width="40" height="8" rx="4" className="fill-zinc-800 stroke-zinc-600 stroke-1" />
      <rect x="244" y="38" width={40 * rt} height="8" rx="4" className="fill-accent-green transition-all duration-100" />
      <text x="264" y="30" textAnchor="middle" className="fill-zinc-400 font-mono" fontSize="7">RT</text>

      {/* LB / RB */}
      <rect x="56" y="52" width="36" height="10" rx="5"
        className={`stroke-zinc-600 stroke-1 transition-colors duration-100 ${pressed(XUSB.LB) ? 'fill-accent-green' : 'fill-zinc-700'}`} />
      <text x="74" y="60" textAnchor="middle" fontSize="6" className="fill-zinc-300 font-mono pointer-events-none">LB</text>

      <rect x="228" y="52" width="36" height="10" rx="5"
        className={`stroke-zinc-600 stroke-1 transition-colors duration-100 ${pressed(XUSB.RB) ? 'fill-accent-green' : 'fill-zinc-700'}`} />
      <text x="246" y="60" textAnchor="middle" fontSize="6" className="fill-zinc-300 font-mono pointer-events-none">RB</text>

      {/* D-Pad */}
      <rect x="72" y="108" width="14" height="10" rx="2" className={btnCls(pressed(XUSB.DPAD_UP))} />
      <rect x="72" y="128" width="14" height="10" rx="2" className={btnCls(pressed(XUSB.DPAD_DOWN))} />
      <rect x="62" y="118" width="10" height="10" rx="2" className={btnCls(pressed(XUSB.DPAD_LEFT))} />
      <rect x="86" y="118" width="10" height="10" rx="2" className={btnCls(pressed(XUSB.DPAD_RIGHT))} />

      {/* Face Buttons */}
      <circle cx="245" cy="118" r="7" className={`transition-colors duration-100 ${pressed(XUSB.Y) ? 'fill-yellow-400' : 'fill-zinc-700'} stroke-zinc-600 stroke-1`} />
      <text x="245" y="121" textAnchor="middle" fontSize="6" className="fill-zinc-300 font-mono pointer-events-none">Y</text>

      <circle cx="258" cy="130" r="7" className={`transition-colors duration-100 ${pressed(XUSB.B) ? 'fill-red-500' : 'fill-zinc-700'} stroke-zinc-600 stroke-1`} />
      <text x="258" y="133" textAnchor="middle" fontSize="6" className="fill-zinc-300 font-mono pointer-events-none">B</text>

      <circle cx="232" cy="130" r="7" className={`transition-colors duration-100 ${pressed(XUSB.X) ? 'fill-blue-400' : 'fill-zinc-700'} stroke-zinc-600 stroke-1`} />
      <text x="232" y="133" textAnchor="middle" fontSize="6" className="fill-zinc-300 font-mono pointer-events-none">X</text>

      <circle cx="245" cy="142" r="7" className={`transition-colors duration-100 ${pressed(XUSB.A) ? 'fill-accent-green' : 'fill-zinc-700'} stroke-zinc-600 stroke-1`} />
      <text x="245" y="145" textAnchor="middle" fontSize="6" className="fill-zinc-300 font-mono pointer-events-none">A</text>

      {/* START / BACK */}
      <rect x="135" y="98" width="12" height="7" rx="3"
        className={`stroke-zinc-600 stroke-1 transition-colors duration-100 ${pressed(XUSB.BACK) ? 'fill-accent-green' : 'fill-zinc-700'}`} />
      <text x="141" y="104" textAnchor="middle" fontSize="4" className="fill-zinc-400 font-mono pointer-events-none">BACK</text>

      <rect x="173" y="98" width="12" height="7" rx="3"
        className={`stroke-zinc-600 stroke-1 transition-colors duration-100 ${pressed(XUSB.START) ? 'fill-accent-green' : 'fill-zinc-700'}`} />
      <text x="179" y="104" textAnchor="middle" fontSize="4" className="fill-zinc-400 font-mono pointer-events-none">START</text>

      {/* Guide / Home */}
      <circle cx="160" cy="101" r="5"
        className={`stroke-zinc-600 stroke-1 transition-colors duration-100 ${pressed(XUSB.GUIDE) ? 'fill-yellow-500' : 'fill-zinc-700'}`} />
      <text x="160" y="103" textAnchor="middle" fontSize="4" className="fill-zinc-400 font-mono pointer-events-none">G</text>

      {/* Stadia Assistant (Extra 1) */}
      {(!testState || testState.extra_btn_1 !== undefined) && (
        <>
          <circle cx="148" cy="113" r="3.5"
            strokeDasharray={!testState ? "1,1" : undefined}
            className={`stroke-zinc-600 stroke-1 transition-colors duration-100 ${
              extraPressed(1) ? 'fill-accent-green' : 'fill-zinc-800/40'
            } ${!testState ? 'opacity-40' : ''}`} />
          <text x="148" y="121" textAnchor="middle" fontSize="3" className="fill-zinc-500 font-mono pointer-events-none opacity-60">AST</text>
        </>
      )}

      {/* Stadia Capture (Extra 2) */}
      {(!testState || testState.extra_btn_2 !== undefined) && (
        <>
          <circle cx="172" cy="113" r="3.5"
            strokeDasharray={!testState ? "1,1" : undefined}
            className={`stroke-zinc-600 stroke-1 transition-colors duration-100 ${
              extraPressed(2) ? 'fill-accent-green' : 'fill-zinc-800/40'
            } ${!testState ? 'opacity-40' : ''}`} />
          <text x="172" y="121" textAnchor="middle" fontSize="3" className="fill-zinc-500 font-mono pointer-events-none opacity-60">CAP</text>
        </>
      )}

      {/* Left Thumbstick */}
      <circle cx="113" cy="138" r="14" className="fill-zinc-800 stroke-zinc-600 stroke-1" />
      <circle
        cx={113 + lx}
        cy={138 - ly}
        r="7"
        className={`transition-all duration-50 stroke-zinc-500 stroke-1 ${pressed(XUSB.LEFT_THUMB) ? 'fill-accent-green' : 'fill-zinc-500'}`}
      />

      {/* Right Thumbstick */}
      <circle cx="197" cy="138" r="14" className="fill-zinc-800 stroke-zinc-600 stroke-1" />
      <circle
        cx={197 + rx}
        cy={138 - ry}
        r="7"
        className={`transition-all duration-50 stroke-zinc-500 stroke-1 ${pressed(XUSB.RIGHT_THUMB) ? 'fill-accent-green' : 'fill-zinc-500'}`}
      />

      {/* No input hint */}
      {!testState && (
        <text x="160" y="180" textAnchor="middle" fontSize="8" className="fill-zinc-600 font-mono">
          Press a button on your controller
        </text>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
//  Calibration Radar & HUD Helpers
// ─────────────────────────────────────────────────────────────

interface AnalogStickRadarProps {
  x: number;
  y: number;
  label: string;
}

function AnalogStickRadar({ x, y, label }: AnalogStickRadarProps) {
  const xPct = ((x + 32768) / 65535) * 100;
  const yPct = 100 - ((y + 32768) / 65535) * 100;

  return (
    <div className="flex flex-col items-center p-3 bg-zinc-900/60 border border-border-wire rounded-xl relative overflow-hidden flex-1 shadow-lg shadow-black/30">
      {/* HUD-style Corner Accents */}
      <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-zinc-700/60" />
      <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-zinc-700/60" />
      <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 border-b border-l border-zinc-700/60" />
      <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 border-b border-r border-zinc-700/60" />

      <div className="text-xs text-zinc-400 tracking-widest font-mono mb-2.5 uppercase font-bold text-center">{label}</div>
      <div className="relative w-24 h-24 bg-black/50 border border-zinc-800 rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-[1px] border-t border-dashed border-zinc-800" />
          <div className="h-full w-[1px] border-l border-dashed border-zinc-800" />
          <div className="absolute w-20 h-20 rounded-full border border-dashed border-zinc-850/40" />
          <div className="absolute w-12 h-12 rounded-full border border-dashed border-zinc-850/20" />
        </div>
        <div 
          style={{ left: `calc(${xPct}% - 4px)`, top: `calc(${yPct}% - 4px)` }}
          className="absolute w-2 h-2 rounded-full bg-accent-green shadow-[0_0_12px_rgba(74,246,38,1)] transition-all duration-75 ease-out z-10" 
        />
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-3 text-[10px] font-mono text-zinc-400 w-full text-center bg-black/20 py-1 rounded border border-zinc-800/30">
        <div>X:<span className="text-accent-green font-bold ml-0.5">{x}</span></div>
        <div>Y:<span className="text-accent-green font-bold ml-0.5">{y}</span></div>
      </div>
    </div>
  );
}

interface TriggerBarProps {
  val: number;
  label: string;
}

function TriggerBar({ val, label }: TriggerBarProps) {
  const pct = (val / 255) * 100;
  return (
    <div className="flex flex-col p-3 bg-zinc-900/60 border border-border-wire rounded-xl flex-1 relative overflow-hidden shadow-lg shadow-black/30">
      {/* HUD-style Corner Accents */}
      <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-zinc-700/60" />
      <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-zinc-700/60" />
      <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 border-b border-l border-zinc-700/60" />
      <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 border-b border-r border-zinc-700/60" />

      <div className="flex justify-between items-center text-xs text-zinc-400 font-mono uppercase mb-2 font-bold tracking-wider">
        <span>{label}</span>
        <span className="text-accent-green font-mono font-bold bg-black/35 px-1.5 py-0.5 rounded border border-zinc-800/40">{val}</span>
      </div>
      <div className="w-full h-3 bg-black/50 border border-zinc-800 rounded-md overflow-hidden relative shadow-inner">
        <div 
          style={{ width: `${pct}%` }} 
          className="h-full bg-gradient-to-r from-accent-green/60 to-accent-green shadow-[0_0_10px_rgba(74,246,38,0.7)] transition-all duration-75 ease-out" 
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_90%,rgba(0,0,0,0.4)_90%)] bg-[length:10px_100%] pointer-events-none" />
      </div>
    </div>
  );
}

interface ButtonBadgeProps {
  active: boolean;
  label: string;
}

function ButtonBadge({ active, label }: ButtonBadgeProps) {
  return (
    <div 
      className={`py-1.5 px-1 text-center rounded-lg text-[10px] font-mono font-bold transition-all duration-75 uppercase tracking-widest border ${
        active 
          ? 'bg-accent-green/20 text-accent-green border-accent-green shadow-[0_0_8px_rgba(74,246,38,0.4)]' 
          : 'bg-zinc-950/40 text-zinc-550 border-zinc-800/80 hover:text-zinc-400 hover:border-zinc-700/40'
      }`}
    >
      {label}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Main Widget
// ─────────────────────────────────────────────────────────────

export function ControllerWidget() {
  const showToast = useToastStore(state => state.showToast);
  type Tab = 'bluetooth' | 'test' | 'mapping';
  const [activeTab, setActiveTab] = useState<Tab>('bluetooth');
  const [btDevices, setBtDevices] = useState<BluetoothDevice[]>([]);
  const [controllerStatus, setControllerStatus] = useState<ControllerStatus | null>(null);
  const controllerStatusRef = useRef<ControllerStatus | null>(null);
  const [testState, setTestState] = useState<ControllerTestState | null>(null);
  const [isFixingDoubleInput, setIsFixingDoubleInput] = useState(false);
  const [emulationToggles, setEmulationToggles] = useState<Record<string, boolean>>({});
  const [hiddenToggles, setHiddenToggles] = useState<Record<string, boolean>>({});
  const [scanningBt, setScanningBt] = useState(false);

  const unlistenRefs = useRef<UnlistenFn[]>([]);

  const activeController = controllerStatus?.controllers.find(
    c =>
      c.id === testState?.controller_id ||
      c.path === testState?.controller_id ||
      (testState?.vendor_id &&
        testState?.product_id &&
        c.vendor_id === testState.vendor_id &&
        c.product_id === testState.product_id)
  );

  // ── Initial data fetch ────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const status = await invoke<ControllerStatus>('get_controller_status');
      setControllerStatus(status);
      controllerStatusRef.current = status;
      // Sync emulation and hidden toggles with backend state
      const toggles: Record<string, boolean> = {};
      const hToggles: Record<string, boolean> = {};
      status.controllers.forEach(c => {
        toggles[c.path] = c.emulation_active;
        hToggles[c.path] = c.is_hidden;
      });
      setEmulationToggles(prev => ({ ...prev, ...toggles }));
      setHiddenToggles(prev => ({ ...prev, ...hToggles }));
    } catch (e) {
      logger.error(`get_controller_status failed: ${e}`);
    }
  }, []);

  const scanBluetooth = useCallback(async () => {
    setScanningBt(true);
    try {
      const devices = await invoke<BluetoothDevice[]>('get_bluetooth_devices');
      setBtDevices(devices);
    } catch (e) {
      logger.error(`get_bluetooth_devices failed: ${e}`);
    } finally {
      setScanningBt(false);
    }
  }, []);

  // ── Event listeners ───────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      fetchStatus();
      scanBluetooth();

      const unlistenStatus = await listen<ControllerStatus>('controller-status', event => {
        if (!mounted) return;
        setControllerStatus(event.payload);
        controllerStatusRef.current = event.payload;
        const toggles: Record<string, boolean> = {};
        const hToggles: Record<string, boolean> = {};
        event.payload.controllers.forEach(c => {
          toggles[c.path] = c.emulation_active;
          hToggles[c.path] = c.is_hidden;
        });
        setEmulationToggles(prev => ({ ...prev, ...toggles }));
        setHiddenToggles(prev => ({ ...prev, ...hToggles }));
      });

      const unlistenTest = await listen<ControllerTestState>('controller-test-state', event => {
        if (!mounted) return;

        // If there's a physical controller currently emulating, ignore test events from the emulated virtual Xbox 360 controller
        // and other duplicated events to prevent UI flickering between physical and virtual device names.
        const currentStatus = controllerStatusRef.current;
        if (currentStatus) {
          const hasActiveEmulation = currentStatus.controllers.some(c => c.emulation_active);
          if (hasActiveEmulation) {
            const isFromEmulatingController = currentStatus.controllers.some(
              c => c.emulation_active && !c.is_xbox && (event.payload.controller_id === c.id || event.payload.controller_id === c.path)
            );
            if (!isFromEmulatingController) {
              // Check if there is an emulating physical controller in the list
              const hasPhysicalEmulating = currentStatus.controllers.some(c => c.emulation_active && !c.is_xbox);
              if (hasPhysicalEmulating) {
                // Ignore events from other sources (like the virtual Xbox controller) to prevent UI name/input flickering
                return;
              }
            }
          }
        }

        setTestState(event.payload);
      });

      const unlistenBt = await listen<BluetoothDevice[]>('bluetooth-devices-update', event => {
        if (!mounted) return;
        setBtDevices(event.payload);
      });

      unlistenRefs.current = [unlistenStatus, unlistenTest, unlistenBt];
    };

    setup();

    return () => {
      mounted = false;
      unlistenRefs.current.forEach(fn => fn());
      unlistenRefs.current = [];
    };
  }, [fetchStatus, scanBluetooth]);

  // ── Emulation toggle handler ──────────────────────────────

  const handleEmulationToggle = async (controllerPath: string, enable: boolean) => {
    setEmulationToggles(prev => ({ ...prev, [controllerPath]: enable }));
    if (controllerStatus?.hidhide_available) {
      setHiddenToggles(prev => ({ ...prev, [controllerPath]: enable }));
    }
    try {
      await invoke('toggle_controller_emulation', { controllerPath, enable });
      logger.info(`Emulation ${enable ? 'enabled' : 'disabled'} for ${controllerPath}`);
    } catch (e) {
      logger.error(`toggle_controller_emulation failed: ${e}`);
      let friendlyError = String(e);
      if (friendlyError.includes("Access is denied") || friendlyError.includes("0x0005")) {
        friendlyError = "HidHide access denied. Please ensure the HidHide Configuration Client GUI (or other tools like DS4Windows) is closed, and you are running VectorHUD as Administrator.";
      } else {
        friendlyError = `${friendlyError}. Make sure you run VectorHUD as Administrator.`;
      }
      showToast(friendlyError);
      // Revert on failure
      setEmulationToggles(prev => ({ ...prev, [controllerPath]: !enable }));
      if (controllerStatus?.hidhide_available) {
        setHiddenToggles(prev => ({ ...prev, [controllerPath]: !enable }));
      }
    }
  };

  const handleHidingToggle = async (controllerPath: string, hide: boolean) => {
    setHiddenToggles(prev => ({ ...prev, [controllerPath]: hide }));
    try {
      await invoke('toggle_physical_device_hiding', { controllerPath, hide });
      logger.info(`Physical device hiding ${hide ? 'enabled' : 'disabled'} for ${controllerPath}`);
    } catch (e) {
      logger.error(`toggle_physical_device_hiding failed: ${e}`);
      let friendlyError = String(e);
      if (friendlyError.includes("Access is denied") || friendlyError.includes("0x0005")) {
        friendlyError = "HidHide access denied. Please ensure the HidHide Configuration Client GUI (or other tools like DS4Windows) is closed, and you are running VectorHUD as Administrator.";
      } else {
        friendlyError = `${friendlyError}. Make sure you run VectorHUD as Administrator.`;
      }
      showToast(friendlyError);
      // Revert on failure
      setHiddenToggles(prev => ({ ...prev, [controllerPath]: !hide }));
    }
  };

  // ── Fix Double Input handler ──────────────────────────────

  const handleFixDoubleInput = async () => {
    setIsFixingDoubleInput(true);
    try {
      await invoke('fix_double_input');
      logger.info('fix_double_input triggered');
    } catch (e) {
      logger.error(`fix_double_input failed: ${e}`);
    } finally {
      setTimeout(() => setIsFixingDoubleInput(false), 2000);
    }
  };

  // ── Status badge ──────────────────────────────────────────

  const StatusBadge = ({ available, label }: { available: boolean; label: string }) => (
    <span className="flex items-center gap-1 text-xs font-mono">
      {available ? (
        <CheckCircle size={11} className="text-accent-green" />
      ) : (
        <XCircle size={11} className="text-red-500" />
      )}
      <span className={available ? 'text-accent-green' : 'text-red-400'}>{label}</span>
    </span>
  );

  // ── Tab buttons ───────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'bluetooth', label: 'Bluetooth', icon: <Bluetooth size={12} /> },
    { id: 'test', label: 'Test', icon: <Gamepad2 size={12} /> },
    { id: 'mapping', label: 'Mapping', icon: <Zap size={12} /> },
  ];

  return (
    <div
      id="controller-widget"
      className="flex flex-col h-full text-text-primary font-mono text-sm"
    >
      {/* Tab bar */}
      <div className="flex border-b border-border-wire shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            id={`controller-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs tracking-wider transition-colors duration-200 border-b-2 ${
              activeTab === tab.id
                ? 'text-accent-green border-accent-green'
                : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-600'
            }`}
          >
            {tab.icon}
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 min-h-0">

        {/* ── Bluetooth Tab ───────────────────────────────── */}
        {activeTab === 'bluetooth' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500 tracking-widest">DEVICES</span>
              <button
                id="controller-bt-scan-btn"
                onClick={scanBluetooth}
                disabled={scanningBt}
                className="flex items-center gap-1 text-xs text-accent-green hover:opacity-75 transition-opacity disabled:opacity-40"
              >
                <RefreshCw size={11} className={scanningBt ? 'animate-spin' : ''} />
                {scanningBt ? 'Scanning…' : 'Scan'}
              </button>
            </div>

            {btDevices.length === 0 && (
              <p className="text-xs text-zinc-650 py-4 text-center">
                {scanningBt ? 'Scanning for Bluetooth devices…' : 'No Bluetooth devices found. Press Scan to search.'}
              </p>
            )}

            {btDevices.map(device => (
              <div
                key={device.id}
                id={`bt-device-${device.id}`}
                className="flex items-center justify-between bg-zinc-900/60 border border-border-wire rounded px-2.5 py-2 hover:bg-zinc-800/40 hover:border-zinc-700/50 transition-all duration-200"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <DeviceTypeIcon type={device.device_type} />
                  <div className="min-w-0">
                    <p className="text-xs truncate">{device.name}</p>
                    <p className="text-[10px] text-zinc-600">
                      {device.connection_mode === 'le' ? 'BLE' : 'Classic BT'} •{' '}
                      <span className={device.is_connected ? 'text-accent-green' : 'text-zinc-500'}>
                        {device.is_connected ? 'Connected' : 'Nearby'}
                      </span>
                    </p>
                  </div>
                </div>
                <BatteryIcon level={device.battery_percent} />
              </div>
            ))}
          </div>
        )}

        {/* ── Controller Test Tab ─────────────────────────── */}
        {activeTab === 'test' && (
          <div className="space-y-4 w-full">
            <div className="flex justify-between items-center shrink-0">
              <span className="text-xs text-zinc-500 tracking-widest">
                CONTROLLER TESTER {activeController ? `(${activeController.name})` : ''}
              </span>
              {testState && (
                <span className="text-[9px] text-accent-green font-mono px-1.5 py-0.5 bg-accent-green/10 rounded border border-accent-green/20 animate-pulse font-bold">
                  CALIBRATION ACTIVE
                </span>
              )}
            </div>

            {controllerStatus && controllerStatus.controllers.length === 0 && (
              <p className="text-xs text-zinc-600 text-center py-4 border border-dashed border-zinc-800 rounded-lg bg-zinc-950/20">
                No supported controllers detected.
              </p>
            )}

            {/* Controller SVG Visualizer wrapped in a naturally scaling container */}
            <div className="w-full flex items-center justify-center bg-zinc-950/40 border border-border-wire rounded-lg p-2 relative overflow-hidden select-none">
              <div className="absolute top-1 left-2 text-[8px] text-zinc-655 font-mono tracking-wider">DIAGNOSTIC.SYS</div>
              <div className="absolute top-1 right-2 text-[8px] text-zinc-655 font-mono tracking-wider">LIVE_HUD</div>
              <ControllerVisualizer testState={testState} />
            </div>

            {testState && (
              <div className="space-y-4 pt-1">
                {/* Stick Radars */}
                <div className="flex gap-3">
                  <AnalogStickRadar x={testState.left_x} y={testState.left_y} label="Left Stick (LS)" />
                  <AnalogStickRadar x={testState.right_x} y={testState.right_y} label="Right Stick (RS)" />
                </div>

                {/* Trigger Progress Bars */}
                <div className="flex gap-3">
                  <TriggerBar val={testState.left_trigger} label="Left Trigger (LT)" />
                  <TriggerBar val={testState.right_trigger} label="Right Trigger (RT)" />
                </div>

                {/* Digital Buttons Grid Badge panel */}
                <div className="flex flex-col p-3 bg-zinc-900/60 border border-border-wire rounded-xl space-y-2.5 relative shadow-lg shadow-black/30">
                  {/* HUD-style Corner Accents */}
                  <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-zinc-700/60" />
                  <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-zinc-700/60" />
                  <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 border-b border-l border-zinc-700/60" />
                  <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 border-b border-r border-zinc-700/60" />

                  <div className="text-[10px] text-zinc-450 font-mono uppercase font-bold tracking-widest">Digital Controls</div>
                  <div className="grid grid-cols-4 gap-2">
                    <ButtonBadge active={(testState.buttons & XUSB.A) !== 0} label="A" />
                    <ButtonBadge active={(testState.buttons & XUSB.B) !== 0} label="B" />
                    <ButtonBadge active={(testState.buttons & XUSB.X) !== 0} label="X" />
                    <ButtonBadge active={(testState.buttons & XUSB.Y) !== 0} label="Y" />

                    <ButtonBadge active={(testState.buttons & XUSB.LB) !== 0} label="LB" />
                    <ButtonBadge active={(testState.buttons & XUSB.RB) !== 0} label="RB" />
                    <ButtonBadge active={(testState.buttons & XUSB.LEFT_THUMB) !== 0} label="LS Click" />
                    <ButtonBadge active={(testState.buttons & XUSB.RIGHT_THUMB) !== 0} label="RS Click" />

                    <ButtonBadge active={(testState.buttons & XUSB.BACK) !== 0} label="Back" />
                    <ButtonBadge active={(testState.buttons & XUSB.START) !== 0} label="Start" />
                    <ButtonBadge active={(testState.buttons & XUSB.GUIDE) !== 0} label="Guide" />
                    <ButtonBadge active={(testState.buttons & XUSB.DPAD_UP) !== 0} label="D-Up" />

                    <ButtonBadge active={(testState.buttons & XUSB.DPAD_DOWN) !== 0} label="D-Down" />
                    <ButtonBadge active={(testState.buttons & XUSB.DPAD_LEFT) !== 0} label="D-Left" />
                    <ButtonBadge active={(testState.buttons & XUSB.DPAD_RIGHT) !== 0} label="D-Right" />

                    {testState.extra_btn_1 !== undefined && (
                      <ButtonBadge active={!!testState.extra_btn_1} label="AST" />
                    )}
                    {testState.extra_btn_2 !== undefined && (
                      <ButtonBadge active={!!testState.extra_btn_2} label="CAP" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Mapping Tab ─────────────────────────────────── */}
        {activeTab === 'mapping' && (
          <div className="space-y-3">
            {/* Driver status */}
            <div className="flex gap-3 border-b border-border-wire pb-2">
              <StatusBadge
                available={controllerStatus?.vigembus_available ?? false}
                label="ViGEmBus"
              />
              <StatusBadge
                available={controllerStatus?.hidhide_available ?? false}
                label="HidHide"
              />
            </div>

            {(!controllerStatus?.vigembus_available || !controllerStatus?.hidhide_available) && (
              <div className="flex items-start gap-2 text-[10px] text-amber-400 border border-amber-900/50 bg-amber-950/20 rounded p-2">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                <span>
                  {!controllerStatus?.vigembus_available && 'ViGEmBus driver not found. '}
                  {!controllerStatus?.hidhide_available && 'HidHide not found. '}
                  Install both from nefarius.at to enable controller emulation.
                </span>
              </div>
            )}

            {/* Controller list */}
            <p className="text-xs text-zinc-500 tracking-widest">CONTROLLERS</p>

            {(!controllerStatus || controllerStatus.controllers.length === 0) && (
              <p className="text-xs text-zinc-650 text-center py-2">
                No supported controllers detected (Xbox / Stadia / PS4 / Generic Gamepads).
              </p>
            )}

            {controllerStatus?.controllers.map(ctrl => (
              <div
                key={ctrl.id}
                id={`ctrl-mapping-${ctrl.id}`}
                className="flex items-center justify-between bg-zinc-900/60 border border-border-wire rounded px-2.5 py-2 gap-2 hover:bg-zinc-800/40 hover:border-zinc-700/50 transition-all duration-200"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs truncate">{ctrl.name}</p>
                  <p className="text-[10px] text-zinc-600 capitalize">{ctrl.connection_type}</p>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-4 shrink-0">
                  {ctrl.is_xbox ? (
                    <span className="text-[10px] text-accent-green border border-accent-green/30 bg-accent-green/10 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                      Native Xbox
                    </span>
                  ) : (
                    <>
                      {/* Hide Physical toggle */}
                      {controllerStatus?.hidhide_available && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-500">Hide Physical</span>
                          <button
                            id={`ctrl-hide-toggle-${ctrl.id}`}
                            onClick={() =>
                              handleHidingToggle(ctrl.path, !hiddenToggles[ctrl.path])
                            }
                            className={`relative w-9 h-5 rounded-full transition-all duration-200 border ${
                              hiddenToggles[ctrl.path]
                                ? 'bg-accent-green/30 border-accent-green shadow-[0_0_8px_rgba(74,246,38,0.25)]'
                                : 'bg-zinc-800 border-zinc-600 hover:bg-zinc-750 hover:border-zinc-500'
                            }`}
                            aria-label={`Toggle physical hiding for ${ctrl.name}`}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${
                                hiddenToggles[ctrl.path]
                                  ? 'left-4 bg-accent-green shadow-[0_0_6px_rgba(74,246,38,0.8)]'
                                  : 'left-0.5 bg-zinc-500'
                              }`}
                            />
                          </button>
                        </div>
                      )}

                      {/* Emulation toggle */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-500">Xbox Emulation</span>
                        <button
                          id={`ctrl-emulation-toggle-${ctrl.id}`}
                          onClick={() =>
                            handleEmulationToggle(ctrl.path, !emulationToggles[ctrl.path])
                          }
                          className={`relative w-9 h-5 rounded-full transition-all duration-200 border ${
                            emulationToggles[ctrl.path]
                              ? 'bg-accent-green/30 border-accent-green shadow-[0_0_8px_rgba(74,246,38,0.25)]'
                              : 'bg-zinc-800 border-zinc-600 hover:bg-zinc-750 hover:border-zinc-500'
                          }`}
                          aria-label={`Toggle Xbox emulation for ${ctrl.name}`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${
                              emulationToggles[ctrl.path]
                                ? 'left-4 bg-accent-green shadow-[0_0_6px_rgba(74,246,38,0.8)]'
                                : 'left-0.5 bg-zinc-500'
                            }`}
                          />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Fix Double Input */}
            <div className="border-t border-border-wire pt-3 space-y-2">
              <button
                id="controller-fix-double-input-btn"
                onClick={handleFixDoubleInput}
                disabled={isFixingDoubleInput}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded border text-xs font-mono tracking-wider transition-all duration-200 ${
                  isFixingDoubleInput
                    ? 'border-accent-green/30 text-accent-green/50 bg-accent-green/10 cursor-wait'
                    : 'border-accent-green/50 text-accent-green hover:bg-accent-green/10 active:bg-accent-green/20'
                }`}
                aria-label="Fix double input by refreshing controller state"
              >
                <RefreshCw size={12} className={isFixingDoubleInput ? 'animate-spin' : ''} />
                {isFixingDoubleInput ? 'Refreshing…' : 'Fix Double Input'}
              </button>

              {/* Steam conflict note */}
              <div className="flex items-start gap-1.5 text-[10px] text-zinc-650">
                <Info size={10} className="mt-0.5 shrink-0" />
                <span>
                  If double input persists in Steam games, go to Steam → Settings → Controller
                  and disable &quot;PlayStation Configuration Support&quot;.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
