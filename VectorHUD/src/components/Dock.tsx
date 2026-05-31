import { Cpu, Camera, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { WIDGETS, useWidgetStore } from '../store/widgetStore';
import { DockItem } from './DockItem';

const iconMap: Record<string, any> = {
  'Cpu': Cpu,
  'Camera': Camera,
  'Volume2': Volume2,
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
        
        <div className="flex gap-2 pl-2">
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
      </div>
    </motion.div>
  );
}
