import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence } from "framer-motion";
import { logger } from "./utils/logger";
import { getDb } from "./utils/db";
import { getSettingsStore, setSetting, getSetting } from "./utils/store";
import { useShellStore } from "./store/shellStore";
import { Dock } from "./components/Dock";
import "./App.css";

function App() {
  const isInteractive = useShellStore((state) => state.isInteractive);
  const toggleInteractive = useShellStore((state) => state.toggleInteractive);
  const setInteractive = useShellStore((state) => state.setInteractive);

  useEffect(() => {
    logger.info("VectorHUD UI Booted");

    const verifyPersistence = async () => {
      try {
        await getDb(); // Boot SQLite
        await setSetting("last_boot", new Date().toISOString()); // Boot Store
        const lastBoot = await getSetting("last_boot", "unknown");
        logger.info(`Persistence verified. Last boot: ${lastBoot}`);
      } catch (err) {
        logger.error(`Persistence verification failed: ${err}`);
      }
    };
    verifyPersistence();

    // Start in Ghost Mode by explicitly telling Rust to ignore cursor events
    setInteractive(false);

    // Listen for the global shortcut event from Rust
    const unlisten = listen("toggle-interactive-mode", () => {
      toggleInteractive();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setInteractive, toggleInteractive]);

  return (
    <>
      {/* Ghost Mode UI (Always rendered, but click-through) */}
      <div className="w-screen h-screen pointer-events-none relative">
        {/* Pinned Widgets will go here eventually */}
      </div>

      {/* Interactive Overlay UI */}
      <AnimatePresence>
        {isInteractive && (
          <div 
            className="fixed inset-0 bg-overlay backdrop-blur-sm transition-all duration-300 pointer-events-auto border-[4px] border-accent-green/10 z-40"
            onClick={(e) => {
              // Only dismiss if they clicked directly on the backdrop, not on the widgets inside
              if (e.target === e.currentTarget) {
                setInteractive(false);
              }
            }}
          >
            <Dock />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
