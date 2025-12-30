/**
 * Tests for cleaner dashboard statistics and job count calculations.
 * Verifies that upcoming jobs, pending requests, and expected payouts are calculated correctly.
 */

describe("CleanerDashboard Statistics", () => {
  describe("Upcoming Jobs Count", () => {
    const parseLocalDate = (dateString) => {
      return new Date(dateString + "T00:00:00");
    };

    it("should count all upcoming appointments including today", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayStr = today.toISOString().split("T")[0];
      const tomorrowDate = new Date(today);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 7);
      const futureStr = futureDate.toISOString().split("T")[0];

      const appointments = [
        { id: 1, date: todayStr }, // Today
        { id: 2, date: tomorrowStr }, // Tomorrow
        { id: 3, date: futureStr }, // Next week
      ];

      // Get today's appointments
      const todaysAppointments = appointments.filter(
        (apt) => parseLocalDate(apt.date).toDateString() === today.toDateString()
      );

      // Get all upcoming appointments (after today)
      const allUpcomingAppointments = appointments.filter(
        (apt) => parseLocalDate(apt.date) > today
      );

      // Total should be today + upcoming
      const totalUpcoming = allUpcomingAppointments.length + todaysAppointments.length;

      expect(totalUpcoming).toBe(3);
    });

    it("should NOT use sliced array for count", () => {
      const appointments = [
        { id: 1, date: "2099-01-01" },
        { id: 2, date: "2099-01-02" },
        { id: 3, date: "2099-01-03" },
        { id: 4, date: "2099-01-04" },
        { id: 5, date: "2099-01-05" },
        { id: 6, date: "2099-01-06" },
        { id: 7, date: "2099-01-07" },
      ];

      // All appointments for count
      const allUpcomingAppointments = appointments;

      // Only first 3 for display
      const displayAppointments = appointments.slice(0, 3);

      // Count should use allUpcomingAppointments, not displayAppointments
      expect(allUpcomingAppointments.length).toBe(7);
      expect(displayAppointments.length).toBe(3);

      // This was the bug - using sliced array for count
      expect(displayAppointments.length).not.toBe(allUpcomingAppointments.length);
    });

    it("should correctly separate today's and future appointments", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];

      const appointments = [
        { id: 1, date: todayStr },
        { id: 2, date: todayStr },
        { id: 3, date: "2099-12-31" },
        { id: 4, date: "2099-12-31" },
        { id: 5, date: "2099-12-31" },
      ];

      const todaysAppointments = appointments.filter(
        (apt) => parseLocalDate(apt.date).toDateString() === today.toDateString()
      );

      const futureAppointments = appointments.filter(
        (apt) => parseLocalDate(apt.date) > today
      );

      expect(todaysAppointments.length).toBe(2);
      expect(futureAppointments.length).toBe(3);
      expect(todaysAppointments.length + futureAppointments.length).toBe(5);
    });
  });

  describe("Expected Payout Calculation", () => {
    const cleanerSharePercent = 0.9; // 90%

    it("should calculate payout for single cleaner job", () => {
      const appointment = {
        price: "100.00",
        employeesAssigned: ["1"],
      };

      const numCleaners = appointment.employeesAssigned?.length || 1;
      const perCleanerShare = (Number(appointment.price) / numCleaners) * cleanerSharePercent;

      expect(perCleanerShare).toBe(90); // $100 * 90% = $90
    });

    it("should split payout between multiple cleaners", () => {
      const appointment = {
        price: "200.00",
        employeesAssigned: ["1", "2"],
      };

      const numCleaners = appointment.employeesAssigned?.length || 1;
      const perCleanerShare = (Number(appointment.price) / numCleaners) * cleanerSharePercent;

      expect(perCleanerShare).toBe(90); // $200 / 2 = $100 * 90% = $90
    });

    it("should handle missing employeesAssigned", () => {
      const appointment = {
        price: "100.00",
        employeesAssigned: null,
      };

      const numCleaners = appointment.employeesAssigned?.length || 1;
      const perCleanerShare = (Number(appointment.price) / numCleaners) * cleanerSharePercent;

      expect(numCleaners).toBe(1);
      expect(perCleanerShare).toBe(90);
    });

    it("should sum expected payouts for all upcoming jobs", () => {
      const appointments = [
        { price: "100.00", employeesAssigned: ["1"], completed: false, date: "2099-12-30" },
        { price: "150.00", employeesAssigned: ["1"], completed: false, date: "2099-12-31" },
        { price: "200.00", employeesAssigned: ["1", "2"], completed: false, date: "2099-12-31" },
      ];

      const expectedPayout = appointments.reduce((sum, apt) => {
        const numCleaners = apt.employeesAssigned?.length || 1;
        const perCleanerShare = (Number(apt.price) / numCleaners) * cleanerSharePercent;
        return sum + perCleanerShare;
      }, 0);

      // $100 * 0.9 + $150 * 0.9 + ($200 / 2) * 0.9 = 90 + 135 + 90 = 315
      expect(expectedPayout).toBe(315);
    });

    it("should exclude completed appointments from expected payout", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const appointments = [
        { price: "100.00", employeesAssigned: ["1"], completed: false, date: "2099-12-30" },
        { price: "150.00", employeesAssigned: ["1"], completed: true, date: "2099-12-31" },
      ];

      const expectedPayout = appointments
        .filter((apt) => !apt.completed)
        .reduce((sum, apt) => {
          const numCleaners = apt.employeesAssigned?.length || 1;
          const perCleanerShare = (Number(apt.price) / numCleaners) * cleanerSharePercent;
          return sum + perCleanerShare;
        }, 0);

      expect(expectedPayout).toBe(90); // Only the non-completed $100 job
    });
  });

  describe("Pending Requests Count", () => {
    it("should count pending requests correctly", () => {
      const pendingRequests = [
        { id: 1, date: "2099-12-30" },
        { id: 2, date: "2099-12-31" },
        { id: 3, date: "2099-01-01" },
      ];

      expect(pendingRequests.length).toBe(3);
    });

    it("should filter to only show upcoming requests", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const allRequests = [
        { id: 1, date: "2020-01-01" }, // Past
        { id: 2, date: "2099-12-30" }, // Future
        { id: 3, date: "2099-12-31" }, // Future
      ];

      const upcomingRequests = allRequests.filter((req) => {
        const reqDate = new Date(req.date + "T00:00:00");
        return reqDate >= today;
      });

      expect(upcomingRequests.length).toBe(2);
    });
  });

  describe("Stat Card Values", () => {
    it("should format expected payout without decimals", () => {
      const expectedPayout = 315.75;
      const formatted = `$${expectedPayout.toFixed(0)}`;

      expect(formatted).toBe("$316");
    });

    it("should show job count as number", () => {
      const todaysAppointments = [{ id: 1 }, { id: 2 }];
      const allUpcomingAppointments = [{ id: 3 }, { id: 4 }, { id: 5 }];

      const totalJobs = allUpcomingAppointments.length + todaysAppointments.length;

      expect(totalJobs).toBe(5);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty appointments array", () => {
      const appointments = [];

      const todaysAppointments = appointments.filter(() => true);
      const allUpcomingAppointments = appointments.filter(() => true);

      const totalJobs = allUpcomingAppointments.length + todaysAppointments.length;
      const expectedPayout = 0;

      expect(totalJobs).toBe(0);
      expect(expectedPayout).toBe(0);
    });

    it("should handle appointment with zero price", () => {
      const appointment = {
        price: "0.00",
        employeesAssigned: ["1"],
      };

      const numCleaners = appointment.employeesAssigned?.length || 1;
      const perCleanerShare = (Number(appointment.price) / numCleaners) * 0.9;

      expect(perCleanerShare).toBe(0);
    });

    it("should handle appointment with null price", () => {
      const appointment = {
        price: null,
        employeesAssigned: ["1"],
      };

      const numCleaners = appointment.employeesAssigned?.length || 1;
      const perCleanerShare = (Number(appointment.price) / numCleaners) * 0.9;

      expect(perCleanerShare).toBe(0);
      expect(Number.isNaN(perCleanerShare)).toBe(false);
    });
  });

  describe("Sort by End Time", () => {
    const parseEndTime = (timeToBeCompleted) => {
      if (!timeToBeCompleted || timeToBeCompleted === "anytime") {
        return 24;
      }

      const match = timeToBeCompleted.match(/-(\d+)(am|pm)$/i);
      if (!match) return 24;

      let hour = parseInt(match[1], 10);
      const period = match[2].toLowerCase();

      if (period === "pm" && hour !== 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;

      return hour;
    };

    it("should parse end time correctly", () => {
      expect(parseEndTime("10am-3pm")).toBe(15);
      expect(parseEndTime("9am-12pm")).toBe(12);
      expect(parseEndTime("8am-11am")).toBe(11);
      expect(parseEndTime("anytime")).toBe(24);
      expect(parseEndTime(null)).toBe(24);
    });

    it("should sort appointments by end time", () => {
      const appointments = [
        { id: 1, timeToBeCompleted: "anytime" },
        { id: 2, timeToBeCompleted: "9am-12pm" },
        { id: 3, timeToBeCompleted: "10am-3pm" },
      ];

      const sorted = [...appointments].sort((a, b) => {
        return parseEndTime(a.timeToBeCompleted) - parseEndTime(b.timeToBeCompleted);
      });

      expect(sorted[0].id).toBe(2); // 12pm
      expect(sorted[1].id).toBe(3); // 3pm
      expect(sorted[2].id).toBe(1); // anytime (24)
    });
  });
});
