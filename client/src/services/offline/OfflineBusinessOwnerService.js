/**
 * OfflineBusinessOwnerService
 * Offline-aware wrapper around BusinessOwnerService
 * Provides cached access to employees, assignments, and dashboard data when offline.
 */

import { Q } from "@nozbe/watermelondb";
import BusinessOwnerService from "../fetchRequests/BusinessOwnerService";
import NetworkMonitor from "./NetworkMonitor";
import database, {
  offlineEmployeesCollection,
  offlineOwnerAssignmentsCollection,
  offlineDashboardCacheCollection,
} from "./database";
import { CACHE_KEYS } from "./database/models/OfflineDashboardCache";
import { FIFTEEN_MINUTES_MS, DATA_FRESHNESS_THRESHOLD_MS } from "./constants";

// Timeout for preload operations (30 seconds)
const PRELOAD_TIMEOUT_MS = 30 * 1000;

// Utility to add timeout to a promise
// Properly cleans up the timer to prevent memory leaks and test warnings
const withTimeout = (promise, timeoutMs, operationName = "Operation") => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
};

// Cache duration in milliseconds
const CACHE_DURATION = {
  employees: 30 * 60 * 1000, // 30 minutes
  assignments: FIFTEEN_MINUTES_MS, // 15 minutes
  dashboard: FIFTEEN_MINUTES_MS, // 15 minutes
  calendar: 30 * 60 * 1000, // 30 minutes
};

class OfflineBusinessOwnerService {
  constructor() {
    this._authToken = null;
    this._lastPreloadTime = null;
  }

  setAuthToken(token) {
    this._authToken = token;
  }

  // =====================
  // EMPLOYEES
  // =====================

  /**
   * Get employees - uses server when online, local cache when offline
   */
  async getEmployees(token, status = null) {
    if (NetworkMonitor.isOnline) {
      try {
        const result = await BusinessOwnerService.getEmployees(token, status);
        // Cache the result in background
        this._cacheEmployees(result.employees || []).catch(err => console.error("[OfflineBusinessOwnerService] Background employee caching failed:", err));
        return result;
      } catch (error) {
        console.warn("Online fetch failed, falling back to offline data:", error);
      }
    }

    // Fall back to local cache
    const employees = await this._getLocalEmployees(status);
    return {
      employees,
      isOfflineData: true,
      dataFreshness: await this._getCacheFreshness(CACHE_KEYS.employees()),
    };
  }

  /**
   * Get a specific employee
   */
  async getEmployee(token, employeeId) {
    if (NetworkMonitor.isOnline) {
      try {
        return await BusinessOwnerService.getEmployee(token, employeeId);
      } catch (error) {
        console.warn("Online fetch failed, falling back to offline data:", error);
      }
    }

    // Query directly by serverId (more efficient than fetching all and filtering in JS)
    const employees = await offlineEmployeesCollection
      .query(Q.where("server_id", employeeId))
      .fetch();
    const employee = employees[0];
    if (!employee) return null;

    return {
      employee: this._formatLocalEmployee(employee),
      isOfflineData: true,
    };
  }

  // =====================
  // ASSIGNMENTS
  // =====================

  /**
   * Get assignments - uses server when online, local cache when offline
   */
  async getAssignments(token, filters = {}) {
    if (NetworkMonitor.isOnline) {
      try {
        const result = await BusinessOwnerService.getAssignments(token, filters);
        // Cache the result in background
        this._cacheAssignments(result.assignments || []).catch(err => console.error("[OfflineBusinessOwnerService] Background assignment caching failed:", err));
        return result;
      } catch (error) {
        console.warn("Online fetch failed, falling back to offline data:", error);
      }
    }

    // Fall back to local cache
    const assignments = await this._getLocalAssignments(filters);
    return {
      assignments,
      isOfflineData: true,
      dataFreshness: await this._getCacheFreshness(CACHE_KEYS.employees()), // Use employees cache as proxy for data freshness
    };
  }

  // =====================
  // DASHBOARD & CALENDAR
  // =====================

  /**
   * Get dashboard - uses server when online, cache when offline
   */
  async getDashboard(token) {
    const cacheKey = CACHE_KEYS.dashboard();

    if (NetworkMonitor.isOnline) {
      try {
        const result = await BusinessOwnerService.getDashboard(token);
        // Cache the result
        await this._setCache(cacheKey, result, CACHE_DURATION.dashboard);
        return result;
      } catch (error) {
        console.warn("Online fetch failed, falling back to cache:", error);
      }
    }

    // Fall back to cache
    const cached = await this._getCache(cacheKey);
    if (cached) {
      return {
        ...cached.data,
        isOfflineData: true,
        cachedAt: cached.cachedAt,
      };
    }

    return {
      overview: {},
      employees: [],
      recentActivity: [],
      isOfflineData: true,
      message: "Dashboard data not available offline",
    };
  }

  /**
   * Get calendar - uses server when online, cache when offline
   */
  async getCalendar(token, month, year) {
    const cacheKey = CACHE_KEYS.calendar(month, year);

    if (NetworkMonitor.isOnline) {
      try {
        const result = await BusinessOwnerService.getCalendar(token, month, year);
        // Cache the result
        await this._setCache(cacheKey, result, CACHE_DURATION.calendar);
        return result;
      } catch (error) {
        console.warn("Online fetch failed, falling back to cache:", error);
      }
    }

    // Fall back to cache
    const cached = await this._getCache(cacheKey);
    if (cached) {
      return {
        ...cached.data,
        isOfflineData: true,
        cachedAt: cached.cachedAt,
      };
    }

    return {
      assignments: [],
      employees: [],
      unassignedJobs: [],
      isOfflineData: true,
      message: "Calendar data not available offline",
    };
  }

  // =====================
  // PRELOAD FOR OFFLINE
  // =====================

  /**
   * Preload all data needed for offline use
   */
  async preloadForOffline(token) {
    if (!NetworkMonitor.isOnline) {
      return { success: false, reason: "offline" };
    }

    try {
      // Fetch all data in parallel with timeout protection
      const [employees, assignments, dashboard] = await withTimeout(
        Promise.all([
          BusinessOwnerService.getEmployees(token),
          BusinessOwnerService.getAssignments(token, { upcoming: true }),
          BusinessOwnerService.getDashboard(token),
          this._preloadCurrentAndNextMonthCalendars(token), // Calendars cached inside method
        ]),
        PRELOAD_TIMEOUT_MS,
        "Preload for offline"
      );

      // Cache everything
      await Promise.all([
        this._cacheEmployees(employees.employees || []),
        this._cacheAssignments(assignments.assignments || []),
        this._setCache(CACHE_KEYS.dashboard(), dashboard, CACHE_DURATION.dashboard),
      ]);

      this._lastPreloadTime = new Date();

      return {
        success: true,
        preloaded: {
          employees: (employees.employees || []).length,
          assignments: (assignments.assignments || []).length,
          calendars: 2,
        },
      };
    } catch (error) {
      console.error("Failed to preload owner data:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Preload current and next month calendars
   */
  async _preloadCurrentAndNextMonthCalendars(token) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }

    const [currentCal, nextCal] = await Promise.all([
      BusinessOwnerService.getCalendar(token, currentMonth, currentYear),
      BusinessOwnerService.getCalendar(token, nextMonth, nextYear),
    ]);

    await Promise.all([
      this._setCache(CACHE_KEYS.calendar(currentMonth, currentYear), currentCal, CACHE_DURATION.calendar),
      this._setCache(CACHE_KEYS.calendar(nextMonth, nextYear), nextCal, CACHE_DURATION.calendar),
    ]);

    return { current: currentCal, next: nextCal };
  }

  // =====================
  // CACHE HELPERS
  // =====================

  async _cacheEmployees(employees) {
    // Validate employees parameter
    if (!employees || !Array.isArray(employees)) {
      console.warn("[OfflineBusinessOwnerService] _cacheEmployees called with invalid employees:", typeof employees);
      return;
    }

    await database.write(async () => {
      // Clear old cache
      const existing = await offlineEmployeesCollection.query().fetch();
      for (const emp of existing) {
        await emp.markAsDeleted();
      }

      // Add new data
      for (const emp of employees) {
        await offlineEmployeesCollection.create((e) => {
          e.serverId = emp.id;
          e.userId = emp.userId || null;
          e.email = emp.email || "";
          e.status = emp.status || "active";
          e._raw.employee_data = JSON.stringify(emp);
          e._raw.created_at = Date.now();
          e._raw.updated_at = Date.now();
        });
      }
    });

    // Update cache timestamp AFTER the data write completes (avoid nested writes)
    await this._setCache(CACHE_KEYS.employees(), { count: employees.length }, CACHE_DURATION.employees);
  }

  async _cacheAssignments(assignments) {
    await database.write(async () => {
      // Clear old cache
      const existing = await offlineOwnerAssignmentsCollection.query().fetch();
      for (const a of existing) {
        await a.markAsDeleted();
      }

      // Add new data
      for (const assignment of assignments) {
        await offlineOwnerAssignmentsCollection.create((a) => {
          a.serverId = assignment.id;
          // Use nullish coalescing for IDs - null/undefined should stay null, don't convert to 0
          a.appointmentId = assignment.appointmentId ?? assignment.appointment?.id ?? null;
          a.employeeId = assignment.employeeId ?? assignment.employee?.id ?? null;
          a.status = assignment.status || "assigned";
          a._raw.scheduled_date = assignment.appointment?.dateTime
            ? new Date(assignment.appointment.dateTime).getTime()
            : Date.now();
          a._raw.assignment_data = JSON.stringify(assignment);
          a._raw.created_at = Date.now();
          a._raw.updated_at = Date.now();
        });
      }
    });
  }

  async _getLocalEmployees(status = null) {
    // Build query conditions at database level (more efficient than JS filtering)
    const conditions = [];
    if (status) {
      conditions.push(Q.where("status", status));
    }

    const employees = await offlineEmployeesCollection.query(...conditions).fetch();
    return employees.map((e) => this._formatLocalEmployee(e));
  }

  async _getLocalAssignments(filters = {}) {
    // Build query conditions at database level (more efficient than sequential JS filtering)
    const conditions = [];

    if (filters.employeeId) {
      conditions.push(Q.where("employee_id", filters.employeeId));
    }

    if (filters.status) {
      conditions.push(Q.where("status", filters.status));
    }

    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime();
      conditions.push(Q.where("scheduled_date", Q.gte(startTime)));
    }

    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime();
      conditions.push(Q.where("scheduled_date", Q.lte(endTime)));
    }

    const assignments = await offlineOwnerAssignmentsCollection.query(...conditions).fetch();
    return assignments.map((a) => this._formatLocalAssignment(a));
  }

  async _getCache(cacheKey) {
    try {
      // Query directly by cacheKey (more efficient than fetching all and filtering in JS)
      const caches = await offlineDashboardCacheCollection
        .query(Q.where("cache_key", cacheKey))
        .fetch();
      const cache = caches[0];
      if (!cache || cache.isExpired) return null;
      return cache;
    } catch (error) {
      // Log error instead of silent failure to aid debugging
      console.warn(`[OfflineBusinessOwnerService] Failed to get cache for key ${cacheKey}:`, error);
      return null;
    }
  }

  async _setCache(cacheKey, data, duration) {
    await database.write(async () => {
      // Remove existing cache for this key (query directly by key instead of fetching all)
      const existing = await offlineDashboardCacheCollection
        .query(Q.where("cache_key", cacheKey))
        .fetch();
      for (const old of existing) {
        await old.markAsDeleted();
      }

      // Create new cache entry
      await offlineDashboardCacheCollection.create((c) => {
        c.cacheKey = cacheKey;
        c._raw.data = JSON.stringify(data);
        c._raw.cached_at = Date.now();
        c._raw.expires_at = Date.now() + duration;
      });
    });
  }

  async _getCacheFreshness(cacheKey) {
    const cache = await this._getCache(cacheKey);
    if (!cache) {
      return { isFresh: false, lastUpdated: null };
    }
    return {
      isFresh: cache.isValid,
      lastUpdated: cache.cachedAt,
      formattedAge: cache.formattedAge,
    };
  }

  _formatLocalEmployee(employee) {
    const data = employee.employeeData;
    return {
      id: employee.serverId,
      localId: employee.id,
      email: employee.email,
      status: employee.status,
      ...data,
      isLocalData: true,
    };
  }

  _formatLocalAssignment(assignment) {
    const data = assignment.assignmentData;
    return {
      id: assignment.serverId,
      localId: assignment.id,
      appointmentId: assignment.appointmentId,
      employeeId: assignment.employeeId,
      status: assignment.status,
      scheduledDate: assignment.scheduledDate,
      ...data,
      isLocalData: true,
    };
  }

  // =====================
  // WRITE OPERATIONS (ONLINE ONLY)
  // =====================

  // These operations require online connectivity
  async inviteEmployee(token, employeeData) {
    if (!NetworkMonitor.isOnline) {
      return { success: false, error: "Cannot invite employees while offline" };
    }
    const result = await BusinessOwnerService.inviteEmployee(token, employeeData);
    if (result.success) {
      // Refresh cache
      this.getEmployees(token).catch(err => console.error("[OfflineBusinessOwnerService] Cache refresh for employees failed:", err));
    }
    return result;
  }

  async assignEmployee(token, assignmentData) {
    if (!NetworkMonitor.isOnline) {
      return { success: false, error: "Cannot assign employees while offline" };
    }
    const result = await BusinessOwnerService.assignEmployee(token, assignmentData);
    if (result.success) {
      // Refresh cache
      this.getAssignments(token).catch(err => console.error("[OfflineBusinessOwnerService] Cache refresh for assignments failed:", err));
    }
    return result;
  }

  async selfAssign(token, appointmentId) {
    if (!NetworkMonitor.isOnline) {
      return { success: false, error: "Cannot self-assign while offline" };
    }
    return BusinessOwnerService.selfAssign(token, appointmentId);
  }

  // Pass through other methods that require online
  async updateEmployee(token, employeeId, updates) {
    return BusinessOwnerService.updateEmployee(token, employeeId, updates);
  }

  async terminateEmployee(token, employeeId, reason) {
    return BusinessOwnerService.terminateEmployee(token, employeeId, reason);
  }

  async unassignJob(token, assignmentId) {
    return BusinessOwnerService.unassignJob(token, assignmentId);
  }

  async getFinancials(token, startDate, endDate) {
    if (!NetworkMonitor.isOnline) {
      return {
        summary: {},
        byEmployee: [],
        byJob: [],
        isOfflineData: true,
        message: "Financial data requires internet connection",
      };
    }
    return BusinessOwnerService.getFinancials(token, startDate, endDate);
  }

  async getPendingPayouts(token) {
    if (!NetworkMonitor.isOnline) {
      return {
        pendingPayouts: [],
        totalAmount: 0,
        byEmployee: [],
        isOfflineData: true,
        message: "Payout data requires internet connection",
      };
    }
    return BusinessOwnerService.getPendingPayouts(token);
  }

  // Local-only methods pass through directly
  static calculateJobFinancials(customerPays, employeePay, platformFeePercent) {
    return BusinessOwnerService.calculateJobFinancials(customerPays, employeePay, platformFeePercent);
  }

  static suggestPayAmounts(customerPays, platformFeePercent) {
    return BusinessOwnerService.suggestPayAmounts(customerPays, platformFeePercent);
  }

  // Get data freshness info
  getDataFreshness() {
    if (!this._lastPreloadTime) {
      return { isFresh: false, lastUpdated: null, ageMs: null };
    }

    const ageMs = Date.now() - this._lastPreloadTime.getTime();
    const isFresh = ageMs < DATA_FRESHNESS_THRESHOLD_MS;

    return {
      isFresh,
      lastUpdated: this._lastPreloadTime,
      ageMs,
    };
  }
}

// Export singleton instance
export default new OfflineBusinessOwnerService();
