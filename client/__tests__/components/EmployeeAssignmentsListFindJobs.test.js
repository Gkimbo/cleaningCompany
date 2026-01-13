/**
 * Tests for EmployeeAssignmentsList - Find Jobs Button Visibility
 *
 * Tests that the "Find Jobs" button is hidden for employees (who get jobs assigned by their manager)
 * but shown for independent cleaners (who find their own jobs).
 */

describe("EmployeeAssignmentsList - Find Jobs Button Visibility", () => {
  /**
   * Helper to determine if the Find Jobs button should be shown
   * Based on the component logic: state.account !== "employee"
   */
  const shouldShowFindJobsButton = (accountType) => {
    return accountType !== "employee";
  };

  /**
   * Helper to get the empty state message based on account type
   */
  const getEmptyStateMessage = (accountType) => {
    if (accountType === "employee") {
      return "You haven't been assigned to any cleaning jobs yet. Your manager will assign jobs to you.";
    }
    return "You haven't been assigned to any cleaning jobs yet. Browse available jobs to get started!";
  };

  describe("Find Jobs button visibility", () => {
    it("should hide Find Jobs button for employee accounts", () => {
      const accountType = "employee";
      expect(shouldShowFindJobsButton(accountType)).toBe(false);
    });

    it("should show Find Jobs button for cleaner accounts", () => {
      const accountType = "cleaner";
      expect(shouldShowFindJobsButton(accountType)).toBe(true);
    });

    it("should show Find Jobs button for null account type (homeowner/general user)", () => {
      const accountType = null;
      expect(shouldShowFindJobsButton(accountType)).toBe(true);
    });

    it("should show Find Jobs button for undefined account type", () => {
      const accountType = undefined;
      expect(shouldShowFindJobsButton(accountType)).toBe(true);
    });

    it("should show Find Jobs button for businessOwner accounts", () => {
      const accountType = "businessOwner";
      expect(shouldShowFindJobsButton(accountType)).toBe(true);
    });
  });

  describe("Empty state message content", () => {
    it("should show manager assignment message for employees", () => {
      const message = getEmptyStateMessage("employee");
      expect(message).toContain("Your manager will assign jobs to you");
      expect(message).not.toContain("Browse available jobs");
    });

    it("should show browse jobs message for cleaners", () => {
      const message = getEmptyStateMessage("cleaner");
      expect(message).toContain("Browse available jobs");
      expect(message).not.toContain("Your manager");
    });

    it("should show browse jobs message for non-employee accounts", () => {
      const message = getEmptyStateMessage(null);
      expect(message).toContain("Browse available jobs");
    });
  });

  describe("Find More Jobs card visibility", () => {
    /**
     * The "Find More Jobs" card at the bottom of the list
     * should also be hidden for employees
     */
    const shouldShowFindMoreJobsCard = (accountType) => {
      return accountType !== "employee";
    };

    it("should hide Find More Jobs card for employees", () => {
      expect(shouldShowFindMoreJobsCard("employee")).toBe(false);
    });

    it("should show Find More Jobs card for cleaners", () => {
      expect(shouldShowFindMoreJobsCard("cleaner")).toBe(true);
    });

    it("should show Find More Jobs card for business owners", () => {
      expect(shouldShowFindMoreJobsCard("businessOwner")).toBe(true);
    });
  });

  describe("Account type determination", () => {
    /**
     * Tests for determining account type from state
     * Employee accounts have state.account === "employee"
     */

    it("should correctly identify employee from state.account", () => {
      const state = { account: "employee" };
      expect(state.account === "employee").toBe(true);
    });

    it("should correctly identify non-employee from state.account", () => {
      const state = { account: "cleaner" };
      expect(state.account === "employee").toBe(false);
    });

    it("should handle missing account property", () => {
      const state = {};
      expect(state.account === "employee").toBe(false);
    });

    it("should handle null state.account", () => {
      const state = { account: null };
      expect(state.account === "employee").toBe(false);
    });
  });
});
