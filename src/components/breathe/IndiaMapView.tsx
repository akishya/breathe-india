import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Bookmark, Box, Loader2, MapPin, Search, Sparkles, Wand2, Wind } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { savePinnedPlace } from '../../lib/firebase';
import {
  getCpcbTier,
  getTierColors,
  type PortalLang,
  type PortalTab,
  type StationTelemetry,
} from '../../data/indiaStations';

interface PlacesSessionTokenLike {
  readonly __brand?: 'AutocompleteSessionToken';
}

interface PlacesPlaceLike {
  id?: string;
  displayName?: string;
  formattedAddress?: string;
  location?: { lat: () => number; lng: () => number };
  viewport?: Parameters<NonNullable<ReturnType<typeof useMap>>['fitBounds']>[0];
  fetchFields: (opts: { fields: string[] }) => Promise<void>;
}

interface PlacesSuggestionLike {
  placePrediction?: {
    text: { text: string };
    toPlace: () => PlacesPlaceLike;
  };
}

interface PlacesLibraryLike {
  AutocompleteSessionToken: new () => PlacesSessionTokenLike;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (req: {
      input: string;
      sessionToken?: PlacesSessionTokenLike;
      includedRegionCodes?: string[];
    }) => Promise<{ suggestions?: PlacesSuggestionLike[] }>;
  };
}

function triggerQuotaIfApplicable(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OverQuotaMapError') ||
    msg.includes('429')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

function IndiaPlaceSearch({
  onPickedLocation,
}: {
  onPickedLocation: (loc: { name: string; address: string; lat: number; lng: number }) => void;
}) {
  const placesLib = useMapsLibrary('places') as unknown as PlacesLibraryLike | null;
  const map = useMap();
  const tokenRef = useRef<PlacesSessionTokenLike | null>(null);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<PlacesSuggestionLike[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!placesLib || !input.trim()) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    if (!tokenRef.current) {
      tokenRef.current = new placesLib.AutocompleteSessionToken();
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: tokenRef.current ?? undefined,
        includedRegionCodes: ['in'],
      })
        .then((res) => {
          if (active) {
            setSuggestions(res.suggestions ?? []);
            setLoading(false);
          }
        })
        .catch((err: unknown) => {
          triggerQuotaIfApplicable(err);
          if (active) {
            setSuggestions([]);
            setLoading(false);
          }
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [placesLib, input]);

  const handleChoose = async (suggestion: PlacesSuggestionLike) => {
    if (!suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'viewport'],
      });
      if (place.location) {
        const lat = place.location.lat();
        const lng = place.location.lng();
        if (map) {
          if (place.viewport) map.fitBounds(place.viewport);
          else {
            map.panTo({ lat, lng });
            map.setZoom(12);
          }
        }
        onPickedLocation({
          name: place.displayName || suggestion.placePrediction.text.text,
          address: place.formattedAddress || 'India',
          lat,
          lng,
        });
      }
      setInput('');
      tokenRef.current = null;
      setSuggestions([]);
    } catch (err) {
      triggerQuotaIfApplicable(err);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="w-4 h-4 text-[#6e7a73] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search any Indian city, locality, or pin code for live AQI..."
          className="w-full pl-9 pr-9 py-2.5 bg-white border border-[#bdc9c1]/60 rounded-lg text-xs text-[#0b1c30] focus:outline-none focus:border-[#006398]"
        />
        {loading && (
          <Loader2 className="w-4 h-4 text-[#6e7a73] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>

      {suggestions.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-[#bdc9c1] rounded-lg shadow-lg divide-y divide-[#eff4ff] max-h-60 overflow-y-auto">
          {suggestions.map((s, idx) => (
            <li key={idx}>
              <button
                type="button"
                onClick={() => void handleChoose(s)}
                className="w-full text-left px-3 py-2.5 hover:bg-[#eff4ff] flex items-center gap-2 text-xs text-[#0b1c30]"
              >
                <MapPin className="w-3.5 h-3.5 text-[#006398] shrink-0" />
                <span>{s.placePrediction?.text.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StationMarkerItem({
  station,
  selected,
  onSelect,
}: {
  station: StationTelemetry;
  selected: boolean;
  onSelect: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const tier = getCpcbTier(station.aqi);
  const colors = getTierColors(tier);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: station.lat, lng: station.lng }}
        onClick={onSelect}
        title={`${station.city}: AQI ${station.aqi}`}
      >
        <div
          className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold shadow-md border cursor-pointer tabular-nums transition-transform ${
            selected ? 'scale-115 ring-2 ring-[#0b1c30]' : ''
          }`}
          style={{
            backgroundColor: colors.hex,
            color: '#ffffff',
            borderColor: '#ffffff',
          }}
        >
          {station.aqi}
        </div>
      </AdvancedMarker>
      {selected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onSelect}>
          <div className="p-1 min-w-[210px] text-[#0b1c30] space-y-1">
            <div className="text-xs font-bold">
              {station.city} — {station.locality}
            </div>
            <div className="text-[11px] text-[#3e4943]">
              {station.stateName} · {station.code}
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span className={`text-sm font-mono font-bold tabular-nums ${colors.textClass}`}>
                AQI {station.aqi}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${colors.badgeBg} ${colors.badgeText}`}>
                {tier}
              </span>
            </div>
            <div className="text-[11px] font-mono tabular-nums text-[#3e4943]">
              PM2.5: {station.pm25} · PM10: {station.pm10} µg/m³
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function InnerIndiaMap({
  stations,
  focusedStation,
  onSelectStation,
  onNavigate,
  lang,
}: {
  stations: StationTelemetry[];
  focusedStation: StationTelemetry;
  onSelectStation: (st: StationTelemetry) => void;
  onNavigate?: (tab: PortalTab) => void;
  lang: PortalLang;
}) {
  const { user } = useAuth();
  const map = useMap();
  const [customPoint, setCustomPoint] = useState<StationTelemetry | null>(null);
  const [fetchingPoint, setFetchingPoint] = useState(false);
  const [pinnedNotice, setPinnedNotice] = useState(false);

  const activeStation = customPoint || focusedStation;
  const activeTier = getCpcbTier(activeStation.aqi);
  const activeColors = getTierColors(activeTier);

  useEffect(() => {
    if (map && focusedStation && !customPoint) {
      map.panTo({ lat: focusedStation.lat, lng: focusedStation.lng });
    }
  }, [map, focusedStation, customPoint]);

  const handlePickedPlace = useCallback(
    async (loc: { name: string; address: string; lat: number; lng: number }) => {
      setFetchingPoint(true);
      setPinnedNotice(false);
      try {
        const res = await fetch(
          `/api/air-quality/point?lat=${loc.lat}&lng=${loc.lng}`
        );
        const data = await res.json();
        if (res.ok) {
          setCustomPoint({
            code: 'PLACES-LIVE',
            city: loc.name,
            locality: loc.address,
            stateCode: 'custom',
            stateName: 'India',
            lat: loc.lat,
            lng: loc.lng,
            aqi: data.aqi,
            pm25: data.pm25,
            pm10: data.pm10,
            no2: data.no2,
            so2: data.so2,
            co: data.co,
            o3: data.o3,
            windKmh: data.windKmh,
            tempC: data.tempC,
            humidityPct: data.humidityPct,
            dominant: data.dominant || 'PM2.5',
            delta24h: 0,
            hourlyPm25: data.hourlyPm25 || [],
            hourlyPm10: data.hourlyPm10 || [],
            updatedMinutesAgo: 1,
            source: 'live-telemetry',
          });
        }
      } catch {
        // Ignore transient lookup failures
      } finally {
        setFetchingPoint(false);
      }
    },
    []
  );

  const handlePinToWatchlist = async () => {
    if (!user) return;
    await savePinnedPlace({
      ownerId: user.uid,
      placeId: activeStation.code,
      name: `${activeStation.city} (AQI ${activeStation.aqi})`,
      address: `${activeStation.locality}, ${activeStation.stateName}`,
      lat: activeStation.lat,
      lng: activeStation.lng,
      note: `PM2.5 ${activeStation.pm25} µg/m³ · ${activeTier}`,
    });
    setPinnedNotice(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 pb-12 space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">
            {lang === 'hi'
              ? 'भारत का संवादात्मक वायु गुणवत्ता मानचित्र'
              : 'Interactive Geospatial Air Quality Map of India'}
          </h1>
          <p className="text-xs text-[#3e4943] mt-0.5">
            Click any CAAQMS station badge or search any Indian city to query live CPCB NAQI and wind dispersion
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] flex-wrap">
          {(['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very Poor'] as const).map(
            (t) => {
              const c = getTierColors(t);
              return (
                <span key={t} className="inline-flex items-center gap-1 text-[#3e4943]">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ backgroundColor: c.hex }}
                  />
                  {t}
                </span>
              );
            }
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-3">
          <IndiaPlaceSearch onPickedLocation={(loc) => void handlePickedPlace(loc)} />

          <div className="w-full h-[560px] rounded-xl overflow-hidden border border-[#bdc9c1]/60 bg-[#eff4ff]">
            <GoogleMap
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              defaultCenter={{ lat: 22.5937, lng: 78.9629 }}
              defaultZoom={5}
              gestureHandling="greedy"
              className="w-full h-full"
            >
              {stations.map((st) => (
                <StationMarkerItem
                  key={st.code}
                  station={st}
                  selected={!customPoint && focusedStation.code === st.code}
                  onSelect={() => {
                    setCustomPoint(null);
                    setPinnedNotice(false);
                    onSelectStation(st);
                  }}
                />
              ))}
              {customPoint && (
                <AdvancedMarker
                  position={{ lat: customPoint.lat, lng: customPoint.lng }}
                  title={customPoint.city}
                >
                  <Pin background="#005d42" glyphColor="#ffffff" borderColor="#002115" />
                </AdvancedMarker>
              )}
            </GoogleMap>
          </div>
        </div>

        {/* Right Station Telemetry Inspector */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-[#bdc9c1]/50 p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono text-[#6e7a73]">
                  {activeStation.code} · {activeStation.stateName}
                </div>
                <h2 className="text-lg font-bold text-[#0b1c30] mt-0.5">
                  {activeStation.city}
                </h2>
                <div className="text-xs text-[#3e4943]">{activeStation.locality}</div>
              </div>
              {fetchingPoint && (
                <Loader2 className="w-4 h-4 animate-spin text-[#006398] shrink-0" />
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#eff4ff] flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#6e7a73] font-semibold">
                  CPCB NAQI Index
                </div>
                <div className={`text-4xl font-extrabold font-mono tabular-nums ${activeColors.textClass}`}>
                  {activeStation.aqi}
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-md text-xs font-bold ${activeColors.badgeBg} ${activeColors.badgeText}`}
              >
                {activeTier}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
              {[
                { label: 'PM2.5', val: activeStation.pm25, unit: 'µg/m³' },
                { label: 'PM10', val: activeStation.pm10, unit: 'µg/m³' },
                { label: 'NO₂', val: activeStation.no2, unit: 'µg/m³' },
                { label: 'SO₂', val: activeStation.so2, unit: 'µg/m³' },
                { label: 'CO', val: activeStation.co, unit: 'mg/m³' },
                { label: 'O₃', val: activeStation.o3, unit: 'µg/m³' },
              ].map((m) => (
                <div key={m.label} className="p-2.5 rounded-lg bg-[#eff4ff]">
                  <div className="text-[10px] text-[#6e7a73] font-semibold">{m.label}</div>
                  <div className="text-sm font-mono font-bold text-[#0b1c30] mt-0.5">
                    {m.val}
                  </div>
                  <div className="text-[10px] text-[#6e7a73]">{m.unit}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-[#3e4943] pt-1 border-t border-[#bdc9c1]/30 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-[#006398]" />
                {activeStation.windKmh} km/h
              </span>
              <span>{activeStation.tempC}°C</span>
              <span>RH {activeStation.humidityPct}%</span>
            </div>

            {user ? (
              <button
                type="button"
                onClick={() => void handlePinToWatchlist()}
                className="w-full py-2.5 bg-[#005d42] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Bookmark className="w-3.5 h-3.5" />
                {pinnedNotice ? 'Pinned to Cloud Watchlist' : 'Pin Station to Watchlist'}
              </button>
            ) : (
              <div className="text-center text-[11px] text-[#6e7a73] pt-1">
                Sign in with Google above to pin stations to your Firestore watchlist.
              </div>
            )}

            {onNavigate && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#bdc9c1]/30">
                <button
                  type="button"
                  onClick={() => {
                    onSelectStation(activeStation);
                    onNavigate('dispersion3d');
                  }}
                  className="py-2 px-2 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[11px] font-semibold text-[#0b1c30] inline-flex items-center justify-center gap-1 transition-colors"
                >
                  <Box className="w-3.5 h-3.5 text-[#005d42]" />
                  <span>3D Twin</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectStation(activeStation);
                    onNavigate('explainer');
                  }}
                  className="py-2 px-2 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[11px] font-semibold text-[#0b1c30] inline-flex items-center justify-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#006398]" />
                  <span>Ask AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectStation(activeStation);
                    onNavigate('visuals');
                  }}
                  className="py-2 px-2 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[11px] font-semibold text-[#0b1c30] inline-flex items-center justify-center gap-1 transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5 text-[#005d42]" />
                  <span>Poster</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#bdc9c1]/50 p-4 space-y-2">
            <div className="text-xs font-bold text-[#0b1c30]">
              Quick Station Jump
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stations.slice(0, 10).map((st) => (
                <button
                  key={st.code}
                  type="button"
                  onClick={() => {
                    setCustomPoint(null);
                    onSelectStation(st);
                    if (map) {
                      map.panTo({ lat: st.lat, lng: st.lng });
                      map.setZoom(10);
                    }
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    activeStation.code === st.code
                      ? 'bg-[#005d42] text-white'
                      : 'bg-[#eff4ff] text-[#0b1c30] hover:bg-[#e5eeff]'
                  }`}
                >
                  {st.city}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IndiaMapView({
  stations,
  focusedStation,
  onSelectStation,
  onNavigate,
  lang,
}: {
  stations: StationTelemetry[];
  focusedStation: StationTelemetry;
  onSelectStation: (st: StationTelemetry) => void;
  onNavigate?: (tab: PortalTab) => void;
  lang: PortalLang;
}) {
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [loaded, setLoaded] = useState<boolean>(
    Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
  );

  useEffect(() => {
    if (mapsApiKey) return;
    let active = true;
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        if (active && typeof d.mapsApiKey === 'string') {
          setMapsApiKey(d.mapsApiKey);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [mapsApiKey]);

  if (!loaded) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 text-center text-xs text-[#3e4943]">
        Initializing Google Maps Platform India layer...
      </div>
    );
  }

  if (!mapsApiKey) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white border border-[#bdc9c1] rounded-xl p-8 text-center">
        <h2 className="text-base font-bold text-[#0b1c30]">
          Google Maps API Key Required
        </h2>
        <p className="text-xs text-[#3e4943] mt-2">
          Configure <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to render the interactive India CAAQMS station map.
        </p>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={mapsApiKey}
      libraries={['places', 'marker']}
      language={lang === 'hi' ? 'hi' : 'en'}
      region="IN"
    >
      <InnerIndiaMap
        stations={stations}
        focusedStation={focusedStation}
        onSelectStation={onSelectStation}
        onNavigate={onNavigate}
        lang={lang}
      />
    </APIProvider>
  );
}
