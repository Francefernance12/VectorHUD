import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "framer-motion";
import { logger } from "./utils/logger";
import { getDb } from "./utils/db";
import { setSetting, getSetting } from "./utils/store";
import { useShellStore } from "./store/shellStore";
import { useWidgetStore } from "./store/widgetStore";
import { useShallow } from 'zustand/react/shallow';
import { Dock } from "./components/Dock";
import { WidgetContainer } from "./components/WidgetContainer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DummyWidget } from "./components/widgets/DummyWidget";
import { HardwareWidget } from "./components/widgets/HardwareWidget";
import { MediaCaptureWidget } from "./components/widgets/MediaCaptureWidget";
import { OpenRouterWidget } from "./components/widgets/OpenRouterWidget";
import { NotionCaptureWidget } from "./components/widgets/NotionCaptureWidget";
import "./App.css";

function App() {
  const isInteractive = useShellStore((state) => state.isInteractive);
  const toggleInteractive = useShellStore((state) => state.toggleInteractive);
  const setInteractive = useShellStore((state) => state.setInteractive);
  
  const activeWidgetIds = useWidgetStore(useShallow((state) => Object.keys(state.activeWidgets)));
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
    const unlistenShortcut = listen("toggle-interactive-mode", () => {
      toggleInteractive();
    });

    // Dismiss overlay when clicking on another monitor (window loses focus)
    const unlistenFocusLoss = listen("window-lost-focus", () => {
      setInteractive(false);
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
      unlistenFocusLoss.then((fn) => fn());
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      unsubscribeStore();
      clearTimeout(saveTimeout);
    };
  }, [setInteractive, toggleInteractive]);

  return (
    <>
      {/* Widget Layer (Always rendered above the overlay so widgets stay bright and interactive) */}
      <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden" id="widget-bounds">
        <AnimatePresence>
          {activeWidgetIds.map((id) => (
            <div key={id} className={isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}>
              <WidgetContainer id={id}>
                <ErrorBoundary>
                  {id === 'hardware-metrics' ? <HardwareWidget /> : 
                   id === 'media-capture' ? <MediaCaptureWidget /> : 
                   id === 'ai-chat' ? <OpenRouterWidget /> :
                   id === 'quick-notes' ? <NotionCaptureWidget /> :
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
