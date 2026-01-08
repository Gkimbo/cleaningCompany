import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import NetworkMonitor from "./NetworkMonitor";
import AutoSyncOrchestrator from "./AutoSyncOrchestrator";
import database, { getPendingSyncCount } from "./database";
import { NETWORK_STATUS, SYNC_STATUS, MAX_OFFLINE_DURATION_MS } from "./constants";

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [networkStatus, setNetworkStatus] = useState(NETWORK_STATUS.UNKNOWN);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.IDLE);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [offlineSince, setOfflineSince] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [autoSyncEvent, setAutoSyncEvent] = useState(null);

  const offlineTimerRef = useRef(null);
  const autoSyncEventTimerRef = useRef(null);

  // Initialize the offline system
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Initialize network monitor
        const status = await NetworkMonitor.initialize();
        if (!mounted) return;

        setNetworkStatus(status.status);
        setIsOnline(status.isOnline);
        setIsInitialized(true);
      } catch (err) {
        console.error("Failed to initialize offline system:", err);
        if (mounted) {
          setError(err);
          setIsInitialized(true);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      NetworkMonitor.destroy();
      if (offlineTimerRef.current) {
        clearInterval(offlineTimerRef.current);
      }
    };
  }, []);

  // Subscribe to network changes
  useEffect(() => {
    const unsubscribe = NetworkMonitor.subscribe((state) => {
      setNetworkStatus(state.status);
      setIsOnline(state.isOnline);

      // Track when we went offline
      if (!state.isOnline && state.wasOnline) {
        setOfflineSince(new Date());
        // Cancel any pending retries when going offline
        AutoSyncOrchestrator.cancelPendingRetry();
      } else if (state.isOnline && !state.wasOnline) {
        setOfflineSince(null);
        // Trigger automatic sync when coming back online
        AutoSyncOrchestrator.onConnectivityRestored();
      }
    });

    return unsubscribe;
  }, []);

  // Subscribe to AutoSyncOrchestrator events
  useEffect(() => {
    const unsubscribe = AutoSyncOrchestrator.subscribe((event) => {
      setAutoSyncEvent(event);

      // Update sync status based on event
      switch (event.type) {
        case "sync_started":
          setSyncStatus(SYNC_STATUS.SYNCING);
          break;
        case "sync_completed":
          setSyncStatus(SYNC_STATUS.COMPLETED);
          refreshPendingCount();
          // Auto-clear completed status after 3 seconds
          if (autoSyncEventTimerRef.current) {
            clearTimeout(autoSyncEventTimerRef.current);
          }
          autoSyncEventTimerRef.current = setTimeout(() => {
            setSyncStatus(SYNC_STATUS.IDLE);
            setAutoSyncEvent(null);
          }, 3000);
          break;
        case "sync_error":
        case "sync_gave_up":
          setSyncStatus(SYNC_STATUS.ERROR);
          refreshPendingCount();
          break;
        default:
          break;
      }
    });

    return () => {
      unsubscribe();
      if (autoSyncEventTimerRef.current) {
        clearTimeout(autoSyncEventTimerRef.current);
      }
    };
  }, [refreshPendingCount]);

  // Track offline duration
  useEffect(() => {
    if (offlineSince) {
      offlineTimerRef.current = setInterval(() => {
        const duration = Date.now() - offlineSince.getTime();
        if (duration >= MAX_OFFLINE_DURATION_MS) {
          // Exceeded max offline duration - will be handled by UI
          console.warn("Exceeded maximum offline duration");
        }
      }, 60000); // Check every minute

      return () => {
        if (offlineTimerRef.current) {
          clearInterval(offlineTimerRef.current);
        }
      };
    }
  }, [offlineSince]);

  // Refresh pending sync count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingSyncCount(count);
    } catch (err) {
      console.error("Failed to get pending sync count:", err);
    }
  }, []);

  // Update sync status
  const updateSyncStatus = useCallback((status) => {
    setSyncStatus(status);
    if (status === SYNC_STATUS.COMPLETED || status === SYNC_STATUS.ERROR) {
      refreshPendingCount();
    }
  }, [refreshPendingCount]);

  // Get offline duration in milliseconds
  const getOfflineDuration = useCallback(() => {
    if (!offlineSince) return 0;
    return Date.now() - offlineSince.getTime();
  }, [offlineSince]);

  // Check if offline duration exceeded max
  const isOfflineDurationExceeded = useCallback(() => {
    return getOfflineDuration() >= MAX_OFFLINE_DURATION_MS;
  }, [getOfflineDuration]);

  // Trigger manual sync (bypasses cooldown)
  const triggerManualSync = useCallback(async () => {
    return AutoSyncOrchestrator.triggerManualSync();
  }, []);

  const value = {
    // State
    networkStatus,
    isOnline,
    isOffline: !isOnline,
    syncStatus,
    pendingSyncCount,
    offlineSince,
    isInitialized,
    error,
    autoSyncEvent,

    // Actions
    refreshPendingCount,
    updateSyncStatus,
    getOfflineDuration,
    isOfflineDurationExceeded,
    triggerManualSync,

    // Database access
    database,
  };

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

// Hook to use offline context
export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}

// Hook for just network status (lighter weight)
export function useNetworkStatus() {
  const { isOnline, networkStatus, isOffline } = useOffline();
  return { isOnline, networkStatus, isOffline };
}

// Hook for sync status
export function useSyncStatus() {
  const { syncStatus, pendingSyncCount, updateSyncStatus } = useOffline();
  return { syncStatus, pendingSyncCount, updateSyncStatus };
}

export default OfflineContext;
