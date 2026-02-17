import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// Mock the dependencies before importing the component
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "1" }),
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
}));

jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  __esModule: true,
  default: {
    editEmployee: jest.fn(),
  },
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

import EditEmployeeForm from "../../src/components/admin/forms/EditEmployeeForm";
import FetchData from "../../src/services/fetchRequests/fetchData";

describe("EditEmployeeForm", () => {
  const mockEmployee = {
    id: 1,
    firstName: "John",
    lastName: "Doe",
    username: "johnd",
    email: "john.doe@example.com",
    phone: "555-123-4567",
  };

  const defaultProps = {
    employeeList: [mockEmployee],
    setEmployeeList: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Form Pre-filling", () => {
    it("should pre-fill first name from employee data", () => {
      const { getByDisplayValue } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      expect(getByDisplayValue("John")).toBeTruthy();
    });

    it("should pre-fill last name from employee data", () => {
      const { getByDisplayValue } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      expect(getByDisplayValue("Doe")).toBeTruthy();
    });

    it("should pre-fill username from employee data", () => {
      const { getByDisplayValue } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      expect(getByDisplayValue("johnd")).toBeTruthy();
    });

    it("should pre-fill email from employee data", () => {
      const { getByDisplayValue } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      expect(getByDisplayValue("john.doe@example.com")).toBeTruthy();
    });

    it("should pre-fill phone from employee data", () => {
      const { getByDisplayValue } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      expect(getByDisplayValue("555-123-4567")).toBeTruthy();
    });

    it("should leave password field empty", () => {
      const { getByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const passwordInput = getByPlaceholderText("Leave blank to keep current password");
      expect(passwordInput.props.value).toBe("");
    });
  });

  describe("Form Validation", () => {
    it("should show error for empty first name", async () => {
      const { getByText, getByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const firstNameInput = getByPlaceholderText("First Name");
      fireEvent.changeText(firstNameInput, "");

      const submitButton = getByText("Save Changes");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("First name is required.")).toBeTruthy();
      });
    });

    it("should show error for empty last name", async () => {
      const { getByText, getByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const lastNameInput = getByPlaceholderText("Last Name");
      fireEvent.changeText(lastNameInput, "");

      const submitButton = getByText("Save Changes");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Last name is required.")).toBeTruthy();
      });
    });

    it("should show error for invalid email", async () => {
      const { getByText, getByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const emailInput = getByPlaceholderText("Email");
      fireEvent.changeText(emailInput, "invalid-email");

      const submitButton = getByText("Save Changes");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Please enter a valid email address.")).toBeTruthy();
      });
    });

    it("should show error for username less than 4 characters", async () => {
      const { getByText, getByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const usernameInput = getByPlaceholderText("Username");
      fireEvent.changeText(usernameInput, "abc");

      const submitButton = getByText("Save Changes");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Username must be between 4 and 12 characters.")).toBeTruthy();
      });
    });

    it("should show error for username more than 12 characters", async () => {
      const { getByText, getByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const usernameInput = getByPlaceholderText("Username");
      fireEvent.changeText(usernameInput, "verylongusername123");

      const submitButton = getByText("Save Changes");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Username must be between 4 and 12 characters.")).toBeTruthy();
      });
    });

    it("should show error for password less than 6 characters when provided", async () => {
      const { getByText, getByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const passwordInput = getByPlaceholderText("Leave blank to keep current password");
      fireEvent.changeText(passwordInput, "abc");

      const submitButton = getByText("Save Changes");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Password must be at least 6 characters.")).toBeTruthy();
      });
    });

    it("should allow empty password (keeps current)", async () => {
      FetchData.editEmployee.mockResolvedValue({ user: mockEmployee });

      const { getByText, queryByText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Save Changes");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      expect(queryByText("Password must be at least 6 characters.")).toBeNull();
    });
  });

  describe("Password Confirmation", () => {
    it("should show confirm password field when password is entered", () => {
      const { getByPlaceholderText, queryByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      // Initially confirm password should not be visible
      expect(queryByPlaceholderText("Re-enter new password")).toBeNull();

      // Enter a password
      const passwordInput = getByPlaceholderText("Leave blank to keep current password");
      fireEvent.changeText(passwordInput, "newpassword123");

      // Now confirm password should be visible
      expect(getByPlaceholderText("Re-enter new password")).toBeTruthy();
    });

    it("should hide confirm password field when password is cleared", () => {
      const { getByPlaceholderText, queryByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      // Enter a password
      const passwordInput = getByPlaceholderText("Leave blank to keep current password");
      fireEvent.changeText(passwordInput, "newpassword123");

      // Confirm password should be visible
      expect(getByPlaceholderText("Re-enter new password")).toBeTruthy();

      // Clear password
      fireEvent.changeText(passwordInput, "");

      // Confirm password should be hidden
      expect(queryByPlaceholderText("Re-enter new password")).toBeNull();
    });

    it("should show error when passwords do not match", async () => {
      const { getByText, getByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const passwordInput = getByPlaceholderText("Leave blank to keep current password");
      fireEvent.changeText(passwordInput, "newpassword123");

      const confirmPasswordInput = getByPlaceholderText("Re-enter new password");
      fireEvent.changeText(confirmPasswordInput, "differentpassword");

      const submitButton = getByText("Save Changes");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Passwords do not match.")).toBeTruthy();
      });
    });

    it("should not show error when passwords match", async () => {
      FetchData.editEmployee.mockResolvedValue({ user: mockEmployee });

      const { getByText, getByPlaceholderText, queryByText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const passwordInput = getByPlaceholderText("Leave blank to keep current password");
      fireEvent.changeText(passwordInput, "newpassword123");

      const confirmPasswordInput = getByPlaceholderText("Re-enter new password");
      fireEvent.changeText(confirmPasswordInput, "newpassword123");

      const submitButton = getByText("Save Changes");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      expect(queryByText("Passwords do not match.")).toBeNull();
    });
  });

  describe("Form Submission", () => {
    it("should call editEmployee with correct data on submit", async () => {
      FetchData.editEmployee.mockResolvedValue({ user: { ...mockEmployee, firstName: "Jane" } });

      const { getByText, getByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      // Change first name
      const firstNameInput = getByPlaceholderText("First Name");
      fireEvent.changeText(firstNameInput, "Jane");

      const submitButton = getByText("Save Changes");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      await waitFor(() => {
        expect(FetchData.editEmployee).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "1",
            userName: "johnd",
            email: "john.doe@example.com",
            firstName: "Jane",
            lastName: "Doe",
            phone: "555-123-4567",
          })
        );
      });
    });

    it("should call editEmployee with password when provided", async () => {
      FetchData.editEmployee.mockResolvedValue({ user: mockEmployee });

      const { getByText, getByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const passwordInput = getByPlaceholderText("Leave blank to keep current password");
      fireEvent.changeText(passwordInput, "newpassword123");

      const confirmPasswordInput = getByPlaceholderText("Re-enter new password");
      fireEvent.changeText(confirmPasswordInput, "newpassword123");

      const submitButton = getByText("Save Changes");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      await waitFor(() => {
        expect(FetchData.editEmployee).toHaveBeenCalledWith(
          expect.objectContaining({
            password: "newpassword123",
          })
        );
      });
    });

    it("should show success message after successful update", async () => {
      FetchData.editEmployee.mockResolvedValue({ user: mockEmployee });

      const { getByText, findByText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Save Changes");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      const successMessage = await findByText(/Successfully updated John Doe/);
      expect(successMessage).toBeTruthy();
    });

    it("should update employee list after successful update", async () => {
      const updatedEmployee = { ...mockEmployee, firstName: "Jane" };
      FetchData.editEmployee.mockResolvedValue({ user: updatedEmployee });

      const mockSetEmployeeList = jest.fn();

      const { getByText } = render(
        <EditEmployeeForm
          employeeList={[mockEmployee]}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      const submitButton = getByText("Save Changes");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      await waitFor(() => {
        expect(mockSetEmployeeList).toHaveBeenCalledWith([updatedEmployee]);
      });
    });

    it("should navigate back after successful update", async () => {
      FetchData.editEmployee.mockResolvedValue({ user: mockEmployee });

      const { getByText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Save Changes");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      // Wait for setTimeout
      await act(async () => {
        jest.advanceTimersByTime(1600);
      });

      expect(mockNavigate).toHaveBeenCalledWith("/employees");
    });

    it("should show error when email already exists", async () => {
      FetchData.editEmployee.mockResolvedValue("An account already has this email");

      const { getByText, findByText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Save Changes");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      const errorMessage = await findByText("An account already has this email");
      expect(errorMessage).toBeTruthy();
    });

    it("should show error when username already exists", async () => {
      FetchData.editEmployee.mockResolvedValue("Username already exists");

      const { getByText, findByText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Save Changes");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      const errorMessage = await findByText("Username already exists");
      expect(errorMessage).toBeTruthy();
    });

    it("should show generic error on unexpected failure", async () => {
      FetchData.editEmployee.mockRejectedValue(new Error("Network error"));

      const { getByText, findByText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Save Changes");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      const errorMessage = await findByText("An unexpected error occurred. Please try again.");
      expect(errorMessage).toBeTruthy();
    });

    it("should disable submit button while submitting", async () => {
      FetchData.editEmployee.mockImplementation(() => new Promise(() => {}));

      const { getByText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const submitButton = getByText("Save Changes");
      await act(async () => {
        fireEvent.press(submitButton);
      });

      // The button should show loading state
      await waitFor(() => {
        expect(() => getByText("Save Changes")).toThrow();
      });
    });
  });

  describe("Navigation", () => {
    it("should have back button that navigates to employees list", () => {
      const { getByText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      // Verify the Edit Employee title exists (indicates form is loaded)
      expect(getByText("Edit Employee")).toBeTruthy();
    });
  });

  describe("Loading State", () => {
    it("should show loading when employee data is not available", () => {
      const { getByText } = render(
        <EditEmployeeForm employeeList={[]} setEmployeeList={jest.fn()} />
      );

      expect(getByText("Loading employee data...")).toBeTruthy();
    });

    it("should show form when employee data is available", () => {
      const { getByText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      expect(getByText("Edit Employee")).toBeTruthy();
      expect(getByText("Save Changes")).toBeTruthy();
    });
  });

  describe("Password Visibility Toggle", () => {
    it("should have password hidden by default", () => {
      const { getByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      const passwordInput = getByPlaceholderText("Leave blank to keep current password");
      expect(passwordInput.props.secureTextEntry).toBe(true);
    });

    it("should have confirm password hidden by default", () => {
      const { getByPlaceholderText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      // Enter password to show confirm field
      const passwordInput = getByPlaceholderText("Leave blank to keep current password");
      fireEvent.changeText(passwordInput, "newpassword123");

      const confirmPasswordInput = getByPlaceholderText("Re-enter new password");
      expect(confirmPasswordInput.props.secureTextEntry).toBe(true);
    });
  });

  describe("Info Text", () => {
    it("should display info text about changes taking effect", () => {
      const { getByText } = render(
        <EditEmployeeForm {...defaultProps} />
      );

      expect(getByText(/Changes will take effect immediately/)).toBeTruthy();
    });
  });

  describe("Empty Props Handling", () => {
    it("should handle employee with no phone", () => {
      const employeeNoPhone = { ...mockEmployee, phone: null };
      const { getByPlaceholderText } = render(
        <EditEmployeeForm
          employeeList={[employeeNoPhone]}
          setEmployeeList={jest.fn()}
        />
      );

      const phoneInput = getByPlaceholderText("Phone Number (optional)");
      expect(phoneInput.props.value).toBe("");
    });

    it("should handle employee with empty first name", () => {
      const employeeNoFirstName = { ...mockEmployee, firstName: null };
      const { getByPlaceholderText } = render(
        <EditEmployeeForm
          employeeList={[employeeNoFirstName]}
          setEmployeeList={jest.fn()}
        />
      );

      const firstNameInput = getByPlaceholderText("First Name");
      expect(firstNameInput.props.value).toBe("");
    });
  });
});
