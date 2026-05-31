import { ReactNode } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X, GripHorizontal, Pin, PinOff } from 'lucide-react';
import { useWidgetStore, WIDGETS } from '../store/widgetStore';
import { useShellStore } from '../store/shellStore';

interface WidgetContainerProps {
  id: string;
  children: ReactNode;
}

export function WidgetContainer({ id, children }: WidgetContainerProps) {
  const controls = useDragControls();
  const { activeWidgets, toggleWidget, bringToFront, updateWidgetBounds, togglePin } = useWidgetStore();
  const isInteractive = useShellStore(state => state.isInteractive);
  
  const widgetDef = WIDGETS.find(w => w.id === id);
  const instance = activeWidgets[id];
  
  if (!widgetDef || !instance) return null;

  // Fix: Unpinned widgets do not persist when overlay is dismissed.
  if (!isInteractive && !instance.isPinned) return null;

  return (
    <motion.div
      drag
      dragControls={controls}
      dragListener={false}
      dragMomentum={false}
      onDragEnd={(_, info) => {
         updateWidgetBounds(id, {
             x: instance.x + info.offset.x,
             y: instance.y + info.offset.y
         });
      }}
      dragConstraints={{ 
        left: 0, 
        top: 0, 
        right: typeof window !== 'undefined' ? window.innerWidth - instance.width : 1000, 
        bottom: typeof window !== 'undefined' ? window.innerHeight - instance.height : 1000 
      }}
      onPointerDown={() => bringToFront(id)}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      style={{
        position: 'absolute',
        zIndex: instance.zIndex,
        width: instance.width,
        height: instance.height,
        x: instance.x,
        y: instance.y,
      }}
      className={`flex flex-col border rounded-xl overflow-hidden transition-colors ${
        instance.isPinned && !isInteractive 
          ? 'bg-transparent border-transparent shadow-none' // Seamless when pinned in ghost mode
          : 'bg-surface border-border-wire shadow-2xl'
      }`}
    >
      {/* Draggable Header (Only show if interactive) */}
      {isInteractive && (
        <div 
          onPointerDown={(e) => controls.start(e)}
          className="flex items-center justify-between px-3 py-2 bg-zinc-900/80 border-b border-border-wire/50 cursor-move group shrink-0"
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-zinc-500 group-hover:text-primary transition-colors" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-primary uppercase">
              {widgetDef.label}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
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
              updateWidgetBounds(id, {
                width: Math.max(200, startW + (moveEvent.clientX - startX)),
                height: Math.max(150, startH + (moveEvent.clientY - startY))
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
          <div className="w-0 h-0 border-solid border-r-[8px] border-b-[8px] border-r-transparent border-b-accent-green opacity-50 hover:opacity-100 transition-opacity" />
        </div>
      )}
    </motion.div>
  );
}
