import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import SuspiciousContentBanner from "../SuspiciousContentBanner";
import MessageService from "../../../services/fetchRequests/MessageClass";

// Mock MessageService
jest.mock("../../../services/fetchRequests/MessageClass", () => ({
  reportSuspiciousActivity: jest.fn(),
}));

// Mock Alert
jest.spyOn(Alert, "alert");

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/Feather", () => "Icon");

describe("SuspiciousContentBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Warning Text Display", () => {
    it("should display off-platform warning for off_platform type", () => {
      const { getByText } = render(
        <SuspiciousContentBanner suspiciousContentTypes={["off_platform"]} />
      );

      expect(
        getByText(/attempt to communicate or transact off the app/i)
      ).toBeTruthy();
    });

    it("should display contact information warning for phone_number type", () => {
      const { getByText } = render(
        <SuspiciousContentBanner suspiciousContentTypes={["phone_number"]} />
      );

      expect(getByText(/contact information/i)).toBeTruthy();
    });

    it("should display contact information warning for email type", () => {
      const { getByText } = render(
        <SuspiciousContentBanner suspiciousContentTypes={["email"]} />
      );

      expect(getByText(/contact information/i)).toBeTruthy();
    });

    it("should display generic suspicious content warning when no types", () => {
      const { getByText } = render(
        <SuspiciousContentBanner suspiciousContentTypes={[]} />
      );

      expect(getByText(/may contain suspicious content/i)).toBeTruthy();
    });

    it("should prioritize off_platform warning over contact info", () => {
      const { getByText, queryByText } = render(
        <SuspiciousContentBanner
          suspiciousContentTypes={["phone_number", "off_platform"]}
        />
      );

      expect(
        getByText(/attempt to communicate or transact off the app/i)
      ).toBeTruthy();
    });
  });

  describe("Report Button", () => {
    it("should show Report button when messageId and token are provided", () => {
      const { getByText } = render(
        <SuspiciousContentBanner
          suspiciousContentTypes={["phone_number"]}
          messageId={1}
          token="test-token"
        />
      );

      expect(getByText("Report this activity")).toBeTruthy();
    });

    it("should NOT show Report button when messageId is missing", () => {
      const { queryByText } = render(
        <SuspiciousContentBanner
          suspiciousContentTypes={["phone_number"]}
          token="test-token"
        />
      );

      expect(queryByText("Report this activity")).toBeNull();
    });

    it("should NOT show Report button when token is missing", () => {
      const { queryByText } = render(
        <SuspiciousContentBanner
          suspiciousContentTypes={["phone_number"]}
          messageId={1}
        />
      );

      expect(queryByText("Report this activity")).toBeNull();
    });

    it("should show confirmation alert when Report button is pressed", () => {
      const { getByText } = render(
        <SuspiciousContentBanner
          suspiciousContentTypes={["phone_number"]}
          messageId={1}
          token="test-token"
        />
      );

      fireEvent.press(getByText("Report this activity"));

      expect(Alert.alert).toHaveBeenCalledWith(
        "Report Suspicious Activity",
        expect.stringContaining("Are you sure"),
        expect.arrayContaining([
          expect.objectContaining({ text: "Cancel" }),
          expect.objectContaining({ text: "Report" }),
        ])
      );
    });

    it("should call MessageService.reportSuspiciousActivity on confirm", async () => {
      MessageService.reportSuspiciousActivity.mockResolvedValue({
        success: true,
      });

      const { getByText } = render(
        <SuspiciousContentBanner
          suspiciousContentTypes={["phone_number"]}
          messageId={1}
          token="test-token"
        />
      );

      fireEvent.press(getByText("Report this activity"));

      // Get the onPress handler for "Report" button from Alert.alert call
      const alertCall = Alert.alert.mock.calls[0];
      const reportButton = alertCall[2].find((btn) => btn.text === "Report");

      // Trigger the report
      await reportButton.onPress();

      expect(MessageService.reportSuspiciousActivity).toHaveBeenCalledWith(
        1,
        "test-token"
      );
    });

    it("should show success alert after successful report", async () => {
      MessageService.reportSuspiciousActivity.mockResolvedValue({
        success: true,
      });

      const { getByText } = render(
        <SuspiciousContentBanner
          suspiciousContentTypes={["phone_number"]}
          messageId={1}
          token="test-token"
        />
      );

      fireEvent.press(getByText("Report this activity"));

      const alertCall = Alert.alert.mock.calls[0];
      const reportButton = alertCall[2].find((btn) => btn.text === "Report");
      await reportButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Report Submitted",
          expect.stringContaining("Thank you for reporting"),
          expect.anything()
        );
      });
    });

    it("should show already reported indicator after report", async () => {
      MessageService.reportSuspiciousActivity.mockResolvedValue({
        success: true,
      });

      const { getByText, queryByText } = render(
        <SuspiciousContentBanner
          suspiciousContentTypes={["phone_number"]}
          messageId={1}
          token="test-token"
        />
      );

      fireEvent.press(getByText("Report this activity"));

      const alertCall = Alert.alert.mock.calls[0];
      const reportButton = alertCall[2].find((btn) => btn.text === "Report");
      await reportButton.onPress();

      await waitFor(() => {
        expect(getByText("Reported to our team")).toBeTruthy();
        expect(queryByText("Report this activity")).toBeNull();
      });
    });

    it("should handle already reported response", async () => {
      MessageService.reportSuspiciousActivity.mockResolvedValue({
        alreadyReported: true,
        message: "Already reported",
      });

      const { getByText } = render(
        <SuspiciousContentBanner
          suspiciousContentTypes={["phone_number"]}
          messageId={1}
          token="test-token"
        />
      );

      fireEvent.press(getByText("Report this activity"));

      const alertCall = Alert.alert.mock.calls[0];
      const reportButton = alertCall[2].find((btn) => btn.text === "Report");
      await reportButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Already Reported",
          expect.stringContaining("already reported")
        );
      });
    });

    it("should show error alert on failure", async () => {
      MessageService.reportSuspiciousActivity.mockResolvedValue({
        error: "Something went wrong",
      });

      const { getByText } = render(
        <SuspiciousContentBanner
          suspiciousContentTypes={["phone_number"]}
          messageId={1}
          token="test-token"
        />
      );

      fireEvent.press(getByText("Report this activity"));

      const alertCall = Alert.alert.mock.calls[0];
      const reportButton = alertCall[2].find((btn) => btn.text === "Report");
      await reportButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Error",
          "Something went wrong"
        );
      });
    });

    it("should call onReported callback after successful report", async () => {
      MessageService.reportSuspiciousActivity.mockResolvedValue({
        success: true,
      });
      const onReported = jest.fn();

      const { getByText } = render(
        <SuspiciousContentBanner
          suspiciousContentTypes={["phone_number"]}
          messageId={1}
          token="test-token"
          onReported={onReported}
        />
      );

      fireEvent.press(getByText("Report this activity"));

      const alertCall = Alert.alert.mock.calls[0];
      const reportButton = alertCall[2].find((btn) => btn.text === "Report");
      await reportButton.onPress();

      await waitFor(() => {
        expect(onReported).toHaveBeenCalledWith(1);
      });
    });
  });

  describe("Caution Header", () => {
    it("should display Caution title", () => {
      const { getByText } = render(
        <SuspiciousContentBanner suspiciousContentTypes={["phone_number"]} />
      );

      expect(getByText("Caution")).toBeTruthy();
    });

    it("should display protection advice", () => {
      const { getByText } = render(
        <SuspiciousContentBanner suspiciousContentTypes={["phone_number"]} />
      );

      expect(
        getByText(/Keep all communication and payments on the platform/i)
      ).toBeTruthy();
    });
  });
});
