/**
 * RoomAssignmentService
 *
 * Handles room splitting and assignment logic for multi-cleaner jobs.
 * Supports proportional assignment based on estimated effort.
 */

class RoomAssignmentService {
  /**
   * Standard effort estimates in minutes by room type
   */
  static ROOM_EFFORT_ESTIMATES = {
    bedroom: 30,
    bathroom: 25,
    kitchen: 40,
    living_room: 25,
    dining_room: 20,
    other: 20,
  };

  /**
   * Calculate estimated effort for a room
   * @param {string} roomType - Type of room
   * @param {number} squareFt - Optional square footage
   * @returns {number} Estimated minutes
   */
  static calculateRoomEffort(roomType, squareFt = null) {
    const baseEffort = this.ROOM_EFFORT_ESTIMATES[roomType] || 20;

    // If square footage is provided, adjust based on size
    if (squareFt) {
      const sizeFactor = squareFt / 150; // 150 sq ft as baseline
      return Math.round(baseEffort * Math.max(0.5, Math.min(2, sizeFactor)));
    }

    return baseEffort;
  }

  /**
   * Generate room list from home configuration
   * @param {Object} home - Home object
   * @returns {Array} Array of room objects
   */
  static generateRoomListFromHome(home) {
    const rooms = [];
    const beds = parseFloat(home.numBeds) || 0;
    const baths = parseFloat(home.numBaths) || 0;

    // Add bedrooms
    for (let i = 1; i <= beds; i++) {
      rooms.push({
        roomType: "bedroom",
        roomNumber: i,
        roomLabel: i === 1 ? "Master Bedroom" : `Bedroom ${i}`,
        estimatedMinutes: this.calculateRoomEffort("bedroom"),
      });
    }

    // Add bathrooms
    const fullBaths = Math.floor(baths);
    const hasHalfBath = baths % 1 >= 0.5;

    for (let i = 1; i <= fullBaths; i++) {
      rooms.push({
        roomType: "bathroom",
        roomNumber: i,
        roomLabel: i === 1 ? "Master Bathroom" : `Bathroom ${i}`,
        estimatedMinutes: this.calculateRoomEffort("bathroom"),
      });
    }

    if (hasHalfBath) {
      rooms.push({
        roomType: "bathroom",
        roomNumber: fullBaths + 1,
        roomLabel: "Half Bath",
        estimatedMinutes: Math.round(this.calculateRoomEffort("bathroom") * 0.5),
      });
    }

    // Add common areas (always included)
    rooms.push({
      roomType: "kitchen",
      roomNumber: 1,
      roomLabel: "Kitchen",
      estimatedMinutes: this.calculateRoomEffort("kitchen"),
    });

    rooms.push({
      roomType: "living_room",
      roomNumber: 1,
      roomLabel: "Living Room",
      estimatedMinutes: this.calculateRoomEffort("living_room"),
    });

    // Add dining room if home is large enough
    if (beds >= 3) {
      rooms.push({
        roomType: "dining_room",
        roomNumber: 1,
        roomLabel: "Dining Room",
        estimatedMinutes: this.calculateRoomEffort("dining_room"),
      });
    }

    return rooms;
  }

  /**
   * Split rooms proportionally among cleaners based on effort
   * @param {Object} home - Home object
   * @param {number} cleanerCount - Number of cleaners
   * @returns {Array<Array>} Array of room assignments per cleaner
   */
  static splitRoomsProportionally(home, cleanerCount) {
    const rooms = this.generateRoomListFromHome(home);

    if (cleanerCount <= 1) {
      return [rooms]; // All rooms to single cleaner
    }

    // Calculate total effort
    const totalEffort = rooms.reduce((sum, r) => sum + r.estimatedMinutes, 0);
    const targetEffortPerCleaner = totalEffort / cleanerCount;

    // Sort rooms by effort (descending) for better distribution
    const sortedRooms = [...rooms].sort(
      (a, b) => b.estimatedMinutes - a.estimatedMinutes
    );

    // Initialize assignments for each cleaner
    const assignments = Array.from({ length: cleanerCount }, () => ({
      rooms: [],
      totalEffort: 0,
    }));

    // Greedy assignment: assign each room to the cleaner with least effort
    for (const room of sortedRooms) {
      // Find cleaner with minimum current effort
      let minIndex = 0;
      let minEffort = assignments[0].totalEffort;

      for (let i = 1; i < cleanerCount; i++) {
        if (assignments[i].totalEffort < minEffort) {
          minEffort = assignments[i].totalEffort;
          minIndex = i;
        }
      }

      // Assign room to that cleaner
      assignments[minIndex].rooms.push(room);
      assignments[minIndex].totalEffort += room.estimatedMinutes;
    }

    return assignments.map((a) => a.rooms);
  }

  /**
   * Create room assignments for a multi-cleaner job
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} appointmentId - Appointment ID
   * @param {Object} home - Home object
   * @param {number} cleanerCount - Number of cleaners
   * @returns {Promise<Array>} Created CleanerRoomAssignment records
   */
  static async createRoomAssignments(
    multiCleanerJobId,
    appointmentId,
    home,
    cleanerCount
  ) {
    const { CleanerRoomAssignment } = require("../models");

    const roomSplits = this.splitRoomsProportionally(home, cleanerCount);
    const assignments = [];

    // Create assignments (cleanerId will be null initially)
    for (let cleanerIndex = 0; cleanerIndex < roomSplits.length; cleanerIndex++) {
      const cleanerRooms = roomSplits[cleanerIndex];

      for (const room of cleanerRooms) {
        const assignment = await CleanerRoomAssignment.create({
          multiCleanerJobId,
          cleanerId: null, // Will be assigned when cleaner accepts
          appointmentId,
          roomType: room.roomType,
          roomNumber: room.roomNumber,
          roomLabel: room.roomLabel,
          estimatedMinutes: room.estimatedMinutes,
          status: "pending",
        });

        // Store the cleaner index for later assignment
        assignment.dataValues.cleanerSlotIndex = cleanerIndex;
        assignments.push(assignment);
      }
    }

    return assignments;
  }

  /**
   * Get room assignments for a specific cleaner
   * @param {number} appointmentId - Appointment ID
   * @param {number} cleanerId - Cleaner ID
   * @returns {Promise<Array>} Room assignments for the cleaner
   */
  static async getCleanerRooms(appointmentId, cleanerId) {
    const { CleanerRoomAssignment } = require("../models");

    return CleanerRoomAssignment.findAll({
      where: { appointmentId, cleanerId },
      order: [
        ["roomType", "ASC"],
        ["roomNumber", "ASC"],
      ],
    });
  }

  /**
   * Get all room assignments for an appointment
   * @param {number} appointmentId - Appointment ID
   * @returns {Promise<Array>} All room assignments
   */
  static async getAllRoomAssignments(appointmentId) {
    const { CleanerRoomAssignment, User } = require("../models");

    return CleanerRoomAssignment.findAll({
      where: { appointmentId },
      include: [
        {
          model: User,
          as: "cleaner",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
      order: [
        ["roomType", "ASC"],
        ["roomNumber", "ASC"],
      ],
    });
  }

  /**
   * Get unassigned room assignments for a job (available slots)
   * @param {number} multiCleanerJobId - Job ID
   * @returns {Promise<Array>} Unassigned room assignments grouped by slot
   */
  static async getUnassignedSlots(multiCleanerJobId) {
    const { CleanerRoomAssignment } = require("../models");

    const unassigned = await CleanerRoomAssignment.findAll({
      where: {
        multiCleanerJobId,
        cleanerId: null,
      },
      order: [["estimatedMinutes", "DESC"]],
    });

    // Group by a synthetic "slot" based on distribution
    // This is a simplified approach - in reality you'd want smarter grouping
    const roomSplits = this.splitRoomsProportionally(
      { numBeds: 0, numBaths: 0 }, // Not used when we already have rooms
      2 // Default to 2 cleaners for splitting
    );

    return unassigned;
  }

  /**
   * Assign rooms to a cleaner for a specific slot
   * @param {number} multiCleanerJobId - Job ID
   * @param {number} cleanerId - Cleaner ID
   * @param {Array<number>} roomAssignmentIds - Room assignment IDs
   * @returns {Promise<Array>} Updated assignments
   */
  static async assignRoomsToCleaner(multiCleanerJobId, cleanerId, roomAssignmentIds) {
    const { CleanerRoomAssignment } = require("../models");

    await CleanerRoomAssignment.update(
      { cleanerId },
      {
        where: {
          id: roomAssignmentIds,
          multiCleanerJobId,
          cleanerId: null, // Only update if not already assigned
        },
      }
    );

    return CleanerRoomAssignment.findAll({
      where: { id: roomAssignmentIds },
    });
  }

  /**
   * Generate cleaner-specific checklist based on room assignments
   * @param {number} cleanerId - Cleaner ID
   * @param {Array<number>} roomAssignmentIds - Room assignment IDs
   * @returns {Promise<Object>} Filtered checklist
   */
  static async generateCleanerChecklist(cleanerId, roomAssignmentIds) {
    const { CleanerRoomAssignment, ChecklistSection, ChecklistItem } = require("../models");

    // Get the cleaner's assigned rooms
    const assignments = await CleanerRoomAssignment.findAll({
      where: { id: roomAssignmentIds },
    });

    // Get the base checklist
    const sections = await ChecklistSection.findAll({
      include: [
        {
          model: ChecklistItem,
          as: "items",
          where: { isActive: true },
        },
      ],
      order: [
        ["displayOrder", "ASC"],
        [{ model: ChecklistItem, as: "items" }, "displayOrder", "ASC"],
      ],
    });

    // Map room types to checklist sections
    const roomTypeToSection = {
      bedroom: ["Bedrooms"],
      bathroom: ["Bathrooms"],
      kitchen: ["Kitchen"],
      living_room: ["Living Areas"],
      dining_room: ["Living Areas"],
      other: ["General"],
    };

    // Filter sections based on assigned rooms
    const assignedRoomTypes = new Set(assignments.map((a) => a.roomType));
    const allowedSections = new Set(["General"]); // Always include General

    for (const roomType of assignedRoomTypes) {
      const sectionNames = roomTypeToSection[roomType] || [];
      sectionNames.forEach((name) => allowedSections.add(name));
    }

    // Filter and format checklist
    const filteredSections = sections
      .filter((s) => allowedSections.has(s.title))
      .map((section) => ({
        id: section.id,
        title: section.title,
        icon: section.icon,
        items: section.items.map((item) => ({
          id: item.id,
          content: item.content,
          indentLevel: item.indentLevel,
          formatting: item.formatting,
        })),
      }));

    return {
      cleanerId,
      assignedRooms: assignments.map((a) => a.getDisplayLabel()),
      sections: filteredSections,
    };
  }

  /**
   * Validate room completion (check if photos exist, etc.)
   * @param {number} cleanerId - Cleaner ID
   * @param {number} roomAssignmentId - Room assignment ID
   * @returns {Promise<Object>} Validation result
   */
  static async validateRoomCompletion(cleanerId, roomAssignmentId) {
    const { CleanerRoomAssignment, JobPhoto } = require("../models");

    const assignment = await CleanerRoomAssignment.findByPk(roomAssignmentId);
    if (!assignment) {
      return { valid: false, error: "Room assignment not found" };
    }

    if (assignment.cleanerId !== cleanerId) {
      return { valid: false, error: "Room not assigned to this cleaner" };
    }

    // Check for before and after photos
    const photos = await JobPhoto.findAll({
      where: { roomAssignmentId },
    });

    const beforePhotos = photos.filter((p) => p.photoType === "before");
    const afterPhotos = photos.filter((p) => p.photoType === "after");

    const hasRequiredPhotos = beforePhotos.length > 0 && afterPhotos.length > 0;

    return {
      valid: hasRequiredPhotos,
      beforePhotoCount: beforePhotos.length,
      afterPhotoCount: afterPhotos.length,
      error: hasRequiredPhotos ? null : "Missing before or after photos",
    };
  }

  /**
   * Rebalance room assignments after a cleaner dropout
   * @param {number} multiCleanerJobId - Job ID
   * @returns {Promise<Array>} Updated assignments
   */
  static async rebalanceAfterDropout(multiCleanerJobId) {
    const { CleanerRoomAssignment, CleanerJobCompletion } = require("../models");

    // Get remaining active cleaners
    const activeCompletions = await CleanerJobCompletion.findAll({
      where: {
        multiCleanerJobId,
        status: { $notIn: ["dropped_out", "no_show"] },
      },
    });

    if (activeCompletions.length === 0) {
      // No cleaners left - nothing to rebalance
      return [];
    }

    // Get unassigned rooms (from dropped cleaner)
    const unassignedRooms = await CleanerRoomAssignment.findAll({
      where: {
        multiCleanerJobId,
        cleanerId: null,
        status: "pending",
      },
    });

    if (unassignedRooms.length === 0) {
      return []; // Nothing to reassign
    }

    // If only one cleaner remains, assign all rooms to them
    if (activeCompletions.length === 1) {
      const remainingCleanerId = activeCompletions[0].cleanerId;
      await CleanerRoomAssignment.update(
        { cleanerId: remainingCleanerId },
        {
          where: {
            multiCleanerJobId,
            cleanerId: null,
          },
        }
      );
    }

    // Return updated assignments
    return CleanerRoomAssignment.findAll({
      where: { multiCleanerJobId },
    });
  }

  /**
   * Calculate total earnings share for a cleaner's assignments
   * @param {number} cleanerId - Cleaner ID
   * @param {number} multiCleanerJobId - Job ID
   * @returns {Promise<number>} Total earnings in cents
   */
  static async calculateCleanerEarningsShare(cleanerId, multiCleanerJobId) {
    const { CleanerRoomAssignment } = require("../models");

    const assignments = await CleanerRoomAssignment.findAll({
      where: { multiCleanerJobId, cleanerId },
    });

    return assignments.reduce(
      (sum, a) => sum + (a.cleanerEarningsShare || 0),
      0
    );
  }
}

module.exports = RoomAssignmentService;
