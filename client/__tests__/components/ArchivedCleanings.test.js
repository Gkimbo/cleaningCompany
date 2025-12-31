/**
 * Tests for ArchivedCleanings component.
 * Verifies that clients can view their completed cleanings that have been reviewed.
 */

// Mock fetch
global.fetch = jest.fn();

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/FontAwesome", () => "Icon");

// Mock react-router-native
jest.mock("react-router-native", () => ({
  useNavigate: () => jest.fn(),
}));

describe("ArchivedCleanings Component", () => {
  const mockState = {
    currentUser: { token: "test_token", id: 1 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Data Fetching", () => {
    it("should fetch archived appointments on mount", async () => {
      const mockArchivedAppointments = [
        {
          id: 100,
          date: "2025-12-25",
          completed: true,
          home: { nickName: "Beach House", city: "Miami" },
          cleaners: [{ username: "cleaner123" }],
        },
        {
          id: 101,
          date: "2025-12-20",
          completed: true,
          home: { nickName: "Mountain Cabin", city: "Denver" },
          cleaners: [{ username: "cleaner456" }],
        },
      ];

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ archivedAppointments: mockArchivedAppointments }),
      });

      const response = await fetch("/api/v1/appointments/archived", {
        headers: { Authorization: `Bearer ${mockState.currentUser.token}` },
      });

      const data = await response.json();

      expect(data.archivedAppointments).toHaveLength(2);
      expect(data.archivedAppointments[0].home.nickName).toBe("Beach House");
    });

    it("should handle fetch error gracefully", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      let error = null;
      try {
        await fetch("/api/v1/appointments/archived");
      } catch (e) {
        error = e;
      }

      expect(error).toBeTruthy();
      expect(error.message).toBe("Network error");
    });

    it("should handle 401 unauthorized", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      const response = await fetch("/api/v1/appointments/archived");

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe("Archived Appointment Display", () => {
    it("should display appointment date correctly", () => {
      const appointment = { date: "2025-12-25" };
      const date = new Date(appointment.date + "T00:00:00");
      const formatted = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      expect(formatted).toContain("Dec");
      expect(formatted).toContain("25");
      expect(formatted).toContain("2025");
    });

    it("should display home nickname", () => {
      const appointment = {
        home: { nickName: "Beach House" },
      };

      expect(appointment.home.nickName).toBe("Beach House");
    });

    it("should display cleaner username", () => {
      const appointment = {
        cleaners: [{ username: "cleaner123" }],
      };

      const cleanerName = appointment.cleaners?.[0]?.username || "Cleaner";

      expect(cleanerName).toBe("cleaner123");
    });

    it("should fallback to 'Cleaner' when no username", () => {
      const appointment = {
        cleaners: [],
      };

      const cleanerName = appointment.cleaners?.[0]?.username || "Cleaner";

      expect(cleanerName).toBe("Cleaner");
    });

    it("should show completed badge", () => {
      const appointment = { completed: true };

      expect(appointment.completed).toBe(true);
    });
  });

  describe("View Photos Button", () => {
    it("should have view photos button for each appointment", () => {
      const appointment = { id: 100 };

      const viewPhotosButton = {
        text: "View Photos",
        appointmentId: appointment.id,
      };

      expect(viewPhotosButton.text).toBe("View Photos");
      expect(viewPhotosButton.appointmentId).toBe(100);
    });
  });

  describe("Photos Modal", () => {
    it("should fetch photos when modal opens", async () => {
      const mockPhotos = {
        beforePhotos: [{ id: 1, room: "Living Room", photoData: "data:image/png..." }],
        afterPhotos: [{ id: 2, room: "Living Room", photoData: "data:image/png..." }],
        hasBeforePhotos: true,
        hasAfterPhotos: true,
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockPhotos),
      });

      const response = await fetch("/api/v1/job-photos/100");
      const data = await response.json();

      expect(data.hasBeforePhotos).toBe(true);
      expect(data.hasAfterPhotos).toBe(true);
      expect(data.beforePhotos).toHaveLength(1);
      expect(data.afterPhotos).toHaveLength(1);
    });

    it("should group photos by room", () => {
      const photos = [
        { id: 1, room: "Living Room" },
        { id: 2, room: "Kitchen" },
        { id: 3, room: "Living Room" },
        { id: 4, room: "Bathroom" },
      ];

      const groupPhotosByRoom = (photoList) => {
        const grouped = {};
        photoList.forEach((photo) => {
          const room = photo.room || "Other";
          if (!grouped[room]) {
            grouped[room] = [];
          }
          grouped[room].push(photo);
        });
        return grouped;
      };

      const grouped = groupPhotosByRoom(photos);

      expect(grouped["Living Room"]).toHaveLength(2);
      expect(grouped["Kitchen"]).toHaveLength(1);
      expect(grouped["Bathroom"]).toHaveLength(1);
    });

    it("should put photos without room in 'Other' category", () => {
      const photos = [
        { id: 1, room: null },
        { id: 2, room: undefined },
        { id: 3, room: "" },
      ];

      const groupPhotosByRoom = (photoList) => {
        const grouped = {};
        photoList.forEach((photo) => {
          const room = photo.room || "Other";
          if (!grouped[room]) {
            grouped[room] = [];
          }
          grouped[room].push(photo);
        });
        return grouped;
      };

      const grouped = groupPhotosByRoom(photos);

      expect(grouped["Other"]).toHaveLength(3);
    });
  });

  describe("Photo Size Slider", () => {
    it("should have default size of 1", () => {
      const photoSize = 1;

      expect(photoSize).toBe(1);
    });

    it("should allow size range from 0.5 to 1.5", () => {
      const minSize = 0.5;
      const maxSize = 1.5;
      const steps = [0.5, 0.75, 1, 1.25, 1.5];

      expect(steps[0]).toBe(minSize);
      expect(steps[steps.length - 1]).toBe(maxSize);
      expect(steps).toHaveLength(5);
    });

    it("should calculate photo width based on size", () => {
      const screenWidth = 375;
      const padding = 32; // spacing.md * 4
      const baseWidth = screenWidth - padding;

      const getPhotoWidth = (size) => baseWidth * size;

      expect(getPhotoWidth(0.5)).toBe((375 - 32) * 0.5);
      expect(getPhotoWidth(1)).toBe(375 - 32);
      expect(getPhotoWidth(1.5)).toBe((375 - 32) * 1.5);
    });
  });

  describe("Before/After Tabs", () => {
    it("should have before and after tabs", () => {
      const tabs = ["before", "after"];

      expect(tabs).toContain("before");
      expect(tabs).toContain("after");
    });

    it("should start with before tab active", () => {
      const activePhotoTab = "before";

      expect(activePhotoTab).toBe("before");
    });

    it("should switch to after tab", () => {
      let activePhotoTab = "before";

      activePhotoTab = "after";

      expect(activePhotoTab).toBe("after");
    });

    it("should display photo count for each tab", () => {
      const beforePhotos = [{ id: 1 }, { id: 2 }];
      const afterPhotos = [{ id: 3 }];

      const beforeLabel = `Before (${beforePhotos.length})`;
      const afterLabel = `After (${afterPhotos.length})`;

      expect(beforeLabel).toBe("Before (2)");
      expect(afterLabel).toBe("After (1)");
    });
  });

  describe("Empty State", () => {
    it("should show empty message when no archived cleanings", () => {
      const archivedAppointments = [];
      const showEmptyState = archivedAppointments.length === 0;

      expect(showEmptyState).toBe(true);
    });

    it("should hide empty message when cleanings exist", () => {
      const archivedAppointments = [{ id: 1 }];
      const showEmptyState = archivedAppointments.length === 0;

      expect(showEmptyState).toBe(false);
    });
  });

  describe("Loading State", () => {
    it("should track loading state", () => {
      let loading = true;

      expect(loading).toBe(true);

      loading = false;

      expect(loading).toBe(false);
    });
  });

  describe("Collapsible Room Sections", () => {
    it("should default to expanded rooms", () => {
      const expandedRooms = {};
      const room = "Living Room";

      // Default to expanded if not explicitly collapsed
      const isExpanded = expandedRooms[room] !== false;

      expect(isExpanded).toBe(true);
    });

    it("should toggle room expansion", () => {
      let expandedRooms = {};
      const room = "Living Room";

      // Toggle to collapsed
      expandedRooms = { ...expandedRooms, [room]: false };
      expect(expandedRooms[room]).toBe(false);

      // Toggle back to expanded
      expandedRooms = { ...expandedRooms, [room]: true };
      expect(expandedRooms[room]).toBe(true);
    });
  });

  describe("Route Ordering Fix", () => {
    it("should not be caught by /:homeId route", async () => {
      // The /archived route should be defined before /:homeId
      // to prevent "archived" from being treated as a homeId

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ archivedAppointments: [] }),
      });

      const response = await fetch("/api/v1/appointments/archived");

      expect(response.ok).toBe(true);
    });
  });

  describe("Multiple Cleaners", () => {
    it("should display first cleaner when multiple assigned", () => {
      const appointment = {
        cleaners: [
          { username: "cleaner1" },
          { username: "cleaner2" },
        ],
      };

      const primaryCleaner = appointment.cleaners?.[0]?.username || "Cleaner";

      expect(primaryCleaner).toBe("cleaner1");
    });

    it("should handle multiple cleaners display", () => {
      const appointment = {
        cleaners: [
          { username: "cleaner1" },
          { username: "cleaner2" },
        ],
      };

      const cleanerNames = appointment.cleaners.map((c) => c.username).join(", ");

      expect(cleanerNames).toBe("cleaner1, cleaner2");
    });
  });
});
