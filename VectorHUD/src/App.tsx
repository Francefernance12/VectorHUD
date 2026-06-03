import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "framer-motion";
import { logger } from "./utils/logger";
import { getDb } from "./utils/db";
import { setSetting, getSetting } from "./utils/store";
import { useShellStore } from "./store/shellStore";
import { useWidgetStore } from "./store/widgetStore";
import { useSettingsStore } from "./store/settingsStore";
import { useToastStore } from "./store/toastStore";
import { useTimerStore } from "./store/timerStore";
import { useShallow } from 'zustand/react/shallow';
import { Dock } from "./components/Dock";
import { WidgetContainer } from "./components/WidgetContainer";
import { SettingsModal } from "./components/SettingsModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DummyWidget } from "./components/widgets/DummyWidget";
import { HardwareWidget } from "./components/widgets/HardwareWidget";
import { MediaCaptureWidget } from "./components/widgets/MediaCaptureWidget";
import { AudioHubWidget } from "./components/widgets/AudioHubWidget";
import { OpenRouterWidget } from "./components/widgets/OpenRouterWidget";
import { NotionCaptureWidget } from "./components/widgets/NotionCaptureWidget";
import { TimerWidget } from "./components/widgets/TimerWidget";
import { RecordingStatusBar } from "./components/RecordingStatusBar";
import { TimerStatusBar } from "./components/TimerStatusBar";
import { useRecordingStore } from "./store/recordingStore";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const isInteractive = useShellStore((state) => state.isInteractive);
  const toggleInteractive = useShellStore((state) => state.toggleInteractive);
  const setInteractive = useShellStore((state) => state.setInteractive);
  
  const activeWidgetIds = useWidgetStore(useShallow((state) => Object.keys(state.activeWidgets)));
  
  const interactablePins = useSettingsStore((state) => state.interactablePins);
  const isRecording = useRecordingStore((state) => state.isRecording);

  // Global Toast Store
  const toasts = useToastStore((state) => state.toasts);
  const showToast = useToastStore((state) => state.showToast);

  // Force settings to close in state when exiting interactive mode
  useEffect(() => {
    if (!isInteractive && useSettingsStore.getState().isSettingsOpen) {
      useSettingsStore.getState().toggleSettings();
    }
  }, [isInteractive]);

  useEffect(() => {
    logger.info("VectorHUD UI Booted");

    const verifyPersistence = async () => {
      try {
        await getDb(); // Boot SQLite
        await setSetting("last_boot", new Date().toISOString()); // Boot Store
        const lastBoot = await getSetting("last_boot", "unknown");
        logger.info(`Persistence verified. Last boot: ${lastBoot}`);

        // Hydrate widget layout
        const savedWidgets = await getSetting<Record<string, ReturnType<typeof useWidgetStore.getState>['activeWidgets'][string]>>("activeWidgets", {} as Record<string, ReturnType<typeof useWidgetStore.getState>['activeWidgets'][string]>);
        if (Object.keys(savedWidgets).length > 0) {
          useWidgetStore.getState().setInitialState(savedWidgets);
        }

        // Hydrate settings
        await useSettingsStore.getState().loadPreferences();
      } catch (err) {
        logger.error(`Persistence verification failed: ${err}`);
      }
    };
    verifyPersistence();

    // Subscribe to state changes and save to disk (debounced)
    let saveTimeout: ReturnType<typeof setTimeout>;
    const unsubscribeStore = useWidgetStore.subscribe((state) => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        setSetting("activeWidgets", state.activeWidgets).catch(err => {
          logger.error(`Failed to save widget layout: ${err}`);
        });
      }, 500); // 500ms debounce
    });

    // Start in Ghost Mode by explicitly telling Rust to ignore cursor events
    setInteractive(false);


    // Listen for the global shortcut event from Rust
    const unlistenShortcut = listen("hotkey-overlay", () => {
      toggleInteractive();
    });

    // Listen for HUD toasts from Rust
    const unlistenToast = listen<string>("hud-toast", (event) => {
      showToast(event.payload);
    });

    // Dismiss overlay when clicking on another monitor (window loses focus)
    const unlistenFocusLoss = listen("window-lost-focus", () => {
      setInteractive(false);
    });

    // Global Hotkey Listeners
    const unlistenScreenshot = listen("hotkey-screenshot", async () => {
      try {
        const path = await invoke<string>('capture_screenshot');
        await getDb().then(db => db.execute('INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)', [path, 'screenshot', 'Desktop']));
        window.dispatchEvent(new Event('refresh-capture-history'));
        showToast("📸 Screenshot Saved");
      } catch (err) {
        logger.error(`Screenshot hotkey failed: ${err}`);
      }
    });

    const unlistenRecord = listen("hotkey-record", async () => {
      const isRec = useRecordingStore.getState().isRecording;
      if (isRec) {
        try {
          const path = await invoke<string>('stop_video_recording');
          await getDb().then(db => db.execute('INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)', [path, 'video', 'Desktop']));
          useRecordingStore.getState().setRecording(false);
          window.dispatchEvent(new Event('refresh-capture-history'));
          showToast("⏹️ Recording Saved");
        } catch (err) {
          logger.error(`Stop recording hotkey failed: ${err}`);
        }
      } else {
        try {
          const micEnabled = useSettingsStore.getState().recordMicrophone;
          const audioEnabled = useSettingsStore.getState().recordSystemAudio;
          await invoke<string>('start_video_recording', { micEnabled, audioEnabled });
          useRecordingStore.getState().setRecording(true);
          showToast("🔴 Recording Started");
        } catch (err) {
          logger.error(`Start recording hotkey failed: ${err}`);
        }
      }
    });

    const unlistenReplay = listen("hotkey-replay", async () => {
      const isReplay = useRecordingStore.getState().isReplayActive;
      if (isReplay) {
        try {
          const path = await invoke<string>('save_replay_buffer');
          await getDb().then(db => db.execute('INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)', [path, 'video', 'Desktop']));
          window.dispatchEvent(new Event('refresh-capture-history'));
          showToast("⚡ Replay Clip Saved");
        } catch (err) {
          logger.error(`Save replay hotkey failed: ${err}`);
        }
      } else {
        try {
          const micEnabled = useSettingsStore.getState().recordMicrophone;
          const audioEnabled = useSettingsStore.getState().recordSystemAudio;
          await invoke('start_replay_buffer', { micEnabled, audioEnabled });
          useRecordingStore.getState().setReplayActive(true);
          showToast("⏪ Replay Buffer Started");
        } catch (err) {
          logger.error(`Start replay hotkey failed: ${err}`);
        }
      }
    });
    const unlistenTimer = listen("hotkey-timer", () => {
      const { cdIsRunning, cdFinished, cdTime, cdInput, pauseCd, startCd, resetCd } = useTimerStore.getState();
      if (cdIsRunning) {
        pauseCd();
      } else {
        if (cdFinished) resetCd();
        if (cdTime === 0) useTimerStore.getState().setCdInput(cdInput);
        startCd();
      }
    });

    const unlistenStopwatch = listen("hotkey-stopwatch", () => {
      const { swIsRunning, pauseSw, startSw } = useTimerStore.getState();
      if (swIsRunning) pauseSw();
      else startSw();
    });

    const handleBlur = () => {
      if (useShellStore.getState().isInteractive) {
        setInteractive(false);
      }
    };
    window.addEventListener('blur', handleBlur);

    // Global error handlers for crash reporting — forward uncaught JS errors to Rust logger
    const handleGlobalError = (event: ErrorEvent) => {
      logger.error(
        `[UNCAUGHT] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
      logger.error(`[UNHANDLED_REJECTION] ${reason}`);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      unlistenShortcut.then((fn) => fn());
      unlistenToast.then((fn) => fn());
      unlistenScreenshot.then((fn) => fn());
      unlistenRecord.then((fn) => fn());
      unlistenReplay.then((fn) => fn());
      unlistenFocusLoss.then((fn) => fn());
      unlistenTimer.then((fn) => fn());
      unlistenStopwatch.then((fn) => fn());
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      unsubscribeStore();
      clearTimeout(saveTimeout);
    };
  }, [setInteractive, toggleInteractive, showToast]);

  return (
    <>
      {/* HUD Toasts */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex flex-col items-center gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="bg-black/90 backdrop-blur-md border border-white/20 text-white font-mono text-xs px-4 py-2 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.1)] font-bold tracking-widest"
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating persistent recording status bar */}
      {isRecording && (
        <div className={isInteractive || interactablePins ? 'pointer-events-auto' : 'pointer-events-none'}>
          <RecordingStatusBar />
        </div>
      )}

      {/* Floating persistent timer status bar */}
      <TimerStatusBar />

      {/* Widget Layer (Always rendered above the overlay so widgets stay bright and interactive) */}
      <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden" id="widget-bounds">
        <AnimatePresence>
          {activeWidgetIds.map((id) => (
            <div key={id} className={isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}>
              <WidgetContainer id={id}>
                <ErrorBoundary>
                  {id === 'hardware-metrics' ? <HardwareWidget /> : 
                   id === 'media-capture' ? <MediaCaptureWidget /> : 
                   id === 'audio-mixer' ? <AudioHubWidget /> :
                   id === 'ai-chat' ? <OpenRouterWidget /> :
                   id === 'quick-notes' ? <NotionCaptureWidget /> :
                   id === 'game-timer' ? <TimerWidget /> :
                   <DummyWidget />}
                </ErrorBoundary>
              </WidgetContainer>
            </div>
          ))}
        </AnimatePresence>
      </div>



      {/* Interactive Overlay UI Backdrop & Dock */}
      <AnimatePresence>
        {isInteractive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-overlay backdrop-blur-sm transition-all duration-300 pointer-events-auto z-40"
            onClick={(e) => {
              // Only dismiss if they clicked directly on the backdrop, not on the widgets inside
              if (e.target === e.currentTarget) {
                setInteractive(false);
              }
            }}
          >
            <Dock />
            <SettingsModal />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
