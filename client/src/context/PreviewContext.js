/**
 * PreviewContext
 *
 * React context for managing the owner's "Preview as Role" feature.
 * Stores preview state and provides functions to enter/exit preview mode.
 */

import React, { createContext, useContext, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DemoAccountService from "../services/fetchRequests/DemoAccountService";

const PreviewContext = createContext(null);

// Storage key for preserving owner state during preview
const OWNER_STATE_KEY = "@preview_original_owner_state";

export const PreviewProvider = ({ children, dispatch, state }) => {
	const [isPreviewMode, setIsPreviewMode] = useState(false);
	const [previewRole, setPreviewRole] = useState(null);
	const [originalOwnerState, setOriginalOwnerState] = useState(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(null);

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

			// Call backend to get fresh owner token
			const result = await DemoAccountService.exitPreviewMode(
				state.currentUser.token,
				ownerState.currentUser?.id
			);

			if (!result.success) {
				// Even if backend fails, try to restore from stored state
				console.warn("[PreviewContext] Backend exit failed, using stored state");
			}

			// Dispatch action to restore owner state
			dispatch({
				type: "PREVIEW_EXIT",
				payload: result.success ? result : ownerState,
			});

			// Clean up
			await AsyncStorage.removeItem(OWNER_STATE_KEY);
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
	 * Check if we're currently in preview mode
	 */
	const checkPreviewMode = useCallback(async () => {
		try {
			const stored = await AsyncStorage.getItem(OWNER_STATE_KEY);
			if (stored) {
				const ownerState = JSON.parse(stored);
				setOriginalOwnerState(ownerState);
				// If we have stored owner state but app restarted,
				// we might be in an inconsistent state
				// Let the app handle this through the PREVIEW_CHECK action
				return { wasInPreview: true, ownerState };
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
		};
		return roleInfo[role] || roleInfo.cleaner;
	}, []);

	const value = {
		isPreviewMode,
		previewRole,
		isLoading,
		error,
		enterPreviewMode,
		exitPreviewMode,
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
