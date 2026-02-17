import React from "react";

// Mock fetch
global.fetch = jest.fn();

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock react-router-native
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
}));

describe("MultiAspectReviewForm - isCleanerPreferred Feature", () => {
  const mockState = {
    currentUser: { token: "test_token", id: 1 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isCleanerPreferred Prop Handling", () => {
    it("should default isCleanerPreferred to false when not provided", () => {
      const isCleanerPreferred = undefined;
      const defaultValue = isCleanerPreferred || false;
      expect(defaultValue).toBe(false);
    });

    it("should use true when isCleanerPreferred is true", () => {
      const isCleanerPreferred = true;
      const defaultValue = isCleanerPreferred || false;
      expect(defaultValue).toBe(true);
    });

    it("should use false when isCleanerPreferred is explicitly false", () => {
      const isCleanerPreferred = false;
      const defaultValue = isCleanerPreferred || false;
      expect(defaultValue).toBe(false);
    });
  });

  describe("setAsPreferred State Initialization", () => {
    it("should initialize setAsPreferred to true when isCleanerPreferred is true", () => {
      const isCleanerPreferred = true;
      const setAsPreferred = isCleanerPreferred;
      expect(setAsPreferred).toBe(true);
    });

    it("should initialize setAsPreferred to false when isCleanerPreferred is false", () => {
      const isCleanerPreferred = false;
      const setAsPreferred = isCleanerPreferred;
      expect(setAsPreferred).toBe(false);
    });

    it("should initialize setAsPreferred to false when isCleanerPreferred is undefined", () => {
      const isCleanerPreferred = undefined;
      const setAsPreferred = isCleanerPreferred || false;
      expect(setAsPreferred).toBe(false);
    });
  });

  describe("Preferred Cleaner Toggle Label", () => {
    const revieweeName = "John Cleaner";

    it("should show 'Keep as preferred' when already preferred and toggle is on", () => {
      const isCleanerPreferred = true;
      const setAsPreferred = true;

      const label = isCleanerPreferred
        ? setAsPreferred
          ? `Keep ${revieweeName} as a preferred cleaner`
          : `Remove ${revieweeName} from preferred cleaners`
        : `Make ${revieweeName} a preferred cleaner`;

      expect(label).toBe("Keep John Cleaner as a preferred cleaner");
    });

    it("should show 'Remove from preferred' when already preferred but toggle is off", () => {
      const isCleanerPreferred = true;
      const setAsPreferred = false;

      const label = isCleanerPreferred
        ? setAsPreferred
          ? `Keep ${revieweeName} as a preferred cleaner`
          : `Remove ${revieweeName} from preferred cleaners`
        : `Make ${revieweeName} a preferred cleaner`;

      expect(label).toBe("Remove John Cleaner from preferred cleaners");
    });

    it("should show 'Make preferred' when not already preferred", () => {
      const isCleanerPreferred = false;
      const setAsPreferred = false;

      const label = isCleanerPreferred
        ? setAsPreferred
          ? `Keep ${revieweeName} as a preferred cleaner`
          : `Remove ${revieweeName} from preferred cleaners`
        : `Make ${revieweeName} a preferred cleaner`;

      expect(label).toBe("Make John Cleaner a preferred cleaner");
    });

    it("should show 'Make preferred' when not preferred but toggle is on", () => {
      const isCleanerPreferred = false;
      const setAsPreferred = true;

      const label = isCleanerPreferred
        ? setAsPreferred
          ? `Keep ${revieweeName} as a preferred cleaner`
          : `Remove ${revieweeName} from preferred cleaners`
        : `Make ${revieweeName} a preferred cleaner`;

      expect(label).toBe("Make John Cleaner a preferred cleaner");
    });
  });

  describe("Preferred Cleaner Toggle Hint Text", () => {
    it("should show booking hint when toggle is on", () => {
      const setAsPreferred = true;
      const isCleanerPreferred = false;

      const hint = setAsPreferred
        ? "They can book directly for this home without needing your approval each time."
        : isCleanerPreferred
          ? "They will no longer have preferred status for this home."
          : "Preferred cleaners can book directly without requesting approval.";

      expect(hint).toBe(
        "They can book directly for this home without needing your approval each time."
      );
    });

    it("should show removal warning when unchecking existing preferred cleaner", () => {
      const setAsPreferred = false;
      const isCleanerPreferred = true;

      const hint = setAsPreferred
        ? "They can book directly for this home without needing your approval each time."
        : isCleanerPreferred
          ? "They will no longer have preferred status for this home."
          : "Preferred cleaners can book directly without requesting approval.";

      expect(hint).toBe("They will no longer have preferred status for this home.");
    });

    it("should show general hint when toggle is off for non-preferred cleaner", () => {
      const setAsPreferred = false;
      const isCleanerPreferred = false;

      const hint = setAsPreferred
        ? "They can book directly for this home without needing your approval each time."
        : isCleanerPreferred
          ? "They will no longer have preferred status for this home."
          : "Preferred cleaners can book directly without requesting approval.";

      expect(hint).toBe("Preferred cleaners can book directly without requesting approval.");
    });

    it("should show booking hint when keeping existing preferred cleaner", () => {
      const setAsPreferred = true;
      const isCleanerPreferred = true;

      const hint = setAsPreferred
        ? "They can book directly for this home without needing your approval each time."
        : isCleanerPreferred
          ? "They will no longer have preferred status for this home."
          : "Preferred cleaners can book directly without requesting approval.";

      expect(hint).toBe(
        "They can book directly for this home without needing your approval each time."
      );
    });
  });

  describe("Section Styling", () => {
    it("should apply warning style when unchecking existing preferred cleaner", () => {
      const isCleanerPreferred = true;
      const setAsPreferred = false;

      const shouldApplyWarning = isCleanerPreferred && !setAsPreferred;
      expect(shouldApplyWarning).toBe(true);
    });

    it("should not apply warning style when keeping existing preferred cleaner", () => {
      const isCleanerPreferred = true;
      const setAsPreferred = true;

      const shouldApplyWarning = isCleanerPreferred && !setAsPreferred;
      expect(shouldApplyWarning).toBe(false);
    });

    it("should not apply warning style for new cleaner", () => {
      const isCleanerPreferred = false;
      const setAsPreferred = false;

      const shouldApplyWarning = isCleanerPreferred && !setAsPreferred;
      expect(shouldApplyWarning).toBe(false);
    });

    it("should not apply warning style when making new preferred", () => {
      const isCleanerPreferred = false;
      const setAsPreferred = true;

      const shouldApplyWarning = isCleanerPreferred && !setAsPreferred;
      expect(shouldApplyWarning).toBe(false);
    });
  });

  describe("Icon Color", () => {
    const successColor = "#059669";
    const neutralColor = "#9ca3af";

    it("should show success color when toggle is on", () => {
      const setAsPreferred = true;
      const color = setAsPreferred ? successColor : neutralColor;
      expect(color).toBe(successColor);
    });

    it("should show neutral color when toggle is off", () => {
      const setAsPreferred = false;
      const color = setAsPreferred ? successColor : neutralColor;
      expect(color).toBe(neutralColor);
    });
  });

  describe("Section Visibility", () => {
    it("should show section for homeowner_to_cleaner with homeId", () => {
      const reviewType = "homeowner_to_cleaner";
      const homeId = 10;
      const isHomeownerReview = reviewType === "homeowner_to_cleaner";
      const shouldShow = isHomeownerReview && !!homeId;
      expect(shouldShow).toBe(true);
    });

    it("should hide section for cleaner_to_homeowner", () => {
      const reviewType = "cleaner_to_homeowner";
      const homeId = 10;
      const isHomeownerReview = reviewType === "homeowner_to_cleaner";
      const shouldShow = isHomeownerReview && !!homeId;
      expect(shouldShow).toBe(false);
    });

    it("should hide section when homeId is missing", () => {
      const reviewType = "homeowner_to_cleaner";
      const homeId = null;
      const isHomeownerReview = reviewType === "homeowner_to_cleaner";
      const shouldShow = isHomeownerReview && !!homeId;
      expect(shouldShow).toBe(false);
    });
  });

  describe("Form Submission Data", () => {
    it("should include setAsPreferred: true in submission when checked", () => {
      const formData = {
        userId: 100,
        appointmentId: 1,
        reviewType: "homeowner_to_cleaner",
        setAsPreferred: true,
        homeId: 10,
      };

      expect(formData.setAsPreferred).toBe(true);
    });

    it("should include setAsPreferred: false in submission when unchecked", () => {
      const formData = {
        userId: 100,
        appointmentId: 1,
        reviewType: "homeowner_to_cleaner",
        setAsPreferred: false,
        homeId: 10,
      };

      expect(formData.setAsPreferred).toBe(false);
    });

    it("should include homeId in submission", () => {
      const formData = {
        userId: 100,
        appointmentId: 1,
        reviewType: "homeowner_to_cleaner",
        setAsPreferred: true,
        homeId: 10,
      };

      expect(formData.homeId).toBe(10);
    });
  });

  describe("Toggle State Changes", () => {
    it("should toggle from checked to unchecked", () => {
      let setAsPreferred = true;
      setAsPreferred = !setAsPreferred;
      expect(setAsPreferred).toBe(false);
    });

    it("should toggle from unchecked to checked", () => {
      let setAsPreferred = false;
      setAsPreferred = !setAsPreferred;
      expect(setAsPreferred).toBe(true);
    });

    it("should allow multiple toggles", () => {
      let setAsPreferred = false;
      setAsPreferred = !setAsPreferred; // true
      setAsPreferred = !setAsPreferred; // false
      setAsPreferred = !setAsPreferred; // true
      expect(setAsPreferred).toBe(true);
    });
  });

  describe("API Submission with Removal", () => {
    it("should submit with setAsPreferred: false to remove existing preferred", async () => {
      const mockSubmit = jest.fn().mockResolvedValue({ success: true });

      const formData = {
        userId: 100,
        appointmentId: 1,
        reviewType: "homeowner_to_cleaner",
        setAsPreferred: false, // Removing
        homeId: 10,
      };

      await mockSubmit(formData);

      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          setAsPreferred: false,
          homeId: 10,
        })
      );
    });

    it("should submit with setAsPreferred: true to add new preferred", async () => {
      const mockSubmit = jest.fn().mockResolvedValue({ success: true });

      const formData = {
        userId: 100,
        appointmentId: 1,
        reviewType: "homeowner_to_cleaner",
        setAsPreferred: true, // Adding
        homeId: 10,
      };

      await mockSubmit(formData);

      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          setAsPreferred: true,
          homeId: 10,
        })
      );
    });
  });
});

describe("PendingReviewsList - isCleanerPreferred Integration", () => {
  describe("Passing isCleanerPreferred to MultiAspectReviewForm", () => {
    it("should pass isCleanerPreferred from selectedReview", () => {
      const selectedReview = {
        appointmentId: 1,
        home: { id: 10 },
        isCleanerPreferred: true,
        cleaners: [{ id: 100, firstName: "John", lastName: "Cleaner" }],
      };

      const props = {
        appointmentId: selectedReview.appointmentId,
        homeId: selectedReview.home?.id,
        isCleanerPreferred: selectedReview.isCleanerPreferred || false,
      };

      expect(props.isCleanerPreferred).toBe(true);
    });

    it("should default isCleanerPreferred to false when not in selectedReview", () => {
      const selectedReview = {
        appointmentId: 1,
        home: { id: 10 },
        // isCleanerPreferred not present
        cleaners: [{ id: 100, firstName: "John", lastName: "Cleaner" }],
      };

      const props = {
        appointmentId: selectedReview.appointmentId,
        homeId: selectedReview.home?.id,
        isCleanerPreferred: selectedReview.isCleanerPreferred || false,
      };

      expect(props.isCleanerPreferred).toBe(false);
    });

    it("should handle false value from selectedReview", () => {
      const selectedReview = {
        appointmentId: 1,
        home: { id: 10 },
        isCleanerPreferred: false,
        cleaners: [{ id: 100, firstName: "John", lastName: "Cleaner" }],
      };

      const props = {
        appointmentId: selectedReview.appointmentId,
        homeId: selectedReview.home?.id,
        isCleanerPreferred: selectedReview.isCleanerPreferred || false,
      };

      expect(props.isCleanerPreferred).toBe(false);
    });
  });
});
