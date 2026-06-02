import { Cpu, Camera, Volume2, MessageSquare, Edit3, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { WIDGETS, useWidgetStore } from '../store/widgetStore';
import { useSettingsStore } from '../store/settingsStore';
import { DockItem } from './DockItem';

const iconMap: Record<string, LucideIcon> = {
  'Cpu': Cpu,
  'Camera': Camera,
  'Volume2': Volume2,
  'MessageSquare': MessageSquare,
  'Edit3': Edit3,
};

export function Dock() {
  const { activeWidgets, toggleWidget } = useWidgetStore();

  return (
    <motion.div 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
    >
      <div className="flex items-center gap-2 p-3 rounded-2xl bg-surface border border-border-wire shadow-2xl backdrop-blur-md">
        <div className="px-4 border-r border-border-wire/50 flex flex-col items-center justify-center">
          <span className="font-mono text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase mb-1">
            Vector
          </span>
          <span className="font-mono text-sm text-primary font-bold tracking-widest uppercase">
            HUD
          </span>
        </div>
        
        <div className="flex gap-2 pl-2 overflow-x-auto snap-x custom-scrollbar max-w-[420px]">
          {WIDGETS.map((widget) => {
            const Icon = iconMap[widget.iconName];
            const isActive = !!activeWidgets[widget.id];
            
            return (
              <DockItem
                key={widget.id}
                id={widget.id}
                label={widget.label}
                Icon={Icon}
                isActive={isActive}
                onClick={() => toggleWidget(widget.id)}
              />
            );
          })}
        </div>

        {/* Settings Button Separator */}
        <div className="w-[1px] h-8 bg-border-wire/50 mx-2" />

        <button
          onClick={useSettingsStore.getState().toggleSettings}
          className="p-3 rounded-xl transition-all duration-300 hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] text-zinc-400 hover:text-white"
        >
          <Settings size={22} strokeWidth={1.5} />
        </button>
      </div>
    </motion.div>
  );
}
