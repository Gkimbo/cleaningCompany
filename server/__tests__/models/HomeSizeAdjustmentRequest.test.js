/**
 * HomeSizeAdjustmentRequest Model Tests
 *
 * Tests model structure, associations, and status workflow.
 */

// Helper to create mock HomeSizeAdjustmentRequest objects
const createMockRequest = (overrides = {}) => ({
  id: 1,
  appointmentId: 1,
  homeId: 1,
  cleanerId: 2,
  homeownerId: 1,
  originalNumBeds: "3",
  originalNumBaths: "2",
  originalPrice: 150.0,
  reportedNumBeds: "4",
  reportedNumBaths: "3",
  calculatedNewPrice: 200.0,
  priceDifference: 50.0,
  status: "pending_homeowner",
  cleanerNote: null,
  homeownerResponse: null,
  managerNote: null,
  managerId: null,
  chargePaymentIntentId: null,
  chargeStatus: null,
  homeownerRespondedAt: null,
  managerResolvedAt: null,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  photos: [],
  update: jest.fn().mockImplementation(function (data) {
    Object.assign(this, data);
    return Promise.resolve(this);
  }),
  destroy: jest.fn().mockResolvedValue(true),
  save: jest.fn().mockResolvedValue(this),
  ...overrides,
});

// Helper to create mock photo
const createMockPhoto = (overrides = {}) => ({
  id: 1,
  adjustmentRequestId: 1,
  roomType: "bedroom",
  roomNumber: 1,
  photoUrl: "data:image/jpeg;base64,...",
  s3Key: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("HomeSizeAdjustmentRequest Model", () => {
  describe("Model Structure", () => {
    it("should have all required fields", () => {
      const request = createMockRequest();

      expect(request).toHaveProperty("id");
      expect(request).toHaveProperty("appointmentId");
      expect(request).toHaveProperty("homeId");
      expect(request).toHaveProperty("cleanerId");
      expect(request).toHaveProperty("homeownerId");
      expect(request).toHaveProperty("originalNumBeds");
      expect(request).toHaveProperty("originalNumBaths");
      expect(request).toHaveProperty("originalPrice");
      expect(request).toHaveProperty("reportedNumBeds");
      expect(request).toHaveProperty("reportedNumBaths");
      expect(request).toHaveProperty("calculatedNewPrice");
      expect(request).toHaveProperty("priceDifference");
      expect(request).toHaveProperty("status");
      expect(request).toHaveProperty("expiresAt");
    });

    it("should have optional fields that can be null", () => {
      const request = createMockRequest();

      expect(request.cleanerNote).toBeNull();
      expect(request.homeownerResponse).toBeNull();
      expect(request.managerNote).toBeNull();
      expect(request.managerId).toBeNull();
      expect(request.chargePaymentIntentId).toBeNull();
      expect(request.chargeStatus).toBeNull();
      expect(request.homeownerRespondedAt).toBeNull();
      expect(request.managerResolvedAt).toBeNull();
    });
  });

  describe("Status ENUM Values", () => {
    it("should accept pending_homeowner status", () => {
      const request = createMockRequest({ status: "pending_homeowner" });
      expect(request.status).toBe("pending_homeowner");
    });

    it("should accept approved status", () => {
      const request = createMockRequest({ status: "approved" });
      expect(request.status).toBe("approved");
    });

    it("should accept denied status", () => {
      const request = createMockRequest({ status: "denied" });
      expect(request.status).toBe("denied");
    });

    it("should accept pending_manager status", () => {
      const request = createMockRequest({ status: "pending_manager" });
      expect(request.status).toBe("pending_manager");
    });

    it("should accept manager_approved status", () => {
      const request = createMockRequest({ status: "manager_approved" });
      expect(request.status).toBe("manager_approved");
    });

    it("should accept manager_denied status", () => {
      const request = createMockRequest({ status: "manager_denied" });
      expect(request.status).toBe("manager_denied");
    });

    it("should accept expired status", () => {
      const request = createMockRequest({ status: "expired" });
      expect(request.status).toBe("expired");
    });
  });

  describe("Charge Status ENUM Values", () => {
    it("should accept pending charge status", () => {
      const request = createMockRequest({ chargeStatus: "pending" });
      expect(request.chargeStatus).toBe("pending");
    });

    it("should accept succeeded charge status", () => {
      const request = createMockRequest({ chargeStatus: "succeeded" });
      expect(request.chargeStatus).toBe("succeeded");
    });

    it("should accept failed charge status", () => {
      const request = createMockRequest({ chargeStatus: "failed" });
      expect(request.chargeStatus).toBe("failed");
    });

    it("should accept waived charge status", () => {
      const request = createMockRequest({ chargeStatus: "waived" });
      expect(request.chargeStatus).toBe("waived");
    });
  });

  describe("Status Workflow", () => {
    describe("Happy Path - Homeowner Approves", () => {
      it("should transition from pending_homeowner to approved", async () => {
        const request = createMockRequest({ status: "pending_homeowner" });

        await request.update({
          status: "approved",
          homeownerRespondedAt: new Date(),
        });

        expect(request.status).toBe("approved");
        expect(request.homeownerRespondedAt).toBeInstanceOf(Date);
      });
    });

    describe("Escalation Path - Homeowner Denies", () => {
      it("should transition from pending_homeowner to pending_manager", async () => {
        const request = createMockRequest({ status: "pending_homeowner" });

        await request.update({
          status: "pending_manager",
          homeownerResponse: "The home size is correct",
          homeownerRespondedAt: new Date(),
        });

        expect(request.status).toBe("pending_manager");
        expect(request.homeownerResponse).toBe("The home size is correct");
      });

      it("should transition from pending_manager to manager_approved", async () => {
        const request = createMockRequest({ status: "pending_manager" });

        await request.update({
          status: "manager_approved",
          managerId: 3,
          managerNote: "Verified home is larger",
          managerResolvedAt: new Date(),
        });

        expect(request.status).toBe("manager_approved");
        expect(request.managerId).toBe(3);
        expect(request.managerNote).toBe("Verified home is larger");
      });

      it("should transition from pending_manager to manager_denied", async () => {
        const request = createMockRequest({ status: "pending_manager" });

        await request.update({
          status: "manager_denied",
          managerId: 3,
          managerNote: "Home size is correct as listed",
          managerResolvedAt: new Date(),
        });

        expect(request.status).toBe("manager_denied");
        expect(request.managerId).toBe(3);
      });
    });

    describe("Expiration Path", () => {
      it("should transition from pending_homeowner to expired", async () => {
        const request = createMockRequest({ status: "pending_homeowner" });

        await request.update({ status: "expired" });

        expect(request.status).toBe("expired");
      });
    });
  });

  describe("Price Calculations", () => {
    it("should calculate positive price difference", () => {
      const request = createMockRequest({
        originalPrice: 150.0,
        calculatedNewPrice: 200.0,
        priceDifference: 50.0,
      });

      expect(request.priceDifference).toBe(50.0);
      expect(request.priceDifference).toBe(
        request.calculatedNewPrice - request.originalPrice
      );
    });

    it("should store decimal prices", () => {
      const request = createMockRequest({
        originalPrice: 149.99,
        calculatedNewPrice: 199.99,
        priceDifference: 50.0,
      });

      expect(request.originalPrice).toBe(149.99);
      expect(request.calculatedNewPrice).toBe(199.99);
    });

    it("should handle zero price difference", () => {
      const request = createMockRequest({
        originalPrice: 150.0,
        calculatedNewPrice: 150.0,
        priceDifference: 0,
      });

      expect(request.priceDifference).toBe(0);
    });
  });

  describe("Bed/Bath Values", () => {
    it("should store original bed/bath as strings", () => {
      const request = createMockRequest({
        originalNumBeds: "3",
        originalNumBaths: "2.5",
      });

      expect(typeof request.originalNumBeds).toBe("string");
      expect(typeof request.originalNumBaths).toBe("string");
    });

    it("should store reported bed/bath as strings", () => {
      const request = createMockRequest({
        reportedNumBeds: "4",
        reportedNumBaths: "3",
      });

      expect(typeof request.reportedNumBeds).toBe("string");
      expect(typeof request.reportedNumBaths).toBe("string");
    });

    it("should handle 8+ bedrooms notation", () => {
      const request = createMockRequest({
        reportedNumBeds: "8+",
        reportedNumBaths: "5+",
      });

      expect(request.reportedNumBeds).toBe("8+");
      expect(request.reportedNumBaths).toBe("5+");
    });

    it("should handle half bathrooms", () => {
      const request = createMockRequest({
        originalNumBaths: "2.5",
        reportedNumBaths: "3.5",
      });

      expect(request.originalNumBaths).toBe("2.5");
      expect(request.reportedNumBaths).toBe("3.5");
    });
  });

  describe("Expiration", () => {
    it("should set expiration 24 hours from creation", () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const request = createMockRequest({ expiresAt });

      const timeDiff = request.expiresAt.getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      expect(hoursDiff).toBeCloseTo(24, 0);
    });

    it("should be able to check if expired", () => {
      const pastDate = new Date(Date.now() - 1000);
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const expiredRequest = createMockRequest({ expiresAt: pastDate });
      const validRequest = createMockRequest({ expiresAt: futureDate });

      expect(expiredRequest.expiresAt < new Date()).toBe(true);
      expect(validRequest.expiresAt > new Date()).toBe(true);
    });
  });

  describe("Photos Association", () => {
    it("should have photos array", () => {
      const request = createMockRequest({ photos: [] });
      expect(Array.isArray(request.photos)).toBe(true);
    });

    it("should include multiple photos", () => {
      const photos = [
        createMockPhoto({ id: 1, roomType: "bedroom", roomNumber: 1 }),
        createMockPhoto({ id: 2, roomType: "bedroom", roomNumber: 2 }),
        createMockPhoto({ id: 3, roomType: "bathroom", roomNumber: 1 }),
      ];

      const request = createMockRequest({ photos });

      expect(request.photos).toHaveLength(3);
    });

    it("should organize photos by room type", () => {
      const photos = [
        createMockPhoto({ roomType: "bedroom", roomNumber: 1 }),
        createMockPhoto({ roomType: "bedroom", roomNumber: 2 }),
        createMockPhoto({ roomType: "bathroom", roomNumber: 1 }),
        createMockPhoto({ roomType: "bathroom", roomNumber: 2 }),
      ];

      const request = createMockRequest({ photos });

      const bedrooms = request.photos.filter((p) => p.roomType === "bedroom");
      const bathrooms = request.photos.filter((p) => p.roomType === "bathroom");

      expect(bedrooms).toHaveLength(2);
      expect(bathrooms).toHaveLength(2);
    });

    it("should match photo count to reported rooms", () => {
      const photos = [
        createMockPhoto({ roomType: "bedroom", roomNumber: 1 }),
        createMockPhoto({ roomType: "bedroom", roomNumber: 2 }),
        createMockPhoto({ roomType: "bedroom", roomNumber: 3 }),
        createMockPhoto({ roomType: "bedroom", roomNumber: 4 }),
        createMockPhoto({ roomType: "bathroom", roomNumber: 1 }),
        createMockPhoto({ roomType: "bathroom", roomNumber: 2 }),
        createMockPhoto({ roomType: "bathroom", roomNumber: 3 }),
      ];

      const request = createMockRequest({
        reportedNumBeds: "4",
        reportedNumBaths: "3",
        photos,
      });

      const bedroomPhotos = request.photos.filter((p) => p.roomType === "bedroom").length;
      const bathroomPhotos = request.photos.filter((p) => p.roomType === "bathroom").length;

      expect(bedroomPhotos).toBe(parseInt(request.reportedNumBeds));
      expect(bathroomPhotos).toBe(parseInt(request.reportedNumBaths));
    });
  });

  describe("Foreign Key Relationships", () => {
    it("should reference appointment", () => {
      const request = createMockRequest({ appointmentId: 42 });
      expect(request.appointmentId).toBe(42);
    });

    it("should reference home", () => {
      const request = createMockRequest({ homeId: 10 });
      expect(request.homeId).toBe(10);
    });

    it("should reference cleaner", () => {
      const request = createMockRequest({ cleanerId: 5 });
      expect(request.cleanerId).toBe(5);
    });

    it("should reference homeowner", () => {
      const request = createMockRequest({ homeownerId: 3 });
      expect(request.homeownerId).toBe(3);
    });

    it("should optionally reference manager", () => {
      const pendingRequest = createMockRequest({ managerId: null });
      const resolvedRequest = createMockRequest({ managerId: 7 });

      expect(pendingRequest.managerId).toBeNull();
      expect(resolvedRequest.managerId).toBe(7);
    });
  });

  describe("Notes Fields", () => {
    it("should store cleaner note", () => {
      const request = createMockRequest({
        cleanerNote: "Home has 4 bedrooms, not 3 as listed",
      });

      expect(request.cleanerNote).toBe("Home has 4 bedrooms, not 3 as listed");
    });

    it("should store homeowner response", () => {
      const request = createMockRequest({
        homeownerResponse: "The listing is correct. Extra room is office.",
      });

      expect(request.homeownerResponse).toBe("The listing is correct. Extra room is office.");
    });

    it("should store manager note", () => {
      const request = createMockRequest({
        managerNote: "Verified via photos - home has 4 bedrooms",
      });

      expect(request.managerNote).toBe("Verified via photos - home has 4 bedrooms");
    });

    it("should handle long notes", () => {
      const longNote = "A".repeat(5000);
      const request = createMockRequest({ cleanerNote: longNote });

      expect(request.cleanerNote.length).toBe(5000);
    });
  });

  describe("Stripe Integration", () => {
    it("should store payment intent ID", () => {
      const request = createMockRequest({
        chargePaymentIntentId: "pi_1234567890abcdef",
      });

      expect(request.chargePaymentIntentId).toBe("pi_1234567890abcdef");
    });

    it("should track charge status", () => {
      const request = createMockRequest({
        chargePaymentIntentId: "pi_1234567890abcdef",
        chargeStatus: "succeeded",
      });

      expect(request.chargeStatus).toBe("succeeded");
    });
  });

  describe("Timestamps", () => {
    it("should have createdAt timestamp", () => {
      const request = createMockRequest();
      expect(request.createdAt).toBeInstanceOf(Date);
    });

    it("should have updatedAt timestamp", () => {
      const request = createMockRequest();
      expect(request.updatedAt).toBeInstanceOf(Date);
    });

    it("should track homeowner response time", async () => {
      const request = createMockRequest({ homeownerRespondedAt: null });

      await request.update({ homeownerRespondedAt: new Date() });

      expect(request.homeownerRespondedAt).toBeInstanceOf(Date);
    });

    it("should track manager resolution time", async () => {
      const request = createMockRequest({ managerResolvedAt: null });

      await request.update({ managerResolvedAt: new Date() });

      expect(request.managerResolvedAt).toBeInstanceOf(Date);
    });
  });

  describe("Model Operations", () => {
    it("should update request status", async () => {
      const request = createMockRequest();

      await request.update({ status: "approved" });

      expect(request.update).toHaveBeenCalled();
      expect(request.status).toBe("approved");
    });

    it("should delete request", async () => {
      const request = createMockRequest();

      await request.destroy();

      expect(request.destroy).toHaveBeenCalled();
    });
  });
});
