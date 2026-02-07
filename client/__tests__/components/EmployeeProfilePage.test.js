import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import EmployeeProfilePage from "../../src/components/businessEmployee/EmployeeProfilePage";
import BusinessEmployeeService from "../../src/services/fetchRequests/BusinessEmployeeService";

// Mock react-router-native
const mockNavigate = jest.fn();
const mockLocation = { state: null };
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock BusinessEmployeeService
jest.mock("../../src/services/fetchRequests/BusinessEmployeeService", () => ({
  getProfile: jest.fn(),
  getMyJobs: jest.fn(),
}));

// Mock the EmployeeJobsCalendarViewOnly component
jest.mock("../../src/components/businessEmployee/EmployeeJobsCalendarViewOnly", () => {
  const { View, Text } = require("react-native");
  return function MockEmployeeJobsCalendarViewOnly({ state }) {
    return (
      <View testID="mock-calendar">
        <Text>Mock Calendar</Text>
        <Text testID="calendar-token">{state?.currentUser?.token}</Text>
      </View>
    );
  };
});

// Mock theme
jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0f9ff", 100: "#e0f2fe", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1" },
    secondary: { 500: "#8b5cf6", 600: "#7c3aed" },
    success: { 500: "#22c55e", 600: "#16a34a" },
    warning: { 500: "#f59e0b", 600: "#d97706" },
    error: { 500: "#ef4444", 600: "#dc2626" },
    neutral: { 300: "#d4d4d4", 400: "#a3a3a3", 500: "#737373" },
    text: { primary: "#171717", secondary: "#525252", tertiary: "#a3a3a3" },
    background: { primary: "#ffffff", secondary: "#fafafa" },
    border: { light: "#e5e5e5" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {}, md: {} },
}));

describe("EmployeeProfilePage", () => {
  const mockState = {
    currentUser: {
      token: "test-token-123",
      id: 1,
    },
  };

  const mockProfile = {
    profile: {
      id: 10,
      firstName: "John",
      lastName: "Employee",
      role: "cleaner",
      businessOwner: {
        id: 1,
        businessName: "Sparkling Clean Co.",
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    BusinessEmployeeService.getProfile.mockResolvedValue(mockProfile);
    BusinessEmployeeService.getMyJobs.mockResolvedValue({ jobs: [] });
  });

  describe("Loading State", () => {
    it("shows loading indicator while fetching profile", () => {
      BusinessEmployeeService.getProfile.mockImplementation(() => new Promise(() => {}));

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      expect(getByText("Loading profile...")).toBeTruthy();
    });

    it("fetches profile on mount", async () => {
      render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(BusinessEmployeeService.getProfile).toHaveBeenCalledWith(
          mockState.currentUser.token
        );
      });
    });
  });

  describe("Error State", () => {
    it("shows error message when profile fetch fails", async () => {
      BusinessEmployeeService.getProfile.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Failed to load profile")).toBeTruthy();
      });
    });

    it("shows retry button on error", async () => {
      BusinessEmployeeService.getProfile.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Retry")).toBeTruthy();
      });
    });

    it("retries fetching when retry button is pressed", async () => {
      BusinessEmployeeService.getProfile
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(mockProfile);

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Retry")).toBeTruthy();
      });

      fireEvent.press(getByText("Retry"));

      await waitFor(() => {
        expect(BusinessEmployeeService.getProfile).toHaveBeenCalledTimes(2);
      });
    });

    it("shows header even on error", async () => {
      BusinessEmployeeService.getProfile.mockRejectedValue(new Error("Network error"));

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("My Profile")).toBeTruthy();
      });
    });
  });

  describe("Header", () => {
    it("renders header with title", async () => {
      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("My Profile")).toBeTruthy();
      });
    });
  });

  describe("Profile Card", () => {
    it("displays employee full name", async () => {
      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("John Employee")).toBeTruthy();
      });
    });

    it("displays employee first initial in avatar", async () => {
      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("J")).toBeTruthy();
      });
    });

    it("displays business name", async () => {
      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Working for: Sparkling Clean Co.")).toBeTruthy();
      });
    });

    it("displays employee role badge", async () => {
      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Cleaner")).toBeTruthy();
      });
    });
  });

  describe("Profile Card - Fallbacks", () => {
    it("shows 'Employee' when firstName is missing", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({
        profile: {
          id: 10,
          businessOwner: { businessName: "Test Business" },
        },
      });

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Employee")).toBeTruthy();
      });
    });

    it("shows 'Your Business' when businessName is missing", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({
        profile: {
          id: 10,
          firstName: "Test",
          lastName: "User",
        },
      });

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Working for: Your Business")).toBeTruthy();
      });
    });

    it("shows 'E' initial when firstName is missing", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({
        profile: {
          id: 10,
          businessOwner: { businessName: "Test Business" },
        },
      });

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("E")).toBeTruthy();
      });
    });

    it("handles profile without nested profile object", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({
        id: 10,
        firstName: "Direct",
        lastName: "Response",
        role: "supervisor",
        businessOwner: { businessName: "Direct Business" },
      });

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Direct Response")).toBeTruthy();
        expect(getByText("Working for: Direct Business")).toBeTruthy();
      });
    });

    it("does not show role badge when role is missing", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({
        profile: {
          id: 10,
          firstName: "Test",
          lastName: "User",
          businessOwner: { businessName: "Test Business" },
        },
      });

      const { queryByText, getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Test User")).toBeTruthy();
      });

      expect(queryByText("Cleaner")).toBeNull();
      expect(queryByText("Supervisor")).toBeNull();
    });
  });

  describe("Role Badge Formatting", () => {
    it("capitalizes role correctly", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({
        profile: {
          id: 10,
          firstName: "Test",
          lastName: "User",
          role: "supervisor",
          businessOwner: { businessName: "Test Business" },
        },
      });

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Supervisor")).toBeTruthy();
      });
    });

    it("handles single character role", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({
        profile: {
          id: 10,
          firstName: "Test",
          lastName: "User",
          role: "a",
          businessOwner: { businessName: "Test Business" },
        },
      });

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("A")).toBeTruthy();
      });
    });
  });

  describe("Calendar Section", () => {
    it("renders section header with calendar title", async () => {
      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Your Jobs Calendar")).toBeTruthy();
      });
    });

    it("renders the EmployeeJobsCalendarViewOnly component", async () => {
      const { getByTestId } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByTestId("mock-calendar")).toBeTruthy();
      });
    });

    it("passes state to the calendar component", async () => {
      const { getByTestId } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByTestId("calendar-token")).toBeTruthy();
        expect(getByTestId("calendar-token").props.children).toBe("test-token-123");
      });
    });
  });

  describe("Employee Name Formatting", () => {
    it("displays only first name when lastName is missing", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({
        profile: {
          id: 10,
          firstName: "Alice",
          businessOwner: { businessName: "Test Business" },
        },
      });

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Alice")).toBeTruthy();
      });
    });

    it("trims extra whitespace from name", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({
        profile: {
          id: 10,
          firstName: "Bob",
          lastName: "",
          businessOwner: { businessName: "Test Business" },
        },
      });

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Bob")).toBeTruthy();
      });
    });
  });

  describe("Different Profile Structures", () => {
    it("handles profile with profile wrapper", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({
        profile: {
          firstName: "Wrapper",
          lastName: "Profile",
          role: "cleaner",
          businessOwner: { businessName: "Wrapper Business" },
        },
      });

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Wrapper Profile")).toBeTruthy();
        expect(getByText("Working for: Wrapper Business")).toBeTruthy();
      });
    });

    it("handles profile without profile wrapper", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({
        firstName: "Direct",
        lastName: "Profile",
        role: "lead",
        businessOwner: { businessName: "Direct Business" },
      });

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Direct Profile")).toBeTruthy();
        expect(getByText("Working for: Direct Business")).toBeTruthy();
        expect(getByText("Lead")).toBeTruthy();
      });
    });
  });

  describe("Avatar Display", () => {
    it("displays uppercase initial", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({
        profile: {
          firstName: "lowercase",
          lastName: "name",
          businessOwner: { businessName: "Test" },
        },
      });

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("L")).toBeTruthy();
      });
    });
  });

  describe("Integration with Calendar", () => {
    it("calendar receives correct state prop", async () => {
      const customState = {
        currentUser: {
          token: "custom-token-456",
          id: 2,
        },
      };

      const { getByTestId } = render(<EmployeeProfilePage state={customState} />);

      await waitFor(() => {
        const tokenElement = getByTestId("calendar-token");
        expect(tokenElement.props.children).toBe("custom-token-456");
      });
    });
  });

  describe("Null/Undefined Handling", () => {
    it("handles null profile response gracefully", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue(null);

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Employee")).toBeTruthy();
        expect(getByText("Working for: Your Business")).toBeTruthy();
      });
    });

    it("handles undefined profile response gracefully", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue(undefined);

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Employee")).toBeTruthy();
        expect(getByText("Working for: Your Business")).toBeTruthy();
      });
    });

    it("handles empty object response", async () => {
      BusinessEmployeeService.getProfile.mockResolvedValue({});

      const { getByText } = render(<EmployeeProfilePage state={mockState} />);

      await waitFor(() => {
        expect(getByText("Employee")).toBeTruthy();
        expect(getByText("Working for: Your Business")).toBeTruthy();
      });
    });
  });
});
