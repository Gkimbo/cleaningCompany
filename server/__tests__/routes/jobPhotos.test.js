const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock models
jest.mock("../../models", () => ({
  JobPhoto: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    count: jest.fn(),
  },
  UserAppointments: {
    findByPk: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
}));

const { JobPhoto, UserAppointments, User } = require("../../models");

// Set up express app with the router
const jobPhotosRouter = require("../../routes/api/v1/jobPhotosRouter");
const app = express();
app.use(express.json());
app.use("/api/v1/job-photos", jobPhotosRouter);

describe("Job Photos Router", () => {
  const secretKey = process.env.SESSION_SECRET || "test_secret";
  const cleanerToken = jwt.sign({ userId: 2 }, secretKey);
  const homeownerToken = jwt.sign({ userId: 1 }, secretKey);
  const adminToken = jwt.sign({ userId: 3 }, secretKey);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /upload", () => {
    const validPhotoData = {
      appointmentId: 100,
      photoType: "before",
      photoData: "base64encodeddata",
      room: "Kitchen",
      notes: "Test note",
    };

    it("should upload a photo successfully", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        employeesAssigned: ["2"],
      });
      JobPhoto.create.mockResolvedValue({
        id: 1,
        ...validPhotoData,
        cleanerId: 2,
        takenAt: new Date(),
      });

      const response = await request(app)
        .post("/api/v1/job-photos/upload")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send(validPhotoData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.photo.id).toBe(1);
    });

    it("should return 401 without token", async () => {
      const response = await request(app)
        .post("/api/v1/job-photos/upload")
        .send(validPhotoData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Access token required");
    });

    it("should return 400 for missing required fields", async () => {
      const response = await request(app)
        .post("/api/v1/job-photos/upload")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ appointmentId: 100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("required");
    });

    it("should return 400 for invalid photoType", async () => {
      const response = await request(app)
        .post("/api/v1/job-photos/upload")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ ...validPhotoData, photoType: "invalid" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("before");
    });

    it("should return 404 for non-existent appointment", async () => {
      UserAppointments.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/job-photos/upload")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send(validPhotoData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Appointment not found");
    });

    it("should return 403 if cleaner not assigned", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        employeesAssigned: ["3", "4"],
      });

      const response = await request(app)
        .post("/api/v1/job-photos/upload")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send(validPhotoData);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("not assigned");
    });

    it("should return 400 if uploading after without before photos", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        employeesAssigned: ["2"],
      });
      JobPhoto.count.mockResolvedValue(0);

      const response = await request(app)
        .post("/api/v1/job-photos/upload")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ ...validPhotoData, photoType: "after" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("before photos first");
    });

    it("should allow after photos when before photos exist", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        employeesAssigned: ["2"],
      });
      JobPhoto.count.mockResolvedValue(2);
      JobPhoto.create.mockResolvedValue({
        id: 2,
        ...validPhotoData,
        photoType: "after",
        cleanerId: 2,
        takenAt: new Date(),
      });

      const response = await request(app)
        .post("/api/v1/job-photos/upload")
        .set("Authorization", `Bearer ${cleanerToken}`)
        .send({ ...validPhotoData, photoType: "after" });

      expect(response.status).toBe(201);
    });
  });

  describe("GET /:appointmentId", () => {
    it("should return photos for assigned cleaner", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        employeesAssigned: ["2"],
        userId: 1,
      });
      User.findByPk.mockResolvedValue({ id: 2, type: "cleaner" });
      JobPhoto.findAll.mockResolvedValue([
        { id: 1, photoType: "before", photoData: "data1" },
        { id: 2, photoType: "after", photoData: "data2" },
      ]);

      const response = await request(app)
        .get("/api/v1/job-photos/100")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.beforePhotos).toHaveLength(1);
      expect(response.body.afterPhotos).toHaveLength(1);
      expect(response.body.canComplete).toBe(true);
    });

    it("should return photos for homeowner", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        employeesAssigned: ["2"],
        userId: 1,
      });
      User.findByPk.mockResolvedValue({ id: 1, type: "homeowner" });
      JobPhoto.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/job-photos/100")
        .set("Authorization", `Bearer ${homeownerToken}`);

      expect(response.status).toBe(200);
    });

    it("should return photos for admin", async () => {
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        employeesAssigned: ["2"],
        userId: 1,
      });
      User.findByPk.mockResolvedValue({ id: 3, type: "admin" });
      JobPhoto.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/v1/job-photos/100")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it("should return 403 for unauthorized user", async () => {
      const otherToken = jwt.sign({ userId: 99 }, secretKey);
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        employeesAssigned: ["2"],
        userId: 1,
      });
      User.findByPk.mockResolvedValue({ id: 99, type: "cleaner" });

      const response = await request(app)
        .get("/api/v1/job-photos/100")
        .set("Authorization", `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("Not authorized");
    });

    it("should return 404 for non-existent appointment", async () => {
      UserAppointments.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/v1/job-photos/999")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /:appointmentId/status", () => {
    it("should return photo status counts", async () => {
      JobPhoto.count
        .mockResolvedValueOnce(3) // before count
        .mockResolvedValueOnce(2); // after count

      const response = await request(app)
        .get("/api/v1/job-photos/100/status")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.beforePhotosCount).toBe(3);
      expect(response.body.afterPhotosCount).toBe(2);
      expect(response.body.hasBeforePhotos).toBe(true);
      expect(response.body.hasAfterPhotos).toBe(true);
      expect(response.body.canComplete).toBe(true);
    });

    it("should show canComplete false without both photo types", async () => {
      JobPhoto.count
        .mockResolvedValueOnce(2) // before count
        .mockResolvedValueOnce(0); // after count

      const response = await request(app)
        .get("/api/v1/job-photos/100/status")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.canComplete).toBe(false);
    });
  });

  describe("DELETE /:photoId", () => {
    it("should delete own photo successfully", async () => {
      JobPhoto.findByPk.mockResolvedValue({
        id: 1,
        cleanerId: 2,
        appointmentId: 100,
        destroy: jest.fn(),
      });
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        completed: false,
      });

      const response = await request(app)
        .delete("/api/v1/job-photos/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 404 for non-existent photo", async () => {
      JobPhoto.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/v1/job-photos/999")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Photo not found");
    });

    it("should return 403 when deleting others photo", async () => {
      JobPhoto.findByPk.mockResolvedValue({
        id: 1,
        cleanerId: 3, // Different cleaner
        appointmentId: 100,
      });

      const response = await request(app)
        .delete("/api/v1/job-photos/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("only delete your own");
    });

    it("should return 400 when job is completed", async () => {
      JobPhoto.findByPk.mockResolvedValue({
        id: 1,
        cleanerId: 2,
        appointmentId: 100,
      });
      UserAppointments.findByPk.mockResolvedValue({
        id: 100,
        completed: true,
      });

      const response = await request(app)
        .delete("/api/v1/job-photos/1")
        .set("Authorization", `Bearer ${cleanerToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("completed jobs");
    });
  });

  describe("Authentication", () => {
    it("should return 403 for invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/job-photos/100")
        .set("Authorization", "Bearer invalid_token");

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Invalid token");
    });
  });
});
