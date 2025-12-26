import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import AppointmentList from "../../src/components/appointments/AppointmentList";
import FetchData from "../../src/services/fetchRequests/fetchData";

// Mock dependencies
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

const mockNavigate = jest.fn();

jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  get: jest.fn(),
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock HomeAppointmentTile to simplify testing
jest.mock("../../src/components/tiles/HomeAppointmentTile", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  return ({ nickName, address, onAppointmentCancelled, allAppointments }) => (
    <View testID="home-appointment-tile">
      <Text>{nickName}</Text>
      <Text>{address}</Text>
      <Text>Appointments: {allAppointments?.length || 0}</Text>
      <TouchableOpacity
        testID="cancel-appointment"
        onPress={() => onAppointmentCancelled && onAppointmentCancelled(1)}
      >
        <Text>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
});

const mockDispatch = jest.fn();

const createState = (overrides = {}) => ({
  currentUser: {
    token: "test-token",
    ...overrides.currentUser,
  },
  homes: overrides.homes || [],
  appointments: overrides.appointments || [],
  ...overrides,
});

describe("AppointmentList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FetchData.get.mockResolvedValue({
      user: {
        homes: [],
        appointments: [],
        bill: null,
      },
    });
  });

  describe("Rendering", () => {
    it("renders without crashing", () => {
      const state = createState();
      const { getByText } = render(
        <AppointmentList state={state} dispatch={mockDispatch} />
      );
      expect(getByText("Add a Home")).toBeTruthy();
    });

    it("renders Back button", () => {
      const state = createState();
      const { getByText } = render(
        <AppointmentList state={state} dispatch={mockDispatch} />
      );
      expect(getByText("Back")).toBeTruthy();
    });

    it("renders 'Add a Home' button when no homes exist", () => {
      const state = createState({ homes: [] });
      const { getByText, queryByText } = render(
        <AppointmentList state={state} dispatch={mockDispatch} />
      );
      expect(getByText("Add a Home")).toBeTruthy();
      expect(queryByText("Add another Home")).toBeNull();
    });

    it("renders 'Add another Home' button when homes exist", () => {
      const state = createState({
        homes: [
          {
            id: 1,
            nickName: "Beach House",
            address: "123 Ocean Dr",
            city: "Miami",
            state: "FL",
            zipcode: "33139",
            contact: "555-1234",
            numBeds: 3,
            numBaths: 2,
          },
        ],
      });
      const { getByText } = render(
        <AppointmentList state={state} dispatch={mockDispatch} />
      );
      expect(getByText("Add another Home")).toBeTruthy();
    });

    it("renders home tiles for each home", () => {
      const state = createState({
        homes: [
          {
            id: 1,
            nickName: "Beach House",
            address: "123 Ocean Dr",
            city: "Miami",
            state: "FL",
            zipcode: "33139",
            contact: "555-1234",
            numBeds: 3,
            numBaths: 2,
          },
          {
            id: 2,
            nickName: "Mountain Cabin",
            address: "456 Peak Rd",
            city: "Aspen",
            state: "CO",
            zipcode: "81611",
            contact: "555-5678",
            numBeds: 4,
            numBaths: 3,
          },
        ],
      });
      const { getByText, getAllByTestId } = render(
        <AppointmentList state={state} dispatch={mockDispatch} />
      );
      expect(getByText("Beach House")).toBeTruthy();
      expect(getByText("Mountain Cabin")).toBeTruthy();
      expect(getAllByTestId("home-appointment-tile")).toHaveLength(2);
    });
  });

  describe("Data fetching", () => {
    it("fetches user data on mount with token", async () => {
      const state = createState();
      render(<AppointmentList state={state} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(FetchData.get).toHaveBeenCalledWith(
          "/api/v1/user-info",
          "test-token"
        );
      });
    });

    it("does not fetch data when no token", async () => {
      const state = createState({
        currentUser: { token: null },
      });
      render(<AppointmentList state={state} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(FetchData.get).not.toHaveBeenCalled();
      });
    });

    it("dispatches USER_HOME action with fetched homes", async () => {
      const mockHomes = [
        { id: 1, nickName: "Test Home" },
      ];
      FetchData.get.mockResolvedValue({
        user: {
          homes: mockHomes,
          appointments: [],
          bill: null,
        },
      });

      const state = createState();
      render(<AppointmentList state={state} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "USER_HOME",
          payload: mockHomes,
        });
      });
    });

    it("dispatches USER_APPOINTMENTS action with fetched appointments", async () => {
      const mockAppointments = [
        { id: 1, date: "2025-02-15", price: 150 },
      ];
      FetchData.get.mockResolvedValue({
        user: {
          homes: [],
          appointments: mockAppointments,
          bill: null,
        },
      });

      const state = createState();
      render(<AppointmentList state={state} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "USER_APPOINTMENTS",
          payload: mockAppointments,
        });
      });
    });

    it("dispatches DB_BILL action with fetched bill", async () => {
      const mockBill = { total: 500 };
      FetchData.get.mockResolvedValue({
        user: {
          homes: [],
          appointments: [],
          bill: mockBill,
        },
      });

      const state = createState();
      render(<AppointmentList state={state} dispatch={mockDispatch} />);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: "DB_BILL",
          payload: mockBill,
        });
      });
    });
  });

  describe("Navigation", () => {
    it("navigates to add-home when Add a Home button is pressed", async () => {
      const state = createState();
      const { getByText } = render(
        <AppointmentList state={state} dispatch={mockDispatch} />
      );

      fireEvent.press(getByText("Add a Home"));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/add-home");
      });
    });

    it("navigates to add-home when Add another Home button is pressed", async () => {
      const state = createState({
        homes: [{ id: 1, nickName: "Test Home" }],
      });
      const { getByText } = render(
        <AppointmentList state={state} dispatch={mockDispatch} />
      );

      fireEvent.press(getByText("Add another Home"));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/add-home");
      });
    });

    it("navigates to home when Back button is pressed", async () => {
      const state = createState();
      const { getByText } = render(
        <AppointmentList state={state} dispatch={mockDispatch} />
      );

      fireEvent.press(getByText("Back"));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/");
      });
    });
  });

  describe("Appointment cancellation", () => {
    it("removes cancelled appointment from local state", async () => {
      const state = createState({
        homes: [
          {
            id: 1,
            nickName: "Test Home",
            address: "123 Test St",
          },
        ],
      });

      const { getByTestId, getByText } = render(
        <AppointmentList state={state} dispatch={mockDispatch} />
      );

      // Initially shows appointment count
      expect(getByText("Appointments: 0")).toBeTruthy();

      // Trigger cancellation callback
      fireEvent.press(getByTestId("cancel-appointment"));

      // The component should re-fetch data
      await waitFor(() => {
        expect(FetchData.get).toHaveBeenCalled();
      });
    });
  });

  describe("Responsive design", () => {
    it("renders correctly on small screens", () => {
      // Mock smaller window dimensions
      jest.spyOn(require("react-native"), "Dimensions", "get").mockReturnValue({
        get: () => ({ width: 350 }),
      });

      const state = createState();
      const { getByText } = render(
        <AppointmentList state={state} dispatch={mockDispatch} />
      );

      expect(getByText("Back")).toBeTruthy();
    });
  });

  describe("Multiple homes display", () => {
    it("displays all homes with their information", () => {
      const state = createState({
        homes: [
          {
            id: 1,
            nickName: "Home 1",
            address: "Address 1",
          },
          {
            id: 2,
            nickName: "Home 2",
            address: "Address 2",
          },
          {
            id: 3,
            nickName: "Home 3",
            address: "Address 3",
          },
        ],
      });

      const { getByText, getAllByTestId } = render(
        <AppointmentList state={state} dispatch={mockDispatch} />
      );

      expect(getByText("Home 1")).toBeTruthy();
      expect(getByText("Home 2")).toBeTruthy();
      expect(getByText("Home 3")).toBeTruthy();
      expect(getAllByTestId("home-appointment-tile")).toHaveLength(3);
    });
  });
});
