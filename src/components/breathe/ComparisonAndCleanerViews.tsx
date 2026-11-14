import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  Bookmark,
  Compass,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  Send,
  Trash2,
  Wind,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { savePinnedPlace } from '../../lib/firebase';
import {
  getCpcbTier,
  getTierColors,
  type PortalLang,
  type StationTelemetry,
} from '../../data/indiaStations';
import type { GroundingSource } from '../../types/studio';

const CITY_COLORS = ['#ba1a1a', '#006398', '#005d42', '#7c3aed'];

export function CityComparisonView({
  stations,
  lang,
}: {
  stations: StationTelemetry[];
  lang: PortalLang;
}) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([
    'DL-ANV-01',
    'MH-BND-04',
    'KA-BTM-02',
    'KL-MNR-01',
  ]);
  const [candidateCode, setCandidateCode] = useState<string>(
    stations[5]?.code || 'WB-VIC-01'
  );

  const compared = useMemo(
    () =>
      selectedCodes
        .map((c) => stations.find((s) => s.code === c))
        .filter((s): s is StationTelemetry => Boolean(s)),
    [selectedCodes, stations]
  );

  const handleAdd = () => {
    if (selectedCodes.includes(candidateCode) || selectedCodes.length >= 4) return;
    setSelectedCodes((prev) => [...prev, candidateCode]);
  };

  const handleRemove = (code: string) => {
    if (selectedCodes.length <= 2) return;
    setSelectedCodes((prev) => prev.filter((c) => c !== code));
  };

  const maxDiurnal = useMemo(() => {
    const vals = compared.flatMap((s) => s.hourlyPm25);
    return Math.max(80, ...vals);
  }, [compared]);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 pb-12 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">
            {lang === 'hi'
              ? 'शहर-दर-शहर वायु गुणवत्ता तुलना'
              : 'Multi-City Air Quality Comparison Matrix'}
          </h1>
          <p className="text-xs text-[#3e4943] mt-0.5">
            Benchmark up to 4 Indian CAAQMS stations side-by-side across CPCB NAQI, PM2.5, PM10, gaseous pollutants, and diurnal inversion curves.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={candidateCode}
            onChange={(e) => setCandidateCode(e.target.value)}
            className="bg-white border border-[#bdc9c1] rounded-lg px-3 py-2 text-xs text-[#0b1c30]"
          >
            {stations.map((s) => (
              <option key={s.code} value={s.code}>
                {s.city} ({s.aqi})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={selectedCodes.length >= 4 || selectedCodes.includes(candidateCode)}
            className="px-3.5 py-2 bg-[#005d42] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg disabled:opacity-45 inline-flex items-center gap-1 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add City ({compared.length}/4)
          </button>
        </div>
      </div>

      {/* Selected City Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {compared.map((st, idx) => {
          const tier = getCpcbTier(st.aqi);
          const colors = getTierColors(tier);
          return (
            <div
              key={st.code}
              className="bg-white rounded-xl border border-[#bdc9c1]/50 p-4 flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: CITY_COLORS[idx % CITY_COLORS.length] }}
                    />
                    <span className="text-xs font-mono text-[#6e7a73]">{st.code}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#0b1c30] mt-1">{st.city}</h3>
                  <div className="text-xs text-[#3e4943]">{st.locality}</div>
                </div>
                {compared.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemove(st.code)}
                    title="Remove city"
                    className="p-1 text-[#6e7a73] hover:text-[#ba1a1a]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-baseline justify-between pt-2 border-t border-[#eff4ff]">
                <span className={`text-3xl font-extrabold font-mono tabular-nums ${colors.textClass}`}>
                  {st.aqi}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${colors.badgeBg} ${colors.badgeText}`}>
                  {tier}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overlay Diurnal PM2.5 SVG Chart */}
      <div className="bg-white rounded-xl border border-[#bdc9c1]/50 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#0b1c30]">
              24-Hour PM2.5 Diurnal Dispersion Overlay (µg/m³)
            </h2>
            <p className="text-xs text-[#3e4943]">
              Direct hourly comparison highlighting morning inversion severity
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            {compared.map((st, idx) => (
              <span key={st.code} className="inline-flex items-center gap-1.5 text-[#0b1c30]">
                <span
                  className="w-3 h-0.5 inline-block"
                  style={{ backgroundColor: CITY_COLORS[idx % CITY_COLORS.length] }}
                />
                {st.city}
              </span>
            ))}
          </div>
        </div>

        <div className="h-56 bg-[#eff4ff] rounded-lg p-3">
          <svg className="w-full h-full" viewBox="0 0 800 180" preserveAspectRatio="none">
            {[30, 75, 120, 165].map((y) => (
              <line
                key={y}
                x1="0"
                x2="800"
                y1={y}
                y2={y}
                stroke="#bdc9c1"
                strokeDasharray="3 3"
                strokeOpacity="0.5"
              />
            ))}
            {compared.map((st, idx) => {
              const pts = st.hourlyPm25.map((v, i) => {
                const x = (i / Math.max(1, st.hourlyPm25.length - 1)) * 800;
                const y = 165 - (v / maxDiurnal) * 145;
                return `${x},${y}`;
              });
              return (
                <polyline
                  key={st.code}
                  fill="none"
                  stroke={CITY_COLORS[idx % CITY_COLORS.length]}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pts.join(' ')}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Multi-Metric Comparison Table */}
      <div className="bg-white rounded-xl border border-[#bdc9c1]/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#bdc9c1]/30">
          <h2 className="text-base font-bold text-[#0b1c30]">
            Side-by-Side Pollutant & Meteorology Table
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#eff4ff] text-[#6e7a73] uppercase text-[10px]">
                <th className="py-3 px-4">Metric</th>
                {compared.map((st) => (
                  <th key={st.code} className="py-3 px-4 text-right">
                    {st.city}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bdc9c1]/30 tabular-nums">
              {[
                { label: 'CPCB NAQI Score', fn: (s: StationTelemetry) => `${s.aqi} (${getCpcbTier(s.aqi)})` },
                { label: 'PM2.5 (µg/m³)', fn: (s: StationTelemetry) => `${s.pm25}` },
                { label: 'PM10 (µg/m³)', fn: (s: StationTelemetry) => `${s.pm10}` },
                { label: 'WHO PM2.5 Ratio (Std 15)', fn: (s: StationTelemetry) => `${(s.pm25 / 15).toFixed(1)}x` },
                { label: 'NO₂ (µg/m³)', fn: (s: StationTelemetry) => `${s.no2}` },
                { label: 'SO₂ (µg/m³)', fn: (s: StationTelemetry) => `${s.so2}` },
                { label: 'CO (mg/m³)', fn: (s: StationTelemetry) => `${s.co}` },
                { label: 'Ozone O₃ (µg/m³)', fn: (s: StationTelemetry) => `${s.o3}` },
                { label: 'Wind Dispersion (km/h)', fn: (s: StationTelemetry) => `${s.windKmh} km/h` },
                { label: 'Temp / Humidity', fn: (s: StationTelemetry) => `${s.tempC}°C · ${s.humidityPct}%` },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-[#eff4ff]/50">
                  <td className="py-2.5 px-4 font-semibold text-[#0b1c30]">{row.label}</td>
                  {compared.map((st) => (
                    <td key={st.code} className="py-2.5 px-4 text-right font-mono text-[#0b1c30]">
                      {row.fn(st)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function FindCleanerPlacesView({
  stations,
  lang,
  onInspectOnMap,
}: {
  stations: StationTelemetry[];
  lang: PortalLang;
  onInspectOnMap: (st: StationTelemetry) => void;
}) {
  const { user } = useAuth();
  const [originCode, setOriginCode] = useState<string>('DL-ANV-01');
  const [localQuery, setLocalQuery] = useState<string>(
    'Best low-pollution botanical parks, green sanctuaries, and weekend hill escapes nearby'
  );
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [groundingReply, setGroundingReply] = useState<string | null>(null);
  const [groundingNote, setGroundingNote] = useState<string | null>(null);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [groundingError, setGroundingError] = useState<string | null>(null);
  const [pinnedCode, setPinnedCode] = useState<string | null>(null);

  const originStation =
    stations.find((s) => s.code === originCode) || stations[0];

  const cleanEscapes = useMemo(() => {
    return stations
      .filter((s) => s.aqi <= 90)
      .sort((a, b) => a.aqi - b.aqi)
      .map((s) => ({
        station: s,
        improvementPct: Math.max(
          0,
          Math.round(((originStation.aqi - s.aqi) / Math.max(1, originStation.aqi)) * 100)
        ),
        aqiDrop: originStation.aqi - s.aqi,
      }));
  }, [stations, originStation]);

  const handleDiscoverCleanZones = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localQuery.trim() || groundingLoading) return;
    setGroundingLoading(true);
    setGroundingError(null);
    setGroundingNote(null);
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-4-hydrogen',
          groundingMode: 'maps',
          latLng: { lat: originStation.lat, lng: originStation.lng },
          messages: [
            {
              role: 'user',
              text: `Origin: ${originStation.city}, ${originStation.stateName}. ${localQuery}`,
            },
          ],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Maps grounding failed.');
      setGroundingReply(data.text || '');
      setGroundingNote(data.groundingNote || null);
      setGroundingSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (err) {
      setGroundingError(
        err instanceof Error ? err.message : 'Unable to discover cleaner spots.'
      );
    } finally {
      setGroundingLoading(false);
    }
  };

  const handlePinEscape = async (st: StationTelemetry) => {
    if (!user) return;
    await savePinnedPlace({
      ownerId: user.uid,
      placeId: st.code,
      name: `${st.city} Clean Air Escape (AQI ${st.aqi})`,
      address: `${st.locality}, ${st.stateName}`,
      lat: st.lat,
      lng: st.lng,
      note: `Clean air retreat · PM2.5 ${st.pm25} µg/m³`,
    });
    setPinnedCode(st.code);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 pb-12 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="bg-[#97f5cc] text-[#002115] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            Breathe Better Escapes
          </span>
          <h1 className="text-2xl font-bold text-[#0b1c30] mt-1">
            {lang === 'hi'
              ? 'स्वच्छ वायु गंतव्य व हरित क्षेत्र खोजें'
              : 'Find Cleaner Places & Low-AQI Sanctuaries'}
          </h1>
          <p className="text-xs text-[#3e4943] mt-0.5">
            Compare clean-air destinations across India against your current city and discover nearby parks via Google Maps Grounding.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#3e4943] font-semibold">Origin City:</span>
          <select
            value={originCode}
            onChange={(e) => setOriginCode(e.target.value)}
            className="bg-white border border-[#bdc9c1] rounded-lg px-3 py-2 text-xs font-semibold text-[#0b1c30]"
          >
            {stations.map((s) => (
              <option key={s.code} value={s.code}>
                {s.city} (AQI {s.aqi})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cleanest Destinations Grid */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cleanEscapes.map(({ station: st, improvementPct, aqiDrop }) => (
            <div
              key={st.code}
              className="bg-white rounded-xl border border-[#bdc9c1]/50 p-5 flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] text-[#005d42] font-bold">
                    {st.stateName}
                  </div>
                  <h3 className="text-base font-bold text-[#0b1c30]">{st.city}</h3>
                  <div className="text-xs text-[#3e4943]">{st.locality}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold font-mono tabular-nums text-[#005d42]">
                    {st.aqi}
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-[#97f5cc] text-[#002115] text-[10px] font-bold">
                    {getCpcbTier(st.aqi)}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#eff4ff] flex items-center justify-between text-xs tabular-nums">
                <span className="inline-flex items-center gap-1 text-[#005d42] font-semibold">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  {aqiDrop > 0 ? `-${aqiDrop} AQI (${improvementPct}% cleaner)` : 'Benchmark Zone'}
                </span>
                <span className="inline-flex items-center gap-1 text-[#3e4943]">
                  <Wind className="w-3.5 h-3.5 text-[#006398]" />
                  {st.windKmh} km/h
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onInspectOnMap(st)}
                  className="text-xs text-[#006398] font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  View on India Map
                </button>
                {user && (
                  <button
                    type="button"
                    onClick={() => void handlePinEscape(st)}
                    className="px-2.5 py-1 rounded bg-[#eff4ff] hover:bg-[#dce9ff] text-[#0b1c30] text-[11px] font-semibold inline-flex items-center gap-1"
                  >
                    <Bookmark className="w-3 h-3" />
                    {pinnedCode === st.code ? 'Pinned' : 'Save Escape'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Nearby Green Zones via Gemini Maps Grounding */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#bdc9c1]/50 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#005d42]" />
            <h2 className="text-sm font-bold text-[#0b1c30]">
              Discover Nearby Parks & Green Retreats ({originStation.city})
            </h2>
          </div>
          <p className="text-xs text-[#3e4943]">
            Powered by live Google Maps Grounding anchored near {originStation.city} ({originStation.lat.toFixed(2)}, {originStation.lng.toFixed(2)}).
          </p>

          <form onSubmit={handleDiscoverCleanZones} className="space-y-2">
            <textarea
              rows={2}
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              className="w-full px-3 py-2 bg-[#eff4ff] border border-[#bdc9c1]/60 rounded-lg text-xs text-[#0b1c30] focus:outline-none focus:border-[#005d42]"
            />
            <button
              type="submit"
              disabled={groundingLoading}
              className="w-full py-2.5 bg-[#005d42] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {groundingLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Find Grounded Green Spaces
            </button>
          </form>

          {groundingError && (
            <div className="p-2.5 rounded-lg bg-[#ffdad6] text-[#93000a] text-xs">
              {groundingError}
            </div>
          )}

          {groundingReply && (
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-lg bg-[#eff4ff] text-xs text-[#0b1c30] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {groundingReply}
              </div>
              {groundingNote && (
                <div className="text-[11px] text-[#3e4943] px-1">
                  {groundingNote}
                </div>
              )}
              {groundingSources.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {groundingSources.map((src, i) => (
                    <a
                      key={`${src.uri}-${i}`}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-[#bdc9c1]/50 hover:border-[#005d42] text-xs font-medium text-[#006398]"
                    >
                      <span className="truncate">{src.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
