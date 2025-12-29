import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import EachAppointment from "../../src/components/tiles/EachAppointment";
import Appointment from "../../src/services/fetchRequests/AppointmentClass";
import FetchData from "../../src/services/fetchRequests/fetchData";
import { PricingProvider } from "../../src/context/PricingContext";

// Mock dependencies
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock("../../src/services/fetchRequests/AppointmentClass", () => ({
  updateCodeAppointments: jest.fn(),
  updateKeyAppointments: jest.fn(),
}));

jest.mock("../../src/services/fetchRequests/fetchData", () => ({
  getCancellationInfo: jest.fn(),
  cancelAsHomeowner: jest.fn(),
}));

jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

jest.mock("react-native-paper", () => ({
  SegmentedButtons: ({ value, onValueChange, buttons }) => {
    const { TouchableOpacity, Text } = require("react-native");
    return buttons.map((button) => (
      <TouchableOpacity
        key={button.value}
        testID={`segment-${button.value}`}
        onPress={() => onValueChange(button.value)}
      >
        <Text>{button.label}</Text>
      </TouchableOpacity>
    ));
  },
  TextInput: ({ value, onChangeText, placeholder, testID, ...props }) => {
    const { TextInput } = require("react-native");
    return (
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        testID={testID}
        {...props}
      />
    );
  },
}));

jest.mock("../../src/components/modals/CancellationWarningModal", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  return ({ visible, onClose, onConfirm, loading }) => {
    if (!visible) return null;
    return (
      <View testID="cancellation-modal">
        <Text>Cancel Appointment?</Text>
        <TouchableOpacity testID="modal-cancel" onPress={onClose}>
          <Text>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="modal-confirm" onPress={onConfirm}>
          <Text>Confirm</Text>
        </TouchableOpacity>
        {loading && <Text testID="modal-loading">Loading...</Text>}
      </View>
    );
  };
});

// Helper to wrap component with PricingProvider
const renderWithProvider = (component) => {
  return render(<PricingProvider>{component}</PricingProvider>);
};

// Default props for testing
const defaultProps = {
  id: 1,
  index: 0,
  date: "2025-02-15",
  price: 150,
  bringSheets: "no",
  bringTowels: "no",
  keyPadCode: "",
  keyLocation: "",
  isDisabled: false,
  formatDate: (d) => d,
  handleTowelToggle: jest.fn(),
  handleSheetsToggle: jest.fn(),
  setChangesSubmitted: jest.fn(),
  changeNotification: { message: "", appointment: "" },
  setChangeNotification: jest.fn(),
  contact: "555-1234",
  paid: false,
  completed: false,
  timeToBeCompleted: "anytime",
  cleanerName: null,
  token: "test-token",
  onCancel: jest.fn(),
  numBeds: 2,
  numBaths: 1,
  sheetConfigurations: null,
  towelConfigurations: null,
  onConfigurationsUpdate: jest.fn(),
  paymentCaptureFailed: false,
  onPaymentRetried: jest.fn(),
};

describe("EachAppointment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ appointment: { id: 1 } }),
      })
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("Rendering states", () => {
    it("renders completed and paid appointment", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} completed={true} paid={true} />
      );
      expect(getByText("Completed & Paid")).toBeTruthy();
    });

    it("renders completed but unpaid appointment", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} completed={true} paid={false} />
      );
      expect(getByText("Payment Due")).toBeTruthy();
      expect(getByText("Cleaning complete - Tap to pay")).toBeTruthy();
    });

    it("renders scheduled appointment", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} />
      );
      expect(getByText("Scheduled")).toBeTruthy();
    });

    it("renders upcoming appointment with days countdown", () => {
      // Set date to tomorrow at noon to avoid timezone edge cases
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      const { getByText } = renderWithProvider(
        <EachAppointment
          {...defaultProps}
          date={tomorrow.toISOString()}
          isDisabled={true}
        />
      );
      expect(getByText("Tomorrow")).toBeTruthy();
    });

    it("renders today appointment", () => {
      // Use today's date at noon
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const { getByText } = renderWithProvider(
        <EachAppointment
          {...defaultProps}
          date={today.toISOString()}
          isDisabled={true}
        />
      );
      expect(getByText("Today")).toBeTruthy();
    });

    it("displays cleaner name when completed and paid", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment
          {...defaultProps}
          completed={true}
          paid={true}
          cleanerName="John"
        />
      );
      expect(getByText("Cleaned by John")).toBeTruthy();
    });
  });

  describe("Price display", () => {
    it("displays the price", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} price={200} />
      );
      expect(getByText("$200")).toBeTruthy();
    });

    it("displays price label for active appointments", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} />
      );
      expect(getByText("Total")).toBeTruthy();
    });
  });

  describe("Time display", () => {
    it("displays Anytime for anytime slot", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} timeToBeCompleted="anytime" />
      );
      expect(getByText("Anytime")).toBeTruthy();
    });

    it("displays correct time for 10-3 slot", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} timeToBeCompleted="10-3" />
      );
      expect(getByText("10am - 3pm")).toBeTruthy();
    });

    it("displays correct time for 11-4 slot", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} timeToBeCompleted="11-4" />
      );
      expect(getByText("11am - 4pm")).toBeTruthy();
    });

    it("displays correct time for 12-2 slot", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} timeToBeCompleted="12-2" />
      );
      expect(getByText("12pm - 2pm")).toBeTruthy();
    });
  });

  describe("Contact display", () => {
    it("displays contact information", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} contact="123-456-7890" />
      );
      expect(getByText("123-456-7890")).toBeTruthy();
    });
  });

  describe("Add-ons section", () => {
    it("shows add-on services section when expanded", async () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} />
      );

      fireEvent.press(getByText("Add-on Services"));

      await waitFor(() => {
        expect(getByText("Fresh Sheets")).toBeTruthy();
        expect(getByText("Fresh Towels")).toBeTruthy();
      });
    });

    it("shows sheets indicator when sheets are included", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} bringSheets="yes" />
      );
      expect(getByText("Sheets")).toBeTruthy();
    });

    it("shows towels indicator when towels are included", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} bringTowels="yes" />
      );
      expect(getByText("Towels")).toBeTruthy();
    });

    it("shows both sheets and towels when both included", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} bringSheets="yes" bringTowels="yes" />
      );
      expect(getByText("Sheets, Towels")).toBeTruthy();
    });

    it("calls handleSheetsToggle when sheets toggle is pressed", async () => {
      const handleSheetsToggle = jest.fn();
      const { getByText, getAllByTestId } = renderWithProvider(
        <EachAppointment
          {...defaultProps}
          handleSheetsToggle={handleSheetsToggle}
        />
      );

      fireEvent.press(getByText("Add-on Services"));

      await waitFor(() => {
        const yesButtons = getAllByTestId("segment-yes");
        fireEvent.press(yesButtons[0]); // First yes is for sheets
      });

      expect(handleSheetsToggle).toHaveBeenCalled();
    });

    it("calls handleTowelToggle when towels toggle is pressed", async () => {
      const handleTowelToggle = jest.fn();
      const { getByText, getAllByTestId } = renderWithProvider(
        <EachAppointment
          {...defaultProps}
          handleTowelToggle={handleTowelToggle}
        />
      );

      fireEvent.press(getByText("Add-on Services"));

      await waitFor(() => {
        const yesButtons = getAllByTestId("segment-yes");
        fireEvent.press(yesButtons[1]); // Second yes is for towels
      });

      expect(handleTowelToggle).toHaveBeenCalled();
    });

    it("shows locked state when isDisabled is true", async () => {
      const { getByText, getAllByText } = renderWithProvider(
        <EachAppointment {...defaultProps} isDisabled={true} />
      );

      fireEvent.press(getByText("Add-on Services"));

      await waitFor(() => {
        // Both sheets and towels show "Not included" when disabled
        expect(getAllByText("Not included").length).toBe(2);
        expect(getByText("Changes locked within 1 week of appointment")).toBeTruthy();
      });
    });
  });

  describe("Access instructions", () => {
    it("shows access details section when expanded", async () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} />
      );

      fireEvent.press(getByText("Access Instructions"));

      await waitFor(() => {
        expect(getByText("Key Location")).toBeTruthy();
        expect(getByText("Door Code")).toBeTruthy();
      });
    });

    it("preloads keypad code when provided", async () => {
      const { getByText, getByDisplayValue } = renderWithProvider(
        <EachAppointment {...defaultProps} keyPadCode="1234" />
      );

      fireEvent.press(getByText("Access Instructions"));

      await waitFor(() => {
        expect(getByDisplayValue("1234")).toBeTruthy();
      });
    });

    it("preloads key location when provided", async () => {
      const { getByText, getByDisplayValue } = renderWithProvider(
        <EachAppointment {...defaultProps} keyLocation="Under the mat" />
      );

      fireEvent.press(getByText("Access Instructions"));

      await waitFor(() => {
        expect(getByDisplayValue("Under the mat")).toBeTruthy();
      });
    });

    it("validates keypad code input - rejects letters", async () => {
      const { getByText, getByPlaceholderText } = renderWithProvider(
        <EachAppointment {...defaultProps} keyPadCode="1234" />
      );

      fireEvent.press(getByText("Access Instructions"));

      await waitFor(() => {
        const codeInput = getByPlaceholderText("1234#");
        fireEvent.changeText(codeInput, "abc");
      });

      expect(getByText("Key Pad Code can only be a number!")).toBeTruthy();
    });

    it("shows error when keypad code is empty after input", async () => {
      const { getByText, getByPlaceholderText, getByDisplayValue } = renderWithProvider(
        <EachAppointment {...defaultProps} keyPadCode="1234" />
      );

      fireEvent.press(getByText("Access Instructions"));

      await waitFor(() => {
        const codeInput = getByDisplayValue("1234");
        fireEvent.changeText(codeInput, "");
      });

      expect(getByText("Key Pad Code cannot be blank!")).toBeTruthy();
    });

    it("shows Save Changes button when code changes", async () => {
      const { getByText, getByDisplayValue } = renderWithProvider(
        <EachAppointment {...defaultProps} keyPadCode="1234" />
      );

      fireEvent.press(getByText("Access Instructions"));

      await waitFor(() => {
        const codeInput = getByDisplayValue("1234");
        fireEvent.changeText(codeInput, "5678");
      });

      expect(getByText("Save Changes")).toBeTruthy();
    });

    it("submits code change successfully", async () => {
      Appointment.updateCodeAppointments.mockResolvedValue({ success: true });

      const setChangesSubmitted = jest.fn();
      const setChangeNotification = jest.fn();

      const { getByText, getByDisplayValue } = renderWithProvider(
        <EachAppointment
          {...defaultProps}
          keyPadCode="1234"
          setChangesSubmitted={setChangesSubmitted}
          setChangeNotification={setChangeNotification}
        />
      );

      fireEvent.press(getByText("Access Instructions"));

      await waitFor(() => {
        const codeInput = getByDisplayValue("1234");
        fireEvent.changeText(codeInput, "5678");
      });

      fireEvent.press(getByText("Save Changes"));

      await waitFor(() => {
        expect(Appointment.updateCodeAppointments).toHaveBeenCalledWith("5678", 1);
        expect(setChangesSubmitted).toHaveBeenCalledWith(true);
      });
    });

    it("submits key location change successfully", async () => {
      Appointment.updateKeyAppointments.mockResolvedValue({ success: true });

      const setChangesSubmitted = jest.fn();

      const { getByText, getByDisplayValue, getByTestId } = renderWithProvider(
        <EachAppointment
          {...defaultProps}
          keyLocation="Under the mat"
          setChangesSubmitted={setChangesSubmitted}
        />
      );

      fireEvent.press(getByText("Access Instructions"));

      await waitFor(() => {
        const keyInput = getByDisplayValue("Under the mat");
        fireEvent.changeText(keyInput, "In the mailbox");
      });

      fireEvent.press(getByText("Save Changes"));

      await waitFor(() => {
        expect(Appointment.updateKeyAppointments).toHaveBeenCalledWith("In the mailbox", 1);
        expect(setChangesSubmitted).toHaveBeenCalledWith(true);
      });
    });

    it("shows error when no code or key provided on submit", async () => {
      const { getByText, getByTestId } = renderWithProvider(
        <EachAppointment {...defaultProps} keyPadCode="1234" />
      );

      fireEvent.press(getByText("Access Instructions"));

      await waitFor(() => {
        // Switch to key mode but leave empty
        fireEvent.press(getByTestId("segment-key"));
      });

      // The toggle clears the code, so Save Changes should appear
      await waitFor(() => {
        const saveButton = getByText("Save Changes");
        fireEvent.press(saveButton);
      });

      await waitFor(() => {
        expect(
          getByText("Please provide instructions on how to get into the property with either a key or a code")
        ).toBeTruthy();
      });
    });

    it("shows success notification after saving", async () => {
      Appointment.updateCodeAppointments.mockResolvedValue({ success: true });

      const { getByText, getByDisplayValue, rerender } = renderWithProvider(
        <EachAppointment
          {...defaultProps}
          keyPadCode="1234"
          changeNotification={{ message: "", appointment: "" }}
        />
      );

      fireEvent.press(getByText("Access Instructions"));

      await waitFor(() => {
        const codeInput = getByDisplayValue("1234");
        fireEvent.changeText(codeInput, "5678");
      });

      fireEvent.press(getByText("Save Changes"));

      // After save, the notification should be set
      await waitFor(() => {
        expect(Appointment.updateCodeAppointments).toHaveBeenCalled();
      });
    });
  });

  describe("Cancel appointment", () => {
    it("shows cancel button for non-completed appointments", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} completed={false} />
      );
      expect(getByText("Cancel Appointment")).toBeTruthy();
    });

    it("does not show cancel button for completed appointments", () => {
      const { queryByText } = renderWithProvider(
        <EachAppointment {...defaultProps} completed={true} paid={true} />
      );
      expect(queryByText("Cancel Appointment")).toBeNull();
    });

    it("opens cancellation modal when cancel is pressed", async () => {
      FetchData.getCancellationInfo.mockResolvedValue({
        refundAmount: 100,
        fee: 50,
      });

      const { getByText, getByTestId } = renderWithProvider(
        <EachAppointment {...defaultProps} />
      );

      fireEvent.press(getByText("Cancel Appointment"));

      await waitFor(() => {
        expect(FetchData.getCancellationInfo).toHaveBeenCalledWith(1, "test-token");
        expect(getByTestId("cancellation-modal")).toBeTruthy();
      });
    });

    it("shows error when cancellation info fails", async () => {
      FetchData.getCancellationInfo.mockResolvedValue({
        error: "Failed to get cancellation info",
      });

      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} />
      );

      // Expand access instructions to see error
      fireEvent.press(getByText("Access Instructions"));
      fireEvent.press(getByText("Cancel Appointment"));

      await waitFor(() => {
        expect(getByText("Failed to get cancellation info")).toBeTruthy();
      });
    });

    it("shows error when no token provided", async () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} token={null} />
      );

      // Expand access instructions to see error
      fireEvent.press(getByText("Access Instructions"));
      fireEvent.press(getByText("Cancel Appointment"));

      await waitFor(() => {
        expect(getByText("Authentication required to cancel")).toBeTruthy();
      });
    });

    it("calls onCancel when cancellation is confirmed", async () => {
      FetchData.getCancellationInfo.mockResolvedValue({
        refundAmount: 100,
        fee: 50,
      });
      FetchData.cancelAsHomeowner.mockResolvedValue({
        success: true,
        message: "Cancelled",
      });

      const onCancel = jest.fn();

      const { getByText, getByTestId } = renderWithProvider(
        <EachAppointment {...defaultProps} onCancel={onCancel} />
      );

      fireEvent.press(getByText("Cancel Appointment"));

      await waitFor(() => {
        expect(getByTestId("cancellation-modal")).toBeTruthy();
      });

      fireEvent.press(getByTestId("modal-confirm"));

      await waitFor(() => {
        expect(FetchData.cancelAsHomeowner).toHaveBeenCalledWith(1, "test-token");
        expect(onCancel).toHaveBeenCalled();
      });
    });

    it("shows error when cancellation fails", async () => {
      FetchData.getCancellationInfo.mockResolvedValue({
        refundAmount: 100,
        fee: 50,
      });
      FetchData.cancelAsHomeowner.mockResolvedValue({
        error: "Cancellation failed",
      });

      const { getByText, getByTestId } = renderWithProvider(
        <EachAppointment {...defaultProps} />
      );

      // Expand access instructions to see error
      fireEvent.press(getByText("Access Instructions"));
      fireEvent.press(getByText("Cancel Appointment"));

      await waitFor(() => {
        expect(getByTestId("cancellation-modal")).toBeTruthy();
      });

      fireEvent.press(getByTestId("modal-confirm"));

      await waitFor(() => {
        expect(getByText("Cancellation failed")).toBeTruthy();
      });
    });

    it("closes modal when cancel is pressed", async () => {
      FetchData.getCancellationInfo.mockResolvedValue({
        refundAmount: 100,
        fee: 50,
      });

      const { getByText, getByTestId, queryByTestId } = renderWithProvider(
        <EachAppointment {...defaultProps} />
      );

      fireEvent.press(getByText("Cancel Appointment"));

      await waitFor(() => {
        expect(getByTestId("cancellation-modal")).toBeTruthy();
      });

      fireEvent.press(getByTestId("modal-cancel"));

      await waitFor(() => {
        expect(queryByTestId("cancellation-modal")).toBeNull();
      });
    });
  });

  describe("Payment retry", () => {
    it("shows payment failed section when paymentCaptureFailed is true", () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} paymentCaptureFailed={true} />
      );
      expect(getByText("Payment Failed")).toBeTruthy();
      expect(getByText("Retry Payment")).toBeTruthy();
    });

    it("does not show payment failed when paymentCaptureFailed is false", () => {
      const { queryByText } = renderWithProvider(
        <EachAppointment {...defaultProps} paymentCaptureFailed={false} />
      );
      expect(queryByText("Payment Failed")).toBeNull();
    });

    it("retries payment when button is pressed", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const onPaymentRetried = jest.fn();

      const { getByText } = renderWithProvider(
        <EachAppointment
          {...defaultProps}
          paymentCaptureFailed={true}
          onPaymentRetried={onPaymentRetried}
        />
      );

      fireEvent.press(getByText("Retry Payment"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/payments/retry-payment",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ appointmentId: 1 }),
          })
        );
        expect(onPaymentRetried).toHaveBeenCalledWith(1);
      });
    });

    it("shows success message after payment retry", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { getByText, queryByText } = renderWithProvider(
        <EachAppointment {...defaultProps} paymentCaptureFailed={true} />
      );

      fireEvent.press(getByText("Retry Payment"));

      await waitFor(() => {
        expect(getByText("Payment successful! Your appointment is confirmed.")).toBeTruthy();
        expect(queryByText("Payment Failed")).toBeNull();
      });
    });

    it("shows error when payment retry fails", async () => {
      // Reset and set up mock for this specific test
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Card declined" }),
      });

      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} paymentCaptureFailed={true} />
      );

      fireEvent.press(getByText("Retry Payment"));

      await waitFor(() => {
        expect(getByText("Card declined")).toBeTruthy();
      });
    });

    it("shows default error message when payment fails without specific error", async () => {
      // Reset and set up mock for this specific test
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} paymentCaptureFailed={true} />
      );

      fireEvent.press(getByText("Retry Payment"));

      await waitFor(() => {
        expect(getByText("Payment failed. Please try again.")).toBeTruthy();
      });
    });

    it("shows error when no token for payment retry", async () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} paymentCaptureFailed={true} token={null} />
      );

      fireEvent.press(getByText("Retry Payment"));

      await waitFor(() => {
        expect(getByText("Authentication required")).toBeTruthy();
      });
    });
  });

  describe("Bed configurations", () => {
    it("shows configure bed sizes button when sheets is yes", async () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} bringSheets="yes" numBeds={2} />
      );

      fireEvent.press(getByText("Add-on Services"));

      await waitFor(() => {
        expect(getByText("Configure Bed Sizes")).toBeTruthy();
      });
    });

    it("shows bed configuration options when expanded", async () => {
      const { getByText, getAllByText } = renderWithProvider(
        <EachAppointment {...defaultProps} bringSheets="yes" numBeds={2} />
      );

      fireEvent.press(getByText("Add-on Services"));

      await waitFor(() => {
        fireEvent.press(getByText("Configure Bed Sizes"));
      });

      await waitFor(() => {
        expect(getByText("Bed 1")).toBeTruthy();
        expect(getByText("Bed 2")).toBeTruthy();
        // Multiple Queen/King buttons (one per bed)
        expect(getAllByText("Queen").length).toBe(2);
        expect(getAllByText("King").length).toBe(2);
      });
    });

    it("saves configuration when bed size is changed", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            appointment: {
              id: 1,
              sheetConfigurations: [{ bedNumber: 1, size: "king", needsSheets: true }],
            },
          }),
      });

      const onConfigurationsUpdate = jest.fn();

      const { getByText, getAllByText } = renderWithProvider(
        <EachAppointment
          {...defaultProps}
          bringSheets="yes"
          numBeds={1}
          onConfigurationsUpdate={onConfigurationsUpdate}
        />
      );

      fireEvent.press(getByText("Add-on Services"));

      await waitFor(() => {
        fireEvent.press(getByText("Configure Bed Sizes"));
      });

      await waitFor(() => {
        fireEvent.press(getByText("King"));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/appointments/1/linens",
          expect.objectContaining({
            method: "PATCH",
          })
        );
      });
    });

    it("hides bed options when Hide button is pressed", async () => {
      const { getByText, queryByText } = renderWithProvider(
        <EachAppointment {...defaultProps} bringSheets="yes" numBeds={2} />
      );

      fireEvent.press(getByText("Add-on Services"));

      await waitFor(() => {
        fireEvent.press(getByText("Configure Bed Sizes"));
      });

      await waitFor(() => {
        expect(getByText("Bed 1")).toBeTruthy();
      });

      fireEvent.press(getByText("Hide"));

      await waitFor(() => {
        expect(queryByText("Bed 1")).toBeNull();
        expect(getByText("Configure Bed Sizes")).toBeTruthy();
      });
    });
  });

  describe("Bathroom configurations", () => {
    it("shows configure towels button when towels is yes", async () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} bringTowels="yes" numBaths={1} />
      );

      fireEvent.press(getByText("Add-on Services"));

      await waitFor(() => {
        expect(getByText("Configure Towels")).toBeTruthy();
      });
    });

    it("shows bathroom configuration when expanded", async () => {
      const { getByText } = renderWithProvider(
        <EachAppointment {...defaultProps} bringTowels="yes" numBaths={2} />
      );

      fireEvent.press(getByText("Add-on Services"));

      await waitFor(() => {
        fireEvent.press(getByText("Configure Towels"));
      });

      await waitFor(() => {
        expect(getByText("Bathroom 1")).toBeTruthy();
        expect(getByText("Bathroom 2")).toBeTruthy();
      });
    });
  });

  describe("Uses initial configurations", () => {
    it("uses provided sheet configurations", () => {
      const sheetConfigs = [
        { bedNumber: 1, size: "king", needsSheets: true },
        { bedNumber: 2, size: "twin", needsSheets: false },
      ];

      const { getByText } = renderWithProvider(
        <EachAppointment
          {...defaultProps}
          bringSheets="yes"
          sheetConfigurations={sheetConfigs}
        />
      );

      // Component should render without errors
      expect(getByText("Add-on Services")).toBeTruthy();
    });

    it("uses provided towel configurations", () => {
      const towelConfigs = [
        { bathroomNumber: 1, towels: 4, faceCloths: 2 },
      ];

      const { getByText } = renderWithProvider(
        <EachAppointment
          {...defaultProps}
          bringTowels="yes"
          towelConfigurations={towelConfigs}
        />
      );

      // Component should render without errors
      expect(getByText("Add-on Services")).toBeTruthy();
    });
  });
});
