/**
 * Tests for PreviewContext
 * Tests the preview mode context for the owner's "Preview as Role" feature.
 */

import React from "react";
import { render, waitFor, act } from "@testing-library/react-native";
import { Text, Pressable } from "react-native";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
	setItem: jest.fn(() => Promise.resolve()),
	getItem: jest.fn(() => Promise.resolve(null)),
	removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock DemoAccountService
const mockEnterPreviewMode = jest.fn();
const mockExitPreviewMode = jest.fn();

jest.mock("../../src/services/fetchRequests/DemoAccountService", () => ({
	__esModule: true,
	default: {
		enterPreviewMode: (...args) => mockEnterPreviewMode(...args),
		exitPreviewMode: (...args) => mockExitPreviewMode(...args),
	},
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { PreviewProvider, usePreview } from "../../src/context/PreviewContext";

// Test component to access context
const TestConsumer = ({ onMount }) => {
	const preview = usePreview();

	React.useEffect(() => {
		if (onMount) onMount(preview);
	}, []);

	return (
		<>
			<Text testID="isPreviewMode">{String(preview.isPreviewMode)}</Text>
			<Text testID="previewRole">{preview.previewRole || "null"}</Text>
			<Text testID="isLoading">{String(preview.isLoading)}</Text>
			<Text testID="error">{preview.error || "null"}</Text>
			<Pressable testID="enterCleaner" onPress={() => preview.enterPreviewMode("cleaner")} />
			<Pressable testID="exit" onPress={() => preview.exitPreviewMode()} />
		</>
	);
};

describe("PreviewContext", () => {
	const mockDispatch = jest.fn();
	const mockState = {
		currentUser: { token: "owner_token", id: 100 },
		account: "owner",
		isBusinessOwner: false,
		businessName: null,
	};

	beforeEach(() => {
		jest.clearAllMocks();
		mockEnterPreviewMode.mockReset();
		mockExitPreviewMode.mockReset();
	});

	describe("Initial State", () => {
		it("should provide default context values", () => {
			let contextValue;

			render(
				<PreviewProvider dispatch={mockDispatch} state={mockState}>
					<TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
				</PreviewProvider>
			);

			expect(contextValue.isPreviewMode).toBe(false);
			expect(contextValue.previewRole).toBeNull();
			expect(contextValue.isLoading).toBe(false);
			expect(contextValue.error).toBeNull();
		});

		it("should throw error when usePreview is used outside provider", () => {
			// Suppress console.error for this test
			const spy = jest.spyOn(console, "error").mockImplementation(() => {});

			expect(() => {
				render(<TestConsumer />);
			}).toThrow("usePreview must be used within a PreviewProvider");

			spy.mockRestore();
		});
	});

	describe("enterPreviewMode", () => {
		it("should successfully enter preview mode as cleaner", async () => {
			mockEnterPreviewMode.mockResolvedValue({
				success: true,
				token: "demo_token",
				user: { id: 1, type: "cleaner" },
				previewRole: "cleaner",
				originalOwnerId: 100,
			});

			const { getByTestId } = render(
				<PreviewProvider dispatch={mockDispatch} state={mockState}>
					<TestConsumer />
				</PreviewProvider>
			);

			await act(async () => {
				getByTestId("enterCleaner").props.onPress();
			});

			await waitFor(() => {
				expect(getByTestId("isPreviewMode").props.children).toBe("true");
				expect(getByTestId("previewRole").props.children).toBe("cleaner");
			});

			expect(mockEnterPreviewMode).toHaveBeenCalledWith("owner_token", "cleaner");
			expect(mockDispatch).toHaveBeenCalledWith({
				type: "PREVIEW_ENTER",
				payload: expect.objectContaining({
					success: true,
					previewRole: "cleaner",
				}),
			});
			expect(AsyncStorage.setItem).toHaveBeenCalled();
		});

		it("should handle enter preview mode failure", async () => {
			mockEnterPreviewMode.mockResolvedValue({
				success: false,
				error: "Demo account not found",
			});

			const { getByTestId } = render(
				<PreviewProvider dispatch={mockDispatch} state={mockState}>
					<TestConsumer />
				</PreviewProvider>
			);

			await act(async () => {
				getByTestId("enterCleaner").props.onPress();
			});

			await waitFor(() => {
				expect(getByTestId("isPreviewMode").props.children).toBe("false");
				expect(getByTestId("error").props.children).toBe("Demo account not found");
			});

			expect(mockDispatch).not.toHaveBeenCalled();
			expect(AsyncStorage.removeItem).toHaveBeenCalled();
		});

		it("should handle network error during enter", async () => {
			mockEnterPreviewMode.mockRejectedValue(new Error("Network error"));

			const { getByTestId } = render(
				<PreviewProvider dispatch={mockDispatch} state={mockState}>
					<TestConsumer />
				</PreviewProvider>
			);

			await act(async () => {
				getByTestId("enterCleaner").props.onPress();
			});

			await waitFor(() => {
				expect(getByTestId("error").props.children).toBe("Network error");
			});
		});

		it("should require user token to enter preview mode", async () => {
			const noTokenState = {
				...mockState,
				currentUser: { token: null },
			};

			let result;
			const TestWithResult = () => {
				const preview = usePreview();
				return (
					<Pressable
						testID="enter"
						onPress={async () => {
							result = await preview.enterPreviewMode("cleaner");
						}}
					/>
				);
			};

			const { getByTestId } = render(
				<PreviewProvider dispatch={mockDispatch} state={noTokenState}>
					<TestWithResult />
				</PreviewProvider>
			);

			await act(async () => {
				getByTestId("enter").props.onPress();
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("No user token available");
		});
	});

	describe("exitPreviewMode", () => {
		it("should successfully exit preview mode", async () => {
			// First enter preview mode
			mockEnterPreviewMode.mockResolvedValue({
				success: true,
				token: "demo_token",
				user: { id: 1, type: "cleaner" },
				previewRole: "cleaner",
				originalOwnerId: 100,
			});

			mockExitPreviewMode.mockResolvedValue({
				success: true,
				token: "owner_token",
				user: { id: 100, type: "owner" },
			});

			const { getByTestId } = render(
				<PreviewProvider dispatch={mockDispatch} state={mockState}>
					<TestConsumer />
				</PreviewProvider>
			);

			// Enter preview mode first
			await act(async () => {
				getByTestId("enterCleaner").props.onPress();
			});

			await waitFor(() => {
				expect(getByTestId("isPreviewMode").props.children).toBe("true");
			});

			// Now exit
			await act(async () => {
				getByTestId("exit").props.onPress();
			});

			await waitFor(() => {
				expect(getByTestId("isPreviewMode").props.children).toBe("false");
				expect(getByTestId("previewRole").props.children).toBe("null");
			});

			expect(mockDispatch).toHaveBeenCalledWith({
				type: "PREVIEW_EXIT",
				payload: expect.objectContaining({
					success: true,
				}),
			});
			expect(AsyncStorage.removeItem).toHaveBeenCalled();
		});

		it("should restore from stored state if original state not in memory", async () => {
			const storedState = JSON.stringify({
				token: "stored_owner_token",
				account: "owner",
				currentUser: { token: "stored_owner_token", id: 100 },
			});

			AsyncStorage.getItem.mockResolvedValue(storedState);

			mockExitPreviewMode.mockResolvedValue({
				success: true,
				token: "owner_token",
				user: { id: 100, type: "owner" },
			});

			let exitResult;
			const TestExitOnly = () => {
				const preview = usePreview();
				return (
					<Pressable
						testID="exit"
						onPress={async () => {
							exitResult = await preview.exitPreviewMode();
						}}
					/>
				);
			};

			const { getByTestId } = render(
				<PreviewProvider dispatch={mockDispatch} state={mockState}>
					<TestExitOnly />
				</PreviewProvider>
			);

			await act(async () => {
				getByTestId("exit").props.onPress();
			});

			expect(exitResult.success).toBe(true);
		});
	});

	describe("getRoleDisplayInfo", () => {
		it("should return correct info for each role", () => {
			let contextValue;

			render(
				<PreviewProvider dispatch={mockDispatch} state={mockState}>
					<TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
				</PreviewProvider>
			);

			const cleanerInfo = contextValue.getRoleDisplayInfo("cleaner");
			expect(cleanerInfo.label).toBe("Cleaner");

			const homeownerInfo = contextValue.getRoleDisplayInfo("homeowner");
			expect(homeownerInfo.label).toBe("Homeowner");

			const bizOwnerInfo = contextValue.getRoleDisplayInfo("businessOwner");
			expect(bizOwnerInfo.label).toBe("Business Owner");

			const employeeInfo = contextValue.getRoleDisplayInfo("employee");
			expect(employeeInfo.label).toBe("Employee");
		});

		it("should return cleaner info for unknown role", () => {
			let contextValue;

			render(
				<PreviewProvider dispatch={mockDispatch} state={mockState}>
					<TestConsumer onMount={(ctx) => { contextValue = ctx; }} />
				</PreviewProvider>
			);

			const unknownInfo = contextValue.getRoleDisplayInfo("unknown");
			expect(unknownInfo.label).toBe("Cleaner");
		});
	});

	describe("checkPreviewMode", () => {
		it("should detect stored preview state", async () => {
			const storedState = JSON.stringify({
				token: "owner_token",
				account: "owner",
				currentUser: { token: "owner_token", id: 100 },
			});

			AsyncStorage.getItem.mockResolvedValue(storedState);

			let checkResult;
			const TestCheck = () => {
				const preview = usePreview();
				return (
					<Pressable
						testID="check"
						onPress={async () => {
							checkResult = await preview.checkPreviewMode();
						}}
					/>
				);
			};

			const { getByTestId } = render(
				<PreviewProvider dispatch={mockDispatch} state={mockState}>
					<TestCheck />
				</PreviewProvider>
			);

			await act(async () => {
				getByTestId("check").props.onPress();
			});

			expect(checkResult.wasInPreview).toBe(true);
			expect(checkResult.ownerState).toBeDefined();
		});

		it("should return wasInPreview false when no stored state", async () => {
			AsyncStorage.getItem.mockResolvedValue(null);

			let checkResult;
			const TestCheck = () => {
				const preview = usePreview();
				return (
					<Pressable
						testID="check"
						onPress={async () => {
							checkResult = await preview.checkPreviewMode();
						}}
					/>
				);
			};

			const { getByTestId } = render(
				<PreviewProvider dispatch={mockDispatch} state={mockState}>
					<TestCheck />
				</PreviewProvider>
			);

			await act(async () => {
				getByTestId("check").props.onPress();
			});

			expect(checkResult.wasInPreview).toBe(false);
		});
	});
});
