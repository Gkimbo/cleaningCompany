import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock AuthContext with a real React context
const mockLogin = jest.fn();
jest.mock("../../src/services/AuthContext", () => {
  const React = require("react");
  return {
    AuthContext: React.createContext({ login: null }),
  };
});

// Mock FetchData
jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  makeNewUser: jest.fn(),
}));

// Mock the API_BASE
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:5000/api/v1",
}));

// Mock fetch for TermsModal
global.fetch = jest.fn();

// Import after mocks
import SignUpForm from "../../src/components/userAuthentication/forms/SignUpForm";
import { AuthContext } from "../../src/services/AuthContext";
import FetchData from "../../src/services/fetchRequests/fetchData";

// Create mock AuthContext provider
const MockAuthProvider = ({ children }) => {
  return (
    <AuthContext.Provider value={{ login: mockLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

describe("SignUpForm", () => {
  const mockDispatch = jest.fn();

  const defaultState = {};

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();

    // Default mock for fetching terms
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        terms: {
          id: 1,
          title: "Terms of Service",
          version: 1,
          contentType: "text",
          content: "These are the terms and conditions...",
        },
      }),
    });
  });

  const renderWithProviders = (component) => {
    return render(<MockAuthProvider>{component}</MockAuthProvider>);
  };

  describe("Rendering", () => {
    it("should render all form fields", () => {
      const { getByPlaceholderText, getByText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      expect(getByPlaceholderText("First name")).toBeTruthy();
      expect(getByPlaceholderText("Last name")).toBeTruthy();
      expect(getByPlaceholderText(/Choose a username/)).toBeTruthy();
      expect(getByPlaceholderText("Enter your email")).toBeTruthy();
      expect(getByPlaceholderText("Create a password")).toBeTruthy();
      expect(getByPlaceholderText("Confirm your password")).toBeTruthy();
    });

    it("should render Terms and Conditions section", () => {
      const { getAllByText, getByText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      expect(getAllByText(/I agree to the/).length).toBeGreaterThan(0);
      expect(getByText("Terms and Conditions")).toBeTruthy();
    });

    it("should render Create Account button", () => {
      const { getByText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      expect(getByText("Create Account")).toBeTruthy();
    });

    it("should render password requirements hint", () => {
      const { getByText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      expect(
        getByText(/Password must be at least 8 characters/)
      ).toBeTruthy();
    });
  });

  describe("Terms and Conditions Integration", () => {
    it("should open TermsModal when Terms and Conditions link is pressed", async () => {
      const { getByText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      const termsLink = getByText("Terms and Conditions");
      fireEvent.press(termsLink);

      // Modal should be visible - it will show loading first
      await waitFor(() => {
        expect(getByText("Loading terms...")).toBeTruthy();
      });
    });

    it("should show validation error when terms not accepted", async () => {
      const { getByText, getByPlaceholderText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      // Fill in valid form data
      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(
        getByPlaceholderText(/Choose a username/),
        "johndoe"
      );
      fireEvent.changeText(
        getByPlaceholderText("Enter your email"),
        "john@example.com"
      );
      fireEvent.changeText(
        getByPlaceholderText("Create a password"),
        "PAssword!!11"
      );
      fireEvent.changeText(
        getByPlaceholderText("Confirm your password"),
        "PAssword!!11"
      );

      // Submit without accepting terms
      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(
          getByText("You must accept the Terms and Conditions to create an account.")
        ).toBeTruthy();
      });
    });
  });

  describe("Form Validation", () => {
    it("should show error for empty first name", async () => {
      const { getByText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("First name is required.")).toBeTruthy();
      });
    });

    it("should show error for empty last name", async () => {
      const { getByText, getByPlaceholderText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      fireEvent.changeText(getByPlaceholderText("First name"), "John");

      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Last name is required.")).toBeTruthy();
      });
    });

    it("should show error for short username", async () => {
      const { getByText, getByPlaceholderText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText(/Choose a username/), "abc");

      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(
          getByText("Username must be between 4 and 12 characters.")
        ).toBeTruthy();
      });
    });

    it("should show error for username containing owner", async () => {
      const { getByText, getByPlaceholderText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(
        getByPlaceholderText(/Choose a username/),
        "myowner"
      );

      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(
          getByText("Username cannot contain the word 'owner'.")
        ).toBeTruthy();
      });
    });

    it("should show error for weak password", async () => {
      const { getByText, getByPlaceholderText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText(/Choose a username/), "johndoe");
      fireEvent.changeText(getByPlaceholderText("Enter your email"), "john@example.com");
      fireEvent.changeText(getByPlaceholderText("Create a password"), "weak");

      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(
          getByText(
            /Password must be at least 8 characters long with 2 uppercase letters/
          )
        ).toBeTruthy();
      });
    });

    it("should show error for password mismatch", async () => {
      const { getByText, getByPlaceholderText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText(/Choose a username/), "johndoe");
      fireEvent.changeText(getByPlaceholderText("Enter your email"), "john@example.com");
      fireEvent.changeText(
        getByPlaceholderText("Create a password"),
        "PAssword!!11"
      );
      fireEvent.changeText(
        getByPlaceholderText("Confirm your password"),
        "Different!!11"
      );

      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Passwords do not match.")).toBeTruthy();
      });
    });

    it("should show error for invalid email", async () => {
      const { getByText, getByPlaceholderText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText(/Choose a username/), "johndoe");
      fireEvent.changeText(
        getByPlaceholderText("Enter your email"),
        "invalid-email"
      );

      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Please enter a valid email address.")).toBeTruthy();
      });
    });
  });

  describe("Form Submission", () => {
    // Helper function to accept terms and privacy policy in modals
    const acceptTermsAndPrivacy = async (getByText, UNSAFE_getByType, getAllByText) => {
      // Accept Terms and Conditions
      const termsLink = getByText("Terms and Conditions");
      fireEvent.press(termsLink);

      await waitFor(() => {
        expect(getByText("Terms of Service")).toBeTruthy();
      });

      // Find ScrollView and simulate scroll to bottom
      let scrollView = UNSAFE_getByType("RCTScrollView");
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          contentOffset: { y: 100 },
          contentSize: { height: 100 },
          layoutMeasurement: { height: 50 },
        },
      });

      let acceptButton = getByText("I Accept");
      fireEvent.press(acceptButton);

      await waitFor(() => {
        expect(getByText(/Terms accepted/)).toBeTruthy();
      });

      // Accept Privacy Policy
      const privacyLink = getByText("Privacy Policy");
      fireEvent.press(privacyLink);

      await waitFor(() => {
        expect(getAllByText("Privacy Policy").length).toBeGreaterThan(1); // Modal title + link
      });

      scrollView = UNSAFE_getByType("RCTScrollView");
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          contentOffset: { y: 100 },
          contentSize: { height: 100 },
          layoutMeasurement: { height: 50 },
        },
      });

      acceptButton = getByText("I Accept");
      fireEvent.press(acceptButton);

      await waitFor(() => {
        expect(getByText(/Privacy Policy accepted/)).toBeTruthy();
      });
    };

    it("should show error when email already exists", async () => {
      FetchData.makeNewUser.mockResolvedValueOnce(
        "An account already has this email"
      );

      const { getByText, getByPlaceholderText, UNSAFE_getByType, getAllByText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      // Fill valid form data
      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText(/Choose a username/), "johndoe");
      fireEvent.changeText(
        getByPlaceholderText("Enter your email"),
        "john@example.com"
      );
      fireEvent.changeText(
        getByPlaceholderText("Create a password"),
        "PAssword!!11"
      );
      fireEvent.changeText(
        getByPlaceholderText("Confirm your password"),
        "PAssword!!11"
      );

      // Open and accept terms
      await acceptTermsAndPrivacy(getByText, UNSAFE_getByType, getAllByText);

      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("An account already has this email")).toBeTruthy();
      });
    });

    it("should show error when username already exists", async () => {
      FetchData.makeNewUser.mockResolvedValueOnce("Username already exists");

      const { getByText, getByPlaceholderText, UNSAFE_getByType, getAllByText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      // Fill valid form data
      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText(/Choose a username/), "johndoe");
      fireEvent.changeText(
        getByPlaceholderText("Enter your email"),
        "john@example.com"
      );
      fireEvent.changeText(
        getByPlaceholderText("Create a password"),
        "PAssword!!11"
      );
      fireEvent.changeText(
        getByPlaceholderText("Confirm your password"),
        "PAssword!!11"
      );

      // Open and accept terms
      await acceptTermsAndPrivacy(getByText, UNSAFE_getByType, getAllByText);

      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Username already exists")).toBeTruthy();
      });
    });

    it("should call FetchData.makeNewUser with termsId on valid submission", async () => {
      FetchData.makeNewUser.mockResolvedValueOnce({
        token: "test-token-123",
      });

      const { getByText, getByPlaceholderText, UNSAFE_getByType, getAllByText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      // Fill valid form data
      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText(/Choose a username/), "johndoe");
      fireEvent.changeText(
        getByPlaceholderText("Enter your email"),
        "john@example.com"
      );
      fireEvent.changeText(
        getByPlaceholderText("Create a password"),
        "PAssword!!11"
      );
      fireEvent.changeText(
        getByPlaceholderText("Confirm your password"),
        "PAssword!!11"
      );

      // Open and accept terms
      await acceptTermsAndPrivacy(getByText, UNSAFE_getByType, getAllByText);

      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(FetchData.makeNewUser).toHaveBeenCalledWith({
          firstName: "John",
          lastName: "Doe",
          userName: "johndoe",
          password: "PAssword!!11",
          email: "john@example.com",
          termsId: 1,
          privacyPolicyId: 1,
          referralCode: null,
        });
      });
    });

    it("should dispatch CURRENT_USER and call login on successful signup", async () => {
      FetchData.makeNewUser.mockResolvedValueOnce({
        token: "new-user-token",
      });

      const { getByText, getByPlaceholderText, UNSAFE_getByType, getAllByText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      // Fill valid form data
      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText(/Choose a username/), "johndoe");
      fireEvent.changeText(
        getByPlaceholderText("Enter your email"),
        "john@example.com"
      );
      fireEvent.changeText(
        getByPlaceholderText("Create a password"),
        "PAssword!!11"
      );
      fireEvent.changeText(
        getByPlaceholderText("Confirm your password"),
        "PAssword!!11"
      );

      // Open and accept terms
      await acceptTermsAndPrivacy(getByText, UNSAFE_getByType, getAllByText);

      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "CURRENT_USER",
          payload: "new-user-token",
        });
        expect(mockLogin).toHaveBeenCalledWith("new-user-token");
      });
    });

    it("should navigate to home on successful signup", async () => {
      FetchData.makeNewUser.mockResolvedValueOnce({
        token: "new-user-token",
      });

      const { getByText, getByPlaceholderText, UNSAFE_getByType, getAllByText } = renderWithProviders(
        <SignUpForm state={defaultState} dispatch={mockDispatch} />
      );

      // Fill valid form data
      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText(/Choose a username/), "johndoe");
      fireEvent.changeText(
        getByPlaceholderText("Enter your email"),
        "john@example.com"
      );
      fireEvent.changeText(
        getByPlaceholderText("Create a password"),
        "PAssword!!11"
      );
      fireEvent.changeText(
        getByPlaceholderText("Confirm your password"),
        "PAssword!!11"
      );

      // Open and accept terms
      await acceptTermsAndPrivacy(getByText, UNSAFE_getByType, getAllByText);

      const submitButton = getByText("Create Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/");
      });
    });
  });
});
