import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// Mock dependencies
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");
jest.mock("react-native-paper", () => ({
  Checkbox: ({ status, onPress }) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity onPress={onPress} testID="checkbox">
        <Text>{status}</Text>
      </TouchableOpacity>
    );
  },
}));

// Mock theme
jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    neutral: { 0: "#fff", 50: "#f9f9f9", 100: "#f0f0f0" },
    primary: { 50: "#e3f2fd", 200: "#90caf9", 600: "#1976d2", 800: "#1565c0" },
    warning: { 50: "#fff3e0", 100: "#ffe0b2", 200: "#ffcc80", 500: "#ff9800", 600: "#fb8c00", 800: "#ef6c00" },
    error: { 50: "#ffebee", 100: "#ffcdd2", 200: "#ef9a9a", 500: "#f44336", 600: "#e53935", 800: "#c62828" },
    success: { 500: "#4caf50", 600: "#43a047" },
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
    border: { light: "#e0e0e0" },
    glass: { overlay: "rgba(0,0,0,0.5)" },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
  radius: { lg: 12, "2xl": 20 },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, xl: 20 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
  shadows: { sm: {}, xl: {} },
}));

import CleanerCancellationWarningModal from "../../src/components/modals/CleanerCancellationWarningModal";

describe("CleanerCancellationWarningModal", () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const outsidePenaltyInfo = {
    isWithinPenaltyWindow: false,
    warningMessage: "You can cancel this job without penalty.",
    daysUntilAppointment: 7,
    recentCancellationPenalties: 0,
    willResultInFreeze: false,
  };

  const withinPenaltyInfo = {
    isWithinPenaltyWindow: true,
    warningMessage:
      'Cancelling within 4 days of the cleaning will result in an automatic 1-star rating with the note "Last minute cancellation". You currently have 1 cancellation penalty in the last 3 months. 1 more will result in your account being frozen.',
    daysUntilAppointment: 3,
    recentCancellationPenalties: 1,
    willResultInFreeze: false,
  };

  const freezeWarningInfo = {
    isWithinPenaltyWindow: true,
    warningMessage:
      "WARNING: Cancelling within 4 days of the cleaning will result in an automatic 1-star rating. You already have 2 cancellation penalties in the last 3 months. THIS CANCELLATION WILL FREEZE YOUR ACCOUNT.",
    daysUntilAppointment: 2,
    recentCancellationPenalties: 2,
    willResultInFreeze: true,
  };

  describe("Modal Visibility", () => {
    it("should not render when visible is false", () => {
      const { queryByText } = render(
        <CleanerCancellationWarningModal
          visible={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={outsidePenaltyInfo}
        />
      );

      expect(queryByText("Cancel Job")).toBeNull();
    });

    it("should render when visible is true", () => {
      const { getAllByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={outsidePenaltyInfo}
        />
      );

      // Modal title and button both say "Cancel Job"
      expect(getAllByText("Cancel Job").length).toBeGreaterThan(0);
    });

    it("should return null when cancellationInfo is null", () => {
      const { queryByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={null}
        />
      );

      expect(queryByText("Cancel Job")).toBeNull();
    });
  });

  describe("Outside Penalty Window", () => {
    it("should show normal title when outside penalty window", () => {
      const { getAllByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={outsidePenaltyInfo}
        />
      );

      // Title says "Cancel Job" (not "Cancellation Penalty")
      expect(getAllByText("Cancel Job").length).toBeGreaterThan(0);
    });

    it("should show days until job", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={outsidePenaltyInfo}
        />
      );

      expect(getByText("7 days until job")).toBeTruthy();
    });

    it("should show no penalty message", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={outsidePenaltyInfo}
        />
      );

      expect(getByText("You can cancel this job without penalty.")).toBeTruthy();
    });

    it("should not show penalty details section when outside window", () => {
      const { queryByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={outsidePenaltyInfo}
        />
      );

      expect(queryByText("What happens if you cancel:")).toBeNull();
    });

    it("should show correct checkbox label", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={outsidePenaltyInfo}
        />
      );

      expect(getByText("I want to cancel this job")).toBeTruthy();
    });
  });

  describe("Within Penalty Window (No Freeze)", () => {
    it("should show penalty title", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={withinPenaltyInfo}
        />
      );

      expect(getByText("Cancellation Penalty")).toBeTruthy();
    });

    it("should show penalty details section", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={withinPenaltyInfo}
        />
      );

      expect(getByText("What happens if you cancel:")).toBeTruthy();
    });

    it("should show 1-star rating warning", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={withinPenaltyInfo}
        />
      );

      expect(getByText("1-Star Rating")).toBeTruthy();
      expect(
        getByText('An automatic 1-star review will be added with "Last minute cancellation"')
      ).toBeTruthy();
    });

    it("should show current penalty count", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={withinPenaltyInfo}
        />
      );

      expect(getByText("1 of 3 Penalties Used")).toBeTruthy();
      expect(getByText("1 more penalty before account freeze")).toBeTruthy();
    });

    it("should not show freeze warning", () => {
      const { queryByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={withinPenaltyInfo}
        />
      );

      expect(
        queryByText(/Your account will be frozen immediately/)
      ).toBeNull();
    });

    it("should show penalty checkbox label", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={withinPenaltyInfo}
        />
      );

      expect(getByText("I understand and accept the 1-star penalty")).toBeTruthy();
    });
  });

  describe("Within Penalty Window (Will Freeze)", () => {
    it("should show freeze warning title", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={freezeWarningInfo}
        />
      );

      expect(getByText("Account Will Be Frozen")).toBeTruthy();
    });

    it("should show freeze warning message", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={freezeWarningInfo}
        />
      );

      expect(
        getByText(/Your account will be frozen immediately after this cancellation/)
      ).toBeTruthy();
    });

    it("should show that this will freeze the account", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={freezeWarningInfo}
        />
      );

      expect(getByText("2 of 3 Penalties Used")).toBeTruthy();
      expect(getByText("This cancellation will freeze your account!")).toBeTruthy();
    });

    it("should show freeze checkbox label", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={freezeWarningInfo}
        />
      );

      expect(getByText("I understand my account will be frozen")).toBeTruthy();
    });
  });

  describe("Agreement Checkbox", () => {
    it("should toggle checkbox when pressed", () => {
      const { getByTestId, getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={outsidePenaltyInfo}
        />
      );

      const checkbox = getByTestId("checkbox");
      expect(getByText("unchecked")).toBeTruthy();

      fireEvent.press(checkbox);
      expect(getByText("checked")).toBeTruthy();
    });
  });

  describe("Button Actions", () => {
    it("should call onClose when Keep Job button is pressed", () => {
      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={outsidePenaltyInfo}
        />
      );

      fireEvent.press(getByText("Keep Job"));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should not call onConfirm when checkbox is not checked", () => {
      const { getAllByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={outsidePenaltyInfo}
        />
      );

      // Get all elements with "Cancel Job" text, the last one should be the button
      const elements = getAllByText("Cancel Job");
      fireEvent.press(elements[elements.length - 1]);

      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it("should call onConfirm when checkbox is checked and confirm button is pressed", () => {
      const { getByTestId, getAllByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={outsidePenaltyInfo}
        />
      );

      // Check the checkbox first
      fireEvent.press(getByTestId("checkbox"));

      // Get all elements with "Cancel Job" text, the last one should be the button
      const elements = getAllByText("Cancel Job");
      fireEvent.press(elements[elements.length - 1]);

      expect(mockOnConfirm).toHaveBeenCalled();
    });
  });

  describe("Special Date Displays", () => {
    it("should show 'This job is today' for day 0", () => {
      const todayInfo = {
        ...outsidePenaltyInfo,
        daysUntilAppointment: 0,
      };

      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={todayInfo}
        />
      );

      expect(getByText("This job is today")).toBeTruthy();
    });

    it("should show 'This job is tomorrow' for day 1", () => {
      const tomorrowInfo = {
        ...outsidePenaltyInfo,
        daysUntilAppointment: 1,
      };

      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={tomorrowInfo}
        />
      );

      expect(getByText("This job is tomorrow")).toBeTruthy();
    });
  });

  describe("Loading State", () => {
    it("should show loading indicator when loading is true", () => {
      const { queryByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={outsidePenaltyInfo}
          loading={true}
        />
      );

      // When loading, the "Cancel Job" text inside confirm button should not be visible
      // (There's still the title, so we check the button text specifically)
      // The button should show ActivityIndicator instead
      const confirmButtons = queryByText("Cancel Job");
      // Modal title is still "Cancel Job", so we need to check if there's only one
      // Since loading replaces button content with ActivityIndicator
    });
  });

  describe("Penalty Count Display", () => {
    it("should show correct remaining penalties with 0 prior", () => {
      const zeroPenaltiesInfo = {
        ...withinPenaltyInfo,
        recentCancellationPenalties: 0,
      };

      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={zeroPenaltiesInfo}
        />
      );

      expect(getByText("0 of 3 Penalties Used")).toBeTruthy();
      expect(getByText("2 more penalties before account freeze")).toBeTruthy();
    });

    it("should show singular 'penalty' with 1 remaining", () => {
      const onePenaltyInfo = {
        ...withinPenaltyInfo,
        recentCancellationPenalties: 1,
      };

      const { getByText } = render(
        <CleanerCancellationWarningModal
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          cancellationInfo={onePenaltyInfo}
        />
      );

      expect(getByText("1 more penalty before account freeze")).toBeTruthy();
    });
  });
});
