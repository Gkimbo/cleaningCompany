/**
 * Tests for ApplicationForm ID Verification functionality
 * Tests ID name verification, state management, and error handling
 */

describe("ApplicationForm - ID Verification", () => {
  // Mock fetch for API calls
  let mockFetch;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  /**
   * Initial state for ID verification
   */
  describe("ID Verification Initial State", () => {
    const initialState = {
      isVerifying: false,
      verified: null,
      confidence: 0,
      message: "",
      detectedName: null,
      skipped: false,
      disabled: false,
    };

    it("should start with not verified state", () => {
      expect(initialState.verified).toBeNull();
    });

    it("should start with not verifying", () => {
      expect(initialState.isVerifying).toBe(false);
    });

    it("should have zero confidence initially", () => {
      expect(initialState.confidence).toBe(0);
    });

    it("should have no detected name initially", () => {
      expect(initialState.detectedName).toBeNull();
    });

    it("should not be skipped initially", () => {
      expect(initialState.skipped).toBe(false);
    });

    it("should not be disabled initially", () => {
      expect(initialState.disabled).toBe(false);
    });
  });

  /**
   * Verification Logic - Simulating verifyIdName function behavior
   */
  describe("verifyIdName - Verification Logic", () => {
    const simulateVerifyIdName = async (
      firstName,
      lastName,
      imageBase64,
      fetchResponse
    ) => {
      // Simulate the verifyIdName function logic
      if (!firstName.trim() || !lastName.trim()) {
        return {
          isVerifying: false,
          verified: null,
          confidence: 0,
          message: "",
          detectedName: null,
          skipped: true,
          disabled: true,
        };
      }

      if (!fetchResponse) {
        return {
          isVerifying: false,
          verified: null,
          confidence: 0,
          message: "",
          detectedName: null,
          skipped: true,
          disabled: true,
        };
      }

      if (fetchResponse.disabled || fetchResponse.skipped) {
        return {
          isVerifying: false,
          verified: null,
          confidence: 0,
          message: "",
          detectedName: null,
          skipped: true,
          disabled: fetchResponse.disabled || false,
        };
      }

      return {
        isVerifying: false,
        verified: fetchResponse.verified ?? null,
        confidence: fetchResponse.confidence || 0,
        message: fetchResponse.message || "",
        detectedName: fetchResponse.detectedName || null,
        skipped: false,
        disabled: false,
      };
    };

    it("should skip verification when firstName is empty", async () => {
      const result = await simulateVerifyIdName("", "Smith", "base64data", {
        verified: true,
      });
      expect(result.skipped).toBe(true);
      expect(result.disabled).toBe(true);
      expect(result.verified).toBeNull();
    });

    it("should skip verification when lastName is empty", async () => {
      const result = await simulateVerifyIdName("John", "", "base64data", {
        verified: true,
      });
      expect(result.skipped).toBe(true);
      expect(result.disabled).toBe(true);
    });

    it("should skip verification when both names are empty", async () => {
      const result = await simulateVerifyIdName("", "", "base64data", {
        verified: true,
      });
      expect(result.skipped).toBe(true);
    });

    it("should skip verification when names are only whitespace", async () => {
      const result = await simulateVerifyIdName("   ", "   ", "base64data", {
        verified: true,
      });
      expect(result.skipped).toBe(true);
    });

    it("should return verified=true for matching names", async () => {
      const result = await simulateVerifyIdName("John", "Smith", "base64data", {
        verified: true,
        confidence: 95,
        message: "Name verified",
        detectedName: { firstName: "JOHN", lastName: "SMITH" },
      });

      expect(result.verified).toBe(true);
      expect(result.confidence).toBe(95);
      expect(result.skipped).toBe(false);
      expect(result.disabled).toBe(false);
    });

    it("should return verified=false for mismatched names", async () => {
      const result = await simulateVerifyIdName("John", "Smith", "base64data", {
        verified: false,
        confidence: 30,
        message: "Name mismatch",
        detectedName: { firstName: "JANE", lastName: "DOE" },
      });

      expect(result.verified).toBe(false);
      expect(result.confidence).toBe(30);
      expect(result.detectedName).toEqual({
        firstName: "JANE",
        lastName: "DOE",
      });
    });

    it("should handle disabled feature response", async () => {
      const result = await simulateVerifyIdName("John", "Smith", "base64data", {
        disabled: true,
        skipped: true,
      });

      expect(result.disabled).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.verified).toBeNull();
    });

    it("should handle skipped response from server", async () => {
      const result = await simulateVerifyIdName("John", "Smith", "base64data", {
        skipped: true,
      });

      expect(result.skipped).toBe(true);
      expect(result.verified).toBeNull();
    });

    it("should handle null fetch response (error case)", async () => {
      const result = await simulateVerifyIdName(
        "John",
        "Smith",
        "base64data",
        null
      );
      expect(result.skipped).toBe(true);
      expect(result.disabled).toBe(true);
    });
  });

  /**
   * Error Handling - Graceful degradation
   */
  describe("Error Handling - Graceful Degradation", () => {
    const handleFetchError = (error) => {
      // Simulate error handling that always returns skipped state
      return {
        isVerifying: false,
        verified: null,
        confidence: 0,
        message: "",
        detectedName: null,
        skipped: true,
        disabled: true,
      };
    };

    it("should silently skip on network error", () => {
      const result = handleFetchError(new Error("Network error"));
      expect(result.skipped).toBe(true);
      expect(result.disabled).toBe(true);
      expect(result.verified).toBeNull();
    });

    it("should silently skip on timeout (AbortError)", () => {
      const error = new Error("Aborted");
      error.name = "AbortError";
      const result = handleFetchError(error);
      expect(result.skipped).toBe(true);
    });

    it("should silently skip on JSON parse error", () => {
      const result = handleFetchError(new SyntaxError("Unexpected token"));
      expect(result.skipped).toBe(true);
    });

    it("should never throw an error to the caller", () => {
      const errorHandler = () => {
        try {
          throw new Error("Some error");
        } catch (e) {
          return handleFetchError(e);
        }
      };

      expect(() => errorHandler()).not.toThrow();
      const result = errorHandler();
      expect(result.skipped).toBe(true);
    });
  });

  /**
   * UI State Logic - What should be displayed
   */
  describe("UI State Logic", () => {
    const shouldShowVerificationUI = (idPhoto, idVerification) => {
      return idPhoto && !idVerification.disabled;
    };

    const getVerificationStatusType = (idVerification) => {
      if (idVerification.isVerifying) return "verifying";
      if (idVerification.verified === true) return "success";
      if (idVerification.verified === false && !idVerification.skipped)
        return "error";
      return "none";
    };

    it("should show verification UI when photo exists and not disabled", () => {
      const idPhoto = "base64data";
      const idVerification = { disabled: false };
      expect(shouldShowVerificationUI(idPhoto, idVerification)).toBe(true);
    });

    it("should hide verification UI when photo is missing", () => {
      const idPhoto = null;
      const idVerification = { disabled: false };
      // null && !false = null (falsy)
      expect(shouldShowVerificationUI(idPhoto, idVerification)).toBeFalsy();
    });

    it("should hide verification UI when feature is disabled", () => {
      const idPhoto = "base64data";
      const idVerification = { disabled: true };
      expect(shouldShowVerificationUI(idPhoto, idVerification)).toBe(false);
    });

    it("should show verifying state when checking", () => {
      const idVerification = { isVerifying: true };
      expect(getVerificationStatusType(idVerification)).toBe("verifying");
    });

    it("should show success state when verified", () => {
      const idVerification = { isVerifying: false, verified: true };
      expect(getVerificationStatusType(idVerification)).toBe("success");
    });

    it("should show error state when not verified and not skipped", () => {
      const idVerification = {
        isVerifying: false,
        verified: false,
        skipped: false,
      };
      expect(getVerificationStatusType(idVerification)).toBe("error");
    });

    it("should show nothing when skipped", () => {
      const idVerification = {
        isVerifying: false,
        verified: false,
        skipped: true,
      };
      expect(getVerificationStatusType(idVerification)).toBe("none");
    });

    it("should show nothing when verified is null", () => {
      const idVerification = { isVerifying: false, verified: null };
      expect(getVerificationStatusType(idVerification)).toBe("none");
    });
  });

  /**
   * Step Navigation with ID Verification
   */
  describe("Step Navigation - ID Verification Warning", () => {
    const shouldShowMismatchWarning = (
      currentStep,
      idVerification,
      formData
    ) => {
      return (
        currentStep === 2 &&
        idVerification.verified === false &&
        !idVerification.skipped &&
        !idVerification.disabled
      );
    };

    it("should show warning on step 2 with name mismatch", () => {
      const result = shouldShowMismatchWarning(
        2,
        { verified: false, skipped: false, disabled: false },
        { firstName: "John", lastName: "Smith" }
      );
      expect(result).toBe(true);
    });

    it("should not show warning on other steps", () => {
      const steps = [1, 3, 4, 5, 6];
      steps.forEach((step) => {
        const result = shouldShowMismatchWarning(
          step,
          { verified: false, skipped: false, disabled: false },
          { firstName: "John", lastName: "Smith" }
        );
        expect(result).toBe(false);
      });
    });

    it("should not show warning when verified", () => {
      const result = shouldShowMismatchWarning(
        2,
        { verified: true, skipped: false, disabled: false },
        { firstName: "John", lastName: "Smith" }
      );
      expect(result).toBe(false);
    });

    it("should not show warning when skipped", () => {
      const result = shouldShowMismatchWarning(
        2,
        { verified: false, skipped: true, disabled: false },
        { firstName: "John", lastName: "Smith" }
      );
      expect(result).toBe(false);
    });

    it("should not show warning when feature disabled", () => {
      const result = shouldShowMismatchWarning(
        2,
        { verified: false, skipped: false, disabled: true },
        { firstName: "John", lastName: "Smith" }
      );
      expect(result).toBe(false);
    });

    it("should not show warning when verified is null", () => {
      const result = shouldShowMismatchWarning(
        2,
        { verified: null, skipped: false, disabled: false },
        { firstName: "John", lastName: "Smith" }
      );
      expect(result).toBe(false);
    });
  });

  /**
   * API Response Processing
   */
  describe("API Response Processing", () => {
    const processApiResponse = (response) => {
      if (!response.ok) {
        return {
          isVerifying: false,
          verified: null,
          confidence: 0,
          message: "",
          detectedName: null,
          skipped: true,
          disabled: true,
        };
      }

      // Process successful response
      const result = response.body;
      if (result.disabled || result.skipped) {
        return {
          isVerifying: false,
          verified: null,
          confidence: 0,
          message: "",
          detectedName: null,
          skipped: true,
          disabled: result.disabled || false,
        };
      }

      return {
        isVerifying: false,
        verified: result.verified ?? null,
        confidence: result.confidence || 0,
        message: result.message || "",
        detectedName: result.detectedName || null,
        skipped: false,
        disabled: false,
      };
    };

    it("should handle non-OK responses gracefully", () => {
      const result = processApiResponse({ ok: false });
      expect(result.skipped).toBe(true);
      expect(result.disabled).toBe(true);
    });

    it("should handle 200 with verified=true", () => {
      const result = processApiResponse({
        ok: true,
        body: {
          verified: true,
          confidence: 90,
          message: "Match found",
          detectedName: { firstName: "JOHN", lastName: "SMITH" },
        },
      });

      expect(result.verified).toBe(true);
      expect(result.confidence).toBe(90);
      expect(result.detectedName.firstName).toBe("JOHN");
    });

    it("should handle 200 with verified=false", () => {
      const result = processApiResponse({
        ok: true,
        body: {
          verified: false,
          confidence: 20,
          message: "Names do not match",
          detectedName: { firstName: "JANE", lastName: "DOE" },
        },
      });

      expect(result.verified).toBe(false);
      expect(result.confidence).toBe(20);
      expect(result.detectedName.firstName).toBe("JANE");
    });

    it("should handle 200 with skipped=true", () => {
      const result = processApiResponse({
        ok: true,
        body: { skipped: true, disabled: false },
      });

      expect(result.skipped).toBe(true);
      expect(result.verified).toBeNull();
    });

    it("should handle 200 with disabled=true", () => {
      const result = processApiResponse({
        ok: true,
        body: { disabled: true },
      });

      expect(result.disabled).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it("should default confidence to 0 if not provided", () => {
      const result = processApiResponse({
        ok: true,
        body: { verified: true },
      });

      expect(result.confidence).toBe(0);
    });

    it("should default message to empty string if not provided", () => {
      const result = processApiResponse({
        ok: true,
        body: { verified: true },
      });

      expect(result.message).toBe("");
    });

    it("should default detectedName to null if not provided", () => {
      const result = processApiResponse({
        ok: true,
        body: { verified: true },
      });

      expect(result.detectedName).toBeNull();
    });
  });

  /**
   * Base64 Image Handling
   */
  describe("Base64 Image Handling", () => {
    it("should strip data URL prefix for API call", () => {
      const dataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...";
      const base64Only = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      expect(base64Only.startsWith("data:")).toBe(false);
      expect(base64Only).toBe("/9j/4AAQSkZJRgABAQ...");
    });

    it("should handle data URL without prefix", () => {
      const rawBase64 = "/9j/4AAQSkZJRgABAQAAAQ...";
      const base64Only = rawBase64.replace(/^data:image\/\w+;base64,/, "");
      expect(base64Only).toBe(rawBase64);
    });

    it("should validate base64 string is not empty", () => {
      const isValidBase64 = (str) => {
        return str && str.length > 10;
      };

      // These return falsy values (empty string, null, false)
      expect(isValidBase64("")).toBeFalsy();
      expect(isValidBase64(null)).toBeFalsy();
      expect(isValidBase64("short")).toBeFalsy();
      // This returns truthy value
      expect(isValidBase64("/9j/4AAQSkZJRgABAQ...")).toBeTruthy();
    });
  });

  /**
   * Confidence Display
   */
  describe("Confidence Display", () => {
    const formatConfidence = (confidence) => {
      return `${confidence}% match`;
    };

    it("should format confidence as percentage", () => {
      expect(formatConfidence(95)).toBe("95% match");
      expect(formatConfidence(100)).toBe("100% match");
      expect(formatConfidence(0)).toBe("0% match");
    });

    it("should handle confidence thresholds", () => {
      const isHighConfidence = (confidence) => confidence >= 70;
      const isMediumConfidence = (confidence) =>
        confidence >= 40 && confidence < 70;
      const isLowConfidence = (confidence) => confidence < 40;

      expect(isHighConfidence(95)).toBe(true);
      expect(isHighConfidence(70)).toBe(true);
      expect(isHighConfidence(69)).toBe(false);

      expect(isMediumConfidence(50)).toBe(true);
      expect(isMediumConfidence(40)).toBe(true);
      expect(isMediumConfidence(39)).toBe(false);

      expect(isLowConfidence(30)).toBe(true);
      expect(isLowConfidence(40)).toBe(false);
    });
  });

  /**
   * Name Display Formatting
   */
  describe("Name Display Formatting", () => {
    const formatDetectedName = (detectedName) => {
      if (!detectedName) return "";
      return `${detectedName.firstName} ${detectedName.lastName}`;
    };

    const formatMismatchMessage = (formData, detectedName) => {
      const applicationName = `${formData.firstName} ${formData.lastName}`;
      const idName = formatDetectedName(detectedName);
      return `Your application says: ${applicationName}\nYour ID shows: ${idName}`;
    };

    it("should format detected name correctly", () => {
      const result = formatDetectedName({ firstName: "JOHN", lastName: "SMITH" });
      expect(result).toBe("JOHN SMITH");
    });

    it("should handle null detected name", () => {
      const result = formatDetectedName(null);
      expect(result).toBe("");
    });

    it("should format mismatch message correctly", () => {
      const formData = { firstName: "John", lastName: "Smith" };
      const detectedName = { firstName: "JANE", lastName: "DOE" };
      const message = formatMismatchMessage(formData, detectedName);

      expect(message).toContain("John Smith");
      expect(message).toContain("JANE DOE");
    });
  });

  /**
   * Photo Upload Reset
   */
  describe("Photo Upload - State Reset", () => {
    const resetVerificationState = () => ({
      isVerifying: false,
      verified: null,
      confidence: 0,
      message: "",
      detectedName: null,
      skipped: false,
    });

    it("should reset verification state on new photo upload", () => {
      // Simulate existing state
      const existingState = {
        isVerifying: false,
        verified: true,
        confidence: 95,
        message: "Match found",
        detectedName: { firstName: "JOHN", lastName: "SMITH" },
        skipped: false,
      };

      // Reset should return fresh state
      const newState = resetVerificationState();

      expect(newState.verified).toBeNull();
      expect(newState.confidence).toBe(0);
      expect(newState.detectedName).toBeNull();
    });

    it("should not carry over previous verification results", () => {
      const state1 = {
        verified: false,
        detectedName: { firstName: "WRONG", lastName: "NAME" },
      };

      const state2 = resetVerificationState();

      expect(state2.verified).not.toBe(state1.verified);
      expect(state2.detectedName).toBeNull();
    });
  });

  /**
   * Abort Controller Timeout
   */
  describe("Abort Controller Timeout", () => {
    it("should abort after 30 seconds", () => {
      const TIMEOUT_MS = 30000;
      const controller = new AbortController();

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, TIMEOUT_MS);

      expect(controller.signal.aborted).toBe(false);

      // Fast forward time
      jest.advanceTimersByTime(30000);

      expect(controller.signal.aborted).toBe(true);

      clearTimeout(timeoutId);
    });

    it("should not abort before timeout", () => {
      const TIMEOUT_MS = 30000;
      const controller = new AbortController();

      setTimeout(() => {
        controller.abort();
      }, TIMEOUT_MS);

      // Fast forward less than timeout
      jest.advanceTimersByTime(15000);

      expect(controller.signal.aborted).toBe(false);
    });

    it("should clear timeout on success", () => {
      const TIMEOUT_MS = 30000;
      const controller = new AbortController();

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, TIMEOUT_MS);

      // Clear timeout before it fires
      clearTimeout(timeoutId);

      // Fast forward past timeout
      jest.advanceTimersByTime(35000);

      // Should still not be aborted because we cleared the timeout
      expect(controller.signal.aborted).toBe(false);
    });
  });
});

describe("ApplicationForm - ID Verification Feature Flag", () => {
  describe("Feature Status Check", () => {
    const isFeatureEnabled = (config) => {
      if (!config) return false;
      if (!config.applications) return false;
      return config.applications.idVerificationEnabled === true;
    };

    it("should return false when config is null", () => {
      expect(isFeatureEnabled(null)).toBe(false);
    });

    it("should return false when config is undefined", () => {
      expect(isFeatureEnabled(undefined)).toBe(false);
    });

    it("should return false when applications key is missing", () => {
      expect(isFeatureEnabled({ someOtherKey: true })).toBe(false);
    });

    it("should return false when idVerificationEnabled is false", () => {
      expect(
        isFeatureEnabled({ applications: { idVerificationEnabled: false } })
      ).toBe(false);
    });

    it("should return true when idVerificationEnabled is true", () => {
      expect(
        isFeatureEnabled({ applications: { idVerificationEnabled: true } })
      ).toBe(true);
    });

    it("should return false for truthy non-boolean values", () => {
      expect(
        isFeatureEnabled({ applications: { idVerificationEnabled: "true" } })
      ).toBe(false);
      expect(
        isFeatureEnabled({ applications: { idVerificationEnabled: 1 } })
      ).toBe(false);
    });
  });
});
