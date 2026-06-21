import { useState, useRef, useEffect } from 'react';
import { 
  Cpu, Camera, Volume2, MessageSquare, Edit3, Clock, Gamepad2, 
  Settings, ChevronLeft, ChevronRight, Grid, LucideIcon 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WIDGETS, useWidgetStore } from '../store/widgetStore';
import { useSettingsStore } from '../store/settingsStore';
import { logger } from '../utils/logger';

const iconMap: Record<string, LucideIcon> = {
  'Cpu': Cpu,
  'Camera': Camera,
  'Volume2': Volume2,
  'MessageSquare': MessageSquare,
  'Edit3': Edit3,
  'Clock': Clock,
  'Gamepad2': Gamepad2,
};

const widgetDescriptions: Record<string, string> = {
  'hardware-metrics': 'CPU, GPU, RAM & FPS performance monitoring.',
  'media-capture': 'Screenshots, manual recordings & video gallery.',
  'audio-mixer': 'App volume mixer and audio device selector.',
  'ai-chat': 'AI chat assistant with vision capabilities.',
  'quick-notes': 'Capture routine tasks and checkable lists.',
  'game-timer': 'Stopwatch, countdown & resetting utilities.',
  'controller-bluetooth': 'Bluetooth scanning & gamepad diagnostic tools.',
};

export function Dock() {
  const { activeWidgets, toggleWidget } = useWidgetStore();
  const { dockCollapsed, setDockCollapsed, toggleSettings } = useSettingsStore();
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const libraryRef = useRef<HTMLDivElement>(null);

  // Close library popover if user clicks outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (libraryRef.current && !libraryRef.current.contains(event.target as Node)) {
        setIsLibraryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Log Dock toggles
  const handleCollapseToggle = () => {
    const nextState = !dockCollapsed;
    setDockCollapsed(nextState).catch(console.error);
    logger.info(`Dock: toggled collapsed state to ${nextState}`).catch(console.error);
    if (nextState) {
      setIsLibraryOpen(false);
    }
  };

  const handleLibraryToggle = () => {
    setIsLibraryOpen(!isLibraryOpen);
    logger.info(`Dock: toggled widgets library popover to ${!isLibraryOpen}`).catch(console.error);
  };

  const handleWidgetToggle = (id: string) => {
    toggleWidget(id);
    logger.info(`Dock: toggled widget ${id}`).catch(console.error);
  };

  // Find currently active widget IDs
  const activeWidgetIds = Object.keys(activeWidgets);

  return (
    <div className="fixed top-6 inset-x-0 flex flex-col items-center pointer-events-none z-[60]">
      {/* Dock Bar */}
      <motion.div 
        layout
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-auto flex items-center p-2 rounded-2xl bg-black border border-accent-green/30 gap-3 transition-all duration-300"
        style={{ 
          boxShadow: '0 0 30px rgba(var(--accent-green-rgb), 0.15)',
          borderRadius: '16px'
        }}
      >
        {/* Collapse / Expand Toggle Button */}
        <button
          onClick={handleCollapseToggle}
          title={dockCollapsed ? "Expand Dock" : "Collapse Dock"}
          aria-label={dockCollapsed ? "Expand Dock" : "Collapse Dock"}
          className="p-2 rounded-xl transition-all duration-200 hover:bg-white/10 text-zinc-400 hover:text-accent-green cursor-pointer flex items-center justify-center"
        >
          {dockCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <AnimatePresence mode="popLayout">
          {!dockCollapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 overflow-hidden"
            >
              {/* Widgets Library Button */}
              <button
                onClick={handleLibraryToggle}
                title="Widget Library"
                aria-label="Widget Library"
                className={`p-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 cursor-pointer border ${
                  isLibraryOpen 
                    ? 'bg-accent-green/10 border-accent-green/30 text-accent-green' 
                    : 'bg-transparent border-transparent hover:bg-white/5 text-zinc-400 hover:text-white hover:border-white/5'
                }`}
              >
                <Grid size={18} />
                <span className="text-xs font-bold font-mono tracking-widest uppercase">Widgets</span>
                {activeWidgetIds.length > 0 && (
                  <span className="flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-accent-green text-black font-sans font-bold text-[9px] tracking-normal">
                    {activeWidgetIds.length}
                  </span>
                )}
              </button>

              {/* Visual Divider (only if we have active widgets list) */}
              {activeWidgetIds.length > 0 && (
                <div className="w-[1px] h-6 bg-white/10" />
              )}

              {/* Active Widgets Quick Access (Small Icons) */}
              {activeWidgetIds.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {activeWidgetIds.map((id) => {
                    const widget = WIDGETS.find(w => w.id === id);
                    if (!widget) return null;
                    const Icon = iconMap[widget.iconName];
                    return (
                      <button
                        key={id}
                        onClick={() => handleWidgetToggle(id)}
                        title={`Close ${widget.label}`}
                        aria-label={`Close ${widget.label}`}
                        className="p-2 rounded-lg bg-zinc-900 border border-accent-green/20 hover:border-red-500/40 text-accent-green hover:text-red-400 transition-all cursor-pointer flex items-center justify-center group relative"
                      >
                        <Icon size={14} />
                        <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-accent-green rounded-full border border-black shadow-[0_0_4px_rgba(74,246,38,0.8)] group-hover:bg-red-500 group-hover:shadow-[0_0_4px_rgba(239,68,68,0.8)] transition-all" />
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Visual Divider */}
        <div className="w-[1px] h-6 bg-white/10" />

        {/* Settings Button */}
        <button
          onClick={toggleSettings}
          aria-label="Open System Settings"
          title="Open System Settings"
          className="p-2 rounded-xl transition-all duration-200 hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer flex items-center justify-center"
        >
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </motion.div>

      {/* Widget Library Popover Grid */}
      <AnimatePresence>
        {isLibraryOpen && (
          <motion.div
            ref={libraryRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-auto mt-3 p-4 bg-black border border-white/15 rounded-xl flex flex-col gap-2.5 z-50 w-[380px] shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-[10px] font-bold text-zinc-400 font-mono tracking-widest uppercase">HUD Widget Library</span>
              <span className="text-[9px] text-zinc-600 font-mono">Select widgets to display</span>
            </div>

            {/* List of Widgets */}
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {WIDGETS.map((widget) => {
                const Icon = iconMap[widget.iconName];
                const isActive = !!activeWidgets[widget.id];
                const desc = widgetDescriptions[widget.id] || '';
                
                return (
                  <button
                    key={widget.id}
                    onClick={() => handleWidgetToggle(widget.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all duration-200 cursor-pointer group ${
                      isActive
                        ? 'bg-accent-green/5 border-accent-green/30 text-white'
                        : 'bg-zinc-950/40 border-white/5 hover:border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {/* Icon container */}
                    <div className={`p-2 rounded-md transition-colors ${
                      isActive ? 'bg-accent-green/10 text-accent-green' : 'bg-white/5 text-zinc-400 group-hover:text-zinc-200'
                    }`}>
                      <Icon size={16} />
                    </div>

                    {/* Meta info */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-accent-green' : ''}`}>
                        {widget.label}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-sans leading-tight mt-0.5 group-hover:text-zinc-400 transition-colors">
                        {desc}
                      </div>
                    </div>

                    {/* Status Dot / Toggle visual */}
                    <div className="flex items-center justify-center shrink-0">
                      <div className={`w-3 h-3 rounded-full border transition-all ${
                        isActive 
                          ? 'bg-accent-green border-accent-green shadow-[0_0_8px_rgba(74,246,38,0.8)]' 
                          : 'bg-transparent border-zinc-700'
                      }`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
