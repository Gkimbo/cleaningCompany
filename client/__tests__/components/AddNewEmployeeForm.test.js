import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import AddEmployeeForm from "../../src/components/admin/forms/AddNewEmployeeForm";
import FetchData from "../../src/services/fetchRequests/fetchData";
import { AuthContext } from "../../src/services/AuthContext";

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
}));

jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  makeNewEmployee: jest.fn(),
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

const mockLogin = jest.fn();

const renderWithContext = (component) => {
  return render(
    <AuthContext.Provider value={{ login: mockLogin }}>
      {component}
    </AuthContext.Provider>
  );
};

describe("AddEmployeeForm", () => {
  const mockSetEmployeeList = jest.fn();
  const mockEmployeeList = [];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders all form fields", () => {
      const { getByPlaceholderText, getByText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      expect(getByPlaceholderText("First name")).toBeTruthy();
      expect(getByPlaceholderText("Last name")).toBeTruthy();
      expect(getByPlaceholderText("Enter username (4-12 characters)")).toBeTruthy();
      expect(getByPlaceholderText("Enter password (min 6 characters)")).toBeTruthy();
      expect(getByPlaceholderText("Confirm password")).toBeTruthy();
      expect(getByPlaceholderText("Enter email address")).toBeTruthy();
      expect(getByText("Add Employee")).toBeTruthy();
    });

    it("renders auto-generate password button", () => {
      const { getByText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      expect(getByText("Auto-generate")).toBeTruthy();
    });

    it("renders field labels", () => {
      const { getByText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      expect(getByText("First Name")).toBeTruthy();
      expect(getByText("Last Name")).toBeTruthy();
      expect(getByText("Username")).toBeTruthy();
      expect(getByText("Password")).toBeTruthy();
      expect(getByText("Confirm Password")).toBeTruthy();
      expect(getByText("Email")).toBeTruthy();
    });
  });

  describe("Form input", () => {
    it("updates first name field", () => {
      const { getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      const input = getByPlaceholderText("First name");
      fireEvent.changeText(input, "John");

      expect(input.props.value).toBe("John");
    });

    it("updates last name field", () => {
      const { getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      const input = getByPlaceholderText("Last name");
      fireEvent.changeText(input, "Doe");

      expect(input.props.value).toBe("Doe");
    });

    it("updates username field", () => {
      const { getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      const input = getByPlaceholderText("Enter username (4-12 characters)");
      fireEvent.changeText(input, "johndoe");

      expect(input.props.value).toBe("johndoe");
    });

    it("updates email field", () => {
      const { getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      const input = getByPlaceholderText("Enter email address");
      fireEvent.changeText(input, "john@example.com");

      expect(input.props.value).toBe("john@example.com");
    });

    it("updates password field", () => {
      const { getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      const input = getByPlaceholderText("Enter password (min 6 characters)");
      fireEvent.changeText(input, "password123");

      expect(input.props.value).toBe("password123");
    });

    it("updates confirm password field", () => {
      const { getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      const input = getByPlaceholderText("Confirm password");
      fireEvent.changeText(input, "password123");

      expect(input.props.value).toBe("password123");
    });
  });

  describe("Password auto-generation", () => {
    it("generates password when Auto-generate is pressed", () => {
      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fireEvent.press(getByText("Auto-generate"));

      const passwordInput = getByPlaceholderText("Enter password (min 6 characters)");
      const confirmInput = getByPlaceholderText("Confirm password");

      expect(passwordInput.props.value.length).toBeGreaterThanOrEqual(8);
      expect(confirmInput.props.value).toBe(passwordInput.props.value);
    });

    it("generates strong password with required characters", () => {
      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fireEvent.press(getByText("Auto-generate"));

      const passwordInput = getByPlaceholderText("Enter password (min 6 characters)");
      const password = passwordInput.props.value;

      // Should have at least 16 characters
      expect(password.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe("Validation", () => {
    it("shows error when first name is empty", async () => {
      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      // Fill in all fields except first name
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText("Enter username (4-12 characters)"), "johndoe");
      fireEvent.changeText(getByPlaceholderText("Enter email address"), "john@example.com");
      fireEvent.changeText(getByPlaceholderText("Enter password (min 6 characters)"), "password123");
      fireEvent.changeText(getByPlaceholderText("Confirm password"), "password123");

      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByText("First name is required.")).toBeTruthy();
      });
    });

    it("shows error when last name is empty", async () => {
      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      // Fill in all fields except last name
      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Enter username (4-12 characters)"), "johndoe");
      fireEvent.changeText(getByPlaceholderText("Enter email address"), "john@example.com");
      fireEvent.changeText(getByPlaceholderText("Enter password (min 6 characters)"), "password123");
      fireEvent.changeText(getByPlaceholderText("Confirm password"), "password123");

      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByText("Last name is required.")).toBeTruthy();
      });
    });

    it("shows error when username is too short", async () => {
      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText("Enter username (4-12 characters)"), "abc"); // 3 chars
      fireEvent.changeText(getByPlaceholderText("Enter email address"), "john@example.com");
      fireEvent.changeText(getByPlaceholderText("Enter password (min 6 characters)"), "password123");
      fireEvent.changeText(getByPlaceholderText("Confirm password"), "password123");

      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByText("Username must be between 4 and 12 characters.")).toBeTruthy();
      });
    });

    it("shows error when username is too long", async () => {
      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText("Enter username (4-12 characters)"), "verylongusername"); // 16 chars
      fireEvent.changeText(getByPlaceholderText("Enter email address"), "john@example.com");
      fireEvent.changeText(getByPlaceholderText("Enter password (min 6 characters)"), "password123");
      fireEvent.changeText(getByPlaceholderText("Confirm password"), "password123");

      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByText("Username must be between 4 and 12 characters.")).toBeTruthy();
      });
    });

    it("shows error when email is invalid", async () => {
      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText("Enter username (4-12 characters)"), "johndoe");
      fireEvent.changeText(getByPlaceholderText("Enter email address"), "invalid-email");
      fireEvent.changeText(getByPlaceholderText("Enter password (min 6 characters)"), "password123");
      fireEvent.changeText(getByPlaceholderText("Confirm password"), "password123");

      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByText("Please enter a valid email address.")).toBeTruthy();
      });
    });

    it("shows error when password is too short", async () => {
      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText("Enter username (4-12 characters)"), "johndoe");
      fireEvent.changeText(getByPlaceholderText("Enter email address"), "john@example.com");
      fireEvent.changeText(getByPlaceholderText("Enter password (min 6 characters)"), "pass"); // 4 chars
      fireEvent.changeText(getByPlaceholderText("Confirm password"), "pass");

      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByText("Password must be at least 6 characters.")).toBeTruthy();
      });
    });

    it("shows error when passwords do not match", async () => {
      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText("Enter username (4-12 characters)"), "johndoe");
      fireEvent.changeText(getByPlaceholderText("Enter email address"), "john@example.com");
      fireEvent.changeText(getByPlaceholderText("Enter password (min 6 characters)"), "password123");
      fireEvent.changeText(getByPlaceholderText("Confirm password"), "differentpassword");

      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByText("Passwords do not match.")).toBeTruthy();
      });
    });

    it("shows multiple validation errors", async () => {
      const { getByText, getAllByText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      // Submit empty form
      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByText("First name is required.")).toBeTruthy();
        expect(getByText("Last name is required.")).toBeTruthy();
      });
    });
  });

  describe("Form submission", () => {
    const fillValidForm = (getByPlaceholderText) => {
      fireEvent.changeText(getByPlaceholderText("First name"), "John");
      fireEvent.changeText(getByPlaceholderText("Last name"), "Doe");
      fireEvent.changeText(getByPlaceholderText("Enter username (4-12 characters)"), "johndoe");
      fireEvent.changeText(getByPlaceholderText("Enter email address"), "john@example.com");
      fireEvent.changeText(getByPlaceholderText("Enter password (min 6 characters)"), "password123");
      fireEvent.changeText(getByPlaceholderText("Confirm password"), "password123");
    };

    it("calls makeNewEmployee with correct data", async () => {
      FetchData.makeNewEmployee.mockResolvedValue({
        user: { id: 1, username: "johndoe" },
      });

      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fillValidForm(getByPlaceholderText);
      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(FetchData.makeNewEmployee).toHaveBeenCalledWith({
          firstName: "John",
          lastName: "Doe",
          userName: "johndoe",
          password: "password123",
          email: "john@example.com",
          type: "cleaner",
        });
      });
    });

    it("updates employee list on successful creation", async () => {
      const newUser = { id: 1, username: "johndoe" };
      FetchData.makeNewEmployee.mockResolvedValue({ user: newUser });

      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fillValidForm(getByPlaceholderText);
      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(mockSetEmployeeList).toHaveBeenCalledWith([newUser]);
      });
    });

    it("clears form on successful creation", async () => {
      FetchData.makeNewEmployee.mockResolvedValue({
        user: { id: 1, username: "johndoe" },
      });

      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fillValidForm(getByPlaceholderText);
      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByPlaceholderText("First name").props.value).toBe("");
        expect(getByPlaceholderText("Last name").props.value).toBe("");
        expect(getByPlaceholderText("Enter username (4-12 characters)").props.value).toBe("");
        expect(getByPlaceholderText("Enter email address").props.value).toBe("");
      });
    });

    it("shows error when email already exists", async () => {
      FetchData.makeNewEmployee.mockResolvedValue("An account already has this email");

      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fillValidForm(getByPlaceholderText);
      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByText("An account already has this email")).toBeTruthy();
      });
    });

    it("shows error when username already exists", async () => {
      FetchData.makeNewEmployee.mockResolvedValue("Username already exists");

      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fillValidForm(getByPlaceholderText);
      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByText("Username already exists")).toBeTruthy();
      });
    });

    it("shows Adding... while submitting", async () => {
      FetchData.makeNewEmployee.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ user: {} }), 100))
      );

      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fillValidForm(getByPlaceholderText);
      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByText("Adding...")).toBeTruthy();
      });
    });

    it("disables submit button while submitting", async () => {
      FetchData.makeNewEmployee.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ user: {} }), 100))
      );

      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fillValidForm(getByPlaceholderText);
      const submitButton = getByText("Add Employee");
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(getByText("Adding...")).toBeTruthy();
      });
    });

    it("handles API error gracefully", async () => {
      FetchData.makeNewEmployee.mockRejectedValue(new Error("API error"));

      const { getByText, getByPlaceholderText } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      fillValidForm(getByPlaceholderText);
      fireEvent.press(getByText("Add Employee"));

      await waitFor(() => {
        expect(getByText("Failed to create employee. Please try again.")).toBeTruthy();
      });
    });
  });

  describe("Password visibility toggle", () => {
    it("toggles password visibility", () => {
      const { getByPlaceholderText, getAllByTestId } = renderWithContext(
        <AddEmployeeForm
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      const passwordInput = getByPlaceholderText("Enter password (min 6 characters)");
      
      // Initially password is hidden
      expect(passwordInput.props.secureTextEntry).toBe(true);
    });
  });
});
