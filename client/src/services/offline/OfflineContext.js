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
  const [initializationFailed, setInitializationFailed] = useState(false); // Distinct from isInitialized
  const [error, setError] = useState(null);
  const [autoSyncEvent, setAutoSyncEvent] = useState(null);
  const [offlineDurationExceeded, setOfflineDurationExceeded] = useState(false); // Tracks if max offline duration exceeded

  const offlineTimerRef = useRef(null);
  const autoSyncEventTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Initialize the offline system
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Initialize network monitor
        const status = await NetworkMonitor.initialize();
        if (!mounted) return;

        // Validate status object before using (defensive against null/undefined)
        if (status && typeof status === "object") {
          setNetworkStatus(status.status || NETWORK_STATUS.UNKNOWN);
          setIsOnline(status.isOnline !== false); // Default to online if undefined
        } else {
          console.warn("[OfflineContext] NetworkMonitor returned invalid status, using defaults");
          setNetworkStatus(NETWORK_STATUS.UNKNOWN);
          setIsOnline(true); // Assume online if we can't determine
        }
        setIsInitialized(true);
      } catch (err) {
        console.error("Failed to initialize offline system:", err);
        if (mounted) {
          setError(err);
          setInitializationFailed(true);
          // Still set isInitialized to true to unblock waiting components
          // but initializationFailed indicates the error state
          setIsInitialized(true);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      isMountedRef.current = false;
      NetworkMonitor.destroy();
      if (offlineTimerRef.current) {
        clearInterval(offlineTimerRef.current);
      }
    };
  }, []);

  // Refresh pending sync count - defined before useEffects that depend on it
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingSyncCount(count);
    } catch (err) {
      console.error("Failed to get pending sync count:", err);
    }
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
        // Don't clear offlineSince here - wait until sync completes successfully
        // This prevents incorrect offline duration if sync fails or retries
        // Trigger automatic sync when coming back online
        // Handle promise rejection to prevent unhandled rejection errors
        AutoSyncOrchestrator.onConnectivityRestored().catch((error) => {
          console.error("[OfflineContext] Auto-sync failed on connectivity restored:", error);
          // Propagate error to UI state so components can display the failure
          // This handles cases where the orchestrator couldn't emit an event
          if (isMountedRef.current) {
            setSyncStatus(SYNC_STATUS.ERROR);
            setAutoSyncEvent({
              type: "sync_error",
              error: error.message || "Auto-sync failed unexpectedly",
              isInitialSyncError: true, // Flag to indicate this was during initial trigger
            });
          }
        });
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
          // Clear offlineSince now that sync has completed successfully
          setOfflineSince(null);
          // Auto-clear completed status after 3 seconds
          if (autoSyncEventTimerRef.current) {
            clearTimeout(autoSyncEventTimerRef.current);
          }
          autoSyncEventTimerRef.current = setTimeout(() => {
            // Check if still mounted to prevent state updates on unmounted component
            if (isMountedRef.current) {
              setSyncStatus(SYNC_STATUS.IDLE);
              setAutoSyncEvent(null);
            }
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

  // Track offline duration and notify UI when exceeded
  useEffect(() => {
    if (offlineSince) {
      // Check immediately
      const checkDuration = () => {
        const duration = Date.now() - offlineSince.getTime();
        if (duration >= MAX_OFFLINE_DURATION_MS && !offlineDurationExceeded) {
          console.warn("[OfflineContext] Exceeded maximum offline duration");
          setOfflineDurationExceeded(true);
        }
      };

      // Check immediately on mount
      checkDuration();

      // Then check every minute
      offlineTimerRef.current = setInterval(checkDuration, 60000);

      return () => {
        if (offlineTimerRef.current) {
          clearInterval(offlineTimerRef.current);
        }
      };
    } else {
      // Reset exceeded flag when no longer offline
      if (offlineDurationExceeded) {
        setOfflineDurationExceeded(false);
      }
    }
  }, [offlineSince, offlineDurationExceeded]);

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
    initializationFailed, // True if initialization was attempted but failed
    error,
    autoSyncEvent,
    offlineDurationExceeded, // True if offline for longer than MAX_OFFLINE_DURATION_MS

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

// Default values when provider is not available (assumes online)
// These defaults allow components to render without crashing when OfflineProvider is missing
const DEFAULT_OFFLINE_CONTEXT = {
  isOnline: true,
  isOffline: false,
  networkStatus: "online",
  syncStatus: "idle",
  pendingSyncCount: 0,
  isInitialized: true,
  initializationFailed: false,
  error: null,
  offlineSince: null,
  autoSyncEvent: null,
  offlineDurationExceeded: false,
  // Methods that log warnings when called without provider
  updateSyncStatus: (status) => {
    console.warn("[OfflineContext] updateSyncStatus called without OfflineProvider:", status);
  },
  refreshPendingCount: async () => {
    console.warn("[OfflineContext] refreshPendingCount called without OfflineProvider");
    return 0;
  },
  getOfflineDuration: () => 0,
  isOfflineDurationExceeded: () => false,
  triggerManualSync: async () => {
    console.warn("[OfflineContext] triggerManualSync called without OfflineProvider");
    return { success: false, error: "OfflineProvider not available" };
  },
  database: null,
};

// Hook to use offline context
export function useOffline() {
  const context = useContext(OfflineContext);
  // Return default values if provider is not available (graceful degradation)
  if (!context) {
    return DEFAULT_OFFLINE_CONTEXT;
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
