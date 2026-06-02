import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Zap, Palette, Save, Settings, Edit3 } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useShallow } from 'zustand/react/shallow';
import { invoke } from '@tauri-apps/api/core';
import { executeQuery, getDb } from '../utils/db';

export function SettingsModal() {
  const { isSettingsOpen, toggleSettings, openRouterModel, setOpenRouterModel, globalFontSize, setGlobalFontSize, interactablePins, setInteractablePins } = useSettingsStore(
    useShallow((state) => ({
      isSettingsOpen: state.isSettingsOpen,
      toggleSettings: state.toggleSettings,
      openRouterModel: state.openRouterModel,
      setOpenRouterModel: state.setOpenRouterModel,
      globalFontSize: state.globalFontSize,
      setGlobalFontSize: state.setGlobalFontSize,
      interactablePins: state.interactablePins,
      setInteractablePins: state.setInteractablePins,
    }))
  );

  const [activeTab, setActiveTab] = useState<'integrations' | 'preferences'>('integrations');
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-[#0F0F0F]/95 backdrop-blur-xl border border-border-wire rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[100] pointer-events-auto"
      >
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
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">API Key</label>
                    <input 
                      type="password"
                      value={openRouterKey}
                      onChange={(e) => setOpenRouterKey(e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Vision Model</label>
                    <select
                      value={openRouterModel}
                      onChange={(e) => setOpenRouterModel(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary transition-colors appearance-none"
                    >
                      <option value="openai/gpt-4o">GPT-4o (Recommended)</option>
                      <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
                      <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="deepseek/deepseek-chat-v3-0324">DeepSeek V3</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-2 mt-6">
                    <Edit3 size={16} className="text-blue-400" /> Notion Sync
                  </h3>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Integration Secret</label>
                    <input 
                      type="password"
                      value={notionKey}
                      onChange={(e) => setNotionKey(e.target.value)}
                      placeholder="secret_..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Database ID</label>
                    <input 
                      type="password"
                      value={notionDbId}
                      onChange={(e) => setNotionDbId(e.target.value)}
                      placeholder="..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary transition-colors"
                    />
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

                <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
                  <div>
                    <label className="text-sm font-semibold text-zinc-200">Interactable Pins</label>
                    <p className="text-xs text-zinc-500 mt-0.5">Keep pinned widgets interactable when overlay is closed.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={interactablePins}
                      onChange={(e) => setInteractablePins(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-green"></div>
                  </label>
                </div>
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
      </motion.div>
    </AnimatePresence>
  );
}
