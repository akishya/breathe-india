import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Search,
  MapPin,
  Sparkles,
  Bookmark,
  Upload,
  Volume2,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { saveCreation } from '../lib/firebase';
import type { ChatMessage, ChatModel, GroundingMode } from '../types/studio';

const ROLE_PRESETS: Record<string, string> = {
  architect:
    'You are Meridian Technical Architect. Give concise, structured engineering answers with clear tradeoffs.',
  researcher:
    'You are Meridian Field Researcher. Synthesize verified facts, cite sources clearly, and highlight actionable insights.',
  creative:
    'You are Meridian Creative Director. Help craft vivid visual concepts, narratives, and production briefs.',
};

function pcmFloat32ToBase64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64PcmToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}

export function AssistantWorkspace() {
  const { user } = useAuth();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Welcome to Meridian Assistant. Ask anything, toggle Google Search or Maps grounding for live real-world data, transcribe audio notes, or start a real-time Live voice session.',
      modelUsed: 'gemini-4-hydrogen',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<ChatModel>('gemini-4-hydrogen');
  const [rolePreset, setRolePreset] = useState<string>('architect');
  const [customInstruction, setCustomInstruction] = useState(ROLE_PRESETS.architect);
  const [groundingMode, setGroundingMode] = useState<GroundingMode>('none');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  // Audio transcription state (gemini-3.5-transcribe)
  const [isRecordingClip, setIsRecordingClip] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Live API voice conversation state (gemini-3.8-live)
  const [liveActive, setLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [liveTranscripts, setLiveTranscripts] = useState<Array<{ speaker: string; text: string }>>([]);
  const [liveError, setLiveError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const stopLiveSession = useCallback(() => {
    try {
      processorRef.current?.disconnect();
      processorRef.current = null;
    } catch {}
    try {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    } catch {}
    try {
      inputAudioCtxRef.current?.close();
      inputAudioCtxRef.current = null;
    } catch {}
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {}
    });
    activeSourcesRef.current = [];
    try {
      outputAudioCtxRef.current?.close();
      outputAudioCtxRef.current = null;
    } catch {}
    try {
      wsRef.current?.close();
      wsRef.current = null;
    } catch {}
    nextPlayTimeRef.current = 0;
    setLiveActive(false);
    setLiveStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, [stopLiveSession]);

  const startLiveSession = async () => {
    setLiveError(null);
    setLiveStatus('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextPlayTimeRef.current = outputCtx.currentTime;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        setLiveStatus('connected');
        setLiveActive(true);

        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const channel = e.inputBuffer.getChannelData(0);
          const base64 = pcmFloat32ToBase64(channel);
          ws.send(JSON.stringify({ audio: base64 }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            setLiveError(msg.error);
            stopLiveSession();
            return;
          }
          if (msg.interrupted) {
            activeSourcesRef.current.forEach((s) => {
              try {
                s.stop();
              } catch {}
            });
            activeSourcesRef.current = [];
            if (outputAudioCtxRef.current) {
              nextPlayTimeRef.current = outputAudioCtxRef.current.currentTime;
            }
            return;
          }
          if (msg.inputTranscript) {
            setLiveTranscripts((prev) => [
              ...prev.slice(-19),
              { speaker: 'You', text: msg.inputTranscript },
            ]);
          }
          if (msg.outputTranscript) {
            setLiveTranscripts((prev) => [
              ...prev.slice(-19),
              { speaker: 'Meridian Voice', text: msg.outputTranscript },
            ]);
          }
          if (msg.audio && outputAudioCtxRef.current) {
            const ctx = outputAudioCtxRef.current;
            const samples = base64PcmToFloat32(msg.audio);
            const buffer = ctx.createBuffer(1, samples.length, 24000);
            buffer.copyToChannel(new Float32Array(samples), 0);
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.connect(ctx.destination);
            const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
            src.start(startAt);
            nextPlayTimeRef.current = startAt + buffer.duration;
            activeSourcesRef.current.push(src);
            src.onended = () => {
              activeSourcesRef.current = activeSourcesRef.current.filter((item) => item !== src);
            };
          }
        } catch {
          // Ignore malformed message
        }
      };

      ws.onerror = () => {
        setLiveError('Live WebSocket connection error.');
        stopLiveSession();
      };

      ws.onclose = () => {
        stopLiveSession();
      };
    } catch (err) {
      setLiveError(
        err instanceof Error ? err.message : 'Microphone access or Live connection failed.'
      );
      stopLiveSession();
    }
  };

  const getBrowserLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 3000 }
      );
    });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setChatError(null);
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setSending(true);

    try {
      const userLocation = groundingMode === 'maps' ? await getBrowserLocation() : null;
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({ role: m.role, text: m.text })),
          model,
          systemInstruction: customInstruction,
          groundingMode,
          userLocation,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Chat request failed.');
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'model',
          text: data.text || '(No response text returned)',
          modelUsed: data.modelUsed,
          sources: data.sources || [],
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleSaveNote = async (title: string, content: string, modelUsed: string, kind: 'research' | 'transcript') => {
    if (!user) {
      setSavedNotice('Sign in with Google in the top bar to save items to Firestore.');
      return;
    }
    try {
      await saveCreation({
        ownerId: user.uid,
        kind,
        title,
        content,
        modelUsed,
      });
      setSavedNotice('Saved to your Meridian Library.');
      setTimeout(() => setSavedNotice(null), 3000);
    } catch (err) {
      setSavedNotice(err instanceof Error ? err.message : 'Could not save to Firestore.');
    }
  };

  const transcribeBlob = async (blob: Blob) => {
    setTranscribing(true);
    setTranscribeError(null);
    try {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const audioBase64 = btoa(binary);
      const res = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: blob.type || 'audio/webm',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed.');
      setTranscriptText(data.text || '');
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Transcription error.');
    } finally {
      setTranscribing(false);
    }
  };

  const toggleMicRecording = async () => {
    setTranscribeError(null);
    if (isRecordingClip) {
      mediaRecorderRef.current?.stop();
      setIsRecordingClip(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        void transcribeBlob(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingClip(true);
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Microphone access denied.');
    }
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void transcribeBlob(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* Main Multi-turn Chat & Grounding Thread */}
      <section className="lg:col-span-8 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden min-h-[600px]">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
              <span>Model</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as ChatModel)}
                disabled={groundingMode !== 'none'}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
              >
                <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (General)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Fast)</option>
                <option value="gemini-4-argon">Gemini 4 Argon (Complex)</option>
                <option value="gemini-4-carbon">Gemini 4 Carbon (Deep Reasoning)</option>
              </select>
            </label>

            <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
              <span>Persona</span>
              <select
                value={rolePreset}
                onChange={(e) => {
                  const key = e.target.value;
                  setRolePreset(key);
                  if (ROLE_PRESETS[key]) setCustomInstruction(ROLE_PRESETS[key]);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <option value="architect">Technical Architect</option>
                <option value="researcher">Field Researcher</option>
                <option value="creative">Creative Director</option>
                <option value="custom">Custom Role</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setGroundingMode('none')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                groundingMode === 'none'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setGroundingMode('search')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                groundingMode === 'search'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Search
            </button>
            <button
              type="button"
              onClick={() => setGroundingMode('maps')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                groundingMode === 'maps'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Maps Data
            </button>
          </div>
        </div>

        {rolePreset === 'custom' && (
          <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50">
            <input
              type="text"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="Enter custom system instruction for the assistant..."
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </div>
        )}

        {/* Scrollable Message Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 max-h-[540px]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                <span className="font-medium text-slate-700">
                  {msg.role === 'user' ? 'You' : 'Meridian'}
                </span>
                {msg.modelUsed && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[11px]">{msg.modelUsed}</span>
                  </>
                )}
              </div>

              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-800'
                }`}
              >
                {msg.text}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                    <div className="text-xs font-semibold text-slate-700">
                      Grounded Sources
                    </div>
                    <ul className="space-y-1.5">
                      {msg.sources.map((src, idx) => (
                        <li key={`${src.uri}_${idx}`} className="text-xs">
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-700 hover:underline font-medium"
                          >
                            {src.type === 'maps' ? (
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{src.title}</span>
                          </a>
                          {src.reviewSnippets && src.reviewSnippets.length > 0 && (
                            <p className="text-slate-500 mt-0.5 pl-5">
                              {src.reviewSnippets[0]}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {msg.role === 'model' && msg.id !== 'welcome' && (
                <button
                  type="button"
                  onClick={() =>
                    handleSaveNote(
                      msg.text.slice(0, 64),
                      msg.text,
                      msg.modelUsed || model,
                      'research'
                    )
                  }
                  className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  Save to Library
                </button>
              )}
            </div>
          ))}

          {sending && (
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Generating response
                {groundingMode === 'search'
                  ? ' with Google Search grounding'
                  : groundingMode === 'maps'
                    ? ' with Google Maps grounding'
                    : ''}
                ...
              </span>
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {(chatError || savedNotice) && (
          <div className="px-5 py-2 border-t border-slate-200 bg-slate-50 text-xs flex items-center justify-between">
            <span className={chatError ? 'text-red-700' : 'text-emerald-700'}>
              {chatError || savedNotice}
            </span>
            <button
              type="button"
              onClick={() => {
                setChatError(null);
                setSavedNotice(null);
              }}
              className="text-slate-500 hover:text-slate-800"
            >
              Dismiss
            </button>
          </div>
        )}

        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-slate-200 bg-white flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              groundingMode === 'search'
                ? 'Ask a live web-grounded question...'
                : groundingMode === 'maps'
                  ? 'Ask about nearby places, neighborhoods, or routes...'
                  : 'Message Meridian Assistant...'
            }
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
          <button
            type="button"
            onClick={() => setMessages((prev) => prev.slice(0, 1))}
            title="Clear conversation"
            className="p-2.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </section>

      {/* Right Column: Live Voice Conversation + Audio Transcription */}
      <aside className="lg:col-span-4 flex flex-col gap-6">
        {/* Gemini 3.8 Live Real-Time Voice Conversation */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Live Voice Session</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time bidirectional voice · gemini-3.8-live
              </p>
            </div>
            <button
              type="button"
              onClick={liveActive ? stopLiveSession : startLiveSession}
              disabled={liveStatus === 'connecting'}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                liveActive
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-700 text-white hover:bg-blue-800'
              }`}
            >
              {liveActive ? (
                <>
                  <PhoneOff className="w-3.5 h-3.5" />
                  End Call
                </>
              ) : (
                <>
                  <PhoneCall className="w-3.5 h-3.5" />
                  {liveStatus === 'connecting' ? 'Connecting...' : 'Start Voice'}
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 min-h-[150px] max-h-[220px] overflow-y-auto space-y-2">
            {liveTranscripts.length === 0 ? (
              <p className="text-xs text-slate-500">
                {liveActive
                  ? 'Listening on 16kHz microphone stream. Speak naturally.'
                  : 'Start a Live session to talk with Meridian Voice in real time.'}
              </p>
            ) : (
              liveTranscripts.map((item, idx) => (
                <div key={idx} className="text-xs leading-relaxed">
                  <span className="font-semibold text-slate-800">{item.speaker}: </span>
                  <span className="text-slate-600">{item.text}</span>
                </div>
              ))
            )}
          </div>

          {liveError && <p className="text-xs text-red-700">{liveError}</p>}
        </div>

        {/* Gemini 3.5 Transcribe Audio */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Audio Transcription</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Microphone capture or file upload · gemini-3.5-transcribe
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={toggleMicRecording}
              disabled={transcribing}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                isRecordingClip
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {isRecordingClip ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  Stop & Transcribe
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  Record Audio
                </>
              )}
            </button>

            <label className="px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5" />
              Upload Clip
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {transcribing && (
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Transcribing audio with gemini-3.5-transcribe...</span>
            </div>
          )}

          {transcribeError && <p className="text-xs text-red-700">{transcribeError}</p>}

          <textarea
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            rows={5}
            placeholder="Transcribed speech will appear here..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!transcriptText.trim()}
              onClick={() => setInput((prev) => (prev ? `${prev} ${transcriptText}` : transcriptText))}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              Send to Chat
            </button>
            <button
              type="button"
              disabled={!transcriptText.trim()}
              onClick={() =>
                handleSaveNote(
                  `Transcript · ${new Date().toLocaleTimeString()}`,
                  transcriptText,
                  'gemini-3.5-transcribe',
                  'transcript'
                )
              }
              className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Bookmark className="w-3.5 h-3.5" />
              Save Transcript
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
