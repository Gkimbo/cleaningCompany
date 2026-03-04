import React, { createContext, useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PushNotificationService from "./PushNotificationService";
import { OfflineManager, AutoSyncOrchestrator, SyncEngine } from "./offline";
import AuthEventService from "./AuthEventService";

const AuthContext = createContext({
	user: null,
	login: (token) => {},
	logout: () => {},
});

const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null);

	// Internal function to perform actual logout
	const performLogout = useCallback(async () => {
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
			// Clear auth token and cancel pending sync retries BEFORE resetting
			AutoSyncOrchestrator.setAuthToken(null);
			AutoSyncOrchestrator.cancelPendingRetry();
			// Reset offline manager (clears local data)
			OfflineManager.reset().catch(console.error);
			// Set the user as logged out
			setUser(null);
		} catch (error) {
			console.log("Error removing token:", error);
		}
	}, []);

	// Public logout function that checks for pending sync operations
	const logout = useCallback(async (forceLogout = false) => {
		try {
			// Check for pending sync operations before logout
			const pendingCount = await OfflineManager.getPendingSyncCount();

			if (pendingCount > 0 && !forceLogout) {
				// Get detailed summary for the warning
				const summary = await OfflineManager.getPendingSyncSummary();

				// Build a descriptive message
				let itemsDescription = [];
				if (summary.byType.JOB_START) itemsDescription.push(`${summary.byType.JOB_START} job start(s)`);
				if (summary.byType.JOB_COMPLETE) itemsDescription.push(`${summary.byType.JOB_COMPLETE} job completion(s)`);
				if (summary.byType.PHOTO_UPLOAD) itemsDescription.push(`${summary.byType.PHOTO_UPLOAD} photo(s)`);
				if (summary.byType.CHECKLIST_UPDATE) itemsDescription.push(`${summary.byType.CHECKLIST_UPDATE} checklist item(s)`);
				if (summary.byType.HOME_SIZE_MISMATCH) itemsDescription.push(`${summary.byType.HOME_SIZE_MISMATCH} mismatch report(s)`);

				const itemsList = itemsDescription.length > 0
					? itemsDescription.join(", ")
					: `${pendingCount} item(s)`;

				// Show warning alert
				return new Promise((resolve) => {
					Alert.alert(
						"Unsaved Work",
						`You have ${itemsList} that haven't been synced to the server yet.\n\nIf you log out now, this data will be lost.\n\nWould you like to try syncing first?`,
						[
							{
								text: "Try Sync First",
								onPress: async () => {
									// Attempt to sync before logout
									try {
										const syncResult = await SyncEngine.startSync();
										if (syncResult.success) {
											// Check if all synced
											const remainingCount = await OfflineManager.getPendingSyncCount();
											if (remainingCount === 0) {
												Alert.alert("Sync Complete", "All data has been synced. You can now log out safely.", [
													{ text: "Log Out", onPress: () => { performLogout(); resolve(); } },
													{ text: "Cancel", style: "cancel", onPress: () => resolve() }
												]);
											} else {
												Alert.alert("Partial Sync", `${remainingCount} item(s) could not be synced. You may lose this data if you log out.`, [
													{ text: "Log Out Anyway", style: "destructive", onPress: () => { performLogout(); resolve(); } },
													{ text: "Cancel", style: "cancel", onPress: () => resolve() }
												]);
											}
										} else {
											Alert.alert("Sync Failed", "Could not sync your data. Please check your internet connection.", [
												{ text: "Log Out Anyway", style: "destructive", onPress: () => { performLogout(); resolve(); } },
												{ text: "Cancel", style: "cancel", onPress: () => resolve() }
											]);
										}
									} catch (syncError) {
										console.error("Sync error during logout:", syncError);
										Alert.alert("Sync Error", "An error occurred while syncing. You may lose unsaved data.", [
											{ text: "Log Out Anyway", style: "destructive", onPress: () => { performLogout(); resolve(); } },
											{ text: "Cancel", style: "cancel", onPress: () => resolve() }
										]);
									}
								}
							},
							{
								text: "Log Out Anyway",
								style: "destructive",
								onPress: () => { performLogout(); resolve(); }
							},
							{
								text: "Cancel",
								style: "cancel",
								onPress: () => resolve()
							}
						]
					);
				});
			} else {
				// No pending operations or force logout - proceed immediately
				await performLogout();
			}
		} catch (error) {
			console.log("Error during logout:", error);
			// If checking fails, still allow logout
			await performLogout();
		}
	}, [performLogout]);

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
