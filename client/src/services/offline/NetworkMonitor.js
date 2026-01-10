import NetInfo from "@react-native-community/netinfo";
import { NETWORK_DEBOUNCE_MS, NETWORK_STATUS } from "./constants";
import AnalyticsService from "../AnalyticsService";

class NetworkMonitor {
  constructor() {
    this._isOnline = true;
    this._connectionType = null;
    this._listeners = new Set();
    this._unsubscribe = null;
    this._debounceTimeout = null;
    this._lastStatus = null;
  }

  // Initialize the network monitor
  async initialize() {
    // Get initial state
    const state = await NetInfo.fetch();
    this._updateState(state, true);

    // Subscribe to network changes
    this._unsubscribe = NetInfo.addEventListener((state) => {
      this._handleNetworkChange(state);
    });

    return this.getStatus();
  }

  // Clean up
  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
      this._debounceTimeout = null;
    }
    this._listeners.clear();
  }

  // Handle network state changes with debouncing
  _handleNetworkChange(state) {
    // Clear any pending debounce
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
    }

    // Debounce to avoid rapid toggling
    this._debounceTimeout = setTimeout(() => {
      this._updateState(state, false);
    }, NETWORK_DEBOUNCE_MS);
  }

  // Update internal state and notify listeners
  _updateState(state, immediate = false) {
    const wasOnline = this._isOnline;
    this._isOnline = state.isConnected && state.isInternetReachable !== false;
    this._connectionType = state.type;

    const newStatus = this._isOnline ? NETWORK_STATUS.ONLINE : NETWORK_STATUS.OFFLINE;

    // Only notify if status actually changed
    if (this._lastStatus !== newStatus || immediate) {
      this._lastStatus = newStatus;

      // Track offline session start for analytics
      if (wasOnline && !this._isOnline) {
        AnalyticsService.trackOfflineStart();
      }

      // Notify all listeners
      this._listeners.forEach((listener) => {
        try {
          listener({
            isOnline: this._isOnline,
            connectionType: this._connectionType,
            wasOnline,
            status: newStatus,
          });
        } catch (error) {
          console.error("NetworkMonitor listener error:", error);
        }
      });
    }
  }

  // Subscribe to network changes
  subscribe(listener) {
    this._listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this._listeners.delete(listener);
    };
  }

  // Get current status
  getStatus() {
    return {
      isOnline: this._isOnline,
      connectionType: this._connectionType,
      status: this._isOnline ? NETWORK_STATUS.ONLINE : NETWORK_STATUS.OFFLINE,
    };
  }

  // Check if online
  get isOnline() {
    return this._isOnline;
  }

  // Check if offline
  get isOffline() {
    return !this._isOnline;
  }

  // Get connection quality hint
  getConnectionQuality() {
    if (!this._isOnline) return "none";

    switch (this._connectionType) {
      case "wifi":
      case "ethernet":
        return "good";
      case "cellular":
        return "moderate";
      case "none":
      case "unknown":
        return "none";
      default:
        return "unknown";
    }
  }

  // Force refresh network state
  async refresh() {
    const state = await NetInfo.fetch();
    this._updateState(state, true);
    return this.getStatus();
  }
}

// Export singleton instance
export default new NetworkMonitor();
