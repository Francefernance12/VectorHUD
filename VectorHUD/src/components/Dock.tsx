import { Cpu, Camera, Volume2, MessageSquare, Edit3, Clock, LucideIcon } from 'lucide-react';
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
  'Clock': Clock,
};

export function Dock() {
  const { activeWidgets, toggleWidget } = useWidgetStore();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed top-6 inset-x-0 flex justify-center pointer-events-none z-[60]"
    >
      <div 
        className="pointer-events-auto flex items-center p-3 rounded-2xl bg-black border border-accent-green/30 gap-4 flex-wrap max-w-full justify-center transition-all duration-500"
        style={{ boxShadow: '0 0 30px rgba(var(--accent-green-rgb), 0.25)' }}
      >
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

        <div className="w-[1px] h-10 bg-white/10 mx-1" />
        
        <button
          onClick={useSettingsStore.getState().toggleSettings}
          aria-label="Open System Settings"
          title="Open System Settings"
          className="p-3 rounded-xl transition-all duration-300 hover:bg-white/10 text-zinc-400 hover:text-white"
        >
          <Settings size={24} strokeWidth={1.5} />
        </button>
      </div>
    </motion.div>
  );
}
