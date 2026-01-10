import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ token: "test-token-123" }),
}));

// Mock theme styles - must match the structure used by the component
jest.mock("../../../services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 600: "#0d9488", 700: "#0f766e" },
    secondary: { 600: "#ea580c" },
    neutral: { 0: "#ffffff", 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0" },
    text: { primary: "#0f172a", secondary: "#475569", tertiary: "#94a3b8" },
    error: { 50: "#fff1f2", 600: "#e11d48" },
    success: { 600: "#059669" },
    border: { light: "#e2e8f0" },
    glass: { light: "rgba(255, 255, 255, 0.9)" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24 },
    fontWeight: { normal: "400", medium: "500", semibold: "600", bold: "700" },
  },
}));

// Mock BusinessEmployeeService
const mockValidateInvite = jest.fn();
const mockAcceptInviteWithSignup = jest.fn();
const mockDeclineInvite = jest.fn();

jest.mock("../../../services/fetchRequests/BusinessEmployeeService", () => ({
  validateInvite: (...args) => mockValidateInvite(...args),
  acceptInviteWithSignup: (...args) => mockAcceptInviteWithSignup(...args),
  declineInvite: (...args) => mockDeclineInvite(...args),
}));

// Create mock login function
const mockLogin = jest.fn().mockResolvedValue(undefined);

// Mock AuthContext
jest.mock("../../../services/AuthContext", () => {
  const React = require("react");
  const context = React.createContext({
    user: null,
    login: () => {},
    logout: () => {},
  });
  return {
    AuthContext: context,
    AuthProvider: ({ children }) => children,
  };
});

// Mock Feather icons
jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name, ...props }) => {
    const { Text } = require("react-native");
    return <Text {...props}>{name}</Text>;
  },
}));

// Mock react-native-paper
jest.mock("react-native-paper", () => {
  const { TextInput: RNTextInput, View, Text, TouchableOpacity } = require("react-native");

  // Create TextInput mock with Icon subcomponent
  const TextInputMock = ({ label, value, onChangeText, secureTextEntry, right, style, ...props }) => (
    <View>
      <Text>{label}</Text>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        accessibilityLabel={label}
        testID={label}
        {...props}
      />
      {right}
    </View>
  );

  // Add Icon as a subcomponent of TextInput
  TextInputMock.Icon = ({ icon, onPress }) => (
    <TouchableOpacity onPress={onPress} testID={`icon-${icon}`}>
      <Text>{icon}</Text>
    </TouchableOpacity>
  );

  return {
    TextInput: TextInputMock,
    Checkbox: ({ status, onPress }) => (
      <TouchableOpacity onPress={onPress} testID="checkbox">
        <Text>{status}</Text>
      </TouchableOpacity>
    ),
  };
});

// Mock TermsModal
jest.mock("../../terms", () => ({
  TermsModal: ({ visible, onClose, onAccept, title }) => {
    const { View, Text, TouchableOpacity } = require("react-native");
    if (!visible) return null;
    return (
      <View testID="terms-modal">
        <Text>{title}</Text>
        <TouchableOpacity onPress={() => onAccept("terms-id-123")} testID="accept-terms">
          <Text>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} testID="close-terms">
          <Text>Close</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

// Mock Alert
jest.spyOn(Alert, "alert");

// Import after mocks
import AcceptEmployeeInvitationScreen from "../AcceptEmployeeInvitationScreen";
import { AuthContext } from "../../../services/AuthContext";

// Wrapper component that provides AuthContext with mockLogin
const TestWrapper = ({ children }) => (
  <AuthContext.Provider value={{ user: null, login: mockLogin, logout: jest.fn() }}>
    {children}
  </AuthContext.Provider>
);

const renderWithProviders = (component) => {
  return render(<TestWrapper>{component}</TestWrapper>);
};

describe("AcceptEmployeeInvitationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validInvitation = {
    valid: true,
    invitation: {
      businessName: "CleanCo Services",
      ownerName: "Jane Owner",
      email: "john.employee@example.com",
      firstName: "John",
      lastName: "Employee",
      position: "Cleaner",
      phone: "5551234567",
    },
  };

  // =============================================
  // Loading State Tests
  // =============================================
  describe("Loading State", () => {
    it("should show loading state while validating token", () => {
      mockValidateInvite.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="test-token" />
      );

      expect(getByText("Validating invitation...")).toBeTruthy();
    });

    it("should call validateInvite with the token", async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);

      renderWithProviders(<AcceptEmployeeInvitationScreen inviteToken="my-invite-token" />);

      await waitFor(() => {
        expect(mockValidateInvite).toHaveBeenCalledWith("my-invite-token");
      });
    });
  });

  // =============================================
  // Error State Tests
  // =============================================
  describe("Error States", () => {
    it("should show error when no token is provided", async () => {
      // Don't mock validateInvite - let the component handle null token
      mockValidateInvite.mockResolvedValue({ valid: false, error: "No invitation token provided" });

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken={null} />
      );

      await waitFor(() => {
        expect(getByText("Invalid Invitation")).toBeTruthy();
      });
    });

    it("should show error for invalid token", async () => {
      mockValidateInvite.mockResolvedValue({
        valid: false,
        error: "Invalid invitation link. Please contact your employer.",
      });

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="bad-token" />
      );

      await waitFor(() => {
        expect(getByText("Invalid Invitation")).toBeTruthy();
        expect(getByText("Invalid invitation link. Please contact your employer.")).toBeTruthy();
      });
    });

    it("should show error for expired invitation", async () => {
      mockValidateInvite.mockResolvedValue({
        valid: false,
        isExpired: true,
        error: "This invitation has expired. Please contact your employer to request a new invitation.",
      });

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="expired-token" />
      );

      await waitFor(() => {
        expect(getByText("Invalid Invitation")).toBeTruthy();
      });
    });

    it("should show error for already accepted invitation", async () => {
      mockValidateInvite.mockResolvedValue({
        valid: false,
        isAlreadyAccepted: true,
      });

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="accepted-token" />
      );

      await waitFor(() => {
        expect(getByText("This invitation has already been accepted. Your employee account is ready!")).toBeTruthy();
      });
    });

    it("should show error for terminated employment invitation", async () => {
      mockValidateInvite.mockResolvedValue({
        valid: false,
        isTerminated: true,
      });

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="terminated-token" />
      );

      await waitFor(() => {
        expect(getByText("This invitation is no longer valid. Please contact your employer.")).toBeTruthy();
      });
    });

    it("should show retry button on error", async () => {
      mockValidateInvite.mockRejectedValue(new Error("Network error"));

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByText("Try Again")).toBeTruthy();
      });
    });

    it("should retry validation when retry button is pressed", async () => {
      // Both calls return error to avoid transitioning to Details state
      mockValidateInvite
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error again"));

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByText("Try Again")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Try Again"));
      });

      expect(mockValidateInvite).toHaveBeenCalledTimes(2);
    });

    it("should show sign in link on error", async () => {
      mockValidateInvite.mockResolvedValue({
        valid: false,
        error: "Invalid token",
      });

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="bad-token" />
      );

      await waitFor(() => {
        expect(getByText("Already have an account? Sign In")).toBeTruthy();
      });
    });
  });

  // =============================================
  // Details/Form State Tests
  // NOTE: These tests were skipped due to a known issue with rendering
  // the Details state in the test environment. Fixed by properly awaiting
  // async state transitions.
  // =============================================
  describe("Details State", () => {
    it("should show invitation details when token is valid", async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);

      const { getAllByText, getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        // "Join Team" appears in header and button
        expect(getAllByText("Join Team").length).toBeGreaterThanOrEqual(1);
        expect(getByText("Employer")).toBeTruthy();
      });
    });

    it("should show employer/business name", async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getByText("CleanCo Services")).toBeTruthy();
      });
    });

    it("should show position if provided", async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getByText(/Position: Cleaner/)).toBeTruthy();
      });
    });

    it("should pre-fill first name from invitation", async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);

      const { getByTestId } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        const firstNameInput = getByTestId("First Name *");
        expect(firstNameInput.props.value).toBe("John");
      });
    });

    it("should pre-fill last name from invitation", async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);

      const { getByTestId } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        const lastNameInput = getByTestId("Last Name *");
        expect(lastNameInput.props.value).toBe("Employee");
      });
    });

    it("should show password input fields", async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getByText("Password *")).toBeTruthy();
        expect(getByText("Confirm Password *")).toBeTruthy();
      });
    });

    it("should show password requirements hint", async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(
          getByText(/Password must be at least 8 characters/)
        ).toBeTruthy();
      });
    });

    it("should show terms and privacy checkboxes", async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getByText(/Terms and Conditions/)).toBeTruthy();
        expect(getByText(/Privacy Policy/)).toBeTruthy();
      });
    });

    it("should show Join Team button", async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);

      const { getAllByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        // "Join Team" appears in header and button (at least 2 instances)
        expect(getAllByText("Join Team").length).toBeGreaterThanOrEqual(2);
      });
    });

    it("should show decline link", async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getByText("Decline Invitation")).toBeTruthy();
      });
    });
  });

  // =============================================
  // Form Validation Tests
  // =============================================
  describe("Form Validation", () => {
    beforeEach(async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);
    });

    it("should show error if first name is empty", async () => {
      const { getByText, getByTestId, getAllByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getAllByText("Join Team").length).toBeGreaterThanOrEqual(1);
      });

      // Clear first name
      const firstNameInput = getByTestId("First Name *");
      await act(async () => {
        fireEvent.changeText(firstNameInput, "");
      });

      // Try to submit (get the button which is the second "Join Team" text)
      const joinButtons = getAllByText("Join Team");
      await act(async () => {
        fireEvent.press(joinButtons[joinButtons.length - 1]);
      });

      await waitFor(() => {
        expect(getByText("First name is required.")).toBeTruthy();
      });
    });

    it("should show error if username is too short", async () => {
      const { getByText, getByTestId, getAllByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getAllByText("Join Team").length).toBeGreaterThanOrEqual(1);
      });

      // Enter short username
      const usernameInput = getByTestId("Username *");
      await act(async () => {
        fireEvent.changeText(usernameInput, "abc");
      });

      // Try to submit
      const joinButtons = getAllByText("Join Team");
      await act(async () => {
        fireEvent.press(joinButtons[joinButtons.length - 1]);
      });

      await waitFor(() => {
        expect(getByText(/Username must be between 4 and 12 characters/)).toBeTruthy();
      });
    });

    it("should show error if password is too weak", async () => {
      const { getByText, getByTestId, getAllByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getAllByText("Join Team").length).toBeGreaterThanOrEqual(1);
      });

      // Fill required fields
      await act(async () => {
        fireEvent.changeText(getByTestId("Username *"), "testuser");
        fireEvent.changeText(getByTestId("Password *"), "weak");
        fireEvent.changeText(getByTestId("Confirm Password *"), "weak");
      });

      // Try to submit
      const joinButtons = getAllByText("Join Team");
      await act(async () => {
        fireEvent.press(joinButtons[joinButtons.length - 1]);
      });

      await waitFor(() => {
        // There are multiple elements with this text (hint + error), check for at least 2
        expect(getAllByText(/Password must be at least 8 characters/).length).toBeGreaterThanOrEqual(2);
      });
    });

    it("should show error if passwords do not match", async () => {
      const { getByText, getByTestId, getAllByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getAllByText("Join Team").length).toBeGreaterThanOrEqual(1);
      });

      // Fill with mismatched passwords
      await act(async () => {
        fireEvent.changeText(getByTestId("Username *"), "testuser");
        fireEvent.changeText(getByTestId("Password *"), "AAbb@@33cc");
        fireEvent.changeText(getByTestId("Confirm Password *"), "AAbb@@33dd");
      });

      // Try to submit
      const joinButtons = getAllByText("Join Team");
      await act(async () => {
        fireEvent.press(joinButtons[joinButtons.length - 1]);
      });

      await waitFor(() => {
        expect(getByText("Passwords do not match.")).toBeTruthy();
      });
    });

    it("should show error if terms not accepted", async () => {
      const { getByText, getByTestId, getAllByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getAllByText("Join Team").length).toBeGreaterThanOrEqual(1);
      });

      // Fill all required fields but don't accept terms
      await act(async () => {
        fireEvent.changeText(getByTestId("Username *"), "testuser");
        fireEvent.changeText(getByTestId("Password *"), "AAbb@@33cc");
        fireEvent.changeText(getByTestId("Confirm Password *"), "AAbb@@33cc");
      });

      // Try to submit
      const joinButtons = getAllByText("Join Team");
      await act(async () => {
        fireEvent.press(joinButtons[joinButtons.length - 1]);
      });

      await waitFor(() => {
        expect(getByText("You must accept the Terms and Conditions.")).toBeTruthy();
      });
    });
  });

  // =============================================
  // Accept Flow Tests
  // =============================================
  describe("Accept Flow", () => {
    beforeEach(async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);
      mockAcceptInviteWithSignup.mockResolvedValue({
        success: true,
        token: "new-auth-token",
        user: { id: 1, firstName: "John", lastName: "Employee" },
      });
    });

    it("should call acceptInviteWithSignup with correct data", async () => {
      const { getByText, getByTestId, getAllByTestId, getAllByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getAllByText("Join Team").length).toBeGreaterThanOrEqual(1);
      });

      // Fill form
      await act(async () => {
        fireEvent.changeText(getByTestId("Username *"), "johnemployee");
        fireEvent.changeText(getByTestId("Password *"), "AAbb@@33cc");
        fireEvent.changeText(getByTestId("Confirm Password *"), "AAbb@@33cc");
        fireEvent.changeText(getByTestId("Phone Number"), "555-123-4567");
      });

      // Accept terms (click checkbox to open modal, then accept)
      const checkboxes = getAllByTestId("checkbox");
      await act(async () => {
        fireEvent.press(checkboxes[0]); // Terms checkbox
      });

      // Accept in modal
      await waitFor(() => {
        expect(getByTestId("terms-modal")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.press(getByTestId("accept-terms"));
      });

      // Accept privacy
      await act(async () => {
        fireEvent.press(checkboxes[1]); // Privacy checkbox
      });
      await waitFor(() => {
        expect(getByTestId("terms-modal")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.press(getByTestId("accept-terms"));
      });

      // Submit
      const joinButtons = getAllByText("Join Team");
      await act(async () => {
        fireEvent.press(joinButtons[joinButtons.length - 1]);
      });

      await waitFor(() => {
        expect(mockAcceptInviteWithSignup).toHaveBeenCalledWith(
          "valid-token",
          expect.objectContaining({
            firstName: "John",
            lastName: "Employee",
            username: "johnemployee",
            password: "AAbb@@33cc",
            phone: "5551234567",
          })
        );
      });
    });

    it("should call login with returned token on success", async () => {
      const { getByText, getByTestId, getAllByTestId, getAllByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getAllByText("Join Team").length).toBeGreaterThanOrEqual(1);
      });

      // Fill minimum required fields
      await act(async () => {
        fireEvent.changeText(getByTestId("Username *"), "johnemployee");
        fireEvent.changeText(getByTestId("Password *"), "AAbb@@33cc");
        fireEvent.changeText(getByTestId("Confirm Password *"), "AAbb@@33cc");
      });

      // Accept terms and privacy
      const checkboxes = getAllByTestId("checkbox");
      await act(async () => {
        fireEvent.press(checkboxes[0]);
      });
      await waitFor(() => {
        expect(getByTestId("terms-modal")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.press(getByTestId("accept-terms"));
      });
      await act(async () => {
        fireEvent.press(checkboxes[1]);
      });
      await waitFor(() => {
        expect(getByTestId("terms-modal")).toBeTruthy();
      });
      await act(async () => {
        fireEvent.press(getByTestId("accept-terms"));
      });

      // Submit
      const joinButtons = getAllByText("Join Team");
      await act(async () => {
        fireEvent.press(joinButtons[joinButtons.length - 1]);
      });

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith("new-auth-token");
      });
    });

    it("should show success state after accepting", async () => {
      const { getByText, getByTestId, getAllByTestId, getAllByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getAllByText("Join Team").length).toBeGreaterThanOrEqual(1);
      });

      // Fill minimum required fields and accept terms
      await act(async () => {
        fireEvent.changeText(getByTestId("Username *"), "johnemployee");
        fireEvent.changeText(getByTestId("Password *"), "AAbb@@33cc");
        fireEvent.changeText(getByTestId("Confirm Password *"), "AAbb@@33cc");
      });

      const checkboxes = getAllByTestId("checkbox");
      await act(async () => {
        fireEvent.press(checkboxes[0]);
      });
      await waitFor(() => getByTestId("terms-modal"));
      await act(async () => {
        fireEvent.press(getByTestId("accept-terms"));
      });
      await act(async () => {
        fireEvent.press(checkboxes[1]);
      });
      await waitFor(() => getByTestId("terms-modal"));
      await act(async () => {
        fireEvent.press(getByTestId("accept-terms"));
      });

      // Submit
      const joinButtons = getAllByText("Join Team");
      await act(async () => {
        fireEvent.press(joinButtons[joinButtons.length - 1]);
      });

      await waitFor(() => {
        expect(getByText("Welcome to the Team!")).toBeTruthy();
      });
    });

    it("should show error message if accept fails", async () => {
      mockAcceptInviteWithSignup.mockResolvedValue({
        success: false,
        error: "Username already exists",
      });

      const { getByText, getByTestId, getAllByTestId, getAllByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getAllByText("Join Team").length).toBeGreaterThanOrEqual(1);
      });

      // Fill form
      await act(async () => {
        fireEvent.changeText(getByTestId("Username *"), "existinguser");
        fireEvent.changeText(getByTestId("Password *"), "AAbb@@33cc");
        fireEvent.changeText(getByTestId("Confirm Password *"), "AAbb@@33cc");
      });

      // Accept terms
      const checkboxes = getAllByTestId("checkbox");
      await act(async () => {
        fireEvent.press(checkboxes[0]);
      });
      await waitFor(() => getByTestId("terms-modal"));
      await act(async () => {
        fireEvent.press(getByTestId("accept-terms"));
      });
      await act(async () => {
        fireEvent.press(checkboxes[1]);
      });
      await waitFor(() => getByTestId("terms-modal"));
      await act(async () => {
        fireEvent.press(getByTestId("accept-terms"));
      });

      // Submit
      const joinButtons = getAllByText("Join Team");
      await act(async () => {
        fireEvent.press(joinButtons[joinButtons.length - 1]);
      });

      await waitFor(() => {
        expect(getByText("Username already exists")).toBeTruthy();
      });
    });
  });

  // =============================================
  // Decline Flow Tests
  // =============================================
  describe("Decline Flow", () => {
    beforeEach(async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);
      mockDeclineInvite.mockResolvedValue({ success: true });
    });

    it("should show confirmation alert when declining", async () => {
      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getByText("Decline Invitation")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Decline Invitation"));
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        "Decline Invitation",
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ text: "Cancel" }),
          expect.objectContaining({ text: "Decline" }),
        ])
      );
    });

    it("should call declineInvite when confirmed", async () => {
      // Mock Alert.alert to auto-confirm
      Alert.alert.mockImplementation((title, message, buttons) => {
        const declineButton = buttons.find((b) => b.text === "Decline");
        if (declineButton && declineButton.onPress) {
          declineButton.onPress();
        }
      });

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getByText("Decline Invitation")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Decline Invitation"));
      });

      await waitFor(() => {
        expect(mockDeclineInvite).toHaveBeenCalledWith("valid-token");
      });
    });

    it("should not call declineInvite when cancelled", async () => {
      // Mock Alert.alert to cancel
      Alert.alert.mockImplementation((title, message, buttons) => {
        const cancelButton = buttons.find((b) => b.text === "Cancel");
        if (cancelButton && cancelButton.onPress) {
          cancelButton.onPress();
        }
      });

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getByText("Decline Invitation")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Decline Invitation"));
      });

      expect(mockDeclineInvite).not.toHaveBeenCalled();
    });
  });

  // =============================================
  // Navigation Tests
  // =============================================
  describe("Navigation", () => {
    it("should navigate to home on close button press", async () => {
      mockValidateInvite.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="valid-token" />
      );

      await waitFor(() => {
        expect(getByText("x")).toBeTruthy(); // Close button icon
      });

      await act(async () => {
        fireEvent.press(getByText("x"));
      });

      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    it("should navigate to sign-in from error screen", async () => {
      mockValidateInvite.mockResolvedValue({
        valid: false,
        error: "Invalid token",
      });

      const { getByText } = renderWithProviders(
        <AcceptEmployeeInvitationScreen inviteToken="bad-token" />
      );

      await waitFor(() => {
        expect(getByText("Already have an account? Sign In")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Already have an account? Sign In"));
      });

      expect(mockNavigate).toHaveBeenCalledWith("/sign-in");
    });
  });
});
