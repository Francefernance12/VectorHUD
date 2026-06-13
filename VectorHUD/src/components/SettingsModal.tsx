import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Key, Zap, Palette, Save, Settings, Edit3, Download, RefreshCw, 
  CheckCircle2, Search, Terminal, Sliders, Volume2, Cpu, Monitor, 
  Trash2, RotateCcw, HelpCircle, Shield, AlertTriangle, VolumeX, Mic
} from 'lucide-react';
import { getSettingsStore } from '../utils/store';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useSettingsStore } from '../store/settingsStore';
import { useShallow } from 'zustand/react/shallow';
import { invoke } from '@tauri-apps/api/core';
import { getDb } from '../utils/db';

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
    metricsPollInterval,
    setMetricsPollInterval,
    gpuTempAlertThreshold,
    setGpuTempAlertThreshold,
    cpuTempAlertThreshold,
    setCpuTempAlertThreshold,
    replayDuration,
    setReplayDuration,
    excludeHudFromCapture,
    setExcludeHudFromCapture,
    favoriteMixerApps,
    setFavoriteMixerApps,
    volumeStep,
    setVolumeStep,
    pttBrevityLimit,
    setPttBrevityLimit,
    systemPromptOverride,
    setSystemPromptOverride,
    backgroundBlur,
    setBackgroundBlur,
    backdropOpacity,
    setBackdropOpacity,
    launchOnStartup,
    setLaunchOnStartup,
    widgetBorderRadius,
    setWidgetBorderRadius,
    widgetBorderWidth,
    setWidgetBorderWidth,
    widgetBorderOpacity,
    setWidgetBorderOpacity,
    widgetGlowSize,
    setWidgetGlowSize,
    widgetGlowOpacity,
    setWidgetGlowOpacity,
    selectedAudioInput,
    setSelectedAudioInput,
    selectedAudioOutput,
    setSelectedAudioOutput,
    microphoneVolume,
    setMicrophoneVolume,
    microphoneMuted,
    setMicrophoneMuted,
    syncBorderGlowWithTheme,
    setSyncBorderGlowWithTheme,
    customBorderColor,
    setCustomBorderColor,
    customGlowColor,
    setCustomGlowColor,
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
      metricsPollInterval: state.metricsPollInterval,
      setMetricsPollInterval: state.setMetricsPollInterval,
      gpuTempAlertThreshold: state.gpuTempAlertThreshold,
      setGpuTempAlertThreshold: state.setGpuTempAlertThreshold,
      cpuTempAlertThreshold: state.cpuTempAlertThreshold,
      setCpuTempAlertThreshold: state.setCpuTempAlertThreshold,
      replayDuration: state.replayDuration,
      setReplayDuration: state.setReplayDuration,
      excludeHudFromCapture: state.excludeHudFromCapture,
      setExcludeHudFromCapture: state.setExcludeHudFromCapture,
      favoriteMixerApps: state.favoriteMixerApps,
      setFavoriteMixerApps: state.setFavoriteMixerApps,
      volumeStep: state.volumeStep,
      setVolumeStep: state.setVolumeStep,
      pttBrevityLimit: state.pttBrevityLimit,
      setPttBrevityLimit: state.setPttBrevityLimit,
      systemPromptOverride: state.systemPromptOverride,
      setSystemPromptOverride: state.setSystemPromptOverride,
      backgroundBlur: state.backgroundBlur,
      setBackgroundBlur: state.setBackgroundBlur,
      backdropOpacity: state.backdropOpacity,
      setBackdropOpacity: state.setBackdropOpacity,
      launchOnStartup: state.launchOnStartup,
      setLaunchOnStartup: state.setLaunchOnStartup,
      widgetBorderRadius: state.widgetBorderRadius,
      setWidgetBorderRadius: state.setWidgetBorderRadius,
      widgetBorderWidth: state.widgetBorderWidth,
      setWidgetBorderWidth: state.setWidgetBorderWidth,
      widgetBorderOpacity: state.widgetBorderOpacity,
      setWidgetBorderOpacity: state.setWidgetBorderOpacity,
      widgetGlowSize: state.widgetGlowSize,
      setWidgetGlowSize: state.setWidgetGlowSize,
      widgetGlowOpacity: state.widgetGlowOpacity,
      setWidgetGlowOpacity: state.setWidgetGlowOpacity,
      selectedAudioInput: state.selectedAudioInput,
      setSelectedAudioInput: state.setSelectedAudioInput,
      selectedAudioOutput: state.selectedAudioOutput,
      setSelectedAudioOutput: state.setSelectedAudioOutput,
      microphoneVolume: state.microphoneVolume,
      setMicrophoneVolume: state.setMicrophoneVolume,
      microphoneMuted: state.microphoneMuted,
      setMicrophoneMuted: state.setMicrophoneMuted,
      syncBorderGlowWithTheme: state.syncBorderGlowWithTheme,
      setSyncBorderGlowWithTheme: state.setSyncBorderGlowWithTheme,
      customBorderColor: state.customBorderColor,
      setCustomBorderColor: state.setCustomBorderColor,
      customGlowColor: state.customGlowColor,
      setCustomGlowColor: state.setCustomGlowColor,
      syncHotkeys: state.syncHotkeys,
    }))
  );

  const [activeTab, setActiveTab] = useState<'integrations' | 'widgets' | 'hotkeys' | 'audio' | 'general' | 'logs' | 'updates'>('integrations');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Credentials loaded from SQLite
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [notionKey, setNotionKey] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hotkeyError, setHotkeyError] = useState('');
  
  // Audio devices list state inside SettingsModal
  const [audioDevices, setAudioDevices] = useState<{ inputs: any[], outputs: any[] }>({ inputs: [], outputs: [] });
  const [playPeakLevel, setPlayPeakLevel] = useState(0);
  const [recPeakLevel, setRecPeakLevel] = useState(0);
  
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

  // Local state copy for UI bindings
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
    replayFps,
    metricsPollInterval,
    gpuTempAlertThreshold,
    cpuTempAlertThreshold,
    replayDuration,
    excludeHudFromCapture,
    favoriteMixerApps,
    volumeStep,
    pttBrevityLimit,
    systemPromptOverride,
    backgroundBlur,
    backdropOpacity,
    launchOnStartup,
    widgetBorderRadius,
    widgetBorderWidth,
    widgetBorderOpacity,
    widgetGlowSize,
    widgetGlowOpacity,
    selectedAudioInput,
    selectedAudioOutput,
    microphoneVolume,
    microphoneMuted,
    syncBorderGlowWithTheme,
    customBorderColor,
    customGlowColor
  });

  // Diagnostics logs state
  const [logsContent, setLogsContent] = useState('Loading logs...');
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const logsContainerRef = useRef<HTMLPreElement>(null);

  // Confirmation dialogs toggle
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmClearChat, setShowConfirmClearChat] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);

  // Keybind Recording state
  const [recordingField, setRecordingField] = useState<keyof typeof localHotkeys | null>(null);

  // Hydrate credentials and basic parameters on mount / open
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
      replayFps,
      metricsPollInterval,
      gpuTempAlertThreshold,
      cpuTempAlertThreshold,
      replayDuration,
      excludeHudFromCapture,
      favoriteMixerApps,
      volumeStep,
      pttBrevityLimit,
      systemPromptOverride,
      backgroundBlur,
      backdropOpacity,
      launchOnStartup,
      widgetBorderRadius,
      widgetBorderWidth,
      widgetBorderOpacity,
      widgetGlowSize,
      widgetGlowOpacity,
      selectedAudioInput,
      selectedAudioOutput,
      microphoneVolume,
      microphoneMuted,
      syncBorderGlowWithTheme,
      customBorderColor,
      customGlowColor
    });

    async function loadAudioDevices() {
      try {
        const dev = await invoke<any>('get_audio_devices');
        setAudioDevices(dev);
      } catch (err) {
        console.warn("Failed to retrieve audio devices in SettingsModal useEffect:", err);
      }
    }
    loadAudioDevices();
    
    async function loadCredentials() {
      try {
        const db = await getDb();
        
        // OpenRouter key load
        const orResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'openrouter_key'"
        );
        if (orResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: orResult[0].encrypted_value });
          setOpenRouterKey(decrypted);
          setInitialOpenRouterKey(decrypted);
        }

        // OpenAI key load
        const oaiResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'openai_key'"
        );
        if (oaiResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: oaiResult[0].encrypted_value });
          setOpenaiKey(decrypted);
          setInitialOpenaiKey(decrypted);
        }

        // Anthropic key load
        const antResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'anthropic_key'"
        );
        if (antResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: antResult[0].encrypted_value });
          setAnthropicKey(decrypted);
          setInitialAnthropicKey(decrypted);
        }

        // Groq key load
        const grqResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'groq_key'"
        );
        if (grqResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: grqResult[0].encrypted_value });
          setGroqKey(decrypted);
          setInitialGroqKey(decrypted);
        }

        // Notion Secret load
        const notionResult = await db.select<{ encrypted_value: string }[]>(
          "SELECT encrypted_value FROM user_credentials WHERE id = 'notion_secret'"
        );
        if (notionResult.length > 0) {
          const decrypted = await invoke<string>('decrypt_data', { encoded: notionResult[0].encrypted_value });
          setNotionKey(decrypted);
          setInitialNotionKey(decrypted);
        }

        // Notion DB ID load
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

    loadCredentials();
    loadVersion();
  }, [isSettingsOpen]);

  // Load diagnostics logs from file
  const loadLogs = async () => {
    setIsRefreshingLogs(true);
    try {
      const trace = await invoke<string>('read_latest_logs');
      setLogsContent(trace);
      // Auto scroll to bottom
      setTimeout(() => {
        if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
      }, 50);
    } catch (err) {
      console.error("Failed to read latest logs:", err);
      setLogsContent(`Failed to retrieve trace files: ${err}`);
    } finally {
      setIsRefreshingLogs(false);
    }
  };

  // Load logs on tab switch
  useEffect(() => {
    if (activeTab === 'logs' && isSettingsOpen) {
      loadLogs();
    }
  }, [activeTab, isSettingsOpen]);

  // Keybind Recorder keydown listener
  useEffect(() => {
    if (!recordingField) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const isModifier = ['Control', 'Alt', 'Shift', 'Meta'].includes(e.key);

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');
      if (e.metaKey) parts.push('super');

      if (!isModifier && e.key) {
        let primaryKey = e.key.toLowerCase();
        
        // Map key names for Tauri v2 global shortcuts compatibility
        if (primaryKey === ' ') primaryKey = 'space';
        else if (primaryKey === 'arrowup') primaryKey = 'up';
        else if (primaryKey === 'arrowdown') primaryKey = 'down';
        else if (primaryKey === 'arrowleft') primaryKey = 'left';
        else if (primaryKey === 'arrowright') primaryKey = 'right';
        else if (primaryKey === 'escape') primaryKey = 'escape';
        else if (primaryKey === 'enter') primaryKey = 'enter';
        else if (primaryKey === 'backspace') primaryKey = 'backspace';
        else if (primaryKey === 'delete') primaryKey = 'delete';
        else if (primaryKey === 'tab') primaryKey = 'tab';
        
        parts.push(primaryKey);
        const combo = parts.join('+');

        const isFKey = /^f\d+$/.test(primaryKey);
        const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;

        if (hasModifier || isFKey) {
          setLocalHotkeys(prev => ({
            ...prev,
            [recordingField]: combo
          }));
          setRecordingField(null);
          setHotkeyError('');
        } else {
          setHotkeyError('Keybind requires at least one modifier key (Ctrl, Alt, Shift, Win) or be an F-key.');
          setTimeout(() => setHotkeyError(''), 4500);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recordingField]);

  // Temporary unregister hotkeys on Settings open to prevent capture conflict
  useEffect(() => {
    if (isSettingsOpen) {
      invoke('unregister_all_hotkeys').catch(console.error);
    } else {
      useSettingsStore.getState().syncHotkeys().catch(console.error);
    }
  }, [isSettingsOpen]);

  const [isMicTesting, setIsMicTesting] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micAnimationRef = useRef<number | null>(null);

  const stopMicTest = () => {
    if (micAnimationRef.current) {
      cancelAnimationFrame(micAnimationRef.current);
      micAnimationRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (micAudioCtxRef.current) {
      micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
    }
    setIsMicTesting(false);
    setRecPeakLevel(0);
  };

  const toggleMicTest = async () => {
    if (isMicTesting) {
      stopMicTest();
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const match = devices.find(d => d.kind === 'audioinput' && (
        localPreferences.selectedAudioInput === 'Default' || d.label.includes(localPreferences.selectedAudioInput) || localPreferences.selectedAudioInput.includes(d.label)
      ));
      const constraints = {
        audio: match ? { deviceId: { exact: match.deviceId } } : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      micAudioCtxRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      setIsMicTesting(true);
      
      const checkVolume = () => {
        analyser.getByteTimeDomainData(dataArray);
        let maxVal = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = Math.abs(dataArray[i] - 128) / 128;
          if (val > maxVal) maxVal = val;
        }
        setRecPeakLevel(maxVal * 2.5);
        micAnimationRef.current = requestAnimationFrame(checkVolume);
      };
      
      checkVolume();
    } catch (err) {
      console.warn(`Mic test failed: ${err}`);
    }
  };

  useEffect(() => {
    return () => {
      if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
      if (micAudioCtxRef.current) micAudioCtxRef.current.close().catch(() => {});
    };
  }, []);

  // Stop mic test automatically when switching away from Audio tab or closing settings
  useEffect(() => {
    if (activeTab !== 'audio' || !isSettingsOpen) {
      stopMicTest();
    }
  }, [activeTab, isSettingsOpen]);

  // Play test sound on output device
  const playTestSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (localPreferences.selectedAudioOutput !== 'Default' && typeof (ctx.destination as any).setSinkId === 'function') {
        const match = audioDevices.outputs.find(d => d.name === localPreferences.selectedAudioOutput);
        if (match) {
          (ctx.destination as any).setSinkId(match.id).catch(() => {});
        }
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (err) {
      console.warn(`Failed to play test sound: ${err}`);
    }
  };

  // Poll audio peak levels when Audio tab is active
  useEffect(() => {
    if (!isSettingsOpen || activeTab !== 'audio') return;
    
    let active = true;
    const pollPeak = async () => {
      if (!active) return;
      try {
        const [playPeak, recPeak] = await invoke<[number, number]>('get_audio_peak_levels');
        setPlayPeakLevel(playPeak);
        setRecPeakLevel(recPeak);
      } catch {}
      setTimeout(pollPeak, 100);
    };
    pollPeak();
    return () => { active = false; };
  }, [isSettingsOpen, activeTab]);

  // Save modified configurations to store and credentials DB
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const db = await getDb();

      // Encrypt and save OpenRouter key
      const encryptedOr = await invoke<string>('encrypt_data', { plaintext: openRouterKey });
      await db.execute(
        "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('openrouter_key', ?)",
        [encryptedOr]
      );

      // Encrypt and save OpenAI key
      const encryptedOai = await invoke<string>('encrypt_data', { plaintext: openaiKey });
      await db.execute(
        "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('openai_key', ?)",
        [encryptedOai]
      );

      // Encrypt and save Anthropic key
      const encryptedAnt = await invoke<string>('encrypt_data', { plaintext: anthropicKey });
      await db.execute(
        "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('anthropic_key', ?)",
        [encryptedAnt]
      );

      // Encrypt and save Groq key
      const encryptedGrq = await invoke<string>('encrypt_data', { plaintext: groqKey });
      await db.execute(
        "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('groq_key', ?)",
        [encryptedGrq]
      );

      // Encrypt and save Notion secret
      const encryptedNotion = await invoke<string>('encrypt_data', { plaintext: notionKey });
      await db.execute(
        "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('notion_secret', ?)",
        [encryptedNotion]
      );

      // Encrypt and save Notion DB ID
      const encryptedDbId = await invoke<string>('encrypt_data', { plaintext: notionDbId });
      await db.execute(
        "INSERT OR REPLACE INTO user_credentials (id, encrypted_value) VALUES ('notion_db_id', ?)",
        [encryptedDbId]
      );

      // Save store settings
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
      
      // Save new configurations
      await setMetricsPollInterval(localPreferences.metricsPollInterval);
      await setGpuTempAlertThreshold(localPreferences.gpuTempAlertThreshold);
      await setCpuTempAlertThreshold(localPreferences.cpuTempAlertThreshold);
      await setReplayDuration(localPreferences.replayDuration);
      await setExcludeHudFromCapture(localPreferences.excludeHudFromCapture);
      await setFavoriteMixerApps(localPreferences.favoriteMixerApps);
      await setVolumeStep(localPreferences.volumeStep);
      await setPttBrevityLimit(localPreferences.pttBrevityLimit);
      await setSystemPromptOverride(localPreferences.systemPromptOverride);
      await setBackgroundBlur(localPreferences.backgroundBlur);
      await setBackdropOpacity(localPreferences.backdropOpacity);
      await setLaunchOnStartup(localPreferences.launchOnStartup);

      // Save visual customization and audio preferences
      await setWidgetBorderRadius(localPreferences.widgetBorderRadius);
      await setWidgetBorderWidth(localPreferences.widgetBorderWidth);
      await setWidgetBorderOpacity(localPreferences.widgetBorderOpacity);
      await setWidgetGlowSize(localPreferences.widgetGlowSize);
      await setWidgetGlowOpacity(localPreferences.widgetGlowOpacity);
      await setSelectedAudioInput(localPreferences.selectedAudioInput);
      await setSelectedAudioOutput(localPreferences.selectedAudioOutput);
      await setMicrophoneVolume(localPreferences.microphoneVolume);
      await setMicrophoneMuted(localPreferences.microphoneMuted);
      await setSyncBorderGlowWithTheme(localPreferences.syncBorderGlowWithTheme);
      await setCustomBorderColor(localPreferences.customBorderColor);
      await setCustomGlowColor(localPreferences.customGlowColor);

      // Save keybind configurations
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

        // Note: We do NOT call syncHotkeys() here because hotkeys remain suspended while Settings is open.
        // They will be registered on close.
        setSaveMessage('Saved & loaded configuration successfully!');
        setHotkeyError('');
        
        // Lock in initial keybind configurations to clear dirty warning flag
        setInitialOpenRouterKey(openRouterKey);
        setInitialOpenaiKey(openaiKey);
        setInitialAnthropicKey(anthropicKey);
        setInitialGroqKey(groqKey);
        setInitialNotionKey(notionKey);
        setInitialNotionDbId(notionDbId);
        
        setTimeout(() => setSaveMessage(''), 2500);
      } catch (hotkeyErr) {
        console.error("Hotkey sync failed:", hotkeyErr);
        setSaveMessage('Partial Save. Hotkey error.');
        setHotkeyError(String(hotkeyErr));
        setTimeout(() => setSaveMessage(''), 5000);
      }

    } catch (e) {
      console.error("Failed to save credentials database:", e);
      setSaveMessage('Failed to save configuration settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Check if any state is modified but not applied
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
      localPreferences.replayFps !== replayFps ||
      localPreferences.metricsPollInterval !== metricsPollInterval ||
      localPreferences.gpuTempAlertThreshold !== gpuTempAlertThreshold ||
      localPreferences.cpuTempAlertThreshold !== cpuTempAlertThreshold ||
      localPreferences.replayDuration !== replayDuration ||
      localPreferences.excludeHudFromCapture !== excludeHudFromCapture ||
      localPreferences.favoriteMixerApps !== favoriteMixerApps ||
      localPreferences.volumeStep !== volumeStep ||
      localPreferences.pttBrevityLimit !== pttBrevityLimit ||
      localPreferences.systemPromptOverride !== systemPromptOverride ||
      localPreferences.backgroundBlur !== backgroundBlur ||
      localPreferences.backdropOpacity !== backdropOpacity ||
      localPreferences.launchOnStartup !== launchOnStartup ||
      localPreferences.widgetBorderRadius !== widgetBorderRadius ||
      localPreferences.widgetBorderWidth !== widgetBorderWidth ||
      localPreferences.widgetBorderOpacity !== widgetBorderOpacity ||
      localPreferences.widgetGlowSize !== widgetGlowSize ||
      localPreferences.widgetGlowOpacity !== widgetGlowOpacity ||
      localPreferences.selectedAudioInput !== selectedAudioInput ||
      localPreferences.selectedAudioOutput !== selectedAudioOutput ||
      localPreferences.microphoneVolume !== microphoneVolume ||
      localPreferences.microphoneMuted !== microphoneMuted ||
      localPreferences.syncBorderGlowWithTheme !== syncBorderGlowWithTheme ||
      localPreferences.customBorderColor !== customBorderColor ||
      localPreferences.customGlowColor !== customGlowColor
    );
  };

  const handleClose = () => {
    if (checkIsDirty()) {
      setShowConfirmClose(true);
      return;
    }
    toggleSettings();
  };

  const handleConfirmDiscard = async () => {
    // Revert local values
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
      replayFps,
      metricsPollInterval,
      gpuTempAlertThreshold,
      cpuTempAlertThreshold,
      replayDuration,
      excludeHudFromCapture,
      favoriteMixerApps,
      volumeStep,
      pttBrevityLimit,
      systemPromptOverride,
      backgroundBlur,
      backdropOpacity,
      launchOnStartup,
      widgetBorderRadius,
      widgetBorderWidth,
      widgetBorderOpacity,
      widgetGlowSize,
      widgetGlowOpacity,
      selectedAudioInput,
      selectedAudioOutput,
      microphoneVolume,
      microphoneMuted,
      syncBorderGlowWithTheme,
      customBorderColor,
      customGlowColor
    });
    
    // Restore CSS variables from saved settings
    await useSettingsStore.getState().loadPreferences();
    
    setShowConfirmClose(false);
    toggleSettings();
  };

  const handleResetDefaults = () => {
    setLocalHotkeys({
      overlay: 'ctrl+alt+o',
      screenshot: 'ctrl+alt+s',
      record: 'ctrl+alt+r',
      replay: 'ctrl+alt+b',
      timer: 'ctrl+alt+t',
      stopwatch: 'ctrl+alt+w',
      timerReset: 'ctrl+alt+y',
      voicePtt: 'ctrl+alt+v',
      interact: 'ctrl+alt+i'
    });

    setLocalPreferences({
      openRouterModel: 'google/gemini-2.5-flash',
      openaiModel: 'gpt-4o-mini',
      anthropicModel: 'claude-3-5-sonnet-20241022',
      groqModel: 'llama-3.3-70b-versatile',
      customOpenRouterModel: '',
      useCustomOpenRouterModel: false,
      aiProvider: 'openrouter',
      globalFontSize: 14,
      theme: 'default',
      customColor: '#FF0000',
      recordMicrophone: false,
      recordSystemAudio: true,
      replayResolution: '720p',
      replayFps: 30,
      metricsPollInterval: 1000,
      gpuTempAlertThreshold: 80,
      cpuTempAlertThreshold: 80,
      replayDuration: 30,
      excludeHudFromCapture: true,
      favoriteMixerApps: 'chrome.exe, discord.exe, spotify.exe',
      volumeStep: 5,
      pttBrevityLimit: 320,
      systemPromptOverride: '',
      backgroundBlur: 8,
      backdropOpacity: 60,
      launchOnStartup: false,
      widgetBorderRadius: 12,
      widgetBorderWidth: 1,
      widgetBorderOpacity: 15,
      widgetGlowSize: 15,
      widgetGlowOpacity: 15,
      selectedAudioInput: 'Default',
      selectedAudioOutput: 'Default',
      microphoneVolume: 100,
      microphoneMuted: false,
      syncBorderGlowWithTheme: true,
      customBorderColor: '#ffffff',
      customGlowColor: '#4af626'
    });

    setShowConfirmReset(false);
    setSaveMessage('Restored local presets. Click Apply to save.');
    setTimeout(() => setSaveMessage(''), 4000);
  };

  const handleClearChatHistory = async () => {
    setIsClearingChat(true);
    try {
      const db = await getDb();
      await db.execute("DELETE FROM ai_chat_history");
      await db.execute("DELETE FROM session_titles");
      setSaveMessage("Database chat history wiped successfully.");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch(e) {
      console.error("Wipe history error:", e);
      setHotkeyError("Failed to purge database chat history.");
      setTimeout(() => setHotkeyError(""), 3000);
    } finally {
      setIsClearingChat(false);
      setShowConfirmClearChat(false);
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Hotkey Recorder card renderer
  const renderHotkeyField = (label: string, fieldKey: keyof typeof localHotkeys) => {
    const isRecording = recordingField === fieldKey;
    const value = localHotkeys[fieldKey];
    
    // Format combination string visually
    const displayVal = value
      ? value.split('+').map(part => part.toUpperCase()).join(' + ')
      : 'NONE';

    return (
      <div className="space-y-1 bg-black/20 p-3 rounded-lg border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-2 mt-1">
          <div className={`flex-1 font-mono text-sm px-3 py-1.5 bg-black/40 rounded-lg border flex items-center justify-between min-h-[38px] ${
            isRecording 
              ? 'border-amber-500/50 text-amber-400 animate-pulse' 
              : value 
                ? 'border-white/10 text-zinc-200' 
                : 'border-dashed border-zinc-700 text-zinc-500'
          }`}>
            <span>{isRecording ? 'Listening for keys...' : displayVal}</span>
            {!isRecording && value && (
              <button
                onClick={() => setLocalHotkeys(s => ({ ...s, [fieldKey]: '' }))}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                title="Clear keybind"
              >
                Clear
              </button>
            )}
          </div>
          <button
            onClick={() => {
              if (isRecording) {
                setRecordingField(null);
              } else {
                setRecordingField(fieldKey);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-all ${
              isRecording 
                ? 'bg-amber-500 text-black border-amber-500 hover:bg-amber-400' 
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-zinc-200 hover:text-white'
            }`}
          >
            {isRecording ? 'Cancel' : 'Record'}
          </button>
        </div>
      </div>
    );
  };

  // Search Results filtering engine
  const getSearchMatches = () => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return [];

    const matches: { title: string; category: string; content: React.ReactNode }[] = [];

    // 1. Integrations Matchers
    if (['ai', 'provider', 'openrouter', 'openai', 'anthropic', 'groq', 'api', 'key', 'model', 'credentials'].some(k => query.includes(k) || k.includes(query))) {
      matches.push({
        title: 'Active AI Provider & Models',
        category: 'Integrations',
        content: (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active Provider</label>
              <select
                value={localPreferences.aiProvider}
                onChange={(e) => setLocalPreferences(s => ({ ...s, aiProvider: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-primary"
              >
                <option value="openrouter">OpenRouter AI (Default)</option>
                <option value="openai">OpenAI (Direct API)</option>
                <option value="anthropic">Anthropic (Direct API)</option>
                <option value="groq">Groq (Direct API)</option>
              </select>
            </div>
            
            {localPreferences.aiProvider === 'openrouter' && (
              <div className="space-y-3 pl-3 border-l-2 border-primary/20">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">OpenRouter API Key</label>
                  <input 
                    type="password"
                    value={openRouterKey}
                    onChange={(e) => setOpenRouterKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useCustomOpenRouterModelSearch"
                    checked={localPreferences.useCustomOpenRouterModel}
                    onChange={(e) => setLocalPreferences(s => ({ ...s, useCustomOpenRouterModel: e.target.checked }))}
                    className="rounded border-zinc-700 bg-zinc-900 text-primary"
                  />
                  <label htmlFor="useCustomOpenRouterModelSearch" className="text-xs text-zinc-300">Use Custom Model ID</label>
                </div>
                {localPreferences.useCustomOpenRouterModel ? (
                  <input 
                    type="text"
                    value={localPreferences.customOpenRouterModel}
                    onChange={(e) => setLocalPreferences(s => ({ ...s, customOpenRouterModel: e.target.value }))}
                    placeholder="google/gemini-2.5-flash"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-primary"
                  />
                ) : (
                  <select
                    value={localPreferences.openRouterModel}
                    onChange={(e) => setLocalPreferences(s => ({ ...s, openRouterModel: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-sm text-zinc-100"
                  >
                    <option value="google/gemini-2.5-flash">Gemini 2.5 Flash [Vision]</option>
                    <option value="google/gemini-2.5-pro">Gemini 2.5 Pro [Vision]</option>
                    <option value="openai/gpt-4o-mini">GPT-4o Mini [Vision]</option>
                    <option value="openai/gpt-4o">GPT-4o [Vision]</option>
                    <option value="anthropic/claude-sonnet-4.6">Claude 3.5 Sonnet [Vision]</option>
                    <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
                  </select>
                )}
              </div>
            )}

            {localPreferences.aiProvider === 'openai' && (
              <div className="space-y-3 pl-3 border-l-2 border-primary/20">
                <input 
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200"
                />
                <select
                  value={localPreferences.openaiModel}
                  onChange={(e) => setLocalPreferences(s => ({ ...s, openaiModel: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-650 rounded-lg px-4 py-2 text-sm text-zinc-100"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini [Vision]</option>
                  <option value="gpt-4o">gpt-4o [Vision]</option>
                </select>
              </div>
            )}

            {localPreferences.aiProvider === 'anthropic' && (
              <div className="space-y-3 pl-3 border-l-2 border-primary/20">
                <input 
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200"
                />
                <select
                  value={localPreferences.anthropicModel}
                  onChange={(e) => setLocalPreferences(s => ({ ...s, anthropicModel: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-650 rounded-lg px-4 py-2 text-sm text-zinc-100"
                >
                  <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet [Vision]</option>
                  <option value="claude-3-5-haiku-20241022">claude-3-5-haiku [Text]</option>
                </select>
              </div>
            )}

            {localPreferences.aiProvider === 'groq' && (
              <div className="space-y-3 pl-3 border-l-2 border-primary/20">
                <input 
                  type="password"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200"
                />
                <select
                  value={localPreferences.groqModel}
                  onChange={(e) => setLocalPreferences(s => ({ ...s, groqModel: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-650 rounded-lg px-4 py-2 text-sm text-zinc-100"
                >
                  <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                  <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                </select>
              </div>
            )}
          </div>
        )
      });
    }

    if (['notion', 'secret', 'db', 'database', 'checklists', 'notes', 'sync'].some(k => query.includes(k) || k.includes(query))) {
      matches.push({
        title: 'Notion Quick-Capture Sync',
        category: 'Integrations',
        content: (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Integration Key / Token</label>
              <input 
                type="password"
                value={notionKey}
                onChange={(e) => setNotionKey(e.target.value)}
                placeholder="secret_..."
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Database Link / ID</label>
              <input 
                type="text"
                value={notionDbId}
                onChange={(e) => {
                  let val = e.target.value;
                  const match = val.match(/([a-f0-9]{32})/i);
                  if (match) val = match[1];
                  setNotionDbId(val);
                }}
                placeholder="database_id"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        )
      });
    }

    // 2. Hotkeys Matchers
    if (['hotkey', 'bind', 'shortcut', 'overlay', 'screenshot', 'capture', 'record', 'video', 'replay', 'buffer', 'timer', 'reset', 'stopwatch', 'ptt', 'voice', 'assistant', 'interact', 'interactivity'].some(k => query.includes(k) || k.includes(query))) {
      const hotkeysMatched: { label: string; key: keyof typeof localHotkeys }[] = [];
      if ('overlay main toggle summon'.includes(query) || 'hotkey bind'.includes(query)) hotkeysMatched.push({ label: 'Main Overlay Toggle', key: 'overlay' });
      if ('screenshot capture screen'.includes(query) || 'hotkey bind'.includes(query)) hotkeysMatched.push({ label: 'Capture Screenshot', key: 'screenshot' });
      if ('record video toggle record'.includes(query) || 'hotkey bind'.includes(query)) hotkeysMatched.push({ label: 'Toggle Video Recording', key: 'record' });
      if ('replay buffer clip duration'.includes(query) || 'hotkey bind'.includes(query)) hotkeysMatched.push({ label: 'Save Replay Clip', key: 'replay' });
      if ('timer toggle stopwatch start'.includes(query) || 'hotkey bind'.includes(query)) hotkeysMatched.push({ label: 'Toggle Timer', key: 'timer' });
      if ('timer reset clean wipe clear'.includes(query) || 'hotkey bind'.includes(query)) hotkeysMatched.push({ label: 'Reset Active Timers', key: 'timerReset' });
      if ('stopwatch toggle start split'.includes(query) || 'hotkey bind'.includes(query)) hotkeysMatched.push({ label: 'Toggle Stopwatch', key: 'stopwatch' });
      if ('ptt voice push-to-talk speech assistant'.includes(query) || 'hotkey bind'.includes(query)) hotkeysMatched.push({ label: 'Voice Assistant PTT', key: 'voicePtt' });
      if ('interact click toggle focus interactive mode'.includes(query) || 'hotkey bind'.includes(query)) hotkeysMatched.push({ label: 'Toggle Interactivity', key: 'interact' });

      if (hotkeysMatched.length > 0) {
        matches.push({
          title: 'System Hotkeys Matches',
          category: 'Hotkeys',
          content: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {hotkeysMatched.map(hm => (
                <div key={hm.key}>
                  {renderHotkeyField(hm.label, hm.key)}
                </div>
              ))}
            </div>
          )
        });
      }
    }

    // 3. Widgets Preferences Matchers
    if (['widget', 'preferences', 'cpu', 'gpu', 'temp', 'polling', 'alert', 'interval', 'replay', 'hud', 'exclude', 'mixer', 'audio', 'favorite', 'volume', 'step', 'ptt', 'brevity', 'prompt', 'system'].some(k => query.includes(k) || k.includes(query))) {
      // Hardware Metrics
      if (['cpu', 'gpu', 'temp', 'alert', 'polling', 'interval', 'hardware', 'metrics', 'widget'].some(k => query.includes(k) || k.includes(query))) {
        matches.push({
          title: 'Hardware Metrics Widget',
          category: 'Widget Preferences',
          content: (
            <div className="space-y-4 bg-black/20 p-3 rounded-lg border border-white/5">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-medium">Metrics Polling Interval</span>
                  <span className="text-primary font-mono">{localPreferences.metricsPollInterval}ms</span>
                </div>
                <input 
                  type="range" min="200" max="5000" step="100"
                  value={localPreferences.metricsPollInterval}
                  onChange={(e) => setLocalPreferences(s => ({ ...s, metricsPollInterval: parseInt(e.target.value) }))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-medium">CPU Temp Warning</span>
                    <span className="text-primary font-mono">{localPreferences.cpuTempAlertThreshold}°C</span>
                  </div>
                  <input 
                    type="range" min="40" max="100" step="1"
                    value={localPreferences.cpuTempAlertThreshold}
                    onChange={(e) => setLocalPreferences(s => ({ ...s, cpuTempAlertThreshold: parseInt(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-medium">GPU Temp Warning</span>
                    <span className="text-primary font-mono">{localPreferences.gpuTempAlertThreshold}°C</span>
                  </div>
                  <input 
                    type="range" min="40" max="100" step="1"
                    value={localPreferences.gpuTempAlertThreshold}
                    onChange={(e) => setLocalPreferences(s => ({ ...s, gpuTempAlertThreshold: parseInt(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          )
        });
      }

      // Media Capture
      if (['capture', 'media', 'duration', 'exclude', 'hud', 'replay', 'buffer', 'recording'].some(k => query.includes(k) || k.includes(query))) {
        matches.push({
          title: 'Media Capture & Replay Settings',
          category: 'Widget Preferences',
          content: (
            <div className="space-y-4 bg-black/20 p-3 rounded-lg border border-white/5">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-medium">Replay Clip Duration</span>
                  <span className="text-primary font-mono">{localPreferences.replayDuration}s</span>
                </div>
                <input 
                  type="range" min="5" max="120" step="5"
                  value={localPreferences.replayDuration}
                  onChange={(e) => setLocalPreferences(s => ({ ...s, replayDuration: parseInt(e.target.value) }))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="flex justify-between items-center bg-black/30 p-2.5 rounded border border-white/5 text-xs">
                <div>
                  <span className="text-zinc-300 font-bold block">Exclude HUD Overlay</span>
                  <span className="text-zinc-500 block">Hides the overlay interface from screenshots/recordings.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" className="sr-only peer"
                    checked={localPreferences.excludeHudFromCapture}
                    onChange={(e) => setLocalPreferences(s => ({ ...s, excludeHudFromCapture: e.target.checked }))}
                  />
                  <div className="w-9 h-5 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-green"></div>
                </label>
              </div>
            </div>
          )
        });
      }

      // Audio Mixer
      if (['audio', 'mixer', 'volume', 'step', 'favorite', 'mixer', 'app'].some(k => query.includes(k) || k.includes(query))) {
        matches.push({
          title: 'Audio Mixer Settings',
          category: 'Widget Preferences',
          content: (
            <div className="space-y-4 bg-black/20 p-3 rounded-lg border border-white/5 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Volume Change Increments</span>
                  <span className="text-primary font-mono">{localPreferences.volumeStep}%</span>
                </div>
                <input 
                  type="range" min="1" max="20" step="1"
                  value={localPreferences.volumeStep}
                  onChange={(e) => setLocalPreferences(s => ({ ...s, volumeStep: parseInt(e.target.value) }))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="space-y-1">
                <span className="text-zinc-400 font-medium">Favorite Apps (Pinned Mixer Items)</span>
                <input 
                  type="text"
                  value={localPreferences.favoriteMixerApps}
                  onChange={(e) => setLocalPreferences(s => ({ ...s, favoriteMixerApps: e.target.value }))}
                  placeholder="e.g. chrome.exe, discord.exe, spotify.exe"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 font-mono text-zinc-200 text-xs focus:outline-none"
                />
              </div>
            </div>
          )
        });
      }

      // Voice PTT and Assistant prompt
      if (['voice', 'assistant', 'prompt', 'override', 'brevity', 'limit', 'system', 'tokens'].some(k => query.includes(k) || k.includes(query))) {
        matches.push({
          title: 'Voice PTT & AI Assistant Personas',
          category: 'Widget Preferences',
          content: (
            <div className="space-y-4 bg-black/20 p-3 rounded-lg border border-white/5 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">AI Response Word Limit</span>
                  <span className="text-primary font-mono">{localPreferences.pttBrevityLimit} words</span>
                </div>
                <input 
                  type="range" min="50" max="800" step="10"
                  value={localPreferences.pttBrevityLimit}
                  onChange={(e) => setLocalPreferences(s => ({ ...s, pttBrevityLimit: parseInt(e.target.value) }))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="space-y-1">
                <span className="text-zinc-400 font-medium">Custom System Prompt Override</span>
                <textarea 
                  value={localPreferences.systemPromptOverride}
                  onChange={(e) => setLocalPreferences(s => ({ ...s, systemPromptOverride: e.target.value }))}
                  placeholder="Explain answers concisely like a fighter jet tactical computer..."
                  rows={2}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 font-mono text-zinc-200 text-xs focus:outline-none resize-none"
                />
              </div>
            </div>
          )
        });
      }
    }

    // 4. General System Matches
    if (['general', 'system', 'font', 'size', 'theme', 'color', 'hex', 'blur', 'opacity', 'autostart', 'startup', 'boot', 'revert', 'defaults'].some(k => query.includes(k) || k.includes(query))) {
      matches.push({
        title: 'General Interface & Autostart Toggles',
        category: 'General',
        content: (
          <div className="space-y-4 bg-black/20 p-3 rounded-lg border border-white/5 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Backdrop Transparency</span>
                  <span className="text-primary font-mono">{localPreferences.backdropOpacity}%</span>
                </div>
                <input 
                  type="range" min="10" max="100" step="5"
                  value={localPreferences.backdropOpacity}
                  onChange={(e) => setLocalPreferences(s => ({ ...s, backdropOpacity: parseInt(e.target.value) }))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Backdrop Blur Strength</span>
                  <span className="text-primary font-mono">{localPreferences.backgroundBlur}px</span>
                </div>
                <input 
                  type="range" min="0" max="24" step="1"
                  value={localPreferences.backgroundBlur}
                  onChange={(e) => setLocalPreferences(s => ({ ...s, backgroundBlur: parseInt(e.target.value) }))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            <div className="flex justify-between items-center bg-black/30 p-2.5 rounded border border-white/5">
              <div>
                <span className="text-zinc-300 font-bold block">Launch on Windows Startup</span>
                <span className="text-zinc-500 block">Registers registry entries to autostart VectorHUD at boot.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" className="sr-only peer"
                  checked={localPreferences.launchOnStartup}
                  onChange={(e) => setLocalPreferences(s => ({ ...s, launchOnStartup: e.target.checked }))}
                />
                <div className="w-9 h-5 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-green"></div>
              </label>
            </div>
          </div>
        )
      });
    }

    return matches;
  };

  const searchResults = getSearchMatches();

  if (!isSettingsOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 flex items-center justify-center z-[100] bg-surface/50 pointer-events-auto"
        onClick={handleBackgroundClick}
      >
        {/* Spacious modal container matching widescreen dimensions */}
        <div 
          className="w-[920px] h-[680px] bg-[#0E0E0E]/95 backdrop-blur-2xl border border-border-wire rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto" 
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border-wire/40 bg-black/30">
            <h2 className="text-sm font-bold text-white tracking-widest uppercase flex items-center gap-2 font-mono">
              <Settings size={18} className="text-primary animate-spin" style={{ animationDuration: '6s' }} /> 
              VectorHUD System Customizer
            </h2>
            <button 
              onClick={handleClose} 
              className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r border-border-wire/40 p-4 flex flex-col gap-1.5 bg-black/15">
              
              {/* Accessible Interactive Settings Search Bar */}
              <div className="mb-4 relative">
                <input
                  type="text"
                  placeholder="Quick Search (e.g. keybind, cpu)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-8 py-2 text-xs text-zinc-200 focus:outline-none focus:border-primary transition-colors font-mono"
                />
                <Search className="absolute left-2.5 top-2.5 text-zinc-500" size={14} />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Sidebar Tabs */}
              <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                <button
                  disabled={!!searchQuery}
                  onClick={() => setActiveTab('integrations')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all border ${
                    searchQuery 
                      ? 'opacity-40 border-transparent text-zinc-600'
                      : activeTab === 'integrations' 
                        ? 'bg-primary/15 border-primary/35 text-primary shadow-[inset_0_0_10px_rgba(var(--accent-green-rgb,74,246,38),0.08)]' 
                        : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <Key size={14} /> Integrations & API
                </button>

                <button
                  disabled={!!searchQuery}
                  onClick={() => setActiveTab('widgets')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all border ${
                    searchQuery 
                      ? 'opacity-40 border-transparent text-zinc-600'
                      : activeTab === 'widgets' 
                        ? 'bg-primary/15 border-primary/35 text-primary shadow-[inset_0_0_10px_rgba(var(--accent-green-rgb,74,246,38),0.08)]' 
                        : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <Sliders size={14} /> Widget Preferences
                </button>

                <button
                  disabled={!!searchQuery}
                  onClick={() => setActiveTab('hotkeys')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all border ${
                    searchQuery 
                      ? 'opacity-40 border-transparent text-zinc-600'
                      : activeTab === 'hotkeys' 
                        ? 'bg-primary/15 border-primary/35 text-primary shadow-[inset_0_0_10px_rgba(var(--accent-green-rgb,74,246,38),0.08)]' 
                        : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <Zap size={14} /> Hotkey Recorder
                </button>

                <button
                  disabled={!!searchQuery}
                  onClick={() => setActiveTab('audio')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all border ${
                    searchQuery 
                      ? 'opacity-40 border-transparent text-zinc-600'
                      : activeTab === 'audio' 
                        ? 'bg-primary/15 border-primary/35 text-primary shadow-[inset_0_0_10px_rgba(var(--accent-green-rgb,74,246,38),0.08)]' 
                        : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <Volume2 size={14} /> Audio Settings
                </button>

                <button
                  disabled={!!searchQuery}
                  onClick={() => setActiveTab('general')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all border ${
                    searchQuery 
                      ? 'opacity-40 border-transparent text-zinc-600'
                      : activeTab === 'general' 
                        ? 'bg-primary/15 border-primary/35 text-primary shadow-[inset_0_0_10px_rgba(var(--accent-green-rgb,74,246,38),0.08)]' 
                        : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <Palette size={14} /> General & System
                </button>

                <button
                  disabled={!!searchQuery}
                  onClick={() => setActiveTab('logs')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all border ${
                    searchQuery 
                      ? 'opacity-40 border-transparent text-zinc-600'
                      : activeTab === 'logs' 
                        ? 'bg-primary/15 border-primary/35 text-primary shadow-[inset_0_0_10px_rgba(var(--accent-green-rgb,74,246,38),0.08)]' 
                        : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <Terminal size={14} /> Diagnostics Logs
                </button>

                <div className="flex-1"></div>

                <button
                  disabled={!!searchQuery}
                  onClick={() => setActiveTab('updates')}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wider uppercase mt-auto border transition-all ${
                    searchQuery 
                      ? 'opacity-40 border-transparent text-zinc-600'
                      : activeTab === 'updates' 
                        ? 'bg-primary/15 border-primary/35 text-primary' 
                        : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <Download size={14} /> About / Updates
                </button>
              </div>
            </div>

            {/* Content Display Window */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-black/5">
              
              {/* Render Search Results if query exists */}
              {searchQuery ? (
                <div className="space-y-6">
                  <div className="border-b border-white/10 pb-3">
                    <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                      Search Results for "{searchQuery}"
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      Showing matching parameters in local system settings.
                    </p>
                  </div>
                  {searchResults.length > 0 ? (
                    <div className="space-y-4">
                      {searchResults.map((sr, idx) => (
                        <div 
                          key={idx} 
                          className="p-4 rounded-xl bg-zinc-950 border border-white/5 space-y-2 relative overflow-hidden"
                        >
                          <div className="absolute right-3 top-3 px-2 py-0.5 rounded bg-zinc-800 text-xs text-zinc-400 font-mono font-semibold uppercase">
                            {sr.category}
                          </div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wide pr-20">
                            {sr.title}
                          </h4>
                          <div className="pt-2 text-zinc-300">
                            {sr.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <HelpCircle size={36} className="text-zinc-600 mb-2" />
                      <p className="text-sm text-zinc-400 font-bold">No settings match your query.</p>
                      <p className="text-xs text-zinc-600 mt-1">Try refining search parameters like 'key', 'blur', 'cpu', or 'timer'.</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Standard Tab Render Layout */
                <>
                  {activeTab === 'integrations' && (
                    <div className="space-y-6">
                      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/10 pb-2">
                          <Zap size={14} className="text-amber-400" /> AI Provider Configuration
                        </h3>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Active AI Interface Provider</label>
                          <select
                            value={localPreferences.aiProvider}
                            onChange={(e) => setLocalPreferences(s => ({ ...s, aiProvider: e.target.value }))}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                          >
                            <option value="openrouter">OpenRouter AI (Consolidated Cloud)</option>
                            <option value="openai">OpenAI (Direct Endpoints)</option>
                            <option value="anthropic">Anthropic Claude (Direct Endpoints)</option>
                            <option value="groq">Groq Llama (Direct Endpoints)</option>
                          </select>
                        </div>

                        {/* OpenRouter configuration */}
                        {localPreferences.aiProvider === 'openrouter' && (
                          <div className="space-y-4 pt-2">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">OpenRouter API Key</label>
                              <input 
                                type="password"
                                value={openRouterKey}
                                onChange={(e) => setOpenRouterKey(e.target.value)}
                                placeholder="sk-or-v1-..."
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-primary font-mono"
                              />
                            </div>
                            
                            <div className="flex items-center gap-2.5 bg-black/20 p-2.5 rounded border border-white/5">
                              <input
                                type="checkbox"
                                id="useCustomOpenRouterModelMain"
                                checked={localPreferences.useCustomOpenRouterModel}
                                onChange={(e) => setLocalPreferences(s => ({ ...s, useCustomOpenRouterModel: e.target.checked }))}
                                className="rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-primary cursor-pointer"
                              />
                              <label htmlFor="useCustomOpenRouterModelMain" className="text-xs text-zinc-400 select-none cursor-pointer">
                                Overwrite standard list with custom Model ID
                              </label>
                            </div>

                            {localPreferences.useCustomOpenRouterModel ? (
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Custom Model ID</label>
                                <input 
                                  type="text"
                                  value={localPreferences.customOpenRouterModel}
                                  onChange={(e) => setLocalPreferences(s => ({ ...s, customOpenRouterModel: e.target.value }))}
                                  placeholder="e.g. google/gemini-2.5-flash"
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-primary"
                                />
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Model Selection</label>
                                <select
                                  value={localPreferences.openRouterModel}
                                  onChange={(e) => setLocalPreferences(s => ({ ...s, openRouterModel: e.target.value }))}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-primary appearance-none cursor-pointer"
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

                        {/* OpenAI configuration */}
                        {localPreferences.aiProvider === 'openai' && (
                          <div className="space-y-4 pt-2">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">OpenAI API Key</label>
                              <input 
                                type="password"
                                value={openaiKey}
                                onChange={(e) => setOpenaiKey(e.target.value)}
                                placeholder="sk-proj-..."
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-primary font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">OpenAI Model</label>
                              <select
                                value={localPreferences.openaiModel}
                                onChange={(e) => setLocalPreferences(s => ({ ...s, openaiModel: e.target.value }))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-200 appearance-none cursor-pointer"
                              >
                                <option value="gpt-4o-mini">gpt-4o-mini [Vision]</option>
                                <option value="gpt-4o">gpt-4o [Vision]</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Anthropic configuration */}
                        {localPreferences.aiProvider === 'anthropic' && (
                          <div className="space-y-4 pt-2">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Anthropic API Key</label>
                              <input 
                                type="password"
                                value={anthropicKey}
                                onChange={(e) => setAnthropicKey(e.target.value)}
                                placeholder="sk-ant-..."
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-primary font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Anthropic Model</label>
                              <select
                                value={localPreferences.anthropicModel}
                                onChange={(e) => setLocalPreferences(s => ({ ...s, anthropicModel: e.target.value }))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-200 appearance-none cursor-pointer font-mono"
                              >
                                <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022</option>
                                <option value="claude-3-5-haiku-20241022">claude-3-5-haiku-20241022</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Groq configuration */}
                        {localPreferences.aiProvider === 'groq' && (
                          <div className="space-y-4 pt-2">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Groq API Key</label>
                              <input 
                                type="password"
                                value={groqKey}
                                onChange={(e) => setGroqKey(e.target.value)}
                                placeholder="gsk_..."
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-primary font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Groq Model</label>
                              <select
                                value={localPreferences.groqModel}
                                onChange={(e) => setLocalPreferences(s => ({ ...s, groqModel: e.target.value }))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-200 appearance-none cursor-pointer font-mono"
                              >
                                <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                                <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Notion Sync configuration */}
                      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/10 pb-2">
                          <Edit3 size={14} className="text-blue-450" /> Notion Database Quick-Capture
                        </h3>
                        
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Internal Integration Secret</label>
                          <input 
                            type="password"
                            value={notionKey}
                            onChange={(e) => setNotionKey(e.target.value)}
                            placeholder="secret_..."
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-primary font-mono"
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Database ID or Page Link</label>
                          <input 
                            type="text"
                            value={notionDbId}
                            onChange={(e) => {
                              let val = e.target.value;
                              const match = val.match(/([a-f0-9]{32})/i);
                              if (match) val = match[1];
                              setNotionDbId(val);
                            }}
                            placeholder="e.g. 68482d8c90384a86b97621a..."
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-primary font-mono"
                          />
                        </div>

                        <div className="bg-zinc-900/60 p-3.5 rounded border border-white/5 space-y-1.5 text-xs text-zinc-400">
                          <span className="font-bold text-zinc-300">Set Up Instructions:</span>
                          <p className="leading-relaxed">
                            1. Create a Notion integration on the <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Notion Developers portal</a>.
                            <br />
                            2. Create a Database block on a Notion page, click the <b>...</b>, add your newly created connection.
                            <br />
                            3. Copy the database link and paste it above; VectorHUD will isolate the 32-character ID.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Widgets tab - detailed settings for widgets */}
                  {activeTab === 'widgets' && (
                    <div className="space-y-6">
                      
                      {/* Hardware Metrics Settings */}
                      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/10 pb-2">
                          <Cpu size={14} className="text-emerald-450" /> System Metrics Widget
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">Metrics Polling Rate</span>
                              <span className="text-primary font-mono font-bold">{localPreferences.metricsPollInterval}ms</span>
                            </div>
                            <input 
                              type="range" min="200" max="5000" step="100"
                              value={localPreferences.metricsPollInterval}
                              onChange={(e) => setLocalPreferences(s => ({ ...s, metricsPollInterval: parseInt(e.target.value) }))}
                              className="w-full accent-primary"
                            />
                            <p className="text-xs text-zinc-500">How frequently the overlay requests CPU, GPU, VRAM and RAM performance data. Lower rates hit accuracy but use slightly more resources.</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-300 font-medium">CPU Temp Alert Threshold</span>
                                <span className="text-amber-500 font-mono font-bold">{localPreferences.cpuTempAlertThreshold}°C</span>
                              </div>
                              <input 
                                type="range" min="40" max="100" step="1"
                                value={localPreferences.cpuTempAlertThreshold}
                                onChange={(e) => setLocalPreferences(s => ({ ...s, cpuTempAlertThreshold: parseInt(e.target.value) }))}
                                className="w-full accent-primary"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-300 font-medium">GPU Temp Alert Threshold</span>
                                <span className="text-amber-500 font-mono font-bold">{localPreferences.gpuTempAlertThreshold}°C</span>
                              </div>
                              <input 
                                type="range" min="40" max="100" step="1"
                                value={localPreferences.gpuTempAlertThreshold}
                                onChange={(e) => setLocalPreferences(s => ({ ...s, gpuTempAlertThreshold: parseInt(e.target.value) }))}
                                className="w-full accent-primary"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Media Capture Settings */}
                      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/10 pb-2">
                          <Monitor size={14} className="text-cyan-400" /> Media Capture & Replays
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">Replay Clip Duration</span>
                              <span className="text-primary font-mono font-bold">{localPreferences.replayDuration} seconds</span>
                            </div>
                            <input 
                              type="range" min="5" max="120" step="5"
                              value={localPreferences.replayDuration}
                              onChange={(e) => setLocalPreferences(s => ({ ...s, replayDuration: parseInt(e.target.value) }))}
                              className="w-full accent-primary"
                            />
                            <p className="text-xs text-zinc-500">Duration of rolling buffer clips written to disk when the replay hotkey is triggered.</p>
                          </div>

                          <div className="flex justify-between items-center bg-black/40 p-3.5 rounded-lg border border-white/5 text-xs">
                            <div>
                              <span className="text-zinc-200 font-bold block">Exclude VectorHUD overlay from captures</span>
                              <span className="text-zinc-500 block">Instructs the capture engine to dynamically hide overlay windows during screenshots or recordings.</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" className="sr-only peer" 
                                checked={localPreferences.excludeHudFromCapture}
                                onChange={(e) => setLocalPreferences(s => ({ ...s, excludeHudFromCapture: e.target.checked }))}
                              />
                              <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-green"></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Audio Mixer Settings */}
                      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/10 pb-2">
                          <Volume2 size={14} className="text-indigo-400" /> Audio Mixer Preferences
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">Mixer Volume Step</span>
                              <span className="text-primary font-mono font-bold">{localPreferences.volumeStep}%</span>
                            </div>
                            <input 
                              type="range" min="1" max="20" step="1"
                              value={localPreferences.volumeStep}
                              onChange={(e) => setLocalPreferences(s => ({ ...s, volumeStep: parseInt(e.target.value) }))}
                              className="w-full accent-primary"
                            />
                            <p className="text-xs text-zinc-500">Volume increments when adjust steps are triggered via hotkeys or mouse wheel over the mixer widgets.</p>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Favorite Applications (Always Pinned)</label>
                            <input 
                              type="text"
                              value={localPreferences.favoriteMixerApps}
                              onChange={(e) => setLocalPreferences(s => ({ ...s, favoriteMixerApps: e.target.value }))}
                              placeholder="e.g. chrome.exe, discord.exe, spotify.exe"
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-primary"
                            />
                            <p className="text-xs text-zinc-500">Comma-separated process names that should stay at the top of the Audio Mixer list even when idle.</p>
                          </div>
                        </div>
                      </div>

                      {/* AI & Voice Assistant PTT Settings */}
                      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/10 pb-2">
                          <Zap size={14} className="text-amber-450" /> Voice Assistant & PTT Settings
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">AI Response Word Limit</span>
                              <span className="text-primary font-mono font-bold">{localPreferences.pttBrevityLimit} words</span>
                            </div>
                            <input 
                              type="range" min="50" max="800" step="10"
                              value={localPreferences.pttBrevityLimit}
                              onChange={(e) => setLocalPreferences(s => ({ ...s, pttBrevityLimit: parseInt(e.target.value) }))}
                              className="w-full accent-primary"
                            />
                            <p className="text-xs text-zinc-500 font-sans">Limits the length of the voice assistant's response so it fits nicely on your screen during gameplay.</p>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Custom System Prompt Override</label>
                            <textarea 
                              value={localPreferences.systemPromptOverride}
                              onChange={(e) => setLocalPreferences(s => ({ ...s, systemPromptOverride: e.target.value }))}
                              placeholder="e.g. Act as a tactical military hardware computer. Keep answers under 2 sentences and focus on metrics."
                              rows={3}
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-primary resize-none"
                            />
                            <p className="text-xs text-zinc-500">Overrides the default agent prompt template. Useful for roleplays, brevity constraints or custom integrations.</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Hotkeys tab - lists all keyboard hotkeys */}
                  {activeTab === 'hotkeys' && (
                    <div className="space-y-6">
                      <div className="space-y-2 bg-zinc-950/20 p-4 border border-dashed border-white/10 rounded-xl">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2">
                          <Shield size={14} className="text-primary" /> Global Shortcuts Recorder
                        </h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Click <b>Record</b> and press any key combination. Shortcuts must include at least one modifier key (Ctrl, Alt, Shift, Win) or be a function key (F1-F12) to be valid. 
                          Apply settings to load changes.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderHotkeyField('Main Overlay Toggle', 'overlay')}
                        {renderHotkeyField('Capture Screenshot', 'screenshot')}
                        {renderHotkeyField('Toggle Video Recording', 'record')}
                        {renderHotkeyField('Save Replay Clip', 'replay')}
                        {renderHotkeyField('Toggle Timer', 'timer')}
                        {renderHotkeyField('Reset Active Timers', 'timerReset')}
                        {renderHotkeyField('Toggle Stopwatch', 'stopwatch')}
                        {renderHotkeyField('Voice Assistant PTT', 'voicePtt')}
                        {renderHotkeyField('Toggle Interactivity', 'interact')}
                      </div>
                    </div>
                  )}

                  {/* General / System tab */}
                  {activeTab === 'general' && (
                    <div className="space-y-6">
                      
                      {/* Theme and fonts */}
                      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/10 pb-2">
                          <Palette size={14} className="text-primary" /> Visual Theme & Typography
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">HUD Theme Preset</label>
                            <select
                              value={localPreferences.theme}
                              onChange={(e) => setLocalPreferences(s => ({ ...s, theme: e.target.value }))}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-200 focus:outline-none appearance-none cursor-pointer"
                            >
                              <option value="default">Default VectorHUD Green</option>
                              <option value="amber">Tactical Amber</option>
                              <option value="neon_blue">Cyber Blue</option>
                              <option value="matrix_green">Legacy Terminal Green</option>
                              <option value="outrun_pink">Outrun Pink</option>
                              <option value="custom">Custom Hex Preset</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">Base Font Size</span>
                              <span className="text-primary font-mono font-bold">{localPreferences.globalFontSize}px</span>
                            </div>
                            <input 
                              type="range" min="10" max="24" step="1"
                              value={localPreferences.globalFontSize}
                              onChange={(e) => setLocalPreferences(s => ({ ...s, globalFontSize: parseInt(e.target.value) }))}
                              className="w-full accent-primary"
                            />
                          </div>
                        </div>

                        {localPreferences.theme === 'custom' && (
                          <div className="space-y-2 pt-2 animate-fadeIn">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Custom Accent Color</label>
                            <div className="flex gap-2.5 items-center">
                              <input 
                                type="color" 
                                value={localPreferences.customColor}
                                onChange={(e) => setLocalPreferences(s => ({ ...s, customColor: e.target.value }))}
                                className="w-10 h-10 rounded bg-transparent border border-white/10 cursor-pointer"
                              />
                              <input 
                                type="text" 
                                value={localPreferences.customColor}
                                onChange={(e) => setLocalPreferences(s => ({ ...s, customColor: e.target.value }))}
                                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-primary"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Backdrop parameters */}
                      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/10 pb-2">
                          <Sliders size={14} className="text-cyan-400" /> Overlay Backdrop Physics
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">Backdrop Blur Strength</span>
                              <span className="text-primary font-mono font-bold">{localPreferences.backgroundBlur}px</span>
                            </div>
                            <input 
                              type="range" min="0" max="25" step="1"
                              value={localPreferences.backgroundBlur}
                              onChange={(e) => {
                                setLocalPreferences(s => ({ ...s, backgroundBlur: parseInt(e.target.value) }));
                                // Dynamic feedback preview
                                document.documentElement.style.setProperty('--bg-blur-amount', `${e.target.value}px`);
                              }}
                              className="w-full accent-primary"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">Backdrop Opacity Density</span>
                              <span className="text-primary font-mono font-bold">{localPreferences.backdropOpacity}%</span>
                            </div>
                            <input 
                              type="range" min="10" max="95" step="5"
                              value={localPreferences.backdropOpacity}
                              onChange={(e) => {
                                setLocalPreferences(s => ({ ...s, backdropOpacity: parseInt(e.target.value) }));
                                // Dynamic feedback preview
                                document.documentElement.style.setProperty('--bg-opacity-amount', `${parseInt(e.target.value) / 100}`);
                              }}
                              className="w-full accent-primary"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Widget Borders and Glow */}
                      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/10 pb-2 font-mono">
                          <Sliders size={14} className="text-accent-green" /> Widget Borders & Glow Effects
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">Border Radius</span>
                              <span className="text-primary font-mono font-bold">{localPreferences.widgetBorderRadius}px</span>
                            </div>
                            <input 
                              type="range" min="0" max="24" step="1"
                              value={localPreferences.widgetBorderRadius}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setLocalPreferences(s => ({ ...s, widgetBorderRadius: val }));
                                document.documentElement.style.setProperty('--widget-border-radius', `${val}px`);
                              }}
                              className="w-full accent-primary cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">Border Line Width</span>
                              <span className="text-primary font-mono font-bold">{localPreferences.widgetBorderWidth}px</span>
                            </div>
                            <input 
                              type="range" min="0" max="6" step="1"
                              value={localPreferences.widgetBorderWidth}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setLocalPreferences(s => ({ ...s, widgetBorderWidth: val }));
                                document.documentElement.style.setProperty('--widget-border-width', `${val}px`);
                              }}
                              className="w-full accent-primary cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">Border Opacity</span>
                              <span className="text-primary font-mono font-bold">{localPreferences.widgetBorderOpacity}%</span>
                            </div>
                            <input 
                              type="range" min="0" max="100" step="5"
                              value={localPreferences.widgetBorderOpacity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setLocalPreferences(s => ({ ...s, widgetBorderOpacity: val }));
                                document.documentElement.style.setProperty('--widget-border-opacity', `${val / 100}`);
                              }}
                              className="w-full accent-primary cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">Accent Glow Spread</span>
                              <span className="text-primary font-mono font-bold">{localPreferences.widgetGlowSize}px</span>
                            </div>
                            <input 
                              type="range" min="0" max="30" step="1"
                              value={localPreferences.widgetGlowSize}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setLocalPreferences(s => ({ ...s, widgetGlowSize: val }));
                                document.documentElement.style.setProperty('--widget-glow-size', `${val}px`);
                              }}
                              className="w-full accent-primary cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5 md:col-span-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">Accent Glow Intensity</span>
                              <span className="text-primary font-mono font-bold">{localPreferences.widgetGlowOpacity}%</span>
                            </div>
                            <input 
                              type="range" min="0" max="100" step="5"
                              value={localPreferences.widgetGlowOpacity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setLocalPreferences(s => ({ ...s, widgetGlowOpacity: val }));
                                document.documentElement.style.setProperty('--widget-glow-opacity', `${val / 100}`);
                              }}
                              className="w-full accent-primary cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5 md:col-span-2 border-t border-white/5 pt-4">
                            <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5 text-xs">
                              <div>
                                <span className="text-zinc-200 font-bold block">Sync Border & Glow with Theme</span>
                                <span className="text-zinc-500 block">Enable to automatically match widget border and glow colors with the active HUD theme.</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" className="sr-only peer" 
                                  checked={localPreferences.syncBorderGlowWithTheme}
                                  onChange={(e) => {
                                    const val = e.target.checked;
                                    setLocalPreferences(s => ({ ...s, syncBorderGlowWithTheme: val }));
                                    if (val) {
                                      document.documentElement.style.removeProperty('--widget-border-color');
                                      document.documentElement.style.removeProperty('--widget-glow-color-rgb');
                                    } else {
                                      document.documentElement.style.setProperty('--widget-border-color', localPreferences.customBorderColor);
                                      const hexToRgbStr = (hex: string) => {
                                        let c = hex.substring(1);
                                        if (c.length === 3) c = c.split('').map(x => x + x).join('');
                                        return `${parseInt(c.slice(0, 2), 16)}, ${parseInt(c.slice(2, 4), 16)}, ${parseInt(c.slice(4, 6), 16)}`;
                                      };
                                      document.documentElement.style.setProperty('--widget-glow-color-rgb', hexToRgbStr(localPreferences.customGlowColor));
                                    }
                                  }}
                                />
                                <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-green"></div>
                              </label>
                            </div>
                          </div>

                          {!localPreferences.syncBorderGlowWithTheme && (
                            <div className="space-y-4 md:col-span-2 bg-black/30 p-4 rounded-lg border border-white/5 animate-fadeIn">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Custom Border Color</label>
                                  <div className="flex gap-2.5 items-center">
                                    <input 
                                      type="color" 
                                      value={localPreferences.customBorderColor}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setLocalPreferences(s => ({ ...s, customBorderColor: val }));
                                        document.documentElement.style.setProperty('--widget-border-color', val);
                                      }}
                                      className="w-8 h-8 rounded bg-transparent border border-white/10 cursor-pointer"
                                    />
                                    <input 
                                      type="text" 
                                      value={localPreferences.customBorderColor}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setLocalPreferences(s => ({ ...s, customBorderColor: val }));
                                        document.documentElement.style.setProperty('--widget-border-color', val);
                                      }}
                                      className="flex-grow bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-primary"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Custom Glow Color</label>
                                  <div className="flex gap-2.5 items-center">
                                    <input 
                                      type="color" 
                                      value={localPreferences.customGlowColor}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setLocalPreferences(s => ({ ...s, customGlowColor: val }));
                                        const hexToRgbStr = (hex: string) => {
                                          let c = hex.substring(1);
                                          if (c.length === 3) c = c.split('').map(x => x + x).join('');
                                          return `${parseInt(c.slice(0, 2), 16)}, ${parseInt(c.slice(2, 4), 16)}, ${parseInt(c.slice(4, 6), 16)}`;
                                        };
                                        document.documentElement.style.setProperty('--widget-glow-color-rgb', hexToRgbStr(val));
                                      }}
                                      className="w-8 h-8 rounded bg-transparent border border-white/10 cursor-pointer"
                                    />
                                    <input 
                                      type="text" 
                                      value={localPreferences.customGlowColor}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setLocalPreferences(s => ({ ...s, customGlowColor: val }));
                                        const hexToRgbStr = (hex: string) => {
                                          let c = hex.substring(1);
                                          if (c.length === 3) c = c.split('').map(x => x + x).join('');
                                          return `${parseInt(c.slice(0, 2), 16)}, ${parseInt(c.slice(2, 4), 16)}, ${parseInt(c.slice(4, 6), 16)}`;
                                        };
                                        document.documentElement.style.setProperty('--widget-glow-color-rgb', hexToRgbStr(val));
                                      }}
                                      className="flex-grow bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-primary"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* System and startup settings */}
                      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/10 pb-2">
                          <Settings size={14} className="text-indigo-400" /> Windows System Registry
                        </h3>

                        <div className="flex justify-between items-center bg-black/40 p-3.5 rounded-lg border border-white/5 text-xs">
                          <div>
                            <span className="text-zinc-200 font-bold block">Launch on Windows Startup</span>
                            <span className="text-zinc-500 block">Automatically boots VectorHUD silently into system tray on login.</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" className="sr-only peer" 
                              checked={localPreferences.launchOnStartup}
                              onChange={(e) => setLocalPreferences(s => ({ ...s, launchOnStartup: e.target.checked }))}
                            />
                            <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-green"></div>
                          </label>
                        </div>
                      </div>

                      {/* Hard reset controls */}
                      <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle size={14} /> Danger Zone / Revert Presets
                          </h4>
                          <p className="text-xs text-zinc-500 mt-1">
                            Resets all local coordinate positions, keyboard shortcuts, themes and widget sliders back to defaults.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowConfirmReset(true)}
                          className="px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer self-start md:self-auto"
                        >
                          Reset Settings
                        </button>
                      </div>

                    </div>
                  )}

                  {/* Audio settings tab */}
                  {activeTab === 'audio' && (
                    <div className="space-y-6">
                      
                      {/* Speaker Output Card */}
                      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/10 pb-2 font-mono">
                          <Volume2 size={14} className="text-accent-green" /> Speaker / Playback Output
                        </h3>
                        
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Speaker / Output Device</label>
                          <div className="flex items-center gap-3">
                            <select
                              value={localPreferences.selectedAudioOutput}
                              onChange={(e) => setLocalPreferences(s => ({ ...s, selectedAudioOutput: e.target.value }))}
                              className="w-0 min-w-0 flex-grow bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 px-4 py-2 outline-none rounded-lg font-mono cursor-pointer hover:border-zinc-700 focus:border-primary transition-colors appearance-none truncate pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2374F61A%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat"
                            >
                              <option value="Default">Default System Device</option>
                              {audioDevices.outputs?.map(dev => (
                                <option key={dev.id} value={dev.name}>{dev.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={playTestSound}
                              className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-accent-green hover:text-accent-green text-xs font-bold uppercase transition-colors shrink-0 rounded-lg cursor-pointer animate-pulse-subtle"
                              title="Play test tone"
                            >
                              Play Test Sound
                            </button>
                          </div>
                        </div>

                        {/* Playback Peak Visualizer */}
                        <div className="space-y-1.5 pt-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-455 font-semibold uppercase tracking-wider">Playback Output Peak Level</span>
                            <span className="text-zinc-555 font-mono text-[11px]">{Math.round(playPeakLevel * 100)}%</span>
                          </div>
                          <div className="h-2 bg-zinc-900 rounded-sm overflow-hidden relative border border-white/5">
                            <div 
                              className="h-full bg-accent-green transition-all duration-75 ease-out shadow-[0_0_8px_rgba(74,246,38,0.4)]"
                              style={{ width: `${Math.min(100, playPeakLevel * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Microphone Input Card */}
                      <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2 border-b border-white/10 pb-2 font-mono">
                          <Mic size={14} className="text-accent-green" /> Microphone / Capture Input
                        </h3>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Microphone / Input Device</label>
                          <div className="flex items-center gap-3">
                            <select
                              value={localPreferences.selectedAudioInput}
                              onChange={(e) => setLocalPreferences(s => ({ ...s, selectedAudioInput: e.target.value }))}
                              className="w-0 min-w-0 flex-grow bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 px-4 py-2 outline-none rounded-lg font-mono cursor-pointer hover:border-zinc-700 focus:border-primary transition-colors appearance-none truncate pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2374F61A%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat"
                            >
                              <option value="Default">Default System Device</option>
                              {audioDevices.inputs?.map(dev => (
                                <option key={dev.id} value={dev.name}>{dev.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={toggleMicTest}
                              className={`px-4 py-2 border text-xs font-bold uppercase transition-colors shrink-0 rounded-lg cursor-pointer ${
                                isMicTesting 
                                  ? 'bg-accent-green/20 border-accent-green text-accent-green hover:bg-accent-green/30' 
                                  : 'bg-zinc-900 border-zinc-800 hover:border-accent-green hover:text-accent-green'
                              }`}
                              title="Test microphone input"
                            >
                              {isMicTesting ? 'Stop Test' : 'Test Mic'}
                            </button>
                          </div>
                        </div>

                        {/* Mic Volume Slider & Mute Toggle */}
                        <div className="space-y-3 pt-2">
                          <div className="flex justify-between items-center text-xs">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Microphone Volume & Mute</label>
                            <span className="text-primary font-mono font-bold">{localPreferences.microphoneVolume}%</span>
                          </div>
                          <div className="flex items-center gap-3 bg-black/40 p-3.5 rounded-lg border border-white/5">
                            <button 
                              onClick={() => setLocalPreferences(s => ({ ...s, microphoneMuted: !s.microphoneMuted }))} 
                              className="transition-colors hover:opacity-80 p-1 bg-zinc-900 border border-zinc-800 rounded hover:border-zinc-700 shrink-0 cursor-pointer"
                              title={localPreferences.microphoneMuted ? "Unmute Mic" : "Mute Mic"}
                            >
                              {localPreferences.microphoneMuted || localPreferences.microphoneVolume === 0 ? (
                                <VolumeX size={16} className="text-red-400 animate-pulse" />
                              ) : (
                                <Mic size={16} className="text-accent-green" />
                              )}
                            </button>
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              value={localPreferences.microphoneVolume}
                              onChange={(e) => setLocalPreferences(s => ({ ...s, microphoneVolume: parseInt(e.target.value) }))}
                              className="flex-grow h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-accent-green"
                            />
                          </div>
                        </div>

                        {/* Recording Peak Visualizer */}
                        <div className="space-y-1.5 pt-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-455 font-semibold uppercase tracking-wider">Live Input VU Meter</span>
                            <span className="text-zinc-555 font-mono text-[11px]">{Math.round(recPeakLevel * 100)}%</span>
                          </div>
                          <div className="h-2 bg-zinc-900 rounded-sm overflow-hidden relative border border-white/5">
                            <div 
                              className="h-full bg-accent-green transition-all duration-75 ease-out shadow-[0_0_8px_rgba(74,246,38,0.4)]"
                              style={{ width: `${Math.min(100, recPeakLevel * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Diagnostics trace logs tab */}
                  {activeTab === 'logs' && (
                    <div className="flex flex-col h-full space-y-4">
                      <div className="flex justify-between items-center border-b border-white/10 pb-3">
                        <div>
                          <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                            <Terminal size={14} className="text-primary" /> Rolling Diagnostics Trace Output
                          </h3>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Reading the last 200 trace and console lines from local daily logs.
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setShowConfirmClearChat(true)}
                            className="px-3 py-1.5 bg-red-950/30 hover:bg-red-950/60 border border-red-500/25 hover:border-red-500/40 text-red-400 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} /> Purge Chat History
                          </button>
                          
                          <button
                            onClick={loadLogs}
                            disabled={isRefreshingLogs}
                            className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw size={13} className={isRefreshingLogs ? 'animate-spin' : ''} /> Refresh Logs
                          </button>
                        </div>
                      </div>

                      {/* Rolling Monospaced Log Viewer */}
                      <pre 
                        ref={logsContainerRef}
                        className="flex-1 p-4 bg-[#050505] border border-white/5 rounded-xl font-mono text-xs text-zinc-400 overflow-y-auto leading-relaxed custom-scrollbar max-h-[360px] whitespace-pre-wrap select-text"
                      >
                        {logsContent || 'Log stream is currently empty.'}
                      </pre>
                    </div>
                  )}

                  {/* Updates & about tab */}
                  {activeTab === 'updates' && (
                    <div className="space-y-6 flex flex-col h-full">
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="w-16 h-16 bg-gradient-to-tr from-primary to-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/10">
                          <span className="text-3xl font-black text-white italic">V</span>
                        </div>
                        <h3 className="text-lg font-bold text-white tracking-wide">VectorHUD Overlay</h3>
                        <p className="text-xs text-zinc-500 mt-1">Production Release: v{currentVersion}</p>
                      </div>

                      <div className="bg-black/20 border border-white/5 rounded-xl p-5 flex flex-col items-center justify-center gap-4 text-center">
                        {updateInfo ? (
                          <>
                            <div className="flex items-center gap-3 text-green-400 font-semibold text-xs uppercase tracking-wider">
                              <Download size={18} /> New Update Available!
                            </div>
                            <p className="text-zinc-300 text-sm">
                              Version <strong className="text-white">v{updateInfo.version}</strong> is ready to download.
                            </p>
                            
                            <button
                              onClick={async () => {
                                try {
                                  setIsDownloadingUpdate(true);
                                  setUpdateMessage('Downloading and installing bundle...');
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
                              className="px-6 py-2 bg-primary text-black font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2 mt-2 cursor-pointer shadow-lg shadow-primary/15"
                            >
                              {isDownloadingUpdate ? (
                                <><RefreshCw size={14} className="animate-spin" /> Installing...</>
                              ) : (
                                <><Download size={14} /> Download & Install</>
                              )}
                            </button>
                            {updateMessage && <p className="text-xs text-zinc-400 mt-2">{updateMessage}</p>}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-center w-10 h-10 bg-white/5 rounded-full mb-1">
                              <CheckCircle2 size={20} className="text-zinc-405" />
                            </div>
                            <p className="text-zinc-350 text-xs font-semibold uppercase tracking-wider">VectorHUD is fully updated</p>
                            <p className="text-xs text-zinc-650">The app checks registry distributions automatically at startup.</p>
                            
                            <button
                              onClick={async () => {
                                try {
                                  setIsCheckingUpdate(true);
                                  setUpdateMessage('Querying tauri releases...');
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
                              className="mt-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                            >
                              <RefreshCw size={12} className={isCheckingUpdate ? 'animate-spin' : ''} />
                              {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                            </button>
                            {updateMessage && <p className="text-xs text-zinc-400 mt-2">{updateMessage}</p>}
                          </>
                        )}
                      </div>

                      <div className="mt-auto pt-4 flex justify-between items-center text-xs text-zinc-500 border-t border-white/5 font-mono">
                        <p>Built with ❤️ for Gamers</p>
                        <button 
                          onClick={() => openUrl("https://github.com/Francefernance12/VectorHUD")} 
                          className="hover:text-white transition-colors cursor-pointer bg-transparent border-none text-xs"
                        >
                          View GitHub Repo
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer controls */}
          <div className="p-4 border-t border-border-wire/40 bg-black/30 flex flex-col gap-2">
            {hotkeyError && (
              <div className="bg-red-950/30 border border-red-500/50 rounded-md p-3 mb-1">
                <span className="text-xs font-mono text-red-400 whitespace-pre-wrap flex items-center gap-1.5">
                  <AlertTriangle size={14} className="shrink-0" /> {hotkeyError}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono text-primary font-bold">
                {saveMessage}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClose}
                  className="px-5 py-2 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10 transition-all cursor-pointer uppercase tracking-wider"
                >
                  Close
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-black font-black px-6 py-2.5 rounded-lg text-xs uppercase tracking-widest transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-primary/10"
                >
                  {isSaving ? 'Saving...' : (
                    <>
                      <Save size={14} /> Apply Settings
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Confirmation Discard Modal */}
      <AnimatePresence>
        {showConfirmClose && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 flex items-center justify-center z-[200] bg-black/70 pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); setShowConfirmClose(false); }}
          >
            <div 
              className="bg-[#121212] border border-border-wire rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-amber-500" /> Unsaved Configuration
              </h3>
              <p className="text-zinc-400 text-xs leading-relaxed mt-2.5">
                You have modifications that haven't been applied to VectorHUD. Are you sure you want to discard them?
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setShowConfirmClose(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmDiscard}
                  className="px-4 py-2 text-xs font-bold bg-red-950/40 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Reset Defaults Modal */}
      <AnimatePresence>
        {showConfirmReset && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 flex items-center justify-center z-[200] bg-black/70 pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); setShowConfirmReset(false); }}
          >
            <div 
              className="bg-[#121212] border border-border-wire rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <RotateCcw size={16} className="text-red-500" /> Revert all presets?
              </h3>
              <p className="text-zinc-400 text-xs leading-relaxed mt-2.5">
                This will overwrite hotkeys, polling rates, backdrop parameters and themes. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setShowConfirmReset(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleResetDefaults}
                  className="px-4 py-2 text-xs font-bold bg-red-950/40 text-red-405 border border-red-500/30 hover:bg-red-500/30 rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Revert to Default
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Purge Chat History Modal */}
      <AnimatePresence>
        {showConfirmClearChat && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 flex items-center justify-center z-[200] bg-black/70 pointer-events-auto"
            onClick={(e) => { e.stopPropagation(); setShowConfirmClearChat(false); }}
          >
            <div 
              className="bg-[#121212] border border-border-wire rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Trash2 size={16} className="text-red-500" /> Wipe Chat Threads?
              </h3>
              <p className="text-zinc-400 text-xs leading-relaxed mt-2.5">
                This will permanently delete all saved threads and AI chat history from the local database.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setShowConfirmClearChat(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleClearChatHistory}
                  disabled={isClearingChat}
                  className="px-4 py-2 text-xs font-bold bg-red-950/40 text-red-405 border border-red-500/30 hover:bg-red-500/30 rounded-lg transition-colors cursor-pointer uppercase tracking-wider disabled:opacity-50"
                >
                  {isClearingChat ? 'Wiping...' : 'Confirm Purge'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
