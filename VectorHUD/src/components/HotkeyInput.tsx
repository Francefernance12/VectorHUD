import React, { useState } from 'react';

interface HotkeyInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function HotkeyInput({ label, value, onChange }: HotkeyInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentCombo, setCurrentCombo] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');

  const getModifiers = (e: React.KeyboardEvent | React.MouseEvent) => {
    const keys = [];
    if (e.ctrlKey) keys.push('ctrl');
    if (e.altKey) keys.push('alt');
    if (e.shiftKey) keys.push('shift');
    if (e.metaKey) keys.push('super');
    return keys;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isRecording) return;
    setErrorText('');

    if (e.key === 'Escape') {
      setIsRecording(false);
      setCurrentCombo('');
      return;
    }

    const keys = getModifiers(e);
    const key = e.key.toLowerCase();
    
    // Ignore just modifier key presses
    if (['control', 'alt', 'shift', 'meta'].includes(key)) {
      setCurrentCombo(keys.join('+') + (keys.length > 0 ? '+' : '') + '...');
      return;
    }

    let finalKey = key;
    if (finalKey === ' ') finalKey = 'space';
    
    keys.push(finalKey);
    setCurrentCombo(keys.join('+'));
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isRecording || !currentCombo || currentCombo.endsWith('...')) return;

    const key = e.key.toLowerCase();
    if (['control', 'alt', 'shift', 'meta'].includes(key)) {
      return;
    }

    const keys = currentCombo.split('+');
    const hasModifier = keys.some(k => ['ctrl', 'alt', 'shift', 'super'].includes(k));
    
    if (!hasModifier) {
      setErrorText('Hotkeys must include a modifier key (Ctrl, Alt, Shift).');
      setCurrentCombo('');
      return;
    }

    onChange(currentCombo);
    setIsRecording(false);
    setCurrentCombo('');
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</label>
      <input 
        type="text"
        value={isRecording ? (currentCombo || 'Listening... (Press Esc to cancel)') : value}
        onFocus={() => { setIsRecording(true); setCurrentCombo(''); setErrorText(''); }}
        onBlur={() => { setIsRecording(false); setCurrentCombo(''); setErrorText(''); }}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        readOnly
        placeholder="Click to record hotkey"
        className={`w-full bg-black/40 border rounded-lg px-4 py-2 text-sm font-mono focus:outline-none transition-colors uppercase cursor-pointer ${
          isRecording ? 'border-amber-400 text-amber-400' : 'border-white/10 text-zinc-200 hover:border-white/20'
        } ${errorText ? 'border-red-500 text-red-400' : ''}`}
      />
      {errorText && (
        <div className="text-[10px] text-red-400 mt-1">
          {errorText}
        </div>
      )}
    </div>
  );
}
