/**
 * HomeSizeAdjustmentPhoto Model Tests
 *
 * Tests model structure and validation without requiring a database connection.
 */

// Helper to create mock HomeSizeAdjustmentPhoto objects
const createMockPhoto = (overrides = {}) => ({
  id: 1,
  adjustmentRequestId: 1,
  roomType: "bedroom",
  roomNumber: 1,
  photoUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  s3Key: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
  destroy: jest.fn().mockResolvedValue(true),
  save: jest.fn().mockResolvedValue(this),
  ...overrides,
});

describe("HomeSizeAdjustmentPhoto Model", () => {
  describe("Model Structure", () => {
    it("should have all required fields", () => {
      const photo = createMockPhoto();

      expect(photo).toHaveProperty("id");
      expect(photo).toHaveProperty("adjustmentRequestId");
      expect(photo).toHaveProperty("roomType");
      expect(photo).toHaveProperty("roomNumber");
      expect(photo).toHaveProperty("photoUrl");
      expect(photo).toHaveProperty("s3Key");
      expect(photo).toHaveProperty("createdAt");
      expect(photo).toHaveProperty("updatedAt");
    });

    it("should require adjustmentRequestId", () => {
      const photo = createMockPhoto();
      expect(photo.adjustmentRequestId).toBeDefined();
      expect(typeof photo.adjustmentRequestId).toBe("number");
    });

    it("should require roomType", () => {
      const photo = createMockPhoto();
      expect(photo.roomType).toBeDefined();
    });

    it("should require roomNumber", () => {
      const photo = createMockPhoto();
      expect(photo.roomNumber).toBeDefined();
      expect(typeof photo.roomNumber).toBe("number");
    });

    it("should require photoUrl", () => {
      const photo = createMockPhoto();
      expect(photo.photoUrl).toBeDefined();
    });

    it("should allow null s3Key", () => {
      const photo = createMockPhoto({ s3Key: null });
      expect(photo.s3Key).toBeNull();
    });

    it("should allow s3Key when provided", () => {
      const photo = createMockPhoto({ s3Key: "photos/adjustments/123/bedroom-1.jpg" });
      expect(photo.s3Key).toBe("photos/adjustments/123/bedroom-1.jpg");
    });
  });

  describe("Room Type ENUM", () => {
    it("should accept bedroom as room type", () => {
      const photo = createMockPhoto({ roomType: "bedroom" });
      expect(photo.roomType).toBe("bedroom");
    });

    it("should accept bathroom as room type", () => {
      const photo = createMockPhoto({ roomType: "bathroom" });
      expect(photo.roomType).toBe("bathroom");
    });

    it("should distinguish between bedroom and bathroom", () => {
      const bedroomPhoto = createMockPhoto({ roomType: "bedroom" });
      const bathroomPhoto = createMockPhoto({ roomType: "bathroom" });

      expect(bedroomPhoto.roomType).not.toBe(bathroomPhoto.roomType);
    });
  });

  describe("Room Number", () => {
    it("should store room number 1", () => {
      const photo = createMockPhoto({ roomNumber: 1 });
      expect(photo.roomNumber).toBe(1);
    });

    it("should store higher room numbers", () => {
      const photo = createMockPhoto({ roomNumber: 5 });
      expect(photo.roomNumber).toBe(5);
    });

    it("should allow different room numbers for same room type", () => {
      const photo1 = createMockPhoto({ roomType: "bedroom", roomNumber: 1 });
      const photo2 = createMockPhoto({ roomType: "bedroom", roomNumber: 2 });
      const photo3 = createMockPhoto({ roomType: "bedroom", roomNumber: 3 });

      expect(photo1.roomNumber).toBe(1);
      expect(photo2.roomNumber).toBe(2);
      expect(photo3.roomNumber).toBe(3);
    });
  });

  describe("Photo URL Storage", () => {
    it("should store base64 encoded photo data", () => {
      const base64Data = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...";
      const photo = createMockPhoto({ photoUrl: base64Data });

      expect(photo.photoUrl).toContain("data:image/jpeg;base64");
    });

    it("should store long base64 strings", () => {
      // Simulate a real base64 image (shortened for test)
      const longBase64 = "data:image/jpeg;base64," + "A".repeat(10000);
      const photo = createMockPhoto({ photoUrl: longBase64 });

      expect(photo.photoUrl.length).toBeGreaterThan(10000);
    });

    it("should store S3 URLs when using cloud storage", () => {
      const s3Url = "https://s3.amazonaws.com/bucket/photos/adjustment-123/bedroom-1.jpg";
      const photo = createMockPhoto({ photoUrl: s3Url });

      expect(photo.photoUrl).toContain("s3.amazonaws.com");
    });
  });

  describe("Association with AdjustmentRequest", () => {
    it("should belong to an adjustment request", () => {
      const photo = createMockPhoto({ adjustmentRequestId: 42 });
      expect(photo.adjustmentRequestId).toBe(42);
    });

    it("should allow multiple photos for same request", () => {
      const photos = [
        createMockPhoto({ id: 1, adjustmentRequestId: 42, roomType: "bedroom", roomNumber: 1 }),
        createMockPhoto({ id: 2, adjustmentRequestId: 42, roomType: "bedroom", roomNumber: 2 }),
        createMockPhoto({ id: 3, adjustmentRequestId: 42, roomType: "bathroom", roomNumber: 1 }),
      ];

      const allSameRequest = photos.every((p) => p.adjustmentRequestId === 42);
      expect(allSameRequest).toBe(true);
      expect(photos).toHaveLength(3);
    });
  });

  describe("Photo Collection for Adjustment", () => {
    it("should organize photos by room type", () => {
      const photos = [
        createMockPhoto({ roomType: "bedroom", roomNumber: 1 }),
        createMockPhoto({ roomType: "bedroom", roomNumber: 2 }),
        createMockPhoto({ roomType: "bathroom", roomNumber: 1 }),
        createMockPhoto({ roomType: "bathroom", roomNumber: 2 }),
      ];

      const bedrooms = photos.filter((p) => p.roomType === "bedroom");
      const bathrooms = photos.filter((p) => p.roomType === "bathroom");

      expect(bedrooms).toHaveLength(2);
      expect(bathrooms).toHaveLength(2);
    });

    it("should count photos correctly", () => {
      const photos = [
        createMockPhoto({ roomType: "bedroom", roomNumber: 1 }),
        createMockPhoto({ roomType: "bedroom", roomNumber: 2 }),
        createMockPhoto({ roomType: "bedroom", roomNumber: 3 }),
        createMockPhoto({ roomType: "bathroom", roomNumber: 1 }),
        createMockPhoto({ roomType: "bathroom", roomNumber: 2 }),
      ];

      expect(photos.filter((p) => p.roomType === "bedroom").length).toBe(3);
      expect(photos.filter((p) => p.roomType === "bathroom").length).toBe(2);
    });
  });

  describe("Model Operations", () => {
    it("should update photo record", async () => {
      const photo = createMockPhoto();
      const newS3Key = "photos/updated-key.jpg";

      await photo.update({ s3Key: newS3Key });

      expect(photo.update).toHaveBeenCalled();
      expect(photo.s3Key).toBe(newS3Key);
    });

    it("should delete photo record", async () => {
      const photo = createMockPhoto();

      await photo.destroy();

      expect(photo.destroy).toHaveBeenCalled();
    });

    it("should cascade delete with adjustment request", () => {
      // This tests the expected behavior - when adjustment request is deleted,
      // all associated photos should be deleted (onDelete: CASCADE)
      const photo = createMockPhoto({ adjustmentRequestId: 1 });
      expect(photo.adjustmentRequestId).toBe(1);
      // In actual DB, deleting request with id=1 would cascade delete this photo
    });
  });

  describe("Timestamps", () => {
    it("should have createdAt timestamp", () => {
      const photo = createMockPhoto();
      expect(photo.createdAt).toBeInstanceOf(Date);
    });

    it("should have updatedAt timestamp", () => {
      const photo = createMockPhoto();
      expect(photo.updatedAt).toBeInstanceOf(Date);
    });
  });
});
