import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock react-native-paper
jest.mock("react-native-paper", () => {
  const { TextInput: RNTextInput, View, Text } = require("react-native");
  return {
    TextInput: ({ label, value, onChangeText, style, ...props }) => (
      <View>
        <Text>{label}</Text>
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          testID={label}
          {...props}
        />
      </View>
    ),
  };
});

// Mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name, ...props }) => {
    const { Text } = require("react-native");
    return <Text {...props}>{name}</Text>;
  },
}));

// Mock theme
jest.mock("../../../services/styles/theme", () => ({
  colors: {
    primary: { 600: "#0d9488" },
    neutral: { 0: "#ffffff", 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0" },
    text: { primary: "#0f172a", secondary: "#475569", tertiary: "#94a3b8" },
    error: { 50: "#fff1f2", 600: "#e11d48" },
    success: { 50: "#ecfdf5", 600: "#059669" },
    border: { default: "#cbd5e1" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { lg: 12, xl: 16 },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16, "2xl": 24 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
}));

// Mock FetchData service
const mockForgotUsername = jest.fn();
const mockForgotPassword = jest.fn();

jest.mock("../../../services/fetchRequests/fetchData", () => ({
  forgotUsername: (...args) => mockForgotUsername(...args),
  forgotPassword: (...args) => mockForgotPassword(...args),
}));

// Import after mocks
import AlreadyAcceptedCard from "../AlreadyAcceptedCard";

describe("AlreadyAcceptedCard", () => {
  const mockOnSignIn = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Options State", () => {
    it("should render the main options view by default", () => {
      const { getByText } = render(
        <AlreadyAcceptedCard
          email="test@example.com"
          onSignIn={mockOnSignIn}
          onClose={mockOnClose}
        />
      );

      expect(getByText("Already Registered")).toBeTruthy();
      expect(getByText("Sign In")).toBeTruthy();
      expect(getByText("Forgot Username?")).toBeTruthy();
      expect(getByText("Forgot Password?")).toBeTruthy();
    });

    it("should display the email from invitation", () => {
      const { getByText } = render(
        <AlreadyAcceptedCard
          email="john@example.com"
          onSignIn={mockOnSignIn}
        />
      );

      expect(getByText("john@example.com")).toBeTruthy();
    });

    it("should call onSignIn when Sign In button is pressed", () => {
      const { getByText } = render(
        <AlreadyAcceptedCard
          email="test@example.com"
          onSignIn={mockOnSignIn}
        />
      );

      fireEvent.press(getByText("Sign In"));
      expect(mockOnSignIn).toHaveBeenCalled();
    });

    it("should call onClose when close button is pressed", () => {
      const { getByText } = render(
        <AlreadyAcceptedCard
          email="test@example.com"
          onSignIn={mockOnSignIn}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByText("x"));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should show employee message for employee type", () => {
      const { getByText } = render(
        <AlreadyAcceptedCard
          email="test@example.com"
          onSignIn={mockOnSignIn}
          invitationType="employee"
        />
      );

      expect(
        getByText("This invitation has already been accepted. Your employee account is ready!")
      ).toBeTruthy();
    });

    it("should show client message for client type", () => {
      const { getByText } = render(
        <AlreadyAcceptedCard
          email="test@example.com"
          onSignIn={mockOnSignIn}
          invitationType="client"
        />
      );

      expect(
        getByText("This invitation has already been accepted. Your account is ready!")
      ).toBeTruthy();
    });
  });

  describe("Forgot Username Flow", () => {
    it("should switch to username recovery when Forgot Username is pressed", async () => {
      const { getByText, queryByText } = render(
        <AlreadyAcceptedCard
          email="test@example.com"
          onSignIn={mockOnSignIn}
        />
      );

      fireEvent.press(getByText("Forgot Username?"));

      await waitFor(() => {
        expect(getByText("Recover Username")).toBeTruthy();
        expect(queryByText("Already Registered")).toBeNull();
      });
    });

    it("should pre-fill email in username recovery", async () => {
      const { getByText, getByTestId } = render(
        <AlreadyAcceptedCard
          email="test@example.com"
          onSignIn={mockOnSignIn}
        />
      );

      fireEvent.press(getByText("Forgot Username?"));

      await waitFor(() => {
        const emailInput = getByTestId("Email Address");
        expect(emailInput.props.value).toBe("test@example.com");
      });
    });

    it("should call forgotUsername service when Send Username is pressed", async () => {
      mockForgotUsername.mockResolvedValue({ message: "Username sent!" });

      const { getByText } = render(
        <AlreadyAcceptedCard
          email="test@example.com"
          onSignIn={mockOnSignIn}
        />
      );

      fireEvent.press(getByText("Forgot Username?"));

      await waitFor(() => {
        expect(getByText("Send Username")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Send Username"));
      });

      await waitFor(() => {
        expect(mockForgotUsername).toHaveBeenCalledWith("test@example.com");
      });
    });

    it("should show success state after username recovery", async () => {
      mockForgotUsername.mockResolvedValue({ message: "Check your email!" });

      const { getByText } = render(
        <AlreadyAcceptedCard
          email="test@example.com"
          onSignIn={mockOnSignIn}
        />
      );

      fireEvent.press(getByText("Forgot Username?"));

      await waitFor(() => {
        expect(getByText("Send Username")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Send Username"));
      });

      await waitFor(() => {
        expect(getByText("Check Your Email")).toBeTruthy();
      });
    });

    it("should show error if email is empty", async () => {
      const { getByText, getByTestId } = render(
        <AlreadyAcceptedCard
          email=""
          onSignIn={mockOnSignIn}
        />
      );

      fireEvent.press(getByText("Forgot Username?"));

      await waitFor(() => {
        expect(getByText("Send Username")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Send Username"));
      });

      await waitFor(() => {
        expect(getByText("Please enter your email address")).toBeTruthy();
      });
    });
  });

  describe("Forgot Password Flow", () => {
    it("should switch to password recovery when Forgot Password is pressed", async () => {
      const { getByText, queryByText, getAllByText } = render(
        <AlreadyAcceptedCard
          email="test@example.com"
          onSignIn={mockOnSignIn}
        />
      );

      fireEvent.press(getByText("Forgot Password?"));

      await waitFor(() => {
        // There are multiple "Reset Password" elements (title and button)
        const resetPasswordElements = getAllByText("Reset Password");
        expect(resetPasswordElements.length).toBeGreaterThanOrEqual(1);
        expect(queryByText("Already Registered")).toBeNull();
      });
    });

    it("should call forgotPassword service when button is pressed", async () => {
      mockForgotPassword.mockResolvedValue({ message: "Temporary password sent!" });

      const { getByText, getAllByText } = render(
        <AlreadyAcceptedCard
          email="test@example.com"
          onSignIn={mockOnSignIn}
        />
      );

      fireEvent.press(getByText("Forgot Password?"));

      await waitFor(() => {
        const elements = getAllByText("Reset Password");
        expect(elements.length).toBeGreaterThanOrEqual(1);
      });

      // The button is the second "Reset Password" element (first is title)
      await act(async () => {
        const buttons = getAllByText("Reset Password");
        // Press the button (last one)
        fireEvent.press(buttons[buttons.length - 1]);
      });

      await waitFor(() => {
        expect(mockForgotPassword).toHaveBeenCalledWith("test@example.com");
      });
    });
  });

  describe("Navigation", () => {
    it("should return to options when back button is pressed from recovery", async () => {
      const { getByText } = render(
        <AlreadyAcceptedCard
          email="test@example.com"
          onSignIn={mockOnSignIn}
        />
      );

      fireEvent.press(getByText("Forgot Username?"));

      await waitFor(() => {
        expect(getByText("Recover Username")).toBeTruthy();
      });

      // Press back button (arrow-left icon)
      fireEvent.press(getByText("arrow-left"));

      await waitFor(() => {
        expect(getByText("Already Registered")).toBeTruthy();
      });
    });
  });
});
