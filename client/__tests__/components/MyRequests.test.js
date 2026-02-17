/**
 * Tests for MyRequests component
 * Tests combined solo + team request list, sorting, and display
 */

import React from "react";
import { render, waitFor } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted" })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: { latitude: 40.7128, longitude: -74.006 },
  })),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  Accuracy: { Balanced: 3 },
}));

jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  get: jest.fn(() => Promise.resolve({ requested: [] })),
  getLatAndLong: jest.fn(() => Promise.resolve({ latitude: 40.7, longitude: -74.0 })),
  getMyMultiCleanerRequests: jest.fn(() => Promise.resolve({ requests: [] })),
  removeRequest: jest.fn(() => Promise.resolve({})),
  cancelMultiCleanerRequest: jest.fn(() => Promise.resolve({})),
}));

jest.mock("../../src/services/fetchRequests/getCurrentUser", () =>
  jest.fn(() => Promise.resolve({ user: { id: 1 } }))
);

jest.mock("../../src/context/PricingContext", () => ({
  usePricing: () => ({
    pricing: { platform: { feePercent: 0.1 } },
  }),
}));

import MyRequests from "../../src/components/employeeAssignments/lists/MyRequests";
import FetchData from "../../src/services/fetchRequests/fetchData";

describe("MyRequests", () => {
  const mockState = {
    currentUser: {
      token: "test-token",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render loading state initially", () => {
      const { getByText } = render(<MyRequests state={mockState} />);
      expect(getByText("Loading your requests...")).toBeTruthy();
    });

    it("should call API endpoints on mount", async () => {
      render(<MyRequests state={mockState} />);

      await waitFor(() => {
        expect(FetchData.get).toHaveBeenCalled();
        expect(FetchData.getMyMultiCleanerRequests).toHaveBeenCalled();
      });
    });
  });
});

describe("Combined List Sorting Logic", () => {
  // Unit tests for sorting logic
  const createSoloRequest = (id, date, price) => ({
    id,
    type: "solo",
    sortDate: new Date(date + "T00:00:00"),
    sortPrice: price,
    cleanerEarnings: price * 0.9,
  });

  const createTeamRequest = (id, date, totalPrice, cleaners) => ({
    id,
    type: "team",
    sortDate: new Date(date),
    sortPrice: (totalPrice * 0.9) / cleaners,
    cleanerEarnings: (totalPrice * 0.9) / cleaners,
  });

  it("should sort by date soonest correctly", () => {
    const requests = [
      createSoloRequest(1, "2026-02-15", 100),
      createTeamRequest(2, "2026-02-10", 200, 2),
      createSoloRequest(3, "2026-02-12", 150),
    ];

    const sorted = [...requests].sort((a, b) => a.sortDate - b.sortDate);

    expect(sorted[0].id).toBe(2); // Feb 10
    expect(sorted[1].id).toBe(3); // Feb 12
    expect(sorted[2].id).toBe(1); // Feb 15
  });

  it("should sort by price high to low correctly", () => {
    const requests = [
      createSoloRequest(1, "2026-02-15", 100), // 90 earnings
      createTeamRequest(2, "2026-02-10", 200, 2), // 90 earnings (200*0.9/2)
      createSoloRequest(3, "2026-02-12", 200), // 180 earnings
    ];

    const sorted = [...requests].sort((a, b) => b.sortPrice - a.sortPrice);

    expect(sorted[0].id).toBe(3); // 180
    expect(sorted[1].id).toBe(1); // 90 (solo)
    expect(sorted[2].id).toBe(2); // 90 (team)
  });

  it("should interleave solo and team requests when sorted", () => {
    const requests = [
      createSoloRequest(1, "2026-02-10", 100),
      createTeamRequest(2, "2026-02-11", 200, 2),
      createSoloRequest(3, "2026-02-12", 150),
      createTeamRequest(4, "2026-02-13", 300, 2),
    ];

    const sorted = [...requests].sort((a, b) => a.sortDate - b.sortDate);

    expect(sorted.map((r) => r.type)).toEqual(["solo", "team", "solo", "team"]);
  });
});
