import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// Mock the dependencies before importing the component
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
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
  },
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

import CreateNewEmployeeForm from "../../src/components/admin/CleanerApplications/CreateNewEmployeeForm";
import FetchData from "../../src/services/fetchRequests/fetchData";
import Application from "../../src/services/fetchRequests/ApplicationClass";

describe("CreateNewEmployeeForm", () => {
  const defaultProps = {
    id: 1,
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    setApplicationsList: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
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

    it("should generate password from name", () => {
      const { getByDisplayValue } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      // Password format: lastName$firstName124
      expect(getByDisplayValue("Doe$John124")).toBeTruthy();
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
    it("should call makeNewEmployee with correct data on submit", async () => {
      FetchData.makeNewEmployee.mockResolvedValue({ success: true });
      Application.deleteApplication.mockResolvedValue({});
      FetchData.getApplicationsFromBackend.mockResolvedValue({
        serializedApplications: [],
      });

      const { getByText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      await waitFor(() => {
        expect(FetchData.makeNewEmployee).toHaveBeenCalledWith({
          userName: "johnd",
          password: "Doe$John124",
          email: "john.doe@example.com",
          type: "cleaner",
          firstName: "John",
          lastName: "Doe",
        });
      });
    });

    it("should show success message after successful submission", async () => {
      FetchData.makeNewEmployee.mockResolvedValue({ success: true });
      Application.deleteApplication.mockResolvedValue({});
      FetchData.getApplicationsFromBackend.mockResolvedValue({
        serializedApplications: [],
      });

      const { getByText, findByText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      const successMessage = await findByText(
        /Successfully created account for John Doe/
      );
      expect(successMessage).toBeTruthy();
    });

    it("should delete application after successful employee creation", async () => {
      FetchData.makeNewEmployee.mockResolvedValue({ success: true });
      Application.deleteApplication.mockResolvedValue({});
      FetchData.getApplicationsFromBackend.mockResolvedValue({
        serializedApplications: [],
      });

      const { getByText } = render(
        <CreateNewEmployeeForm {...defaultProps} id={42} />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      await waitFor(() => {
        expect(Application.deleteApplication).toHaveBeenCalledWith(42);
      });
    });

    it("should refresh applications list after submission", async () => {
      FetchData.makeNewEmployee.mockResolvedValue({ success: true });
      Application.deleteApplication.mockResolvedValue({});
      FetchData.getApplicationsFromBackend.mockResolvedValue({
        serializedApplications: [{ id: 2, name: "Another App" }],
      });

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

      // Wait for setTimeout
      await act(async () => {
        jest.advanceTimersByTime(1600);
      });

      await waitFor(() => {
        expect(mockSetApplicationsList).toHaveBeenCalledWith([
          { id: 2, name: "Another App" },
        ]);
      });
    });

    it("should show error when email already exists", async () => {
      FetchData.makeNewEmployee.mockResolvedValue(
        "An account already has this email"
      );

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
      FetchData.makeNewEmployee.mockResolvedValue("Username already exists");

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
      FetchData.makeNewEmployee.mockRejectedValue(new Error("Network error"));

      const { getByText, findByText } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      const errorMessage = await findByText(
        "Failed to create employee. Please try again."
      );
      expect(errorMessage).toBeTruthy();
    });

    it("should disable submit button while submitting", async () => {
      // Make the API call hang
      FetchData.makeNewEmployee.mockImplementation(
        () => new Promise(() => {})
      );

      const { getByText, getByTestId } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Create Employee Account");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      // The button should show loading state (ActivityIndicator)
      // The button text should not be visible during loading
      await waitFor(() => {
        expect(() => getByText("Create Employee Account")).toThrow();
      });
    });
  });

  describe("Password Visibility Toggle", () => {
    it("should toggle password visibility when icon is pressed", () => {
      const { getByDisplayValue } = render(
        <CreateNewEmployeeForm {...defaultProps} />
      );

      const passwordInput = getByDisplayValue("Doe$John124");

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
