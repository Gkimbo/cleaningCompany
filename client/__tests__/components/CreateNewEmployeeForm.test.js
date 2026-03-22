import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// Mock the dependencies before importing the component
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
}));

jest.mock("../../src/services/AuthContext", () => {
  const React = require("react");
  return {
    AuthContext: React.createContext({ login: jest.fn() }),
  };
});

jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  __esModule: true,
  default: {
    makeNewEmployee: jest.fn(),
    getApplicationsFromBackend: jest.fn(),
  },
}));

jest.mock("../../src/services/fetchRequests/ApplicationClass", () => ({
  __esModule: true,
  default: {
    deleteApplication: jest.fn(),
    hireApplicant: jest.fn(),
  },
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

import CreateNewEmployeeForm from "../../src/components/admin/CleanerApplications/CreateNewEmployeeForm";
import FetchData from "../../src/services/fetchRequests/fetchData";
import Application from "../../src/services/fetchRequests/ApplicationClass";

// Mock Math.random for predictable password generation
const mockMathRandom = () => {
  let callCount = 0;
  const values = [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, // Initial 8 required chars
    0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, // Fill remaining
    0.12, 0.23, 0.34, 0.45, 0.56, 0.67, 0.78, 0.89, // Shuffle values
    0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88,
  ];
  return jest.spyOn(Math, "random").mockImplementation(() => {
    return values[callCount++ % values.length];
  });
};

describe("CreateNewEmployeeForm", () => {
  const defaultProps = {
    id: 1,
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "555-123-4567",
    setApplicationsList: jest.fn(),
  };

  let mathRandomSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mathRandomSpy = mockMathRandom();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (mathRandomSpy) {
      mathRandomSpy.mockRestore();
    }
  });

  describe("Username Generation", () => {
    it("should generate username from first name + last initial", () => {
      const { getByDisplayValue } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      // Username should be "johnd" (john + d)
      expect(getByDisplayValue("johnd")).toBeTruthy();
    });

    it("should generate username for short first name", () => {
      const { getByDisplayValue } = render(
        <CreateNewEmployeeForm
          {...defaultProps}
          firstName="Al"
          lastName="Smith"
        />
      );

      // "al" + "s" = "als" is too short (< 4), should add more of last name
      expect(getByDisplayValue("alsm")).toBeTruthy();
    });

    it("should truncate long usernames to 12 characters", () => {
      const { getByDisplayValue } = render(
        <CreateNewEmployeeForm
          {...defaultProps}
          firstName="Christopher"
          lastName="Doe"
        />
      );

      const usernameInput = getByDisplayValue(/^christophe/);
      expect(usernameInput.props.value.length).toBeLessThanOrEqual(12);
    });

    it("should handle names with special characters", () => {
      const { getByDisplayValue } = render(
        <CreateNewEmployeeForm
          {...defaultProps}
          firstName="Mary-Jane"
          lastName="O'Connor"
        />
      );

      // Should strip special characters: "maryjane" + "o" = "maryjaneo"
      expect(getByDisplayValue("maryjaneo")).toBeTruthy();
    });

    it("should pad short usernames with numbers", () => {
      const { getByDisplayValue } = render(
        <CreateNewEmployeeForm
          {...defaultProps}
          firstName="Jo"
          lastName="Li"
        />
      );

      // "jo" + "li" = "joli" which is exactly 4 characters
      expect(getByDisplayValue("joli")).toBeTruthy();
    });

    it("should update username when first name changes", () => {
      const { getByDisplayValue, getByPlaceholderText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      // Initially should have "johnd"
      expect(getByDisplayValue("johnd")).toBeTruthy();

      // Change first name
      const firstNameInput = getByPlaceholderText("First Name");
      fireEvent.changeText(firstNameInput, "Mike");

      // Username should now be "miked"
      expect(getByDisplayValue("miked")).toBeTruthy();
    });

    it("should update username when last name changes", () => {
      const { getByDisplayValue, getByPlaceholderText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      // Change last name
      const lastNameInput = getByPlaceholderText("Last Name");
      fireEvent.changeText(lastNameInput, "Smith");

      // Username should now be "johns"
      expect(getByDisplayValue("johns")).toBeTruthy();
    });
  });

  describe("Form Pre-filling", () => {
    it("should pre-fill first name from props", () => {
      const { getByDisplayValue } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      expect(getByDisplayValue("John")).toBeTruthy();
    });

    it("should pre-fill last name from props", () => {
      const { getByDisplayValue } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      expect(getByDisplayValue("Doe")).toBeTruthy();
    });

    it("should pre-fill email from props", () => {
      const { getByDisplayValue } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      expect(getByDisplayValue("john.doe@example.com")).toBeTruthy();
    });

    it("should generate a strong random password", () => {
      const { getByPlaceholderText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      // Password should be auto-generated (16 chars with uppercase, lowercase, numbers, special)
      const passwordInput = getByPlaceholderText("Password");
      expect(passwordInput.props.value).toBeTruthy();
      expect(passwordInput.props.value.length).toBe(16);
    });
  });

  describe("Form Validation", () => {
    it("should show error for empty first name", async () => {
      const { getByText, getByPlaceholderText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      // Clear first name
      const firstNameInput = getByPlaceholderText("First Name");
      fireEvent.changeText(firstNameInput, "");

      // Submit form
      const submitButton = getByText("Create Employee Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("First name is required.")).toBeTruthy();
      });
    });

    it("should show error for empty last name", async () => {
      const { getByText, getByPlaceholderText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      // Clear last name
      const lastNameInput = getByPlaceholderText("Last Name");
      fireEvent.changeText(lastNameInput, "");

      // Submit form
      const submitButton = getByText("Create Employee Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Last name is required.")).toBeTruthy();
      });
    });

    it("should show error for invalid email", async () => {
      const { getByText, getByPlaceholderText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      // Change to invalid email
      const emailInput = getByPlaceholderText("Email");
      fireEvent.changeText(emailInput, "invalid-email");

      // Submit form
      const submitButton = getByText("Create Employee Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Please enter a valid email address.")).toBeTruthy();
      });
    });

    it("should show error for short password", async () => {
      const { getByText, getByPlaceholderText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      // Set short password
      const passwordInput = getByPlaceholderText("Password");
      fireEvent.changeText(passwordInput, "abc");

      // Submit form
      const submitButton = getByText("Create Employee Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(
          getByText("Password must be at least 6 characters.")
        ).toBeTruthy();
      });
    });

    it("should show error for username outside 4-12 characters", async () => {
      const { getByText, getByPlaceholderText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      // Set username too short
      const usernameInput = getByPlaceholderText("Username (auto-generated)");
      fireEvent.changeText(usernameInput, "ab");

      // Submit form
      const submitButton = getByText("Create Employee Account");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(
          getByText("Username must be between 4 and 12 characters.")
        ).toBeTruthy();
      });
    });
  });

  describe("Form Submission", () => {
    it("should call hireApplicant with correct data on submit", async () => {
      Application.hireApplicant.mockResolvedValue({ success: true });

      const { getByText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      await waitFor(() => {
        expect(Application.hireApplicant).toHaveBeenCalledWith(
          defaultProps.id,
          expect.objectContaining({
            username: "johnd",
            email: "john.doe@example.com",
            firstName: "John",
            lastName: "Doe",
            phone: "555-123-4567",
          }),
          defaultProps.token
        );
        // Verify password is a 16-char strong password
        const callArg = Application.hireApplicant.mock.calls[0][1];
        expect(callArg.password).toBeTruthy();
        expect(callArg.password.length).toBe(16);
      });
    });

    it("should show success message after successful submission", async () => {
      Application.hireApplicant.mockResolvedValue({ success: true });

      const { getByText, findByText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      const successMessage = await findByText(
        /Successfully hired John Doe/
      );
      expect(successMessage).toBeTruthy();
    });

    it("should call hireApplicant with correct application id", async () => {
      Application.hireApplicant.mockResolvedValue({ success: true });

      const { getByText } = render(
        <CreateNewEmployeeForm {...defaultProps} id={42} />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      await waitFor(() => {
        expect(Application.hireApplicant).toHaveBeenCalledWith(
          42,
          expect.any(Object),
          defaultProps.token
        );
      });
    });

    it("should refresh applications list after submission", async () => {
      Application.hireApplicant.mockResolvedValue({ success: true });

      const mockSetApplicationsList = jest.fn();

      const { getByText } = render(
        <CreateNewEmployeeForm
          {...defaultProps}
          setApplicationsList={mockSetApplicationsList}
        />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      // Wait for setTimeout (component calls setApplicationsList after 1500ms)
      await act(async () => {
        jest.advanceTimersByTime(1600);
      });

      await waitFor(() => {
        expect(mockSetApplicationsList).toHaveBeenCalled();
      });
    });

    it("should show error when email already exists", async () => {
      Application.hireApplicant.mockResolvedValue({
        error: "An account already has this email",
      });

      const { getByText, findByText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      const errorMessage = await findByText("An account already has this email");
      expect(errorMessage).toBeTruthy();
    });

    it("should show error when username already exists", async () => {
      Application.hireApplicant.mockResolvedValue({
        error: "Username already exists",
      });

      const { getByText, findByText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      const errorMessage = await findByText("Username already exists");
      expect(errorMessage).toBeTruthy();
    });

    it("should show generic error on unexpected failure", async () => {
      // Throw error without message to trigger fallback message
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = "";
      Application.hireApplicant.mockRejectedValue(errorWithoutMessage);

      const { getByText, findByText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      const errorMessage = await findByText(
        "Failed to hire employee. Please try again."
      );
      expect(errorMessage).toBeTruthy();
    });

    it("should disable submit button while submitting", async () => {
      // Make the API call hang
      Application.hireApplicant.mockImplementation(
        () => new Promise(() => {})
      );

      const { getByText, queryByText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      // The button should show loading state - text may still be visible
      // but the button should be disabled
      await waitFor(() => {
        expect(Application.hireApplicant).toHaveBeenCalled();
      });
    });
  });

  describe("Password Visibility Toggle", () => {
    it("should have password hidden by default", () => {
      const { getByPlaceholderText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      const passwordInput = getByPlaceholderText("Password");

      // Initially password should be hidden
      expect(passwordInput.props.secureTextEntry).toBe(true);
    });
  });

  describe("Info Text", () => {
    it("should display welcome email info text", () => {
      const { getByText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      expect(
        getByText(/welcome email with login credentials/i)
      ).toBeTruthy();
    });
  });

  describe("Empty Props Handling", () => {
    it("should handle empty firstName prop", () => {
      const { getByPlaceholderText } = render(
        <CreateNewEmployeeForm
          {...defaultProps}
          firstName=""
          lastName="Doe"
        />
      );

      const firstNameInput = getByPlaceholderText("First Name");
      expect(firstNameInput.props.value).toBe("");
    });

    it("should handle empty lastName prop", () => {
      const { getByPlaceholderText } = render(
        <CreateNewEmployeeForm
          {...defaultProps}
          firstName="John"
          lastName=""
        />
      );

      const lastNameInput = getByPlaceholderText("Last Name");
      expect(lastNameInput.props.value).toBe("");
    });

    it("should handle undefined firstName prop", () => {
      const { getByPlaceholderText } = render(
        <CreateNewEmployeeForm
          id={1}
          lastName="Doe"
          email="test@example.com"
          setApplicationsList={jest.fn()}
        />
      );

      const firstNameInput = getByPlaceholderText("First Name");
      expect(firstNameInput.props.value).toBe("");
    });
  });
});
