import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  BellRing,
  FlaskConical,
  RotateCcw,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AuthProvider } from './contexts/AuthContext';
import {
  AQI_TIER_RANK,
  BASELINE_INDIAN_STATIONS,
  NATIONAL_ALERTS,
  getCpcbTier,
  getTierColors,
  type PortalLang,
  type PortalTab,
  type StationTelemetry,
} from './data/indiaStations';
import { useAqiNotifications } from './hooks/useAqiNotifications';
import { TopPortalHeader } from './components/breathe/TopPortalHeader';
import { OverviewDashboard } from './components/breathe/OverviewDashboard';
import { IndiaMapView } from './components/breathe/IndiaMapView';
import {
  CityComparisonView,
  FindCleanerPlacesView,
} from './components/breathe/ComparisonAndCleanerViews';
import {
  AiAirExplainerView,
  HealthSafetyCentreView,
} from './components/breathe/ExplainerAndHealthViews';
import {
  ForecastsTrendsView,
  PowerBiAnalyticsView,
} from './components/breathe/ForecastsAndAnalyticsViews';
import { ThreeDispersionLabView } from './components/breathe/ThreeDispersionLabView';
import { VisualBulletinStudioView } from './components/breathe/VisualBulletinStudioView';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

function BreatheIndiaApp() {
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const [lang, setLang] = useState<PortalLang>('en');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [stations, setStations] = useState<StationTelemetry[]>(
    BASELINE_INDIAN_STATIONS
  );
  const [focusedStation, setFocusedStation] = useState<StationTelemetry>(
    BASELINE_INDIAN_STATIONS[0]
  );
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [lastSyncedLabel, setLastSyncedLabel] = useState('Live CPCB baseline');
  const [isSyncing, setIsSyncing] = useState(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [simulatedBackup, setSimulatedBackup] = useState<StationTelemetry | null>(null);

  const focusedStationRef = useRef(focusedStation);
  focusedStationRef.current = focusedStation;

  const {
    permission: notificationPermission,
    alertsEnabled,
    setAlertsEnabled,
    soundEnabled,
    setSoundEnabled,
    requestPermission,
    worseningAlerts,
    unreadCount,
    activeToast,
    dismissToast,
    markAllRead,
    clearHistory,
    markNextTransitionSimulated,
  } = useAqiNotifications({
    focusedStation,
    lang,
    onSelectAlertStation: (code) => {
      const found = stations.find((s) => s.code === code);
      if (found) setFocusedStation(found);
      setActiveTab('map');
    },
  });

  // Listen for Case A Google Maps Quota events
  useEffect(() => {
    const handler = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // Hydrate live Open-Meteo atmospheric & CPCB NAQI telemetry on mount and every 10m
  const syncLiveTelemetry = useCallback(async () => {
    setIsSyncing(true);
    try {
      const points = BASELINE_INDIAN_STATIONS.map((s) => ({
        code: s.code,
        lat: s.lat,
        lng: s.lng,
      }));
      const res = await fetch('/api/air-quality/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !Array.isArray(data.stations) || data.stations.length === 0) {
        return;
      }
      const byCode: Record<string, Record<string, unknown>> = {};
      for (const row of data.stations) {
        if (row && typeof row.code === 'string') {
          byCode[row.code] = row;
        }
      }
      const mergeLive = (st: StationTelemetry): StationTelemetry => {
        const live = byCode[st.code];
        if (!live) return st;
        return {
          ...st,
          aqi: typeof live.aqi === 'number' ? live.aqi : st.aqi,
          pm25: typeof live.pm25 === 'number' ? live.pm25 : st.pm25,
          pm10: typeof live.pm10 === 'number' ? live.pm10 : st.pm10,
          no2: typeof live.no2 === 'number' ? live.no2 : st.no2,
          so2: typeof live.so2 === 'number' ? live.so2 : st.so2,
          co: typeof live.co === 'number' ? live.co : st.co,
          o3: typeof live.o3 === 'number' ? live.o3 : st.o3,
          windKmh: typeof live.windKmh === 'number' ? live.windKmh : st.windKmh,
          tempC: typeof live.tempC === 'number' ? live.tempC : st.tempC,
          humidityPct:
            typeof live.humidityPct === 'number' ? live.humidityPct : st.humidityPct,
          hourlyPm25: Array.isArray(live.hourlyPm25)
            ? (live.hourlyPm25 as number[])
            : st.hourlyPm25,
          hourlyPm10: Array.isArray(live.hourlyPm10)
            ? (live.hourlyPm10 as number[])
            : st.hourlyPm10,
          updatedMinutesAgo: 1,
          source: 'live-telemetry',
        };
      };

      setStations((prev) => prev.map(mergeLive));
      setFocusedStation((curr) => (byCode[curr.code] ? mergeLive(curr) : curr));
      setSimulatedBackup(null);

      // If focused station is a custom Google Maps point, refresh it via /api/air-quality/point
      const currentFocused = focusedStationRef.current;
      if (!byCode[currentFocused.code]) {
        const ptRes = await fetch(
          `/api/air-quality/point?lat=${encodeURIComponent(currentFocused.lat)}&lng=${encodeURIComponent(currentFocused.lng)}`
        );
        if (ptRes.ok) {
          const pt = await ptRes.json();
          if (pt && typeof pt.aqi === 'number') {
            setFocusedStation((latest) =>
              latest.code === currentFocused.code
                ? {
                    ...latest,
                    aqi: pt.aqi,
                    pm25: typeof pt.pm25 === 'number' ? pt.pm25 : latest.pm25,
                    pm10: typeof pt.pm10 === 'number' ? pt.pm10 : latest.pm10,
                    no2: typeof pt.no2 === 'number' ? pt.no2 : latest.no2,
                    so2: typeof pt.so2 === 'number' ? pt.so2 : latest.so2,
                    co: typeof pt.co === 'number' ? pt.co : latest.co,
                    o3: typeof pt.o3 === 'number' ? pt.o3 : latest.o3,
                    windKmh: typeof pt.windKmh === 'number' ? pt.windKmh : latest.windKmh,
                    tempC: typeof pt.tempC === 'number' ? pt.tempC : latest.tempC,
                    humidityPct:
                      typeof pt.humidityPct === 'number'
                        ? pt.humidityPct
                        : latest.humidityPct,
                    updatedMinutesAgo: 1,
                    source: 'live-telemetry',
                  }
                : latest
            );
          }
        }
      }

      setLastSyncedLabel('Updated just now');
    } catch {
      // keep existing readings silently
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    void syncLiveTelemetry();
    const timer = window.setInterval(() => {
      void syncLiveTelemetry();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [syncLiveTelemetry]);

  const handleSelectStation = (st: StationTelemetry) => {
    setSimulatedBackup(null);
    setFocusedStation(st);
  };

  const handleInspectOnMap = (st: StationTelemetry) => {
    handleSelectStation(st);
    setActiveTab('map');
  };

  const handleOpenAlerts = () => {
    setAlertsOpen(true);
    markAllRead();
  };

  const handleSimulateWorsening = () => {
    const currentTier = getCpcbTier(focusedStation.aqi);
    const currentRank = AQI_TIER_RANK[currentTier];

    if (!simulatedBackup) {
      setSimulatedBackup(focusedStation);
    }

    // If station is already Very Poor / Severe, stage a Satisfactory -> Poor jump or step up to Severe
    const targetAqiByRank: Record<number, number> = {
      0: 84, // Good -> Satisfactory
      1: 232, // Satisfactory -> Poor (explicit prompt scenario)
      2: 248, // Moderate -> Poor
      3: 346, // Poor -> Very Poor
      4: 435, // Very Poor -> Severe
    };

    if (currentRank < 5) {
      const nextAqi = targetAqiByRank[currentRank] ?? 232;
      markNextTransitionSimulated();
      setFocusedStation((prev) => ({
        ...prev,
        aqi: nextAqi,
        pm25: Math.max(prev.pm25, Math.round(nextAqi * 0.52)),
        updatedMinutesAgo: 0,
      }));
      return;
    }

    // Already Severe: reset to Satisfactory first, then immediately step to Poor on next frame
    setFocusedStation((prev) => ({
      ...prev,
      aqi: 78,
      pm25: 34.5,
      updatedMinutesAgo: 0,
    }));
    window.setTimeout(() => {
      markNextTransitionSimulated();
      setFocusedStation((prev) => ({
        ...prev,
        aqi: 235,
        pm25: 108.4,
        updatedMinutesAgo: 0,
      }));
    }, 60);
  };

  const handleRestoreSimulatedStation = () => {
    if (!simulatedBackup) return;
    setFocusedStation(simulatedBackup);
    setSimulatedBackup(null);
  };

  const focusedTier = getCpcbTier(focusedStation.aqi);
  const focusedColors = getTierColors(focusedTier);

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff] text-[#0b1c30]">
      <TopPortalHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        lang={lang}
        onToggleLang={setLang}
        stations={stations}
        selectedCityCode={focusedStation.code}
        onSelectStation={(st) => {
          handleSelectStation(st);
          setActiveTab('map');
        }}
        alertCount={NATIONAL_ALERTS.length + unreadCount}
        onOpenAlerts={handleOpenAlerts}
        lastSyncedLabel={lastSyncedLabel}
        mapsQuotaExceeded={mapsQuotaExceeded}
        onDismissQuotaBanner={() => setMapsQuotaExceeded(false)}
        focusedStation={focusedStation}
        notificationPermission={notificationPermission}
        alertsEnabled={alertsEnabled}
        onRequestNotificationPermission={() => {
          void requestPermission();
        }}
        isSyncing={isSyncing}
        onRefreshNow={() => {
          void syncLiveTelemetry();
        }}
      />

      {/* In-App Floating AQI Worsening Alert Toast */}
      {activeToast && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-md bg-white rounded-xl shadow-2xl border border-[#ba1a1a]/30 border-l-4 border-l-[#ba1a1a] p-4 space-y-2.5 no-print"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#ffdad6] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#93000a] uppercase tracking-wider">
                    {lang === 'hi' ? 'वायु श्रेणी में गिरावट' : 'AQI Category Worsened'}
                  </span>
                  {activeToast.isSimulated && (
                    <span className="px-1.5 py-0.5 rounded bg-[#eff4ff] text-[#006398] text-[9px] font-bold uppercase">
                      Test
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-[#0b1c30]">
                  {activeToast.city} · {activeToast.locality}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissToast}
              aria-label="Dismiss notification"
              className="p-1 text-[#6e7a73] hover:text-[#0b1c30]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#ffdad6]/35 text-xs font-semibold tabular-nums">
            <span className="text-[#3e4943]">
              {activeToast.prevTier} ({activeToast.prevAqi})
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-[#ba1a1a]" />
            <span className="text-[#93000a] font-bold">
              {activeToast.newTier} ({activeToast.newAqi})
            </span>
          </div>

          <p className="text-[11px] text-[#3e4943] leading-relaxed">
            {lang === 'hi'
              ? 'संवेदनशील समूह बाहरी व्यायाम सीमित करें और N95/FFP2 मास्क का उपयोग करें।'
              : 'Minimize prolonged outdoor exertion and switch to N95/FFP2 filtration if stepping out.'}
          </p>

          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('explainer');
                dismissToast();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[#005d42] text-[11px] font-semibold inline-flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              {lang === 'hi' ? 'AI से कारण पूछें' : 'Ask AI Why'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('map');
                dismissToast();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[#ba1a1a] hover:bg-[#93000a] text-white text-[11px] font-semibold"
            >
              {lang === 'hi' ? 'स्टेशन देखें' : 'Inspect Station'}
            </button>
          </div>
        </div>
      )}

      {/* Alerts & Notification Preferences Slide-Over Drawer */}
      {alertsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end no-print">
          <div
            className="fixed inset-0 bg-[#0b1c30]/40"
            onClick={() => setAlertsOpen(false)}
          />
          <aside className="relative z-10 w-full max-w-md bg-white h-full shadow-xl border-l border-[#bdc9c1] flex flex-col">
            <div className="px-5 py-4 border-b border-[#bdc9c1]/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#ba1a1a]" />
                <h2 className="text-base font-bold text-[#0b1c30]">
                  {lang === 'hi' ? 'वायु अलर्ट एवं ब्राउज़र सूचनाएं' : 'Air Alerts & Browser Notifications'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAlertsOpen(false)}
                className="p-1.5 text-[#6e7a73] hover:text-[#0b1c30]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* Browser Notification Settings Card */}
              <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#bdc9c1]/60 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#005d42]">
                      {lang === 'hi' ? 'निगरानी स्टेशन' : 'Watched Focused Station'}
                    </span>
                    <div className="text-sm font-bold text-[#0b1c30]">
                      {focusedStation.city} · {focusedStation.locality}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold tabular-nums ${focusedColors.badgeBg} ${focusedColors.badgeText}`}
                  >
                    {focusedStation.aqi} · {focusedTier}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#bdc9c1]/40 text-xs">
                  <span className="text-[#3e4943]">
                    {lang === 'hi' ? 'ब्राउज़र सूचना अनुमति:' : 'Browser Permission:'}
                  </span>
                  {notificationPermission === 'granted' ? (
                    <span className="inline-flex items-center gap-1 text-[#005d42] font-bold">
                      <BellRing className="w-3.5 h-3.5" />
                      Allowed
                    </span>
                  ) : notificationPermission === 'denied' ? (
                    <span className="inline-flex items-center gap-1 text-[#ba1a1a] font-semibold">
                      <BellOff className="w-3.5 h-3.5" />
                      Blocked (In-app active)
                    </span>
                  ) : notificationPermission === 'unsupported' ? (
                    <span className="text-[#6e7a73] font-medium">
                      In-app only
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void requestPermission()}
                      className="px-2.5 py-1 rounded-lg bg-[#005d42] hover:bg-[#047857] text-white text-[11px] font-semibold inline-flex items-center gap-1"
                    >
                      <Bell className="w-3 h-3" />
                      Enable Browser Alerts
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setAlertsEnabled(!alertsEnabled)}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg border font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                      alertsEnabled
                        ? 'bg-white border-[#005d42]/40 text-[#005d42]'
                        : 'bg-white/60 border-[#bdc9c1] text-[#6e7a73]'
                    }`}
                  >
                    {alertsEnabled ? (
                      <BellRing className="w-3.5 h-3.5" />
                    ) : (
                      <BellOff className="w-3.5 h-3.5" />
                    )}
                    {alertsEnabled ? 'Alerts Active' : 'Alerts Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg border font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                      soundEnabled
                        ? 'bg-white border-[#006398]/40 text-[#006398]'
                        : 'bg-white/60 border-[#bdc9c1] text-[#6e7a73]'
                    }`}
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5" />
                    )}
                    {soundEnabled ? 'Sound On' : 'Muted'}
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSimulateWorsening}
                    className="flex-1 py-2 px-3 rounded-lg bg-[#006398] hover:bg-[#004c75] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    {lang === 'hi'
                      ? 'श्रेणी गिरावट परीक्षण करें'
                      : 'Simulate Worsening Shift'}
                  </button>
                  {simulatedBackup && (
                    <button
                      type="button"
                      onClick={handleRestoreSimulatedStation}
                      className="py-2 px-2.5 rounded-lg bg-white border border-[#bdc9c1] hover:border-[#005d42] text-[#0b1c30] text-xs font-semibold inline-flex items-center gap-1"
                      title="Restore live station telemetry"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore
                    </button>
                  )}
                </div>
              </div>

              {/* Station Category Worsening Log */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#3e4943]">
                    {lang === 'hi'
                      ? 'स्टेशन श्रेणी गिरावट लॉग'
                      : `Station Shift Alerts (${worseningAlerts.length})`}
                  </h3>
                  {worseningAlerts.length > 0 && (
                    <button
                      type="button"
                      onClick={clearHistory}
                      className="text-[11px] text-[#6e7a73] hover:text-[#ba1a1a] inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                </div>

                {worseningAlerts.length === 0 ? (
                  <p className="text-xs text-[#6e7a73] bg-[#f8f9ff] border border-[#bdc9c1]/40 rounded-lg p-3">
                    No category worsening transitions recorded yet for your focused stations. You will be alerted automatically if the focused station shifts into a worse CPCB AQI tier.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {worseningAlerts.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-[#ffdad6]/25 border border-[#ba1a1a]/25 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#0b1c30]">
                            {item.city} ({item.locality})
                          </span>
                          <span className="text-[10px] text-[#6e7a73] tabular-nums">
                            {new Date(item.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">
                          <span className="inline-flex items-center gap-1.5 text-[#93000a]">
                            <span>
                              {item.prevTier} ({item.prevAqi})
                            </span>
                            <ArrowRight className="w-3 h-3" />
                            <span className="font-bold">
                              {item.newTier} ({item.newAqi})
                            </span>
                          </span>
                          {item.isSimulated && (
                            <span className="px-1.5 py-0.5 rounded bg-[#eff4ff] text-[#006398] text-[9px] font-bold uppercase">
                              Test
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active National Air Alerts */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#3e4943]">
                  {lang === 'hi' ? 'सक्रिय राष्ट्रीय वायु अलर्ट' : 'Active National Advisories'}
                </h3>
                {NATIONAL_ALERTS.map((al) => (
                  <div
                    key={al.id}
                    className="p-4 rounded-xl bg-[#ffdad6]/40 border border-[#ba1a1a]/30 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#0b1c30]">{al.city}</span>
                      <span className="px-2 py-0.5 rounded bg-[#ba1a1a] text-white text-[10px] font-bold tabular-nums">
                        AQI {al.aqi} · {al.grapStage}
                      </span>
                    </div>
                    <p className="text-xs text-[#3e4943] leading-relaxed">
                      {lang === 'hi' ? al.advisoryHi : al.advisory}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 w-full">
        {activeTab === 'overview' && (
          <OverviewDashboard
            stations={stations}
            selectedState={selectedState}
            onChangeState={setSelectedState}
            lang={lang}
            onNavigate={setActiveTab}
            onInspectStationOnMap={handleInspectOnMap}
          />
        )}
        {activeTab === 'map' && (
          <IndiaMapView
            stations={stations}
            focusedStation={focusedStation}
            onSelectStation={handleSelectStation}
            onNavigate={setActiveTab}
            lang={lang}
          />
        )}
        {activeTab === 'compare' && (
          <CityComparisonView stations={stations} lang={lang} />
        )}
        {activeTab === 'cleaner' && (
          <FindCleanerPlacesView
            stations={stations}
            lang={lang}
            onInspectOnMap={handleInspectOnMap}
          />
        )}
        {activeTab === 'dispersion3d' && (
          <ThreeDispersionLabView
            stations={stations}
            focusedStation={focusedStation}
            onSelectStation={handleSelectStation}
            lang={lang}
          />
        )}
        {activeTab === 'explainer' && (
          <AiAirExplainerView
            stations={stations}
            selectedStation={focusedStation}
            lang={lang}
          />
        )}
        {activeTab === 'visuals' && (
          <VisualBulletinStudioView
            stations={stations}
            focusedStation={focusedStation}
            lang={lang}
          />
        )}
        {activeTab === 'health' && (
          <HealthSafetyCentreView stations={stations} lang={lang} />
        )}
        {activeTab === 'forecasts' && (
          <ForecastsTrendsView stations={stations} lang={lang} />
        )}
        {activeTab === 'analytics' && (
          <PowerBiAnalyticsView stations={stations} lang={lang} />
        )}
      </main>

      {/* Institutional Portal Footer */}
      <footer className="w-full bg-[#eff4ff] text-[#0b1c30] border-t border-[#bdc9c1]/40 mt-8 no-print">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-6 border-b border-[#bdc9c1]/40">
            <div className="md:col-span-2 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#005d42]">Breathe India</span>
                <span className="text-[10px] bg-[#dce9ff] text-[#0b1c30] px-1.5 py-0.5 rounded font-semibold">
                  NATIONAL ENVIRONMENTAL PORTAL
                </span>
              </div>
              <p className="text-xs text-[#3e4943] leading-relaxed max-w-xl">
                National Environmental Air Intelligence Portal aligned with CPCB, SAFAR India, IMD, and Ministry of Environment guidelines. Empowers citizens, researchers, and municipal teams with verified dispersion telemetry.
              </p>
              <div className="flex flex-wrap items-center gap-5 pt-1 text-xs font-semibold tabular-nums">
                <div>
                  <span className="text-[#3e4943] font-normal">National Helpline: </span>
                  <span className="text-[#005d42] font-bold">1800-11-CPCB</span>
                </div>
                <div>
                  <span className="text-[#3e4943] font-normal">Emergency Asthma Hotline: </span>
                  <span className="text-[#ba1a1a] font-bold">108</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <span className="font-bold uppercase tracking-wider text-[11px] mb-1">
                Portals & Registry
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="text-left text-[#3e4943] hover:text-[#005d42]"
              >
                CAAQMS Station Registry
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('compare')}
                className="text-left text-[#3e4943] hover:text-[#005d42]"
              >
                City Comparison Matrix
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className="text-left text-[#3e4943] hover:text-[#005d42]"
              >
                Power BI Analytics Suite
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('cleaner')}
                className="text-left text-[#3e4943] hover:text-[#005d42]"
              >
                Clean Air Escapes
              </button>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <span className="font-bold uppercase tracking-wider text-[11px] mb-1">
                Intelligence & Safety
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className="text-left text-[#3e4943] hover:text-[#005d42]"
              >
                Interactive India Map
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dispersion3d')}
                className="text-left text-[#3e4943] hover:text-[#005d42]"
              >
                3D Dispersion Twin
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('explainer')}
                className="text-left text-[#3e4943] hover:text-[#005d42]"
              >
                AI Air Explainer
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('visuals')}
                className="text-left text-[#3e4943] hover:text-[#005d42]"
              >
                Visual Poster Studio
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('health')}
                className="text-left text-[#3e4943] hover:text-[#005d42]"
              >
                Health & GRAP Guidelines
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('forecasts')}
                className="text-left text-[#3e4943] hover:text-[#005d42]"
              >
                7-Day Dispersion Forecasts
              </button>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#3e4943]">
            <p>
              Data sourced from CPCB, SAFAR India, IMD & live atmospheric telemetry. For clinical advice, consult qualified medical specialists.
            </p>
            <p className="shrink-0 font-semibold">
              Breathe India · CPCB & SAFAR Aligned
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BreatheIndiaApp />
    </AuthProvider>
  );
}
