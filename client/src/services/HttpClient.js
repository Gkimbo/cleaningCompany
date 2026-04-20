/**
 * HttpClient - Centralized HTTP client with interceptors
 *
 * Features:
 * - Automatic token injection in Authorization header
 * - Centralized error handling with 401 detection
 * - Request/Response logging in development
 * - Consistent error response format
 * - JSON parsing with validation
 * - Timeout support
 * - Retry mechanism with exponential backoff
 */

import { API_BASE, BASE_URL } from "./config";
import AuthEventService from "./AuthEventService";
import SecureStorage from "./SecureStorage";

// Default configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRY_COUNT = 0;
const MAX_RETRY_DELAY = 8000; // 8 seconds

/**
 * Request interceptors - functions called before each request
 * Each interceptor receives (url, options) and returns modified options
 */
const requestInterceptors = [];

/**
 * Response interceptors - functions called after each response
 * Each interceptor receives (response, data) and can modify data
 */
const responseInterceptors = [];

/**
 * Error interceptors - functions called on error
 * Each interceptor receives (error, url, options)
 */
const errorInterceptors = [];

/**
 * Add a request interceptor
 * @param {Function} interceptor - (url, options) => options
 * @returns {Function} Remove function
 */
export const addRequestInterceptor = (interceptor) => {
  requestInterceptors.push(interceptor);
  return () => {
    const index = requestInterceptors.indexOf(interceptor);
    if (index > -1) requestInterceptors.splice(index, 1);
  };
};

/**
 * Add a response interceptor
 * @param {Function} interceptor - (response, data) => data
 * @returns {Function} Remove function
 */
export const addResponseInterceptor = (interceptor) => {
  responseInterceptors.push(interceptor);
  return () => {
    const index = responseInterceptors.indexOf(interceptor);
    if (index > -1) responseInterceptors.splice(index, 1);
  };
};

/**
 * Add an error interceptor
 * @param {Function} interceptor - (error, url, options) => void
 * @returns {Function} Remove function
 */
export const addErrorInterceptor = (interceptor) => {
  errorInterceptors.push(interceptor);
  return () => {
    const index = errorInterceptors.indexOf(interceptor);
    if (index > -1) errorInterceptors.splice(index, 1);
  };
};

/**
 * Calculate retry delay with exponential backoff
 * @param {number} attempt - Current attempt number (0-based)
 * @returns {number} Delay in milliseconds
 */
const getRetryDelay = (attempt) => {
  const delay = Math.min(1000 * Math.pow(2, attempt), MAX_RETRY_DELAY);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
};

/**
 * Sleep for a specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Standard error response shape
 */
const createErrorResponse = (message, status = null, details = null) => ({
  success: false,
  error: message,
  status,
  details,
});

/**
 * Parse response safely with error handling
 * @param {Response} response - Fetch response
 * @returns {Promise<Object>} Parsed data or error object
 */
const parseResponse = async (response) => {
  const contentType = response.headers.get("content-type");

  // Handle empty responses
  if (response.status === 204 || !contentType) {
    return { success: true };
  }

  // Handle JSON responses
  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();

      if (!response.ok) {
        return createErrorResponse(
          data.error || data.message || `Request failed with status ${response.status}`,
          response.status,
          data
        );
      }

      return data;
    } catch (_parseError) {
      return createErrorResponse(
        "Invalid response from server",
        response.status
      );
    }
  }

  // Handle text responses
  try {
    const text = await response.text();
    if (!response.ok) {
      return createErrorResponse(text || `Request failed with status ${response.status}`, response.status);
    }
    return { success: true, data: text };
  } catch {
    return createErrorResponse("Failed to read response", response.status);
  }
};

/**
 * HttpClient class
 */
class HttpClientClass {
  constructor() {
    this.defaultHeaders = {
      "Content-Type": "application/json",
    };
  }

  /**
   * Get auth token from secure storage
   * @returns {Promise<string|null>}
   */
  async getAuthToken() {
    try {
      return await SecureStorage.getItem("token");
    } catch (_error) {
      return null;
    }
  }

  /**
   * Build full URL from path
   * @param {string} path - API path (can be relative or absolute)
   * @param {boolean} useBaseUrl - Use BASE_URL instead of API_BASE
   * @returns {string} Full URL
   */
  buildUrl(path, useBaseUrl = false) {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    const base = useBaseUrl ? BASE_URL : API_BASE;

    // Handle paths that start with /api/v1 when using BASE_URL
    if (useBaseUrl && path.startsWith("/api/v1")) {
      return `${base}${path}`;
    }

    // Ensure path starts with /
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalizedPath}`;
  }

  /**
   * Core request method
   * @param {string} url - Request URL (relative or absolute)
   * @param {Object} options - Fetch options
   * @param {Object} config - Additional configuration
   * @returns {Promise<Object>}
   */
  async request(url, options = {}, config = {}) {
    const {
      timeout = DEFAULT_TIMEOUT,
      retries = DEFAULT_RETRY_COUNT,
      useBaseUrl = false,
      skipAuth = false,
      token = null, // Allow passing token directly
    } = config;

    const fullUrl = this.buildUrl(url, useBaseUrl);

    // Build request options
    let requestOptions = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    };

    // Add authorization header
    if (!skipAuth) {
      const authToken = token || (await this.getAuthToken());
      if (authToken) {
        requestOptions.headers.Authorization = `Bearer ${authToken}`;
      }
    }

    // Run request interceptors
    for (const interceptor of requestInterceptors) {
      try {
        requestOptions = await interceptor(fullUrl, requestOptions);
      } catch (_error) {
        // Silently handle interceptor errors
      }
    }

    // Attempt request with retries
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(fullUrl, {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle 401 - Token expired
        if (response.status === 401) {
          AuthEventService.handleTokenExpired();
          return createErrorResponse("Session expired. Please log in again.", 401);
        }

        // Parse response
        let data = await parseResponse(response);

        // Run response interceptors
        for (const interceptor of responseInterceptors) {
          try {
            data = await interceptor(response, data);
          } catch (_error) {
            // Silently handle interceptor errors
          }
        }

        return data;
      } catch (error) {
        lastError = error;

        // Run error interceptors
        for (const interceptor of errorInterceptors) {
          try {
            await interceptor(error, fullUrl, requestOptions);
          } catch (_interceptorError) {
            // Silently handle interceptor errors
          }
        }

        // Handle abort (timeout)
        if (error.name === "AbortError") {
          return createErrorResponse("Request timed out", 408);
        }

        // Retry logic
        if (attempt < retries) {
          const delay = getRetryDelay(attempt);
          await sleep(delay);
          continue;
        }

        // Network error
        return createErrorResponse(
          error.message || "Network request failed",
          null,
          { originalError: error.name }
        );
      }
    }

    return createErrorResponse(lastError?.message || "Request failed after retries");
  }

  /**
   * GET request
   * @param {string} url - Request URL
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>}
   */
  async get(url, config = {}) {
    return this.request(url, { method: "GET" }, config);
  }

  /**
   * POST request
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>}
   */
  async post(url, data = {}, config = {}) {
    return this.request(
      url,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      config
    );
  }

  /**
   * PUT request
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>}
   */
  async put(url, data = {}, config = {}) {
    return this.request(
      url,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
      config
    );
  }

  /**
   * PATCH request
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>}
   */
  async patch(url, data = {}, config = {}) {
    return this.request(
      url,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      config
    );
  }

  /**
   * DELETE request
   * @param {string} url - Request URL
   * @param {Object} config - Configuration options (can include body for delete with payload)
   * @returns {Promise<Object>}
   */
  async delete(url, config = {}) {
    const { body, ...restConfig } = config;
    const options = { method: "DELETE" };

    // Support DELETE with body (some APIs require this)
    if (body) {
      options.body = JSON.stringify(body);
    }

    return this.request(url, options, restConfig);
  }

  /**
   * Upload file (multipart/form-data)
   * @param {string} url - Request URL
   * @param {FormData} formData - Form data with file
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>}
   */
  async upload(url, formData, config = {}) {
    const { token, ...restConfig } = config;

    // Don't set Content-Type header - let browser set it with boundary
    const headers = {};
    const authToken = token || (await this.getAuthToken());
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    return this.request(
      url,
      {
        method: "POST",
        headers,
        body: formData,
      },
      { ...restConfig, skipAuth: true }
    );
  }
}

// Export singleton instance
const HttpClient = new HttpClientClass();
export default HttpClient;

// Also export the class for testing
export { HttpClientClass };
