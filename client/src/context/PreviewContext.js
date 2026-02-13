/**
 * PreviewContext
 *
 * React context for managing the owner's "Preview as Role" feature.
 * Stores preview state and provides functions to enter/exit preview mode.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DemoAccountService from "../services/fetchRequests/DemoAccountService";

const PreviewContext = createContext(null);

// Storage keys for preserving state during preview
const OWNER_STATE_KEY = "@preview_original_owner_state";
const PREVIEW_STATE_KEY = "@preview_mode_state";

export const PreviewProvider = ({ children, dispatch, state }) => {
	const [isPreviewMode, setIsPreviewMode] = useState(false);
	const [previewRole, setPreviewRole] = useState(null);
	const [originalOwnerState, setOriginalOwnerState] = useState(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const [isSwitching, setIsSwitching] = useState(false);
	const [error, setError] = useState(null);
	const [isRestoring, setIsRestoring] = useState(true);

	// Automatically restore preview state on mount
	useEffect(() => {
		const restorePreviewState = async () => {
			try {
				const previewStateStr = await AsyncStorage.getItem(PREVIEW_STATE_KEY);
				const ownerStateStr = await AsyncStorage.getItem(OWNER_STATE_KEY);

				if (previewStateStr && ownerStateStr) {
					const previewState = JSON.parse(previewStateStr);
					const ownerState = JSON.parse(ownerStateStr);

					// Restore the preview state
					setOriginalOwnerState(ownerState);
					setIsPreviewMode(previewState.isPreviewMode);
					setPreviewRole(previewState.previewRole);

					console.log(
						"[PreviewContext] Auto-restored preview mode:",
						previewState.previewRole
					);
				}
			} catch (err) {
				console.error("[PreviewContext] Error restoring preview state:", err);
			} finally {
				setIsRestoring(false);
			}
		};

		restorePreviewState();
	}, []);

	/**
	 * Enter preview mode for a specific role
	 * @param {string} role - Role to preview: 'cleaner', 'homeowner', 'businessOwner', 'employee'
	 */
	const enterPreviewMode = useCallback(
		async (role) => {
			if (!state?.currentUser?.token) {
				setError("No user token available");
				return { success: false, error: "No user token available" };
			}

			setIsLoading(true);
			setError(null);

			try {
				// Store original owner state
				const ownerState = {
					token: state.currentUser.token,
					account: state.account,
					currentUser: state.currentUser,
					isBusinessOwner: state.isBusinessOwner,
					businessName: state.businessName,
					// Add any other state that needs preservation
				};

				// Save to storage in case of app restart
				await AsyncStorage.setItem(OWNER_STATE_KEY, JSON.stringify(ownerState));
				setOriginalOwnerState(ownerState);

				// Call backend to get demo account session
				const result = await DemoAccountService.enterPreviewMode(
					state.currentUser.token,
					role
				);

				if (!result.success) {
					throw new Error(result.error || "Failed to enter preview mode");
				}

				// Store the demo token in AsyncStorage so getCurrentUser and other fetches work
				await AsyncStorage.setItem("token", result.token);

				// Save preview state for app reload persistence
				await AsyncStorage.setItem(
					PREVIEW_STATE_KEY,
					JSON.stringify({ isPreviewMode: true, previewRole: role })
				);

				// Dispatch actions to update app state with demo account data
				dispatch({ type: "PREVIEW_ENTER", payload: result });

				setIsPreviewMode(true);
				setPreviewRole(role);

				return { success: true };
			} catch (err) {
				console.error("[PreviewContext] Error entering preview mode:", err);
				setError(err.message);
				// Clean up on error
				await AsyncStorage.removeItem(OWNER_STATE_KEY);
				setOriginalOwnerState(null);
				return { success: false, error: err.message };
			} finally {
				setIsLoading(false);
			}
		},
		[state, dispatch]
	);

	/**
	 * Exit preview mode and return to owner
	 */
	const exitPreviewMode = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			// Try to get stored owner state
			let ownerState = originalOwnerState;
			if (!ownerState) {
				const stored = await AsyncStorage.getItem(OWNER_STATE_KEY);
				if (stored) {
					ownerState = JSON.parse(stored);
				}
			}

			if (!ownerState) {
				throw new Error("Original owner state not found");
			}

			// Call backend to get fresh owner token using the owner's stored token
			const result = await DemoAccountService.exitPreviewMode(
				ownerState.token,
				ownerState.currentUser?.id
			);

			if (!result.success) {
				// Even if backend fails, try to restore from stored state
				console.warn("[PreviewContext] Backend exit failed, using stored state");
			}

			// Restore the owner's token to AsyncStorage
			const tokenToRestore = result.success ? result.token : ownerState.token;
			if (tokenToRestore) {
				await AsyncStorage.setItem("token", tokenToRestore);
			}

			// Dispatch action to restore owner state
			dispatch({
				type: "PREVIEW_EXIT",
				payload: result.success ? result : ownerState,
			});

			// Clean up
			await AsyncStorage.removeItem(OWNER_STATE_KEY);
			await AsyncStorage.removeItem(PREVIEW_STATE_KEY);
			setOriginalOwnerState(null);
			setIsPreviewMode(false);
			setPreviewRole(null);

			return { success: true };
		} catch (err) {
			console.error("[PreviewContext] Error exiting preview mode:", err);
			setError(err.message);
			return { success: false, error: err.message };
		} finally {
			setIsLoading(false);
		}
	}, [originalOwnerState, state, dispatch]);

	/**
	 * Reset demo data back to original seeder state
	 * Can be called while in preview mode to restore demo accounts
	 * Automatically refreshes the session with a new token after reset
	 */
	const resetDemoData = useCallback(async () => {
		setIsResetting(true);
		setError(null);

		try {
			// Get the token to use - prefer original owner token if available
			let tokenToUse = state?.currentUser?.token;

			// If we have original owner state, use that token for auth
			// This ensures the reset call is authorized even from demo account
			if (originalOwnerState?.token) {
				tokenToUse = originalOwnerState.token;
			} else {
				// Try to get from storage
				const stored = await AsyncStorage.getItem(OWNER_STATE_KEY);
				if (stored) {
					const ownerState = JSON.parse(stored);
					if (ownerState?.token) {
						tokenToUse = ownerState.token;
					}
				}
			}

			if (!tokenToUse) {
				throw new Error("No authorization token available");
			}

			// Pass the current preview role so the server can return a new session
			const result = await DemoAccountService.resetDemoData(tokenToUse, previewRole);

			if (!result.success) {
				throw new Error(result.error || "Failed to reset demo data");
			}

			console.log("[PreviewContext] Demo data reset:", result);

			// If we got a new session back, update the state with the new token
			if (result.newSession && isPreviewMode) {
				console.log("[PreviewContext] Updating state with new session token");
				// Also update AsyncStorage so getCurrentUser and other fetches use the new token
				await AsyncStorage.setItem("token", result.newSession.token);
				dispatch({ type: "PREVIEW_ENTER", payload: result.newSession });
			}

			return {
				success: true,
				message: result.message,
				deleted: result.deleted,
				created: result.created,
			};
		} catch (err) {
			console.error("[PreviewContext] Error resetting demo data:", err);
			setError(err.message);
			return { success: false, error: err.message };
		} finally {
			setIsResetting(false);
		}
	}, [state, originalOwnerState, previewRole, isPreviewMode, dispatch]);

	/**
	 * Switch to a different demo role without exiting preview mode
	 * Preserves demo data - only changes which demo account is active
	 * @param {string} newRole - The role to switch to
	 */
	const switchPreviewRole = useCallback(
		async (newRole) => {
			if (!isPreviewMode) {
				setError("Not in preview mode");
				return { success: false, error: "Not in preview mode" };
			}

			if (newRole === previewRole) {
				return { success: true, message: "Already viewing this role" };
			}

			setIsSwitching(true);
			setError(null);

			try {
				// Get original owner ID and token from stored state
				let ownerId = originalOwnerState?.currentUser?.id;
				let ownerToken = originalOwnerState?.token;
				if (!ownerId || !ownerToken) {
					const stored = await AsyncStorage.getItem(OWNER_STATE_KEY);
					if (stored) {
						const ownerState = JSON.parse(stored);
						ownerId = ownerId || ownerState?.currentUser?.id;
						ownerToken = ownerToken || ownerState?.token;
					}
				}

				if (!ownerId) {
					throw new Error("Original owner ID not found");
				}

				if (!ownerToken) {
					throw new Error("Original owner token not found");
				}

				// Call backend to switch to new demo account using owner's token
				const result = await DemoAccountService.switchPreviewRole(
					ownerToken,
					newRole,
					ownerId
				);

				if (!result.success) {
					throw new Error(result.error || "Failed to switch preview role");
				}

				// Store the new demo token in AsyncStorage
				await AsyncStorage.setItem("token", result.token);

				// Update preview state in storage
				await AsyncStorage.setItem(
					PREVIEW_STATE_KEY,
					JSON.stringify({ isPreviewMode: true, previewRole: newRole })
				);

				// Dispatch action to update app state with new demo account data
				dispatch({ type: "PREVIEW_ENTER", payload: result });

				// Update local preview role state
				setPreviewRole(newRole);

				console.log(`[PreviewContext] Switched from ${previewRole} to ${newRole}`);
				return { success: true, message: result.message };
			} catch (err) {
				console.error("[PreviewContext] Error switching preview role:", err);
				setError(err.message);
				return { success: false, error: err.message };
			} finally {
				setIsSwitching(false);
			}
		},
		[isPreviewMode, previewRole, originalOwnerState, state, dispatch]
	);

	/**
	 * Check and restore preview mode state on app load
	 * Returns true if we were in preview mode and restored it
	 */
	const checkPreviewMode = useCallback(async () => {
		try {
			// Check for stored preview state
			const previewStateStr = await AsyncStorage.getItem(PREVIEW_STATE_KEY);
			const ownerStateStr = await AsyncStorage.getItem(OWNER_STATE_KEY);

			if (previewStateStr && ownerStateStr) {
				const previewState = JSON.parse(previewStateStr);
				const ownerState = JSON.parse(ownerStateStr);

				// Restore the preview state
				setOriginalOwnerState(ownerState);
				setIsPreviewMode(previewState.isPreviewMode);
				setPreviewRole(previewState.previewRole);

				console.log(
					"[PreviewContext] Restored preview mode:",
					previewState.previewRole
				);

				return {
					wasInPreview: true,
					ownerState,
					previewRole: previewState.previewRole,
				};
			}

			return { wasInPreview: false };
		} catch (err) {
			console.error("[PreviewContext] Error checking preview mode:", err);
			return { wasInPreview: false, error: err.message };
		}
	}, []);

	/**
	 * Get role display information
	 */
	const getRoleDisplayInfo = useCallback((role) => {
		const roleInfo = {
			cleaner: {
				label: "Cleaner",
				description: "Marketplace, jobs, and earnings",
				icon: "broom",
				color: "#3B82F6",
			},
			homeowner: {
				label: "Homeowner",
				description: "Booking, homes, and bills",
				icon: "home",
				color: "#10B981",
			},
			businessOwner: {
				label: "Business Owner",
				description: "Employees, clients, and analytics",
				icon: "briefcase",
				color: "#8B5CF6",
			},
			employee: {
				label: "Employee",
				description: "Assigned jobs and schedule",
				icon: "user-tie",
				color: "#F59E0B",
			},
			humanResources: {
				label: "HR Manager",
				description: "Disputes, appeals, and conflicts",
				icon: "gavel",
				color: "#EC4899",
			},
			largeBusinessOwner: {
				label: "Large Business",
				description: "100+ clients, 7% platform fee tier",
				icon: "building",
				color: "#0EA5E9",
			},
			preferredCleaner: {
				label: "Preferred Cleaner",
				description: "Platinum tier, 20 homes, 7% bonus",
				icon: "star",
				color: "#FBBF24",
			},
		};
		return roleInfo[role] || roleInfo.cleaner;
	}, []);

	const value = {
		isPreviewMode,
		previewRole,
		isLoading,
		isResetting,
		isSwitching,
		isRestoring,
		error,
		enterPreviewMode,
		exitPreviewMode,
		switchPreviewRole,
		resetDemoData,
		checkPreviewMode,
		getRoleDisplayInfo,
		originalOwnerState,
	};

	return (
		<PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>
	);
};

export const usePreview = () => {
	const context = useContext(PreviewContext);
	if (!context) {
		throw new Error("usePreview must be used within a PreviewProvider");
	}
	return context;
};

export default PreviewContext;
