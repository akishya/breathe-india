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
import {
  Bookmark,
  Compass,
  ExternalLink,
  Loader2,
  MapPin,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  deletePinnedPlace,
  savePinnedPlace,
  subscribeUserPlaces,
} from '../lib/firebase';
import type { GroundingSource, SavedPlace } from '../types/studio';

interface SelectedPlaceDetails {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingCount?: number;
  websiteURI?: string;
}

interface PlacesSessionTokenLike {
  readonly __brand?: 'AutocompleteSessionToken';
}

interface PlacesPlaceLike {
  id?: string;
  displayName?: string;
  formattedAddress?: string;
  location?: { lat: () => number; lng: () => number };
  viewport?: Parameters<NonNullable<ReturnType<typeof useMap>>['fitBounds']>[0];
  rating?: number | null;
  userRatingCount?: number | null;
  websiteURI?: string | null;
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
    }) => Promise<{ suggestions?: PlacesSuggestionLike[] }>;
  };
}

function triggerQuotaExceededIfApplicable(err: unknown) {
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

function useAutocompleteSuggestions(inputString: string) {
  const placesLib = useMapsLibrary('places') as unknown as PlacesLibraryLike | null;
  const sessionTokenRef = useRef<PlacesSessionTokenLike | null>(null);
  const [suggestions, setSuggestions] = useState<PlacesSuggestionLike[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!placesLib) return;
    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;

    if (!inputString.trim()) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(() => {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: inputString,
        sessionToken: sessionTokenRef.current ?? undefined,
      })
        .then((res) => {
          if (!cancelled) {
            setSuggestions(res.suggestions ?? []);
            setIsLoading(false);
          }
        })
        .catch((err: unknown) => {
          triggerQuotaExceededIfApplicable(err);
          if (!cancelled) {
            setSuggestions([]);
            setIsLoading(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, inputString]);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
  }, []);

  return { suggestions, isLoading, resetSession };
}

function PlaceSearchBar({
  onSelectPlace,
}: {
  onSelectPlace: (place: SelectedPlaceDetails) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const [queryText, setQueryText] = useState('');
  const { suggestions, isLoading, resetSession } =
    useAutocompleteSuggestions(queryText);

  const handleChooseSuggestion = async (suggestion: PlacesSuggestionLike) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'viewport',
          'rating',
          'userRatingCount',
          'websiteURI',
        ],
      });

      const loc = place.location;
      if (loc) {
        const lat = loc.lat();
        const lng = loc.lng();
        if (map) {
          if (place.viewport) {
            map.fitBounds(place.viewport);
          } else {
            map.panTo({ lat, lng });
            map.setZoom(15);
          }
        }
        onSelectPlace({
          placeId: place.id || `${lat.toFixed(5)}_${lng.toFixed(5)}`,
          name: place.displayName || suggestion.placePrediction.text.text,
          address: place.formattedAddress || 'Selected location',
          lat,
          lng,
          rating: place.rating ?? undefined,
          userRatingCount: place.userRatingCount ?? undefined,
          websiteURI: place.websiteURI ?? undefined,
        });
      }
      setQueryText('');
      resetSession();
    } catch (err) {
      triggerQuotaExceededIfApplicable(err);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search places, landmarks, or addresses..."
          className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
        />
        {isLoading && (
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>

      {suggestions.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
          {suggestions.map((s, idx) => (
            <li key={idx}>
              <button
                type="button"
                onClick={() => void handleChooseSuggestion(s)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex items-start gap-2.5"
              >
                <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-800">
                  {s.placePrediction?.text.text}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivePlaceMarker({
  place,
  isOpen,
  onToggle,
  onSave,
  canSave,
  savedNotice,
}: {
  place: SelectedPlaceDetails;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onSave: () => void;
  canSave: boolean;
  savedNotice: boolean;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: place.lat, lng: place.lng }}
        onClick={() => onToggle(true)}
        title={place.name}
      >
        <Pin background="#0284c7" glyphColor="#ffffff" borderColor="#0369a1" />
      </AdvancedMarker>
      {isOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => onToggle(false)}>
          <div className="max-w-xs p-1 text-slate-900 space-y-1.5">
            <div className="text-sm font-semibold">{place.name}</div>
            <div className="text-xs text-slate-600">{place.address}</div>
            {typeof place.rating === 'number' && (
              <div className="text-xs text-slate-700 font-medium tabular-nums">
                Rating: {place.rating.toFixed(1)}
                {place.userRatingCount ? ` (${place.userRatingCount.toLocaleString()} reviews)` : ''}
              </div>
            )}
            <div className="pt-1 flex items-center gap-2">
              {canSave && (
                <button
                  type="button"
                  onClick={onSave}
                  className="px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-800 inline-flex items-center gap-1"
                >
                  <Bookmark className="w-3 h-3" />
                  {savedNotice ? 'Pinned' : 'Pin to Library'}
                </button>
              )}
              {place.websiteURI && (
                <a
                  href={place.websiteURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky-700 underline inline-flex items-center gap-1"
                >
                  Website <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function SavedPlaceMarker({
  place,
  onSelectSaved,
}: {
  place: SavedPlace;
  onSelectSaved: (p: SavedPlace) => void;
}) {
  return (
    <AdvancedMarker
      position={{ lat: place.lat, lng: place.lng }}
      onClick={() => onSelectSaved(place)}
      title={place.name}
    >
      <Pin background="#0f172a" glyphColor="#38bdf8" borderColor="#334155" />
    </AdvancedMarker>
  );
}

function MapsInnerExplorer({
  savedPlaces,
  userUid,
}: {
  savedPlaces: SavedPlace[];
  userUid: string | null;
}) {
  const map = useMap();
  const [selectedPlace, setSelectedPlace] =
    useState<SelectedPlaceDetails | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 37.7749,
    lng: -122.4194,
  });

  // Gemini Maps Grounding local discovery state
  const [groundingPrompt, setGroundingPrompt] = useState('');
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [groundingReply, setGroundingReply] = useState<string | null>(null);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [groundingError, setGroundingError] = useState<string | null>(null);

  const handleSelectPlace = (place: SelectedPlaceDetails) => {
    setSelectedPlace(place);
    setInfoOpen(true);
    setSavedNotice(false);
    setMapCenter({ lat: place.lat, lng: place.lng });
  };

  const handleSaveSelected = async () => {
    if (!userUid || !selectedPlace) return;
    await savePinnedPlace({
      ownerId: userUid,
      placeId: selectedPlace.placeId,
      name: selectedPlace.name,
      address: selectedPlace.address,
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
    });
    setSavedNotice(true);
  };

  const handleSelectSaved = (p: SavedPlace) => {
    if (map) {
      map.panTo({ lat: p.lat, lng: p.lng });
      map.setZoom(15);
    }
    setSelectedPlace({
      placeId: p.placeId,
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
    });
    setInfoOpen(true);
    setMapCenter({ lat: p.lat, lng: p.lng });
  };

  const handleLocalGroundingSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groundingPrompt.trim() || groundingLoading) return;
    setGroundingLoading(true);
    setGroundingError(null);

    try {
      const center = map?.getCenter();
      const latLng = center
        ? { lat: center.lat(), lng: center.lng() }
        : mapCenter;

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-4-hydrogen',
          groundingMode: 'maps',
          latLng,
          messages: [{ role: 'user', text: groundingPrompt.trim() }],
        }),
      });
      if (resp.status === 429) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Maps grounding request failed.');
      }
      setGroundingReply(data.text || '');
      setGroundingSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (err) {
      setGroundingError(
        err instanceof Error ? err.message : 'Unable to query nearby places.'
      );
    } finally {
      setGroundingLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left 7 Columns: Search + Interactive Google Map */}
      <div className="xl:col-span-7 space-y-3">
        <PlaceSearchBar onSelectPlace={handleSelectPlace} />

        <div className="w-full h-[560px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
          <GoogleMap
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            defaultCenter={{ lat: 37.7749, lng: -122.4194 }}
            defaultZoom={12}
            gestureHandling="greedy"
            onIdle={(ev) => {
              const c = ev.map.getCenter();
              if (c) {
                setMapCenter({ lat: c.lat(), lng: c.lng() });
              }
            }}
            className="w-full h-full"
          >
            {selectedPlace && (
              <ActivePlaceMarker
                place={selectedPlace}
                isOpen={infoOpen}
                onToggle={setInfoOpen}
                onSave={() => void handleSaveSelected()}
                canSave={Boolean(userUid)}
                savedNotice={savedNotice}
              />
            )}
            {savedPlaces.map((p) => (
              <SavedPlaceMarker
                key={p.id}
                place={p}
                onSelectSaved={handleSelectSaved}
              />
            ))}
          </GoogleMap>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="font-mono tabular-nums">
            Viewport Center: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
          </span>
          {selectedPlace && userUid && (
            <button
              type="button"
              onClick={() => void handleSaveSelected()}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-xs font-medium hover:bg-slate-800 inline-flex items-center gap-1.5"
            >
              <Bookmark className="w-3.5 h-3.5" />
              {savedNotice ? 'Pinned to Library' : `Pin "${selectedPlace.name}"`}
            </button>
          )}
        </div>
      </div>

      {/* Right 5 Columns: Gemini Maps Grounding + Pinned Places */}
      <div className="xl:col-span-5 space-y-5">
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Local Discovery via Gemini Maps Grounding
            </h3>
          </div>
          <p className="text-xs text-slate-600">
            Ask about places around the current map center. Results are grounded directly in live Google Maps data.
          </p>

          <form onSubmit={handleLocalGroundingSearch} className="flex gap-2">
            <input
              type="text"
              value={groundingPrompt}
              onChange={(e) => setGroundingPrompt(e.target.value)}
              placeholder="e.g., Quiet coffee shops with outdoor seating nearby"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-400"
            />
            <button
              type="submit"
              disabled={groundingLoading || !groundingPrompt.trim()}
              className="px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
            >
              {groundingLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Explore
            </button>
          </form>

          {groundingError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              {groundingError}
            </div>
          )}

          {groundingReply && (
            <div className="space-y-3 pt-1">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                {groundingReply}
              </div>
              {groundingSources.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-slate-500">
                    Grounded Google Maps Links
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {groundingSources.map((src, idx) => (
                      <a
                        key={`${src.uri}-${idx}`}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-2.5 bg-white border border-slate-200 rounded-lg hover:border-sky-300 transition-colors"
                      >
                        <div className="text-xs font-medium text-sky-700 flex items-center justify-between gap-2">
                          <span className="truncate">{src.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </div>
                        {src.reviewSnippets && src.reviewSnippets.length > 0 && (
                          <div className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                            {src.reviewSnippets[0]}
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Pinned Places ({savedPlaces.length})
            </h3>
            {!userUid && (
              <span className="text-[11px] text-slate-500">Sign in to save pins</span>
            )}
          </div>

          {savedPlaces.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Search a place on the map and pin it to keep quick waypoints here.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-60 overflow-y-auto">
              {savedPlaces.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-slate-50"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectSaved(p)}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">
                      {p.address}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deletePinnedPlace(p.id)}
                    title="Delete pin"
                    className="p-1.5 text-slate-400 hover:text-red-600 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function MapsExplorerWorkspace() {
  const { user, authReady } = useAuth();
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [configLoaded, setConfigLoaded] = useState<boolean>(
    Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
  );
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);

  useEffect(() => {
    if (mapsApiKey) return;
    let active = true;
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (active && typeof data.mapsApiKey === 'string') {
          setMapsApiKey(data.mapsApiKey);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setConfigLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [mapsApiKey]);

  useEffect(() => {
    if (!authReady || !user) {
      setSavedPlaces([]);
      return;
    }
    return subscribeUserPlaces(user.uid, setSavedPlaces, () => undefined);
  }, [authReady, user]);

  if (!configLoaded) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-600">
        Loading Google Maps configuration...
      </div>
    );
  }

  if (!mapsApiKey) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto">
        <h2 className="text-base font-semibold text-slate-900">
          Google Maps API Key Not Configured
        </h2>
        <p className="text-xs text-slate-600 mt-2">
          Add <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> in the environment configuration to enable the interactive map and Places Autocomplete search.
        </p>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={mapsApiKey}
      libraries={['places', 'marker']}
      language="en"
      region="US"
    >
      <MapsInnerExplorer savedPlaces={savedPlaces} userUid={user?.uid ?? null} />
    </APIProvider>
  );
}
