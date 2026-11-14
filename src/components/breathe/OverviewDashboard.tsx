import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  History,
  Leaf,
  Radio,
  ShieldAlert,
  Thermometer,
  Verified,
} from 'lucide-react';
import {
  INDIAN_STATES,
  getCpcbTier,
  getTierColors,
  type AqiTier,
  type PollutantFocus,
  type PortalLang,
  type PortalTab,
  type StationTelemetry,
  type TimeWindow,
} from '../../data/indiaStations';

interface OverviewDashboardProps {
  stations: StationTelemetry[];
  selectedState: string;
  onChangeState: (code: string) => void;
  lang: PortalLang;
  onNavigate: (tab: PortalTab) => void;
  onInspectStationOnMap: (st: StationTelemetry) => void;
}

const TIME_WINDOWS: { id: TimeWindow; label: string; factor: number }[] = [
  { id: 'live', label: 'Live Now', factor: 1.0 },
  { id: '24h', label: '24 Hours', factor: 0.96 },
  { id: '7d', label: '7 Days', factor: 0.91 },
  { id: '30d', label: '30 Days Trend', factor: 0.87 },
];

const POLLUTANTS: { id: PollutantFocus; label: string }[] = [
  { id: 'aqi', label: 'Overall AQI' },
  { id: 'pm25', label: 'PM2.5' },
  { id: 'pm10', label: 'PM10' },
  { id: 'no2', label: 'NO₂' },
  { id: 'so2', label: 'SO₂' },
  { id: 'co', label: 'CO' },
  { id: 'o3', label: 'Ozone (O₃)' },
];

const HOUR_LABELS = [
  '00:00',
  '03:00',
  '06:00 (Rush)',
  '09:00',
  '12:00',
  '15:00 (Solar Max)',
  '18:00',
  '21:00',
  '23:59',
];

export function OverviewDashboard({
  stations,
  selectedState,
  onChangeState,
  lang,
  onNavigate,
  onInspectStationOnMap,
}: OverviewDashboardProps) {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('live');
  const [pollutantFocus, setPollutantFocus] = useState<PollutantFocus>('aqi');
  const [tierFilter, setTierFilter] = useState<AqiTier | 'ALL'>('ALL');
  const [showStationLog, setShowStationLog] = useState(true);
  const [tablePage, setTablePage] = useState(1);
  const [csvNotice, setCsvNotice] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const windowFactor =
    TIME_WINDOWS.find((w) => w.id === timeWindow)?.factor ?? 1.0;

  const filteredStations = useMemo(() => {
    const base =
      selectedState === 'all'
        ? stations
        : stations.filter((s) => s.stateCode === selectedState);
    const list = base.length > 0 ? base : stations;
    if (tierFilter === 'ALL') return list;
    const byTier = list.filter((s) => getCpcbTier(s.aqi) === tierFilter);
    return byTier.length > 0 ? byTier : list;
  }, [stations, selectedState, tierFilter]);

  const metrics = useMemo(() => {
    const list = filteredStations;
    const avgAqi = Math.round(
      (list.reduce((acc, s) => acc + s.aqi, 0) / list.length) * windowFactor
    );
    const sortedDesc = [...list].sort((a, b) => b.aqi - a.aqi);
    const sortedAsc = [...list].sort((a, b) => a.aqi - b.aqi);
    const hotspot = sortedDesc[0] || stations[0];
    const cleanest = sortedAsc[0] || stations[stations.length - 1];

    const avgPm25 = Number(
      ((list.reduce((acc, s) => acc + s.pm25, 0) / list.length) * windowFactor).toFixed(1)
    );
    const avgPm10 = Number(
      ((list.reduce((acc, s) => acc + s.pm10, 0) / list.length) * windowFactor).toFixed(1)
    );
    const avgNo2 = Number(
      ((list.reduce((acc, s) => acc + s.no2, 0) / list.length) * windowFactor).toFixed(1)
    );
    const avgSo2 = Number(
      ((list.reduce((acc, s) => acc + s.so2, 0) / list.length) * windowFactor).toFixed(1)
    );
    const avgCo = Number(
      ((list.reduce((acc, s) => acc + s.co, 0) / list.length) * windowFactor).toFixed(2)
    );
    const avgO3 = Number(
      ((list.reduce((acc, s) => acc + s.o3, 0) / list.length) * windowFactor).toFixed(1)
    );
    const avgWind = Number(
      (list.reduce((acc, s) => acc + s.windKmh, 0) / list.length).toFixed(1)
    );
    const avgTemp = Math.round(
      list.reduce((acc, s) => acc + s.tempC, 0) / list.length
    );
    const avgHum = Math.round(
      list.reduce((acc, s) => acc + s.humidityPct, 0) / list.length
    );

    const hourlyPm25 = HOUR_LABELS.map((_, idx) =>
      Math.round(
        (list.reduce((acc, s) => acc + (s.hourlyPm25[idx] ?? s.pm25), 0) /
          list.length) *
          windowFactor *
          10
      ) / 10
    );
    const hourlyPm10 = HOUR_LABELS.map((_, idx) =>
      Math.round(
        (list.reduce((acc, s) => acc + (s.hourlyPm10[idx] ?? s.pm10), 0) /
          list.length) *
          windowFactor *
          10
      ) / 10
    );

    // National 482 station tier scaling based on live ratio
    const totalCount = stations.length;
    const counts = {
      Good: stations.filter((s) => getCpcbTier(s.aqi) === 'Good').length,
      Satisfactory: stations.filter((s) => getCpcbTier(s.aqi) === 'Satisfactory').length,
      Moderate: stations.filter((s) => getCpcbTier(s.aqi) === 'Moderate').length,
      Poor: stations.filter((s) => getCpcbTier(s.aqi) === 'Poor').length,
      'Very Poor': stations.filter((s) => getCpcbTier(s.aqi) === 'Very Poor').length,
      Severe: stations.filter((s) => getCpcbTier(s.aqi) === 'Severe').length,
    };

    const pct = (n: number) => Math.max(2, Math.round((n / totalCount) * 100));

    return {
      avgAqi,
      hotspot,
      cleanest,
      avgPm25,
      avgPm10,
      avgNo2,
      avgSo2,
      avgCo,
      avgO3,
      avgWind,
      avgTemp,
      avgHum,
      hourlyPm25,
      hourlyPm10,
      counts,
      pct,
    };
  }, [filteredStations, stations, windowFactor]);

  const topPolluted = useMemo(
    () => [...stations].sort((a, b) => b.aqi - a.aqi).slice(0, 5),
    [stations]
  );
  const topCleanest = useMemo(
    () => [...stations].sort((a, b) => a.aqi - b.aqi).slice(0, 5),
    [stations]
  );

  // Build SVG path for 9 diurnal points on viewBox 0..800 x 0..220
  const chartGeometry = useMemo(() => {
    const maxVal = Math.max(
      140,
      ...metrics.hourlyPm10,
      ...metrics.hourlyPm25
    );
    const toPt = (val: number, i: number) => {
      const x = (i / (HOUR_LABELS.length - 1)) * 800;
      const y = 195 - (val / maxVal) * 165;
      return { x, y };
    };
    const buildSmooth = (vals: number[]) => {
      const pts = vals.map((v, i) => toPt(v, i));
      let d = `M ${pts[0].x},${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        d += ` Q ${pts[i].x},${pts[i].y} ${xc},${(pts[i].y + pts[i + 1].y) / 2}`;
      }
      d += ` T ${pts[pts.length - 1].x},${pts[pts.length - 1].y}`;
      const area = `${d} L 800,200 L 0,200 Z`;
      return { d, area, pts };
    };
    const pm25Geo = buildSmooth(metrics.hourlyPm25);
    const pm10Geo = buildSmooth(metrics.hourlyPm10);
    const whoY = Math.min(192, Math.max(25, 195 - (15 / maxVal) * 165));
    return { pm25Geo, pm10Geo, whoY };
  }, [metrics.hourlyPm25, metrics.hourlyPm10]);

  const handleExportCsv = () => {
    const headers = [
      'Station Code',
      'City',
      'Locality',
      'State',
      'AQI',
      'Tier',
      'PM2.5',
      'PM10',
      'NO2',
      'SO2',
      'CO',
      'O3',
    ];
    const rows = filteredStations.map((s) =>
      [
        s.code,
        s.city,
        s.locality,
        s.stateName,
        s.aqi,
        getCpcbTier(s.aqi),
        s.pm25,
        s.pm10,
        s.no2,
        s.so2,
        s.co,
        s.o3,
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breathe-india-cpcb-telemetry-${selectedState}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setCsvNotice(true);
    setTimeout(() => setCsvNotice(false), 2000);
  };

  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filteredStations.length / pageSize));
  const safePage = Math.min(tablePage, totalPages);
  const pagedStations = filteredStations.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const avgTier = getCpcbTier(metrics.avgAqi);
  const avgTierColors = getTierColors(avgTier);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 pb-12 flex flex-col gap-6">
      {/* Executive Title & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1 max-w-3xl">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-[#005d42] text-white text-[10px] uppercase font-bold tracking-wider">
              CAAQMS Telemetry
            </span>
            <span className="text-[#005d42] font-semibold">
              Telemetry Stream Live
            </span>
          </div>
          <h1 className="text-2xl lg:text-[28px] font-bold text-[#0b1c30] tracking-tight">
            {lang === 'hi'
              ? 'राष्ट्रीय वायु गुणवत्ता व प्रदूषण बुद्धिमत्ता'
              : 'National Air Quality & Pollution Intelligence'}
          </h1>
          <p className="text-sm text-[#3e4943]">
            {lang === 'hi'
              ? '482 सक्रिय CPCB स्टेशनों से वास्तविक समय डेटा, बहु-प्रदूषक विश्लेषण व स्वास्थ्य जोखिम संकेतक।'
              : 'Real-time CPCB telemetry, multi-pollutant dispersion dynamics, and nationwide environmental risk indicators across 482 active stations.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 no-print">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#e5eeff] hover:bg-[#dce9ff] text-[#0b1c30] text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#006398]" />
            <span>{csvNotice ? 'CSV Downloaded' : 'Export CSV / Excel'}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#005d42] hover:bg-[#047857] text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <FileText className="w-4 h-4" />
            <span>Download Official Bulletin (PDF)</span>
          </button>
        </div>
      </div>

      {/* Slicer & Filter Ribbon */}
      <div className="bg-white rounded-xl border border-[#bdc9c1]/40 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="stateFilter"
            className="text-[10px] uppercase font-bold tracking-wider text-[#6e7a73]"
          >
            State Jurisdiction
          </label>
          <div className="relative inline-flex">
            <select
              id="stateFilter"
              value={selectedState}
              onChange={(e) => {
                onChangeState(e.target.value);
                setTablePage(1);
              }}
              className="appearance-none bg-[#eff4ff] text-[#0b1c30] text-xs font-medium pl-3 pr-8 py-1.5 rounded-lg border border-[#bdc9c1]/40 focus:outline-none focus:border-[#006398] cursor-pointer"
            >
              {INDIAN_STATES.map((st) => (
                <option key={st.code} value={st.code}>
                  {lang === 'hi' ? st.labelHi : st.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#6e7a73] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7a73]">
            Time Horizon
          </span>
          <div className="flex items-center bg-[#eff4ff] p-1 rounded-lg gap-1">
            {TIME_WINDOWS.map((tw) => (
              <button
                key={tw.id}
                type="button"
                onClick={() => setTimeWindow(tw.id)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                  timeWindow === tw.id
                    ? 'bg-white text-[#005d42] font-bold shadow-xs'
                    : 'text-[#3e4943] hover:text-[#0b1c30]'
                }`}
              >
                {tw.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#6e7a73]">
            Pollutant Focus
          </span>
          <div className="flex items-center bg-[#eff4ff] p-1 rounded-lg gap-1 overflow-x-auto max-w-full">
            {POLLUTANTS.map((pol) => (
              <button
                key={pol.id}
                type="button"
                onClick={() => setPollutantFocus(pol.id)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap font-semibold ${
                  pollutantFocus === pol.id
                    ? 'bg-[#005d42] text-white'
                    : 'text-[#3e4943] hover:text-[#0b1c30]'
                }`}
              >
                {pol.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right">
            <span className="text-[10px] uppercase tracking-wider text-[#6e7a73] font-semibold">
              Telemetry Nodes
            </span>
            <span className="text-sm font-mono font-bold tabular-nums text-[#0b1c30]">
              482 / 498 Online
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#97f5cc] flex items-center justify-center text-[#002115]">
            <Radio className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 5 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1 */}
        <div className="bg-white rounded-xl border border-[#bdc9c1]/40 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#3e4943] uppercase tracking-wider font-semibold">
              {selectedState === 'all' ? 'National Avg AQI' : 'Regional Avg AQI'}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#ffdad6] text-[#93000a] font-bold tabular-nums">
              +12 pts vs 24h
            </span>
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span
              className={`text-4xl font-extrabold font-display tabular-nums ${avgTierColors.textClass}`}
            >
              {metrics.avgAqi}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${avgTierColors.badgeBg} ${avgTierColors.badgeText}`}
            >
              {avgTier}
            </span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-[#eff4ff] h-1.5 rounded-full overflow-hidden">
              <div
                className={`${avgTierColors.barClass} h-full rounded-full`}
                style={{ width: `${Math.min(100, Math.round((metrics.avgAqi / 400) * 100))}%` }}
              />
            </div>
            <span className="text-xs text-[#6e7a73]">
              {filteredStations.length} stations aggregated
            </span>
          </div>
        </div>

        {/* KPI 2: Critical Hotspot */}
        <button
          type="button"
          onClick={() => onInspectStationOnMap(metrics.hotspot)}
          className="bg-white rounded-xl border border-[#bdc9c1]/40 hover:border-[#ba1a1a]/60 p-4 flex flex-col justify-between text-left transition-colors"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-[#3e4943] uppercase tracking-wider font-semibold">
              Critical Hotspot
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#ba1a1a] text-white font-bold">
              High Alert
            </span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold font-display tabular-nums text-[#ba1a1a]">
                {metrics.hotspot.aqi}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ffdad6] text-[#93000a] uppercase">
                {getCpcbTier(metrics.hotspot.aqi)}
              </span>
            </div>
            <div className="text-sm font-bold text-[#0b1c30] truncate mt-0.5">
              {metrics.hotspot.city} ({metrics.hotspot.locality})
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-[#3e4943] w-full">
            <span>
              Dominant: <strong className="text-[#ba1a1a]">{metrics.hotspot.dominant}</strong>
            </span>
            <span className="font-mono font-bold tabular-nums">
              {metrics.hotspot.pm25} µg/m³
            </span>
          </div>
        </button>

        {/* KPI 3: Clean Air Benchmark */}
        <button
          type="button"
          onClick={() => onInspectStationOnMap(metrics.cleanest)}
          className="bg-white rounded-xl border border-[#bdc9c1]/40 hover:border-[#005d42]/60 p-4 flex flex-col justify-between text-left transition-colors"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-[#3e4943] uppercase tracking-wider font-semibold">
              Clean Air Benchmark
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#97f5cc] text-[#002115] font-bold">
              Pristine Zone
            </span>
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold font-display tabular-nums text-[#005d42]">
                {metrics.cleanest.aqi}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#97f5cc] text-[#002115] uppercase">
                Good (Clean)
              </span>
            </div>
            <div className="text-sm font-bold text-[#0b1c30] truncate mt-0.5">
              {metrics.cleanest.city}, {metrics.cleanest.stateName}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-[#3e4943] w-full">
            <span>Ambient PM2.5</span>
            <span className="font-mono font-bold tabular-nums text-[#005d42]">
              {metrics.cleanest.pm25} µg/m³
            </span>
          </div>
        </button>

        {/* KPI 4: Severe / Very Poor */}
        <div className="bg-white rounded-xl border border-[#bdc9c1]/40 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#3e4943] uppercase tracking-wider font-semibold">
              Severe / Very Poor
            </span>
            <ShieldAlert className="w-4 h-4 text-[#ba1a1a]" />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-display tabular-nums text-[#ba1a1a]">
              28
            </span>
            <span className="text-xs text-[#3e4943]">Cities Impacted</span>
          </div>
          <div className="px-2 py-1 rounded text-[11px] bg-[#ffdad6] text-[#93000a] font-semibold">
            GRAP Stage-III Active in 4 urban clusters
          </div>
        </div>

        {/* KPI 5: Good / Satisfactory */}
        <div className="bg-white rounded-xl border border-[#bdc9c1]/40 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#3e4943] uppercase tracking-wider font-semibold">
              Good / Satisfactory
            </span>
            <Leaf className="w-4 h-4 text-[#005d42]" />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold font-display tabular-nums text-[#005d42]">
              84
            </span>
            <span className="text-xs text-[#3e4943]">Clean Urban Hubs</span>
          </div>
          <div className="px-2 py-1 rounded text-[11px] bg-[#eff4ff] text-[#3e4943] font-semibold">
            Predominantly Coastline & Western Ghats
          </div>
        </div>
      </div>

      {/* Main 67% / 33% Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Columns */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* CPCB 6-Tier Distribution */}
          <div className="bg-white rounded-xl border border-[#bdc9c1]/40 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-[#0b1c30]">
                  CPCB 6-Tier National AQI Distribution
                </h2>
                <p className="text-xs text-[#3e4943]">
                  Breakdown of active CAAQMS ambient monitoring stations — click any tier below to filter station log
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#005d42] font-semibold shrink-0">
                <Verified className="w-4 h-4" />
                <span>IS 5182 Certified</span>
              </div>
            </div>

            <div className="w-full h-7 rounded-lg overflow-hidden flex select-none">
              <button
                type="button"
                onClick={() => setTierFilter(tierFilter === 'Good' ? 'ALL' : 'Good')}
                className="bg-[#005d42] hover:opacity-90 h-full flex items-center justify-center text-white text-[11px] font-bold tabular-nums"
                style={{ width: `${metrics.pct(metrics.counts.Good)}%` }}
                title="Good (0-50)"
              >
                {metrics.pct(metrics.counts.Good)}%
              </button>
              <button
                type="button"
                onClick={() =>
                  setTierFilter(tierFilter === 'Satisfactory' ? 'ALL' : 'Satisfactory')
                }
                className="bg-[#047857] hover:opacity-90 h-full flex items-center justify-center text-white text-[11px] font-bold tabular-nums"
                style={{ width: `${metrics.pct(metrics.counts.Satisfactory)}%` }}
                title="Satisfactory (51-100)"
              >
                {metrics.pct(metrics.counts.Satisfactory)}%
              </button>
              <button
                type="button"
                onClick={() => setTierFilter(tierFilter === 'Moderate' ? 'ALL' : 'Moderate')}
                className="bg-[#5bb8fe] hover:opacity-90 h-full flex items-center justify-center text-[#001d31] text-[11px] font-bold tabular-nums"
                style={{ width: `${metrics.pct(metrics.counts.Moderate)}%` }}
                title="Moderate (101-200)"
              >
                {metrics.pct(metrics.counts.Moderate)}%
              </button>
              <button
                type="button"
                onClick={() => setTierFilter(tierFilter === 'Poor' ? 'ALL' : 'Poor')}
                className="bg-[#006398] hover:opacity-90 h-full flex items-center justify-center text-white text-[11px] font-bold tabular-nums"
                style={{ width: `${metrics.pct(metrics.counts.Poor)}%` }}
                title="Poor (201-300)"
              >
                {metrics.pct(metrics.counts.Poor)}%
              </button>
              <button
                type="button"
                onClick={() =>
                  setTierFilter(tierFilter === 'Very Poor' ? 'ALL' : 'Very Poor')
                }
                className="bg-[#ba1a1a] hover:opacity-90 h-full flex items-center justify-center text-white text-[11px] font-bold tabular-nums"
                style={{ width: `${metrics.pct(metrics.counts['Very Poor'])}%` }}
                title="Very Poor (301-400)"
              >
                {metrics.pct(metrics.counts['Very Poor'])}%
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {(
                [
                  { tier: 'Good', label: 'Good (0-50)', color: 'bg-[#005d42]', text: 'text-[#005d42]', count: 87 },
                  { tier: 'Satisfactory', label: 'Satisfactory', color: 'bg-[#047857]', text: 'text-[#047857]', count: 140 },
                  { tier: 'Moderate', label: 'Moderate', color: 'bg-[#5bb8fe]', text: 'text-[#006398]', count: 154 },
                  { tier: 'Poor', label: 'Poor', color: 'bg-[#006398]', text: 'text-[#006398]', count: 58 },
                  { tier: 'Very Poor', label: 'Very Poor', color: 'bg-[#ba1a1a]', text: 'text-[#ba1a1a]', count: 34 },
                  { tier: 'Severe', label: 'Severe (>400)', color: 'bg-[#7F1D1D]', text: 'text-[#7F1D1D]', count: 9 },
                ] as const
              ).map((item) => (
                <button
                  key={item.tier}
                  type="button"
                  onClick={() =>
                    setTierFilter(tierFilter === item.tier ? 'ALL' : item.tier)
                  }
                  className={`p-2 rounded-lg text-left transition-colors ${
                    tierFilter === item.tier
                      ? 'bg-[#dce9ff] ring-1 ring-[#006398]'
                      : 'bg-[#eff4ff] hover:bg-[#e5eeff]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-[11px] font-bold text-[#0b1c30] truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1 tabular-nums">
                    <span className={`text-sm font-bold ${item.text}`}>{item.count}</span>
                    <span className="text-[11px] text-[#6e7a73]">
                      {Math.round((item.count / 482) * 100)}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 24-Hour Diurnal Dispersion SVG Chart (matches screen_8fac9013.png) */}
          <div className="bg-white rounded-xl border border-[#bdc9c1]/40 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-[#0b1c30]">
                    24-Hour Diurnal Trend: PM2.5 vs PM10 Dispersion
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-[#e5eeff] text-[#3e4943] font-semibold">
                    {selectedState === 'all' ? 'National Weighted Average' : selectedState.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-[#3e4943] mt-0.5">
                  Hover points to inspect morning smog inversion peak, afternoon convection dip, and nocturnal trap
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-[11px] font-bold">
                <span className="flex items-center gap-1.5 text-[#0b1c30]">
                  <span className="w-3 h-0.5 bg-[#ba1a1a] inline-block" />
                  PM2.5 Fine Particles
                </span>
                <span className="flex items-center gap-1.5 text-[#0b1c30]">
                  <span className="w-3 h-0.5 bg-[#006398] inline-block" />
                  PM10 Coarse Dust
                </span>
              </div>
            </div>

            <div className="relative w-full h-64 bg-[#eff4ff] rounded-lg p-3 flex flex-col justify-between overflow-hidden">
              <div className="hidden sm:block absolute left-[22%] top-3 z-10 px-2 py-0.5 rounded bg-[#ba1a1a] text-white text-[10px] font-bold">
                Morning Inversion Spike (06:00)
              </div>
              <div className="hidden sm:block absolute left-[48%] bottom-10 z-10 px-2 py-0.5 rounded bg-[#005d42] text-white text-[10px] font-bold">
                Afternoon Dispersal Trough (15:00)
              </div>
              <div className="hidden sm:block absolute right-[10%] top-7 z-10 px-2 py-0.5 rounded bg-[#ba1a1a] text-white text-[10px] font-bold">
                Evening Smoke Trap (21:00)
              </div>

              {hoverIdx !== null && (
                <div className="absolute top-3 right-3 z-20 bg-white border border-[#bdc9c1] rounded-md px-2.5 py-1.5 text-[11px] shadow-sm tabular-nums">
                  <div className="font-bold text-[#0b1c30]">{HOUR_LABELS[hoverIdx]}</div>
                  <div className="text-[#ba1a1a] font-semibold">
                    PM2.5: {metrics.hourlyPm25[hoverIdx]} µg/m³
                  </div>
                  <div className="text-[#006398] font-semibold">
                    PM10: {metrics.hourlyPm10[hoverIdx]} µg/m³
                  </div>
                </div>
              )}

              <svg
                className="w-full h-full overflow-visible"
                viewBox="0 0 800 220"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="gradPm25Live" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ba1a1a" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#ba1a1a" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="gradPm10Live" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#006398" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#006398" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {[40, 90, 140, 190].map((y) => (
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

                <line
                  x1="0"
                  x2="800"
                  y1={chartGeometry.whoY}
                  y2={chartGeometry.whoY}
                  stroke="#005d42"
                  strokeDasharray="4 2"
                  strokeWidth="1.5"
                />
                <text
                  x="10"
                  y={chartGeometry.whoY - 5}
                  fill="#005d42"
                  fontSize="10"
                  fontWeight="700"
                >
                  WHO Safe 24h Threshold (15 µg/m³)
                </text>

                <path d={chartGeometry.pm10Geo.area} fill="url(#gradPm10Live)" />
                <path
                  d={chartGeometry.pm10Geo.d}
                  fill="none"
                  stroke="#006398"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                <path d={chartGeometry.pm25Geo.area} fill="url(#gradPm25Live)" />
                <path
                  d={chartGeometry.pm25Geo.d}
                  fill="none"
                  stroke="#ba1a1a"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {chartGeometry.pm25Geo.pts.map((pt, idx) => (
                  <g key={idx}>
                    <circle
                      cx={pt.x}
                      cy={chartGeometry.pm10Geo.pts[idx].y}
                      r={hoverIdx === idx ? 5.5 : 3.5}
                      fill="#006398"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={hoverIdx === idx ? 6 : 4}
                      fill={idx === 5 ? '#005d42' : '#ba1a1a'}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <rect
                      x={pt.x - 30}
                      y={0}
                      width={60}
                      height={200}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoverIdx(idx)}
                      onMouseLeave={() => setHoverIdx(null)}
                    />
                  </g>
                ))}
              </svg>

              <div className="w-full flex items-center justify-between px-1 text-[10px] text-[#6e7a73] font-semibold border-t border-[#bdc9c1]/40 pt-1 tabular-nums">
                {HOUR_LABELS.map((lbl) => (
                  <span key={lbl} className="truncate">
                    {lbl}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Multi-Pollutant Telemetry Matrix */}
          <div className="bg-white rounded-xl border border-[#bdc9c1]/40 p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-[#0b1c30]">
                  Multi-Pollutant Telemetry Matrix
                </h2>
                <p className="text-xs text-[#3e4943]">
                  Concentration levels benchmarked against National CPCB and WHO Air Quality Guidelines
                </p>
              </div>
              <span className="text-xs font-semibold text-[#3e4943]">
                Ambient Standards
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'pm25' as const,
                  name: 'PM2.5',
                  value: metrics.avgPm25,
                  unit: 'µg/m³',
                  badge: `${(metrics.avgPm25 / 15).toFixed(1)}x WHO Limit`,
                  badgeCls: 'bg-[#ffdad6] text-[#93000a]',
                  valCls: 'text-[#ba1a1a]',
                  barCls: 'bg-[#ba1a1a]',
                  pct: Math.min(100, Math.round((metrics.avgPm25 / 120) * 100)),
                  left: 'CPCB Std: 60',
                  right: 'WHO Std: 15',
                },
                {
                  id: 'pm10' as const,
                  name: 'PM10',
                  value: metrics.avgPm10,
                  unit: 'µg/m³',
                  badge: `${(metrics.avgPm10 / 100).toFixed(1)}x CPCB`,
                  badgeCls: 'bg-[#cce5ff] text-[#001d31]',
                  valCls: 'text-[#006398]',
                  barCls: 'bg-[#006398]',
                  pct: Math.min(100, Math.round((metrics.avgPm10 / 260) * 100)),
                  left: 'CPCB Std: 100',
                  right: 'WHO Std: 45',
                },
                {
                  id: 'no2' as const,
                  name: 'NO₂',
                  value: metrics.avgNo2,
                  unit: 'µg/m³',
                  badge: metrics.avgNo2 > 40 ? 'Moderate' : 'Within Limit',
                  badgeCls: 'bg-[#cce5ff] text-[#001d31]',
                  valCls: 'text-[#0b1c30]',
                  barCls: 'bg-[#5bb8fe]',
                  pct: Math.min(100, Math.round((metrics.avgNo2 / 80) * 100)),
                  left: 'CPCB Std: 80',
                  right: 'Vehicular Peak',
                },
                {
                  id: 'so2' as const,
                  name: 'SO₂',
                  value: metrics.avgSo2,
                  unit: 'µg/m³',
                  badge: 'Safe Tier',
                  badgeCls: 'bg-[#97f5cc] text-[#002115]',
                  valCls: 'text-[#005d42]',
                  barCls: 'bg-[#005d42]',
                  pct: Math.min(100, Math.round((metrics.avgSo2 / 80) * 100)),
                  left: 'CPCB Std: 80',
                  right: 'Thermal Compliant',
                },
                {
                  id: 'co' as const,
                  name: 'CO',
                  value: metrics.avgCo,
                  unit: 'mg/m³',
                  badge: metrics.avgCo <= 2 ? 'Normal' : 'Elevated',
                  badgeCls: 'bg-[#97f5cc] text-[#002115]',
                  valCls: 'text-[#047857]',
                  barCls: 'bg-[#047857]',
                  pct: Math.min(100, Math.round((metrics.avgCo / 4) * 100)),
                  left: 'CPCB 8h: 2.0',
                  right: 'Combustion Low',
                },
                {
                  id: 'o3' as const,
                  name: 'Ozone (O₃)',
                  value: metrics.avgO3,
                  unit: 'µg/m³',
                  badge: 'Photochemical',
                  badgeCls: 'bg-[#cce5ff] text-[#001d31]',
                  valCls: 'text-[#006398]',
                  barCls: 'bg-[#5bb8fe]',
                  pct: Math.min(100, Math.round((metrics.avgO3 / 100) * 100)),
                  left: 'CPCB 8h: 100',
                  right: 'Afternoon Watch',
                },
              ].map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setPollutantFocus(card.id)}
                  className={`p-4 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] text-left flex flex-col justify-between gap-2 border transition-colors ${
                    pollutantFocus === card.id
                      ? 'border-[#006398]'
                      : 'border-[#bdc9c1]/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-bold text-[#0b1c30]">{card.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${card.badgeCls}`}
                    >
                      {card.badge}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-bold font-mono tabular-nums ${card.valCls}`}>
                      {card.value}
                    </span>
                    <span className="text-xs text-[#6e7a73]">{card.unit}</span>
                  </div>
                  <div className="space-y-1 w-full">
                    <div className="w-full bg-[#bdc9c1]/40 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`${card.barCls} h-full rounded-full`}
                        style={{ width: `${card.pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#6e7a73]">
                      <span>{card.left}</span>
                      <span>{card.right}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Citizen Advisory + Top 5 Polluted + Top 5 Cleanest */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-[#ba1a1a]/30 p-5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#ba1a1a]" />
              <h3 className="text-sm font-bold text-[#0b1c30]">
                Actionable Citizen Warning
              </h3>
            </div>
            <p className="text-xs text-[#3e4943] leading-relaxed">
              Current Composite AQI is{' '}
              <strong className={avgTierColors.textClass}>
                {metrics.avgAqi} ({avgTier})
              </strong>
              . Sensitive individuals, elderly citizens, and children should limit prolonged heavy exertion when AQI exceeds 200. N95 / FFP2 respirators recommended outdoors in Northern Plains clusters.
            </p>
            <div className="flex items-center justify-between pt-1 text-[11px]">
              <span className="text-[#6e7a73]">Indoor HEPA Purifier: Recommended</span>
              <button
                type="button"
                onClick={() => onNavigate('health')}
                className="text-[#005d42] font-bold hover:underline inline-flex items-center gap-1"
              >
                Protocol Guide <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Top 5 Most Polluted */}
          <div className="bg-white rounded-xl border border-[#bdc9c1]/40 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#bdc9c1]/30">
              <h3 className="text-sm font-bold text-[#0b1c30]">
                Top 5 Most Polluted
              </h3>
              <span className="text-[10px] text-[#6e7a73] uppercase font-semibold">
                24h Real-time
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {topPolluted.map((st, idx) => {
                const tier = getCpcbTier(st.aqi);
                const colors = getTierColors(tier);
                return (
                  <button
                    key={st.code}
                    type="button"
                    onClick={() => onInspectStationOnMap(st)}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#eff4ff] hover:bg-[#ffdad6]/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-full text-white text-[11px] flex items-center justify-center font-bold tabular-nums shrink-0 ${
                          idx < 3 ? 'bg-[#ba1a1a]' : 'bg-[#006398]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#0b1c30] truncate">
                          {st.city}
                        </div>
                        <div className="text-[10px] text-[#6e7a73] truncate">
                          {st.locality} · {st.dominant}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-mono font-bold tabular-nums ${colors.textClass}`}
                      >
                        {st.aqi}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${colors.badgeBg} ${colors.badgeText}`}
                      >
                        {tier}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Top 5 Cleanest Cities */}
          <div className="bg-white rounded-xl border border-[#bdc9c1]/40 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#bdc9c1]/30">
              <h3 className="text-sm font-bold text-[#0b1c30]">
                Top 5 Cleanest Cities
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('cleaner')}
                className="text-[11px] text-[#005d42] font-bold hover:underline"
              >
                Explore Clean Air
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {topCleanest.map((st, idx) => (
                <button
                  key={st.code}
                  type="button"
                  onClick={() => onInspectStationOnMap(st)}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#eff4ff] hover:bg-[#97f5cc]/35 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-[#005d42] text-white text-[11px] flex items-center justify-center font-bold tabular-nums shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#0b1c30] truncate">
                        {st.city}
                      </div>
                      <div className="text-[10px] text-[#6e7a73] truncate">
                        {st.locality} · {st.stateName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold tabular-nums text-[#005d42]">
                      {st.aqi}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#97f5cc] text-[#002115]">
                      Good
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* IMD Weather Correlation & Station Log Toggle */}
      <div className="bg-white rounded-xl border border-[#bdc9c1]/40 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#eff4ff] text-[#0b1c30]">
            <Verified className="w-4 h-4 text-[#005d42]" />
            <span className="font-bold text-[#005d42]">CPCB Verified Stream</span>
            <span className="font-mono text-[#6e7a73]">#IND-CAAQMS-V4</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#eff4ff] text-[#0b1c30] tabular-nums">
            <Thermometer className="w-4 h-4 text-[#006398]" />
            <span>
              <strong>IMD Correlation:</strong> Wind {metrics.avgWind} km/h · {metrics.avgTemp}°C · Humidity {metrics.avgHum}%
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#eff4ff] text-[#6e7a73] tabular-nums">
            <History className="w-4 h-4" />
            <span>
              Latency: <strong className="text-[#0b1c30]">12 mins</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 no-print">
          <button
            type="button"
            onClick={() => onNavigate('dispersion3d')}
            className="text-xs text-[#005d42] font-bold hover:underline inline-flex items-center gap-1"
          >
            <span>Open 3D Dispersion Twin</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('visuals')}
            className="text-xs text-[#005d42] font-bold hover:underline inline-flex items-center gap-1"
          >
            <span>Create AQI Poster</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowStationLog((v) => !v)}
            className="text-xs text-[#006398] font-bold hover:underline inline-flex items-center gap-1"
          >
            <span>{showStationLog ? 'Hide Station Log' : 'Show Station Log'}</span>
          </button>
        </div>
      </div>

      {/* Paginated Station Telemetry Table */}
      {showStationLog && (
        <div className="bg-white rounded-xl border border-[#bdc9c1]/40 p-5 space-y-3 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#bdc9c1]/30">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0b1c30]">
                Detailed Station Telemetry Records
              </h3>
              <span className="text-xs text-[#6e7a73] tabular-nums">
                ({filteredStations.length} stations shown
                {tierFilter !== 'ALL' ? ` · ${tierFilter} filter` : ''})
              </span>
              {tierFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setTierFilter('ALL')}
                  className="text-xs text-[#006398] font-semibold hover:underline"
                >
                  Clear tier filter
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs tabular-nums no-print">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] font-semibold disabled:opacity-40 inline-flex items-center gap-0.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <span className="text-[#6e7a73]">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 rounded bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] font-semibold disabled:opacity-40 inline-flex items-center gap-0.5"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#eff4ff] text-[#6e7a73] uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Station Code</th>
                  <th className="py-2.5 px-3">City & Locality</th>
                  <th className="py-2.5 px-3 text-right">AQI Score</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">PM2.5 (µg/m³)</th>
                  <th className="py-2.5 px-3 text-right">PM10 (µg/m³)</th>
                  <th className="py-2.5 px-3 text-right">NO₂</th>
                  <th className="py-2.5 px-3 text-right">Last Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#bdc9c1]/30 tabular-nums">
                {pagedStations.map((st) => {
                  const tier = getCpcbTier(st.aqi);
                  const colors = getTierColors(tier);
                  return (
                    <tr
                      key={st.code}
                      onClick={() => onInspectStationOnMap(st)}
                      className="hover:bg-[#eff4ff]/60 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono text-[#6e7a73]">{st.code}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#0b1c30]">
                        {st.city} — {st.locality}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold ${colors.textClass}`}>
                        {st.aqi}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${colors.badgeBg} ${colors.badgeText}`}
                        >
                          {tier}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono ${colors.textClass}`}>
                        {st.pm25}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#0b1c30]">
                        {st.pm10}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#0b1c30]">
                        {st.no2}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#6e7a73]">
                        {st.updatedMinutesAgo} mins ago
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
