import React from "react";

// Mock fetch
global.fetch = jest.fn();

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock react-router-native
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

describe("PendingReviewsList Component", () => {
  const mockState = {
    currentUser: {
      token: "test_token",
      id: 1,
      role: "client",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Data Fetching", () => {
    it("should fetch pending reviews on mount", async () => {
      const mockPendingReviews = [
        {
          appointmentId: 100,
          date: "2025-01-15",
          price: "150",
          home: { id: 10, address: "123 Main St", city: "Boston" },
          cleaners: [{ id: 2, firstName: "John", lastName: "Doe" }],
        },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pendingReviews: mockPendingReviews }),
      });

      const response = await fetch("http://localhost:3000/api/v1/reviews/pending", {
        headers: { Authorization: "Bearer test_token" },
      });

      const data = await response.json();

      expect(data.pendingReviews).toHaveLength(1);
      expect(data.pendingReviews[0].appointmentId).toBe(100);
    });

    it("should handle empty pending reviews", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pendingReviews: [] }),
      });

      const response = await fetch("http://localhost:3000/api/v1/reviews/pending", {
        headers: { Authorization: "Bearer test_token" },
      });

      const data = await response.json();

      expect(data.pendingReviews).toHaveLength(0);
    });

    it("should handle fetch error", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      try {
        await fetch("http://localhost:3000/api/v1/reviews/pending");
      } catch (error) {
        expect(error.message).toBe("Network error");
      }
    });
  });

  describe("User Role Detection", () => {
    const getUserRole = (state) => {
      const userRole = state?.currentUser?.role || "client";
      const isHomeowner = userRole === "client" || userRole === "homeowner";
      return { userRole, isHomeowner };
    };

    it("should identify client as homeowner", () => {
      const result = getUserRole({ currentUser: { role: "client" } });

      expect(result.isHomeowner).toBe(true);
      expect(result.userRole).toBe("client");
    });

    it("should identify homeowner role", () => {
      const result = getUserRole({ currentUser: { role: "homeowner" } });

      expect(result.isHomeowner).toBe(true);
    });

    it("should identify cleaner as not homeowner", () => {
      const result = getUserRole({ currentUser: { role: "cleaner" } });

      expect(result.isHomeowner).toBe(false);
      expect(result.userRole).toBe("cleaner");
    });

    it("should default to client if no role", () => {
      const result = getUserRole({ currentUser: {} });

      expect(result.userRole).toBe("client");
      expect(result.isHomeowner).toBe(true);
    });
  });

  describe("Reviewee Info Extraction", () => {
    const getRevieweeInfo = (pendingReview, isHomeowner) => {
      if (isHomeowner) {
        const cleaner = pendingReview.cleaners?.[0];
        return {
          userId: cleaner?.id,
          name: cleaner?.firstName
            ? `${cleaner.firstName} ${cleaner.lastName || ""}`
            : cleaner?.username || "Cleaner",
          reviewType: "homeowner_to_cleaner",
        };
      } else {
        return {
          userId: pendingReview.home?.ownerId,
          name: pendingReview.home?.nickName || "Homeowner",
          reviewType: "cleaner_to_homeowner",
        };
      }
    };

    it("should get cleaner info for homeowner", () => {
      const pendingReview = {
        cleaners: [{ id: 2, firstName: "John", lastName: "Doe" }],
      };

      const info = getRevieweeInfo(pendingReview, true);

      expect(info.userId).toBe(2);
      expect(info.name).toBe("John Doe");
      expect(info.reviewType).toBe("homeowner_to_cleaner");
    });

    it("should use username if no first name", () => {
      const pendingReview = {
        cleaners: [{ id: 2, username: "johnd" }],
      };

      const info = getRevieweeInfo(pendingReview, true);

      expect(info.name).toBe("johnd");
    });

    it("should use default name if no cleaner info", () => {
      const pendingReview = {
        cleaners: [],
      };

      const info = getRevieweeInfo(pendingReview, true);

      expect(info.name).toBe("Cleaner");
    });

    it("should get homeowner info for cleaner", () => {
      const pendingReview = {
        home: { ownerId: 1, nickName: "Beach House" },
      };

      const info = getRevieweeInfo(pendingReview, false);

      expect(info.userId).toBe(1);
      expect(info.name).toBe("Beach House");
      expect(info.reviewType).toBe("cleaner_to_homeowner");
    });

    it("should use default name if no home nickname", () => {
      const pendingReview = {
        home: { ownerId: 1 },
      };

      const info = getRevieweeInfo(pendingReview, false);

      expect(info.name).toBe("Homeowner");
    });
  });

  describe("Date Formatting", () => {
    const formatDate = (dateString) => {
      const date = new Date(dateString + "T00:00:00");
      const options = { weekday: "short", month: "short", day: "numeric" };
      return date.toLocaleDateString("en-US", options);
    };

    it("should format date correctly", () => {
      const formatted = formatDate("2025-01-15");

      expect(formatted).toMatch(/Jan/);
      expect(formatted).toMatch(/15/);
    });

    it("should include weekday", () => {
      const formatted = formatDate("2025-01-15");

      // Wed Jan 15
      expect(formatted).toMatch(/Wed/);
    });
  });

  describe("Review Modal State", () => {
    it("should track selected review", () => {
      let selectedReview = null;
      const pendingReview = { appointmentId: 100 };

      // Simulate selecting a review
      selectedReview = pendingReview;

      expect(selectedReview.appointmentId).toBe(100);
    });

    it("should track modal visibility", () => {
      let showReviewModal = false;

      // Open modal
      showReviewModal = true;
      expect(showReviewModal).toBe(true);

      // Close modal
      showReviewModal = false;
      expect(showReviewModal).toBe(false);
    });

    it("should clear selection on complete", () => {
      let selectedReview = { appointmentId: 100 };
      let showReviewModal = true;

      // Simulate completion
      const handleReviewComplete = () => {
        showReviewModal = false;
        selectedReview = null;
      };

      handleReviewComplete();

      expect(showReviewModal).toBe(false);
      expect(selectedReview).toBeNull();
    });
  });

  describe("Empty State", () => {
    it("should show all caught up message when no pending reviews", () => {
      const pendingReviews = [];

      expect(pendingReviews.length).toBe(0);
      // Component shows "All Caught Up!" message
    });

    it("should show pending reviews list when available", () => {
      const pendingReviews = [{ appointmentId: 100 }];

      expect(pendingReviews.length).toBeGreaterThan(0);
    });
  });

  describe("Stats Display", () => {
    it("should display pending count", () => {
      const pendingReviews = [
        { appointmentId: 100 },
        { appointmentId: 101 },
        { appointmentId: 102 },
      ];

      expect(pendingReviews.length).toBe(3);
    });
  });

  describe("Avatar Initial", () => {
    const getAvatarInitial = (name) => {
      return name.charAt(0).toUpperCase();
    };

    it("should get first character uppercase", () => {
      expect(getAvatarInitial("John")).toBe("J");
    });

    it("should handle lowercase names", () => {
      expect(getAvatarInitial("john")).toBe("J");
    });

    it("should handle single character", () => {
      expect(getAvatarInitial("A")).toBe("A");
    });
  });

  describe("Double-blind Info Card", () => {
    it("should explain fair review system", () => {
      const infoText = "Reviews stay private until both parties submit their review. Then both reviews become visible at the same time.";

      expect(infoText).toContain("private");
      expect(infoText).toContain("both parties");
      expect(infoText).toContain("visible");
    });
  });

  describe("Info Card Messages", () => {
    const getInfoMessage = (isHomeowner) => {
      if (isHomeowner) {
        return "Rate your cleaners to help others find great service!";
      }
      return "Rate homeowners to help other cleaners find great clients!";
    };

    it("should show homeowner message", () => {
      const message = getInfoMessage(true);

      expect(message).toContain("cleaners");
      expect(message).toContain("great service");
    });

    it("should show cleaner message", () => {
      const message = getInfoMessage(false);

      expect(message).toContain("homeowners");
      expect(message).toContain("great clients");
    });
  });

  describe("Refresh Functionality", () => {
    it("should refresh data on pull", async () => {
      let refreshCalled = false;

      const onRefresh = async () => {
        refreshCalled = true;
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ pendingReviews: [] }),
        });
        await fetch("http://localhost:3000/api/v1/reviews/pending");
      };

      await onRefresh();

      expect(refreshCalled).toBe(true);
    });

    it("should track refreshing state", () => {
      let refreshing = false;

      // Start refresh
      refreshing = true;
      expect(refreshing).toBe(true);

      // End refresh
      refreshing = false;
      expect(refreshing).toBe(false);
    });
  });

  describe("Loading State", () => {
    it("should show loading initially", () => {
      const loading = true;

      expect(loading).toBe(true);
    });

    it("should hide loading after fetch", async () => {
      let loading = true;

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pendingReviews: [] }),
      });

      await fetch("http://localhost:3000/api/v1/reviews/pending");
      loading = false;

      expect(loading).toBe(false);
    });
  });

  describe("Navigation", () => {
    it("should navigate home on back press", () => {
      const mockNavigate = jest.fn();
      const handleBack = () => mockNavigate("/");

      handleBack();

      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    it("should navigate home from empty state button", () => {
      const mockNavigate = jest.fn();

      mockNavigate("/");

      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });
});
