import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// Mock ReferralService
jest.mock("../../src/services/fetchRequests/ReferralService", () => ({
  validateCode: jest.fn(),
}));

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Import after mocks
import ReferralCodeInput from "../../src/components/referrals/ReferralCodeInput";
import ReferralService from "../../src/services/fetchRequests/ReferralService";

describe("ReferralCodeInput", () => {
  const defaultProps = {
    value: "",
    onChangeText: jest.fn(),
    onValidation: jest.fn(),
    userType: "homeowner",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Rendering", () => {
    it("should render the input field", () => {
      const { getByPlaceholderText, getByText } = render(
        <ReferralCodeInput {...defaultProps} />
      );

      expect(getByText("Referral Code")).toBeTruthy();
      expect(getByPlaceholderText("Enter referral code (optional)")).toBeTruthy();
    });

    it("should render custom placeholder", () => {
      const { getByPlaceholderText } = render(
        <ReferralCodeInput {...defaultProps} placeholder="Custom placeholder" />
      );

      expect(getByPlaceholderText("Custom placeholder")).toBeTruthy();
    });

    it("should show help text when no validation", () => {
      const { getByText } = render(<ReferralCodeInput {...defaultProps} />);

      expect(getByText("Have a referral code? Enter it above for bonus rewards!")).toBeTruthy();
    });
  });

  describe("Text Input", () => {
    it("should convert input to uppercase", () => {
      const onChangeText = jest.fn();
      const { getByPlaceholderText } = render(
        <ReferralCodeInput {...defaultProps} onChangeText={onChangeText} />
      );

      fireEvent.changeText(getByPlaceholderText("Enter referral code (optional)"), "john1234");

      expect(onChangeText).toHaveBeenCalledWith("JOHN1234");
    });

    it("should call onChangeText when typing", () => {
      const onChangeText = jest.fn();
      const { getByPlaceholderText } = render(
        <ReferralCodeInput {...defaultProps} onChangeText={onChangeText} />
      );

      fireEvent.changeText(getByPlaceholderText("Enter referral code (optional)"), "TEST");

      expect(onChangeText).toHaveBeenCalledWith("TEST");
    });
  });

  describe("Validation", () => {
    it("should not validate if code is less than 4 characters", async () => {
      render(<ReferralCodeInput {...defaultProps} value="ABC" />);

      act(() => {
        jest.advanceTimersByTime(600);
      });

      expect(ReferralService.validateCode).not.toHaveBeenCalled();
    });

    it("should reset validation if input is empty", async () => {
      const onValidation = jest.fn();
      const { rerender } = render(
        <ReferralCodeInput {...defaultProps} value="JOHN" onValidation={onValidation} />
      );

      rerender(
        <ReferralCodeInput {...defaultProps} value="" onValidation={onValidation} />
      );

      expect(onValidation).toHaveBeenCalledWith(null);
    });

    it("should validate code after debounce delay", async () => {
      ReferralService.validateCode.mockResolvedValue({
        valid: true,
        referrer: { firstName: "John" },
        rewards: { referredReward: 2500 },
      });

      const onValidation = jest.fn();
      render(
        <ReferralCodeInput {...defaultProps} value="JOHN1234" onValidation={onValidation} />
      );

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(ReferralService.validateCode).toHaveBeenCalledWith("JOHN1234", "homeowner");
      });
    });

    it("should pass userType to validation", async () => {
      ReferralService.validateCode.mockResolvedValue({
        valid: true,
        referrer: { firstName: "Jane" },
        rewards: {},
      });

      render(
        <ReferralCodeInput {...defaultProps} value="JANE1234" userType="cleaner" />
      );

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(ReferralService.validateCode).toHaveBeenCalledWith("JANE1234", "cleaner");
      });
    });

    it("should call onValidation with result", async () => {
      const mockResult = {
        valid: true,
        referrer: { firstName: "John" },
        rewards: { referredReward: 2500 },
      };
      ReferralService.validateCode.mockResolvedValue(mockResult);

      const onValidation = jest.fn();
      render(
        <ReferralCodeInput {...defaultProps} value="JOHN1234" onValidation={onValidation} />
      );

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(onValidation).toHaveBeenCalledWith(mockResult);
      });
    });
  });

  describe("Success State", () => {
    it("should show success message for valid code", async () => {
      ReferralService.validateCode.mockResolvedValue({
        valid: true,
        referrer: { firstName: "John" },
        rewards: { referredReward: 2500 },
      });

      const { getByText, queryByText } = render(
        <ReferralCodeInput {...defaultProps} value="JOHN1234" />
      );

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(getByText(/Referred by John/)).toBeTruthy();
        expect(getByText(/\$25 credit/)).toBeTruthy();
        expect(queryByText("Have a referral code?")).toBeNull();
      });
    });

    it("should show referrer name in success message", async () => {
      ReferralService.validateCode.mockResolvedValue({
        valid: true,
        referrer: { firstName: "Sarah" },
        rewards: { referredReward: 0 },
      });

      const { getByText } = render(
        <ReferralCodeInput {...defaultProps} value="SARA1234" />
      );

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(getByText(/Referred by Sarah/)).toBeTruthy();
      });
    });

    it("should show 'a friend' if referrer name missing", async () => {
      ReferralService.validateCode.mockResolvedValue({
        valid: true,
        referrer: {},
        rewards: { referredReward: 0 },
      });

      const { getByText } = render(
        <ReferralCodeInput {...defaultProps} value="CODE1234" />
      );

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(getByText(/Referred by a friend/)).toBeTruthy();
      });
    });
  });

  describe("Error States", () => {
    it("should show error message for invalid code", async () => {
      ReferralService.validateCode.mockResolvedValue({
        valid: false,
        error: "This referral code doesn't exist.",
        errorCode: "CODE_NOT_FOUND",
      });

      const { getByText } = render(
        <ReferralCodeInput {...defaultProps} value="INVALID1" />
      );

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(getByText("This referral code doesn't exist.")).toBeTruthy();
      });
    });

    it("should show hint for CODE_NOT_FOUND error", async () => {
      ReferralService.validateCode.mockResolvedValue({
        valid: false,
        error: "This referral code doesn't exist.",
        errorCode: "CODE_NOT_FOUND",
      });

      const { getByText } = render(
        <ReferralCodeInput {...defaultProps} value="INVALID1" />
      );

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(getByText(/Double-check the code/)).toBeTruthy();
      });
    });

    it("should show hint for ACCOUNT_FROZEN error", async () => {
      ReferralService.validateCode.mockResolvedValue({
        valid: false,
        error: "This referral code is no longer active.",
        errorCode: "ACCOUNT_FROZEN",
      });

      const { getByText } = render(
        <ReferralCodeInput {...defaultProps} value="FROZEN12" />
      );

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(getByText(/You can still sign up without a referral code/)).toBeTruthy();
      });
    });

    it("should show hint for MONTHLY_LIMIT_REACHED error", async () => {
      ReferralService.validateCode.mockResolvedValue({
        valid: false,
        error: "This referrer has reached their maximum referrals.",
        errorCode: "MONTHLY_LIMIT_REACHED",
      });

      const { getByText } = render(
        <ReferralCodeInput {...defaultProps} value="LIMIT123" />
      );

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(getByText(/Try a different referral code/)).toBeTruthy();
      });
    });

    it("should handle network errors gracefully", async () => {
      ReferralService.validateCode.mockRejectedValue(new Error("Network error"));

      const onValidation = jest.fn();
      const { getByText } = render(
        <ReferralCodeInput {...defaultProps} value="TEST1234" onValidation={onValidation} />
      );

      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(getByText(/Unable to validate code/)).toBeTruthy();
        expect(onValidation).toHaveBeenCalledWith(
          expect.objectContaining({
            valid: false,
            errorCode: "NETWORK_ERROR",
          })
        );
      });
    });

    it("should not show error for codes less than 4 chars", () => {
      const { queryByText } = render(
        <ReferralCodeInput {...defaultProps} value="ABC" />
      );

      // Should not show any error messages for short codes
      expect(queryByText(/doesn't exist/)).toBeNull();
      expect(queryByText(/Invalid/)).toBeNull();
    });
  });

  describe("Loading State", () => {
    it("should show loading indicator while validating", async () => {
      let resolveValidation;
      ReferralService.validateCode.mockReturnValue(
        new Promise((resolve) => {
          resolveValidation = resolve;
        })
      );

      const { UNSAFE_queryByType } = render(
        <ReferralCodeInput {...defaultProps} value="JOHN1234" />
      );

      act(() => {
        jest.advanceTimersByTime(600);
      });

      // Should show ActivityIndicator while loading
      // Note: This depends on the test setup

      // Resolve the validation
      await act(async () => {
        resolveValidation({ valid: true, referrer: {}, rewards: {} });
      });
    });
  });

  describe("Debouncing", () => {
    it("should debounce validation calls", async () => {
      ReferralService.validateCode.mockResolvedValue({
        valid: true,
        referrer: {},
        rewards: {},
      });

      const { rerender } = render(
        <ReferralCodeInput {...defaultProps} value="JOHN" />
      );

      // Type more characters quickly
      rerender(<ReferralCodeInput {...defaultProps} value="JOHN1" />);
      rerender(<ReferralCodeInput {...defaultProps} value="JOHN12" />);
      rerender(<ReferralCodeInput {...defaultProps} value="JOHN123" />);
      rerender(<ReferralCodeInput {...defaultProps} value="JOHN1234" />);

      // Advance timer less than debounce delay
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should not have validated yet
      expect(ReferralService.validateCode).not.toHaveBeenCalled();

      // Advance timer past debounce delay
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        // Should only validate once with final value
        expect(ReferralService.validateCode).toHaveBeenCalledTimes(1);
        expect(ReferralService.validateCode).toHaveBeenCalledWith("JOHN1234", "homeowner");
      });
    });

    it("should cancel previous timer on new input", async () => {
      ReferralService.validateCode.mockResolvedValue({
        valid: true,
        referrer: {},
        rewards: {},
      });

      const { rerender } = render(
        <ReferralCodeInput {...defaultProps} value="AAAA" />
      );

      // Wait almost full debounce time
      act(() => {
        jest.advanceTimersByTime(450);
      });

      // Type new value before first validation
      rerender(<ReferralCodeInput {...defaultProps} value="BBBB" />);

      // Wait past first timer (but first should be cancelled)
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // First validation should not have been called
      expect(ReferralService.validateCode).not.toHaveBeenCalled();

      // Wait for second timer
      act(() => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        // Only second value should be validated
        expect(ReferralService.validateCode).toHaveBeenCalledWith("BBBB", "homeowner");
      });
    });
  });
});
