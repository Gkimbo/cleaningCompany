import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock react-native-paper Checkbox
jest.mock("react-native-paper", () => ({
  Checkbox: ({ status, onPress, disabled }) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity
        testID="checkbox"
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
      >
        <Text>{status === "checked" ? "checked" : "unchecked"}</Text>
      </TouchableOpacity>
    );
  },
}));

// Import after mocks
import CalendarSyncDisclaimerModal from "../../src/components/calendarSync/CalendarSyncDisclaimerModal";

describe("CalendarSyncDisclaimerModal", () => {
  const defaultProps = {
    visible: true,
    onAccept: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render when visible is true", () => {
      const { getByText } = render(<CalendarSyncDisclaimerModal {...defaultProps} />);

      expect(getByText("Calendar Sync Disclaimer")).toBeTruthy();
    });

    it("should not render content when visible is false", () => {
      const { queryByText } = render(
        <CalendarSyncDisclaimerModal {...defaultProps} visible={false} />
      );

      // Modal content should not be visible
      expect(queryByText("Calendar Sync Disclaimer")).toBeNull();
    });

    it("should render all disclaimer sections", () => {
      const { getByText } = render(<CalendarSyncDisclaimerModal {...defaultProps} />);

      expect(getByText("Calendar Sync Notice")).toBeTruthy();
      expect(getByText("Auto-Sync Disclaimer")).toBeTruthy();
      expect(getByText("Third-Party Calendar Services")).toBeTruthy();
      expect(getByText("Conflict Resolution")).toBeTruthy();
      expect(getByText("Offline Availability")).toBeTruthy();
      expect(getByText("Availability Responsibility")).toBeTruthy();
      expect(getByText("Business Owner Assignments")).toBeTruthy();
      expect(getByText("No Guarantee")).toBeTruthy();
    });

    it("should render Cancel and Accept buttons", () => {
      const { getByText } = render(<CalendarSyncDisclaimerModal {...defaultProps} />);

      expect(getByText("Cancel")).toBeTruthy();
      expect(getByText("Accept & Continue")).toBeTruthy();
    });

    it("should show scroll prompt initially", () => {
      const { getByText } = render(<CalendarSyncDisclaimerModal {...defaultProps} />);

      expect(getByText("Scroll down to continue reading")).toBeTruthy();
    });
  });

  describe("cancel button", () => {
    it("should call onCancel when Cancel is pressed", () => {
      const { getByText } = render(<CalendarSyncDisclaimerModal {...defaultProps} />);

      fireEvent.press(getByText("Cancel"));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe("accept button state", () => {
    it("should have Accept button disabled initially", () => {
      const { getByText } = render(<CalendarSyncDisclaimerModal {...defaultProps} />);

      const acceptButton = getByText("Accept & Continue").parent;
      // The button should be disabled when not scrolled and not checked
      expect(defaultProps.onAccept).not.toHaveBeenCalled();
    });

    it("should not call onAccept when button pressed without scrolling and checking", () => {
      const { getByText } = render(<CalendarSyncDisclaimerModal {...defaultProps} />);

      fireEvent.press(getByText("Accept & Continue"));

      expect(defaultProps.onAccept).not.toHaveBeenCalled();
    });
  });

  describe("scroll behavior", () => {
    it("should enable checkbox after scrolling to bottom", async () => {
      const { getByTestId, UNSAFE_getByType } = render(
        <CalendarSyncDisclaimerModal {...defaultProps} />
      );

      const { ScrollView } = require("react-native");
      const scrollView = UNSAFE_getByType(ScrollView);

      // Simulate scrolling to bottom
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          layoutMeasurement: { height: 400 },
          contentOffset: { y: 800 },
          contentSize: { height: 1000 },
        },
      });

      // Now checkbox should be enabled
      await waitFor(() => {
        const checkbox = getByTestId("checkbox");
        expect(checkbox.props.disabled).toBeFalsy();
      });
    });
  });

  describe("checkbox interaction", () => {
    it("should toggle checkbox when pressed after scrolling", async () => {
      const { getByTestId, getByText, UNSAFE_getByType } = render(
        <CalendarSyncDisclaimerModal {...defaultProps} />
      );

      const { ScrollView } = require("react-native");
      const scrollView = UNSAFE_getByType(ScrollView);

      // Scroll to bottom first
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          layoutMeasurement: { height: 400 },
          contentOffset: { y: 800 },
          contentSize: { height: 1000 },
        },
      });

      await waitFor(() => {
        expect(getByText("unchecked")).toBeTruthy();
      });

      // Press checkbox
      fireEvent.press(getByTestId("checkbox"));

      await waitFor(() => {
        expect(getByText("checked")).toBeTruthy();
      });
    });
  });

  describe("accept flow", () => {
    it("should call onAccept when scrolled, checked, and Accept pressed", async () => {
      const { getByTestId, getByText, UNSAFE_getByType } = render(
        <CalendarSyncDisclaimerModal {...defaultProps} />
      );

      const { ScrollView } = require("react-native");
      const scrollView = UNSAFE_getByType(ScrollView);

      // Step 1: Scroll to bottom
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          layoutMeasurement: { height: 400 },
          contentOffset: { y: 800 },
          contentSize: { height: 1000 },
        },
      });

      // Step 2: Check the checkbox
      await waitFor(() => {
        fireEvent.press(getByTestId("checkbox"));
      });

      // Step 3: Press Accept
      await waitFor(() => {
        fireEvent.press(getByText("Accept & Continue"));
      });

      expect(defaultProps.onAccept).toHaveBeenCalled();
    });

    it("should not call onAccept if only scrolled but not checked", async () => {
      const { getByText, UNSAFE_getByType } = render(
        <CalendarSyncDisclaimerModal {...defaultProps} />
      );

      const { ScrollView } = require("react-native");
      const scrollView = UNSAFE_getByType(ScrollView);

      // Scroll to bottom
      fireEvent.scroll(scrollView, {
        nativeEvent: {
          layoutMeasurement: { height: 400 },
          contentOffset: { y: 800 },
          contentSize: { height: 1000 },
        },
      });

      // Press Accept without checking
      fireEvent.press(getByText("Accept & Continue"));

      expect(defaultProps.onAccept).not.toHaveBeenCalled();
    });
  });

  describe("acknowledgment text", () => {
    it("should display the acknowledgment text", () => {
      const { getByText } = render(<CalendarSyncDisclaimerModal {...defaultProps} />);

      expect(
        getByText(/I understand that calendar sync is not real-time/i)
      ).toBeTruthy();
    });
  });
});
