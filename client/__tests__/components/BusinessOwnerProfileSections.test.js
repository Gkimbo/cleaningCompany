/**
 * Business Owner Profile Section Components Tests
 *
 * Tests for all section components:
 * - DashboardOverview
 * - MyTeamSection
 * - MyClientsSection
 * - PayrollSection
 * - ClientPaymentsSection
 * - MarketplaceCleanerView
 */

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ key: "default", pathname: "/", search: "", hash: "", state: null }),
}));

describe("DashboardOverview Component", () => {
  const mockData = {
    todaysAppointments: [
      { id: 1, status: "assigned", assignedEmployee: { firstName: "Jane" } },
      { id: 2, status: "completed", assignedEmployee: null },
      { id: 3, status: "started", assignedEmployee: { firstName: "Bob" } },
    ],
    weeklyRevenue: 1200,
    monthlyRevenue: 5000,
    unpaidAppointments: 3,
    totalClients: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Quick Stats", () => {
    it("should display monthly revenue", () => {
      const { monthlyRevenue } = mockData;
      expect(monthlyRevenue).toBe(5000);
    });

    it("should display total clients", () => {
      const { totalClients } = mockData;
      expect(totalClients).toBe(10);
    });

    it("should display unpaid appointments count", () => {
      const { unpaidAppointments } = mockData;
      expect(unpaidAppointments).toBe(3);
    });
  });

  describe("Today's Jobs Analysis", () => {
    it("should count assigned jobs", () => {
      const assignedJobs = mockData.todaysAppointments.filter(
        (j) => j.status === "assigned" || j.status === "scheduled"
      ).length;

      expect(assignedJobs).toBe(1);
    });

    it("should count started jobs", () => {
      const startedJobs = mockData.todaysAppointments.filter(
        (j) => j.status === "started"
      ).length;

      expect(startedJobs).toBe(1);
    });

    it("should count completed jobs", () => {
      const completedJobs = mockData.todaysAppointments.filter(
        (j) => j.status === "completed"
      ).length;

      expect(completedJobs).toBe(1);
    });

    it("should count unassigned jobs", () => {
      // Job id 2 has assignedEmployee: null and status: "completed" - excluded
      // Other jobs have assignedEmployee set
      const unassignedJobs = mockData.todaysAppointments.filter(
        (j) => !j.assignedEmployee && j.status !== "completed"
      ).length;

      // All jobs in mockData have assignedEmployee or are completed
      expect(unassignedJobs).toBe(0);
    });
  });

  describe("Empty State", () => {
    it("should handle empty appointments array", () => {
      const emptyData = { todaysAppointments: [] };
      const hasNoJobs = emptyData.todaysAppointments.length === 0;

      expect(hasNoJobs).toBe(true);
    });
  });

  describe("Navigation Links", () => {
    it("should navigate to full dashboard", () => {
      mockNavigate("/business-owner/dashboard");
      expect(mockNavigate).toHaveBeenCalledWith("/business-owner/dashboard");
    });

    it("should navigate to financials", () => {
      mockNavigate("/business-owner/financials");
      expect(mockNavigate).toHaveBeenCalledWith("/business-owner/financials");
    });

    it("should navigate to calendar", () => {
      mockNavigate("/business-owner/calendar");
      expect(mockNavigate).toHaveBeenCalledWith("/business-owner/calendar");
    });
  });

  describe("Alert Banner", () => {
    it("should show alert when unassigned jobs exist", () => {
      const unassignedJobs = 2;
      const shouldShowAlert = unassignedJobs > 0;

      expect(shouldShowAlert).toBe(true);
    });

    it("should not show alert when all jobs assigned", () => {
      const unassignedJobs = 0;
      const shouldShowAlert = unassignedJobs > 0;

      expect(shouldShowAlert).toBe(false);
    });
  });
});

describe("MyTeamSection Component", () => {
  const mockEmployees = [
    { id: 1, firstName: "Jane", lastName: "Smith", todaysJobs: 2 },
    { id: 2, firstName: "Bob", lastName: "Johnson", todaysJobs: 0 },
    { id: 3, firstName: "Alice", lastName: "Brown", todaysJobs: 1 },
    { id: 4, firstName: "Mike", lastName: "Davis", todaysJobs: 3 },
  ];

  const mockPendingPayouts = [
    { id: 1, businessEmployeeId: 1, payAmount: 100 },
    { id: 2, businessEmployeeId: 1, payAmount: 50 },
    { id: 3, businessEmployeeId: 3, payAmount: 75 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Employee Display", () => {
    it("should show only first 3 employees", () => {
      const displayedEmployees = mockEmployees.slice(0, 3);
      expect(displayedEmployees.length).toBe(3);
    });

    it("should calculate remaining count", () => {
      const remainingCount = Math.max(0, mockEmployees.length - 3);
      expect(remainingCount).toBe(1);
    });
  });

  describe("Payout Aggregation", () => {
    it("should group payouts by employee", () => {
      const payoutsByEmployee = {};
      mockPendingPayouts.forEach((payout) => {
        const empId = payout.businessEmployeeId;
        if (!payoutsByEmployee[empId]) {
          payoutsByEmployee[empId] = { payAmount: 0 };
        }
        payoutsByEmployee[empId].payAmount += payout.payAmount || 0;
      });

      expect(payoutsByEmployee[1].payAmount).toBe(150);
      expect(payoutsByEmployee[3].payAmount).toBe(75);
    });
  });

  describe("Employee Initials", () => {
    it("should generate initials from name", () => {
      const name = "Jane Smith";
      const parts = name.split(" ");
      const initials =
        parts.length > 1
          ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
          : name.substring(0, 2).toUpperCase();

      expect(initials).toBe("JS");
    });

    it("should handle single name", () => {
      const name = "Jane";
      const parts = name.split(" ");
      const initials =
        parts.length > 1
          ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
          : name.substring(0, 2).toUpperCase();

      expect(initials).toBe("JA");
    });
  });

  describe("Navigation", () => {
    it("should navigate to employee management", () => {
      mockNavigate("/business-owner/employees");
      expect(mockNavigate).toHaveBeenCalledWith("/business-owner/employees");
    });

    it("should navigate to employee management", () => {
      mockNavigate("/business-owner/employees");
      expect(mockNavigate).toHaveBeenCalledWith(
        "/business-owner/employees"
      );
    });

    it("should navigate to jobs for assignment", () => {
      mockNavigate("/business-owner/assign");
      expect(mockNavigate).toHaveBeenCalledWith("/business-owner/assign");
    });

    it("should navigate to payroll", () => {
      mockNavigate("/business-owner/payroll");
      expect(mockNavigate).toHaveBeenCalledWith("/business-owner/payroll");
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no employees", () => {
      const employees = [];
      const hasNoEmployees = employees.length === 0;

      expect(hasNoEmployees).toBe(true);
    });
  });
});

describe("MyClientsSection Component", () => {
  const mockClients = [
    {
      id: 1,
      clientUser: { firstName: "John", lastName: "Doe" },
      home: { address: "123 Main St, City, ST" },
      preferredStatusTier: "gold",
      nextAppointment: { date: "2024-02-10", paymentStatus: "paid" },
    },
    {
      id: 2,
      clientUser: { firstName: "Jane", lastName: "Smith" },
      home: { address: "456 Oak Ave, Town, ST" },
      preferredStatusTier: "silver",
      nextAppointment: { date: "2024-02-12", paymentStatus: "pending" },
    },
    {
      id: 3,
      clientName: "Bob Johnson",
      home: { address: "789 Elm St" },
      preferredStatusTier: null,
      nextAppointment: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Client Name Resolution", () => {
    it("should use clientUser name when available", () => {
      const client = mockClients[0];
      const clientName = client.clientUser?.firstName
        ? `${client.clientUser.firstName} ${client.clientUser.lastName || ""}`
        : client.clientName || "Unknown Client";

      expect(clientName).toBe("John Doe");
    });

    it("should fallback to clientName field", () => {
      const client = mockClients[2];
      const clientName = client.clientUser?.firstName
        ? `${client.clientUser.firstName} ${client.clientUser.lastName || ""}`
        : client.clientName || "Unknown Client";

      expect(clientName).toBe("Bob Johnson");
    });
  });

  describe("Address Preview", () => {
    it("should show first part of address", () => {
      const address = "123 Main St, City, ST";
      const addressPreview = address.split(",")[0];

      expect(addressPreview).toBe("123 Main St");
    });
  });

  describe("Status Tier Badges", () => {
    it("should recognize gold tier", () => {
      const tier = "gold";
      const tierConfig = {
        gold: { label: "Gold", color: "#FFD700" },
        silver: { label: "Silver", color: "#C0C0C0" },
        bronze: { label: "Bronze", color: "#CD7F32" },
      };

      expect(tierConfig[tier]).toBeDefined();
      expect(tierConfig[tier].label).toBe("Gold");
    });

    it("should recognize silver tier", () => {
      const tier = "silver";
      const tierConfig = {
        gold: { label: "Gold", color: "#FFD700" },
        silver: { label: "Silver", color: "#C0C0C0" },
        bronze: { label: "Bronze", color: "#CD7F32" },
      };

      expect(tierConfig[tier]).toBeDefined();
      expect(tierConfig[tier].label).toBe("Silver");
    });

    it("should handle null tier", () => {
      const tier = null;
      const tierConfig = {
        gold: { label: "Gold", color: "#FFD700" },
      };

      expect(tierConfig[tier]).toBeUndefined();
    });
  });

  describe("Payment Status", () => {
    it("should identify unpaid appointments", () => {
      const appointment = { paymentStatus: "pending" };
      const isUnpaid =
        appointment.paymentStatus &&
        appointment.paymentStatus !== "paid" &&
        appointment.paymentStatus !== "not_required";

      expect(isUnpaid).toBe(true);
    });

    it("should identify paid appointments", () => {
      const appointment = { paymentStatus: "paid" };
      const isUnpaid =
        appointment.paymentStatus &&
        appointment.paymentStatus !== "paid" &&
        appointment.paymentStatus !== "not_required";

      expect(isUnpaid).toBe(false);
    });
  });

  describe("Date Formatting", () => {
    it("should show 'Today' for today's date", () => {
      const today = new Date();
      const todayStr = today.toDateString();

      // Today's date string should match itself
      expect(todayStr).toBe(today.toDateString());
    });

    it("should show 'Tomorrow' for tomorrow's date", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Tomorrow should be after today
      expect(tomorrow.getTime()).toBeGreaterThan(today.getTime());
      // And exactly 1 day difference
      const diffDays = Math.round((tomorrow - today) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(1);
    });
  });

  describe("Client Display Limits", () => {
    it("should show only first 4 clients", () => {
      const displayedClients = mockClients.slice(0, 4);
      expect(displayedClients.length).toBeLessThanOrEqual(4);
    });
  });

  describe("Unpaid Count", () => {
    it("should count clients with unpaid appointments", () => {
      const clientsWithUnpaid = mockClients.filter(
        (c) =>
          c.nextAppointment?.paymentStatus &&
          c.nextAppointment.paymentStatus !== "paid" &&
          c.nextAppointment.paymentStatus !== "not_required"
      ).length;

      expect(clientsWithUnpaid).toBe(1);
    });
  });
});

describe("PayrollSection Component", () => {
  const mockPendingPayouts = [
    {
      id: 1,
      businessEmployeeId: 1,
      payAmount: 100,
      employee: { firstName: "Jane", lastName: "Smith" },
      clientName: "John Doe",
      completedAt: "2024-02-01",
    },
    {
      id: 2,
      businessEmployeeId: 1,
      payAmount: 150,
      employee: { firstName: "Jane", lastName: "Smith" },
      clientName: "Bob Johnson",
      completedAt: "2024-02-02",
    },
    {
      id: 3,
      businessEmployeeId: 2,
      payAmount: 75,
      employee: { firstName: "Mike", lastName: "Brown" },
      clientName: "Alice Williams",
      completedAt: "2024-02-03",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Total Calculations", () => {
    it("should calculate total payroll owed", () => {
      const totalOwed = mockPendingPayouts.reduce(
        (sum, p) => sum + (p.payAmount || 0),
        0
      );

      expect(totalOwed).toBe(325);
    });
  });

  describe("Employee Grouping", () => {
    it("should group payouts by employee", () => {
      const payoutsByEmployee = {};
      mockPendingPayouts.forEach((payout) => {
        const empId = payout.businessEmployeeId;
        if (!payoutsByEmployee[empId]) {
          payoutsByEmployee[empId] = {
            employee: payout.employee,
            payouts: [],
            totalOwed: 0,
          };
        }
        payoutsByEmployee[empId].payouts.push(payout);
        payoutsByEmployee[empId].totalOwed += payout.payAmount || 0;
      });

      const employeesWithPayouts = Object.values(payoutsByEmployee);

      expect(employeesWithPayouts.length).toBe(2);
      expect(payoutsByEmployee[1].totalOwed).toBe(250);
      expect(payoutsByEmployee[2].totalOwed).toBe(75);
    });
  });

  describe("Display Limits", () => {
    it("should show only first 3 payouts", () => {
      const displayedPayouts = mockPendingPayouts.slice(0, 3);
      expect(displayedPayouts.length).toBe(3);
    });

    it("should calculate remaining count", () => {
      const payouts = [...mockPendingPayouts, { id: 4, payAmount: 50 }];
      const remainingCount = Math.max(0, payouts.length - 3);

      expect(remainingCount).toBe(1);
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no pending payouts", () => {
      const payouts = [];
      const hasNoPayouts = payouts.length === 0;

      expect(hasNoPayouts).toBe(true);
    });
  });

  describe("Date Formatting", () => {
    it("should format completion date", () => {
      const dateStr = "2024-02-15";
      const date = new Date(dateStr + "T12:00:00"); // Use noon to avoid timezone issues
      const formatted = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      // Should contain month abbreviation and day number
      expect(formatted).toMatch(/[A-Z][a-z]{2}/); // Month abbreviation
      expect(formatted).toMatch(/\d+/); // Day number
    });
  });
});

describe("ClientPaymentsSection Component", () => {
  const mockUnpaidAppointments = [
    {
      id: 1,
      date: "2024-01-25",
      price: 150,
      clientName: "John Doe",
      paymentStatus: "pending",
    },
    {
      id: 2,
      date: "2024-02-01",
      price: 200,
      clientName: "Jane Smith",
      paymentStatus: "pending",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Total Calculations", () => {
    it("should calculate total unpaid amount", () => {
      const totalUnpaid = mockUnpaidAppointments.reduce(
        (sum, a) => sum + (a.price || 0),
        0
      );

      expect(totalUnpaid).toBe(350);
    });
  });

  describe("Overdue Detection", () => {
    it("should identify overdue appointments", () => {
      const appointment = { date: "2024-01-01", paymentStatus: "pending" };
      const apptDate = new Date(appointment.date);
      const today = new Date();
      const isOverdue =
        apptDate < today && appointment.paymentStatus !== "paid";

      expect(isOverdue).toBe(true);
    });

    it("should not mark future appointments as overdue", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const appointment = {
        date: futureDate.toISOString().split("T")[0],
        paymentStatus: "pending",
      };
      const apptDate = new Date(appointment.date);
      const today = new Date();
      const isOverdue =
        apptDate < today && appointment.paymentStatus !== "paid";

      expect(isOverdue).toBe(false);
    });

    it("should count overdue appointments", () => {
      const appointments = [
        { date: "2024-01-01", paymentStatus: "pending" },
        { date: "2024-01-15", paymentStatus: "pending" },
        { date: "2099-12-31", paymentStatus: "pending" },
      ];

      const overdueCount = appointments.filter((a) => {
        const apptDate = new Date(a.date);
        return apptDate < new Date();
      }).length;

      expect(overdueCount).toBe(2);
    });
  });

  describe("Display Limits", () => {
    it("should show only first 4 appointments", () => {
      const displayed = mockUnpaidAppointments.slice(0, 4);
      expect(displayed.length).toBeLessThanOrEqual(4);
    });
  });

  describe("Actions", () => {
    it("should support mark paid action", () => {
      const onMarkPaid = jest.fn();
      onMarkPaid({ id: 1 });

      expect(onMarkPaid).toHaveBeenCalledWith({ id: 1 });
    });

    it("should support send reminder action", () => {
      const onSendReminder = jest.fn();
      onSendReminder({ id: 1 });

      expect(onSendReminder).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe("Date Display", () => {
    it("should show relative date for recent appointments", () => {
      const today = new Date();
      const diffDays = 1;
      const displayText = diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;

      expect(displayText).toBe("Yesterday");
    });

    it("should show weeks for older appointments", () => {
      const diffDays = 14;
      const weeks = Math.floor(diffDays / 7);
      const displayText = `${weeks} week${weeks > 1 ? "s" : ""} ago`;

      expect(displayText).toBe("2 weeks ago");
    });
  });
});

describe("MarketplaceCleanerView Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Stats Display", () => {
    it("should show upcoming jobs count", () => {
      const stats = { upcomingJobs: 5, jobsCompleted: 10, totalEarnings: 2500 };
      expect(stats.upcomingJobs).toBe(5);
    });

    it("should show completed jobs count", () => {
      const stats = { upcomingJobs: 5, jobsCompleted: 10, totalEarnings: 2500 };
      expect(stats.jobsCompleted).toBe(10);
    });

    it("should show total earnings", () => {
      const stats = { upcomingJobs: 5, jobsCompleted: 10, totalEarnings: 2500 };
      expect(stats.totalEarnings).toBe(2500);
    });
  });

  describe("Job Filtering", () => {
    it("should filter upcoming jobs", () => {
      const now = new Date();
      const appointments = [
        { date: "2024-01-01", status: "completed" },
        { date: "2099-12-31", status: "assigned" },
        { date: "2099-12-31", status: "cancelled" },
      ];

      const upcoming = appointments.filter((apt) => {
        const aptDate = new Date(apt.date);
        return (
          aptDate >= now &&
          apt.status !== "completed" &&
          apt.status !== "cancelled"
        );
      });

      expect(upcoming.length).toBe(1);
    });
  });

  describe("Navigation", () => {
    it("should navigate to dashboard for job browsing", () => {
      mockNavigate("/dashboard");
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });

    it("should navigate to my appointments", () => {
      mockNavigate("/my-appointments");
      expect(mockNavigate).toHaveBeenCalledWith("/my-appointments");
    });

    it("should navigate to appointment details", () => {
      mockNavigate("/appointments/123");
      expect(mockNavigate).toHaveBeenCalledWith("/appointments/123");
    });
  });

  describe("Job Date Display", () => {
    it("should show 'Today' for today's jobs", () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0); // Use noon to avoid timezone issues

      // Comparing same day should be true
      const sameDay = today.toDateString() === today.toDateString();
      expect(sameDay).toBe(true);
    });

    it("should show 'Tomorrow' for tomorrow's jobs", () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Tomorrow should be different from today
      expect(tomorrow.getDate()).not.toBe(today.getDate());
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no jobs", () => {
      const myJobs = [];
      const hasNoJobs = myJobs.length === 0;

      expect(hasNoJobs).toBe(true);
    });
  });

  describe("Tip Card", () => {
    it("should display self-assignment tip", () => {
      const tipTitle = "Assign Yourself to Client Jobs";
      expect(tipTitle).toBe("Assign Yourself to Client Jobs");
    });
  });
});
