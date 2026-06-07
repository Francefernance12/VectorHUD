import React, { useState } from 'react';

interface HotkeyInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function HotkeyInput({ label, value, onChange }: HotkeyInputProps) {
  const [isRecording, setIsRecording] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isRecording) return;

    if (e.key === 'Escape') {
      setIsRecording(false);
      return;
    }

    const keys = [];
    if (e.ctrlKey) keys.push('ctrl');
    if (e.altKey) keys.push('alt');
    if (e.shiftKey) keys.push('shift');
    if (e.metaKey) keys.push('super');

    const key = e.key.toLowerCase();
    // Ignore just modifier key presses
    if (['control', 'alt', 'shift', 'meta'].includes(key)) {
      return;
    }

    // Replace some names
    let finalKey = key;
    if (finalKey === ' ') finalKey = 'space';
    
    keys.push(finalKey);
    const hotkeyString = keys.join('+');
    
    onChange(hotkeyString);
    setIsRecording(false);
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</label>
      <input 
        type="text"
        value={isRecording ? 'Listening... (Press Esc to cancel)' : value}
        onFocus={() => setIsRecording(true)}
        onBlur={() => setIsRecording(false)}
        onKeyDown={handleKeyDown}
        readOnly
        placeholder="Click to record hotkey"
        className={`w-full bg-black/40 border rounded-lg px-4 py-2 text-sm font-mono focus:outline-none transition-colors uppercase cursor-pointer ${
          isRecording ? 'border-amber-400 text-amber-400' : 'border-white/10 text-zinc-200 hover:border-white/20'
        }`}
      />
    </div>
  );
}
