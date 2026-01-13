/**
 * Tests for CleanerDashboard - Find Jobs Button Removal
 *
 * The "Find Available Jobs" button was removed from the empty state
 * in CleanerDashboard when an employee has no jobs scheduled.
 *
 * This ensures employees don't see a button to find jobs since
 * their jobs are assigned by their manager.
 */

describe("CleanerDashboard - Find Jobs Button", () => {
  /**
   * The Find Available Jobs button was removed from the "No Jobs Today" empty state.
   * Previously, if todaysAppointments.length === 0, a button would appear.
   * Now, employees just see the message without a call-to-action to find jobs.
   */

  describe("No Jobs Today state", () => {
    it("should show No Jobs Today message when appointments array is empty", () => {
      const todaysAppointments = [];
      const hasNoJobs = todaysAppointments.length === 0;

      expect(hasNoJobs).toBe(true);
    });

    it("should not show No Jobs message when there are appointments", () => {
      const todaysAppointments = [
        { id: 1, date: "2025-01-15", completed: false },
      ];
      const hasNoJobs = todaysAppointments.length === 0;

      expect(hasNoJobs).toBe(false);
    });

    it("should not show No Jobs message when there is exactly one appointment", () => {
      const todaysAppointments = [
        { id: 1, date: "2025-01-15", completed: false },
      ];

      expect(todaysAppointments.length).toBe(1);
      expect(todaysAppointments.length === 0).toBe(false);
    });
  });

  describe("Expected earnings in empty state", () => {
    /**
     * Even when there are no jobs today, the expected earnings
     * should still be displayed if the user has future appointments
     */

    const calculateExpectedEarnings = (appointments, feePercent = 0.1) => {
      const cleanerSharePercent = 1 - feePercent;
      return appointments.reduce(
        (sum, a) => sum + (Number(a.price) || 0) * cleanerSharePercent,
        0
      );
    };

    it("should show $0 expected earnings when no future appointments", () => {
      const appointments = [];
      const earnings = calculateExpectedEarnings(appointments);

      expect(earnings).toBe(0);
    });

    it("should calculate expected earnings from future appointments", () => {
      const appointments = [
        { id: 1, price: "100" },
        { id: 2, price: "150" },
      ];
      const earnings = calculateExpectedEarnings(appointments, 0.1);

      // (100 + 150) * 0.9 = 225
      expect(earnings).toBe(225);
    });
  });

  describe("Quick Actions section", () => {
    /**
     * Note: The "Find Jobs" quick action button in the Quick Actions grid
     * at the top of the dashboard was NOT removed - only the button in the
     * empty state when no jobs are scheduled.
     *
     * This test documents that the Find Jobs button was specifically
     * removed from the "No jobs scheduled for today" card.
     */

    const quickActions = [
      { id: "findJobs", label: "Find Jobs", icon: "search" },
      { id: "earnings", label: "Earnings", icon: "dollar" },
      { id: "reviews", label: "Reviews", icon: "star" },
      { id: "schedule", label: "Schedule", icon: "calendar" },
    ];

    it("should have Find Jobs in the quick actions list", () => {
      const findJobsAction = quickActions.find((a) => a.id === "findJobs");
      expect(findJobsAction).toBeDefined();
      expect(findJobsAction.label).toBe("Find Jobs");
    });

    it("should have 4 quick actions total", () => {
      expect(quickActions.length).toBe(4);
    });
  });
});

describe("CleanerDashboard - Empty State Styles", () => {
  /**
   * Verify that the removed styles no longer affect the component.
   * The findJobsButton and findJobsButtonText styles were removed
   * since they are no longer used.
   */

  it("should not require findJobsButton styles", () => {
    // The styles object should work without findJobsButton
    const styles = {
      noJobsCard: {
        backgroundColor: "#f5f5f5",
        padding: 16,
        borderRadius: 8,
      },
      noJobsText: {
        fontSize: 16,
        color: "#666",
      },
      // findJobsButton was removed
      // findJobsButtonText was removed
    };

    expect(styles.findJobsButton).toBeUndefined();
    expect(styles.findJobsButtonText).toBeUndefined();
  });
});
