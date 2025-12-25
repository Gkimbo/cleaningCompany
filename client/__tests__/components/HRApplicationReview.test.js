/**
 * Tests for HR Application Review System
 * Tests authorization, status management, approval flow, and rejection handling
 */

describe("HR Application Review System", () => {
  // ============================================
  // MOCK DATA
  // ============================================
  const mockPendingApplication = {
    id: 1,
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "555-123-4567",
    experience: "3 years professional cleaning",
    status: "pending",
    createdAt: "2025-01-10T10:00:00Z",
    adminNotes: null,
    reviewedBy: null,
    reviewedAt: null,
  };

  const mockUnderReviewApplication = {
    ...mockPendingApplication,
    id: 2,
    status: "under_review",
    adminNotes: "Looks promising, schedule interview",
    reviewedBy: 5,
    reviewedAt: "2025-01-11T14:00:00Z",
  };

  const mockApprovedApplication = {
    ...mockPendingApplication,
    id: 3,
    status: "approved",
    userId: 100,
    reviewedBy: 5,
    reviewedAt: "2025-01-12T09:00:00Z",
  };

  const mockRejectedApplication = {
    ...mockPendingApplication,
    id: 4,
    status: "rejected",
    rejectionReason: "Insufficient experience",
    reviewedBy: 5,
    reviewedAt: "2025-01-12T10:00:00Z",
  };

  const mockHRUser = {
    id: 5,
    username: "hr_staff",
    firstName: "HR",
    lastName: "Staff",
    type: "humanResources",
  };

  const mockOwnerUser = {
    id: 1,
    username: "owner1",
    firstName: "Owner",
    lastName: "User",
    type: "owner",
  };

  const mockCleanerUser = {
    id: 10,
    username: "cleaner1",
    firstName: "Cleaner",
    lastName: "User",
    type: "cleaner",
  };

  // ============================================
  // AUTHORIZATION TESTS
  // ============================================
  describe("Authorization", () => {
    const canAccessApplications = (user) => {
      if (!user) return false;
      return user.type === "owner" || user.type === "owner1" || user.type === "humanResources";
    };

    it("should allow owner to access applications", () => {
      expect(canAccessApplications(mockOwnerUser)).toBe(true);
    });

    it("should allow HR to access applications", () => {
      expect(canAccessApplications(mockHRUser)).toBe(true);
    });

    it("should deny cleaner access to applications", () => {
      expect(canAccessApplications(mockCleanerUser)).toBe(false);
    });

    it("should deny access when user is null", () => {
      expect(canAccessApplications(null)).toBe(false);
    });

    it("should deny access when user is undefined", () => {
      expect(canAccessApplications(undefined)).toBe(false);
    });

    it("should allow owner1 type to access applications", () => {
      const owner1User = { ...mockOwnerUser, type: "owner1" };
      expect(canAccessApplications(owner1User)).toBe(true);
    });
  });

  // ============================================
  // STATUS CONFIGURATION TESTS
  // ============================================
  describe("Status Configuration", () => {
    const getStatusConfig = (status) => {
      const statusConfig = {
        pending: { label: "Pending", color: "warning", icon: "clock" },
        under_review: { label: "Under Review", color: "info", icon: "search" },
        background_check: { label: "Background Check", color: "info", icon: "shield" },
        approved: { label: "Approved", color: "success", icon: "check" },
        rejected: { label: "Rejected", color: "error", icon: "x" },
      };
      return statusConfig[status] || { label: status, color: "default", icon: "question" };
    };

    it("should return pending config for pending status", () => {
      const config = getStatusConfig("pending");
      expect(config.label).toBe("Pending");
      expect(config.color).toBe("warning");
    });

    it("should return under review config", () => {
      const config = getStatusConfig("under_review");
      expect(config.label).toBe("Under Review");
      expect(config.color).toBe("info");
    });

    it("should return background check config", () => {
      const config = getStatusConfig("background_check");
      expect(config.label).toBe("Background Check");
      expect(config.color).toBe("info");
    });

    it("should return approved config for approved status", () => {
      const config = getStatusConfig("approved");
      expect(config.label).toBe("Approved");
      expect(config.color).toBe("success");
    });

    it("should return rejected config for rejected status", () => {
      const config = getStatusConfig("rejected");
      expect(config.label).toBe("Rejected");
      expect(config.color).toBe("error");
    });

    it("should return default config for unknown status", () => {
      const config = getStatusConfig("unknown_status");
      expect(config.label).toBe("unknown_status");
      expect(config.color).toBe("default");
    });
  });

  // ============================================
  // STATUS TRANSITION TESTS
  // ============================================
  describe("Status Transitions", () => {
    const getAvailableStatusTransitions = (currentStatus) => {
      const transitions = {
        pending: ["under_review", "rejected"],
        under_review: ["background_check", "approved", "rejected"],
        background_check: ["approved", "rejected"],
        approved: [], // No transitions from approved
        rejected: [], // No transitions from rejected
      };
      return transitions[currentStatus] || [];
    };

    it("should allow pending to transition to under_review or rejected", () => {
      const transitions = getAvailableStatusTransitions("pending");
      expect(transitions).toContain("under_review");
      expect(transitions).toContain("rejected");
      expect(transitions).not.toContain("approved");
    });

    it("should allow under_review to transition to background_check, approved, or rejected", () => {
      const transitions = getAvailableStatusTransitions("under_review");
      expect(transitions).toContain("background_check");
      expect(transitions).toContain("approved");
      expect(transitions).toContain("rejected");
    });

    it("should allow background_check to transition to approved or rejected", () => {
      const transitions = getAvailableStatusTransitions("background_check");
      expect(transitions).toContain("approved");
      expect(transitions).toContain("rejected");
      expect(transitions).not.toContain("under_review");
    });

    it("should not allow any transitions from approved", () => {
      const transitions = getAvailableStatusTransitions("approved");
      expect(transitions).toHaveLength(0);
    });

    it("should not allow any transitions from rejected", () => {
      const transitions = getAvailableStatusTransitions("rejected");
      expect(transitions).toHaveLength(0);
    });
  });

  // ============================================
  // APPLICATION LIST FILTERING TESTS
  // ============================================
  describe("Application List Filtering", () => {
    const applications = [
      mockPendingApplication,
      mockUnderReviewApplication,
      mockApprovedApplication,
      mockRejectedApplication,
    ];

    const filterByStatus = (apps, status) => {
      if (!status || status === "all") return apps;
      return apps.filter((app) => app.status === status);
    };

    const filterBySearch = (apps, searchTerm) => {
      if (!searchTerm) return apps;
      const term = searchTerm.toLowerCase();
      return apps.filter(
        (app) =>
          app.firstName.toLowerCase().includes(term) ||
          app.lastName.toLowerCase().includes(term) ||
          app.email.toLowerCase().includes(term)
      );
    };

    it("should return all applications when status is 'all'", () => {
      const filtered = filterByStatus(applications, "all");
      expect(filtered).toHaveLength(4);
    });

    it("should filter by pending status", () => {
      const filtered = filterByStatus(applications, "pending");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].status).toBe("pending");
    });

    it("should filter by approved status", () => {
      const filtered = filterByStatus(applications, "approved");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].status).toBe("approved");
    });

    it("should return all when no status filter", () => {
      const filtered = filterByStatus(applications, null);
      expect(filtered).toHaveLength(4);
    });

    it("should filter by first name search", () => {
      const filtered = filterBySearch(applications, "John");
      expect(filtered).toHaveLength(4); // All have John as first name
    });

    it("should filter by email search", () => {
      const filtered = filterBySearch(applications, "example.com");
      expect(filtered).toHaveLength(4);
    });

    it("should return all when search is empty", () => {
      const filtered = filterBySearch(applications, "");
      expect(filtered).toHaveLength(4);
    });

    it("should return empty when no matches", () => {
      const filtered = filterBySearch(applications, "xyz123nonexistent");
      expect(filtered).toHaveLength(0);
    });

    it("should be case insensitive", () => {
      const filtered = filterBySearch(applications, "JOHN");
      expect(filtered).toHaveLength(4);
    });
  });

  // ============================================
  // APPLICATION SORTING TESTS
  // ============================================
  describe("Application Sorting", () => {
    const applications = [
      { ...mockPendingApplication, id: 1, createdAt: "2025-01-10T10:00:00Z" },
      { ...mockPendingApplication, id: 2, createdAt: "2025-01-12T10:00:00Z" },
      { ...mockPendingApplication, id: 3, createdAt: "2025-01-11T10:00:00Z" },
    ];

    const sortByDate = (apps, direction = "desc") => {
      return [...apps].sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return direction === "desc" ? dateB - dateA : dateA - dateB;
      });
    };

    it("should sort by date descending (newest first)", () => {
      const sorted = sortByDate(applications, "desc");
      expect(sorted[0].id).toBe(2); // Jan 12
      expect(sorted[1].id).toBe(3); // Jan 11
      expect(sorted[2].id).toBe(1); // Jan 10
    });

    it("should sort by date ascending (oldest first)", () => {
      const sorted = sortByDate(applications, "asc");
      expect(sorted[0].id).toBe(1); // Jan 10
      expect(sorted[1].id).toBe(3); // Jan 11
      expect(sorted[2].id).toBe(2); // Jan 12
    });
  });

  // ============================================
  // APPROVAL FLOW TESTS
  // ============================================
  describe("Approval Flow", () => {
    const validateApproval = (application) => {
      const errors = [];

      if (!application) {
        errors.push("Application not found");
        return errors;
      }

      if (application.status === "approved") {
        errors.push("Application is already approved");
      }

      if (!application.email) {
        errors.push("Application must have an email address");
      }

      if (!application.firstName) {
        errors.push("Application must have a first name");
      }

      return errors;
    };

    it("should validate pending application for approval", () => {
      const errors = validateApproval(mockPendingApplication);
      expect(errors).toHaveLength(0);
    });

    it("should reject approval of already approved application", () => {
      const errors = validateApproval(mockApprovedApplication);
      expect(errors).toContain("Application is already approved");
    });

    it("should reject approval of null application", () => {
      const errors = validateApproval(null);
      expect(errors).toContain("Application not found");
    });

    it("should reject approval without email", () => {
      const appWithoutEmail = { ...mockPendingApplication, email: null };
      const errors = validateApproval(appWithoutEmail);
      expect(errors).toContain("Application must have an email address");
    });

    it("should reject approval without first name", () => {
      const appWithoutName = { ...mockPendingApplication, firstName: null };
      const errors = validateApproval(appWithoutName);
      expect(errors).toContain("Application must have a first name");
    });
  });

  // ============================================
  // REJECTION FLOW TESTS
  // ============================================
  describe("Rejection Flow", () => {
    const validateRejection = (application, reason) => {
      const errors = [];
      const warnings = [];

      if (!application) {
        errors.push("Application not found");
        return { errors, warnings };
      }

      if (application.status === "approved") {
        errors.push("Cannot reject an already approved application");
      }

      if (application.status === "rejected") {
        errors.push("Application is already rejected");
      }

      if (!reason || reason.trim() === "") {
        warnings.push("Consider providing a rejection reason");
      }

      return { errors, warnings };
    };

    it("should validate pending application for rejection", () => {
      const { errors, warnings } = validateRejection(mockPendingApplication, "Not qualified");
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it("should warn when no rejection reason provided", () => {
      const { errors, warnings } = validateRejection(mockPendingApplication, "");
      expect(errors).toHaveLength(0);
      expect(warnings).toContain("Consider providing a rejection reason");
    });

    it("should reject rejection of already rejected application", () => {
      const { errors } = validateRejection(mockRejectedApplication, "Reason");
      expect(errors).toContain("Application is already rejected");
    });

    it("should reject rejection of approved application", () => {
      const { errors } = validateRejection(mockApprovedApplication, "Reason");
      expect(errors).toContain("Cannot reject an already approved application");
    });
  });

  // ============================================
  // USERNAME GENERATION PREVIEW TESTS
  // ============================================
  describe("Username Generation Preview", () => {
    const previewUsername = (firstName, lastName) => {
      const cleanFirst = (firstName || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 10);
      const cleanLast = (lastName || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 10);

      let username = cleanFirst;
      if (cleanLast) {
        username += "_" + cleanLast;
      }

      return username;
    };

    it("should generate username from first and last name", () => {
      expect(previewUsername("John", "Doe")).toBe("john_doe");
    });

    it("should handle first name only", () => {
      expect(previewUsername("John", "")).toBe("john");
    });

    it("should convert to lowercase", () => {
      expect(previewUsername("JOHN", "DOE")).toBe("john_doe");
    });

    it("should remove special characters", () => {
      expect(previewUsername("John-Paul", "O'Brien")).toBe("johnpaul_obrien");
    });

    it("should use 'user' for empty first name", () => {
      expect(previewUsername("", "Doe")).toBe("user_doe");
    });

    it("should truncate long names", () => {
      const username = previewUsername("Bartholomew", "Christopherson");
      expect(username.split("_")[0].length).toBeLessThanOrEqual(10);
      expect(username.split("_")[1].length).toBeLessThanOrEqual(10);
    });
  });

  // ============================================
  // ADMIN NOTES TESTS
  // ============================================
  describe("Admin Notes", () => {
    const validateNotes = (notes) => {
      if (notes === null || notes === undefined) return true;
      if (typeof notes !== "string") return false;
      if (notes.length > 5000) return false;
      return true;
    };

    it("should accept valid notes", () => {
      expect(validateNotes("This is a valid note")).toBe(true);
    });

    it("should accept empty notes", () => {
      expect(validateNotes("")).toBe(true);
    });

    it("should accept null notes", () => {
      expect(validateNotes(null)).toBe(true);
    });

    it("should reject notes over 5000 characters", () => {
      const longNote = "a".repeat(5001);
      expect(validateNotes(longNote)).toBe(false);
    });

    it("should reject non-string notes", () => {
      expect(validateNotes(123)).toBe(false);
      expect(validateNotes({})).toBe(false);
    });
  });

  // ============================================
  // DATE FORMATTING TESTS
  // ============================================
  describe("Date Formatting", () => {
    const formatDate = (dateString) => {
      if (!dateString) return "N/A";
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };

    const formatDateTime = (dateString) => {
      if (!dateString) return "N/A";
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    };

    it("should format date correctly", () => {
      const formatted = formatDate("2025-01-15T10:00:00Z");
      expect(formatted).toContain("Jan");
      expect(formatted).toContain("15");
      expect(formatted).toContain("2025");
    });

    it("should return N/A for null date", () => {
      expect(formatDate(null)).toBe("N/A");
    });

    it("should return Invalid Date for invalid date string", () => {
      expect(formatDate("not-a-date")).toBe("Invalid Date");
    });

    it("should format datetime with time", () => {
      const formatted = formatDateTime("2025-01-15T10:30:00Z");
      expect(formatted).toContain("Jan");
      expect(formatted).toContain("15");
    });
  });

  // ============================================
  // APPLICATION COUNTS TESTS
  // ============================================
  describe("Application Counts", () => {
    const applications = [
      { status: "pending" },
      { status: "pending" },
      { status: "under_review" },
      { status: "background_check" },
      { status: "approved" },
      { status: "approved" },
      { status: "approved" },
      { status: "rejected" },
    ];

    const getStatusCounts = (apps) => {
      return apps.reduce((acc, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      }, {});
    };

    const getPendingCount = (apps) => {
      return apps.filter((a) => a.status === "pending").length;
    };

    const getNeedsActionCount = (apps) => {
      return apps.filter((a) =>
        a.status === "pending" ||
        a.status === "under_review" ||
        a.status === "background_check"
      ).length;
    };

    it("should count applications by status", () => {
      const counts = getStatusCounts(applications);
      expect(counts.pending).toBe(2);
      expect(counts.under_review).toBe(1);
      expect(counts.background_check).toBe(1);
      expect(counts.approved).toBe(3);
      expect(counts.rejected).toBe(1);
    });

    it("should count pending applications", () => {
      expect(getPendingCount(applications)).toBe(2);
    });

    it("should count applications needing action", () => {
      expect(getNeedsActionCount(applications)).toBe(4);
    });

    it("should handle empty applications list", () => {
      const counts = getStatusCounts([]);
      expect(Object.keys(counts)).toHaveLength(0);
    });
  });

  // ============================================
  // EXPERIENCE DISPLAY TESTS
  // ============================================
  describe("Experience Display", () => {
    const formatExperience = (experience) => {
      if (!experience) return "Not specified";
      if (experience.length > 100) {
        return experience.slice(0, 100) + "...";
      }
      return experience;
    };

    it("should display experience normally", () => {
      expect(formatExperience("3 years cleaning")).toBe("3 years cleaning");
    });

    it("should truncate long experience", () => {
      const longExp = "a".repeat(150);
      const formatted = formatExperience(longExp);
      expect(formatted.length).toBe(103); // 100 + "..."
      expect(formatted.endsWith("...")).toBe(true);
    });

    it("should return 'Not specified' for null", () => {
      expect(formatExperience(null)).toBe("Not specified");
    });

    it("should return 'Not specified' for undefined", () => {
      expect(formatExperience(undefined)).toBe("Not specified");
    });

    it("should return 'Not specified' for empty string", () => {
      expect(formatExperience("")).toBe("Not specified");
    });
  });

  // ============================================
  // CONFIRMATION MODAL TESTS
  // ============================================
  describe("Confirmation Modal Logic", () => {
    const getConfirmationMessage = (action, applicantName) => {
      switch (action) {
        case "approve":
          return `Are you sure you want to approve ${applicantName}'s application? This will create a cleaner account and send login credentials.`;
        case "reject":
          return `Are you sure you want to reject ${applicantName}'s application? A rejection email will be sent.`;
        case "delete":
          return `Are you sure you want to delete ${applicantName}'s application? This cannot be undone.`;
        default:
          return `Are you sure you want to perform this action on ${applicantName}'s application?`;
      }
    };

    it("should return approval confirmation message", () => {
      const msg = getConfirmationMessage("approve", "John Doe");
      expect(msg).toContain("approve");
      expect(msg).toContain("John Doe");
      expect(msg).toContain("cleaner account");
    });

    it("should return rejection confirmation message", () => {
      const msg = getConfirmationMessage("reject", "John Doe");
      expect(msg).toContain("reject");
      expect(msg).toContain("John Doe");
      expect(msg).toContain("rejection email");
    });

    it("should return delete confirmation message", () => {
      const msg = getConfirmationMessage("delete", "John Doe");
      expect(msg).toContain("delete");
      expect(msg).toContain("cannot be undone");
    });

    it("should return default message for unknown action", () => {
      const msg = getConfirmationMessage("unknown", "John Doe");
      expect(msg).toContain("John Doe");
    });
  });

  // ============================================
  // API RESPONSE HANDLING TESTS
  // ============================================
  describe("API Response Handling", () => {
    const handleApprovalResponse = (response) => {
      if (response.error) {
        return { success: false, message: response.error };
      }
      if (response.user) {
        return {
          success: true,
          message: `Successfully approved! Created account: ${response.user.username}`,
          user: response.user,
        };
      }
      return { success: false, message: "Unexpected response" };
    };

    const handleRejectionResponse = (response) => {
      if (response.error) {
        return { success: false, message: response.error };
      }
      if (response.message === "Application rejected") {
        return { success: true, message: "Application rejected successfully" };
      }
      return { success: false, message: "Unexpected response" };
    };

    it("should handle successful approval response", () => {
      const response = {
        message: "Application approved",
        user: { username: "john_doe", id: 100 },
      };
      const result = handleApprovalResponse(response);
      expect(result.success).toBe(true);
      expect(result.message).toContain("john_doe");
    });

    it("should handle approval error response", () => {
      const response = { error: "Cannot approve already approved application" };
      const result = handleApprovalResponse(response);
      expect(result.success).toBe(false);
      expect(result.message).toBe("Cannot approve already approved application");
    });

    it("should handle successful rejection response", () => {
      const response = { message: "Application rejected" };
      const result = handleRejectionResponse(response);
      expect(result.success).toBe(true);
    });

    it("should handle rejection error response", () => {
      const response = { error: "Application not found" };
      const result = handleRejectionResponse(response);
      expect(result.success).toBe(false);
      expect(result.message).toBe("Application not found");
    });
  });

  // ============================================
  // PERMISSION HELPERS TESTS
  // ============================================
  describe("Permission Helpers", () => {
    const canApproveApplication = (user, application) => {
      if (!user || !application) return false;
      if (user.type !== "owner" && user.type !== "owner1" && user.type !== "humanResources") {
        return false;
      }
      if (application.status === "approved") return false;
      return true;
    };

    const canRejectApplication = (user, application) => {
      if (!user || !application) return false;
      if (user.type !== "owner" && user.type !== "owner1" && user.type !== "humanResources") {
        return false;
      }
      if (application.status === "approved") return false;
      if (application.status === "rejected") return false;
      return true;
    };

    const canEditNotes = (user) => {
      if (!user) return false;
      return user.type === "owner" || user.type === "owner1" || user.type === "humanResources";
    };

    it("should allow HR to approve pending application", () => {
      expect(canApproveApplication(mockHRUser, mockPendingApplication)).toBe(true);
    });

    it("should allow owner to approve pending application", () => {
      expect(canApproveApplication(mockOwnerUser, mockPendingApplication)).toBe(true);
    });

    it("should deny cleaner from approving", () => {
      expect(canApproveApplication(mockCleanerUser, mockPendingApplication)).toBe(false);
    });

    it("should deny approving already approved application", () => {
      expect(canApproveApplication(mockHRUser, mockApprovedApplication)).toBe(false);
    });

    it("should allow HR to reject pending application", () => {
      expect(canRejectApplication(mockHRUser, mockPendingApplication)).toBe(true);
    });

    it("should deny rejecting already rejected application", () => {
      expect(canRejectApplication(mockHRUser, mockRejectedApplication)).toBe(false);
    });

    it("should deny rejecting approved application", () => {
      expect(canRejectApplication(mockHRUser, mockApprovedApplication)).toBe(false);
    });

    it("should allow HR to edit notes", () => {
      expect(canEditNotes(mockHRUser)).toBe(true);
    });

    it("should deny cleaner from editing notes", () => {
      expect(canEditNotes(mockCleanerUser)).toBe(false);
    });
  });
});
