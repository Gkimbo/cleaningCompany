// Centralized configuration for cross-platform support
import { Platform } from "react-native";

// API_BASE configuration for different platforms
const getApiBase = () => {
  if (Platform.OS === "web") {
    return "http://localhost:3000/api/v1";
  } else if (Platform.OS === "android") {
    // Android emulator uses 10.0.2.2 to access host machine's localhost
    return "http://10.0.2.2:3000/api/v1";
  } else {
    // iOS simulator can use localhost
    return "http://localhost:3000/api/v1";
  }
};

const getSocketUrl = () => {
  if (Platform.OS === "web") {
    return "http://localhost:3000";
  } else if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  } else {
    return "http://localhost:3000";
  }
};

export const API_BASE = getApiBase();
export const SOCKET_URL = getSocketUrl();

export default {
  API_BASE,
  SOCKET_URL,
};
