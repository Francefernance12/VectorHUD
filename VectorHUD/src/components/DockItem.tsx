import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface DockItemProps {
  id: string;
  label: string;
  Icon: LucideIcon;
  isActive: boolean;
  onClick: () => void;
}

export function DockItem({ label, Icon, isActive, onClick }: DockItemProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center justify-center w-20 h-20 rounded-xl transition-all duration-300 border
        ${isActive 
          ? 'bg-zinc-800/80 border-accent-green/50 shadow-[0_0_15px_rgba(74,246,38,0.15)]' 
          : 'bg-transparent border-transparent hover:bg-zinc-800/50 hover:border-border-wire'
        }
      `}
    >
      <Icon 
        className={`w-7 h-7 mb-2 transition-colors duration-300 ${isActive ? 'text-accent-green' : 'text-zinc-400 group-hover:text-primary'}`} 
      />
      <span 
        className={`text-[10px] font-mono tracking-wider transition-colors duration-300 uppercase ${isActive ? 'text-accent-green font-semibold' : 'text-zinc-500 group-hover:text-zinc-300'}`}
      >
        {label}
      </span>
      
      {/* Active Indicator Underline */}
      {isActive && (
        <motion.div 
          layoutId="active-dock-indicator"
          className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-8 h-[3px] bg-accent-green rounded-t-full shadow-[0_0_8px_rgba(74,246,38,0.8)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </button>
  );
}
