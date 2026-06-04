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
    let pendingSave = false;

    const flushSave = () => {
      if (pendingSave) {
        clearTimeout(saveTimeout);
        setSetting("activeWidgets", useWidgetStore.getState().activeWidgets).catch(err => {
          logger.error(`Failed to flush widget layout: ${err}`).catch(console.error);
        });
        pendingSave = false;
      }
    };

    window.addEventListener('beforeunload', flushSave);

    const unsubscribeStore = useWidgetStore.subscribe((state) => {
      pendingSave = true;
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        setSetting("activeWidgets", state.activeWidgets).catch(err => {
          logger.error(`Failed to save widget layout: ${err}`).catch(console.error);
        });
        pendingSave = false;
      }, 500); // 500ms debounce
    });

    // Start in Ghost Mode by explicitly telling Rust to ignore cursor events
    setInteractive(false);


    let isMounted = true;
    const unlistenListeners: Array<() => void> = [];

    const safePush = (unlisten: () => void) => {
      if (!isMounted) {
        unlisten();
      } else {
        unlistenListeners.push(unlisten);
      }
    };

    const initListeners = async () => {
      try {
        if (!isMounted) return;
        const unlistenShortcut = await listen("hotkey-overlay", () => {
          toggleInteractive();
        });
        safePush(unlistenShortcut);

        if (!isMounted) return;
        const unlistenToast = await listen<string>("hud-toast", (event) => {
          showToast(event.payload);
        });
        safePush(unlistenToast);

        if (!isMounted) return;
        const unlistenFocusLoss = await listen("window-lost-focus", () => {
          setInteractive(false);
        });
        safePush(unlistenFocusLoss);

        if (!isMounted) return;
        const unlistenForceInteractive = await listen("force-interactive", () => {
          setInteractive(true);
        });
        safePush(unlistenForceInteractive);

        if (!isMounted) return;
        const unlistenScreenshot = await listen("hotkey-screenshot", async () => {
          try {
            const path = await invoke<string>('capture_screenshot');
            await getDb().then(db => db.execute('INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)', [path, 'screenshot', 'Desktop']));
            window.dispatchEvent(new Event('refresh-capture-history'));
            showToast("📸 Screenshot Saved");
          } catch (err) {
            logger.error(`Screenshot hotkey failed: ${err}`).catch(console.error);
          }
        });
        safePush(unlistenScreenshot);

        if (!isMounted) return;
        const unlistenRecord = await listen("hotkey-record", async () => {
          const isRec = useRecordingStore.getState().isRecording;
          if (isRec) {
            try {
              const path = await invoke<string>('stop_video_recording');
              await getDb().then(db => db.execute('INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)', [path, 'video', 'Desktop']));
              useRecordingStore.getState().setRecording(false);
              window.dispatchEvent(new Event('refresh-capture-history'));
              showToast("⏹️ Recording Saved");
            } catch (err) {
              logger.error(`Stop recording hotkey failed: ${err}`).catch(console.error);
            }
          } else {
            try {
              const micEnabled = useSettingsStore.getState().recordMicrophone;
              const audioEnabled = useSettingsStore.getState().recordSystemAudio;
              await invoke<string>('start_video_recording', { micEnabled, audioEnabled });
              useRecordingStore.getState().setRecording(true);
              showToast("🔴 Recording Started");
            } catch (err) {
              logger.error(`Start recording hotkey failed: ${err}`).catch(console.error);
            }
          }
        });
        safePush(unlistenRecord);

        if (!isMounted) return;
        const unlistenReplay = await listen("hotkey-replay", async () => {
          const isReplay = useRecordingStore.getState().isReplayActive;
          if (isReplay) {
            showToast("⏳ Processing 30s Clip...");
            try {
              const path = await invoke<string>('save_replay_buffer');
              await getDb().then(db => db.execute('INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)', [path, 'video', 'Desktop']));
              window.dispatchEvent(new Event('refresh-capture-history'));
              showToast("⚡ Replay Clip Saved");
            } catch (err) {
              logger.error(`Save replay hotkey failed: ${err}`).catch(console.error);
            }
          } else {
            try {
              const micEnabled = useSettingsStore.getState().recordMicrophone;
              const audioEnabled = useSettingsStore.getState().recordSystemAudio;
              await invoke('start_replay_buffer', { micEnabled, audioEnabled });
              useRecordingStore.getState().setReplayActive(true);
              showToast("⏪ Replay Buffer Started");
            } catch (err) {
              logger.error(`Start replay hotkey failed: ${err}`).catch(console.error);
            }
          }
        });
        safePush(unlistenReplay);

        if (!isMounted) return;
        const unlistenTimer = await listen("hotkey-timer", () => {
          const { cdIsRunning, cdFinished, cdTime, cdInput, pauseCd, startCd, resetCd } = useTimerStore.getState();
          if (cdIsRunning) {
            pauseCd();
          } else {
            if (cdFinished) resetCd();
            if (cdTime === 0) useTimerStore.getState().setCdInput(cdInput);
            startCd();
          }
        });
        safePush(unlistenTimer);

        if (!isMounted) return;
        const unlistenStopwatch = await listen("hotkey-stopwatch", () => {
          const { swIsRunning, pauseSw, startSw } = useTimerStore.getState();
          if (swIsRunning) pauseSw();
          else startSw();
        });
        safePush(unlistenStopwatch);

        if (!isMounted) return;
        const unlistenTimerReset = await listen("hotkey-timer-reset", () => {
          useTimerStore.getState().resetCd();
          useTimerStore.getState().resetSw();
        });
        safePush(unlistenTimerReset);
      } catch (err) {
        logger.error(`Failed to initialize listeners: ${err}`).catch(console.error);
      }
    };
    initListeners();

    const handleBlur = () => {
      if (useShellStore.getState().isInteractive) {
        setInteractive(false);
      }
    };
    window.addEventListener('blur', handleBlur);

    const handleGlobalError = (event: ErrorEvent) => {
      logger.error(
        `[UNCAUGHT] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`
      ).catch(console.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
      logger.error(`[UNHANDLED_REJECTION] ${reason}`).catch(console.error);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      isMounted = false;
      unlistenListeners.forEach(fn => fn());
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', flushSave);
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      unsubscribeStore();
      clearTimeout(saveTimeout);
    };
  }, [setInteractive, toggleInteractive, showToast]);

  return (
    <>
      {/* HUD Toasts */}
      <div className="fixed inset-x-0 top-16 z-[9999] pointer-events-none flex flex-col items-center gap-2">
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
        <div className={isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}>
          <RecordingStatusBar />
        </div>
      )}

      {/* Floating persistent timer status bar */}
      <TimerStatusBar />

      {/* Interactive Overlay UI Backdrop */}
      <AnimatePresence>
        {isInteractive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 shadow-[inset_0_0_100px_rgba(var(--accent-amber-rgb,0,0,0),0.1)] backdrop-blur-sm transition-all duration-300 pointer-events-auto z-[40]"
            onClick={(e) => {
              // Only dismiss if they clicked directly on the backdrop, not on the widgets inside
              if (e.target === e.currentTarget) {
                setInteractive(false);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Widget Layer (Rendered at z-50 so it is above the backdrop but below the settings modal) */}
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

      {/* Dock and Settings Modal Layer (Rendered at z-[60] so they are above everything) */}
      <AnimatePresence>
        {isInteractive && (
          <div className="fixed inset-0 pointer-events-none z-[60]">
            <Dock />
            <SettingsModal />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
