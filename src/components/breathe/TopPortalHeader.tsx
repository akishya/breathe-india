import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Verified,
  X,
} from 'lucide-react';
import type { BrowserPermissionState } from '../../hooks/useAqiNotifications';
import { useAuth } from '../../contexts/AuthContext';
import {
  getCpcbTier,
  getTierColors,
  type PortalLang,
  type PortalTab,
  type StationTelemetry,
} from '../../data/indiaStations';

interface TopPortalHeaderProps {
  activeTab: PortalTab;
  onSelectTab: (tab: PortalTab) => void;
  lang: PortalLang;
  onToggleLang: (lang: PortalLang) => void;
  stations: StationTelemetry[];
  selectedCityCode: string;
  onSelectStation: (station: StationTelemetry) => void;
  alertCount: number;
  onOpenAlerts: () => void;
  lastSyncedLabel: string;
  mapsQuotaExceeded: boolean;
  onDismissQuotaBanner: () => void;
  focusedStation: StationTelemetry;
  notificationPermission: BrowserPermissionState;
  alertsEnabled: boolean;
  onRequestNotificationPermission: () => void;
  isSyncing: boolean;
  onRefreshNow: () => void;
}

const NAV_TABS: { id: PortalTab; en: string; hi: string; tag?: string }[] = [
  { id: 'overview', en: 'National Overview & Live AQI', hi: 'राष्ट्रीय अवलोकन व लाइव AQI' },
  { id: 'map', en: 'Interactive Map of India', hi: 'भारत का संवादात्मक मानचित्र' },
  { id: 'compare', en: 'City Comparison', hi: 'शहर तुलना' },
  { id: 'cleaner', en: 'Find Cleaner Places', hi: 'स्वच्छ स्थान खोजें', tag: 'Breathe Better' },
  { id: 'dispersion3d', en: '3D Dispersion Twin', hi: '3D प्रसार मॉडल' },
  { id: 'explainer', en: 'AI Air Explainer', hi: 'AI वायु विश्लेषक' },
  { id: 'visuals', en: 'Poster Studio', hi: 'पोस्टर स्टूडियो' },
  { id: 'health', en: 'Health & Safety Centre', hi: 'स्वास्थ्य व सुरक्षा केंद्र' },
  { id: 'forecasts', en: 'Forecasts & Trends', hi: 'पूर्वानुमान व रुझान' },
  { id: 'analytics', en: 'Power BI Analytics', hi: 'एनालिटिक्स व वॉचलिस्ट' },
];

export function TopPortalHeader({
  activeTab,
  onSelectTab,
  lang,
  onToggleLang,
  stations,
  onSelectStation,
  alertCount,
  onOpenAlerts,
  lastSyncedLabel,
  mapsQuotaExceeded,
  onDismissQuotaBanner,
  focusedStation,
  notificationPermission,
  alertsEnabled,
  onRequestNotificationPermission,
  isSyncing,
  onRefreshNow,
}: TopPortalHeaderProps) {
  const { user, authReady, signInWithGoogle, signOutUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const tickerCities = useMemo(() => {
    const order = ['DL-ANV-01', 'MH-BND-04', 'KA-BTM-02', 'MP-BPL-01', 'WB-VIC-01', 'JK-SGR-01'];
    return order
      .map((code) => stations.find((s) => s.code === code))
      .filter((s): s is StationTelemetry => Boolean(s));
  }, [stations]);

  const matchedStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return stations
      .filter(
        (s) =>
          s.city.toLowerCase().includes(q) ||
          s.locality.toLowerCase().includes(q) ||
          s.stateName.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [searchQuery, stations]);

  const handleChooseStation = (st: StationTelemetry) => {
    onSelectStation(st);
    setSearchQuery('');
    setSearchOpen(false);
  };

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-[#ffffff] shadow-[0_1px_8px_rgba(0,0,0,0.04)] no-print">
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs md:text-sm text-center flex items-center justify-center gap-3">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
          <button
            type="button"
            onClick={onDismissQuotaBanner}
            aria-label="Dismiss quota notice"
            className="text-amber-800 hover:text-amber-950 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Row 1: Institutional Brand + Live Ticker + Search + Lang + Alerts + Profile */}
      <div className="h-20 w-full px-4 lg:px-6 flex items-center justify-between gap-4 border-b border-[#bdc9c1]/40">
        <button
          type="button"
          onClick={() => onSelectTab('overview')}
          className="flex items-center gap-3 shrink-0 text-left focus:outline-none"
        >
          {/* Bespoke Breathe India SVG Emblem */}
          <svg
            viewBox="0 0 40 40"
            className="w-9 h-9 shrink-0"
            fill="none"
            aria-hidden="true"
          >
            <rect width="40" height="40" rx="8" fill="#eff4ff" />
            <path
              d="M11 26C11 17.5 18 11 28 11C28 21 21.5 28 13 28"
              stroke="#005d42"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 21C14 21 17 17.5 23 17.5"
              stroke="#006398"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="26.5" cy="14" r="2" fill="#047857" />
          </svg>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-bold text-[#005d42] tracking-tight whitespace-nowrap">
                Breathe India
              </span>
              <span className="bg-[#97f5cc] text-[#002115] text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold whitespace-nowrap">
                CPCB Verified
              </span>
            </div>
            <span className="text-xs text-[#3e4943] hidden lg:inline whitespace-nowrap">
              {lang === 'hi'
                ? 'राष्ट्रीय पर्यावरण बुद्धिमत्ता पोर्टल · पर्यावरण मंत्रालय एवं CPCB संबद्ध'
                : 'National Environmental Intelligence Portal · Ministry of Environment & CPCB Aligned'}
            </span>
          </div>
        </button>

        {/* Live AQI Ticker */}
        <div className="hidden xl:flex items-center bg-[#eff4ff] rounded-lg px-3.5 py-1.5 gap-3 overflow-hidden max-w-2xl border border-[#bdc9c1]/50">
          <span className="text-[10px] uppercase tracking-wider text-[#3e4943] font-bold shrink-0">
            Live AQI
          </span>
          <div className="flex items-center gap-4 text-xs font-medium text-[#0b1c30] whitespace-nowrap overflow-x-auto tabular-nums">
            {tickerCities.map((st) => {
              const tier = getCpcbTier(st.aqi);
              const colors = getTierColors(tier);
              return (
                <button
                  key={st.code}
                  type="button"
                  onClick={() => {
                    onSelectStation(st);
                    onSelectTab('map');
                  }}
                  className="inline-flex items-center gap-1 hover:underline cursor-pointer shrink-0"
                >
                  <span>{st.city.replace(' NCR', '')}:</span>
                  <strong className={colors.textClass}>
                    {st.aqi} {tier}
                  </strong>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Utility Cluster */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* City Search Input */}
          <div className="relative hidden md:block w-60 lg:w-68">
            <Search className="w-4 h-4 text-[#6e7a73] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder={
                lang === 'hi'
                  ? 'भारतीय शहर, जिला या स्टेशन खोजें...'
                  : 'Search Indian city, state, station...'
              }
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#eff4ff] text-[#0b1c30] placeholder:text-[#6e7a73] rounded-lg border border-[#bdc9c1]/60 focus:outline-none focus:border-[#006398] transition-colors"
            />
            {searchOpen && matchedStations.length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white border border-[#bdc9c1] rounded-lg shadow-lg z-50 divide-y divide-[#eff4ff] max-h-64 overflow-y-auto">
                {matchedStations.map((st) => {
                  const tier = getCpcbTier(st.aqi);
                  const colors = getTierColors(tier);
                  return (
                    <button
                      key={st.code}
                      type="button"
                      onMouseDown={() => handleChooseStation(st)}
                      className="w-full px-3 py-2 text-left hover:bg-[#eff4ff] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#0b1c30] truncate">
                          {st.city} — {st.locality}
                        </div>
                        <div className="text-[11px] text-[#6e7a73] truncate">
                          {st.stateName} · {st.code}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold tabular-nums shrink-0 ${colors.textClass}`}
                      >
                        {st.aqi}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bilingual EN / हिन्दी Switcher */}
          <div className="flex items-center bg-[#eff4ff] p-0.5 rounded-lg border border-[#bdc9c1]/60 text-xs">
            <button
              type="button"
              onClick={() => onToggleLang('en')}
              className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                lang === 'en'
                  ? 'bg-white text-[#005d42] font-bold shadow-xs'
                  : 'text-[#3e4943] hover:text-[#0b1c30]'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onToggleLang('hi')}
              className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                lang === 'hi'
                  ? 'bg-white text-[#005d42] font-bold shadow-xs'
                  : 'text-[#3e4943] hover:text-[#0b1c30]'
              }`}
            >
              हिन्दी
            </button>
          </div>

          {/* Browser AQI Shift Alert Quick Control */}
          <button
            type="button"
            onClick={() => {
              if (notificationPermission === 'default') {
                onRequestNotificationPermission();
              } else {
                onOpenAlerts();
              }
            }}
            title={
              notificationPermission === 'granted' && alertsEnabled
                ? `Browser notifications active for ${focusedStation.city}`
                : notificationPermission === 'denied'
                ? 'Browser notifications blocked in site settings (in-app alerts still active)'
                : 'Enable browser notifications for AQI worsening'
            }
            className={`relative flex items-center justify-center p-2 rounded-lg border text-xs transition-colors shrink-0 ${
              notificationPermission === 'granted' && alertsEnabled
                ? 'bg-[#eff4ff] border-[#005d42]/30 text-[#005d42] hover:bg-[#dce9ff]'
                : notificationPermission === 'denied' || !alertsEnabled
                ? 'bg-[#eff4ff] border-[#bdc9c1]/60 text-[#6e7a73] hover:text-[#0b1c30]'
                : 'bg-[#FFF7ED] border-[#FED7AA] text-[#9A3412] hover:bg-[#FFEDD5]'
            }`}
            aria-label="Browser AQI notification settings"
          >
            {!alertsEnabled || notificationPermission === 'denied' ? (
              <BellOff className="w-4 h-4" />
            ) : notificationPermission === 'granted' ? (
              <BellRing className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            <span
              className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                notificationPermission === 'granted' && alertsEnabled
                  ? 'bg-[#047857]'
                  : notificationPermission === 'default' && alertsEnabled
                  ? 'bg-[#EA580C]'
                  : 'bg-[#6e7a73]/50'
              }`}
            />
          </button>

          {/* Emergency Alerts Trigger */}
          <button
            type="button"
            onClick={onOpenAlerts}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#ffdad6] text-[#93000a] rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#ba1a1a]" />
            <span className="hidden sm:inline">{lang === 'hi' ? 'अलर्ट' : 'Alerts'}</span>
            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#ba1a1a] text-white text-[10px] font-bold tabular-nums">
              {alertCount}
            </span>
          </button>

          {/* Firebase Google Auth Account Chip */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#bdc9c1]/50 shrink-0">
            {!authReady ? (
              <span className="text-[11px] text-[#6e7a73]">...</span>
            ) : user ? (
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Officer profile'}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-[#005d42]/30"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#005d42] text-white text-xs font-bold flex items-center justify-center">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden 2xl:flex flex-col text-left">
                  <span className="text-xs font-bold text-[#0b1c30] leading-tight max-w-[120px] truncate">
                    {user.displayName || 'Studio Member'}
                  </span>
                  <span className="text-[10px] text-[#3e4943]">CPCB Watchlist</span>
                </div>
                <button
                  type="button"
                  onClick={signOutUser}
                  title="Sign out"
                  className="p-1.5 text-[#6e7a73] hover:text-[#0b1c30] rounded-md hover:bg-[#eff4ff]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-2.5 py-1.5 bg-[#005d42] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {lang === 'hi' ? 'साइन इन' : 'Sign In'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: 8 Navigation Tabs */}
      <nav className="h-12 w-full px-4 lg:px-6 flex items-center justify-between overflow-x-auto bg-white border-b border-[#bdc9c1]/30">
        <div className="flex items-center gap-1 shrink-0">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#047857] text-[#9ffdd3] font-semibold shadow-xs'
                    : 'text-[#3e4943] hover:text-[#0b1c30] hover:bg-[#eff4ff] font-medium'
                }`}
              >
                <span>{lang === 'hi' ? tab.hi : tab.en}</span>
                {tab.tag && (
                  <span className="bg-[#97f5cc] text-[#002115] text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">
                    {tab.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="hidden xl:flex items-center gap-3 pl-4 shrink-0 text-[11px] text-[#3e4943]">
          <span className="flex items-center gap-1 text-[#005d42] font-bold">
            <Verified className="w-3.5 h-3.5" />
            CPCB Validated
          </span>
          <span className="font-mono">ID: CAAQMS-IN-882</span>
        </div>
      </nav>

      {/* Row 3: Live Data Feed Strip */}
      <div className="h-8 w-full bg-[#eff4ff] px-4 lg:px-6 flex items-center justify-between text-[#3e4943] text-[11px] border-b border-[#bdc9c1]/30 overflow-hidden">
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-[#005d42]">LIVE DATA FEED:</span>
          <span>
            {lang === 'hi'
              ? 'केंद्रीय प्रदूषण नियंत्रण बोर्ड (CPCB) व SAFAR इंडिया से संबद्ध'
              : 'Synced with Central Pollution Control Board (CPCB) & SAFAR India'}
          </span>
          <span className="text-[#6e7a73]">·</span>
          <span className="tabular-nums">{lastSyncedLabel}</span>
          <span className="text-[#6e7a73] hidden sm:inline">·</span>
          <span className="hidden sm:inline font-semibold text-[#0b1c30] tabular-nums">
            482 Active Continuous Ambient Air Quality Stations (CAAQMS) Reporting
          </span>
        </div>
        <div className="hidden md:flex items-center gap-3 text-[#3e4943] shrink-0">
          <span className="hidden lg:inline text-[11px] font-medium text-[#0b1c30]">
            {lang === 'hi' ? 'निगरानी स्टेशन:' : 'Watching:'}{' '}
            <strong className="text-[#005d42]">{focusedStation.city}</strong> (
            {getCpcbTier(focusedStation.aqi)})
          </span>
          <button
            type="button"
            onClick={onRefreshNow}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 text-[#3e4943] hover:text-[#005d42] disabled:opacity-60 font-medium"
            title="Sync live atmospheric telemetry now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#005d42]' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Auto-refresh: 10m'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
