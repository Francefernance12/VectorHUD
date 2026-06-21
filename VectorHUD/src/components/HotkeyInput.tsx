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

  const getModifiers = (e: React.KeyboardEvent) => {
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

    const isModifier = ['Control', 'Alt', 'Shift', 'Meta'].includes(e.key);
    const keys = getModifiers(e);

    if (isModifier) {
      const displayParts = keys.map(p => p.toUpperCase());
      if (displayParts.length > 0) {
        setCurrentCombo(displayParts.join(' + ') + ' + ');
      } else {
        setCurrentCombo('');
      }
      return;
    }

    const key = e.key.toLowerCase();
    let finalKey = key;
    if (finalKey === ' ') finalKey = 'space';
    
    keys.push(finalKey);
    const combo = keys.join('+');

    const isFKey = /^f\d+$/.test(finalKey);
    const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;

    if (hasModifier || isFKey) {
      onChange(combo);
      setIsRecording(false);
      setCurrentCombo('');
    } else {
      setErrorText('Keybind requires at least one modifier key (Ctrl, Alt, Shift, Win) or be an F-key.');
      setCurrentCombo('');
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isRecording) return;

    const keys = getModifiers(e);
    const displayParts = keys.map(p => p.toUpperCase());
    if (displayParts.length > 0) {
      setCurrentCombo(displayParts.join(' + ') + ' + ');
    } else {
      setCurrentCombo('');
    }
  };

  const displayVal = value
    ? value.split('+').map(part => part.toUpperCase()).join(' + ')
    : 'NONE';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</label>
        {isRecording && (
          <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-zinc-300 rounded font-mono font-medium animate-pulse">
            Current: {displayVal}
          </span>
        )}
      </div>
      <input 
        type="text"
        value={isRecording ? (currentCombo || 'Press keys... (Esc)') : displayVal}
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
