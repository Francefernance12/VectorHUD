import { ReactNode, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, GripHorizontal, Pin, PinOff } from 'lucide-react';
import { useWidgetStore, WIDGETS } from '../store/widgetStore';
import { useShellStore } from '../store/shellStore';


interface WidgetContainerProps {
  id: string;
  children: ReactNode;
}

export function WidgetContainer({ id, children }: WidgetContainerProps) {
  
  // Use granular selectors to prevent re-rendering when OTHER widgets update
  const instance = useWidgetStore(state => state.activeWidgets[id]);
  const toggleWidget = useWidgetStore(state => state.toggleWidget);
  const bringToFront = useWidgetStore(state => state.bringToFront);
  const updateWidgetBounds = useWidgetStore(state => state.updateWidgetBounds);
  const togglePin = useWidgetStore(state => state.togglePin);

  const isInteractive = useShellStore(state => state.isInteractive);
  const isOverlayOpen = useShellStore(state => state.isOverlayOpen);
  
  const [winBounds, setWinBounds] = useState({ 
    w: typeof window !== 'undefined' ? window.innerWidth : 1920, 
    h: typeof window !== 'undefined' ? window.innerHeight : 1080 
  });

  useEffect(() => {
    const handleResize = () => setWinBounds({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const widgetDef = WIDGETS.find(w => w.id === id);
  
  if (!widgetDef || !instance) return null;

  // Fix: Unpinned widgets do not persist when overlay is dismissed.
  if (!isOverlayOpen && !instance.isPinned) return null;

  // Clamp coordinates to prevent widgets getting lost off-screen on smaller monitors
  const safeX = Math.max(0, Math.min(instance.x, Math.max(0, winBounds.w - instance.width)));
  const safeY = Math.max(0, Math.min(instance.y, Math.max(0, winBounds.h - instance.height)));

  return (
    <motion.div
      onPointerDown={() => bringToFront(id)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'absolute',
        zIndex: instance.zIndex,
        width: instance.width,
        height: instance.height,
        left: 0,
        top: 0,
        transform: `translate3d(${Math.round(safeX)}px, ${Math.round(safeY)}px, 0)`,
        borderColor: 'var(--widget-border-color, var(--border-wire))',
        borderRadius: 'var(--widget-border-radius, 12px)',
        borderWidth: 'var(--widget-border-width, 1px)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 var(--widget-glow-size, 15px) rgba(var(--widget-glow-color-rgb, var(--accent-green-rgb, 74, 246, 38)), var(--widget-glow-opacity, 0.15))',
      }}
      className="flex flex-col border overflow-hidden transition-[border-color,box-shadow,background-color] duration-200 bg-surface border-border-wire"
    >
      {/* Draggable Header (Only show if interactive) */}
      {isInteractive && (
        <div 
          onPointerDown={(e) => {
            e.stopPropagation();
            bringToFront(id);
            const startX = e.clientX;
            const startY = e.clientY;
            const initialWidgetX = instance.x;
            const initialWidgetY = instance.y;
            
            const onPointerMove = (moveEvent: PointerEvent) => {
              const winW = typeof window !== 'undefined' ? window.innerWidth : 1920;
              const winH = typeof window !== 'undefined' ? window.innerHeight : 1080;
              const maxW = Math.max(0, winW - instance.width);
              const maxH = Math.max(0, winH - instance.height);
              updateWidgetBounds(id, {
                x: Math.round(Math.max(0, Math.min(initialWidgetX + (moveEvent.clientX - startX), maxW))),
                y: Math.round(Math.max(0, Math.min(initialWidgetY + (moveEvent.clientY - startY), maxH)))
              });
            };
            
            const onPointerUp = () => {
              window.removeEventListener('pointermove', onPointerMove);
              window.removeEventListener('pointerup', onPointerUp);
            };
            
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
          }}
          className="flex items-center justify-between px-3 py-2 bg-zinc-900/80 border-b border-border-wire/50 cursor-move group shrink-0"
        >
          <div className="flex items-center gap-2 pointer-events-none">
            <GripHorizontal className="w-4 h-4 text-zinc-500 group-hover:text-primary transition-colors" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-primary uppercase">
              {widgetDef.label}
            </span>
          </div>
          
          <div className="flex items-center gap-1 pointer-events-auto">
            <button 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                togglePin(id);
              }}
              title={instance.isPinned ? "Unpin widget" : "Pin widget"}
              className={`p-1 rounded transition-colors ${
                instance.isPinned 
                  ? 'bg-primary/20 text-primary' 
                  : 'hover:bg-primary/10 text-zinc-400'
              }`}
            >
              {instance.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>
            <button 
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                toggleWidget(id);
              }}
              title="Close widget"
              className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-zinc-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Widget Content */}
      <div className="flex-1 relative overflow-hidden pointer-events-auto">
        {children}
      </div>

      {/* Resize Handle (Only show if interactive and unpinned to avoid accidental resizing when locked) */}
      {isInteractive && !instance.isPinned && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = instance.width;
            const startH = instance.height;
            
            const onPointerMove = (moveEvent: PointerEvent) => {
              const winW = typeof window !== 'undefined' ? window.innerWidth : 1920;
              const winH = typeof window !== 'undefined' ? window.innerHeight : 1080;
              const maxW = Math.max(200, winW - instance.x);
              const maxH = Math.max(150, winH - instance.y);
              updateWidgetBounds(id, {
                width: Math.round(Math.max(200, Math.min(startW + (moveEvent.clientX - startX), maxW))),
                height: Math.round(Math.max(150, Math.min(startH + (moveEvent.clientY - startY), maxH)))
              });
            };
            
            const onPointerUp = () => {
              window.removeEventListener('pointermove', onPointerMove);
              window.removeEventListener('pointerup', onPointerUp);
            };
            
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
          }}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50 flex items-end justify-end p-[2px]"
        >
          {/* Stylized dots for the resizer */}
          <div className="w-0 h-0 border-solid border-r-[8px] border-b-[8px] border-r-transparent border-b-accent-green opacity-50 hover:opacity-100 transition-opacity -rotate-90" />
        </div>
      )}
    </motion.div>
  );
}
