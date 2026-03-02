// Global auth event service for handling token expiration across the app
// This allows FetchData and other services to trigger logout when 401 is detected

class AuthEventServiceClass {
  constructor() {
    this.logoutCallback = null;
    this.isLoggingOut = false;
  }

  // Called by AuthContext to register the logout function
  setLogoutCallback(callback) {
    this.logoutCallback = callback;
    // Reset the flag when a new callback is registered (user logged back in)
    this.isLoggingOut = false;
  }

  // Called when a 401 (unauthorized/token expired) error is detected
  handleTokenExpired() {
    // Prevent multiple logout triggers from concurrent 401 responses
    if (this.isLoggingOut) {
      return;
    }

    if (this.logoutCallback) {
      this.isLoggingOut = true;
      console.log("Token expired - logging out user");
      this.logoutCallback();
    }
  }

  // Clear the callback (used when AuthContext unmounts)
  clearLogoutCallback() {
    this.logoutCallback = null;
    this.isLoggingOut = false;
  }
}

const AuthEventService = new AuthEventServiceClass();

export default AuthEventService;
