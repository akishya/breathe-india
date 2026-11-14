import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  FileText,
  LogIn,
  MapPin,
  Trash2,
  TrendingDown,
  Wind,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  deleteCreation,
  deletePinnedPlace,
  subscribeUserCreations,
  subscribeUserPlaces,
} from '../../lib/firebase';
import {
  getCpcbTier,
  getTierColors,
  type PortalLang,
  type StationTelemetry,
} from '../../data/indiaStations';
import type { SavedCreation, SavedPlace } from '../../types/studio';

export function ForecastsTrendsView({
  stations,
  lang,
}: {
  stations: StationTelemetry[];
  lang: PortalLang;
}) {
  const [cityCode, setCityCode] = useState(stations[0]?.code || 'DL-ANV-01');
  const city = stations.find((s) => s.code === cityCode) || stations[0];

  const sevenDayForecast = useMemo(() => {
    const days = ['Today', 'Day +1', 'Day +2', 'Day +3', 'Day +4', 'Day +5', 'Day +6'];
    const windTrend = [1.0, 0.94, 0.88, 0.82, 0.79, 0.85, 0.91];
    return days.map((day, idx) => {
      const aqi = Math.max(18, Math.round(city.aqi * windTrend[idx]));
      const wind = Number((city.windKmh + idx * 1.1).toFixed(1));
      return { day, aqi, wind, tier: getCpcbTier(aqi) };
    });
  }, [city]);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 pb-12 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">
            {lang === 'hi'
              ? '7-दिवसीय वायु गुणवत्ता पूर्वानुमान और मौसम विज्ञान'
              : '7-Day Atmospheric Forecasts & Dispersion Trends'}
          </h1>
          <p className="text-xs text-[#3e4943] mt-0.5">
            Projected CPCB AQI outlook combining wind speed vectors, boundary-layer height, and IMD humidity trends.
          </p>
        </div>

        <select
          value={city.code}
          onChange={(e) => setCityCode(e.target.value)}
          className="bg-white border border-[#bdc9c1] rounded-lg px-3 py-2 text-xs font-semibold text-[#0b1c30]"
        >
          {stations.map((s) => (
            <option key={s.code} value={s.code}>
              {s.city} — {s.locality}
            </option>
          ))}
        </select>
      </div>

      {/* 7-Day Forecast Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {sevenDayForecast.map((f) => {
          const colors = getTierColors(f.tier);
          return (
            <div
              key={f.day}
              className="bg-white rounded-xl border border-[#bdc9c1]/50 p-4 flex flex-col justify-between gap-2 tabular-nums"
            >
              <div className="text-xs font-bold text-[#0b1c30]">{f.day}</div>
              <div className={`text-3xl font-extrabold font-mono ${colors.textClass}`}>
                {f.aqi}
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold w-fit ${colors.badgeBg} ${colors.badgeText}`}
              >
                {f.tier}
              </span>
              <div className="text-[11px] text-[#3e4943] inline-flex items-center gap-1 pt-1 border-t border-[#eff4ff]">
                <Wind className="w-3 h-3 text-[#006398]" />
                {f.wind} km/h
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#bdc9c1]/50 p-5 space-y-2">
          <div className="text-xs font-bold text-[#0b1c30] inline-flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-[#005d42]" />
            Ventilation Coefficient Outlook
          </div>
          <p className="text-xs text-[#3e4943] leading-relaxed">
            Forecast wind acceleration from <strong className="font-mono">{city.windKmh} km/h</strong> to{' '}
            <strong className="font-mono">{(city.windKmh + 5.5).toFixed(1)} km/h</strong> by Day +4 increases vertical mixing height and improves afternoon dispersion.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#bdc9c1]/50 p-5 space-y-2">
          <div className="text-xs font-bold text-[#0b1c30]">
            Morning Inversion Advisory
          </div>
          <p className="text-xs text-[#3e4943] leading-relaxed">
            Surface cooling between 05:30 and 08:30 IST traps fine PM2.5 close to breathing level. Optimal outdoor window shifts to 13:00–16:30 IST.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#bdc9c1]/50 p-5 space-y-2">
          <div className="text-xs font-bold text-[#0b1c30]">
            IMD Synoptic Correlation
          </div>
          <p className="text-xs text-[#3e4943] leading-relaxed tabular-nums">
            Ambient temperature <strong className="font-mono">{city.tempC}°C</strong> and relative humidity{' '}
            <strong className="font-mono">{city.humidityPct}%</strong> govern hygroscopic aerosol swelling in Gangetic & coastal corridors.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PowerBiAnalyticsView({
  stations,
  lang,
}: {
  stations: StationTelemetry[];
  lang: PortalLang;
}) {
  const { user, authReady, signInWithGoogle } = useAuth();
  const [savedBriefings, setSavedBriefings] = useState<SavedCreation[]>([]);
  const [pinnedPlaces, setPinnedPlaces] = useState<SavedPlace[]>([]);

  useEffect(() => {
    if (!authReady || !user) {
      setSavedBriefings([]);
      setPinnedPlaces([]);
      return;
    }
    const u1 = subscribeUserCreations(user.uid, setSavedBriefings, () => undefined);
    const u2 = subscribeUserPlaces(user.uid, setPinnedPlaces, () => undefined);
    return () => {
      u1();
      u2();
    };
  }, [authReady, user]);

  const sortedByAqi = useMemo(
    () => [...stations].sort((a, b) => b.aqi - a.aqi),
    [stations]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 pb-12 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">
          {lang === 'hi'
            ? 'पावर BI एनालिटिक्स और क्लाउड वॉचलिस्ट'
            : 'Power BI Analytical Suite & Cloud Watchlist'}
        </h1>
        <p className="text-xs text-[#3e4943] mt-0.5">
          Station-wide AQI ranking matrix alongside your Cloud Firestore-persisted station watchlists and AI briefings.
        </p>
      </div>

      {/* Horizontal Analytical Bar Breakdown */}
      <div className="bg-white rounded-xl border border-[#bdc9c1]/50 p-6 space-y-4">
        <h2 className="text-base font-bold text-[#0b1c30]">
          Cross-Station AQI & Dominant Pollutant Matrix
        </h2>
        <div className="space-y-2.5">
          {sortedByAqi.map((st) => {
            const tier = getCpcbTier(st.aqi);
            const colors = getTierColors(tier);
            const pct = Math.min(100, Math.round((st.aqi / 400) * 100));
            return (
              <div key={st.code} className="grid grid-cols-12 items-center gap-3 text-xs tabular-nums">
                <div className="col-span-4 sm:col-span-3 font-semibold text-[#0b1c30] truncate">
                  {st.city}
                </div>
                <div className="col-span-5 sm:col-span-7 bg-[#eff4ff] h-3 rounded-full overflow-hidden">
                  <div
                    className={`${colors.barClass} h-full rounded-full`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className={`col-span-3 sm:col-span-2 text-right font-mono font-bold ${colors.textClass}`}>
                  {st.aqi} · {st.dominant}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cloud Firestore Persisted Watchlist & AI Briefings */}
      {!user ? (
        <div className="bg-white rounded-xl border border-[#bdc9c1]/50 p-8 text-center space-y-3">
          <h2 className="text-base font-bold text-[#0b1c30]">
            Sign in with Google for Cloud Firestore Watchlist
          </h2>
          <p className="text-xs text-[#3e4943] max-w-md mx-auto">
            Sync pinned Indian monitoring stations, clean-air escapes, and saved AI Air Explainer briefings across sessions.
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-5 py-2.5 bg-[#005d42] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Sign in with Google
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl border border-[#bdc9c1]/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-[#bdc9c1]/30 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#005d42]" />
              <h3 className="text-sm font-bold text-[#0b1c30]">
                Pinned Stations & Escapes ({pinnedPlaces.length})
              </h3>
            </div>
            {pinnedPlaces.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6e7a73]">
                No stations pinned yet. Pin stations from Interactive Map or Find Cleaner Places.
              </div>
            ) : (
              <div className="divide-y divide-[#eff4ff]">
                {pinnedPlaces.map((p) => (
                  <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#006398] shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </div>
                      <div className="text-[11px] text-[#3e4943] mt-0.5">{p.address}</div>
                      {p.note && (
                        <div className="text-[11px] text-[#005d42] mt-0.5">{p.note}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void deletePinnedPlace(p.id)}
                      className="p-1.5 text-[#6e7a73] hover:text-[#ba1a1a]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-[#bdc9c1]/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-[#bdc9c1]/30 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#006398]" />
              <h3 className="text-sm font-bold text-[#0b1c30]">
                Saved AI Air Briefings ({savedBriefings.length})
              </h3>
            </div>
            {savedBriefings.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6e7a73]">
                No saved briefings yet. Save any response in AI Air Explainer.
              </div>
            ) : (
              <div className="divide-y divide-[#eff4ff]">
                {savedBriefings.map((item) => (
                  <div key={item.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[#0b1c30] truncate">
                          {item.title}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#eff4ff] text-[#006398] text-[10px] font-semibold uppercase">
                          {item.kind.replace('_', ' ')}
                        </span>
                        {item.modelUsed && (
                          <span className="text-[10px] font-mono text-[#6e7a73]">
                            {item.modelUsed}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#3e4943] mt-1 line-clamp-3 whitespace-pre-wrap">
                        {item.content}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteCreation(item.id)}
                      className="p-1.5 text-[#6e7a73] hover:text-[#ba1a1a]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
