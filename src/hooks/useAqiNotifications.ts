import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AQI_TIER_RANK,
  getCpcbTier,
  type AqiTier,
  type PortalLang,
  type StationTelemetry,
} from '../data/indiaStations';

export type BrowserPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface StationWorseningAlert {
  id: string;
  stationCode: string;
  city: string;
  locality: string;
  prevTier: AqiTier;
  newTier: AqiTier;
  prevAqi: number;
  newAqi: number;
  timestamp: number;
  read: boolean;
  isSimulated?: boolean;
}

const STORAGE_ENABLED_KEY = 'breathe_india_aqi_alerts_enabled';
const STORAGE_SOUND_KEY = 'breathe_india_aqi_sound_enabled';
const STORAGE_HISTORY_KEY = 'breathe_india_worsening_alerts';

function readInitialPermission(): BrowserPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

function readBoolStorage(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

function readHistoryStorage(): StationWorseningAlert[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function playAlertTone() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(660, now);
    osc1.frequency.setValueAtTime(880, now + 0.12);
    gain1.gain.setValueAtTime(0.06, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);
    setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 500);
  } catch {
    // Ignore autoplay restrictions
  }
}

export function useAqiNotifications({
  focusedStation,
  lang,
  onSelectAlertStation,
}: {
  focusedStation: StationTelemetry;
  lang: PortalLang;
  onSelectAlertStation?: (stationCode: string) => void;
}) {
  const [permission, setPermission] = useState<BrowserPermissionState>(readInitialPermission);
  const [alertsEnabled, setAlertsEnabledState] = useState<boolean>(() =>
    readBoolStorage(STORAGE_ENABLED_KEY, true)
  );
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() =>
    readBoolStorage(STORAGE_SOUND_KEY, true)
  );
  const [worseningAlerts, setWorseningAlerts] = useState<StationWorseningAlert[]>(
    readHistoryStorage
  );
  const [activeToast, setActiveToast] = useState<StationWorseningAlert | null>(null);

  const lastObservedRef = useRef<{
    code: string;
    tier: AqiTier;
    aqi: number;
  } | null>(null);
  const nextTransitionSimulatedRef = useRef<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);

  // Sync permission state if user changed browser permissions externally
  useEffect(() => {
    const syncPermission = () => {
      setPermission(readInitialPermission());
    };
    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);
    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, []);

  const setAlertsEnabled = useCallback((next: boolean) => {
    setAlertsEnabledState(next);
    try {
      window.localStorage.setItem(STORAGE_ENABLED_KEY, String(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  const setSoundEnabled = useCallback((next: boolean) => {
    setSoundEnabledState(next);
    try {
      window.localStorage.setItem(STORAGE_SOUND_KEY, String(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  const persistHistory = useCallback((items: StationWorseningAlert[]) => {
    try {
      window.localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
    } catch {
      // ignore storage errors
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<BrowserPermissionState> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return 'unsupported';
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setAlertsEnabled(true);
      }
      return result;
    } catch {
      const current = Notification.permission;
      setPermission(current);
      return current;
    }
  }, [setAlertsEnabled]);

  const dismissToast = useCallback(() => {
    setActiveToast(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const markAllRead = useCallback(() => {
    setWorseningAlerts((prev) => {
      const updated = prev.map((item) => ({ ...item, read: true }));
      persistHistory(updated);
      return updated;
    });
  }, [persistHistory]);

  const clearHistory = useCallback(() => {
    setWorseningAlerts([]);
    persistHistory([]);
    dismissToast();
  }, [dismissToast, persistHistory]);

  const markNextTransitionSimulated = useCallback(() => {
    nextTransitionSimulatedRef.current = true;
  }, []);

  const dispatchBrowserNotification = useCallback(
    (entry: StationWorseningAlert) => {
      if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        Notification.permission !== 'granted'
      ) {
        return;
      }
      const title =
        lang === 'hi'
          ? `वायु गुणवत्ता चेतावनी: ${entry.city} (${entry.newTier})`
          : `AQI Alert: ${entry.city} worsened to ${entry.newTier}`;
      const body =
        lang === 'hi'
          ? `${entry.locality} स्टेशन पर AQI ${entry.prevTier} (${entry.prevAqi}) से बिगड़कर ${entry.newTier} (${entry.newAqi}) हो गया है।`
          : `${entry.locality} (${entry.stationCode}) shifted from ${entry.prevTier} (AQI ${entry.prevAqi}) to ${entry.newTier} (AQI ${entry.newAqi}).`;

      try {
        const notification = new Notification(title, {
          body,
          tag: `breathe-india-aqi-${entry.stationCode}`,
          requireInteraction:
            entry.newTier === 'Very Poor' || entry.newTier === 'Severe',
        });
        notification.onclick = () => {
          window.focus();
          onSelectAlertStation?.(entry.stationCode);
          notification.close();
        };
      } catch {
        // Some sandboxed/iframe contexts restrict new Notification(); in-app toast remains visible
      }
    },
    [lang, onSelectAlertStation]
  );

  // Watch the currently focused station for AQI category worsening
  useEffect(() => {
    const currentTier = getCpcbTier(focusedStation.aqi);
    const prev = lastObservedRef.current;

    if (!prev || prev.code !== focusedStation.code) {
      lastObservedRef.current = {
        code: focusedStation.code,
        tier: currentTier,
        aqi: focusedStation.aqi,
      };
      nextTransitionSimulatedRef.current = false;
      return;
    }

    const worsened = AQI_TIER_RANK[currentTier] > AQI_TIER_RANK[prev.tier];
    const isSimulated = nextTransitionSimulatedRef.current;
    nextTransitionSimulatedRef.current = false;

    if (worsened && alertsEnabled) {
      const entry: StationWorseningAlert = {
        id: `aqi-shift-${focusedStation.code}-${Date.now()}`,
        stationCode: focusedStation.code,
        city: focusedStation.city,
        locality: focusedStation.locality,
        prevTier: prev.tier,
        newTier: currentTier,
        prevAqi: prev.aqi,
        newAqi: focusedStation.aqi,
        timestamp: Date.now(),
        read: false,
        isSimulated,
      };

      setWorseningAlerts((history) => {
        const nextHistory = [entry, ...history].slice(0, 20);
        persistHistory(nextHistory);
        return nextHistory;
      });
      setActiveToast(entry);
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setActiveToast(null);
      }, 14000);

      if (soundEnabled) {
        playAlertTone();
      }
      dispatchBrowserNotification(entry);
    }

    lastObservedRef.current = {
      code: focusedStation.code,
      tier: currentTier,
      aqi: focusedStation.aqi,
    };
  }, [
    alertsEnabled,
    dispatchBrowserNotification,
    focusedStation.aqi,
    focusedStation.city,
    focusedStation.code,
    focusedStation.locality,
    persistHistory,
    soundEnabled,
  ]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const unreadCount = worseningAlerts.filter((a) => !a.read).length;

  return {
    permission,
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
  };
}
