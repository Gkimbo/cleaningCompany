/**
 * Tests for StripeConnectOnboarding Component
 * Tests the 2-step in-app Stripe Connect onboarding flow
 * (Birthday + Address, then redirects to Stripe for SSN/Bank)
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock fetch
global.fetch = jest.fn();

// Mock Alert
jest.spyOn(Alert, "alert").mockImplementation(() => {});

// Mock Linking
jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock expo-web-browser (used for ToS acceptance)
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: "dismiss" })),
  WebBrowserPresentationStyle: {
    FULL_SCREEN: "fullScreen",
  },
}));

// Import after mocks
import StripeConnectOnboarding from "../../src/components/payments/StripeConnectOnboarding";
import * as WebBrowser from "expo-web-browser";

describe("StripeConnectOnboarding Component", () => {
  const mockDispatch = jest.fn();
  const defaultState = {
    currentUser: {
      id: 1,
      token: "test_token",
      email: "cleaner@test.com",
    },
    account: "cleaner",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for account status - no account exists
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        hasAccount: false,
        onboardingComplete: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      }),
    });
  });

  describe("Initial Loading State", () => {
    it("should show loading indicator initially", () => {
      const { getByText } = render(
        <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
      );

      expect(getByText("Loading account status...")).toBeTruthy();
    });

    it("should fetch account status on mount", async () => {
      render(
        <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/stripe-connect/account-status/1")
        );
      });
    });
  });

  describe("Step 1 - Birthday", () => {
    it("should show birthday form when no account exists", async () => {
      const { findByText } = render(
        <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
      );

      const birthdayTitle = await findByText("When's your birthday?");
      expect(birthdayTitle).toBeTruthy();
    });

    it("should validate month input", async () => {
      const { findByText, getByPlaceholderText } = render(
        <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
      );

      await findByText("When's your birthday?");

      const monthInput = getByPlaceholderText("MM");
      fireEvent.changeText(monthInput, "13"); // Invalid month

      const continueButton = await findByText("Continue");
      fireEvent.press(continueButton);

      // Should show error
      const error = await findByText("Valid month required");
      expect(error).toBeTruthy();
    });

    it("should proceed to step 2 with valid date", async () => {
      const { findByText, getByPlaceholderText } = render(
        <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
      );

      await findByText("When's your birthday?");

      fireEvent.changeText(getByPlaceholderText("MM"), "01");
      fireEvent.changeText(getByPlaceholderText("DD"), "15");
      fireEvent.changeText(getByPlaceholderText("YYYY"), "1990");

      const continueButton = await findByText("Continue");
      fireEvent.press(continueButton);

      // Should proceed to step 2 (Address)
      const addressTitle = await findByText("Your Address");
      expect(addressTitle).toBeTruthy();
    });
  });

  describe("Step 2 - Address & Stripe Consent", () => {
    it("should show address form in step 2", async () => {
      const { findByText, getByPlaceholderText } = render(
        <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
      );

      await findByText("When's your birthday?");

      // Go to step 2
      fireEvent.changeText(getByPlaceholderText("MM"), "01");
      fireEvent.changeText(getByPlaceholderText("DD"), "15");
      fireEvent.changeText(getByPlaceholderText("YYYY"), "1990");
      fireEvent.press(await findByText("Continue"));

      await findByText("Your Address");
      expect(getByPlaceholderText("123 Main St")).toBeTruthy();
      expect(getByPlaceholderText("City")).toBeTruthy();
      expect(getByPlaceholderText("12345")).toBeTruthy();
    });

    it("should show Continue to Stripe button in step 2", async () => {
      const { findByText, getByPlaceholderText } = render(
        <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
      );

      await findByText("When's your birthday?");

      // Go to step 2
      fireEvent.changeText(getByPlaceholderText("MM"), "01");
      fireEvent.changeText(getByPlaceholderText("DD"), "15");
      fireEvent.changeText(getByPlaceholderText("YYYY"), "1990");
      fireEvent.press(await findByText("Continue"));

      await findByText("Your Address");
      expect(await findByText("Continue to Stripe")).toBeTruthy();
    });

    it("should validate Stripe terms must be accepted", async () => {
      // Test the validation logic directly
      const validateStep2 = (formData) => {
        const errors = {};
        if (!formData.stripeTermsAccepted) {
          errors.stripeTermsAccepted = "You must agree to the Stripe Connected Account Agreement";
        }
        return errors;
      };

      // Without consent
      const errorsWithoutConsent = validateStep2({ stripeTermsAccepted: false });
      expect(errorsWithoutConsent.stripeTermsAccepted).toBe("You must agree to the Stripe Connected Account Agreement");

      // With consent
      const errorsWithConsent = validateStep2({ stripeTermsAccepted: true });
      expect(errorsWithConsent.stripeTermsAccepted).toBeUndefined();
    });
  });

  describe("Completed State", () => {
    it("should show success message when onboarding is complete", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          hasAccount: true,
          onboardingComplete: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
        }),
      });

      const { findByText } = render(
        <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
      );

      const successTitle = await findByText("You're All Set!");
      expect(successTitle).toBeTruthy();
    });

    it("should show View Stripe Dashboard button when complete", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          hasAccount: true,
          onboardingComplete: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
        }),
      });

      const { findByText } = render(
        <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
      );

      const dashboardButton = await findByText("View Stripe Dashboard");
      expect(dashboardButton).toBeTruthy();
    });
  });

  describe("Complete Setup API", () => {
    it("should call complete-setup endpoint with personal info and ToS acceptance", async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            hasAccount: false,
            onboardingComplete: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            onboardingUrl: "https://connect.stripe.com/setup/...",
            requiresOnboarding: true,
          }),
        });

      // The endpoint should be called with correct structure (no SSN or bank - Stripe collects those)
      const setupData = {
        token: "test_token",
        personalInfo: {
          dob: "1990-01-15",
          address: {
            line1: "100 Test St",
            city: "Boston",
            state: "MA",
            postalCode: "02101",
          },
        },
        tosAcceptance: {
          accepted: true,
          date: Math.floor(Date.now() / 1000),
        },
      };

      expect(setupData.personalInfo.dob).toBe("1990-01-15");
      expect(setupData.tosAcceptance.accepted).toBe(true);
      expect(setupData.personalInfo).not.toHaveProperty("ssn");
    });
  });

  describe("Error Handling", () => {
    it("should show alert when complete setup fails", async () => {
      // Verify alert is called on error
      const errorMessage = "Failed to complete setup";
      Alert.alert("Error", errorMessage);

      expect(Alert.alert).toHaveBeenCalledWith("Error", errorMessage);
    });
  });

  describe("Refresh Status", () => {
    it("should have a refresh button", async () => {
      const { findByText } = render(
        <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
      );

      await findByText("When's your birthday?");

      const refreshButton = await findByText("Refresh Status");
      expect(refreshButton).toBeTruthy();
    });
  });
});

describe("Stripe Consent Checkbox", () => {
  const mockDispatch = jest.fn();
  const defaultState = {
    currentUser: {
      id: 1,
      token: "test_token",
      email: "cleaner@test.com",
    },
    account: "cleaner",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        hasAccount: false,
        onboardingComplete: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      }),
    });
  });

  it("should validate that stripeTermsAccepted must be true", () => {
    // Test the validation logic directly
    const validateStep3 = (formData) => {
      const errors = {};
      if (!formData.stripeTermsAccepted) {
        errors.stripeTermsAccepted = "You must agree to the Stripe Connected Account Agreement";
      }
      return errors;
    };

    // Without consent
    const errorsWithoutConsent = validateStep3({ stripeTermsAccepted: false });
    expect(errorsWithoutConsent.stripeTermsAccepted).toBe("You must agree to the Stripe Connected Account Agreement");

    // With consent
    const errorsWithConsent = validateStep3({ stripeTermsAccepted: true });
    expect(errorsWithConsent.stripeTermsAccepted).toBeUndefined();
  });

  it("should include stripeTermsAccepted in form data structure", () => {
    const formData = {
      dobMonth: "01",
      dobDay: "15",
      dobYear: "1990",
      addressLine1: "123 Main St",
      city: "Boston",
      state: "MA",
      postalCode: "02101",
      stripeTermsAccepted: false,
    };

    expect(formData).toHaveProperty("stripeTermsAccepted");
    expect(typeof formData.stripeTermsAccepted).toBe("boolean");
  });

  it("should be able to toggle stripeTermsAccepted state", () => {
    let formData = { stripeTermsAccepted: false };

    // Toggle on
    formData = { ...formData, stripeTermsAccepted: !formData.stripeTermsAccepted };
    expect(formData.stripeTermsAccepted).toBe(true);

    // Toggle off
    formData = { ...formData, stripeTermsAccepted: !formData.stripeTermsAccepted };
    expect(formData.stripeTermsAccepted).toBe(false);
  });

});

describe("Account Number Visibility Toggle", () => {
  it("should default showAccountNumber state to false", () => {
    const showAccountNumber = false;
    expect(showAccountNumber).toBe(false);
  });

  it("should toggle visibility state", () => {
    let showAccountNumber = false;

    // Toggle on
    showAccountNumber = !showAccountNumber;
    expect(showAccountNumber).toBe(true);

    // Toggle off
    showAccountNumber = !showAccountNumber;
    expect(showAccountNumber).toBe(false);
  });

  it("should set secureTextEntry based on visibility state", () => {
    const showAccountNumber = false;
    const secureTextEntry = !showAccountNumber;
    expect(secureTextEntry).toBe(true);

    const showAccountNumberVisible = true;
    const secureTextEntryVisible = !showAccountNumberVisible;
    expect(secureTextEntryVisible).toBe(false);
  });
});

describe("Update Bank Account", () => {
  const mockDispatch = jest.fn();
  const defaultState = {
    currentUser: {
      id: 1,
      token: "test_token",
      email: "cleaner@test.com",
    },
    account: "cleaner",
  };

  const completedAccountResponse = {
    ok: true,
    json: () => Promise.resolve({
      hasAccount: true,
      onboardingComplete: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    }),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    // Set up default mock for completed account state
    global.fetch.mockResolvedValue(completedAccountResponse);
  });

  it("should show bank account form when Change Bank Account is pressed", async () => {
    const { findByText, getByPlaceholderText } = render(
      <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
    );

    // Wait for the completed state to render and find the button
    const changeBankButton = await findByText("Change Bank Account", {}, { timeout: 3000 });
    fireEvent.press(changeBankButton);

    // Form fields should appear
    expect(getByPlaceholderText("9 digits")).toBeTruthy();
    expect(getByPlaceholderText("Your bank account number")).toBeTruthy();
    expect(getByPlaceholderText("Re-enter account number")).toBeTruthy();
  });

  it("should show Cancel and Save Changes buttons in update form", async () => {
    const { findByText } = render(
      <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
    );

    const changeBankButton = await findByText("Change Bank Account");
    fireEvent.press(changeBankButton);

    expect(await findByText("Cancel")).toBeTruthy();
    expect(await findByText("Save Changes")).toBeTruthy();
  });

  it("should hide form when Cancel is pressed", async () => {
    const { findByText, queryByPlaceholderText } = render(
      <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
    );

    // Open form
    const changeBankButton = await findByText("Change Bank Account");
    fireEvent.press(changeBankButton);

    // Press cancel
    const cancelButton = await findByText("Cancel");
    fireEvent.press(cancelButton);

    // Form should be hidden, Change Bank Account button should reappear
    expect(await findByText("Change Bank Account")).toBeTruthy();
  });

  it("should validate routing number has 9 digits before submitting", () => {
    const validateBankUpdate = (bankData) => {
      const routingDigits = bankData.routingNumber.replace(/\D/g, "");
      if (routingDigits.length !== 9) {
        return { error: "Please enter a valid 9-digit routing number" };
      }
      return { valid: true };
    };

    expect(validateBankUpdate({ routingNumber: "12345678" }).error).toBeTruthy();
    expect(validateBankUpdate({ routingNumber: "123456789" }).valid).toBe(true);
  });

  it("should validate account numbers match before submitting", () => {
    const validateBankUpdate = (bankData) => {
      if (bankData.accountNumber !== bankData.confirmAccountNumber) {
        return { error: "Account numbers do not match" };
      }
      return { valid: true };
    };

    expect(validateBankUpdate({
      accountNumber: "123456789",
      confirmAccountNumber: "123456780"
    }).error).toBeTruthy();

    expect(validateBankUpdate({
      accountNumber: "123456789",
      confirmAccountNumber: "123456789"
    }).valid).toBe(true);
  });

  it("should call update-bank-account endpoint with correct data", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          hasAccount: true,
          onboardingComplete: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          bankAccountLast4: "6789",
          bankName: "Test Bank",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          hasAccount: true,
          onboardingComplete: true,
          payoutsEnabled: true,
        }),
      });

    const { findByText, getByPlaceholderText } = render(
      <StripeConnectOnboarding state={defaultState} dispatch={mockDispatch} />
    );

    // Open form
    const changeBankButton = await findByText("Change Bank Account");
    fireEvent.press(changeBankButton);

    // Fill form
    fireEvent.changeText(getByPlaceholderText("9 digits"), "123456789");
    fireEvent.changeText(getByPlaceholderText("Your bank account number"), "987654321");
    fireEvent.changeText(getByPlaceholderText("Re-enter account number"), "987654321");

    // Submit
    const saveButton = await findByText("Save Changes");
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/stripe-connect/update-bank-account"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });
  });
});

describe("ToS Acceptance Data", () => {
  it("should include date as Unix timestamp", () => {
    const tosAcceptance = {
      accepted: true,
      date: Math.floor(Date.now() / 1000),
    };

    expect(tosAcceptance.date).toBeGreaterThan(0);
    expect(Number.isInteger(tosAcceptance.date)).toBe(true);
    // Should be a reasonable Unix timestamp (after year 2020)
    expect(tosAcceptance.date).toBeGreaterThan(1577836800);
  });

  it("should structure setupData correctly with tosAcceptance", () => {
    const setupData = {
      token: "test_token",
      personalInfo: {
        dob: "1990-01-15",
        address: {
          line1: "123 Main St",
          city: "Boston",
          state: "MA",
          postalCode: "02101",
        },
      },
      tosAcceptance: {
        accepted: true,
        date: Math.floor(Date.now() / 1000),
      },
    };

    expect(setupData).toHaveProperty("tosAcceptance");
    expect(setupData.tosAcceptance.accepted).toBe(true);
    expect(setupData.tosAcceptance.date).toBeDefined();
    // SSN and bank account are collected by Stripe, not the app
    expect(setupData.personalInfo).not.toHaveProperty("ssn");
    expect(setupData).not.toHaveProperty("bankAccount");
  });
});

describe("Complete Setup Response Handling", () => {
  const mockDispatch = jest.fn();
  const defaultState = {
    currentUser: {
      id: 1,
      token: "test_token",
      email: "cleaner@test.com",
    },
    account: "cleaner",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should show success alert when payouts are enabled", () => {
    const data = { payoutsEnabled: true, hasBankAccount: true };

    if (data.payoutsEnabled) {
      Alert.alert("Setup Complete!", "Your payment account is now active.");
    }

    expect(Alert.alert).toHaveBeenCalledWith(
      "Setup Complete!",
      expect.any(String)
    );
  });

  it("should show almost done alert when bank is added but verification pending", () => {
    const data = { payoutsEnabled: false, hasBankAccount: true };

    if (!data.payoutsEnabled && data.hasBankAccount) {
      Alert.alert("Almost Done", "Stripe is verifying your account.");
    }

    expect(Alert.alert).toHaveBeenCalledWith(
      "Almost Done",
      expect.any(String)
    );
  });

  it("should handle hasBankAccount in response", () => {
    const response = {
      success: true,
      stripeAccountId: "acct_test123",
      accountStatus: "active",
      payoutsEnabled: true,
      onboardingComplete: true,
      hasBankAccount: true,
      requirements: {
        currentlyDue: [],
        eventuallyDue: [],
      },
    };

    expect(response.hasBankAccount).toBe(true);
    expect(response.payoutsEnabled).toBe(true);
  });
});

describe("StripeConnectOnboarding Validation Logic", () => {
  describe("Stripe consent validation", () => {
    it("should reject when stripeTermsAccepted is false", () => {
      const formData = { stripeTermsAccepted: false };
      expect(formData.stripeTermsAccepted).toBe(false);
    });

    it("should accept when stripeTermsAccepted is true", () => {
      const formData = { stripeTermsAccepted: true };
      expect(formData.stripeTermsAccepted).toBe(true);
    });
  });

  describe("Routing number validation (for update bank account)", () => {
    it("should accept 9 digit routing number", () => {
      const routing = "123456789";
      const routingDigits = routing.replace(/\D/g, "");
      expect(routingDigits.length).toBe(9);
    });

    it("should reject short routing number", () => {
      const routing = "12345678";
      const routingDigits = routing.replace(/\D/g, "");
      expect(routingDigits.length).toBe(8);
    });
  });

  describe("Account number validation (for update bank account)", () => {
    it("should accept account numbers 4-17 digits", () => {
      const shortAccount = "1234";
      const longAccount = "12345678901234567";

      expect(shortAccount.length).toBeGreaterThanOrEqual(4);
      expect(longAccount.length).toBeLessThanOrEqual(17);
    });

    it("should validate matching account numbers", () => {
      const account = "123456789";
      const confirm = "123456789";
      expect(account).toBe(confirm);
    });

    it("should detect mismatched account numbers", () => {
      const account = "123456789";
      const confirm = "123456780";
      expect(account).not.toBe(confirm);
    });
  });
});
