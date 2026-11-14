import React, { useEffect, useRef, useState } from 'react';
import {
  BookmarkPlus,
  ExternalLink,
  HeartPulse,
  Loader2,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { saveCreation } from '../../lib/firebase';
import {
  getCpcbTier,
  getTierColors,
  type PortalLang,
  type StationTelemetry,
} from '../../data/indiaStations';
import type { ChatMessage } from '../../types/studio';

const SUGGESTED_PROMPTS_EN = [
  'Why does Anand Vihar PM2.5 spike during early morning winter hours?',
  'What are the active GRAP Stage-III rules for Delhi NCR residents and commuters?',
  'Which mask filter (N95 vs FFP2) and indoor HEPA CADR is needed above AQI 300?',
  'What is the safest outdoor workout time window in Mumbai and Bengaluru today?',
];

const SUGGESTED_PROMPTS_HI = [
  'सुबह के समय दिल्ली NCR में PM2.5 क्यों बढ़ता है?',
  'GRAP स्टेज-III के तहत नागरिकों और वाहनों के लिए क्या नियम लागू हैं?',
  'AQI 300 से अधिक होने पर N95 मास्क और एयर प्यूरीफायर की सही सलाह दें।',
];

type GeminiChatModel =
  | 'gemini-4-hydrogen'
  | 'gemini-3.1-flash-lite'
  | 'gemini-4-argon'
  | 'gemini-4-carbon';

const MODEL_OPTIONS: { id: GeminiChatModel; label: string; badge: string }[] = [
  { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', badge: 'General + Search' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', badge: 'Fast Triage' },
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon', badge: 'Complex Interactive' },
  { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon', badge: 'Deep Reasoning' },
];

const ROLE_PRESETS = [
  {
    id: 'analyst',
    label: 'CPCB Policy Analyst',
    instruction:
      'Focus on CPCB NAQI sub-indices, CAQM GRAP Stages I-IV, emission inventories, and regulatory compliance.',
  },
  {
    id: 'health',
    label: 'Pulmonary Health Advisor',
    instruction:
      'Prioritize clinical exposure thresholds, N95/FFP2 seal guidance, indoor HEPA CADR sizing, and vulnerable-group safeguards.',
  },
  {
    id: 'scientist',
    label: 'Atmospheric Dispersion Scientist',
    instruction:
      'Explain planetary boundary layer depth, thermal inversions, wind-vector dispersion, and PM2.5/PM10 ratios.',
  },
  {
    id: 'citizen',
    label: 'Citizen Quick Guide',
    instruction:
      'Give concise, practical daily commute, school, and outdoor workout guidance for residents.',
  },
] as const;

export function AiAirExplainerView({
  stations,
  selectedStation,
  lang,
}: {
  stations: StationTelemetry[];
  selectedStation: StationTelemetry;
  lang: PortalLang;
}) {
  const { user } = useAuth();
  const [cityCode, setCityCode] = useState(selectedStation.code);
  const [modelId, setModelId] = useState<GeminiChatModel>('gemini-4-hydrogen');
  const [roleId, setRoleId] = useState<(typeof ROLE_PRESETS)[number]['id']>('analyst');
  const [useSearchGrounding, setUseSearchGrounding] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastFailedPaidError, setLastFailedPaidError] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCityCode(selectedStation.code);
  }, [selectedStation.code]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const activeCity =
    stations.find((s) => s.code === cityCode) || selectedStation;
  const activeRole =
    ROLE_PRESETS.find((r) => r.id === roleId) || ROLE_PRESETS[0];

  const sendPrompt = async (
    promptText: string,
    overrideModel?: GeminiChatModel,
    existingHistory?: ChatMessage[]
  ) => {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;

    const baseHistory = existingHistory ?? messages;
    const nextHistory = existingHistory
      ? baseHistory
      : [
          ...baseHistory,
          {
            id: `u_${Date.now()}`,
            role: 'user' as const,
            text: trimmed,
            timestamp: Date.now(),
          },
        ];
    if (!existingHistory) {
      setMessages(nextHistory);
      setInput('');
    }
    setLoading(true);
    setError(null);
    setLastFailedPaidError(false);

    const chosenModel = overrideModel ?? (useSearchGrounding ? 'gemini-4-hydrogen' : modelId);

    try {
      const langDirective =
        lang === 'hi'
          ? 'Respond in clear Hindi (Devanagari) with exact Indian CPCB AQI units.'
          : 'Respond concisely in structured English with exact CPCB/WHO benchmarks.';

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chosenModel,
          groundingMode: overrideModel ? 'none' : useSearchGrounding ? 'search' : 'none',
          systemInstruction: `You are Breathe India AI Air Explainer acting as a ${activeRole.label} (${activeRole.instruction}), aligned with CPCB, SAFAR India, and IMD environmental guidelines. Live telemetry context for ${activeCity.city} (${activeCity.locality}, ${activeCity.stateName}): CPCB AQI=${activeCity.aqi} (${getCpcbTier(activeCity.aqi)}), PM2.5=${activeCity.pm25} µg/m³, PM10=${activeCity.pm10} µg/m³, NO2=${activeCity.no2} µg/m³, Wind=${activeCity.windKmh} km/h, Temp=${activeCity.tempC}°C. ${langDirective}`,
          messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setLastFailedPaidError(Boolean(data.isPaidModelError));
        throw new Error(data.error || 'AI Explainer request failed.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'model',
          text: data.text || '',
          modelUsed: data.modelUsed,
          sources: data.sources,
          groundingNote: data.groundingNote,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI Air Explainer.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBriefing = async (msg: ChatMessage) => {
    if (!user) return;
    await saveCreation({
      ownerId: user.uid,
      kind: 'research',
      title: `AQI Briefing: ${activeCity.city} (AQI ${activeCity.aqi})`,
      content: msg.text,
      modelUsed: msg.modelUsed || 'gemini-4-hydrogen',
    });
    setSavedNotice(msg.id);
    setTimeout(() => setSavedNotice(null), 2200);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 pb-12 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#006398] font-bold">
            <Sparkles className="w-4 h-4" />
            <span>Gemini Grounded Atmospheric Explainer</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0b1c30] mt-0.5">
            {lang === 'hi'
              ? 'AI वायु विश्लेषक और CPCB सलाहकार'
              : 'AI Air Explainer & Dispersion Analyst'}
          </h1>
          <p className="text-xs text-[#3e4943] mt-0.5">
            Ask real-time questions about pollutant sources, thermal inversions, GRAP restrictions, and protective guidance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={activeCity.code}
            onChange={(e) => setCityCode(e.target.value)}
            className="bg-white border border-[#bdc9c1] rounded-lg px-3 py-2 text-xs font-semibold text-[#0b1c30]"
          >
            {stations.map((s) => (
              <option key={s.code} value={s.code}>
                Context: {s.city} (AQI {s.aqi})
              </option>
            ))}
          </select>

          <select
            aria-label="Gemini Model"
            value={modelId}
            onChange={(e) => {
              const nextModel = e.target.value as GeminiChatModel;
              setModelId(nextModel);
              if (nextModel !== 'gemini-4-hydrogen') {
                setUseSearchGrounding(false);
              }
            }}
            className="bg-white border border-[#bdc9c1] rounded-lg px-3 py-2 text-xs font-semibold text-[#0b1c30]"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} ({opt.badge})
              </option>
            ))}
          </select>

          <select
            aria-label="Analyst Role"
            value={roleId}
            onChange={(e) =>
              setRoleId(e.target.value as (typeof ROLE_PRESETS)[number]['id'])
            }
            className="bg-white border border-[#bdc9c1] rounded-lg px-3 py-2 text-xs font-semibold text-[#0b1c30]"
          >
            {ROLE_PRESETS.map((rp) => (
              <option key={rp.id} value={rp.id}>
                Role: {rp.label}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-[#bdc9c1] rounded-lg text-xs font-medium text-[#0b1c30] cursor-pointer">
            <input
              type="checkbox"
              checked={useSearchGrounding}
              onChange={(e) => {
                const checked = e.target.checked;
                setUseSearchGrounding(checked);
                if (checked) setModelId('gemini-4-hydrogen');
              }}
              className="accent-[#005d42]"
            />
            Google Search Grounding
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-[#bdc9c1]/50 p-5 space-y-3">
            <div className="text-xs font-bold text-[#0b1c30]">
              Active Telemetry Context
            </div>
            <div className="p-3.5 rounded-lg bg-[#eff4ff] space-y-1 tabular-nums">
              <div className="text-sm font-bold text-[#0b1c30]">
                {activeCity.city} — {activeCity.locality}
              </div>
              <div className="text-xs text-[#3e4943]">
                AQI {activeCity.aqi} ({getCpcbTier(activeCity.aqi)}) · PM2.5 {activeCity.pm25} µg/m³
              </div>
              <div className="text-[11px] text-[#6e7a73]">
                Wind {activeCity.windKmh} km/h · Temp {activeCity.tempC}°C · RH {activeCity.humidityPct}%
              </div>
            </div>

            <div className="text-xs font-bold text-[#0b1c30] pt-2">
              Quick Analyst Prompts
            </div>
            <div className="space-y-2">
              {(lang === 'hi' ? SUGGESTED_PROMPTS_HI : SUGGESTED_PROMPTS_EN).map(
                (q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void sendPrompt(q)}
                    className="w-full text-left p-2.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-xs text-[#0b1c30] transition-colors"
                  >
                    {q}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white rounded-xl border border-[#bdc9c1]/50 flex flex-col min-h-[520px] max-h-[680px]">
          <div className="px-5 py-3 border-b border-[#bdc9c1]/30 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#0b1c30]">
              {activeCity.city} · {activeRole.label}
            </span>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setError(null);
                  setLastFailedPaidError(false);
                }}
                className="text-[11px] font-semibold text-[#6e7a73] hover:text-[#ba1a1a] inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Chat
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 ? (
              <div className="py-20 text-center space-y-2">
                <Sparkles className="w-7 h-7 text-[#006398] mx-auto" />
                <h2 className="text-base font-bold text-[#0b1c30]">
                  Ask Breathe India AI
                </h2>
                <p className="text-xs text-[#3e4943] max-w-md mx-auto">
                  Select a suggested prompt or type any environmental, GRAP policy, or health question below.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#005d42] text-white'
                        : 'bg-[#eff4ff] text-[#0b1c30]'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>

                    {m.groundingNote && (
                      <div className="mt-2 pt-1.5 border-t border-[#bdc9c1]/40 text-[10px] text-[#3e4943]">
                        {m.groundingNote}
                      </div>
                    )}

                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-[#bdc9c1]/50 space-y-1">
                        <div className="text-[10px] font-bold text-[#3e4943]">
                          Verified Search Sources
                        </div>
                        {m.sources.map((src, i) => (
                          <a
                            key={`${src.uri}-${i}`}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-[#006398] hover:underline"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-3">
                    {m.role === 'model' && m.modelUsed && (
                      <span className="text-[10px] font-mono text-[#6e7a73]">
                        {m.modelUsed}
                      </span>
                    )}
                    {m.role === 'model' && user && (
                      <button
                        type="button"
                        onClick={() => void handleSaveBriefing(m)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#005d42] font-semibold hover:underline"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        {savedNotice === m.id ? 'Saved to Watchlist' : 'Save Briefing'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="inline-flex items-center gap-2 text-xs text-[#3e4943] bg-[#eff4ff] px-3.5 py-2 rounded-lg">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#006398]" />
                Analyzing CPCB telemetry & atmospheric intelligence...
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {error && (
            <div className="mx-5 mb-2 p-2.5 rounded-lg bg-[#ffdad6] text-[#93000a] text-xs flex flex-wrap items-center justify-between gap-2">
              <span>{error}</span>
              {lastFailedPaidError && messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setModelId('gemini-3.1-flash-lite');
                    setUseSearchGrounding(false);
                    const lastUser = [...messages]
                      .reverse()
                      .find((m) => m.role === 'user');
                    if (lastUser) {
                      void sendPrompt(lastUser.text, 'gemini-3.1-flash-lite', messages);
                    }
                  }}
                  className="px-2.5 py-1 rounded bg-[#93000a] text-white text-[11px] font-semibold hover:opacity-90 shrink-0"
                >
                  Retry with Flash-Lite
                </button>
              )}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendPrompt(input);
            }}
            className="p-4 border-t border-[#bdc9c1]/40 flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                lang === 'hi'
                  ? 'वायु गुणवत्ता या स्वास्थ्य सुरक्षा के बारे में पूछें...'
                  : 'Ask about local pollution spikes, GRAP advisories, or air filters...'
              }
              className="flex-1 px-3.5 py-2 bg-[#eff4ff] border border-[#bdc9c1]/60 rounded-lg text-xs text-[#0b1c30] focus:outline-none focus:border-[#005d42]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-[#005d42] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              Ask
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const GRAP_STAGES = [
  {
    stage: 'Stage I · Poor',
    range: 'AQI 201–300',
    actions: 'Mechanized road sweeping, anti-smog guns at construction sites, ban on open waste burning.',
  },
  {
    stage: 'Stage II · Very Poor',
    range: 'AQI 301–400',
    actions: 'Daily water sprinkling on arterial corridors, diesel generator restrictions, enhanced metro/bus frequency.',
  },
  {
    stage: 'Stage III · Severe',
    range: 'AQI 401–450',
    actions: 'Halt non-essential earthwork & demolition, BS-III petrol / BS-IV diesel restrictions, hybrid schooling for primary classes.',
  },
  {
    stage: 'Stage IV · Severe+',
    range: 'AQI > 450',
    actions: 'Entry curb on non-essential commercial trucks, 50% office WFH advisory, odd-even traffic trigger evaluation.',
  },
];

export function HealthSafetyCentreView({
  stations,
  lang,
}: {
  stations: StationTelemetry[];
  lang: PortalLang;
}) {
  const [cityCode, setCityCode] = useState(stations[0]?.code || 'DL-ANV-01');
  const [group, setGroup] = useState<'general' | 'sensitive' | 'children' | 'athletes'>('sensitive');

  const city = stations.find((s) => s.code === cityCode) || stations[0];
  const tier = getCpcbTier(city.aqi);
  const colors = getTierColors(tier);

  const guidance = (() => {
    if (city.aqi <= 100) {
      return {
        mask: 'Not Required outdoors',
        purifier: 'Optional ventilation',
        outdoor:
          group === 'athletes'
            ? 'Safe for full marathon & aerobic training.'
            : 'Safe for outdoor walks, cycling, and school sports.',
      };
    }
    if (city.aqi <= 200) {
      return {
        mask: group === 'sensitive' ? 'N95 / FFP2 during peak traffic' : 'Recommended along arterial roads',
        purifier: 'HEPA H13 indoors at night',
        outdoor:
          group === 'general'
            ? 'Moderate outdoor activity allowed; avoid peak 7–10 AM roadside commute.'
            : 'Reduce prolonged high-intensity cardio; prefer afternoon 1–4 PM dispersion window.',
      };
    }
    return {
      mask: 'Mandatory certified N95 / N99 / FFP2 respirator outdoors',
      purifier: 'Continuous True HEPA H13/H14 (CADR >= 400 m³/h) with sealed windows',
      outdoor:
        group === 'children' || group === 'sensitive'
          ? 'Avoid all outdoor exertion. Move physical education indoors and keep rescue inhalers accessible.'
          : 'Suspend outdoor cardio & morning runs. Limit essential transit time outdoors.',
    };
  })();

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 pb-12 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">
          {lang === 'hi'
            ? 'स्वास्थ्य सुरक्षा और GRAP कार्ययोजना केंद्र'
            : 'Citizen Health & Safety Protocol Centre'}
        </h1>
        <p className="text-xs text-[#3e4943] mt-0.5">
          Personalized exposure protocols mapped to India CPCB tiers and Graded Response Action Plan (GRAP) stages.
        </p>
      </div>

      {/* Interactive Risk Advisory Calculator */}
      <div className="bg-white rounded-xl border border-[#bdc9c1]/50 p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-[#ba1a1a]" />
            <h2 className="text-base font-bold text-[#0b1c30]">
              Personalized Exposure Protocol Generator
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={city.code}
              onChange={(e) => setCityCode(e.target.value)}
              className="bg-[#eff4ff] border border-[#bdc9c1] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0b1c30]"
            >
              {stations.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.city} (AQI {s.aqi})
                </option>
              ))}
            </select>

            <div className="flex items-center bg-[#eff4ff] p-1 rounded-lg gap-1">
              {(
                [
                  { id: 'general', label: 'General Public' },
                  { id: 'sensitive', label: 'Asthma / Elderly' },
                  { id: 'children', label: 'Children' },
                  { id: 'athletes', label: 'Runners' },
                ] as const
              ).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroup(g.id)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                    group === g.id
                      ? 'bg-white text-[#005d42] font-bold shadow-xs'
                      : 'text-[#3e4943]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#eff4ff] space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-[#6e7a73] font-bold">
              Active Tier ({city.city})
            </div>
            <div className={`text-2xl font-extrabold font-mono tabular-nums ${colors.textClass}`}>
              {city.aqi} · {tier}
            </div>
            <p className="text-xs text-[#3e4943]">{guidance.outdoor}</p>
          </div>

          <div className="p-4 rounded-xl bg-[#eff4ff] space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-[#6e7a73] font-bold">
              Respirator Mask Standard
            </div>
            <div className="text-sm font-bold text-[#0b1c30]">{guidance.mask}</div>
            <p className="text-xs text-[#3e4943]">
              Ensure tight nasal bridge seal; cloth & surgical masks do not filter PM2.5 particles.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#eff4ff] space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider text-[#6e7a73] font-bold">
              Indoor Air Filtration
            </div>
            <div className="text-sm font-bold text-[#0b1c30]">{guidance.purifier}</div>
            <p className="text-xs text-[#3e4943]">
              Avoid incense, indoor smoking, or dry sweeping during high-AQI episodes.
            </p>
          </div>
        </div>
      </div>

      {/* GRAP Stages Matrix */}
      <div className="bg-white rounded-xl border border-[#bdc9c1]/50 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#005d42]" />
          <h2 className="text-base font-bold text-[#0b1c30]">
            CAQM Graded Response Action Plan (GRAP) Stages I–IV
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {GRAP_STAGES.map((g) => (
            <div key={g.stage} className="p-4 rounded-xl bg-[#eff4ff] space-y-2">
              <div className="text-xs font-bold text-[#0b1c30]">{g.stage}</div>
              <div className="text-xs font-mono font-bold text-[#ba1a1a]">{g.range}</div>
              <p className="text-xs text-[#3e4943] leading-relaxed">{g.actions}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Helplines */}
      <div className="bg-white rounded-xl border border-[#bdc9c1]/50 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Phone className="w-5 h-5 text-[#005d42]" />
          <div>
            <div className="text-sm font-bold text-[#0b1c30]">
              National Citizen Helplines
            </div>
            <div className="text-xs text-[#3e4943]">
              Report illegal waste burning or seek immediate respiratory medical assistance.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs font-bold tabular-nums">
          <span className="text-[#005d42]">CPCB Helpline: 1800-11-CPCB</span>
          <span className="text-[#ba1a1a]">Emergency Asthma Hotline: 108</span>
        </div>
      </div>
    </div>
  );
}
