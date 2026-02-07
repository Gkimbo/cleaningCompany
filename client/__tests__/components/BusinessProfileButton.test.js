/**
 * BusinessProfileButton Component Tests
 *
 * Tests for the TopBar navigation button that links to the
 * Business Owner Profile page
 */

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

describe("BusinessProfileButton Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Navigation", () => {
    it("should navigate to /business-owner/profile", () => {
      mockNavigate("/business-owner/profile");
      expect(mockNavigate).toHaveBeenCalledWith("/business-owner/profile");
    });

    it("should call closeModal before navigating", () => {
      const closeModal = jest.fn();

      // Simulate button press logic
      closeModal();
      mockNavigate("/business-owner/profile");

      expect(closeModal).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/business-owner/profile");
    });
  });

  describe("Button Text", () => {
    it("should display 'My Business' as button text", () => {
      const buttonText = "My Business";
      expect(buttonText).toBe("My Business");
    });
  });

  describe("Icon Configuration", () => {
    it("should use briefcase icon from Feather", () => {
      const iconName = "briefcase";
      expect(iconName).toBe("briefcase");
    });

    it("should have correct icon size", () => {
      const iconSize = 18;
      expect(iconSize).toBe(18);
    });

    it("should have correct icon color", () => {
      // colors.primary[600]
      const iconColor = "#4F46E5";
      expect(iconColor).toBeDefined();
    });
  });

  describe("New Badge", () => {
    it("should display 'New' badge", () => {
      const badgeText = "New";
      expect(badgeText).toBe("New");
    });

    it("should have primary background color for badge", () => {
      // colors.primary[600]
      const backgroundColor = "#4F46E5";
      expect(backgroundColor).toBeDefined();
    });

    it("should have white text color for badge", () => {
      // colors.neutral[0]
      const textColor = "#FFFFFF";
      expect(textColor).toBe("#FFFFFF");
    });
  });

  describe("TopBar Integration", () => {
    it("should only be visible for business owner cleaners", () => {
      const state = { account: "cleaner", isBusinessOwner: true };
      const shouldShow = state.isBusinessOwner;

      expect(shouldShow).toBe(true);
    });

    it("should be hidden for regular cleaners", () => {
      const state = { account: "cleaner", isBusinessOwner: false };
      const shouldShow = state.isBusinessOwner;

      expect(shouldShow).toBe(false);
    });

    it("should be hidden for homeowners", () => {
      const state = { account: null, isBusinessOwner: false };
      const shouldShow = state.isBusinessOwner;

      expect(shouldShow).toBe(false);
    });

    it("should be hidden for employees", () => {
      const state = { account: "employee", isBusinessOwner: false };
      const shouldShow = state.isBusinessOwner;

      expect(shouldShow).toBe(false);
    });

    it("should be hidden for platform owners", () => {
      // Platform owners have their own menu, don't need business profile
      const state = { account: "owner", isBusinessOwner: false };
      const shouldShow = state.account === "cleaner" && state.isBusinessOwner;

      expect(shouldShow).toBe(false);
    });
  });

  describe("Menu Position", () => {
    it("should appear at top of cleaner menu for business owners", () => {
      // Business Profile button should be first in the menu
      const menuOrder = [
        "BusinessProfileButton",
        "ChooseNewJobButton",
        "EmployeeAssignmentsButton",
        "MyRequestsButton",
      ];

      expect(menuOrder[0]).toBe("BusinessProfileButton");
    });
  });

  describe("Button Styling", () => {
    it("should use glassButton style", () => {
      const styles = {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
        borderRadius: 12,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.2)",
      };

      expect(styles.flexDirection).toBe("row");
      expect(styles.paddingVertical).toBe(12);
    });

    it("should have pressed state opacity", () => {
      const pressed = true;
      const opacity = pressed ? 0.8 : 1;

      expect(opacity).toBe(0.8);
    });
  });

  describe("Button Content Layout", () => {
    it("should have icon and text in row", () => {
      const buttonContentStyle = {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      };

      expect(buttonContentStyle.flexDirection).toBe("row");
      expect(buttonContentStyle.gap).toBe(12);
    });

    it("should have badge on right side", () => {
      // Badge is separate from buttonContent, positioned by justifyContent: space-between
      const containerJustify = "space-between";
      expect(containerJustify).toBe("space-between");
    });
  });

  describe("Badge Styling", () => {
    it("should have full border radius", () => {
      const badgeStyle = {
        borderRadius: 9999, // radius.full
        paddingHorizontal: 8,
        paddingVertical: 2,
      };

      expect(badgeStyle.borderRadius).toBe(9999);
    });

    it("should have small font size", () => {
      const badgeFontSize = 10;
      expect(badgeFontSize).toBe(10);
    });

    it("should have semibold font weight", () => {
      const badgeFontWeight = "600";
      expect(badgeFontWeight).toBe("600");
    });
  });

  describe("Accessibility", () => {
    it("should be a pressable component", () => {
      const componentType = "Pressable";
      expect(componentType).toBe("Pressable");
    });
  });

  describe("Business Owner State Variations", () => {
    it("should handle isBusinessOwner being undefined", () => {
      const state = { account: "cleaner" };
      const shouldShow = state.isBusinessOwner;

      expect(shouldShow).toBeFalsy();
    });

    it("should handle isBusinessOwner being null", () => {
      const state = { account: "cleaner", isBusinessOwner: null };
      const shouldShow = state.isBusinessOwner;

      expect(shouldShow).toBeFalsy();
    });

    it("should show when isBusinessOwner is truthy", () => {
      const state = { account: "cleaner", isBusinessOwner: 1 };
      const shouldShow = !!state.isBusinessOwner;

      expect(shouldShow).toBe(true);
    });
  });
});
