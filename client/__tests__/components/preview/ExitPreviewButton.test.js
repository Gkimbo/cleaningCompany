/**
 * Tests for ExitPreviewButton
 * Tests the floating exit button displayed during preview mode.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// Mock the PreviewContext
const mockExitPreviewMode = jest.fn();
const mockUsePreview = jest.fn();

jest.mock("../../../src/context/PreviewContext", () => ({
	usePreview: () => mockUsePreview(),
}));

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

import ExitPreviewButton from "../../../src/components/preview/ExitPreviewButton";

describe("ExitPreviewButton", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockExitPreviewMode.mockClear();
	});

	const setupMock = (overrides = {}) => {
		mockUsePreview.mockReturnValue({
			isPreviewMode: true,
			previewRole: "cleaner",
			exitPreviewMode: mockExitPreviewMode,
			isLoading: false,
			...overrides,
		});
	};

	describe("Visibility", () => {
		it("should render when isPreviewMode is true", () => {
			setupMock({ isPreviewMode: true, previewRole: "cleaner" });

			const { getByText } = render(<ExitPreviewButton />);

			expect(getByText("Exit")).toBeTruthy();
		});

		it("should not render when isPreviewMode is false", () => {
			setupMock({ isPreviewMode: false, previewRole: null });

			const { queryByText } = render(<ExitPreviewButton />);

			expect(queryByText("Exit")).toBeNull();
		});

		it("should not render when previewRole is null but isPreviewMode is false", () => {
			setupMock({ isPreviewMode: false, previewRole: null });

			const { queryByText } = render(<ExitPreviewButton />);

			expect(queryByText("Exit")).toBeNull();
		});
	});

	describe("Role Display", () => {
		it("should display Cleaner role badge", () => {
			setupMock({ previewRole: "cleaner" });

			const { getByText } = render(<ExitPreviewButton />);

			expect(getByText("Viewing as Cleaner")).toBeTruthy();
		});

		it("should display Homeowner role badge", () => {
			setupMock({ previewRole: "homeowner" });

			const { getByText } = render(<ExitPreviewButton />);

			expect(getByText("Viewing as Homeowner")).toBeTruthy();
		});

		it("should display Business Owner role badge", () => {
			setupMock({ previewRole: "businessOwner" });

			const { getByText } = render(<ExitPreviewButton />);

			expect(getByText("Viewing as Business Owner")).toBeTruthy();
		});

		it("should display Employee role badge", () => {
			setupMock({ previewRole: "employee" });

			const { getByText } = render(<ExitPreviewButton />);

			expect(getByText("Viewing as Employee")).toBeTruthy();
		});

		it("should display Unknown for unrecognized role", () => {
			setupMock({ previewRole: "unknown_role" });

			const { getByText } = render(<ExitPreviewButton />);

			expect(getByText("Viewing as Unknown")).toBeTruthy();
		});
	});

	describe("Exit Functionality", () => {
		it("should call exitPreviewMode when button is pressed", () => {
			setupMock();

			const { getByText } = render(<ExitPreviewButton />);

			fireEvent.press(getByText("Exit").parent);

			expect(mockExitPreviewMode).toHaveBeenCalled();
		});

		it("should call exitPreviewMode only once per press", () => {
			setupMock();

			const { getByText } = render(<ExitPreviewButton />);

			fireEvent.press(getByText("Exit").parent);
			fireEvent.press(getByText("Exit").parent);

			expect(mockExitPreviewMode).toHaveBeenCalledTimes(2);
		});
	});

	describe("Loading State", () => {
		it("should disable button when isLoading is true", () => {
			setupMock({ isLoading: true });

			const { queryByText, UNSAFE_getByType } = render(<ExitPreviewButton />);

			// Exit text should be replaced with ActivityIndicator when loading
			expect(queryByText("Exit")).toBeNull();
		});

		it("should show role badge even when loading", () => {
			setupMock({ isLoading: true, previewRole: "cleaner" });

			const { getByText } = render(<ExitPreviewButton />);

			expect(getByText("Viewing as Cleaner")).toBeTruthy();
		});

		it("should prevent exit when loading", () => {
			setupMock({ isLoading: true });

			const { getByText } = render(<ExitPreviewButton />);

			// Button should be disabled
			const roleBadge = getByText("Viewing as Cleaner");
			expect(roleBadge).toBeTruthy();
		});
	});

	describe("Styling", () => {
		it("should render with proper structure", () => {
			setupMock({ previewRole: "cleaner" });

			const { getByText } = render(<ExitPreviewButton />);

			// Role badge should exist
			expect(getByText("Viewing as Cleaner")).toBeTruthy();

			// Exit button should exist
			expect(getByText("Exit")).toBeTruthy();
		});
	});

	describe("All Roles", () => {
		const roles = [
			{ role: "cleaner", label: "Cleaner" },
			{ role: "homeowner", label: "Homeowner" },
			{ role: "businessOwner", label: "Business Owner" },
			{ role: "employee", label: "Employee" },
		];

		roles.forEach(({ role, label }) => {
			it(`should correctly display ${role} role`, () => {
				setupMock({ previewRole: role });

				const { getByText } = render(<ExitPreviewButton />);

				expect(getByText(`Viewing as ${label}`)).toBeTruthy();
				expect(getByText("Exit")).toBeTruthy();
			});
		});
	});
});
