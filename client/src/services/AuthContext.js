import React, { createContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PushNotificationService from "./PushNotificationService";
import { OfflineManager, AutoSyncOrchestrator } from "./offline";
import AuthEventService from "./AuthEventService";

const AuthContext = createContext({
	user: null,
	login: (token) => {},
	logout: () => {},
});

const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null);

	const logout = useCallback(async () => {
		try {
			// Get the token before removing it to unregister push notifications
			const token = await AsyncStorage.getItem("token");
			if (token) {
				// Remove push token from backend
				await PushNotificationService.removeTokenFromBackend(token);
			}
			// Remove the token from AsyncStorage
			await AsyncStorage.removeItem("token");
			// Clear any preview mode state to prevent stale state on re-login
			await AsyncStorage.removeItem("@preview_mode_state");
			await AsyncStorage.removeItem("@preview_original_owner_state");
			// Reset offline manager (keeps data encrypted locally)
			OfflineManager.reset().catch(console.error);
			// Clear auth token and cancel pending sync retries
			AutoSyncOrchestrator.setAuthToken(null);
			AutoSyncOrchestrator.cancelPendingRetry();
			// Set the user as logged out
			setUser(null);
		} catch (error) {
			console.log("Error removing token:", error);
		}
	}, []);

	useEffect(() => {
		// Check if a token exists in AsyncStorage when the app starts
		checkToken();
	}, []);

	// Register logout callback with AuthEventService for handling 401 errors
	useEffect(() => {
		AuthEventService.setLogoutCallback(logout);
		return () => {
			AuthEventService.clearLogoutCallback();
		};
	}, [logout]);

	const checkToken = async () => {
		try {
			const token = await AsyncStorage.getItem("token");
			if (token) {
				// Token exists, validate it on the server-side
				// You need to implement the server-side validation logic here
				// If the token is valid, set the user as logged in
				setUser({ token });
				// Initialize offline manager with token
				OfflineManager.initialize(token).catch(console.error);
				// Set auth token on auto-sync orchestrator
				AutoSyncOrchestrator.setAuthToken(token);
			}
		} catch (error) {
			console.log("Error checking token:", error);
		}
	};

	const login = async (token) => {
		try {
			// Save the token to AsyncStorage
			await AsyncStorage.setItem("token", token);
			// Set the user as logged in
			setUser({ token });
			// Initialize offline manager with token
			OfflineManager.initialize(token).catch(console.error);
			// Set auth token on auto-sync orchestrator
			AutoSyncOrchestrator.setAuthToken(token);
		} catch (error) {
			console.log("Error saving token:", error);
		}
	};

	return (
		<AuthContext.Provider value={{ user, login, logout }}>
			{children}
		</AuthContext.Provider>
	);
};

export { AuthContext, AuthProvider };
