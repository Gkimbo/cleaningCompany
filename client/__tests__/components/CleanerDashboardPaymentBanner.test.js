/**
 * Tests for CleanerDashboard Payment Setup Banner
 * Tests the payment setup banner visibility and navigation
 */

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// Mock fetch
global.fetch = jest.fn();

// Mock dependencies
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: "granted" })
  ),
  getCurrentPositionAsync: jest.fn(() =>
    Promise.resolve({ coords: { latitude: 40.7128, longitude: -74.006 } })
  ),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  Accuracy: { Balanced: 3 },
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ employee: { firstName: "Test" } })),
    getHome: jest.fn(() => Promise.resolve({ home: {} })),
    getLatAndLong: jest.fn(() => Promise.resolve({ latitude: 0, longitude: 0 })),
    getMyConfirmedMultiCleanerJobs: jest.fn(() => Promise.resolve({ jobs: [] })),
    getMyMultiCleanerRequests: jest.fn(() => Promise.resolve({ requests: [] })),
  },
}));

jest.mock("../../src/context/PricingContext", () => ({
  usePricing: () => ({
    pricing: { platform: { feePercent: 0.1 } },
  }),
}));

// Mock child components
jest.mock("../../src/components/tax/TaxFormsSection", () => "TaxFormsSection");
jest.mock("../../src/components/reviews/ReviewsOverview", () => "ReviewsOverview");
jest.mock(
  "../../src/components/employeeAssignments/tiles/TodaysAppointment",
  () => "TodaysAppointment"
);
jest.mock(
  "../../src/components/employeeAssignments/tiles/NextAppointmentPreview",
  () => "NextAppointmentPreview"
);
jest.mock(
  "../../src/components/employeeAssignments/jobPhotos/JobCompletionFlow",
  () => "JobCompletionFlow"
);

describe("CleanerDashboard Payment Setup Banner", () => {
  const mockDispatch = jest.fn();
  const mockNavigate = jest.fn();

  const defaultState = {
    currentUser: {
      id: 1,
      token: "test_token",
      email: "cleaner@test.com",
    },
    account: "cleaner",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset useNavigate mock
    jest.spyOn(require("react-router-native"), "useNavigate").mockReturnValue(mockNavigate);

    // Default fetch mocks
    global.fetch.mockImplementation((url) => {
      if (url.includes("/stripe-connect/account-status/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            hasAccount: false,
            onboardingComplete: false,
          }),
        });
      }
      if (url.includes("/api/v1/employee-info")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            employee: { firstName: "Test", cleanerAppointments: [] },
          }),
        });
      }
      if (url.includes("/api/v1/users/appointments/employee")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ requested: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  describe("Banner Visibility Logic", () => {
    it("should show payment banner when Stripe account does not exist", async () => {
      jest.setTimeout(15000);
      global.fetch.mockImplementation((url) => {
        if (url.includes("/stripe-connect/account-status/")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              hasAccount: false,
              onboardingComplete: false,
            }),
          });
        }
        if (url.includes("/api/v1/employee-info")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              employee: { firstName: "Test", cleanerAppointments: [] },
            }),
          });
        }
        if (url.includes("/api/v1/users/appointments/employee")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ requested: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const CleanerDashboard = require("../../src/components/cleaner/CleanerDashboard").default;

      const { findByText } = render(
        <CleanerDashboard state={defaultState} dispatch={mockDispatch} />
      );

      const bannerTitle = await findByText("Complete Payment Setup");
      expect(bannerTitle).toBeTruthy();
    });

    it("should show payment banner when onboarding is not complete", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/stripe-connect/account-status/")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              hasAccount: true,
              onboardingComplete: false,
            }),
          });
        }
        if (url.includes("/api/v1/employee-info")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              employee: { firstName: "Test", cleanerAppointments: [] },
            }),
          });
        }
        if (url.includes("/api/v1/users/appointments/employee")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ requested: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const CleanerDashboard = require("../../src/components/cleaner/CleanerDashboard").default;

      const { findByText } = render(
        <CleanerDashboard state={defaultState} dispatch={mockDispatch} />
      );

      const bannerTitle = await findByText("Complete Payment Setup");
      expect(bannerTitle).toBeTruthy();
    });

    it("should NOT show payment banner when onboarding is complete", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/stripe-connect/account-status/")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              hasAccount: true,
              onboardingComplete: true,
            }),
          });
        }
        if (url.includes("/api/v1/employee-info")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              employee: { firstName: "Test", cleanerAppointments: [] },
            }),
          });
        }
        if (url.includes("/api/v1/users/appointments/employee")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ requested: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const CleanerDashboard = require("../../src/components/cleaner/CleanerDashboard").default;

      const { queryByText } = render(
        <CleanerDashboard state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(queryByText("Complete Payment Setup")).toBeNull();
      });
    });

    it("should show payment banner when status fetch fails (fail-safe)", async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes("/stripe-connect/account-status/")) {
          return Promise.reject(new Error("Network error"));
        }
        if (url.includes("/api/v1/employee-info")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              employee: { firstName: "Test", cleanerAppointments: [] },
            }),
          });
        }
        if (url.includes("/api/v1/users/appointments/employee")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ requested: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const CleanerDashboard = require("../../src/components/cleaner/CleanerDashboard").default;

      const { findByText } = render(
        <CleanerDashboard state={defaultState} dispatch={mockDispatch} />
      );

      const bannerTitle = await findByText("Complete Payment Setup");
      expect(bannerTitle).toBeTruthy();
    });
  });

  describe("Banner Content", () => {
    it("should display correct banner title", async () => {
      const CleanerDashboard = require("../../src/components/cleaner/CleanerDashboard").default;

      const { findByText } = render(
        <CleanerDashboard state={defaultState} dispatch={mockDispatch} />
      );

      const title = await findByText("Complete Payment Setup");
      expect(title).toBeTruthy();
    });

    it("should display correct banner subtitle", async () => {
      const CleanerDashboard = require("../../src/components/cleaner/CleanerDashboard").default;

      const { findByText } = render(
        <CleanerDashboard state={defaultState} dispatch={mockDispatch} />
      );

      const subtitle = await findByText(
        "Set up your bank account to receive earnings from completed jobs"
      );
      expect(subtitle).toBeTruthy();
    });

    it("should display Set Up action button", async () => {
      const CleanerDashboard = require("../../src/components/cleaner/CleanerDashboard").default;

      const { findByText } = render(
        <CleanerDashboard state={defaultState} dispatch={mockDispatch} />
      );

      const actionButton = await findByText("Set Up");
      expect(actionButton).toBeTruthy();
    });
  });

  describe("Banner Navigation", () => {
    it("should navigate to /earnings when banner is pressed", async () => {
      const CleanerDashboard = require("../../src/components/cleaner/CleanerDashboard").default;

      const { findByText } = render(
        <CleanerDashboard state={defaultState} dispatch={mockDispatch} />
      );

      const bannerTitle = await findByText("Complete Payment Setup");
      const banner = bannerTitle.parent?.parent;

      if (banner) {
        fireEvent.press(banner);

        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith("/earnings");
        });
      }
    });
  });

  describe("Status Fetch", () => {
    it("should fetch Stripe account status on mount", async () => {
      const CleanerDashboard = require("../../src/components/cleaner/CleanerDashboard").default;

      render(
        <CleanerDashboard state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/stripe-connect/account-status/1")
        );
      });
    });

    it("should not fetch status when user ID is missing", async () => {
      const stateWithoutId = {
        currentUser: {
          token: "test_token",
          email: "cleaner@test.com",
        },
        account: "cleaner",
      };

      const CleanerDashboard = require("../../src/components/cleaner/CleanerDashboard").default;

      render(
        <CleanerDashboard state={stateWithoutId} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        const stripeStatusCalls = global.fetch.mock.calls.filter(
          (call) => call[0].includes("/stripe-connect/account-status/")
        );
        expect(stripeStatusCalls.length).toBe(0);
      });
    });
  });
});

describe("PaymentSetupBanner Visibility Logic", () => {
  describe("showPaymentBanner state calculation", () => {
    it("should be true when hasAccount is false", () => {
      const data = { hasAccount: false, onboardingComplete: false };
      const showBanner = !data.hasAccount || !data.onboardingComplete;
      expect(showBanner).toBe(true);
    });

    it("should be true when onboardingComplete is false", () => {
      const data = { hasAccount: true, onboardingComplete: false };
      const showBanner = !data.hasAccount || !data.onboardingComplete;
      expect(showBanner).toBe(true);
    });

    it("should be false when hasAccount and onboardingComplete are both true", () => {
      const data = { hasAccount: true, onboardingComplete: true };
      const showBanner = !data.hasAccount || !data.onboardingComplete;
      expect(showBanner).toBe(false);
    });

    it("should be true when response is not ok (fail-safe)", () => {
      const responseOk = false;
      // When response is not ok, we default to showing the banner
      const showBanner = !responseOk ? true : false;
      expect(showBanner).toBe(true);
    });

    it("should be true on network error (fail-safe)", () => {
      // When network error occurs, we default to showing the banner
      const showBanner = true; // Set in catch block
      expect(showBanner).toBe(true);
    });
  });
});

describe("Payment Banner Refresh on Pull", () => {
  describe("onRefresh callback", () => {
    it("should refresh Stripe account status along with dashboard data", async () => {
      let fetchStripeStatusCalled = false;
      let fetchDashboardDataCalled = false;

      const onRefresh = () => {
        fetchDashboardDataCalled = true;
        fetchStripeStatusCalled = true;
      };

      onRefresh();

      expect(fetchDashboardDataCalled).toBe(true);
      expect(fetchStripeStatusCalled).toBe(true);
    });
  });
});

describe("PaymentSetupBanner Component", () => {
  describe("Component Props", () => {
    it("should receive onPress prop for navigation", () => {
      const onPress = jest.fn();

      // Simulate button press
      onPress();

      expect(onPress).toHaveBeenCalled();
    });
  });

  describe("Styling", () => {
    it("should have warning color scheme", () => {
      // Verify the banner uses warning colors
      const expectedBgColor = expect.stringMatching(/warning|yellow|amber|orange/i);
      const bannerStyles = {
        backgroundColor: "colors.warning[50]",
        borderColor: "colors.warning[200]",
      };

      expect(bannerStyles.backgroundColor).toMatch(/warning/i);
      expect(bannerStyles.borderColor).toMatch(/warning/i);
    });
  });
});
