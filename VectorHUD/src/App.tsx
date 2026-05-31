import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { logger } from "./utils/logger";
import { getDb } from "./utils/db";
import { getSettingsStore, setSetting, getSetting } from "./utils/store";
import { useShellStore } from "./store/shellStore";
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

  // If not interactive (Ghost Mode), do not render any UI elements.
  // In the future, we will render pinned widgets here.
  if (!isInteractive) {
    return null;
  }

  // Interactive Mode UI
  return (
    <div 
      className="w-screen h-screen bg-black/40 backdrop-blur-sm transition-all duration-300 flex items-center justify-center pointer-events-auto border-[10px] border-emerald-500/20"
      onClick={(e) => {
        // Only dismiss if they clicked directly on the backdrop, not on the widgets inside
        if (e.target === e.currentTarget) {
          setInteractive(false);
        }
      }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 shadow-2xl flex flex-col items-center">
        <h1 className="text-3xl font-bold text-white mb-4">VectorHUD Interactive Mode</h1>
        <p className="text-zinc-400 text-center mb-6">
          Press <span className="bg-zinc-800 px-2 py-1 rounded text-zinc-200 font-mono">Ctrl+Alt+O</span> to hide this overlay and return to your game.
        </p>
      </div>
    </div>
  );
}

export default App;
