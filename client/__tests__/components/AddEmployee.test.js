import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import AddEmployee from "../../src/components/admin/AddEmployee";
import FetchData from "../../src/services/fetchRequests/fetchData";

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  get: jest.fn(),
  deleteEmployee: jest.fn(),
}));

// Mock alert (used by the component)
global.alert = jest.fn();

// Mock AddEmployeeForm to simplify testing
jest.mock("../../src/components/admin/forms/AddNewEmployeeForm", () => {
  const { View, Text } = require("react-native");
  return ({ employeeList, setEmployeeList }) => (
    <View testID="add-employee-form">
      <Text>Add Employee Form</Text>
    </View>
  );
});

const mockState = {
  currentUser: {
    token: "test-token",
  },
};

const mockEmployeeList = [
  {
    id: 1,
    username: "cleaner1",
    email: "cleaner1@test.com",
    type: "cleaner",
    firstName: "John",
    lastName: "Doe",
    lastLogin: "2025-01-15T10:30:00Z",
  },
  {
    id: 2,
    username: "cleaner2",
    email: "cleaner2@test.com",
    type: "cleaner",
    firstName: "Jane",
    lastName: "Smith",
    lastLogin: null,
  },
  {
    id: 3,
    username: "owneruser",
    email: "owner@test.com",
    type: "owner",
    firstName: "Owner",
    lastName: "User",
    lastLogin: "2025-01-20T14:00:00Z",
  },
];

describe("AddEmployee", () => {
  const mockSetEmployeeList = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    FetchData.get.mockResolvedValue({ users: mockEmployeeList });
  });

  describe("Rendering", () => {
    it("renders without crashing", async () => {
      const { getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getByText("Manage Employees")).toBeTruthy();
      });
    });

    it("renders back button", async () => {
      const { getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getByText("< Back")).toBeTruthy();
      });
    });

    it("renders add employee form section", async () => {
      const { getByText, getByTestId } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getByText("Add New Employee")).toBeTruthy();
        expect(getByTestId("add-employee-form")).toBeTruthy();
      });
    });

    it("renders employee count correctly", async () => {
      const { getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getByText("Current Employees (3)")).toBeTruthy();
      });
    });

    it("renders all employee tiles", async () => {
      const { getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getByText("John Doe")).toBeTruthy();
        expect(getByText("Jane Smith")).toBeTruthy();
        expect(getByText("Owner User")).toBeTruthy();
      });
    });

    it("renders empty state when no employees", async () => {
      const { getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={[]}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getByText("No Employees Yet")).toBeTruthy();
        expect(getByText("Add your first employee using the form above to get started.")).toBeTruthy();
      });
    });
  });

  describe("Employee tile display", () => {
    it("displays employee username when no full name", async () => {
      const employeeWithoutName = [
        {
          id: 1,
          username: "noname",
          email: "noname@test.com",
          type: "cleaner",
          firstName: null,
          lastName: null,
        },
      ];

      const { getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={employeeWithoutName}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getByText("noname")).toBeTruthy();
      });
    });

    it("displays employee email", async () => {
      const { getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getByText("cleaner1@test.com")).toBeTruthy();
      });
    });

    it("displays Cleaner badge for cleaner type", async () => {
      const { getAllByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getAllByText("Cleaner").length).toBe(2);
      });
    });

    it("displays Owner badge for owner type", async () => {
      const { getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getByText("Owner")).toBeTruthy();
      });
    });

    it("displays Never for employees who have not logged in", async () => {
      const { getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getByText("Never")).toBeTruthy();
      });
    });

    it("displays formatted last login date", async () => {
      const { getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        // Jan 15, 2025, XX:XX AM/PM (format depends on locale)
        expect(getByText(/Jan 15, 2025/)).toBeTruthy();
      });
    });

    it("displays Edit and Remove buttons for each employee", async () => {
      const { getAllByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getAllByText("Edit").length).toBe(3);
        expect(getAllByText("Remove").length).toBe(3);
      });
    });

    it("displays avatar initial from first name", async () => {
      const { getAllByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        // John and Jane both start with J
        expect(getAllByText("J").length).toBe(2);
        expect(getAllByText("O").length).toBe(1); // Owner
      });
    });

    it("displays avatar initial from username when no first name", async () => {
      const employeeWithoutFirstName = [
        {
          id: 1,
          username: "xuser",
          email: "x@test.com",
          type: "cleaner",
          firstName: null,
          lastName: null,
        },
      ];

      const { getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={employeeWithoutFirstName}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(getByText("X")).toBeTruthy();
      });
    });
  });

  describe("Navigation", () => {
    it("navigates to home when back button is pressed", async () => {
      const { getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        fireEvent.press(getByText("< Back"));
      });

      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    it("navigates to edit page when Edit button is pressed", async () => {
      const { getAllByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        const editButtons = getAllByText("Edit");
        fireEvent.press(editButtons[0]);
      });

      expect(mockNavigate).toHaveBeenCalledWith("/employee-edit/1");
    });
  });

  describe("Delete functionality", () => {
    it("opens delete modal when Remove button is pressed", async () => {
      const { getAllByText, getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        const removeButtons = getAllByText("Remove");
        fireEvent.press(removeButtons[0]);
      });

      await waitFor(() => {
        expect(getByText("Remove Employee?")).toBeTruthy();
        expect(getByText(/Are you sure you want to remove John Doe/)).toBeTruthy();
      });
    });

    it("closes delete modal when Keep button is pressed", async () => {
      const { getAllByText, getByText, queryByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        const removeButtons = getAllByText("Remove");
        fireEvent.press(removeButtons[0]);
      });

      await waitFor(() => {
        expect(getByText("Remove Employee?")).toBeTruthy();
      });

      fireEvent.press(getByText("Keep"));

      await waitFor(() => {
        expect(queryByText("Remove Employee?")).toBeNull();
      });
    });

    it("calls deleteEmployee and updates list when confirmed", async () => {
      FetchData.deleteEmployee.mockResolvedValue(true);

      const { getAllByText, getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        const removeButtons = getAllByText("Remove");
        fireEvent.press(removeButtons[0]);
      });

      await waitFor(() => {
        expect(getByText("Remove Employee?")).toBeTruthy();
      });

      // Modal Remove button is the last one in the list
      const allRemoveButtons = getAllByText("Remove");
      const modalRemoveButton = allRemoveButtons[allRemoveButtons.length - 1];
      await act(async () => {
        fireEvent.press(modalRemoveButton);
      });

      await waitFor(() => {
        expect(FetchData.deleteEmployee).toHaveBeenCalledWith(1, "test-token");
        expect(mockSetEmployeeList).toHaveBeenCalled();
      });
    });

    it("shows Removing... text while deleting", async () => {
      // Make deleteEmployee take some time
      FetchData.deleteEmployee.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
      );

      const { getAllByText, getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        const removeButtons = getAllByText("Remove");
        fireEvent.press(removeButtons[0]);
      });

      await waitFor(() => {
        expect(getByText("Remove Employee?")).toBeTruthy();
      });

      // Modal Remove button is the last one in the list
      const allRemoveButtons = getAllByText("Remove");
      const modalRemoveButton = allRemoveButtons[allRemoveButtons.length - 1];
      fireEvent.press(modalRemoveButton);

      await waitFor(() => {
        expect(getByText("Removing...")).toBeTruthy();
      });
    });

    it("removes employee from local list after successful delete", async () => {
      FetchData.deleteEmployee.mockResolvedValue(true);

      const { getAllByText, getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(mockSetEmployeeList).toHaveBeenCalled();
      });

      // Reset mock to track only delete-related calls
      mockSetEmployeeList.mockClear();

      await waitFor(() => {
        const removeButtons = getAllByText("Remove");
        fireEvent.press(removeButtons[0]);
      });

      await waitFor(() => {
        expect(getByText("Remove Employee?")).toBeTruthy();
      });

      // Modal Remove button is the last one in the list
      const allRemoveButtons = getAllByText("Remove");
      const modalRemoveButton = allRemoveButtons[allRemoveButtons.length - 1];
      await act(async () => {
        fireEvent.press(modalRemoveButton);
      });

      await waitFor(() => {
        expect(mockSetEmployeeList).toHaveBeenCalled();
        // Check that the call was made with a list without employee id 1
        const updateCall = mockSetEmployeeList.mock.calls[0][0];
        expect(updateCall.length).toBe(2); // 3 - 1 = 2
        expect(updateCall.some((emp) => emp.id === 2)).toBe(true);
        expect(updateCall.some((emp) => emp.id === 3)).toBe(true);
      });
    });

    it("handles delete error gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      FetchData.deleteEmployee.mockRejectedValue(new Error("Delete failed"));

      const { getAllByText, getByText } = render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        const removeButtons = getAllByText("Remove");
        fireEvent.press(removeButtons[0]);
      });

      await waitFor(() => {
        expect(getByText("Remove Employee?")).toBeTruthy();
      });

      // Modal Remove button is the last one in the list
      const allRemoveButtons = getAllByText("Remove");
      const modalRemoveButton = allRemoveButtons[allRemoveButtons.length - 1];
      await act(async () => {
        fireEvent.press(modalRemoveButton);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error deleting employee:",
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Data fetching", () => {
    it("fetches employees on mount", async () => {
      render(
        <AddEmployee
          state={mockState}
          employeeList={mockEmployeeList}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(FetchData.get).toHaveBeenCalledWith(
          "/api/v1/users/employees",
          "test-token"
        );
      });
    });

    it("updates employee list with fetched data", async () => {
      const freshEmployees = [{ id: 10, username: "fresh" }];
      FetchData.get.mockResolvedValue({ users: freshEmployees });

      render(
        <AddEmployee
          state={mockState}
          employeeList={[]}
          setEmployeeList={mockSetEmployeeList}
        />
      );

      await waitFor(() => {
        expect(mockSetEmployeeList).toHaveBeenCalledWith(freshEmployees);
      });
    });
  });
});
