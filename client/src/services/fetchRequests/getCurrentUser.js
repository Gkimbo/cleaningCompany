import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../config";

const getCurrentUser = async (providedToken = null) => {
  const baseURL = API_BASE.replace("/api/v1", "");

  // Use provided token if available, otherwise get from AsyncStorage
  // This is important for preview mode where the token is in state but not AsyncStorage
  const token = providedToken || await AsyncStorage.getItem("token");

  // If no token, user is not logged in
  if (!token) {
    throw new Error("No token found");
  }

  const response = await fetch(`${baseURL}/api/v1/user-sessions/current`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorMessage = `${response.status} (${response.statusText})`;
    const error = new Error(errorMessage);
    throw error;
  }

  const userData = await response.json();
  return userData;
};

export default getCurrentUser;
