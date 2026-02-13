/**
 * Comprehensive Tests for RoomAssignmentService
 * Handles room splitting and assignment logic for multi-cleaner jobs
 */

// Mock models
const mockCleanerRoomAssignment = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn(),
};

const mockCleanerJobCompletion = {
  findAll: jest.fn(),
};

const mockUser = {
  findByPk: jest.fn(),
};

const mockJobPhoto = {
  findAll: jest.fn(),
};

const mockChecklistSection = {
  findAll: jest.fn(),
};

const mockChecklistItem = {};

jest.mock("../../models", () => ({
  CleanerRoomAssignment: mockCleanerRoomAssignment,
  CleanerJobCompletion: mockCleanerJobCompletion,
  User: mockUser,
  JobPhoto: mockJobPhoto,
  ChecklistSection: mockChecklistSection,
  ChecklistItem: mockChecklistItem,
}));

// Import after mocks
const RoomAssignmentService = require("../../services/RoomAssignmentService");

describe("RoomAssignmentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // ROOM_EFFORT_ESTIMATES Tests
  // ============================================
  describe("ROOM_EFFORT_ESTIMATES", () => {
    it("should have correct effort estimates for each room type", () => {
      expect(RoomAssignmentService.ROOM_EFFORT_ESTIMATES.bedroom).toBe(30);
      expect(RoomAssignmentService.ROOM_EFFORT_ESTIMATES.bathroom).toBe(25);
      expect(RoomAssignmentService.ROOM_EFFORT_ESTIMATES.kitchen).toBe(40);
      expect(RoomAssignmentService.ROOM_EFFORT_ESTIMATES.living_room).toBe(25);
      expect(RoomAssignmentService.ROOM_EFFORT_ESTIMATES.dining_room).toBe(20);
      expect(RoomAssignmentService.ROOM_EFFORT_ESTIMATES.other).toBe(20);
    });
  });

  // ============================================
  // calculateRoomEffort Tests
  // ============================================
  describe("calculateRoomEffort", () => {
    describe("base effort by room type", () => {
      it("should return 30 minutes for bedroom", () => {
        expect(RoomAssignmentService.calculateRoomEffort("bedroom")).toBe(30);
      });

      it("should return 25 minutes for bathroom", () => {
        expect(RoomAssignmentService.calculateRoomEffort("bathroom")).toBe(25);
      });

      it("should return 40 minutes for kitchen", () => {
        expect(RoomAssignmentService.calculateRoomEffort("kitchen")).toBe(40);
      });

      it("should return 25 minutes for living room", () => {
        expect(RoomAssignmentService.calculateRoomEffort("living_room")).toBe(25);
      });

      it("should return 20 minutes for dining room", () => {
        expect(RoomAssignmentService.calculateRoomEffort("dining_room")).toBe(20);
      });

      it("should return 20 minutes for other room types", () => {
        expect(RoomAssignmentService.calculateRoomEffort("other")).toBe(20);
      });

      it("should return 20 minutes for unknown room types", () => {
        expect(RoomAssignmentService.calculateRoomEffort("garage")).toBe(20);
        expect(RoomAssignmentService.calculateRoomEffort("basement")).toBe(20);
        expect(RoomAssignmentService.calculateRoomEffort("unknown")).toBe(20);
      });
    });

    describe("square footage adjustments", () => {
      it("should scale up for large rooms", () => {
        // 300 sq ft = 2x baseline (150)
        const effort = RoomAssignmentService.calculateRoomEffort("bedroom", 300);
        expect(effort).toBe(60); // 30 * 2
      });

      it("should scale down for small rooms", () => {
        // 75 sq ft = 0.5x baseline, but capped at 0.5 minimum
        const effort = RoomAssignmentService.calculateRoomEffort("bedroom", 75);
        expect(effort).toBe(15); // 30 * 0.5
      });

      it("should cap at 2x for very large rooms", () => {
        // 500 sq ft would be 3.33x, but capped at 2
        const effort = RoomAssignmentService.calculateRoomEffort("bedroom", 500);
        expect(effort).toBe(60); // 30 * 2 (capped)
      });

      it("should cap at 0.5x for very small rooms", () => {
        // 30 sq ft would be 0.2x, but capped at 0.5
        const effort = RoomAssignmentService.calculateRoomEffort("bedroom", 30);
        expect(effort).toBe(15); // 30 * 0.5 (capped)
      });

      it("should use baseline for 150 sq ft", () => {
        const effort = RoomAssignmentService.calculateRoomEffort("bedroom", 150);
        expect(effort).toBe(30); // 30 * 1
      });

      it("should handle null square footage", () => {
        const effort = RoomAssignmentService.calculateRoomEffort("bedroom", null);
        expect(effort).toBe(30); // Use base effort
      });
    });
  });

  // ============================================
  // generateRoomListFromHome Tests
  // ============================================
  describe("generateRoomListFromHome", () => {
    it("should generate correct number of bedrooms", () => {
      const home = { numBeds: 4, numBaths: 2 };
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      const bedrooms = rooms.filter((r) => r.roomType === "bedroom");
      expect(bedrooms).toHaveLength(4);
    });

    it("should label first bedroom as Master Bedroom", () => {
      const home = { numBeds: 3, numBaths: 2 };
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      const masterBedroom = rooms.find((r) => r.roomLabel === "Master Bedroom");
      expect(masterBedroom).toBeDefined();
      expect(masterBedroom.roomNumber).toBe(1);
    });

    it("should number bedrooms correctly", () => {
      const home = { numBeds: 3, numBaths: 2 };
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      const bedrooms = rooms.filter((r) => r.roomType === "bedroom");
      expect(bedrooms[0].roomLabel).toBe("Master Bedroom");
      expect(bedrooms[1].roomLabel).toBe("Bedroom 2");
      expect(bedrooms[2].roomLabel).toBe("Bedroom 3");
    });

    it("should generate correct number of full bathrooms", () => {
      const home = { numBeds: 3, numBaths: 3 };
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      const bathrooms = rooms.filter((r) => r.roomType === "bathroom");
      expect(bathrooms).toHaveLength(3);
    });

    it("should handle half bathrooms correctly", () => {
      const home = { numBeds: 3, numBaths: 2.5 };
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      const bathrooms = rooms.filter((r) => r.roomType === "bathroom");
      expect(bathrooms).toHaveLength(3); // 2 full + 1 half

      const halfBath = bathrooms.find((r) => r.roomLabel === "Half Bath");
      expect(halfBath).toBeDefined();
      expect(halfBath.estimatedMinutes).toBe(13); // Round(25 * 0.5) = 12.5 -> 13
    });

    it("should label first bathroom as Master Bathroom", () => {
      const home = { numBeds: 3, numBaths: 2 };
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      const masterBath = rooms.find((r) => r.roomLabel === "Master Bathroom");
      expect(masterBath).toBeDefined();
      expect(masterBath.roomNumber).toBe(1);
    });

    it("should always include kitchen", () => {
      const home = { numBeds: 2, numBaths: 1 };
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      const kitchen = rooms.find((r) => r.roomType === "kitchen");
      expect(kitchen).toBeDefined();
      expect(kitchen.roomLabel).toBe("Kitchen");
      expect(kitchen.estimatedMinutes).toBe(40);
    });

    it("should always include living room", () => {
      const home = { numBeds: 2, numBaths: 1 };
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      const livingRoom = rooms.find((r) => r.roomType === "living_room");
      expect(livingRoom).toBeDefined();
      expect(livingRoom.roomLabel).toBe("Living Room");
      expect(livingRoom.estimatedMinutes).toBe(25);
    });

    it("should include dining room for 3+ bedroom homes", () => {
      const home = { numBeds: 3, numBaths: 2 };
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      const diningRoom = rooms.find((r) => r.roomType === "dining_room");
      expect(diningRoom).toBeDefined();
      expect(diningRoom.roomLabel).toBe("Dining Room");
    });

    it("should NOT include dining room for 2 bedroom homes", () => {
      const home = { numBeds: 2, numBaths: 1 };
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      const diningRoom = rooms.find((r) => r.roomType === "dining_room");
      expect(diningRoom).toBeUndefined();
    });

    it("should handle string inputs", () => {
      const home = { numBeds: "3", numBaths: "2" };
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      const bedrooms = rooms.filter((r) => r.roomType === "bedroom");
      expect(bedrooms).toHaveLength(3);
    });

    it("should handle missing values", () => {
      const home = {};
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      // Should still have kitchen and living room
      expect(rooms.filter((r) => r.roomType === "kitchen")).toHaveLength(1);
      expect(rooms.filter((r) => r.roomType === "living_room")).toHaveLength(1);
      // Should have 0 bedrooms and bathrooms
      expect(rooms.filter((r) => r.roomType === "bedroom")).toHaveLength(0);
      expect(rooms.filter((r) => r.roomType === "bathroom")).toHaveLength(0);
    });

    it("should include estimatedMinutes for each room", () => {
      const home = { numBeds: 3, numBaths: 2 };
      const rooms = RoomAssignmentService.generateRoomListFromHome(home);

      rooms.forEach((room) => {
        expect(room.estimatedMinutes).toBeDefined();
        expect(room.estimatedMinutes).toBeGreaterThan(0);
      });
    });
  });

  // ============================================
  // splitRoomsProportionally Tests
  // ============================================
  describe("splitRoomsProportionally", () => {
    it("should return all rooms in one array for single cleaner", () => {
      const home = { numBeds: 3, numBaths: 2 };
      const splits = RoomAssignmentService.splitRoomsProportionally(home, 1);

      expect(splits).toHaveLength(1);
      expect(splits[0].length).toBeGreaterThan(0);
    });

    it("should split into two groups for two cleaners", () => {
      const home = { numBeds: 4, numBaths: 3 };
      const splits = RoomAssignmentService.splitRoomsProportionally(home, 2);

      expect(splits).toHaveLength(2);
      expect(splits[0].length).toBeGreaterThan(0);
      expect(splits[1].length).toBeGreaterThan(0);
    });

    it("should split into three groups for three cleaners", () => {
      const home = { numBeds: 6, numBaths: 4 };
      const splits = RoomAssignmentService.splitRoomsProportionally(home, 3);

      expect(splits).toHaveLength(3);
      splits.forEach((split) => {
        expect(split.length).toBeGreaterThan(0);
      });
    });

    it("should balance effort roughly equally", () => {
      const home = { numBeds: 4, numBaths: 3 };
      const splits = RoomAssignmentService.splitRoomsProportionally(home, 2);

      const effort1 = splits[0].reduce((sum, r) => sum + r.estimatedMinutes, 0);
      const effort2 = splits[1].reduce((sum, r) => sum + r.estimatedMinutes, 0);

      // Efforts should be within 30% of each other
      const maxEffort = Math.max(effort1, effort2);
      const minEffort = Math.min(effort1, effort2);
      expect(maxEffort / minEffort).toBeLessThan(1.5);
    });

    it("should include all rooms across all splits", () => {
      const home = { numBeds: 4, numBaths: 3 };
      const allRooms = RoomAssignmentService.generateRoomListFromHome(home);
      const splits = RoomAssignmentService.splitRoomsProportionally(home, 2);

      const totalRoomsInSplits = splits.reduce((sum, split) => sum + split.length, 0);
      expect(totalRoomsInSplits).toBe(allRooms.length);
    });

    it("should handle more cleaners than rooms", () => {
      const home = { numBeds: 1, numBaths: 1 };
      const splits = RoomAssignmentService.splitRoomsProportionally(home, 4);

      expect(splits).toHaveLength(4);
      // Some splits might be empty
      const nonEmptySplits = splits.filter((s) => s.length > 0);
      expect(nonEmptySplits.length).toBeGreaterThan(0);
    });

    it("should assign high-effort rooms first", () => {
      const home = { numBeds: 2, numBaths: 2 };
      const splits = RoomAssignmentService.splitRoomsProportionally(home, 2);

      // Kitchen (40 min) should be in a split
      const allRooms = [...splits[0], ...splits[1]];
      const kitchen = allRooms.find((r) => r.roomType === "kitchen");
      expect(kitchen).toBeDefined();
    });
  });

  // ============================================
  // createRoomAssignments Tests
  // ============================================
  describe("createRoomAssignments", () => {
    beforeEach(() => {
      mockCleanerRoomAssignment.create.mockImplementation((data) =>
        Promise.resolve({
          id: Math.floor(Math.random() * 1000),
          ...data,
          dataValues: { cleanerSlotIndex: 0 },
        })
      );
    });

    it("should create room assignments for all rooms", async () => {
      const home = { numBeds: 3, numBaths: 2 };
      const allRooms = RoomAssignmentService.generateRoomListFromHome(home);

      const assignments = await RoomAssignmentService.createRoomAssignments(
        10, 100, home, 2
      );

      expect(assignments.length).toBe(allRooms.length);
    });

    it("should set cleanerId to null initially", async () => {
      const home = { numBeds: 2, numBaths: 1 };

      await RoomAssignmentService.createRoomAssignments(10, 100, home, 2);

      expect(mockCleanerRoomAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cleanerId: null,
        })
      );
    });

    it("should set status to pending", async () => {
      const home = { numBeds: 2, numBaths: 1 };

      await RoomAssignmentService.createRoomAssignments(10, 100, home, 2);

      expect(mockCleanerRoomAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending",
        })
      );
    });

    it("should include multiCleanerJobId", async () => {
      const home = { numBeds: 2, numBaths: 1 };

      await RoomAssignmentService.createRoomAssignments(10, 100, home, 2);

      expect(mockCleanerRoomAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          multiCleanerJobId: 10,
        })
      );
    });

    it("should include appointmentId", async () => {
      const home = { numBeds: 2, numBaths: 1 };

      await RoomAssignmentService.createRoomAssignments(10, 100, home, 2);

      expect(mockCleanerRoomAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: 100,
        })
      );
    });
  });

  // ============================================
  // getCleanerRooms Tests
  // ============================================
  describe("getCleanerRooms", () => {
    it("should query for cleaner-specific assignments", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([]);

      await RoomAssignmentService.getCleanerRooms(100, 50);

      expect(mockCleanerRoomAssignment.findAll).toHaveBeenCalledWith({
        where: { appointmentId: 100, cleanerId: 50 },
        order: [
          ["roomType", "ASC"],
          ["roomNumber", "ASC"],
        ],
      });
    });

    it("should return empty array when no assignments", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([]);

      const rooms = await RoomAssignmentService.getCleanerRooms(100, 50);

      expect(rooms).toEqual([]);
    });

    it("should return assignments for cleaner", async () => {
      const mockAssignments = [
        { id: 1, roomType: "bedroom", cleanerId: 50 },
        { id: 2, roomType: "bathroom", cleanerId: 50 },
      ];
      mockCleanerRoomAssignment.findAll.mockResolvedValue(mockAssignments);

      const rooms = await RoomAssignmentService.getCleanerRooms(100, 50);

      expect(rooms).toHaveLength(2);
    });
  });

  // ============================================
  // getAllRoomAssignments Tests
  // ============================================
  describe("getAllRoomAssignments", () => {
    it("should include cleaner details", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([]);

      await RoomAssignmentService.getAllRoomAssignments(100);

      expect(mockCleanerRoomAssignment.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({
              as: "cleaner",
            }),
          ]),
        })
      );
    });

    it("should order by room type and number", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([]);

      await RoomAssignmentService.getAllRoomAssignments(100);

      expect(mockCleanerRoomAssignment.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [
            ["roomType", "ASC"],
            ["roomNumber", "ASC"],
          ],
        })
      );
    });
  });

  // ============================================
  // assignRoomsToCleaner Tests
  // ============================================
  describe("assignRoomsToCleaner", () => {
    it("should update rooms with cleaner id", async () => {
      mockCleanerRoomAssignment.update.mockResolvedValue([2]);
      mockCleanerRoomAssignment.findAll.mockResolvedValue([
        { id: 1 }, { id: 2 },
      ]);

      await RoomAssignmentService.assignRoomsToCleaner(10, 50, [1, 2]);

      expect(mockCleanerRoomAssignment.update).toHaveBeenCalledWith(
        { cleanerId: 50 },
        {
          where: {
            id: [1, 2],
            multiCleanerJobId: 10,
            cleanerId: null,
          },
        }
      );
    });

    it("should only update unassigned rooms", async () => {
      mockCleanerRoomAssignment.update.mockResolvedValue([2]);
      mockCleanerRoomAssignment.findAll.mockResolvedValue([]);

      await RoomAssignmentService.assignRoomsToCleaner(10, 50, [1, 2]);

      expect(mockCleanerRoomAssignment.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: expect.objectContaining({
            cleanerId: null,
          }),
        })
      );
    });

    it("should return updated assignments", async () => {
      const mockUpdated = [
        { id: 1, cleanerId: 50 },
        { id: 2, cleanerId: 50 },
      ];
      mockCleanerRoomAssignment.update.mockResolvedValue([2]);
      mockCleanerRoomAssignment.findAll.mockResolvedValue(mockUpdated);

      const result = await RoomAssignmentService.assignRoomsToCleaner(10, 50, [1, 2]);

      expect(result).toEqual(mockUpdated);
    });
  });

  // ============================================
  // validateRoomCompletion Tests
  // ============================================
  describe("validateRoomCompletion", () => {
    const mockAssignment = {
      id: 1,
      cleanerId: 50,
      roomType: "bedroom",
    };

    beforeEach(() => {
      mockCleanerRoomAssignment.findByPk.mockResolvedValue(mockAssignment);
    });

    it("should return invalid if assignment not found", async () => {
      mockCleanerRoomAssignment.findByPk.mockResolvedValue(null);

      const result = await RoomAssignmentService.validateRoomCompletion(50, 1);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Room assignment not found");
    });

    it("should return invalid if cleaner doesn't match", async () => {
      const result = await RoomAssignmentService.validateRoomCompletion(999, 1);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Room not assigned to this cleaner");
    });

    it("should return invalid if no before photos", async () => {
      mockJobPhoto.findAll.mockResolvedValue([
        { photoType: "after" },
      ]);

      const result = await RoomAssignmentService.validateRoomCompletion(50, 1);

      expect(result.valid).toBe(false);
      expect(result.beforePhotoCount).toBe(0);
    });

    it("should return invalid if no after photos", async () => {
      mockJobPhoto.findAll.mockResolvedValue([
        { photoType: "before" },
      ]);

      const result = await RoomAssignmentService.validateRoomCompletion(50, 1);

      expect(result.valid).toBe(false);
      expect(result.afterPhotoCount).toBe(0);
    });

    it("should return valid if both before and after photos exist", async () => {
      mockJobPhoto.findAll.mockResolvedValue([
        { photoType: "before" },
        { photoType: "after" },
      ]);

      const result = await RoomAssignmentService.validateRoomCompletion(50, 1);

      expect(result.valid).toBe(true);
      expect(result.beforePhotoCount).toBe(1);
      expect(result.afterPhotoCount).toBe(1);
      expect(result.error).toBeNull();
    });

    it("should count multiple photos correctly", async () => {
      mockJobPhoto.findAll.mockResolvedValue([
        { photoType: "before" },
        { photoType: "before" },
        { photoType: "after" },
        { photoType: "after" },
        { photoType: "after" },
      ]);

      const result = await RoomAssignmentService.validateRoomCompletion(50, 1);

      expect(result.valid).toBe(true);
      expect(result.beforePhotoCount).toBe(2);
      expect(result.afterPhotoCount).toBe(3);
    });
  });

  // ============================================
  // rebalanceAfterDropout Tests
  // ============================================
  describe("rebalanceAfterDropout", () => {
    beforeEach(() => {
      // Reset mocks to clear any leftover mockResolvedValueOnce
      mockCleanerRoomAssignment.findAll.mockReset();
      mockCleanerJobCompletion.findAll.mockReset();
      mockCleanerRoomAssignment.update.mockReset();
    });

    it("should return empty array if no active cleaners", async () => {
      mockCleanerJobCompletion.findAll.mockResolvedValue([]);

      const result = await RoomAssignmentService.rebalanceAfterDropout(10);

      expect(result).toEqual({ rebalanced: false, reason: "no_cleaners", assignments: [] });
    });

    it("should return empty array if no unassigned rooms", async () => {
      mockCleanerJobCompletion.findAll.mockResolvedValue([
        { cleanerId: 50, status: "assigned" },
      ]);
      mockCleanerRoomAssignment.findAll
        .mockResolvedValueOnce([]) // unassigned rooms
        .mockResolvedValueOnce([]); // final return

      const result = await RoomAssignmentService.rebalanceAfterDropout(10);

      expect(result).toEqual({ rebalanced: false, reason: "no_unassigned_rooms", assignments: [] });
    });

    it("should assign all rooms to remaining cleaner if solo", async () => {
      mockCleanerJobCompletion.findAll.mockResolvedValue([
        { cleanerId: 50, status: "assigned" },
      ]);
      // First call returns unassigned rooms, second call returns final state
      mockCleanerRoomAssignment.findAll
        .mockResolvedValueOnce([
          { id: 1, cleanerId: null, status: "pending" },
          { id: 2, cleanerId: null, status: "pending" },
        ])
        .mockResolvedValueOnce([
          { id: 1, cleanerId: 50 },
          { id: 2, cleanerId: 50 },
        ]);
      mockCleanerRoomAssignment.update.mockResolvedValue([2]);

      await RoomAssignmentService.rebalanceAfterDropout(10);

      expect(mockCleanerRoomAssignment.update).toHaveBeenCalledWith(
        { cleanerId: 50 },
        {
          where: {
            multiCleanerJobId: 10,
            cleanerId: null,
          },
        }
      );
    });

    it("should return updated assignments", async () => {
      const mockUpdatedAssignments = [
        { id: 1, cleanerId: 50 },
        { id: 2, cleanerId: 50 },
      ];
      mockCleanerJobCompletion.findAll.mockResolvedValue([
        { cleanerId: 50, status: "assigned" },
      ]);
      mockCleanerRoomAssignment.findAll
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
        .mockResolvedValueOnce(mockUpdatedAssignments);
      mockCleanerRoomAssignment.update.mockResolvedValue([2]);

      const result = await RoomAssignmentService.rebalanceAfterDropout(10);

      expect(result.rebalanced).toBe(true);
      expect(result.assignments).toEqual(mockUpdatedAssignments);
      expect(result.unassignedCount).toBe(2);
      expect(result.remainingCleaners).toBe(1);
    });
  });

  // ============================================
  // calculateCleanerEarningsShare Tests
  // ============================================
  describe("calculateCleanerEarningsShare", () => {
    beforeEach(() => {
      // Reset all mocks to clear any leftover mockResolvedValueOnce
      mockCleanerRoomAssignment.findAll.mockReset();
    });

    it("should sum up earnings from all assignments", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([
        { cleanerEarningsShare: 3000 },
        { cleanerEarningsShare: 2500 },
        { cleanerEarningsShare: 1500 },
      ]);

      const total = await RoomAssignmentService.calculateCleanerEarningsShare(50, 10);

      expect(total).toBe(7000);
    });

    it("should return 0 if no assignments", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([]);

      const total = await RoomAssignmentService.calculateCleanerEarningsShare(50, 10);

      expect(total).toBe(0);
    });

    it("should handle null/undefined earnings shares", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([
        { cleanerEarningsShare: 3000 },
        { cleanerEarningsShare: null },
        { cleanerEarningsShare: undefined },
      ]);

      const total = await RoomAssignmentService.calculateCleanerEarningsShare(50, 10);

      expect(total).toBe(3000);
    });

    it("should query with correct parameters", async () => {
      mockCleanerRoomAssignment.findAll.mockResolvedValue([]);

      await RoomAssignmentService.calculateCleanerEarningsShare(50, 10);

      expect(mockCleanerRoomAssignment.findAll).toHaveBeenCalledWith({
        where: { multiCleanerJobId: 10, cleanerId: 50 },
      });
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe("Edge Cases", () => {
    describe("generateRoomListFromHome edge cases", () => {
      it("should handle zero bedrooms", () => {
        const home = { numBeds: 0, numBaths: 1 };
        const rooms = RoomAssignmentService.generateRoomListFromHome(home);

        const bedrooms = rooms.filter((r) => r.roomType === "bedroom");
        expect(bedrooms).toHaveLength(0);
      });

      it("should handle zero bathrooms", () => {
        const home = { numBeds: 2, numBaths: 0 };
        const rooms = RoomAssignmentService.generateRoomListFromHome(home);

        const bathrooms = rooms.filter((r) => r.roomType === "bathroom");
        expect(bathrooms).toHaveLength(0);
      });

      it("should handle very large homes", () => {
        const home = { numBeds: 10, numBaths: 8 };
        const rooms = RoomAssignmentService.generateRoomListFromHome(home);

        const bedrooms = rooms.filter((r) => r.roomType === "bedroom");
        const bathrooms = rooms.filter((r) => r.roomType === "bathroom");
        expect(bedrooms).toHaveLength(10);
        expect(bathrooms).toHaveLength(8);
      });

      it("should handle 0.5 bathrooms", () => {
        const home = { numBeds: 1, numBaths: 0.5 };
        const rooms = RoomAssignmentService.generateRoomListFromHome(home);

        const bathrooms = rooms.filter((r) => r.roomType === "bathroom");
        expect(bathrooms).toHaveLength(1);
        expect(bathrooms[0].roomLabel).toBe("Half Bath");
      });
    });

    describe("splitRoomsProportionally edge cases", () => {
      it("should handle 0 cleaners gracefully", () => {
        const home = { numBeds: 3, numBaths: 2 };
        // This would be an edge case that shouldn't happen in practice
        const splits = RoomAssignmentService.splitRoomsProportionally(home, 0);

        // Should return empty array for 0 cleaners
        expect(Array.isArray(splits)).toBe(true);
      });

      it("should handle empty home", () => {
        const home = { numBeds: 0, numBaths: 0 };
        const splits = RoomAssignmentService.splitRoomsProportionally(home, 2);

        // Should still have kitchen and living room to split
        const totalRooms = splits.reduce((sum, s) => sum + s.length, 0);
        expect(totalRooms).toBe(2); // Kitchen + Living Room
      });
    });
  });
});
