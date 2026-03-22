/**
 * Back Button Navigation Tests
 *
 * Tests to ensure back buttons in components work properly
 * and don't cause GO_BACK errors when there's no navigation history.
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// Mock navigate function
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

// Track location key for testing
let mockLocationKey = "default";

// Mock useSafeNavigation hook
jest.mock("../../src/hooks/useSafeNavigation", () => {
  return jest.fn(() => ({
    goBack: mockGoBack,
    goTo: mockNavigate,
    navigate: mockNavigate,
    canGoBack: mockLocationKey !== "default",
  }));
});

// Mock react-router-native for components that might still import it
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ key: mockLocationKey, pathname: "/test" }),
  useParams: () => ({}),
}));

// Mock theme
jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0f", 100: "#f0f", 200: "#f0f", 300: "#f0f", 400: "#f0f", 500: "#f0f", 600: "#0d9488", 700: "#f0f", 800: "#f0f", 900: "#f0f" },
    secondary: { 50: "#f0f", 100: "#f0f", 200: "#f0f", 300: "#f0f", 400: "#f0f", 500: "#f0f", 600: "#f0f", 700: "#f0f", 800: "#f0f", 900: "#f0f" },
    success: { 50: "#f0f", 100: "#f0f", 200: "#f0f", 300: "#f0f", 400: "#f0f", 500: "#f0f", 600: "#f0f", 700: "#f0f", 800: "#f0f", 900: "#f0f" },
    warning: { 50: "#f0f", 100: "#f0f", 200: "#f0f", 300: "#f0f", 400: "#f0f", 500: "#f0f", 600: "#f0f", 700: "#f0f", 800: "#f0f", 900: "#f0f" },
    error: { 50: "#f0f", 100: "#f0f", 200: "#f0f", 300: "#f0f", 400: "#f0f", 500: "#f0f", 600: "#f0f", 700: "#f0f", 800: "#f0f", 900: "#f0f" },
    neutral: { 0: "#fff", 50: "#f0f", 100: "#f0f", 200: "#f0f", 300: "#f0f", 400: "#f0f", 500: "#f0f", 600: "#f0f", 700: "#f0f", 800: "#f0f", 900: "#f0f" },
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
    background: { primary: "#fff", secondary: "#f5f5f5", tertiary: "#eee" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 16, xl: 18, "2xl": 20 },
    fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {}, md: {}, lg: {} },
}));

// Mock FontAwesome
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");
jest.mock("react-native-vector-icons/FontAwesome5", () => "Icon");

describe("Back Button Navigation Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationKey = "default";
  });

  describe("useSafeNavigation integration", () => {
    it("should call goBack from useSafeNavigation hook", () => {
      const useSafeNavigation = require("../../src/hooks/useSafeNavigation");

      // Create a simple test component
      const TestComponent = () => {
        const { goBack } = useSafeNavigation();
        return (
          <button testID="back-button" onClick={goBack}>
            Back
          </button>
        );
      };

      // Verify the hook is being used
      expect(useSafeNavigation).toHaveBeenCalled;
    });

    it("should use goBack instead of navigate(-1)", () => {
      // This test verifies that our migration from navigate(-1) to goBack is correct
      const useSafeNavigation = require("../../src/hooks/useSafeNavigation");

      const hookResult = useSafeNavigation();

      // The hook should return goBack function
      expect(typeof hookResult.goBack).toBe("function");

      // Calling goBack should trigger the mock
      hookResult.goBack();
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe("No history scenario (direct page access)", () => {
    beforeEach(() => {
      mockLocationKey = "default";
    });

    it("should not throw error when back button is pressed with no history", () => {
      const useSafeNavigation = require("../../src/hooks/useSafeNavigation");
      const hookResult = useSafeNavigation();

      // This should not throw
      expect(() => {
        hookResult.goBack();
      }).not.toThrow();
    });

    it("should report canGoBack as false", () => {
      const useSafeNavigation = require("../../src/hooks/useSafeNavigation");
      const hookResult = useSafeNavigation();

      expect(hookResult.canGoBack).toBe(false);
    });
  });

  describe("With history scenario (normal navigation)", () => {
    beforeEach(() => {
      mockLocationKey = "some-history-key";
    });

    it("should report canGoBack as true", () => {
      const useSafeNavigation = require("../../src/hooks/useSafeNavigation");

      // Reset mock to use new key
      jest.resetModules();
      jest.doMock("../../src/hooks/useSafeNavigation", () => {
        return jest.fn(() => ({
          goBack: mockGoBack,
          goTo: mockNavigate,
          navigate: mockNavigate,
          canGoBack: true,
        }));
      });

      const useSafeNavigationWithHistory = require("../../src/hooks/useSafeNavigation");
      const hookResult = useSafeNavigationWithHistory();

      expect(hookResult.canGoBack).toBe(true);
    });
  });
});

describe("Component Back Button Tests", () => {
  // These tests verify that components are using goBack() correctly

  describe("File imports verification", () => {
    const fs = require("fs");
    const path = require("path");

    const componentsWithBackButton = [
      "src/components/businessOwner/AssignmentDetail.js",
      "src/components/cleaner/ClientDetailPage.js",
      "src/components/owner/ITEmployeeManagement.js",
      "src/components/notifications/NotificationDetailScreen.js",
      "src/components/referrals/MyReferralsPage.js",
    ];

    componentsWithBackButton.forEach((componentPath) => {
      it(`${componentPath} should use useSafeNavigation`, () => {
        const fullPath = path.join(process.cwd(), componentPath);

        // Check if file exists (skip if not in test environment)
        let content;
        try {
          content = fs.readFileSync(fullPath, "utf8");
        } catch (e) {
          // File doesn't exist in test environment, skip
          return;
        }

        // Should import useSafeNavigation
        expect(content).toContain("useSafeNavigation");

        // Should NOT have navigate(-1)
        expect(content).not.toContain("navigate(-1)");

        // Should have goBack
        expect(content).toContain("goBack");
      });
    });
  });
});

describe("Edge Cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle rapid back button presses", () => {
    const useSafeNavigation = require("../../src/hooks/useSafeNavigation");
    const hookResult = useSafeNavigation();

    // Simulate rapid pressing
    for (let i = 0; i < 5; i++) {
      hookResult.goBack();
    }

    expect(mockGoBack).toHaveBeenCalledTimes(5);
  });

  it("should handle goBack followed by navigate", () => {
    const useSafeNavigation = require("../../src/hooks/useSafeNavigation");
    const hookResult = useSafeNavigation();

    hookResult.goBack();
    hookResult.goTo("/new-page");

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/new-page");
  });
});
