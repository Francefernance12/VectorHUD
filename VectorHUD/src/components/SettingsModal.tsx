import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Zap, Palette, Save, Settings, Edit3, Download, RefreshCw, CheckCircle2 } from 'lucide-react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
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
    openaiModel,
    setOpenaiModel,
    anthropicModel,
    setAnthropicModel,
    groqModel,
    setGroqModel,
    customOpenRouterModel,
    setCustomOpenRouterModel,
    useCustomOpenRouterModel,
    setUseCustomOpenRouterModel,
    aiProvider,
    setAiProvider,
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
    replayResolution,
    setReplayResolution,
    replayFps,
    setReplayFps,
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
    setTimerResetHotkey,
    voicePttHotkey,
    setVoicePttHotkey,
    interactHotkey,
    setInteractHotkey,
    syncHotkeys
  } = useSettingsStore(
    useShallow((state) => ({
      isSettingsOpen: state.isSettingsOpen,
      toggleSettings: state.toggleSettings,
      openRouterModel: state.openRouterModel,
      setOpenRouterModel: state.setOpenRouterModel,
      openaiModel: state.openaiModel,
      setOpenaiModel: state.setOpenaiModel,
      anthropicModel: state.anthropicModel,
      setAnthropicModel: state.setAnthropicModel,
      groqModel: state.groqModel,
      setGroqModel: state.setGroqModel,
      customOpenRouterModel: state.customOpenRouterModel,
      setCustomOpenRouterModel: state.setCustomOpenRouterModel,
      useCustomOpenRouterModel: state.useCustomOpenRouterModel,
      setUseCustomOpenRouterModel: state.setUseCustomOpenRouterModel,
      aiProvider: state.aiProvider,
      setAiProvider: state.setAiProvider,
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
      replayResolution: state.replayResolution,
      setReplayResolution: state.setReplayResolution,
      replayFps: state.replayFps,
      setReplayFps: state.setReplayFps,
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
      voicePttHotkey: state.voicePttHotkey,
      setVoicePttHotkey: state.setVoicePttHotkey,
      interactHotkey: state.interactHotkey,
      setInteractHotkey: state.setInteractHotkey,
      syncHotkeys: state.syncHotkeys,
    }))
  );

  const [activeTab, setActiveTab] = useState<'integrations' | 'preferences' | 'hotkeys' | 'updates'>('integrations');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [notionKey, setNotionKey] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hotkeyError, setHotkeyError] = useState('');
  
  // Updater state
  const [currentVersion, setCurrentVersion] = useState<string>('0.0.0');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  // Initial states for dirty checking
  const [initialOpenRouterKey, setInitialOpenRouterKey] = useState('');
  const [initialOpenaiKey, setInitialOpenaiKey] = useState('');
  const [initialAnthropicKey, setInitialAnthropicKey] = useState('');
  const [initialGroqKey, setInitialGroqKey] = useState('');
  const [initialNotionKey, setInitialNotionKey] = useState('');
  const [initialNotionDbId, setInitialNotionDbId] = useState('');

  const [localHotkeys, setLocalHotkeys] = useState({
    overlay: overlayHotkey,
    screenshot: screenshotHotkey,
    record: recordHotkey,
    replay: replayHotkey,
    timer: timerHotkey,
    stopwatch: stopwatchHotkey,
    timerReset: timerResetHotkey,
    voicePtt: voicePttHotkey,
    interact: interactHotkey
  });

  const [localPreferences, setLocalPreferences] = useState({
    openRouterModel,
    openaiModel,
    anthropicModel,
    groqModel,
    customOpenRouterModel,
    useCustomOpenRouterModel,
    aiProvider,
    globalFontSize,
    theme,
    customColor,
    recordMicrophone,
    recordSystemAudio,
    replayResolution,
    replayFps
  });

  // Load credentials on mount
  useEffect(() => {
    if (!isSettingsOpen) return;
    
    setLocalHotkeys({
      overlay: overlayHotkey,
      screenshot: screenshotHotkey,
      record: recordHotkey,
      replay: replayHotkey,
      timer: timerHotkey,
      stopwatch: stopwatchHotkey,
      timerReset: timerResetHotkey,
      voicePtt: voicePttHotkey,
      interact: interactHotkey
    });

    setLocalPreferences({
      openRouterModel,
      openaiModel,
      anthropicModel,
      groqModel,
      customOpenRouterModel,
      useCustomOpenRouterModel,
      aiProvider,
      globalFontSize,
      theme,
      customColor,
      recordMicrophone,
      recordSystemAudio,
      replayResolution,
      replayFps
    });
    
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
          setInitialOpenRouterKey(decrypted);
        }

        // Load OpenAI
        const oaiResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'openai_key'"
        );
        if (oaiResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: oaiResult[0].encrypted_value });
          setOpenaiKey(decrypted);
          setInitialOpenaiKey(decrypted);
        }

        // Load Anthropic
        const antResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'anthropic_key'"
        );
        if (antResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: antResult[0].encrypted_value });
          setAnthropicKey(decrypted);
          setInitialAnthropicKey(decrypted);
        }

        // Load Groq
        const grqResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'groq_key'"
        );
        if (grqResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: grqResult[0].encrypted_value });
          setGroqKey(decrypted);
          setInitialGroqKey(decrypted);
        }

        // Load Notion Secret
        const notionResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'notion_secret'"
        );
        if (notionResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: notionResult[0].encrypted_value });
          setNotionKey(decrypted);
          setInitialNotionKey(decrypted);
        }

        // Load Notion DB ID
        const dbIdResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'notion_db_id'"
        );
        if (dbIdResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: dbIdResult[0].encrypted_value });
          setNotionDbId(decrypted);
          setInitialNotionDbId(decrypted);
        }
      } catch (e) {
        console.error("Failed to load credentials:", e);
      }
    }
    
    async function loadVersion() {
      try {
        const ver = await getVersion();
        setCurrentVersion(ver);
      } catch(e) {
        console.error("Failed to get version:", e);
      }
    }

    if (isSettingsOpen) {
      loadCredentials();
      loadVersion();
    }
  }, [isSettingsOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      // Encrypt and save OpenRouter key
      const encryptedOr = await invoke<string>('encrypt_data', { plaintext: openRouterKey });
      await executeQuery(
        "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('openrouter_key', ?)",
        [encryptedOr]
      );

      // Encrypt and save OpenAI key
      const encryptedOai = await invoke<string>('encrypt_data', { plaintext: openaiKey });
      await executeQuery(
        "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('openai_key', ?)",
        [encryptedOai]
      );

      // Encrypt and save Anthropic key
      const encryptedAnt = await invoke<string>('encrypt_data', { plaintext: anthropicKey });
      await executeQuery(
        "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('anthropic_key', ?)",
        [encryptedAnt]
      );

      // Encrypt and save Groq key
      const encryptedGrq = await invoke<string>('encrypt_data', { plaintext: groqKey });
      await executeQuery(
        "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('groq_key', ?)",
        [encryptedGrq]
      );

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

      // Save Preferences
      await setOpenRouterModel(localPreferences.openRouterModel);
      await setOpenaiModel(localPreferences.openaiModel);
      await setAnthropicModel(localPreferences.anthropicModel);
      await setGroqModel(localPreferences.groqModel);
      await setCustomOpenRouterModel(localPreferences.customOpenRouterModel);
      await setUseCustomOpenRouterModel(localPreferences.useCustomOpenRouterModel);
      await setAiProvider(localPreferences.aiProvider);
      await setGlobalFontSize(localPreferences.globalFontSize);
      await setTheme(localPreferences.theme);
      await setCustomColor(localPreferences.customColor);
      await setRecordMicrophone(localPreferences.recordMicrophone);
      await setRecordSystemAudio(localPreferences.recordSystemAudio);
      await setReplayResolution(localPreferences.replayResolution);
      await setReplayFps(localPreferences.replayFps);

      // Sync Hotkeys
      try {
        await setOverlayHotkey(localHotkeys.overlay);
        await setScreenshotHotkey(localHotkeys.screenshot);
        await setRecordHotkey(localHotkeys.record);
        await setReplayHotkey(localHotkeys.replay);
        await setTimerHotkey(localHotkeys.timer);
        await setStopwatchHotkey(localHotkeys.stopwatch);
        await setTimerResetHotkey(localHotkeys.timerReset);
        await setVoicePttHotkey(localHotkeys.voicePtt);
        await setInteractHotkey(localHotkeys.interact);

        await syncHotkeys();
        setSaveMessage('Saved successfully!');
        setHotkeyError('');
        
        // Update initial states to clear dirty flag
        setInitialOpenRouterKey(openRouterKey);
        setInitialOpenaiKey(openaiKey);
        setInitialAnthropicKey(anthropicKey);
        setInitialGroqKey(groqKey);
        setInitialNotionKey(notionKey);
        setInitialNotionDbId(notionDbId);
        
        setTimeout(() => setSaveMessage(''), 2000);
      } catch (hotkeyErr) {
        console.error("Hotkey sync failed:", hotkeyErr);
        setSaveMessage('Partial save.');
        setHotkeyError(String(hotkeyErr));
        setTimeout(() => setSaveMessage(''), 5000);
      }

    } catch (e) {
      console.error("Failed to save credentials:", e);
      setSaveMessage('Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const checkIsDirty = () => {
    return (
      openRouterKey !== initialOpenRouterKey ||
      openaiKey !== initialOpenaiKey ||
      anthropicKey !== initialAnthropicKey ||
      groqKey !== initialGroqKey ||
      notionKey !== initialNotionKey ||
      notionDbId !== initialNotionDbId ||
      localHotkeys.overlay !== overlayHotkey ||
      localHotkeys.screenshot !== screenshotHotkey ||
      localHotkeys.record !== recordHotkey ||
      localHotkeys.replay !== replayHotkey ||
      localHotkeys.timer !== timerHotkey ||
      localHotkeys.stopwatch !== stopwatchHotkey ||
      localHotkeys.timerReset !== timerResetHotkey ||
      localHotkeys.voicePtt !== voicePttHotkey ||
      localHotkeys.interact !== interactHotkey ||
      localPreferences.openRouterModel !== openRouterModel ||
      localPreferences.openaiModel !== openaiModel ||
      localPreferences.anthropicModel !== anthropicModel ||
      localPreferences.groqModel !== groqModel ||
      localPreferences.customOpenRouterModel !== customOpenRouterModel ||
      localPreferences.useCustomOpenRouterModel !== useCustomOpenRouterModel ||
      localPreferences.aiProvider !== aiProvider ||
      String(localPreferences.globalFontSize) !== String(globalFontSize) ||
      localPreferences.theme !== theme ||
      localPreferences.customColor !== customColor ||
      localPreferences.recordMicrophone !== recordMicrophone ||
      localPreferences.recordSystemAudio !== recordSystemAudio ||
      localPreferences.replayResolution !== replayResolution ||
      localPreferences.replayFps !== replayFps
    );
  };

  const handleClose = () => {
    if (checkIsDirty()) {
      setShowConfirmClose(true);
      return;
    }
    
    // No changes, just close
    toggleSettings();
  };

  const handleConfirmDiscard = () => {
    // Reset to initial states to discard changes
    setOpenRouterKey(initialOpenRouterKey);
    setOpenaiKey(initialOpenaiKey);
    setAnthropicKey(initialAnthropicKey);
    setGroqKey(initialGroqKey);
    setNotionKey(initialNotionKey);
    setNotionDbId(initialNotionDbId);
    setLocalHotkeys({
      overlay: overlayHotkey,
      screenshot: screenshotHotkey,
      record: recordHotkey,
      replay: replayHotkey,
      timer: timerHotkey,
      stopwatch: stopwatchHotkey,
      timerReset: timerResetHotkey,
      voicePtt: voicePttHotkey,
      interact: interactHotkey
    });
    setLocalPreferences({
      openRouterModel,
      openaiModel,
      anthropicModel,
      groqModel,
      customOpenRouterModel,
      useCustomOpenRouterModel,
      aiProvider,
      globalFontSize,
      theme,
      customColor,
      recordMicrophone,
      recordSystemAudio,
      replayResolution,
      replayFps
    });
    
    setShowConfirmClose(false);
    toggleSettings();
  };

  // Allow clicking background to close modal
  const handleBackgroundClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) {
      handleClose();
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
        className={`absolute inset-0 flex items-center justify-center z-[100] bg-surface/50 pointer-events-auto`}
        onClick={handleBackgroundClick}
      >
        <div className="w-[600px] h-[500px] bg-[#0F0F0F]/95 backdrop-blur-xl border border-border-wire rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-wire/50 bg-black/20">
          <h2 className="text-lg font-bold text-white tracking-widest uppercase flex items-center gap-2">
            <Settings size={20} className="text-primary" /> System Settings
          </h2>
          <button onClick={handleClose} className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
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
            <div className="flex-1"></div>
            <button
              onClick={() => setActiveTab('updates')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors mt-auto ${
                activeTab === 'updates' ? 'bg-primary/20 text-primary' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              <Download size={16} /> About / Updates
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                    <Zap size={16} className="text-amber-400" /> AI Provider Configuration
                  </h3>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active Provider</label>
                    <select
                      value={localPreferences.aiProvider}
                      onChange={(e) => setLocalPreferences(s => ({ ...s, aiProvider: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-primary transition-colors appearance-none"
                    >
                      <option value="openrouter">OpenRouter AI (Default)</option>
                      <option value="openai">OpenAI (Direct API)</option>
                      <option value="anthropic">Anthropic (Direct API)</option>
                      <option value="groq">Groq (Direct API)</option>
                    </select>
                  </div>

                  {/* OpenRouter Configuration */}
                  {localPreferences.aiProvider === 'openrouter' && (
                    <div className="space-y-4 pt-2 animate-fadeIn">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">OpenRouter API Key</label>
                        <input 
                          type="password"
                          value={openRouterKey}
                          onChange={(e) => setOpenRouterKey(e.target.value)}
                          placeholder="sk-or-v1-..."
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-base text-zinc-200 focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      <div className="flex items-center gap-2 bg-black/20 p-2 rounded border border-white/5">
                        <input
                          type="checkbox"
                          id="useCustomOpenRouterModel"
                          checked={localPreferences.useCustomOpenRouterModel}
                          onChange={(e) => setLocalPreferences(s => ({ ...s, useCustomOpenRouterModel: e.target.checked }))}
                          className="rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-primary"
                        />
                        <label htmlFor="useCustomOpenRouterModel" className="text-xs text-zinc-300 cursor-pointer select-none">
                          Use Custom Model ID (override dropdown)
                        </label>
                      </div>

                      {localPreferences.useCustomOpenRouterModel ? (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Custom Model ID</label>
                          <input 
                            type="text"
                            value={localPreferences.customOpenRouterModel}
                            onChange={(e) => setLocalPreferences(s => ({ ...s, customOpenRouterModel: e.target.value }))}
                            placeholder="e.g. google/gemini-2.5-flash"
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary transition-colors font-mono"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">OpenRouter Model</label>
                          <select
                            value={localPreferences.openRouterModel}
                            onChange={(e) => setLocalPreferences(s => ({ ...s, openRouterModel: e.target.value }))}
                            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-primary transition-colors appearance-none"
                          >
                            <option value="google/gemini-2.5-flash">Gemini 2.5 Flash [Vision/Actions] (Recommended)</option>
                            <option value="google/gemini-2.5-pro">Gemini 2.5 Pro [Vision/Actions]</option>
                            <option value="openai/gpt-4o-mini">GPT-4o Mini [Vision/Actions]</option>
                            <option value="openai/gpt-4o">GPT-4o [Vision/Actions]</option>
                            <option value="anthropic/claude-sonnet-4.6">Claude 3.5 Sonnet v2 [Vision/Actions]</option>
                            <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B Instruct [Text-Only/Actions] (Free)</option>
                            <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B Instruct [Text-Only/Actions]</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* OpenAI Configuration */}
                  {localPreferences.aiProvider === 'openai' && (
                    <div className="space-y-4 pt-2 animate-fadeIn">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">OpenAI API Key</label>
                        <input 
                          type="password"
                          value={openaiKey}
                          onChange={(e) => setOpenaiKey(e.target.value)}
                          placeholder="sk-..."
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-base text-zinc-200 focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">OpenAI Model</label>
                        <select
                          value={localPreferences.openaiModel}
                          onChange={(e) => setLocalPreferences(s => ({ ...s, openaiModel: e.target.value }))}
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-primary transition-colors appearance-none font-mono"
                        >
                          <option value="gpt-4o-mini">gpt-4o-mini [Vision/Actions] (Recommended)</option>
                          <option value="gpt-4o">gpt-4o [Vision/Actions]</option>
                          <option value="gpt-4-turbo">gpt-4-turbo [Vision/Actions]</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Anthropic Configuration */}
                  {localPreferences.aiProvider === 'anthropic' && (
                    <div className="space-y-4 pt-2 animate-fadeIn">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Anthropic API Key</label>
                        <input 
                          type="password"
                          value={anthropicKey}
                          onChange={(e) => setAnthropicKey(e.target.value)}
                          placeholder="sk-ant-..."
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-base text-zinc-200 focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Anthropic Model</label>
                        <select
                          value={localPreferences.anthropicModel}
                          onChange={(e) => setLocalPreferences(s => ({ ...s, anthropicModel: e.target.value }))}
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-primary transition-colors appearance-none font-mono"
                        >
                          <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022 [Vision/Actions] (Recommended)</option>
                          <option value="claude-3-5-haiku-20241022">claude-3-5-haiku-20241022 [Text-Only/Actions]</option>
                          <option value="claude-3-opus-20240229">claude-3-opus-20240229 [Vision/Actions]</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Groq Configuration */}
                  {localPreferences.aiProvider === 'groq' && (
                    <div className="space-y-4 pt-2 animate-fadeIn">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Groq API Key</label>
                        <input 
                          type="password"
                          value={groqKey}
                          onChange={(e) => setGroqKey(e.target.value)}
                          placeholder="gsk_..."
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-base text-zinc-200 focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Groq Model</label>
                        <select
                          value={localPreferences.groqModel}
                          onChange={(e) => setLocalPreferences(s => ({ ...s, groqModel: e.target.value }))}
                          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-primary transition-colors appearance-none font-mono"
                        >
                          <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile [Text-Only/Actions] (Recommended)</option>
                          <option value="llama-3.1-8b-instant">llama-3.1-8b-instant [Text-Only/Actions]</option>
                          <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 [Text-Only/Actions]</option>
                          <option value="gemma2-9b-it">gemma2-9b-it [Text-Only/Actions]</option>
                        </select>
                      </div>
                    </div>
                  )}
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
                    <span className="text-xs text-primary font-mono">{localPreferences.globalFontSize}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="24" 
                    step="1"
                    value={localPreferences.globalFontSize}
                    onChange={(e) => setLocalPreferences(s => ({ ...s, globalFontSize: parseInt(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">HUD Theme</label>
                  <select
                    value={localPreferences.theme}
                    onChange={(e) => setLocalPreferences(s => ({ ...s, theme: e.target.value }))}
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

                {localPreferences.theme === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Custom Hex Color</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="color" 
                        value={localPreferences.customColor}
                        onChange={(e) => setLocalPreferences(s => ({ ...s, customColor: e.target.value }))}
                        className="w-10 h-10 rounded bg-transparent border-none cursor-pointer"
                      />
                      <input 
                        type="text" 
                        value={localPreferences.customColor}
                        onChange={(e) => setLocalPreferences(s => ({ ...s, customColor: e.target.value }))}
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <h3 className="text-md font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-2 mt-6">
                  <Palette size={16} className="text-purple-400" /> Video Recording
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
                      checked={localPreferences.recordSystemAudio}
                      onChange={(e) => setLocalPreferences(s => ({ ...s, recordSystemAudio: e.target.checked }))}
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
                      checked={localPreferences.recordMicrophone}
                      onChange={(e) => setLocalPreferences(s => ({ ...s, recordMicrophone: e.target.checked }))}
                    />
                    <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-green"></div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'hotkeys' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-md font-semibold text-white border-b border-white/10 pb-2 flex items-center gap-2">
                    <Zap size={16} className="text-amber-400" /> Global Hotkeys
                  </h3>
                  <p className="text-xs text-zinc-400 mb-4">
                    Set system-wide hotkeys. Use combinations like <code>CommandOrControl+Shift+X</code>.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Main Overlay Toggle</label>
                    <input 
                      type="text"
                      value={localHotkeys.overlay}
                      onChange={(e) => setLocalHotkeys(s => ({ ...s, overlay: e.target.value }))}
                      placeholder="ctrl+alt+o"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Capture Screenshot</label>
                    <input 
                      type="text"
                      value={localHotkeys.screenshot}
                      onChange={(e) => setLocalHotkeys(s => ({ ...s, screenshot: e.target.value }))}
                      placeholder="ctrl+alt+s"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Toggle Recording</label>
                    <input 
                      type="text"
                      value={localHotkeys.record}
                      onChange={(e) => setLocalHotkeys(s => ({ ...s, record: e.target.value }))}
                      placeholder="ctrl+alt+r"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Save Replay Buffer</label>
                    <input 
                      type="text"
                      value={localHotkeys.replay}
                      onChange={(e) => setLocalHotkeys(s => ({ ...s, replay: e.target.value }))}
                      placeholder="ctrl+alt+b"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Toggle Timer</label>
                    <input 
                      type="text"
                      value={localHotkeys.timer}
                      onChange={(e) => setLocalHotkeys(s => ({ ...s, timer: e.target.value }))}
                      placeholder="ctrl+alt+t"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Reset Timers</label>
                    <input 
                      type="text"
                      value={localHotkeys.timerReset}
                      onChange={(e) => setLocalHotkeys(s => ({ ...s, timerReset: e.target.value }))}
                      placeholder="ctrl+alt+y"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Toggle Stopwatch</label>
                    <input 
                      type="text"
                      value={localHotkeys.stopwatch}
                      onChange={(e) => setLocalHotkeys(s => ({ ...s, stopwatch: e.target.value }))}
                      placeholder="ctrl+alt+w"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Voice PTT Assistant</label>
                    <input 
                      type="text"
                      value={localHotkeys.voicePtt}
                      onChange={(e) => setLocalHotkeys(s => ({ ...s, voicePtt: e.target.value }))}
                      placeholder="ctrl+alt+v"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Toggle Interactivity</label>
                    <input 
                      type="text"
                      value={localHotkeys.interact}
                      onChange={(e) => setLocalHotkeys(s => ({ ...s, interact: e.target.value }))}
                      placeholder="ctrl+alt+i"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-primary transition-colors uppercase"
                    />
                  </div>
                </div>
                <p className="text-xs text-zinc-500 italic mt-4">
                  Note: Updating hotkeys requires an application restart to take effect. Supported modifiers: ctrl, alt, shift, super.
                </p>
              </div>
            )}

            {activeTab === 'updates' && (
              <div className="space-y-6 flex flex-col h-full">
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-16 h-16 bg-gradient-to-tr from-primary to-blue-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                    <span className="text-3xl font-black text-white italic">V</span>
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-wide">VectorHUD</h3>
                  <p className="text-sm text-zinc-400 mt-1">Version {currentVersion}</p>
                </div>

                <div className="bg-black/20 border border-white/5 rounded-xl p-5 flex flex-col items-center justify-center gap-4 text-center">
                  {updateInfo ? (
                    <>
                      <div className="flex items-center gap-3 text-green-400 font-semibold">
                        <Download size={20} />
                        New Update Available!
                      </div>
                      <p className="text-zinc-300 text-sm">
                        Version <strong className="text-white">{updateInfo.version}</strong> is ready to download.
                      </p>
                      
                      <button
                        onClick={async () => {
                          try {
                            setIsDownloadingUpdate(true);
                            setUpdateMessage('Downloading and installing...');
                            await updateInfo.downloadAndInstall();
                            setUpdateMessage('Restarting app...');
                            await relaunch();
                          } catch (err: any) {
                            console.error(err);
                            setUpdateMessage(`Update failed: ${err?.message || err}`);
                            setIsDownloadingUpdate(false);
                          }
                        }}
                        disabled={isDownloadingUpdate}
                        className="px-6 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2 mt-2"
                      >
                        {isDownloadingUpdate ? (
                          <><RefreshCw size={16} className="animate-spin" /> Installing...</>
                        ) : (
                          <><Download size={16} /> Download & Install</>
                        )}
                      </button>
                      {updateMessage && <p className="text-xs text-zinc-400 mt-2">{updateMessage}</p>}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center w-12 h-12 bg-white/5 rounded-full mb-2">
                        <CheckCircle2 size={24} className="text-zinc-400" />
                      </div>
                      <p className="text-zinc-300 font-medium">You're up to date.</p>
                      <p className="text-xs text-zinc-500">VectorHUD checks for updates automatically.</p>
                      
                      <button
                        onClick={async () => {
                          try {
                            setIsCheckingUpdate(true);
                            setUpdateMessage('Checking...');
                            const update = await check();
                            if (update?.available) {
                              setUpdateInfo(update);
                              setUpdateMessage('');
                            } else {
                              setUpdateMessage('You are on the latest version.');
                              setTimeout(() => setUpdateMessage(''), 3000);
                            }
                          } catch (error: any) {
                            console.error(`Update check failed: ${error}`);
                            setUpdateMessage(`Error: ${error?.message || error}`);
                          } finally {
                            setIsCheckingUpdate(false);
                          }
                        }}
                        disabled={isCheckingUpdate}
                        className="mt-2 px-5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <RefreshCw size={14} className={isCheckingUpdate ? 'animate-spin' : ''} />
                        {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                      </button>
                      {updateMessage && <p className="text-xs text-zinc-400 mt-2">{updateMessage}</p>}
                    </>
                  )}
                </div>

                <div className="mt-auto pt-4 flex justify-between items-center text-xs text-zinc-500 border-t border-white/5">
                  <p>Built with ❤️ by Fernando</p>
                  <button onClick={() => openUrl("https://github.com/Francefernance12/VectorHUD")} className="hover:text-white transition-colors cursor-pointer">View on GitHub</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-wire/50 bg-black/20 flex flex-col gap-2">
          {hotkeyError && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-md p-3 mb-2">
              <span className="text-xs font-mono text-red-400 whitespace-pre-wrap">
                {hotkeyError}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
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
        </div>
      </motion.div>

      {/* Unsaved Changes Confirm Dialog */}
      <AnimatePresence>
        {showConfirmClose && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 flex items-center justify-center z-[200] bg-black/60 pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); setShowConfirmClose(false); }}
          >
            <div 
              className="bg-zinc-900 border border-border-wire rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-2">Unsaved Changes</h3>
              <p className="text-zinc-400 text-sm mb-6">
                You have unsaved changes. Are you sure you want to discard them?
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowConfirmClose(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmDiscard}
                  className="px-4 py-2 text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-lg transition-colors"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
