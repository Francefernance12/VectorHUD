import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Zap, Palette, Save, Settings, Edit3 } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useShallow } from 'zustand/react/shallow';
import { invoke } from '@tauri-apps/api/core';
import { executeQuery, getDb } from '../utils/db';

export function SettingsModal() {
  const { 
    isSettingsOpen, 
    toggleSettings, 
    openRouterModel, 
    setOpenRouterModel, 
    globalFontSize, 
    setGlobalFontSize, 
    theme,
    setTheme,
    customColor,
    setCustomColor,
    recordMicrophone,
    setRecordMicrophone,
    recordSystemAudio,
    setRecordSystemAudio,
    overlayHotkey,
    setOverlayHotkey,
    screenshotHotkey,
    setScreenshotHotkey,
    recordHotkey,
    setRecordHotkey,
    replayHotkey,
    setReplayHotkey,
    timerHotkey,
    setTimerHotkey,
    stopwatchHotkey,
    setStopwatchHotkey,
    timerResetHotkey,
    setTimerResetHotkey
  } = useSettingsStore(
    useShallow((state) => ({
      isSettingsOpen: state.isSettingsOpen,
      toggleSettings: state.toggleSettings,
      openRouterModel: state.openRouterModel,
      setOpenRouterModel: state.setOpenRouterModel,
      globalFontSize: state.globalFontSize,
      setGlobalFontSize: state.setGlobalFontSize,
      theme: state.theme,
      setTheme: state.setTheme,
      customColor: state.customColor,
      setCustomColor: state.setCustomColor,
      recordMicrophone: state.recordMicrophone,
      setRecordMicrophone: state.setRecordMicrophone,
      recordSystemAudio: state.recordSystemAudio,
      setRecordSystemAudio: state.setRecordSystemAudio,
      overlayHotkey: state.overlayHotkey,
      setOverlayHotkey: state.setOverlayHotkey,
      screenshotHotkey: state.screenshotHotkey,
      setScreenshotHotkey: state.setScreenshotHotkey,
      recordHotkey: state.recordHotkey,
      setRecordHotkey: state.setRecordHotkey,
      replayHotkey: state.replayHotkey,
      setReplayHotkey: state.setReplayHotkey,
      timerHotkey: state.timerHotkey,
      setTimerHotkey: state.setTimerHotkey,
      stopwatchHotkey: state.stopwatchHotkey,
      setStopwatchHotkey: state.setStopwatchHotkey,
      timerResetHotkey: state.timerResetHotkey,
      setTimerResetHotkey: state.setTimerResetHotkey,
    }))
  );

  const [activeTab, setActiveTab] = useState<'integrations' | 'preferences' | 'hotkeys'>('integrations');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [notionKey, setNotionKey] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Load credentials on mount
  useEffect(() => {
    if (!isSettingsOpen) return;
    
    async function loadCredentials() {
      try {
        const db = await getDb();
        
        // Load OpenRouter
        const orResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'openrouter_key'"
        );
        if (orResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: orResult[0].encrypted_value });
          setOpenRouterKey(decrypted);
        }

        // Load Notion Secret
        const notionResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'notion_secret'"
        );
        if (notionResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: notionResult[0].encrypted_value });
          setNotionKey(decrypted);
        }

        // Load Notion DB ID
        const dbIdResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'notion_db_id'"
        );
        if (dbIdResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: dbIdResult[0].encrypted_value });
          setNotionDbId(decrypted);
        }
      } catch (e) {
        console.error("Failed to load credentials:", e);
      }
    }
    loadCredentials();
  }, [isSettingsOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      // Encrypt and save OpenRouter key
      if (openRouterKey) {
        const encryptedOr = await invoke<string>('encrypt_data', { plaintext: openRouterKey });
        await executeQuery(
          "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('openrouter_key', ?)",
          [encryptedOr]
        );
      }

      // Encrypt and save Notion secret
      if (notionKey) {
        const encryptedNotion = await invoke<string>('encrypt_data', { plaintext: notionKey });
        await executeQuery(
          "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('notion_secret', ?)",
          [encryptedNotion]
        );
      }

      // Encrypt and save Notion DB ID
      if (notionDbId) {
        const encryptedDbId = await invoke<string>('encrypt_data', { plaintext: notionDbId });
        await executeQuery(
          "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('notion_db_id', ?)",
          [encryptedDbId]
        );
      }

      setSaveMessage('Saved successfully!');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (e) {
      console.error("Failed to save credentials:", e);
      setSaveMessage('Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`absolute inset-0 flex items-center justify-center z-[100] pointer-events-none bg-surface/50`}
      >
        <div className="w-[600px] h-[500px] bg-[#0F0F0F]/95 backdrop-blur-xl border border-border-wire rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-wire/50 bg-black/20">
          <h2 className="text-lg font-bold text-white tracking-widest uppercase flex items-center gap-2">
            <Settings size={20} className="text-primary" /> System Settings
          </h2>
          <button onClick={toggleSettings} className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-border-wire/50 p-2 flex flex-col gap-1 bg-black/10">
            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'integrations' ? 'bg-primary/20 text-primary' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              <Key size={16} /> Integrations
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'preferences' ? 'bg-primary/20 text-primary' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              <Palette size={16} /> Preferences
            </button>
            <button
              onClick={() => setActiveTab('hotkeys')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'hotkeys' ? 'bg-primary/20 text-primary' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              <Zap size={16} /> Hotkeys
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                    <Zap size={16} className="text-amber-400" /> OpenRouter AI
                  </h3>
                  
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">API Key</label>
                    <input 
                      type="password"
                      value={openRouterKey}
                      onChange={(e) => setOpenRouterKey(e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-base text-zinc-200 focus:outline-none focus:border-primary transition-colors"
                    />
                    <div className="bg-zinc-800/40 p-3 rounded-md mt-2 border border-white/5">
                      <p className="text-xs text-zinc-400">
                        VectorHUD uses OpenRouter to provide access to top AI models (like GPT-4o and Claude).
                        <br/><br/>
                        1. Create an account at <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">openrouter.ai</a>.
                        <br/>
                        2. Generate a new API key and paste it above.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Vision Model</label>
                    <select
                      value={openRouterModel}
                      onChange={(e) => setOpenRouterModel(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-primary transition-colors appearance-none"
                    >
                      <option value="openai/gpt-4o">GPT-4o [Vision] (Recommended)</option>
                      <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet [Vision]</option>
                      <option value="google/gemini-2.5-flash">Gemini 2.5 Flash [Vision] (Free)</option>
                      <option value="google/gemini-2.0-flash-lite-preview-02-05:free">Gemini 2.0 Flash Lite [Vision] (Free)</option>
                      <option value="deepseek/deepseek-chat">DeepSeek V3 (Text Only)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-2 mt-6">
                    <Edit3 size={16} className="text-blue-400" /> Notion Sync
                  </h3>
                  
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Integration Secret</label>
                    <input 
                      type="password"
                      value={notionKey}
                      onChange={(e) => setNotionKey(e.target.value)}
                      placeholder="secret_..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-base text-zinc-200 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  
                  <div className="space-y-1 mt-4">
                    <label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Database ID or Shared Link</label>
                    <input 
                      type="text"
                      value={notionDbId}
                      onChange={(e) => {
                        let val = e.target.value;
                        const match = val.match(/([a-f0-9]{32})/i);
                        if (match) val = match[1];
                        setNotionDbId(val);
                      }}
                      placeholder="e.g., 68482d8c90384a8..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-base text-zinc-200 focus:outline-none focus:border-primary transition-colors"
                    />
                    
                    <div className="bg-zinc-800/40 p-3 rounded-md mt-2 border border-white/5 space-y-2">
                      <p className="text-xs text-zinc-400 font-bold">How to connect an empty Notion Database:</p>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        1. Go to <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Notion Integrations</a> and create a new integration to get your <b>Internal Integration Secret</b>.
                        <br/>
                        2. Create a new empty page in Notion and type <code>/database</code> to add a full-page database.
                        <br/>
                        3. Click the <code>...</code> menu in the top right of your database page, go to <b>Connections</b>, and add the integration you just created.
                        <br/>
                        4. Click <b>Share</b>, select "Copy Link", and paste the entire link directly into the box above. VectorHUD will automatically extract the 32-character Database ID.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <h3 className="text-md font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                  <Palette size={16} className="text-purple-400" /> UI Customization
                </h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Global Font Size</label>
                    <span className="text-xs text-primary font-mono">{globalFontSize}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="24" 
                    step="1"
                    value={globalFontSize}
                    onChange={(e) => setGlobalFontSize(parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">HUD Theme</label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-primary transition-colors appearance-none"
                  >
                    <option value="default">Default</option>
                    <option value="amber">Cyberpunk Amber</option>
                    <option value="neon_blue">Neon Blue</option>
                    <option value="matrix_green">Matrix Green</option>
                    <option value="outrun_pink">Outrun Pink</option>
                    <option value="custom">Custom Color (RGB)</option>
                  </select>
                </div>

                {theme === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Custom Hex Color</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="color" 
                        defaultValue={customColor}
                        onBlur={(e) => setCustomColor(e.target.value)}
                        className="w-10 h-10 rounded bg-transparent border-none cursor-pointer"
                      />
                      <input 
                        type="text" 
                        defaultValue={customColor}
                        onBlur={(e) => setCustomColor(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <h3 className="text-md font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-2 mt-6">
                  <Palette size={16} className="text-purple-400" /> Video & Replay Recording
                </h3>

                <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
                  <div>
                    <label className="text-sm font-semibold text-zinc-200">Record System Audio</label>
                    <p className="text-xs text-zinc-500 mt-0.5">Include game and desktop sound output in recordings.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={recordSystemAudio}
                      onChange={(e) => setRecordSystemAudio(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-green"></div>
                  </label>
                </div>

                <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
                  <div>
                    <label className="text-sm font-semibold text-zinc-200">Record Microphone</label>
                    <p className="text-xs text-zinc-500 mt-0.5">Include voice input from default microphone.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={recordMicrophone}
                      onChange={(e) => setRecordMicrophone(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-green"></div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'hotkeys' && (
              <div className="space-y-6">
                <h3 className="text-md font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                  <Zap size={16} className="text-amber-400" /> Global Hotkeys
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Main Overlay Toggle</label>
                    <input 
                      type="text"
                      value={overlayHotkey}
                      onChange={(e) => setOverlayHotkey(e.target.value)}
                      placeholder="ctrl+alt+o"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Capture Screenshot</label>
                    <input 
                      type="text"
                      value={screenshotHotkey}
                      onChange={(e) => setScreenshotHotkey(e.target.value)}
                      placeholder="ctrl+alt+s"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Toggle Recording</label>
                    <input 
                      type="text"
                      value={recordHotkey}
                      onChange={(e) => setRecordHotkey(e.target.value)}
                      placeholder="ctrl+alt+r"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-2 tracking-wider">Save Replay Buffer</label>
                    <input 
                      type="text"
                      value={replayHotkey}
                      onChange={(e) => setReplayHotkey(e.target.value)}
                      placeholder="ctrl+alt+b"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-2 tracking-wider">Toggle Timer</label>
                    <input 
                      type="text"
                      value={timerHotkey}
                      onChange={(e) => setTimerHotkey(e.target.value)}
                      placeholder="ctrl+alt+t"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-2 tracking-wider">Toggle Stopwatch</label>
                    <input 
                      type="text"
                      value={stopwatchHotkey}
                      onChange={(e) => setStopwatchHotkey(e.target.value)}
                      placeholder="ctrl+alt+w"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-2 tracking-wider">Reset Timers</label>
                    <input 
                      type="text"
                      value={timerResetHotkey}
                      onChange={(e) => setTimerResetHotkey(e.target.value)}
                      placeholder="ctrl+alt+y"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>
                </div>
                <p className="text-xs text-zinc-500 italic mt-4">
                  Note: Updating hotkeys requires an application restart to take effect. Supported modifiers: ctrl, alt, shift, super.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-wire/50 bg-black/20 flex justify-between items-center">
          <span className="text-xs font-mono text-emerald-400">
            {saveMessage}
          </span>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-black font-bold px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : (
              <>
                <Save size={16} /> Apply Settings
              </>
            )}
          </button>
        </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
