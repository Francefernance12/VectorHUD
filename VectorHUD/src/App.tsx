import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "framer-motion";
import { logger } from "./utils/logger";
import { getDb } from "./utils/db";
import { getSettingsStore, setSetting, getSetting } from "./utils/store";
import { useShellStore } from "./store/shellStore";
import { useWidgetStore } from "./store/widgetStore";
import { Dock } from "./components/Dock";
import { WidgetContainer } from "./components/WidgetContainer";
import { DummyWidget } from "./components/widgets/DummyWidget";
import "./App.css";

function App() {
  const isInteractive = useShellStore((state) => state.isInteractive);
  const toggleInteractive = useShellStore((state) => state.toggleInteractive);
  const setInteractive = useShellStore((state) => state.setInteractive);
  
  const activeWidgets = useWidgetStore((state) => state.activeWidgets);
  const [containerRect, setContainerRect] = useState({ top: 0, left: 0, right: 0, bottom: 0 });

  useEffect(() => {
    logger.info("VectorHUD UI Booted");

    const verifyPersistence = async () => {
      try {
        await getDb(); // Boot SQLite
        await setSetting("last_boot", new Date().toISOString()); // Boot Store
        const lastBoot = await getSetting("last_boot", "unknown");
        logger.info(`Persistence verified. Last boot: ${lastBoot}`);

        // Hydrate widget layout
        const savedWidgets = await getSetting<Record<string, any>>("activeWidgets", {});
        if (Object.keys(savedWidgets).length > 0) {
          useWidgetStore.getState().setInitialState(savedWidgets as any);
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

    // Set screen bounds for dragging
    setContainerRect({
      top: 0,
      left: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    });

    // Listen for the global shortcut event from Rust
    const unlisten = listen("toggle-interactive-mode", () => {
      toggleInteractive();
    });

    return () => {
      unlisten.then((fn) => fn());
      unsubscribeStore();
      clearTimeout(saveTimeout);
    };
  }, [setInteractive, toggleInteractive]);

  return (
    <>
      {/* Widget Layer (Always rendered, sits beneath the interactive overlay so it gets dimmed, OR we can put it above.
          Let's put it ABOVE the overlay so the widgets are always bright and interactive! ) */}
      <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden" id="widget-bounds">
        <AnimatePresence>
          {Object.keys(activeWidgets).map((id) => (
            <div key={id} className={isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}>
              <WidgetContainer id={id}>
                <DummyWidget />
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
            className="fixed inset-0 bg-overlay backdrop-blur-sm transition-all duration-300 pointer-events-auto border-[4px] border-accent-green/10 z-40"
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
