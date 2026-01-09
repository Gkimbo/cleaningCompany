import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ token: "test-token-123" }),
}));

// Mock CleanerClientService
const mockValidateInvitation = jest.fn();
const mockAcceptInvitation = jest.fn();
const mockDeclineInvitation = jest.fn();

jest.mock("../../../services/fetchRequests/CleanerClientService", () => ({
  validateInvitation: (...args) => mockValidateInvitation(...args),
  acceptInvitation: (...args) => mockAcceptInvitation(...args),
  declineInvitation: (...args) => mockDeclineInvitation(...args),
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
  return {
    TextInput: ({ label, value, onChangeText, secureTextEntry, right, style, ...props }) => (
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
    ),
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
import AcceptInvitationScreen from "../AcceptInvitationScreen";
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

describe("AcceptInvitationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validInvitation = {
    valid: true,
    cleaner: {
      businessName: "Sparkle Clean Co",
      name: "John Cleaner",
    },
    home: {
      address: "123 Main St",
      city: "San Francisco",
      state: "CA",
      zipcode: "94102",
      numBeds: 3,
      numBaths: 2,
    },
    client: {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: "5551234567",
    },
  };

  describe("Loading State", () => {
    it("should show loading state while validating token", () => {
      mockValidateInvitation.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      expect(getByText("Validating invitation...")).toBeTruthy();
    });

    it("should call validateInvitation with the token", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      renderWithProviders(<AcceptInvitationScreen inviteToken="my-invite-token" />);

      await waitFor(() => {
        expect(mockValidateInvitation).toHaveBeenCalledWith("my-invite-token");
      });
    });
  });

  describe("Error States", () => {
    it("should show error when no token is provided", async () => {
      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken={null} />
      );

      await waitFor(() => {
        expect(getByText("Invalid Invitation")).toBeTruthy();
        expect(getByText("No invitation token provided")).toBeTruthy();
      });
    });

    it("should show error for invalid token", async () => {
      mockValidateInvitation.mockResolvedValue({
        valid: false,
        error: "Invalid token",
      });

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="bad-token" />
      );

      await waitFor(() => {
        expect(getByText("Invalid Invitation")).toBeTruthy();
        expect(getByText("Invalid token")).toBeTruthy();
      });
    });

    it("should show error for expired token", async () => {
      mockValidateInvitation.mockResolvedValue({
        valid: false,
        expired: true,
      });

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="expired-token" />
      );

      await waitFor(() => {
        expect(getByText("Invalid Invitation")).toBeTruthy();
        expect(
          getByText("This invitation has expired. Please contact your cleaning service to request a new invitation.")
        ).toBeTruthy();
      });
    });

    it("should show error for already accepted invitation", async () => {
      mockValidateInvitation.mockResolvedValue({
        valid: false,
        alreadyAccepted: true,
      });

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="used-token" />
      );

      await waitFor(() => {
        expect(getByText("Invalid Invitation")).toBeTruthy();
        expect(
          getByText("This invitation has already been accepted. Please sign in to your account.")
        ).toBeTruthy();
      });
    });

    it("should show retry button on error", async () => {
      mockValidateInvitation.mockResolvedValue({ valid: false });

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="bad-token" />
      );

      await waitFor(() => {
        expect(getByText("Try Again")).toBeTruthy();
      });
    });

    it("should navigate to sign-in when sign in link is pressed", async () => {
      mockValidateInvitation.mockResolvedValue({ valid: false });

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="bad-token" />
      );

      await waitFor(() => {
        expect(getByText("Already have an account? Sign In")).toBeTruthy();
      });

      fireEvent.press(getByText("Already have an account? Sign In"));
      expect(mockNavigate).toHaveBeenCalledWith("/sign-in");
    });
  });

  describe("Details State - Invitation Display", () => {
    it("should display cleaner business name", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByText("Sparkle Clean Co")).toBeTruthy();
      });
    });

    it("should display home address", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByText("123 Main St")).toBeTruthy();
        expect(getByText("San Francisco, CA 94102")).toBeTruthy();
      });
    });

    it("should display client information", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByText("Jane Doe")).toBeTruthy();
        expect(getByText("jane@example.com")).toBeTruthy();
      });
    });
  });

  describe("Form Validation", () => {
    it("should show error for weak password", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      const { getByTestId, getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByTestId("Password *")).toBeTruthy();
      });

      fireEvent.changeText(getByTestId("Password *"), "weak");
      fireEvent.changeText(getByTestId("Confirm Password *"), "weak");
      fireEvent.press(getByText("Accept Invitation"));

      await waitFor(() => {
        expect(
          getByText("Password must be at least 8 characters with 2 uppercase, 2 lowercase, and 2 special characters.")
        ).toBeTruthy();
      });
    });

    it("should show error for mismatched passwords", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      const { getByTestId, getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByTestId("Password *")).toBeTruthy();
      });

      fireEvent.changeText(getByTestId("Password *"), "StrongPass@@11");
      fireEvent.changeText(getByTestId("Confirm Password *"), "DifferentPass@@11");
      fireEvent.press(getByText("Accept Invitation"));

      await waitFor(() => {
        expect(getByText("Passwords do not match.")).toBeTruthy();
      });
    });

    it("should show error when terms not accepted", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      const { getByTestId, getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByTestId("Password *")).toBeTruthy();
      });

      fireEvent.changeText(getByTestId("Password *"), "StrongPass@@11");
      fireEvent.changeText(getByTestId("Confirm Password *"), "StrongPass@@11");
      fireEvent.press(getByText("Accept Invitation"));

      await waitFor(() => {
        expect(getByText("You must accept the Terms and Conditions.")).toBeTruthy();
      });
    });
  });

  describe("Accept Invitation Flow", () => {
    it("should call acceptInvitation with correct data", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);
      mockAcceptInvitation.mockResolvedValue({
        success: true,
        token: "new-auth-token",
        homeId: 123,
      });

      const { getByTestId, getByText, getAllByTestId } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByTestId("Password *")).toBeTruthy();
      });

      fireEvent.changeText(getByTestId("Password *"), "StrongPass@@11");
      fireEvent.changeText(getByTestId("Confirm Password *"), "StrongPass@@11");
      fireEvent.changeText(getByTestId("Phone Number"), "555-987-6543");

      const checkboxes = getAllByTestId("checkbox");
      fireEvent.press(checkboxes[0]);
      await waitFor(() => getByTestId("terms-modal"));
      fireEvent.press(getByTestId("accept-terms"));

      fireEvent.press(checkboxes[1]);
      await waitFor(() => getByTestId("terms-modal"));
      fireEvent.press(getByTestId("accept-terms"));

      fireEvent.press(getByText("Accept Invitation"));

      await waitFor(() => {
        expect(mockAcceptInvitation).toHaveBeenCalledWith("test-token", {
          password: "StrongPass@@11",
          phone: "5559876543",
          addressCorrections: null,
          termsId: "terms-id-123",
          privacyPolicyId: "terms-id-123",
        });
      });
    });

    it("should call login with returned token", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);
      mockAcceptInvitation.mockResolvedValue({
        success: true,
        token: "new-auth-token",
        homeId: 123,
      });

      const { getByTestId, getByText, getAllByTestId } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByTestId("Password *")).toBeTruthy();
      });

      fireEvent.changeText(getByTestId("Password *"), "StrongPass@@11");
      fireEvent.changeText(getByTestId("Confirm Password *"), "StrongPass@@11");

      const checkboxes = getAllByTestId("checkbox");
      fireEvent.press(checkboxes[0]);
      await waitFor(() => getByTestId("terms-modal"));
      fireEvent.press(getByTestId("accept-terms"));
      fireEvent.press(checkboxes[1]);
      await waitFor(() => getByTestId("terms-modal"));
      fireEvent.press(getByTestId("accept-terms"));

      fireEvent.press(getByText("Accept Invitation"));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith("new-auth-token");
      });
    });

    it("should show success state after accepting", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);
      mockAcceptInvitation.mockResolvedValue({
        success: true,
        token: "new-auth-token",
        homeId: 123,
      });

      const { getByTestId, getByText, getAllByTestId } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByTestId("Password *")).toBeTruthy();
      });

      fireEvent.changeText(getByTestId("Password *"), "StrongPass@@11");
      fireEvent.changeText(getByTestId("Confirm Password *"), "StrongPass@@11");

      const checkboxes = getAllByTestId("checkbox");
      fireEvent.press(checkboxes[0]);
      await waitFor(() => getByTestId("terms-modal"));
      fireEvent.press(getByTestId("accept-terms"));
      fireEvent.press(checkboxes[1]);
      await waitFor(() => getByTestId("terms-modal"));
      fireEvent.press(getByTestId("accept-terms"));

      fireEvent.press(getByText("Accept Invitation"));

      await waitFor(() => {
        expect(getByText("Welcome!")).toBeTruthy();
        expect(getByText("Your account has been created successfully.")).toBeTruthy();
      });
    });

    it("should show error when acceptance fails", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);
      mockAcceptInvitation.mockResolvedValue({
        success: false,
        error: "Email already in use",
      });

      const { getByTestId, getByText, getAllByTestId } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByTestId("Password *")).toBeTruthy();
      });

      fireEvent.changeText(getByTestId("Password *"), "StrongPass@@11");
      fireEvent.changeText(getByTestId("Confirm Password *"), "StrongPass@@11");

      const checkboxes = getAllByTestId("checkbox");
      fireEvent.press(checkboxes[0]);
      await waitFor(() => getByTestId("terms-modal"));
      fireEvent.press(getByTestId("accept-terms"));
      fireEvent.press(checkboxes[1]);
      await waitFor(() => getByTestId("terms-modal"));
      fireEvent.press(getByTestId("accept-terms"));

      fireEvent.press(getByText("Accept Invitation"));

      await waitFor(() => {
        expect(getByText("Email already in use")).toBeTruthy();
      });
    });
  });

  describe("Decline Invitation Flow", () => {
    it("should show decline link", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByText("Decline Invitation")).toBeTruthy();
      });
    });

    it("should show confirmation alert when decline is pressed", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByText("Decline Invitation")).toBeTruthy();
      });

      fireEvent.press(getByText("Decline Invitation"));

      expect(Alert.alert).toHaveBeenCalledWith(
        "Decline Invitation",
        "Are you sure you want to decline this invitation? You can always ask for a new one later.",
        expect.any(Array)
      );
    });
  });

  describe("Address Correction Toggle", () => {
    it("should show address correction toggle", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByText("Address Needs Correction?")).toBeTruthy();
      });
    });

    it("should show text input when toggle is enabled", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      const { getByText, getByTestId } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByText("Address Needs Correction?")).toBeTruthy();
      });

      fireEvent.press(getByText("Address Needs Correction?"));

      await waitFor(() => {
        expect(getByTestId("Address Corrections")).toBeTruthy();
      });
    });
  });

  describe("Navigation", () => {
    it("should navigate home when close button is pressed", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      const { getByText } = renderWithProviders(
        <AcceptInvitationScreen inviteToken="test-token" />
      );

      await waitFor(() => {
        expect(getByText("Accept Invitation")).toBeTruthy();
      });

      fireEvent.press(getByText("x"));
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  describe("Uses useParams fallback", () => {
    it("should use token from useParams when prop not provided", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      renderWithProviders(<AcceptInvitationScreen />);

      await waitFor(() => {
        expect(mockValidateInvitation).toHaveBeenCalledWith("test-token-123");
      });
    });

    it("should prefer prop over useParams when both are available", async () => {
      mockValidateInvitation.mockResolvedValue(validInvitation);

      renderWithProviders(<AcceptInvitationScreen inviteToken="prop-token" />);

      await waitFor(() => {
        expect(mockValidateInvitation).toHaveBeenCalledWith("prop-token");
      });
    });
  });
});
