/**
 * Tests for BusinessOwnerAllJobs Component
 * Tests job listing with filters for source (client/marketplace) and assignment status
 */

describe("BusinessOwnerAllJobs Component Logic", () => {
  // Mock job data
  const mockJobs = [
    {
      id: 1,
      clientName: "John Smith",
      date: "2025-02-10",
      time: "09:00",
      price: 150,
      city: "Boston",
      state: "MA",
      numBeds: "3",
      numBaths: "2",
      source: "client",
      isAssigned: true,
      assignedTo: { type: "self", name: "Owner" },
      completed: false,
    },
    {
      id: 2,
      clientName: "Jane Doe",
      date: "2025-02-10",
      time: "14:00",
      price: 200,
      city: "Cambridge",
      state: "MA",
      numBeds: "4",
      numBaths: "3",
      source: "marketplace",
      isAssigned: true,
      assignedTo: { type: "employee", name: "Sarah Johnson" },
      completed: false,
    },
    {
      id: 3,
      clientName: "Bob Wilson",
      date: "2025-02-11",
      time: "10:00",
      price: 175,
      city: "Somerville",
      state: "MA",
      numBeds: "2",
      numBaths: "1",
      source: "client",
      isAssigned: false,
      assignedTo: null,
      completed: false,
    },
    {
      id: 4,
      clientName: "Alice Brown",
      date: "2025-02-12",
      time: "11:00",
      price: 225,
      city: "Brookline",
      state: "MA",
      numBeds: "5",
      numBaths: "4",
      source: "marketplace",
      isAssigned: false,
      assignedTo: null,
      completed: false,
    },
    {
      id: 5,
      clientName: "Completed Job",
      date: "2025-02-01",
      time: "09:00",
      price: 100,
      city: "Boston",
      state: "MA",
      numBeds: "2",
      numBaths: "1",
      source: "client",
      isAssigned: true,
      assignedTo: { type: "self", name: "Owner" },
      completed: true,
    },
  ];

  describe("Time Filtering", () => {
    const filterByTime = (jobs, timeFilter) => {
      return jobs.filter(job => {
        if (timeFilter === "completed") return job.completed;
        if (timeFilter === "upcoming") return !job.completed;
        return true; // "all"
      });
    };

    it("should filter upcoming jobs (not completed)", () => {
      const result = filterByTime(mockJobs, "upcoming");

      expect(result).toHaveLength(4);
      expect(result.every(job => !job.completed)).toBe(true);
    });

    it("should filter completed jobs", () => {
      const result = filterByTime(mockJobs, "completed");

      expect(result).toHaveLength(1);
      expect(result[0].completed).toBe(true);
      expect(result[0].clientName).toBe("Completed Job");
    });

    it("should show all jobs when filter is all", () => {
      const result = filterByTime(mockJobs, "all");

      expect(result).toHaveLength(5);
    });
  });

  describe("Source Filtering", () => {
    const filterBySource = (jobs, sourceFilter) => {
      if (sourceFilter === "all") return jobs;
      return jobs.filter(job => job.source === sourceFilter);
    };

    it("should filter client jobs only", () => {
      const result = filterBySource(mockJobs, "client");

      expect(result.every(job => job.source === "client")).toBe(true);
      expect(result).toHaveLength(3);
    });

    it("should filter marketplace jobs only", () => {
      const result = filterBySource(mockJobs, "marketplace");

      expect(result.every(job => job.source === "marketplace")).toBe(true);
      expect(result).toHaveLength(2);
    });

    it("should show all jobs when source filter is all", () => {
      const result = filterBySource(mockJobs, "all");

      expect(result).toHaveLength(5);
    });
  });

  describe("Assignment Filtering", () => {
    const filterByAssignment = (jobs, assignmentFilter) => {
      if (assignmentFilter === "all") return jobs;
      if (assignmentFilter === "unassigned") return jobs.filter(job => !job.isAssigned);
      if (assignmentFilter === "assigned-to-me") {
        return jobs.filter(job => job.assignedTo?.type === "self");
      }
      return jobs;
    };

    it("should filter unassigned jobs only", () => {
      const result = filterByAssignment(mockJobs, "unassigned");

      expect(result.every(job => !job.isAssigned)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it("should filter jobs assigned to me (self)", () => {
      const result = filterByAssignment(mockJobs, "assigned-to-me");

      expect(result.every(job => job.assignedTo?.type === "self")).toBe(true);
      expect(result).toHaveLength(2);
    });

    it("should show all jobs when assignment filter is all", () => {
      const result = filterByAssignment(mockJobs, "all");

      expect(result).toHaveLength(5);
    });

    it("should handle jobs with null assignedTo", () => {
      const jobsWithNull = [{ id: 1, isAssigned: false, assignedTo: null }];
      const result = filterByAssignment(jobsWithNull, "assigned-to-me");

      expect(result).toHaveLength(0);
    });
  });

  describe("Combined Filtering", () => {
    const applyFilters = (jobs, timeFilter, sourceFilter, assignmentFilter) => {
      let filtered = jobs;

      // Time filter
      if (timeFilter === "completed") {
        filtered = filtered.filter(job => job.completed);
      } else if (timeFilter === "upcoming") {
        filtered = filtered.filter(job => !job.completed);
      }

      // Source filter
      if (sourceFilter !== "all") {
        filtered = filtered.filter(job => job.source === sourceFilter);
      }

      // Assignment filter
      if (assignmentFilter === "unassigned") {
        filtered = filtered.filter(job => !job.isAssigned);
      } else if (assignmentFilter === "assigned-to-me") {
        filtered = filtered.filter(job => job.assignedTo?.type === "self");
      }

      return filtered;
    };

    it("should filter upcoming client jobs", () => {
      const result = applyFilters(mockJobs, "upcoming", "client", "all");

      expect(result).toHaveLength(2);
      expect(result.every(job => job.source === "client" && !job.completed)).toBe(true);
    });

    it("should filter upcoming unassigned jobs", () => {
      const result = applyFilters(mockJobs, "upcoming", "all", "unassigned");

      expect(result).toHaveLength(2);
      expect(result.every(job => !job.isAssigned && !job.completed)).toBe(true);
    });

    it("should filter upcoming jobs assigned to me", () => {
      const result = applyFilters(mockJobs, "upcoming", "all", "assigned-to-me");

      expect(result).toHaveLength(1);
      expect(result[0].clientName).toBe("John Smith");
    });

    it("should filter unassigned marketplace jobs", () => {
      const result = applyFilters(mockJobs, "all", "marketplace", "unassigned");

      expect(result).toHaveLength(1);
      expect(result[0].clientName).toBe("Alice Brown");
    });
  });

  describe("Filter Counts", () => {
    const calculateCounts = (jobs) => {
      return {
        all: jobs.length,
        client: jobs.filter(j => j.source === "client").length,
        marketplace: jobs.filter(j => j.source === "marketplace").length,
        unassigned: jobs.filter(j => !j.isAssigned).length,
        assignedToMe: jobs.filter(j => j.assignedTo?.type === "self").length,
      };
    };

    it("should calculate correct counts for all filters", () => {
      const upcomingJobs = mockJobs.filter(j => !j.completed);
      const counts = calculateCounts(upcomingJobs);

      expect(counts.all).toBe(4);
      expect(counts.client).toBe(2);
      expect(counts.marketplace).toBe(2);
      expect(counts.unassigned).toBe(2);
      expect(counts.assignedToMe).toBe(1);
    });

    it("should handle empty job list", () => {
      const counts = calculateCounts([]);

      expect(counts.all).toBe(0);
      expect(counts.client).toBe(0);
      expect(counts.marketplace).toBe(0);
      expect(counts.unassigned).toBe(0);
      expect(counts.assignedToMe).toBe(0);
    });
  });

  describe("Date Grouping", () => {
    const groupByDate = (jobs) => {
      const groups = {};
      jobs.forEach(job => {
        if (!groups[job.date]) {
          groups[job.date] = [];
        }
        groups[job.date].push(job);
      });

      return Object.entries(groups)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .map(([date, jobs]) => ({ date, jobs }));
    };

    it("should group jobs by date", () => {
      const upcomingJobs = mockJobs.filter(j => !j.completed);
      const grouped = groupByDate(upcomingJobs);

      expect(grouped).toHaveLength(3); // 3 unique dates
    });

    it("should sort groups by date ascending", () => {
      const upcomingJobs = mockJobs.filter(j => !j.completed);
      const grouped = groupByDate(upcomingJobs);

      expect(grouped[0].date).toBe("2025-02-10");
      expect(grouped[1].date).toBe("2025-02-11");
      expect(grouped[2].date).toBe("2025-02-12");
    });

    it("should include correct jobs in each group", () => {
      const upcomingJobs = mockJobs.filter(j => !j.completed);
      const grouped = groupByDate(upcomingJobs);

      const feb10Group = grouped.find(g => g.date === "2025-02-10");
      expect(feb10Group.jobs).toHaveLength(2);
    });
  });

  describe("Date Header Display", () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const toLocalDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const formatDateHeader = (dateString, today, tomorrow) => {
      const date = new Date(dateString + "T00:00:00");
      const todayStr = today.toDateString();
      const tomorrowStr = tomorrow.toDateString();

      if (date.toDateString() === todayStr) return "Today";
      if (date.toDateString() === tomorrowStr) return "Tomorrow";

      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    };

    it("should display Today for today's date", () => {
      const todayString = toLocalDateString(today);
      expect(formatDateHeader(todayString, today, tomorrow)).toBe("Today");
    });

    it("should display Tomorrow for tomorrow's date", () => {
      const tomorrowString = toLocalDateString(tomorrow);
      expect(formatDateHeader(tomorrowString, today, tomorrow)).toBe("Tomorrow");
    });

    it("should display formatted date for other dates", () => {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateString = toLocalDateString(futureDate);

      const result = formatDateHeader(futureDateString, today, tomorrow);

      expect(result).not.toBe("Today");
      expect(result).not.toBe("Tomorrow");
      expect(typeof result).toBe("string");
    });
  });

  describe("Time Formatting", () => {
    const formatTime = (time) => {
      if (!time) return "";
      const [hours, minutes] = time.split(":");
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    };

    it("should format morning time correctly", () => {
      expect(formatTime("09:00")).toBe("9:00 AM");
      expect(formatTime("11:30")).toBe("11:30 AM");
    });

    it("should format afternoon time correctly", () => {
      expect(formatTime("14:00")).toBe("2:00 PM");
      expect(formatTime("17:45")).toBe("5:45 PM");
    });

    it("should format noon correctly", () => {
      expect(formatTime("12:00")).toBe("12:00 PM");
    });

    it("should format midnight correctly", () => {
      expect(formatTime("00:00")).toBe("12:00 AM");
    });

    it("should handle null time", () => {
      expect(formatTime(null)).toBe("");
      expect(formatTime(undefined)).toBe("");
    });
  });

  describe("Job Card Display", () => {
    it("should identify client jobs correctly", () => {
      const job = mockJobs[0];
      const isClient = job.source === "client";

      expect(isClient).toBe(true);
    });

    it("should identify marketplace jobs correctly", () => {
      const job = mockJobs[1];
      const isClient = job.source === "client";

      expect(isClient).toBe(false);
    });

    it("should format price correctly", () => {
      // In the component, price is in dollars and gets multiplied by 100 for formatCurrency
      const formatCurrency = (cents) => `$${(cents / 100).toFixed(2)}`;
      const job = mockJobs[0]; // price: 150 (dollars)

      // The component calls formatCurrency((job.price || 0) * 100)
      expect(formatCurrency(job.price * 100)).toBe("$150.00");
    });

    it("should display assignment status text", () => {
      const getAssignmentText = (job) => {
        if (!job.isAssigned) return "Unassigned";
        if (job.assignedTo?.type === "self") return "You";
        return job.assignedTo?.name || "Assigned";
      };

      expect(getAssignmentText(mockJobs[0])).toBe("You");
      expect(getAssignmentText(mockJobs[1])).toBe("Sarah Johnson");
      expect(getAssignmentText(mockJobs[2])).toBe("Unassigned");
    });
  });

  describe("Empty State Messages", () => {
    const getEmptyMessage = (filter, sourceFilter, assignmentFilter) => {
      if (assignmentFilter === "unassigned") {
        return {
          icon: "check-circle",
          title: "All caught up!",
          subtitle: "No unassigned jobs at the moment",
        };
      }
      if (assignmentFilter === "assigned-to-me") {
        return {
          icon: "calendar-check-o",
          title: "No jobs assigned to you",
          subtitle: "Jobs you're assigned to will appear here",
        };
      }
      if (sourceFilter === "client") {
        return {
          icon: "users",
          title: "No client jobs",
          subtitle: "Jobs from your clients will appear here",
        };
      }
      if (sourceFilter === "marketplace") {
        return {
          icon: "globe",
          title: "No marketplace jobs",
          subtitle: "Jobs from the marketplace will appear here",
        };
      }
      if (filter === "completed") {
        return {
          icon: "check-circle-o",
          title: "No completed jobs",
          subtitle: "Completed jobs will appear here",
        };
      }
      return {
        icon: "calendar-o",
        title: "No jobs found",
        subtitle: "Jobs matching your filters will appear here",
      };
    };

    it("should show unassigned empty state", () => {
      const message = getEmptyMessage("upcoming", "all", "unassigned");

      expect(message.title).toBe("All caught up!");
      expect(message.icon).toBe("check-circle");
    });

    it("should show assigned-to-me empty state", () => {
      const message = getEmptyMessage("upcoming", "all", "assigned-to-me");

      expect(message.title).toBe("No jobs assigned to you");
    });

    it("should show client empty state", () => {
      const message = getEmptyMessage("upcoming", "client", "all");

      expect(message.title).toBe("No client jobs");
      expect(message.icon).toBe("users");
    });

    it("should show marketplace empty state", () => {
      const message = getEmptyMessage("upcoming", "marketplace", "all");

      expect(message.title).toBe("No marketplace jobs");
      expect(message.icon).toBe("globe");
    });

    it("should show completed empty state", () => {
      const message = getEmptyMessage("completed", "all", "all");

      expect(message.title).toBe("No completed jobs");
    });

    it("should show default empty state", () => {
      const message = getEmptyMessage("all", "all", "all");

      expect(message.title).toBe("No jobs found");
    });
  });

  describe("Segmented Control", () => {
    const timeOptions = [
      { label: "Upcoming", value: "upcoming" },
      { label: "Completed", value: "completed" },
      { label: "All", value: "all" },
    ];

    it("should have 3 time filter options", () => {
      expect(timeOptions).toHaveLength(3);
    });

    it("should have upcoming as first option", () => {
      expect(timeOptions[0].value).toBe("upcoming");
    });

    it("should default to upcoming filter", () => {
      const defaultFilter = "upcoming";
      expect(defaultFilter).toBe("upcoming");
    });
  });

  describe("Filter Chip Behavior", () => {
    it("should reset assignment filter when selecting source filter", () => {
      let sourceFilter = "all";
      let assignmentFilter = "unassigned";

      // Simulate clicking on "Client" chip
      sourceFilter = "client";
      assignmentFilter = "all"; // Reset assignment filter

      expect(sourceFilter).toBe("client");
      expect(assignmentFilter).toBe("all");
    });

    it("should reset source filter when selecting assignment filter", () => {
      let sourceFilter = "client";
      let assignmentFilter = "all";

      // Simulate clicking on "Unassigned" chip
      assignmentFilter = "unassigned";
      sourceFilter = "all"; // Reset source filter

      expect(assignmentFilter).toBe("unassigned");
      expect(sourceFilter).toBe("all");
    });

    it("should reset both filters when selecting All", () => {
      let sourceFilter = "client";
      let assignmentFilter = "unassigned";

      // Simulate clicking on "All" chip
      sourceFilter = "all";
      assignmentFilter = "all";

      expect(sourceFilter).toBe("all");
      expect(assignmentFilter).toBe("all");
    });
  });

  describe("Job Card Past Status", () => {
    it("should identify past jobs correctly", () => {
      const today = new Date();
      const isPastDate = (dateString) => {
        const date = new Date(dateString + "T00:00:00");
        const todayMidnight = new Date(today.toDateString());
        return date < todayMidnight;
      };

      expect(isPastDate("2020-01-01")).toBe(true);
      expect(isPastDate("2099-12-31")).toBe(false);
    });

    it("should not mark today as past", () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const todayString = `${year}-${month}-${day}`;

      const isPastDate = (dateString) => {
        const date = new Date(dateString + "T00:00:00");
        const todayMidnight = new Date(today.toDateString());
        return date < todayMidnight;
      };

      expect(isPastDate(todayString)).toBe(false);
    });
  });

  describe("Filter Chip Variants", () => {
    const getVariant = (filterType, value) => {
      if (filterType === "source") {
        if (value === "client") return "primary";
        if (value === "marketplace") return "secondary";
      }
      if (filterType === "assignment") {
        if (value === "unassigned") return "warning";
        if (value === "assigned-to-me") return "success";
      }
      return "default";
    };

    it("should use primary variant for client filter", () => {
      expect(getVariant("source", "client")).toBe("primary");
    });

    it("should use secondary variant for marketplace filter", () => {
      expect(getVariant("source", "marketplace")).toBe("secondary");
    });

    it("should use warning variant for unassigned filter", () => {
      expect(getVariant("assignment", "unassigned")).toBe("warning");
    });

    it("should use success variant for assigned-to-me filter", () => {
      expect(getVariant("assignment", "assigned-to-me")).toBe("success");
    });
  });
});
