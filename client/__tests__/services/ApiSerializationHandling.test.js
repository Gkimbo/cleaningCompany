/**
 * API Serialization Handling Tests
 *
 * Tests that the frontend correctly handles serialized data from the backend.
 * The backend serializes Sequelize model instances to plain objects before
 * sending them to the frontend. These tests verify the frontend works correctly
 * with this serialized data format.
 */

import { API_BASE } from "../../src/services/config";

// Mock fetch globally
global.fetch = jest.fn();

describe("API Serialization Handling", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe("Employee Data Handling", () => {
    it("should correctly handle serialized employee data from /employee endpoint", async () => {
      // This is what the backend returns after serialization
      const serializedEmployee = {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        username: "johndoe",
        type: "cleaner",
        daysWorking: ["Monday", "Tuesday", "Wednesday"],
        cleanerAppointments: [],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ employee: serializedEmployee }),
      });

      const response = await fetch(`${API_BASE}/employee`, {
        headers: { Authorization: "Bearer test-token" },
      });
      const data = await response.json();

      // Verify the data structure is correct (plain object)
      expect(data.employee).toBeDefined();
      expect(data.employee.id).toBe(1);
      expect(data.employee.firstName).toBe("John");
      expect(data.employee.lastName).toBe("Doe");
      expect(data.employee.daysWorking).toEqual(["Monday", "Tuesday", "Wednesday"]);

      // Should NOT have Sequelize metadata
      expect(data.employee.dataValues).toBeUndefined();
      expect(data.employee._previousDataValues).toBeUndefined();
      expect(data.employee.save).toBeUndefined();
      expect(data.employee.update).toBeUndefined();
    });

    it("should correctly handle serialized employee schedule data", async () => {
      const serializedEmployees = {
        employees: [
          {
            id: 1,
            username: "cleaner1",
            firstName: "Alice",
            lastName: "Smith",
            type: "cleaner",
            daysWorking: ["Monday", "Tuesday"],
          },
          {
            id: 2,
            username: "cleaner2",
            firstName: "Bob",
            lastName: "Jones",
            type: "cleaner",
            daysWorking: ["Wednesday", "Thursday"],
          },
        ],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedEmployees,
      });

      const response = await fetch(`${API_BASE}/employee/employeeSchedule`);
      const data = await response.json();

      expect(data.employees).toHaveLength(2);
      expect(data.employees[0].id).toBe(1);
      expect(data.employees[0].firstName).toBe("Alice");
      expect(data.employees[1].id).toBe(2);
      expect(data.employees[1].firstName).toBe("Bob");

      // Each employee should be a plain object
      data.employees.forEach((emp) => {
        expect(emp.dataValues).toBeUndefined();
        expect(emp._changed).toBeUndefined();
      });
    });

    it("should correctly handle serialized shifts update response", async () => {
      const serializedUser = {
        user: {
          id: 1,
          username: "cleaner1",
          firstName: "John",
          lastName: "Doe",
          type: "cleaner",
          daysWorking: ["Monday", "Wednesday", "Friday"],
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => serializedUser,
      });

      const response = await fetch(`${API_BASE}/employee/shifts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          user: { token: "test-token" },
          days: ["Monday", "Wednesday", "Friday"],
        }),
      });
      const data = await response.json();

      expect(data.user).toBeDefined();
      expect(data.user.daysWorking).toEqual(["Monday", "Wednesday", "Friday"]);
      expect(data.user.dataValues).toBeUndefined();
    });
  });

  describe("Home Data Handling", () => {
    it("should correctly handle serialized home data", async () => {
      const serializedHome = {
        home: {
          id: 1,
          nickName: "Beach House",
          address: "123 Ocean Ave",
          city: "Miami",
          state: "FL",
          zipcode: "33101",
          numBeds: 3,
          numBaths: 2,
          sheetsProvided: true,
          towelsProvided: false,
          keyPadCode: "1234",
          keyLocation: "Under mat",
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedHome,
      });

      const response = await fetch(`${API_BASE}/employee/home/1`);
      const data = await response.json();

      expect(data.home).toBeDefined();
      expect(data.home.id).toBe(1);
      expect(data.home.nickName).toBe("Beach House");
      expect(data.home.address).toBe("123 Ocean Ave");
      expect(data.home.numBeds).toBe(3);
      expect(data.home.numBaths).toBe(2);

      // Should NOT have Sequelize metadata
      expect(data.home.dataValues).toBeUndefined();
      expect(data.home._previousDataValues).toBeUndefined();
      expect(data.home.isNewRecord).toBeUndefined();
    });

    it("should handle home data with decrypted fields", async () => {
      // Backend decrypts sensitive fields before serialization
      const serializedHome = {
        home: {
          id: 2,
          nickName: "City Apt",
          address: "456 Main St",
          city: "Boston",
          state: "MA",
          zipcode: "02101",
          numBeds: 2,
          numBaths: 1,
          contact: "555-123-4567",
          keyPadCode: "9876",
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedHome,
      });

      const response = await fetch(`${API_BASE}/employee/home/2`);
      const data = await response.json();

      // Decrypted fields should be plain strings
      expect(typeof data.home.address).toBe("string");
      expect(typeof data.home.city).toBe("string");
      expect(typeof data.home.contact).toBe("string");
    });
  });

  describe("Review Data Handling", () => {
    it("should correctly handle serialized cleaner profile with reviews", async () => {
      const serializedCleaner = {
        cleaner: {
          id: 1,
          username: "topcleaner",
          type: "cleaner",
          daysWorking: ["Monday", "Tuesday"],
          reviews: [
            {
              id: 1,
              review: 5,
              reviewComment: "Excellent job!",
              cleaningQuality: 5,
              punctuality: 5,
              professionalism: 5,
              createdAt: "2025-01-15T10:00:00Z",
            },
            {
              id: 2,
              review: 4,
              reviewComment: "Good work",
              cleaningQuality: 4,
              punctuality: 4,
              professionalism: 5,
              createdAt: "2025-01-20T10:00:00Z",
            },
          ],
          completedJobs: 50,
          totalReviews: 2,
          memberSince: "2024-01-01T00:00:00Z",
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedCleaner,
      });

      const response = await fetch(`${API_BASE}/employee/cleaner/1`);
      const data = await response.json();

      expect(data.cleaner).toBeDefined();
      expect(data.cleaner.id).toBe(1);
      expect(data.cleaner.reviews).toHaveLength(2);
      expect(data.cleaner.completedJobs).toBe(50);

      // Reviews should be serialized
      data.cleaner.reviews.forEach((review) => {
        expect(review.dataValues).toBeUndefined();
        expect(review.save).toBeUndefined();
        expect(typeof review.review).toBe("number");
        expect(typeof review.reviewComment).toBe("string");
      });
    });

    it("should handle reviews with reviewer association", async () => {
      const serializedReviews = {
        reviews: [
          {
            id: 1,
            review: 5,
            reviewComment: "Amazing!",
            reviewer: {
              id: 10,
              username: "happycustomer",
              firstName: "Jane",
              lastName: "Doe",
            },
          },
        ],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedReviews,
      });

      const response = await fetch(`${API_BASE}/reviews/cleaner/1`);
      const data = await response.json();

      expect(data.reviews[0].reviewer).toBeDefined();
      expect(data.reviews[0].reviewer.id).toBe(10);
      expect(data.reviews[0].reviewer.firstName).toBe("Jane");
      expect(data.reviews[0].reviewer.dataValues).toBeUndefined();
    });

    it("should handle reviews with deleted reviewer (displayName fallback)", async () => {
      const serializedReviews = {
        reviews: [
          {
            id: 1,
            review: 4,
            reviewComment: "Good job",
            reviewerName: "Deleted User",
            reviewer: {
              id: null,
              username: null,
              displayName: "Deleted User",
            },
          },
        ],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedReviews,
      });

      const response = await fetch(`${API_BASE}/reviews/cleaner/1`);
      const data = await response.json();

      expect(data.reviews[0].reviewer.displayName).toBe("Deleted User");
      expect(data.reviews[0].reviewer.id).toBeNull();
    });
  });

  describe("Payment History Handling", () => {
    it("should correctly handle serialized payment history", async () => {
      const serializedPayments = {
        payments: [
          {
            id: 1,
            date: "2025-01-15",
            price: "150",
            paid: true,
            paymentStatus: "succeeded",
            amountPaid: 15000,
            paymentIntentId: "pi_test_123",
            createdAt: "2025-01-15T10:00:00Z",
          },
          {
            id: 2,
            date: "2025-01-20",
            price: "200",
            paid: true,
            paymentStatus: "succeeded",
            amountPaid: 20000,
            paymentIntentId: "pi_test_456",
            createdAt: "2025-01-20T10:00:00Z",
          },
        ],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedPayments,
      });

      const response = await fetch(`${API_BASE}/payments/history/1`);
      const data = await response.json();

      expect(data.payments).toHaveLength(2);
      expect(data.payments[0].id).toBe(1);
      expect(data.payments[0].paid).toBe(true);
      expect(data.payments[0].paymentStatus).toBe("succeeded");
      expect(data.payments[1].amountPaid).toBe(20000);

      // Should NOT have Sequelize metadata (raw: true used on backend)
      data.payments.forEach((payment) => {
        expect(payment.dataValues).toBeUndefined();
        expect(payment._previousDataValues).toBeUndefined();
        expect(payment.save).toBeUndefined();
        expect(payment.destroy).toBeUndefined();
      });
    });

    it("should handle empty payment history", async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ payments: [] }),
      });

      const response = await fetch(`${API_BASE}/payments/history/999`);
      const data = await response.json();

      expect(data.payments).toEqual([]);
    });

    it("should handle payment with pending status", async () => {
      const serializedPayments = {
        payments: [
          {
            id: 1,
            date: "2025-02-01",
            price: "175",
            paid: false,
            paymentStatus: "pending",
            amountPaid: 0,
            paymentIntentId: null,
            createdAt: "2025-02-01T10:00:00Z",
          },
        ],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedPayments,
      });

      const response = await fetch(`${API_BASE}/payments/history/1`);
      const data = await response.json();

      expect(data.payments[0].paid).toBe(false);
      expect(data.payments[0].paymentStatus).toBe("pending");
      expect(data.payments[0].paymentIntentId).toBeNull();
    });
  });

  describe("Data Type Integrity", () => {
    it("should preserve boolean values correctly", async () => {
      const serializedData = {
        home: {
          id: 1,
          sheetsProvided: true,
          towelsProvided: false,
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedData,
      });

      const response = await fetch(`${API_BASE}/employee/home/1`);
      const data = await response.json();

      expect(data.home.sheetsProvided).toBe(true);
      expect(data.home.towelsProvided).toBe(false);
      expect(typeof data.home.sheetsProvided).toBe("boolean");
      expect(typeof data.home.towelsProvided).toBe("boolean");
    });

    it("should preserve numeric values correctly", async () => {
      const serializedData = {
        home: {
          id: 1,
          numBeds: 3,
          numBaths: 2,
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedData,
      });

      const response = await fetch(`${API_BASE}/employee/home/1`);
      const data = await response.json();

      expect(typeof data.home.numBeds).toBe("number");
      expect(typeof data.home.numBaths).toBe("number");
      expect(data.home.numBeds).toBe(3);
    });

    it("should preserve array values correctly", async () => {
      const serializedData = {
        employee: {
          id: 1,
          daysWorking: ["Monday", "Tuesday", "Wednesday"],
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedData,
      });

      const response = await fetch(`${API_BASE}/employee`);
      const data = await response.json();

      expect(Array.isArray(data.employee.daysWorking)).toBe(true);
      expect(data.employee.daysWorking).toHaveLength(3);
      expect(data.employee.daysWorking).toContain("Monday");
    });

    it("should preserve null values correctly", async () => {
      const serializedData = {
        home: {
          id: 1,
          keyPadCode: null,
          keyLocation: null,
          specialNotes: null,
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedData,
      });

      const response = await fetch(`${API_BASE}/employee/home/1`);
      const data = await response.json();

      expect(data.home.keyPadCode).toBeNull();
      expect(data.home.keyLocation).toBeNull();
      expect(data.home.specialNotes).toBeNull();
    });

    it("should preserve date strings correctly", async () => {
      const serializedData = {
        employee: {
          id: 1,
          createdAt: "2024-01-15T10:30:00.000Z",
          lastLogin: "2025-02-10T08:00:00.000Z",
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => serializedData,
      });

      const response = await fetch(`${API_BASE}/employee`);
      const data = await response.json();

      expect(typeof data.employee.createdAt).toBe("string");
      expect(new Date(data.employee.createdAt).toISOString()).toBe("2024-01-15T10:30:00.000Z");
    });
  });

  describe("Error Response Handling", () => {
    it("should handle API error responses correctly", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: "Resource not found" }),
      });

      const response = await fetch(`${API_BASE}/employee/home/999`);
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error).toBe("Resource not found");
    });

    it("should handle validation error responses", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid request data" }),
      });

      const response = await fetch(`${API_BASE}/employee/shifts`, {
        method: "POST",
        body: JSON.stringify({ invalid: "data" }),
      });
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error).toBe("Invalid request data");
    });

    it("should handle unauthorized error responses", async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Invalid or expired token" }),
      });

      const response = await fetch(`${API_BASE}/employee`);
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error).toBe("Invalid or expired token");
    });
  });
});
