/**
 * AnalyticsService
 *
 * Frontend analytics tracking service for:
 * - Flow abandonment tracking (user journeys through multi-step flows)
 * - Offline usage tracking
 * - Generic event tracking
 *
 * Events are batched and sent to the backend periodically
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "./config";

const STORAGE_KEY = "@analytics_pending_events";
const STORAGE_SESSION_KEY = "@analytics_session_id";
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 30000; // 30 seconds

class AnalyticsService {
  static pendingEvents = [];
  static sessionId = null;
  static flushTimer = null;
  static authToken = null;
  static isInitialized = false;

  /**
   * Initialize the analytics service
   * @param {string} authToken - Optional auth token for authenticated tracking
   */
  static async initialize(authToken = null) {
    if (this.isInitialized) return;

    this.authToken = authToken;

    // Load or create session ID
    try {
      let sessionId = await AsyncStorage.getItem(STORAGE_SESSION_KEY);
      if (!sessionId) {
        sessionId = this.generateSessionId();
        await AsyncStorage.setItem(STORAGE_SESSION_KEY, sessionId);
      }
      this.sessionId = sessionId;
    } catch (error) {
      console.error("[Analytics] Error loading session:", error);
      this.sessionId = this.generateSessionId();
    }

    // Load any pending events from storage
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.pendingEvents = JSON.parse(stored);
      }
    } catch (error) {
      console.error("[Analytics] Error loading pending events:", error);
    }

    // Start periodic flush
    this.startFlushTimer();
    this.isInitialized = true;
  }

  /**
   * Update auth token (call when user logs in)
   */
  static setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Generate a unique session ID
   */
  static generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start a new session (call on app launch or after logout)
   */
  static async startNewSession() {
    this.sessionId = this.generateSessionId();
    try {
      await AsyncStorage.setItem(STORAGE_SESSION_KEY, this.sessionId);
    } catch (error) {
      console.error("[Analytics] Error saving session:", error);
    }
  }

  // ============================================================================
  // FLOW TRACKING
  // ============================================================================

  /**
   * Track when a user starts a multi-step flow
   * @param {string} flowName - Identifier for the flow (e.g., "home_setup", "user_signup")
   */
  static trackFlowStart(flowName) {
    this.queueEvent("flow_started", "flow_abandonment", {
      flowName,
      stepNumber: 0,
      stepName: "start",
    });
  }

  /**
   * Track when a user completes a step in a flow
   * @param {string} flowName - Identifier for the flow
   * @param {string} stepName - Name of the step completed
   * @param {number} stepNumber - Current step number (1-indexed)
   * @param {number} totalSteps - Total number of steps in the flow
   */
  static trackFlowStep(flowName, stepName, stepNumber, totalSteps) {
    this.queueEvent("flow_step_completed", "flow_abandonment", {
      flowName,
      stepName,
      stepNumber,
      totalSteps,
    });
  }

  /**
   * Track when a user abandons a flow (navigates away without completing)
   * @param {string} flowName - Identifier for the flow
   * @param {string} lastStepName - Name of the last step the user was on
   * @param {number} lastStepNumber - Number of the last step
   * @param {number} totalSteps - Total number of steps in the flow
   */
  static trackFlowAbandon(flowName, lastStepName, lastStepNumber, totalSteps) {
    this.queueEvent("flow_abandoned", "flow_abandonment", {
      flowName,
      lastStepName,
      lastStepNumber,
      totalSteps,
      abandonedAt: new Date().toISOString(),
    });
    // Immediately flush on abandon to ensure it's captured
    this.flushEvents();
  }

  /**
   * Track when a user successfully completes a flow
   * @param {string} flowName - Identifier for the flow
   */
  static trackFlowComplete(flowName) {
    this.queueEvent("flow_completed", "flow_abandonment", {
      flowName,
      completedAt: new Date().toISOString(),
    });
  }

  // ============================================================================
  // OFFLINE TRACKING
  // ============================================================================

  /**
   * Track when the app enters offline mode
   */
  static trackOfflineStart() {
    this.queueEvent("offline_session_started", "offline_usage", {
      startedAt: new Date().toISOString(),
    });
  }

  /**
   * Track when offline data is synced
   * @param {number} syncDurationMs - How long the sync took in milliseconds
   * @param {number} pendingItemCount - Number of items that were synced
   */
  static trackOfflineSync(syncDurationMs, pendingItemCount) {
    this.queueEvent("offline_session_synced", "offline_usage", {
      syncDurationMs,
      pendingItemCount,
      syncedAt: new Date().toISOString(),
    });
  }

  // ============================================================================
  // GENERIC EVENT TRACKING
  // ============================================================================

  /**
   * Track a generic analytics event
   * @param {string} eventType - Type of event
   * @param {string} eventCategory - Category (flow_abandonment, job_duration, offline_usage, disputes, pay_override)
   * @param {object} metadata - Additional event data
   */
  static trackEvent(eventType, eventCategory, metadata = {}) {
    this.queueEvent(eventType, eventCategory, metadata);
  }

  // ============================================================================
  // EVENT QUEUE MANAGEMENT
  // ============================================================================

  /**
   * Add an event to the queue
   */
  static async queueEvent(eventType, eventCategory, metadata) {
    const event = {
      eventType,
      eventCategory,
      metadata,
      sessionId: this.sessionId,
      queuedAt: new Date().toISOString(),
    };

    this.pendingEvents.push(event);

    // Persist to storage
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.pendingEvents));
    } catch (error) {
      console.error("[Analytics] Error saving event:", error);
    }

    // Flush if we've reached batch size
    if (this.pendingEvents.length >= BATCH_SIZE) {
      this.flushEvents();
    }
  }

  /**
   * Start the periodic flush timer
   */
  static startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, FLUSH_INTERVAL_MS);
  }

  /**
   * Stop the flush timer (call on app backgrounding)
   */
  static stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Send all pending events to the server
   */
  static async flushEvents() {
    if (this.pendingEvents.length === 0) return;

    const eventsToSend = [...this.pendingEvents];
    this.pendingEvents = [];

    // Clear storage
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch (error) {
      console.error("[Analytics] Error clearing storage:", error);
    }

    // Send each event to the server
    const headers = {
      "Content-Type": "application/json",
    };
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const failedEvents = [];

    for (const event of eventsToSend) {
      try {
        const response = await fetch(`${API_BASE}/analytics/track`, {
          method: "POST",
          headers,
          body: JSON.stringify(event),
        });

        if (!response.ok) {
          failedEvents.push(event);
        }
      } catch (error) {
        // Network error - save for retry
        failedEvents.push(event);
      }
    }

    // Re-queue failed events
    if (failedEvents.length > 0) {
      this.pendingEvents = [...failedEvents, ...this.pendingEvents];
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.pendingEvents));
      } catch (error) {
        console.error("[Analytics] Error re-saving failed events:", error);
      }
    }
  }

  /**
   * Force flush all events (call on app close/background)
   */
  static async forceFlush() {
    this.stopFlushTimer();
    await this.flushEvents();
  }

  // ============================================================================
  // DASHBOARD DATA FETCHING (for owner dashboard)
  // ============================================================================

  /**
   * Fetch dashboard analytics data
   * @param {string} authToken - Owner auth token
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   */
  static async fetchDashboardStats(authToken, startDate, endDate) {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(`${API_BASE}/analytics/dashboard?${params.toString()}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard stats: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[Analytics] Dashboard fetch error:", error);
      throw error;
    }
  }

  /**
   * Fetch flow abandonment stats
   */
  static async fetchFlowAbandonmentStats(authToken, startDate, endDate, flowName = null) {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (flowName) params.append("flowName", flowName);

      const response = await fetch(`${API_BASE}/analytics/flow-abandonment?${params.toString()}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch flow stats: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[Analytics] Flow abandonment fetch error:", error);
      throw error;
    }
  }

  /**
   * Fetch trend data for a category
   */
  static async fetchTrend(authToken, category, startDate, endDate) {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(`${API_BASE}/analytics/trend/${category}?${params.toString()}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch trend: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[Analytics] Trend fetch error:", error);
      throw error;
    }
  }
}

export default AnalyticsService;
