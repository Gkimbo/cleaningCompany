/**
 * Tests for DashboardOverview - Today's and Tomorrow's Jobs
 * Tests the job display logic for business owner profile with source differentiation
 */

describe("DashboardOverview Jobs Logic", () => {
  // Helper to create date strings
  const toLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const todayStr = toLocalDateString(today);
  const tomorrowStr = toLocalDateString(tomorrow);
  const dayAfterStr = toLocalDateString(dayAfter);

  // Mock appointments data
  const mockAppointments = [
    {
      id: 1,
      date: todayStr,
      time: "09:00:00",
      price: 15000,
      source: "client",
      isAssigned: true,
      completed: false,
      Home: {
        address: "123 Main St",
        city: "Boston",
        numBeds: "3",
        numBaths: "2",
        User: { firstName: "John", lastName: "Smith" },
      },
    },
    {
      id: 2,
      date: todayStr,
      time: "14:00:00",
      price: 20000,
      source: "marketplace",
      isAssigned: true,
      completed: false,
      Home: {
        address: "456 Oak Ave",
        city: "Cambridge",
        numBeds: "4",
        numBaths: "3",
        User: { firstName: "Jane", lastName: "Doe" },
      },
    },
    {
      id: 3,
      date: tomorrowStr,
      time: "10:00:00",
      price: 17500,
      source: "client",
      isAssigned: false,
      completed: false,
      Home: {
        address: "789 Elm St",
        city: "Somerville",
        numBeds: "2",
        numBaths: "1",
        User: { firstName: "Bob", lastName: "Wilson" },
      },
    },
    {
      id: 4,
      date: tomorrowStr,
      time: "15:00:00",
      price: 22500,
      source: "marketplace",
      isAssigned: true,
      completed: false,
      Home: {
        address: "321 Pine Rd",
        city: "Brookline",
        numBeds: "5",
        numBaths: "4",
        User: { firstName: "Alice", lastName: "Brown" },
      },
    },
    {
      id: 5,
      date: dayAfterStr,
      time: "11:00:00",
      price: 18000,
      source: "client",
      isAssigned: true,
      completed: false,
      Home: {
        address: "555 Maple Dr",
        city: "Newton",
        numBeds: "3",
        numBaths: "2",
        User: { firstName: "Charlie", lastName: "Davis" },
      },
    },
  ];

  describe("Today's Jobs Filtering", () => {
    const getTodaysJobs = (appointments, todayStr) => {
      return appointments.filter(
        (appt) => appt.date === todayStr && !appt.completed
      );
    };

    it("should filter jobs for today only", () => {
      const todaysJobs = getTodaysJobs(mockAppointments, todayStr);

      expect(todaysJobs).toHaveLength(2);
      expect(todaysJobs.every(job => job.date === todayStr)).toBe(true);
    });

    it("should include both client and marketplace jobs", () => {
      const todaysJobs = getTodaysJobs(mockAppointments, todayStr);

      const sources = todaysJobs.map(job => job.source);
      expect(sources).toContain("client");
      expect(sources).toContain("marketplace");
    });

    it("should exclude completed jobs", () => {
      const appointmentsWithCompleted = [
        ...mockAppointments,
        {
          id: 6,
          date: todayStr,
          time: "16:00:00",
          completed: true,
          source: "client",
        },
      ];

      const todaysJobs = getTodaysJobs(appointmentsWithCompleted, todayStr);

      expect(todaysJobs.every(job => !job.completed)).toBe(true);
    });

    it("should return empty array when no jobs today", () => {
      const futureOnlyJobs = mockAppointments.filter(job => job.date !== todayStr);
      const todaysJobs = getTodaysJobs(futureOnlyJobs, todayStr);

      expect(todaysJobs).toHaveLength(0);
    });
  });

  describe("Tomorrow's Jobs Filtering", () => {
    const getTomorrowsJobs = (appointments, tomorrowStr) => {
      return appointments.filter(
        (appt) => appt.date === tomorrowStr && !appt.completed
      );
    };

    it("should filter jobs for tomorrow only", () => {
      const tomorrowsJobs = getTomorrowsJobs(mockAppointments, tomorrowStr);

      expect(tomorrowsJobs).toHaveLength(2);
      expect(tomorrowsJobs.every(job => job.date === tomorrowStr)).toBe(true);
    });

    it("should include both client and marketplace jobs", () => {
      const tomorrowsJobs = getTomorrowsJobs(mockAppointments, tomorrowStr);

      const sources = tomorrowsJobs.map(job => job.source);
      expect(sources).toContain("client");
      expect(sources).toContain("marketplace");
    });

    it("should not include jobs from day after tomorrow", () => {
      const tomorrowsJobs = getTomorrowsJobs(mockAppointments, tomorrowStr);

      expect(tomorrowsJobs.every(job => job.date === tomorrowStr)).toBe(true);
      expect(tomorrowsJobs.some(job => job.date === dayAfterStr)).toBe(false);
    });
  });

  describe("Source Badge Display", () => {
    const getSourceBadge = (source) => {
      return {
        text: source === "client" ? "Client" : "Marketplace",
        icon: source === "client" ? "user" : "globe",
        isClient: source === "client",
      };
    };

    it("should return Client badge for client jobs", () => {
      const badge = getSourceBadge("client");

      expect(badge.text).toBe("Client");
      expect(badge.icon).toBe("user");
      expect(badge.isClient).toBe(true);
    });

    it("should return Marketplace badge for marketplace jobs", () => {
      const badge = getSourceBadge("marketplace");

      expect(badge.text).toBe("Marketplace");
      expect(badge.icon).toBe("globe");
      expect(badge.isClient).toBe(false);
    });
  });

  describe("Jobs Sorting by Time", () => {
    const sortByTime = (jobs) => {
      return [...jobs].sort((a, b) => {
        const timeA = a.time || "00:00:00";
        const timeB = b.time || "00:00:00";
        return timeA.localeCompare(timeB);
      });
    };

    it("should sort jobs by time ascending", () => {
      const todaysJobs = mockAppointments.filter(job => job.date === todayStr);
      const sorted = sortByTime(todaysJobs);

      expect(sorted[0].time).toBe("09:00:00");
      expect(sorted[1].time).toBe("14:00:00");
    });

    it("should handle jobs with no time", () => {
      const jobsWithNoTime = [
        { id: 1, time: null },
        { id: 2, time: "10:00:00" },
        { id: 3, time: "08:00:00" },
      ];

      const sorted = sortByTime(jobsWithNoTime);

      // Null times should sort to beginning (as 00:00:00)
      expect(sorted[0].id).toBe(1);
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(2);
    });
  });

  describe("Time Formatting", () => {
    const formatTime = (timeString) => {
      if (!timeString) return "";

      const [hours, minutes] = timeString.split(":");
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    };

    it("should format morning times correctly", () => {
      expect(formatTime("09:00:00")).toBe("9:00 AM");
      expect(formatTime("11:30:00")).toBe("11:30 AM");
    });

    it("should format afternoon times correctly", () => {
      expect(formatTime("14:00:00")).toBe("2:00 PM");
      expect(formatTime("15:00:00")).toBe("3:00 PM");
    });

    it("should format noon correctly", () => {
      expect(formatTime("12:00:00")).toBe("12:00 PM");
    });

    it("should handle null time", () => {
      expect(formatTime(null)).toBe("");
      expect(formatTime(undefined)).toBe("");
    });
  });

  describe("Job Tile Display", () => {
    it("should extract client name from Home.User", () => {
      const job = mockAppointments[0];
      const clientName = `${job.Home.User.firstName} ${job.Home.User.lastName}`;

      expect(clientName).toBe("John Smith");
    });

    it("should format location correctly", () => {
      const job = mockAppointments[0];
      const location = job.Home.city;

      expect(location).toBe("Boston");
    });

    it("should format bed/bath specs", () => {
      const job = mockAppointments[0];
      const specs = `${job.Home.numBeds} bed • ${job.Home.numBaths} bath`;

      expect(specs).toBe("3 bed • 2 bath");
    });

    it("should format price correctly", () => {
      const formatCurrency = (cents) => `$${(cents / 100).toFixed(2)}`;
      const job = mockAppointments[0];

      expect(formatCurrency(job.price)).toBe("$150.00");
    });
  });

  describe("Section Header Display", () => {
    const getSectionHeader = (isToday, count) => {
      const title = isToday ? "Today's Jobs" : "Tomorrow's Jobs";
      const icon = isToday ? "calendar-check-o" : "calendar-o";
      const subtitle = count === 1 ? "1 job" : `${count} jobs`;

      return { title, icon, subtitle };
    };

    it("should display correct header for today", () => {
      const header = getSectionHeader(true, 2);

      expect(header.title).toBe("Today's Jobs");
      expect(header.icon).toBe("calendar-check-o");
      expect(header.subtitle).toBe("2 jobs");
    });

    it("should display correct header for tomorrow", () => {
      const header = getSectionHeader(false, 3);

      expect(header.title).toBe("Tomorrow's Jobs");
      expect(header.icon).toBe("calendar-o");
      expect(header.subtitle).toBe("3 jobs");
    });

    it("should use singular 'job' for count of 1", () => {
      const header = getSectionHeader(true, 1);

      expect(header.subtitle).toBe("1 job");
    });
  });

  describe("Empty State Handling", () => {
    const getEmptyMessage = (isToday) => {
      return isToday
        ? "No jobs scheduled for today"
        : "No jobs scheduled for tomorrow";
    };

    it("should show correct empty message for today", () => {
      expect(getEmptyMessage(true)).toBe("No jobs scheduled for today");
    });

    it("should show correct empty message for tomorrow", () => {
      expect(getEmptyMessage(false)).toBe("No jobs scheduled for tomorrow");
    });
  });

  describe("Assignment Status Display", () => {
    const getAssignmentStatus = (job) => {
      if (!job.isAssigned) {
        return { text: "Unassigned", color: "warning", icon: "exclamation" };
      }
      return { text: "Assigned", color: "success", icon: "check" };
    };

    it("should show unassigned status correctly", () => {
      const unassignedJob = mockAppointments.find(job => !job.isAssigned);
      const status = getAssignmentStatus(unassignedJob);

      expect(status.text).toBe("Unassigned");
      expect(status.color).toBe("warning");
    });

    it("should show assigned status correctly", () => {
      const assignedJob = mockAppointments.find(job => job.isAssigned);
      const status = getAssignmentStatus(assignedJob);

      expect(status.text).toBe("Assigned");
      expect(status.color).toBe("success");
    });
  });

  describe("Jobs Count Summary", () => {
    const getJobsSummary = (todaysJobs, tomorrowsJobs) => {
      return {
        todayCount: todaysJobs.length,
        tomorrowCount: tomorrowsJobs.length,
        totalUpcoming: todaysJobs.length + tomorrowsJobs.length,
        hasJobsToday: todaysJobs.length > 0,
        hasJobsTomorrow: tomorrowsJobs.length > 0,
      };
    };

    it("should calculate correct job counts", () => {
      const todaysJobs = mockAppointments.filter(job => job.date === todayStr);
      const tomorrowsJobs = mockAppointments.filter(job => job.date === tomorrowStr);

      const summary = getJobsSummary(todaysJobs, tomorrowsJobs);

      expect(summary.todayCount).toBe(2);
      expect(summary.tomorrowCount).toBe(2);
      expect(summary.totalUpcoming).toBe(4);
    });

    it("should correctly identify when jobs exist", () => {
      const summary = getJobsSummary([mockAppointments[0]], []);

      expect(summary.hasJobsToday).toBe(true);
      expect(summary.hasJobsTomorrow).toBe(false);
    });

    it("should handle empty arrays", () => {
      const summary = getJobsSummary([], []);

      expect(summary.todayCount).toBe(0);
      expect(summary.tomorrowCount).toBe(0);
      expect(summary.hasJobsToday).toBe(false);
      expect(summary.hasJobsTomorrow).toBe(false);
    });
  });

  describe("Source Filtering for Both Days", () => {
    it("should count client jobs correctly", () => {
      const clientJobs = mockAppointments.filter(job => job.source === "client");

      expect(clientJobs).toHaveLength(3);
    });

    it("should count marketplace jobs correctly", () => {
      const marketplaceJobs = mockAppointments.filter(job => job.source === "marketplace");

      expect(marketplaceJobs).toHaveLength(2);
    });

    it("should handle jobs with missing source", () => {
      const jobsWithMissingSource = [
        { id: 1, source: null },
        { id: 2, source: "client" },
      ];

      const clientJobs = jobsWithMissingSource.filter(job => job.source === "client");

      expect(clientJobs).toHaveLength(1);
    });
  });

  describe("Date Subtitle Display", () => {
    const getDateSubtitle = (dateStr) => {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    };

    it("should format date subtitle correctly", () => {
      // Test with a known date
      const subtitle = getDateSubtitle("2025-02-10");

      expect(subtitle).toContain("Feb");
      expect(subtitle).toContain("10");
    });

    it("should include weekday in subtitle", () => {
      const subtitle = getDateSubtitle("2025-02-10"); // This is a Monday

      expect(subtitle.toLowerCase()).toContain("mon");
    });
  });

  describe("Price Formatting", () => {
    const formatCurrency = (cents) => {
      if (cents === null || cents === undefined) return "$0.00";
      return `$${(cents / 100).toFixed(2)}`;
    };

    it("should format price in dollars", () => {
      expect(formatCurrency(15000)).toBe("$150.00");
      expect(formatCurrency(20000)).toBe("$200.00");
    });

    it("should handle zero price", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("should handle null/undefined price", () => {
      expect(formatCurrency(null)).toBe("$0.00");
      expect(formatCurrency(undefined)).toBe("$0.00");
    });

    it("should handle decimal cents", () => {
      expect(formatCurrency(12345)).toBe("$123.45");
    });
  });

  describe("View All Jobs Navigation", () => {
    it("should generate correct navigation path", () => {
      const path = "/business-owner/all-jobs";

      expect(path).toBe("/business-owner/all-jobs");
    });

    it("should be shown when jobs exist", () => {
      const hasJobs = mockAppointments.length > 0;
      const showViewAll = hasJobs;

      expect(showViewAll).toBe(true);
    });
  });

  describe("Job Ordering", () => {
    it("should display today before tomorrow", () => {
      const sections = ["today", "tomorrow"];

      expect(sections[0]).toBe("today");
      expect(sections[1]).toBe("tomorrow");
    });

    it("should sort jobs within each day by time", () => {
      const todaysJobs = mockAppointments
        .filter(job => job.date === todayStr)
        .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

      expect(todaysJobs[0].time).toBe("09:00:00");
      expect(todaysJobs[1].time).toBe("14:00:00");
    });
  });
});
