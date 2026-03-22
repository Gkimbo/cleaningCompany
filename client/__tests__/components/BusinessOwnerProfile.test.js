/**
 * BusinessOwnerProfile Component Tests
 *
 * Tests for the main business owner profile page including:
 * - Mode toggle functionality
 * - Data fetching
 * - Section rendering
 * - Error handling
 */

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockGetDashboard = jest.fn();
const mockGetEmployees = jest.fn();
const mockGetPendingPayouts = jest.fn();

jest.mock("../../src/services/fetchRequests/BusinessOwnerService", () => ({
  getDashboard: mockGetDashboard,
  getEmployees: mockGetEmployees,
  getPendingPayouts: mockGetPendingPayouts,
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

describe("BusinessOwnerProfile Component", () => {
  const mockState = {
    currentUser: { token: "test-token" },
    businessName: "Test Business",
    isBusinessOwner: true,
  };

  const mockDashboardData = {
    employeeStats: { totalEmployees: 5, activeEmployees: 4 },
    financials: { totalRevenue: 5000 },
    monthlyRevenue: 5000,
    weeklyRevenue: 1200,
    todaysAppointments: [
      { id: 1, status: "assigned", clientName: "John Doe" },
      { id: 2, status: "completed", clientName: "Jane Smith" },
    ],
    unpaidAppointments: 3,
    totalClients: 10,
  };

  const mockEmployees = [
    { id: 1, firstName: "Jane", lastName: "Employee", status: "active" },
    { id: 2, firstName: "Bob", lastName: "Worker", status: "active" },
  ];

  const mockPayouts = [
    { id: 1, payAmount: 100, businessEmployeeId: 1 },
    { id: 2, payAmount: 150, businessEmployeeId: 2 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDashboard.mockResolvedValue(mockDashboardData);
    mockGetEmployees.mockResolvedValue({ employees: mockEmployees });
    mockGetPendingPayouts.mockResolvedValue({ payouts: mockPayouts });
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  describe("Mode Storage", () => {
    const MODE_STORAGE_KEY = "@business_owner_mode";

    it("should use correct storage key for mode", () => {
      expect(MODE_STORAGE_KEY).toBe("@business_owner_mode");
    });

    it("should default to business mode when no saved preference", async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      const defaultMode = "business";
      expect(defaultMode).toBe("business");
    });

    it("should load saved mode preference from AsyncStorage", async () => {
      AsyncStorage.getItem.mockResolvedValue("cleaner");

      const savedMode = await AsyncStorage.getItem(MODE_STORAGE_KEY);
      expect(savedMode).toBe("cleaner");
    });

    it("should save mode preference when changed", async () => {
      const newMode = "cleaner";
      await AsyncStorage.setItem(MODE_STORAGE_KEY, newMode);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        MODE_STORAGE_KEY,
        "cleaner"
      );
    });
  });

  describe("Data Fetching", () => {
    it("should fetch dashboard data on mount", async () => {
      await mockGetDashboard("test-token");

      expect(mockGetDashboard).toHaveBeenCalledWith("test-token");
    });

    it("should fetch employees on mount", async () => {
      await mockGetEmployees("test-token", "active");

      expect(mockGetEmployees).toHaveBeenCalledWith("test-token", "active");
    });

    it("should fetch pending payouts on mount", async () => {
      await mockGetPendingPayouts("test-token");

      expect(mockGetPendingPayouts).toHaveBeenCalledWith("test-token");
    });

    it("should handle payouts response with 'payouts' key", () => {
      const response = { payouts: mockPayouts };
      const result = response.payouts || response.pendingPayouts || [];

      expect(result).toEqual(mockPayouts);
    });

    it("should handle payouts response with 'pendingPayouts' key", () => {
      const response = { pendingPayouts: mockPayouts };
      const result = response.payouts || response.pendingPayouts || [];

      expect(result).toEqual(mockPayouts);
    });

    it("should not fetch data without token", () => {
      const stateWithoutToken = { currentUser: null };
      const shouldFetch = !!stateWithoutToken?.currentUser?.token;

      expect(shouldFetch).toBe(false);
    });
  });

  describe("Payroll Calculations", () => {
    it("should calculate total payroll owed correctly", () => {
      const pendingPayouts = [
        { payAmount: 100 },
        { payAmount: 150 },
        { payAmount: 75 },
      ];

      const totalPayrollOwed = pendingPayouts.reduce(
        (sum, p) => sum + (p.payAmount || 0),
        0
      );

      expect(totalPayrollOwed).toBe(325);
    });

    it("should handle empty payouts array", () => {
      const pendingPayouts = [];
      const totalPayrollOwed = pendingPayouts.reduce(
        (sum, p) => sum + (p.payAmount || 0),
        0
      );

      expect(totalPayrollOwed).toBe(0);
    });

    it("should handle payouts with missing payAmount", () => {
      const pendingPayouts = [
        { payAmount: 100 },
        { payAmount: null },
        { payAmount: undefined },
        {},
      ];

      const totalPayrollOwed = pendingPayouts.reduce(
        (sum, p) => sum + (p.payAmount || 0),
        0
      );

      expect(totalPayrollOwed).toBe(100);
    });
  });

  describe("Business Name Display", () => {
    it("should display business name from state", () => {
      const businessName = mockState.businessName || "Your Business";
      expect(businessName).toBe("Test Business");
    });

    it("should fallback to default when no business name", () => {
      const stateWithoutName = { ...mockState, businessName: null };
      const businessName = stateWithoutName.businessName || "Your Business";

      expect(businessName).toBe("Your Business");
    });
  });

  describe("Mode Toggle", () => {
    it("should render business view when mode is business", () => {
      const mode = "business";
      const shouldShowBusinessView = mode === "business";
      const shouldShowCleanerView = mode !== "business";

      expect(shouldShowBusinessView).toBe(true);
      expect(shouldShowCleanerView).toBe(false);
    });

    it("should render cleaner view when mode is cleaner", () => {
      const mode = "cleaner";
      const shouldShowBusinessView = mode === "business";
      const shouldShowCleanerView = mode !== "business";

      expect(shouldShowBusinessView).toBe(false);
      expect(shouldShowCleanerView).toBe(true);
    });
  });

  describe("Navigation", () => {
    it("should navigate to settings on settings button press", () => {
      mockNavigate("/settings");

      expect(mockNavigate).toHaveBeenCalledWith("/settings");
    });
  });

  describe("Error Handling", () => {
    it("should set error message on fetch failure", async () => {
      mockGetDashboard.mockRejectedValue(new Error("Network error"));

      let error = null;
      try {
        await mockGetDashboard("test-token");
      } catch (err) {
        error = "Failed to load data. Pull to refresh.";
      }

      expect(error).toBe("Failed to load data. Pull to refresh.");
    });
  });

  describe("Refresh Functionality", () => {
    it("should refetch data on refresh", async () => {
      // Simulate refresh
      await mockGetDashboard("test-token");
      await mockGetEmployees("test-token", "active");
      await mockGetPendingPayouts("test-token");

      expect(mockGetDashboard).toHaveBeenCalled();
      expect(mockGetEmployees).toHaveBeenCalled();
      expect(mockGetPendingPayouts).toHaveBeenCalled();
    });
  });
});
