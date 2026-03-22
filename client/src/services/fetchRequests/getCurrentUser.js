import SecureStorage from "../SecureStorage";
import HttpClient from "../HttpClient";

const getCurrentUser = async (providedToken = null) => {
  // Use provided token if available, otherwise get from SecureStorage
  // This is important for preview mode where the token is in state but not storage
  const token = providedToken || (await SecureStorage.getItem("token"));

  // If no token, user is not logged in - return null instead of throwing
  // This prevents error messages from showing during logout
  if (!token) {
    return null;
  }

  const result = await HttpClient.get("/user-sessions/current", { token });

  // HttpClient returns { success: false, error: ... } on failure
  if (result.success === false) {
    // 401 is handled automatically by HttpClient (triggers logout)
    if (result.status === 401) {
      return null;
    }
    throw new Error(result.error || "Failed to get current user");
  }

  return result;
};

export default getCurrentUser;
