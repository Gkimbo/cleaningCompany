import AsyncStorage from "@react-native-async-storage/async-storage";

const getCurrentUser = async () => {
  const baseURL = "http://localhost:3000";

  // Get the token safely from AsyncStorage
  const token = await AsyncStorage.getItem("token");

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
