import { useEffect, useState, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { check } from '@tauri-apps/plugin-updater';
import { AnimatePresence, motion } from "framer-motion";
import { logger } from "./utils/logger";
import { getDb } from "./utils/db";
import { setSetting, getSetting } from "./utils/store";
import { useShellStore } from "./store/shellStore";
import { useWidgetStore } from "./store/widgetStore";
import { useSettingsStore } from "./store/settingsStore";
import { useToastStore } from "./store/toastStore";
import { useTimerStore } from "./store/timerStore";
import { useHardwareStore } from "./store/hardwareStore";
import { useShallow } from 'zustand/react/shallow';
import { Dock } from "./components/Dock";
import { WidgetContainer } from "./components/WidgetContainer";
import { SettingsModal } from "./components/SettingsModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DummyWidget } from "./components/widgets/DummyWidget";
import { HardwareWidget } from "./components/widgets/HardwareWidget";
import { MediaCaptureWidget } from "./components/widgets/MediaCaptureWidget";
import { AudioHubWidget } from "./components/widgets/AudioHubWidget";
import { OpenRouterWidget } from "./components/widgets/OpenRouterWidget";
import { NotionCaptureWidget } from "./components/widgets/NotionCaptureWidget";
import { TimerWidget } from "./components/widgets/TimerWidget";
import { RecordingStatusBar } from "./components/RecordingStatusBar";
import { TimerStatusBar } from "./components/TimerStatusBar";
import { useRecordingStore } from "./store/recordingStore";
import { invoke } from "@tauri-apps/api/core";
import { useOpenRouterStore } from "./store/openRouterStore";
import { transcribeAudio, executeTool, AI_TOOLS, getAnthropicTools } from "./utils/aiActions";
import { UI_CONSTANTS } from "./config/constants";
import "./App.css";

interface Message {
  id?: number;
  session_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  image_path?: string;
  timestamp?: string;
  tokens?: number;
  tool_calls?: any;
  tool_call_id?: string;
}

function App() {
  const isInteractive = useShellStore((state) => state.isInteractive);
  const isOverlayOpen = useShellStore((state) => state.isOverlayOpen);
  const toggleInteractive = useShellStore((state) => state.toggleInteractive);
  const setInteractive = useShellStore((state) => state.setInteractive);
  const setOverlayOpen = useShellStore((state) => state.setOverlayOpen);
  
  const activeWidgetIds = useWidgetStore(useShallow((state) => Object.keys(state.activeWidgets)));
  
  const isRecording = useRecordingStore((state) => state.isRecording);

  // Global Toast Store
  const toasts = useToastStore((state) => state.toasts);
  const showToast = useToastStore((state) => state.showToast);

  // Voice PTT Assistant states
  const [pttState, setPttState] = useState<'idle' | 'recording' | 'transcribing' | 'thinking' | 'response'>('idle');
  const [pttCountdown, setPttCountdown] = useState(30.0);
  const [pttTranscript, setPttTranscript] = useState('');
  const [pttResponseText, setPttResponseText] = useState('');
  const [showPttResponse, setShowPttResponse] = useState(false);

  // Refs to avoid stale closures in listeners
  const pttStateRef = useRef(pttState);
  useEffect(() => {
    pttStateRef.current = pttState;
  }, [pttState]);

  // PTT countdown timer effect
  useEffect(() => {
    if (pttState !== 'recording') return;

    const interval = setInterval(() => {
      setPttCountdown(prev => {
        if (prev <= 0.1) {
          clearInterval(interval);
          invoke<string>('stop_voice_recording')
            .then(base64Wav => {
              handleVoiceStop(base64Wav);
            })
            .catch(err => {
              logger.error(`Auto-stop PTT voice recording failed: ${err}`);
              setPttState('idle');
            });
          return 0;
        }
        return Number((prev - 0.1).toFixed(1));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [pttState]);

  // PTT Response auto-dismiss effect (8 seconds)
  useEffect(() => {
    if (!showPttResponse) return;
    const timer = setTimeout(() => {
      setShowPttResponse(false);
      setPttState('idle');
    }, 8000);
    return () => clearTimeout(timer);
  }, [showPttResponse]);

  const handleVoiceStop = async (base64Wav: string) => {
    setPttState('transcribing');
    try {
      const text = await transcribeAudio(base64Wav);
      setPttTranscript(text);
      if (text.trim()) {
        await handlePttSubmission(text);
      } else {
        showToast("🎙️ Voice Assistant: No speech detected");
        setPttState('idle');
      }
    } catch (err: any) {
      logger.error(`PTT transcription failed: ${err?.message || String(err)}`);
      showToast(`🎙️ Transcription failed: ${err?.message || String(err)}`);
      setPttState('idle');
    }
  };

  const handleVoiceStopRef = useRef(handleVoiceStop);
  useEffect(() => {
    handleVoiceStopRef.current = handleVoiceStop;
  }, [handleVoiceStop]);

  const handlePttSubmission = async (transcript: string) => {
    if (!transcript.trim()) {
      setPttState('idle');
      return;
    }

    setPttState('thinking');
    
    try {
      const db = await getDb();
      
      // 1. Get or create active session ID
      let sessionId = useOpenRouterStore.getState().currentSessionId;
      if (!sessionId) {
        sessionId = Math.random().toString(36).substring(2, 15);
        useOpenRouterStore.getState().setCurrentSessionId(sessionId);
      }

      // 2. Load existing messages to keep context
      const existingRows = await db.select<any[]>(
        'SELECT * FROM ai_chat_history WHERE session_id = ? ORDER BY id ASC',
        [sessionId]
      );
      const existingMessages: Message[] = existingRows.map(row => ({
        session_id: row.session_id,
        role: row.role as 'user' | 'assistant' | 'tool',
        content: row.content,
        image_path: row.image_path || undefined,
        tokens: row.tokens || undefined,
        tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
        tool_call_id: row.tool_call_id || undefined
      }));

      // 3. Save user message to database
      const userMsg: Message = {
        session_id: sessionId,
        role: 'user',
        content: transcript
      };
      await db.execute(
        'INSERT INTO ai_chat_history (session_id, role, content, image_path, tokens, tool_calls, tool_call_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
        [userMsg.session_id, userMsg.role, userMsg.content, null, null, null, null]
      );

      // Trigger frontend widgets to refresh if open
      window.dispatchEvent(new Event('refresh-chat-messages'));

      // 4. Construct current messages array for API
      const updatedMessages = [...existingMessages, userMsg];

      // 5. Retrieve API Key
      const settings = useSettingsStore.getState();
      const aiProvider = settings.aiProvider || 'openrouter';
      
      let keyId = 'openrouter_key';
      let selectedModel = settings.openRouterModel;
      let providerName = 'OpenRouter';

      switch (aiProvider) {
        case 'openai':
          keyId = 'openai_key';
          selectedModel = settings.openaiModel;
          providerName = 'OpenAI';
          break;
        case 'anthropic':
          keyId = 'anthropic_key';
          selectedModel = settings.anthropicModel;
          providerName = 'Anthropic';
          break;
        case 'groq':
          keyId = 'groq_key';
          selectedModel = settings.groqModel;
          providerName = 'Groq';
          break;
        case 'openrouter':
        default:
          keyId = 'openrouter_key';
          selectedModel = (settings.useCustomOpenRouterModel && settings.customOpenRouterModel) 
            ? settings.customOpenRouterModel 
            : settings.openRouterModel;
          providerName = 'OpenRouter';
          break;
      }

      const keyResult = await db.select<{ encrypted_value: string }[]>(
        "SELECT encrypted_value FROM user_credentials WHERE id = ?",
        [keyId]
      );
      if (keyResult.length === 0) {
        throw new Error(`${providerName} API key is not configured. Please add it in Settings.`);
      }

      const apiKey = await invoke<string>('decrypt_data', { encoded: keyResult[0].encrypted_value });
      if (!apiKey) {
        throw new Error(`${providerName} API key is invalid or empty.`);
      }

      // 6. Execute AI Call (Looping for tools)
      let currentMessages: Message[] = [...updatedMessages];
      let depth = 0;
      let finalContent = '';

      const pttSystemPrompt = UI_CONSTANTS.CHAT_SYSTEM_PROMPT + 
        "\n\n[PTT SYSTEM INSTRUCTION]: The user is speaking via Push-to-Talk (voice). Keep your final response extremely brief, concise, and direct (2-3 sentences max) unless they explicitly ask for an in-depth analysis, an essay, research, or a formatted list. Focus on answering their question directly.";

      while (depth < 5) {
        const apiMessages = currentMessages.map(msg => {
          if (msg.role === 'tool') {
            return { role: 'tool', tool_call_id: msg.tool_call_id, content: msg.content };
          }
          if (msg.role === 'assistant' && msg.tool_calls) {
            return { role: 'assistant', content: msg.content || "", tool_calls: msg.tool_calls };
          }
          return { role: msg.role, content: msg.content };
        });

        const supportsTools = 
          aiProvider === 'openai' ||
          aiProvider === 'anthropic' ||
          aiProvider === 'groq' ||
          (aiProvider === 'openrouter' && (!settings.useCustomOpenRouterModel || (settings.customOpenRouterModel && (
            settings.customOpenRouterModel.includes('gpt') ||
            settings.customOpenRouterModel.includes('claude') ||
            settings.customOpenRouterModel.includes('gemini') ||
            settings.customOpenRouterModel.includes('llama-3.3') ||
            settings.customOpenRouterModel.includes('llama3')
          ))));

        const toolsPayload = supportsTools 
          ? (aiProvider === 'anthropic' ? getAnthropicTools() : AI_TOOLS)
          : undefined;

        interface UnifiedLlmResponse {
          content: string;
          total_tokens: number;
          tool_calls?: any;
        }

        const result = await invoke<UnifiedLlmResponse>('call_ai_api', {
          provider: aiProvider,
          model: selectedModel,
          messages: apiMessages,
          systemPrompt: pttSystemPrompt,
          apiKey: apiKey,
          tools: toolsPayload
        });

        if (result.tool_calls && result.tool_calls.length > 0) {
          const assistantMsg: Message = {
            session_id: sessionId,
            role: 'assistant',
            content: result.content || "",
            tokens: result.total_tokens,
            tool_calls: result.tool_calls
          };
          await db.execute(
            'INSERT INTO ai_chat_history (session_id, role, content, image_path, tokens, tool_calls, tool_call_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
            [assistantMsg.session_id, assistantMsg.role, assistantMsg.content, null, assistantMsg.tokens, JSON.stringify(assistantMsg.tool_calls), null]
          );

          currentMessages.push(assistantMsg);
          window.dispatchEvent(new Event('refresh-chat-messages'));

          const toolResults: Message[] = [];
          for (const tc of result.tool_calls) {
            const name = tc.function.name;
            let args = {};
            try {
              args = typeof tc.function.arguments === 'string' 
                ? JSON.parse(tc.function.arguments) 
                : tc.function.arguments;
            } catch (e) {
              logger.error(`Failed to parse arguments for tool ${name}: ${tc.function.arguments}`);
            }

            showToast(`🔧 Tool Executed: ${name}`);
            const output = await executeTool(name, args);

            const toolMsg: Message = {
              session_id: sessionId,
              role: 'tool',
              content: output,
              tool_call_id: tc.id
            };
            await db.execute(
              'INSERT INTO ai_chat_history (session_id, role, content, image_path, tokens, tool_calls, tool_call_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
              [toolMsg.session_id, toolMsg.role, toolMsg.content, null, null, null, toolMsg.tool_call_id]
            );

            toolResults.push(toolMsg);
          }

          currentMessages.push(...toolResults);
          window.dispatchEvent(new Event('refresh-chat-messages'));
          depth++;
        } else {
          finalContent = result.content;
          const assistantMsg: Message = {
            session_id: sessionId,
            role: 'assistant',
            content: finalContent,
            tokens: result.total_tokens
          };
          await db.execute(
            'INSERT INTO ai_chat_history (session_id, role, content, image_path, tokens, tool_calls, tool_call_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
            [assistantMsg.session_id, assistantMsg.role, assistantMsg.content, null, assistantMsg.tokens, null, null]
          );
          
          window.dispatchEvent(new Event('refresh-chat-messages'));
          break;
        }
      }

      setPttResponseText(finalContent);
      setPttState('response');
      setShowPttResponse(true);

    } catch (err: any) {
      logger.error(`PTT AI assistant error: ${err?.message || String(err)}`);
      showToast(`🎙️ Voice Assistant error: ${err?.message || String(err)}`);
      setPttState('idle');
    }
  };

  // Force settings to close in state when exiting interactive mode
  useEffect(() => {
    if (!isInteractive && useSettingsStore.getState().isSettingsOpen) {
      useSettingsStore.getState().toggleSettings();
    }
  }, [isInteractive]);

  useEffect(() => {
    logger.info("VectorHUD UI Booted");

    const verifyPersistence = async () => {
      try {
        await getDb(); // Boot SQLite
        await setSetting("last_boot", new Date().toISOString()); // Boot Store
        const lastBoot = await getSetting("last_boot", "unknown");
        logger.info(`Persistence verified. Last boot: ${lastBoot}`);

        // Hydrate widget layout
        const savedWidgets = await getSetting<Record<string, ReturnType<typeof useWidgetStore.getState>['activeWidgets'][string]>>("activeWidgets", {} as Record<string, ReturnType<typeof useWidgetStore.getState>['activeWidgets'][string]>);
        if (Object.keys(savedWidgets).length > 0) {
          useWidgetStore.getState().setInitialState(savedWidgets);
        }

        // Hydrate settings
        await useSettingsStore.getState().loadPreferences();

        // Reset countdown and stopwatch states on boot to clear legacy persisted states
        useTimerStore.getState().resetCd();
        useTimerStore.getState().resetSw();

        // Silent Update Check
        try {
          const update = await check();
          if (update?.available) {
            logger.info(`Update to ${update.version} available!`);
            useToastStore.getState().showToast(`Update v${update.version} available! Open Settings to install.`);
          }
        } catch (e) {
          logger.error(`Silent update check failed: ${e}`);
        }
      } catch (err) {
        logger.error(`Persistence verification failed: ${err}`);
      }
    };
    verifyPersistence();

    // Subscribe to state changes and save to disk (debounced)
    let saveTimeout: ReturnType<typeof setTimeout>;
    let pendingSave = false;

    const flushSave = () => {
      if (pendingSave) {
        clearTimeout(saveTimeout);
        setSetting("activeWidgets", useWidgetStore.getState().activeWidgets).catch(err => {
          logger.error(`Failed to flush widget layout: ${err}`).catch(console.error);
        });
        pendingSave = false;
      }
    };

    window.addEventListener('beforeunload', flushSave);

    const unsubscribeStore = useWidgetStore.subscribe((state) => {
      pendingSave = true;
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        setSetting("activeWidgets", state.activeWidgets).catch(err => {
          logger.error(`Failed to save widget layout: ${err}`).catch(console.error);
        });
        pendingSave = false;
      }, 500); // 500ms debounce
    });

    // Start in Ghost Mode by explicitly telling Rust to ignore cursor events
    setInteractive(false);


    let isMounted = true;
    const unlistenListeners: Array<() => void> = [];

    const safePush = (unlisten: () => void) => {
      if (!isMounted) {
        unlisten();
      } else {
        unlistenListeners.push(unlisten);
      }
    };

    const initListeners = async () => {
      try {
        if (!isMounted) return;
        let pressTime = 0;
        const unlistenShortcut = await listen<string>("hotkey-overlay", (event) => {
          const state = event.payload;
          const now = Date.now();

          if (state === "pressed") {
            pressTime = now;
            const currentOverlayOpen = useShellStore.getState().isOverlayOpen;
            if (!currentOverlayOpen) {
              setInteractive(true);
            }
          } else if (state === "released") {
            const duration = now - pressTime;
            const currentOverlayOpen = useShellStore.getState().isOverlayOpen;

            if (duration < 250) {
              // Tap: toggle the full overlay
              toggleInteractive();
            } else {
              // Hold: revert interactive mode back to click-through if overlay was closed
              if (!currentOverlayOpen) {
                setInteractive(false);
              }
            }
          }
        });
        safePush(unlistenShortcut);

        if (!isMounted) return;
        const unlistenHardware = await useHardwareStore.getState().initialize();
        safePush(unlistenHardware);

        if (!isMounted) return;
        const unlistenToast = await listen<string>("hud-toast", (event) => {
          showToast(event.payload);
        });
        safePush(unlistenToast);

        if (!isMounted) return;
        const unlistenFocusLoss = await listen("window-lost-focus", () => {
          if (useShellStore.getState().ignoreFocusLoss) {
            logger.info("Ignoring window-lost-focus event during active capture window hide.");
            return;
          }
          setInteractive(false);
        });
        safePush(unlistenFocusLoss);

        if (!isMounted) return;
        const unlistenForceInteractive = await listen("force-interactive", () => {
          setInteractive(true);
        });
        safePush(unlistenForceInteractive);

        if (!isMounted) return;
        const unlistenScreenshot = await listen("hotkey-screenshot", async () => {
          try {
            useShellStore.getState().setIgnoreFocusLoss(true);
            const path = await invoke<string>('capture_screenshot');
            const normalizedPath = path.replace(/\\/g, '/');
            await getDb().then(db => db.execute('INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)', [normalizedPath, 'screenshot', 'Desktop']));
            window.dispatchEvent(new Event('refresh-capture-history'));
            showToast("📸 Screenshot Saved");
          } catch (err) {
            logger.error(`Screenshot hotkey failed: ${err}`).catch(console.error);
          } finally {
            setTimeout(() => {
              useShellStore.getState().setIgnoreFocusLoss(false);
            }, 300);
          }
        });
        safePush(unlistenScreenshot);

        if (!isMounted) return;
        const unlistenRecord = await listen("hotkey-record", async () => {
          const isRec = useRecordingStore.getState().isRecording;
          if (isRec) {
            try {
              const path = await invoke<string>('stop_video_recording');
              const normalizedPath = path.replace(/\\/g, '/');
              await getDb().then(db => db.execute('INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)', [normalizedPath, 'video', 'Desktop']));
              useRecordingStore.getState().setRecording(false);
              window.dispatchEvent(new Event('refresh-capture-history'));
              showToast("⏹️ Recording Saved");
            } catch (err) {
              logger.error(`Stop recording hotkey failed: ${err}`).catch(console.error);
            }
          } else {
            try {
              const micEnabled = useSettingsStore.getState().recordMicrophone;
              const audioEnabled = useSettingsStore.getState().recordSystemAudio;
              await invoke<string>('start_video_recording', { micEnabled, audioEnabled });
              useRecordingStore.getState().setRecording(true);
              showToast("🔴 Recording Started");
            } catch (err) {
              logger.error(`Start recording hotkey failed: ${err}`).catch(console.error);
            }
          }
        });
        safePush(unlistenRecord);

        if (!isMounted) return;
        const unlistenReplay = await listen("hotkey-replay", async () => {
          const isReplay = useRecordingStore.getState().isReplayActive;
          if (isReplay) {
            showToast("⏳ Processing 30s Clip...");
            try {
              const path = await invoke<string>('save_replay_buffer');
              const normalizedPath = path.replace(/\\/g, '/');
              await getDb().then(db => db.execute('INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)', [normalizedPath, 'video', 'Desktop']));
              window.dispatchEvent(new Event('refresh-capture-history'));
              showToast("⚡ Replay Clip Saved");
            } catch (err) {
              logger.error(`Save replay hotkey failed: ${err}`).catch(console.error);
            }
          } else {
            try {
              const micEnabled = useSettingsStore.getState().recordMicrophone;
              const audioEnabled = useSettingsStore.getState().recordSystemAudio;
              const res = useSettingsStore.getState().replayResolution;
              const fps = useSettingsStore.getState().replayFps;
              await invoke('start_replay_buffer', { micEnabled, audioEnabled, resolution: res, fps });
              useRecordingStore.getState().setReplayActive(true);
              showToast("⏪ Replay Buffer Started");
            } catch (err) {
              logger.error(`Start replay hotkey failed: ${err}`).catch(console.error);
            }
          }
        });
        safePush(unlistenReplay);

        if (!isMounted) return;
        const unlistenTimer = await listen("hotkey-timer", () => {
          const { cdIsRunning, cdFinished, cdTime, cdInput, pauseCd, startCd, resetCd } = useTimerStore.getState();
          if (cdIsRunning) {
            pauseCd();
          } else {
            if (cdFinished) resetCd();
            if (cdTime === 0) useTimerStore.getState().setCdInput(cdInput);
            startCd();
          }
        });
        safePush(unlistenTimer);

        if (!isMounted) return;
        const unlistenStopwatch = await listen("hotkey-stopwatch", () => {
          const { swIsRunning, pauseSw, startSw } = useTimerStore.getState();
          if (swIsRunning) pauseSw();
          else startSw();
        });
        safePush(unlistenStopwatch);

        if (!isMounted) return;
        const unlistenTimerReset = await listen("hotkey-timer-reset", () => {
          useTimerStore.getState().resetCd();
          useTimerStore.getState().resetSw();
        });
        safePush(unlistenTimerReset);

        if (!isMounted) return;
        const unlistenVoiceStart = await listen("voice-recording-started", () => {
          logger.info("PTT Voice Recording started");
          setPttState('recording');
          setPttCountdown(30.0);
          setPttTranscript('');
          setPttResponseText('');
          setShowPttResponse(false);
        });
        safePush(unlistenVoiceStart);

        if (!isMounted) return;
        const unlistenVoiceStop = await listen<string>("voice-recording-stopped", (event) => {
          logger.info("PTT Voice Recording stopped");
          if (handleVoiceStopRef.current) {
            handleVoiceStopRef.current(event.payload);
          }
        });
        safePush(unlistenVoiceStop);

        if (!isMounted) return;
        const unlistenVoiceError = await listen<string>("voice-recording-stopped-error", (event) => {
          logger.error(`PTT Voice Recording error: ${event.payload}`);
          showToast(`🎙️ Voice assistant error: ${event.payload}`);
          setPttState('idle');
        });
        safePush(unlistenVoiceError);
      } catch (err) {
        logger.error(`Failed to initialize listeners: ${err}`).catch(console.error);
      }
    };
    initListeners();

    const handleBlur = () => {
      if (useShellStore.getState().isInteractive) {
        setInteractive(false);
      }
    };
    window.addEventListener('blur', handleBlur);

    const handleGlobalError = (event: ErrorEvent) => {
      logger.error(
        `[UNCAUGHT] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`
      ).catch(console.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
      logger.error(`[UNHANDLED_REJECTION] ${reason}`).catch(console.error);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      isMounted = false;
      unlistenListeners.forEach(fn => fn());
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', flushSave);
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      unsubscribeStore();
      clearTimeout(saveTimeout);
    };
  }, [setInteractive, toggleInteractive, showToast]);

  return (
    <>
      {/* HUD Toasts */}
      <div className="fixed inset-x-0 top-16 z-[9999] pointer-events-none flex flex-col items-center gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="bg-black/90 backdrop-blur-md border border-white/20 text-white font-mono text-xs px-4 py-2 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.1)] font-bold tracking-widest"
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* PTT Recording / Processing Overlay */}
      <AnimatePresence>
        {pttState !== 'idle' && pttState !== 'response' && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[9990] bg-black/90 backdrop-blur-md border border-accent-amber/50 px-6 py-3 rounded-sm shadow-[0_0_30px_rgba(255,176,0,0.15)] flex items-center gap-4 font-mono pointer-events-none"
          >
            {pttState === 'recording' && (
              <>
                <div className="relative flex items-center justify-center w-3 h-3">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-accent-amber tracking-widest uppercase">Voice Assistant: Listening</span>
                  <span className="text-[9px] text-zinc-500 font-semibold uppercase">Hold PTT shortcut to record</span>
                </div>
                {/* Waveform animation */}
                <div className="flex items-end gap-0.5 h-4 px-2">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-0.5 bg-accent-amber rounded-full"
                      animate={{ height: [4, 16, 4] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
                <div className="text-xs font-bold text-red-500 tracking-wider">
                  {pttCountdown.toFixed(1)}s
                </div>
              </>
            )}

            {pttState === 'transcribing' && (
              <>
                <div className="w-3 h-3 rounded-full border border-accent-amber border-t-transparent animate-spin" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-accent-amber tracking-widest uppercase">Transcribing voice stream...</span>
                  <span className="text-[9px] text-zinc-500 uppercase font-semibold">Processing speech-to-text</span>
                </div>
              </>
            )}

            {pttState === 'thinking' && (
              <>
                <div className="w-3 h-3 rounded-full border border-accent-amber border-t-transparent animate-spin" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-accent-amber tracking-widest uppercase">Vector HUD: Thinking...</span>
                  <span className="text-[9px] text-zinc-500 uppercase font-semibold">Querying AI Provider</span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Voice Response HUD Window */}
      <AnimatePresence>
        {showPttResponse && pttResponseText && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[9990] w-full max-w-xl bg-black/90 backdrop-blur-md border border-accent-amber rounded-sm shadow-[0_0_40px_rgba(255,176,0,0.2)] font-mono pointer-events-auto overflow-hidden"
          >
            {/* Header bar */}
            <div className="bg-accent-amber/10 border-b border-accent-amber/30 px-4 py-2 flex items-center justify-between">
              <span className="text-xs font-bold text-accent-amber tracking-widest uppercase">
                [ VECTOR HUD VOICE LINK ]
              </span>
              <button
                onClick={() => {
                  setShowPttResponse(false);
                  setPttState('idle');
                }}
                className="text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
              >
                Close
              </button>
            </div>
            
            {/* Body */}
            <div className="p-4 space-y-3">
              {pttTranscript && (
                <div className="text-[10px] text-zinc-500 border-l border-zinc-700 pl-2 italic font-semibold">
                  &ldquo;{pttTranscript}&rdquo;
                </div>
              )}
              <div className="text-sm text-zinc-200 leading-relaxed font-semibold">
                {pttResponseText.length > 320 
                  ? pttResponseText.substring(0, 320) + '...'
                  : pttResponseText
                }
              </div>
            </div>

            {/* Footer action bar */}
            <div className="bg-zinc-900/50 border-t border-zinc-800/80 px-4 py-2.5 flex items-center justify-between text-[10px]">
              <span className="text-zinc-500 uppercase tracking-widest font-semibold">
                Auto-dismissing in 8s
              </span>
              <button
                onClick={() => {
                  setShowPttResponse(false);
                  setPttState('idle');
                  
                  // Ensure AI chat is open
                  const active = useWidgetStore.getState().activeWidgets['ai-chat'];
                  if (!active) {
                    useWidgetStore.getState().toggleWidget('ai-chat');
                  }
                  useShellStore.getState().setOverlayOpen(true);
                  useShellStore.getState().setInteractive(true);
                }}
                className="px-3 py-1 bg-accent-amber/10 border border-accent-amber/30 text-accent-amber rounded-sm font-bold uppercase tracking-widest hover:bg-accent-amber hover:text-black transition-all"
              >
                Open Full Chat
              </button>
            </div>

            {/* Loading/Dismiss Progress Bar */}
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 8, ease: "linear" }}
              className="h-0.5 bg-accent-amber"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating persistent recording status bar */}
      {isRecording && (
        <div className={isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}>
          <RecordingStatusBar />
        </div>
      )}

      {/* Floating persistent timer status bar */}
      <TimerStatusBar />

      {/* Interactive Overlay UI Backdrop */}
      <AnimatePresence>
        {isOverlayOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 shadow-[inset_0_0_100px_rgba(var(--accent-amber-rgb,0,0,0),0.1)] backdrop-blur-sm transition-all duration-300 pointer-events-auto z-[40]"
            onClick={(e) => {
              // Only dismiss if they clicked directly on the backdrop, not on the widgets inside
              if (e.target === e.currentTarget) {
                setOverlayOpen(false);
                setInteractive(false);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Widget Layer (Rendered at z-50 so it is above the backdrop but below the settings modal) */}
      <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden" id="widget-bounds">
        <AnimatePresence>
          {activeWidgetIds.map((id) => (
            <div key={id} className={isInteractive ? 'pointer-events-auto' : 'pointer-events-none'}>
              <WidgetContainer id={id}>
                <ErrorBoundary>
                  {id === 'hardware-metrics' ? <HardwareWidget /> : 
                   id === 'media-capture' ? <MediaCaptureWidget /> : 
                   id === 'audio-mixer' ? <AudioHubWidget /> :
                   id === 'ai-chat' ? <OpenRouterWidget /> :
                   id === 'quick-notes' ? <NotionCaptureWidget /> :
                   id === 'game-timer' ? <TimerWidget /> :
                   <DummyWidget />}
                </ErrorBoundary>
              </WidgetContainer>
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* Dock and Settings Modal Layer (Rendered at z-[60] so they are above everything) */}
      <AnimatePresence>
        {isOverlayOpen && (
          <div className="fixed inset-0 pointer-events-none z-[60]">
            <Dock />
            <SettingsModal />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
