/**
 * useSafeNavigation Hook Tests
 *
 * Tests for safe navigation that handles cases where there's no history to go back to.
 * This prevents the "GO_BACK was not handled by any navigator" error.
 */

import React from "react";
import { Text, Pressable } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";

// Mock navigate function
const mockNavigate = jest.fn();

// Mock useLocation with configurable key
let mockLocationKey = "default";

// Mock react-router-native
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    key: mockLocationKey,
    pathname: "/test",
  }),
}));

// Import hook after mocking
const useSafeNavigation = require("../../src/hooks/useSafeNavigation").default;

// Test component that uses the hook
const TestComponent = ({ fallbackRoute }) => {
  const { goBack, goTo, canGoBack, navigate } = useSafeNavigation(fallbackRoute);

  return (
    <>
      <Pressable testID="go-back-btn" onPress={goBack}>
        <Text>Go Back</Text>
      </Pressable>
      <Pressable testID="go-to-btn" onPress={() => goTo("/some-page")}>
        <Text>Go To</Text>
      </Pressable>
      <Pressable testID="go-to-with-options-btn" onPress={() => goTo("/some-page", { replace: true })}>
        <Text>Go To With Options</Text>
      </Pressable>
      <Text testID="can-go-back">{canGoBack ? "yes" : "no"}</Text>
    </>
  );
};

describe("useSafeNavigation Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationKey = "default";
  });

  describe("goBack()", () => {
    it("should navigate to fallback route when location.key is 'default' (no history)", () => {
      mockLocationKey = "default";

      const { getByTestId } = render(<TestComponent />);

      fireEvent.press(getByTestId("go-back-btn"));

      // Should navigate to fallback "/" with replace
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
      expect(mockNavigate).not.toHaveBeenCalledWith(-1);
    });

    it("should navigate back when location.key is not 'default' (has history)", () => {
      mockLocationKey = "abc123"; // Not "default" means there's history

      const { getByTestId } = render(<TestComponent />);

      fireEvent.press(getByTestId("go-back-btn"));

      // Should navigate back using -1
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it("should use custom fallback route when provided", () => {
      mockLocationKey = "default";

      const { getByTestId } = render(<TestComponent fallbackRoute="/dashboard" />);

      fireEvent.press(getByTestId("go-back-btn"));

      // Should navigate to custom fallback
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });

    it("should handle different location keys correctly", () => {
      const testCases = [
        { key: "default", shouldGoBack: false },
        { key: "random-uuid-1234", shouldGoBack: true },
        { key: "k7sdj3", shouldGoBack: true },
      ];

      testCases.forEach(({ key, shouldGoBack }) => {
        mockNavigate.mockClear();
        mockLocationKey = key;

        const { getByTestId, unmount } = render(<TestComponent />);

        fireEvent.press(getByTestId("go-back-btn"));

        if (shouldGoBack) {
          expect(mockNavigate).toHaveBeenCalledWith(-1);
        } else {
          expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
        }

        unmount();
      });
    });
  });

  describe("canGoBack", () => {
    it("should return false when location.key is 'default'", () => {
      mockLocationKey = "default";

      const { getByTestId } = render(<TestComponent />);

      expect(getByTestId("can-go-back").props.children).toBe("no");
    });

    it("should return true when location.key is not 'default'", () => {
      mockLocationKey = "some-history-key";

      const { getByTestId } = render(<TestComponent />);

      expect(getByTestId("can-go-back").props.children).toBe("yes");
    });
  });

  describe("goTo()", () => {
    it("should navigate to specified path", () => {
      const { getByTestId } = render(<TestComponent />);

      fireEvent.press(getByTestId("go-to-btn"));

      expect(mockNavigate).toHaveBeenCalledWith("/some-page", undefined);
    });

    it("should pass options to navigate", () => {
      const { getByTestId } = render(<TestComponent />);

      fireEvent.press(getByTestId("go-to-with-options-btn"));

      expect(mockNavigate).toHaveBeenCalledWith("/some-page", { replace: true });
    });
  });
});

describe("Back Button Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Simulate scenarios that would occur in real components

  describe("Direct page access (no history)", () => {
    it("should safely handle back navigation when user lands directly on a page", () => {
      mockLocationKey = "default"; // Simulates direct URL access

      const { getByTestId } = render(<TestComponent />);

      // User clicks back button
      fireEvent.press(getByTestId("go-back-btn"));

      // Should not crash, should go to home
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  describe("Normal navigation flow (has history)", () => {
    it("should navigate back normally when user came from another page", () => {
      mockLocationKey = "previous-page-key"; // Simulates normal navigation

      const { getByTestId } = render(<TestComponent />);

      // User clicks back button
      fireEvent.press(getByTestId("go-back-btn"));

      // Should go back normally
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe("Deep link access", () => {
    it("should handle back navigation after deep linking", () => {
      mockLocationKey = "default"; // Deep link = no history

      const { getByTestId } = render(<TestComponent fallbackRoute="/dashboard" />);

      fireEvent.press(getByTestId("go-back-btn"));

      // Should go to dashboard instead of crashing
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  describe("Page refresh scenario", () => {
    it("should handle back navigation after page refresh", () => {
      mockLocationKey = "default"; // Refresh clears history

      const { getByTestId } = render(<TestComponent />);

      // canGoBack should be false
      expect(getByTestId("can-go-back").props.children).toBe("no");

      // goBack should not crash
      fireEvent.press(getByTestId("go-back-btn"));

      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  describe("Multiple back button presses", () => {
    it("should handle rapid back button presses", () => {
      mockLocationKey = "default";

      const { getByTestId } = render(<TestComponent />);

      // Simulate rapid pressing
      for (let i = 0; i < 5; i++) {
        fireEvent.press(getByTestId("go-back-btn"));
      }

      expect(mockNavigate).toHaveBeenCalledTimes(5);
    });
  });
});
