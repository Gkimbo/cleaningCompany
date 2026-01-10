/**
 * Tests for DemoAccountService (Frontend)
 * Tests the client-side API service for the owner's "Preview as Role" feature.
 */

// Mock fetch globally
global.fetch = jest.fn();

// Mock config
jest.mock("../../src/services/config", () => ({
	API_BASE: "http://test-api.example.com/api/v1",
}));

import DemoAccountService from "../../src/services/fetchRequests/DemoAccountService";

describe("DemoAccountService", () => {
	const mockToken = "test_owner_token";

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getDemoAccounts", () => {
		it("should return demo accounts on success", async () => {
			const mockResponse = {
				success: true,
				demoAccounts: [
					{ id: 1, username: "demo_cleaner", role: "cleaner" },
					{ id: 2, username: "demo_homeowner", role: "homeowner" },
				],
				availableRoles: [
					{ role: "cleaner", label: "Cleaner" },
					{ role: "homeowner", label: "Homeowner" },
				],
			};

			global.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await DemoAccountService.getDemoAccounts(mockToken);

			expect(global.fetch).toHaveBeenCalledWith(
				"http://test-api.example.com/api/v1/demo-accounts",
				{
					headers: {
						Authorization: `Bearer ${mockToken}`,
					},
				}
			);

			expect(result.success).toBe(true);
			expect(result.demoAccounts).toHaveLength(2);
			expect(result.availableRoles).toHaveLength(2);
		});

		it("should return error on failed response", async () => {
			global.fetch.mockResolvedValue({
				ok: false,
				json: () => Promise.resolve({ error: "Unauthorized" }),
			});

			const result = await DemoAccountService.getDemoAccounts(mockToken);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Unauthorized");
		});

		it("should return default error message when no error provided", async () => {
			global.fetch.mockResolvedValue({
				ok: false,
				json: () => Promise.resolve({}),
			});

			const result = await DemoAccountService.getDemoAccounts(mockToken);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Failed to fetch demo accounts");
		});

		it("should handle network errors", async () => {
			global.fetch.mockRejectedValue(new Error("Network error"));

			const result = await DemoAccountService.getDemoAccounts(mockToken);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Network error. Please check your connection.");
		});
	});

	describe("getAvailableRoles", () => {
		it("should return available roles on success", async () => {
			const mockResponse = {
				success: true,
				roles: [
					{ role: "cleaner", label: "Cleaner", description: "See jobs" },
					{ role: "homeowner", label: "Homeowner", description: "See homes" },
					{ role: "businessOwner", label: "Business Owner", description: "See employees" },
					{ role: "employee", label: "Employee", description: "See schedule" },
				],
			};

			global.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await DemoAccountService.getAvailableRoles(mockToken);

			expect(global.fetch).toHaveBeenCalledWith(
				"http://test-api.example.com/api/v1/demo-accounts/roles",
				{
					headers: {
						Authorization: `Bearer ${mockToken}`,
					},
				}
			);

			expect(result.success).toBe(true);
			expect(result.roles).toHaveLength(4);
		});

		it("should return error on failed response", async () => {
			global.fetch.mockResolvedValue({
				ok: false,
				json: () => Promise.resolve({ error: "Unauthorized" }),
			});

			const result = await DemoAccountService.getAvailableRoles(mockToken);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Unauthorized");
		});

		it("should handle network errors", async () => {
			global.fetch.mockRejectedValue(new Error("Network error"));

			const result = await DemoAccountService.getAvailableRoles(mockToken);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Network error. Please check your connection.");
		});
	});

	describe("enterPreviewMode", () => {
		it("should enter preview mode as cleaner", async () => {
			const mockResponse = {
				success: true,
				token: "demo_token",
				user: { id: 1, username: "demo_cleaner" },
				previewRole: "cleaner",
				originalOwnerId: 100,
			};

			global.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await DemoAccountService.enterPreviewMode(mockToken, "cleaner");

			expect(global.fetch).toHaveBeenCalledWith(
				"http://test-api.example.com/api/v1/demo-accounts/enter/cleaner",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${mockToken}`,
						"Content-Type": "application/json",
					},
				}
			);

			expect(result.success).toBe(true);
			expect(result.token).toBe("demo_token");
			expect(result.previewRole).toBe("cleaner");
		});

		it("should enter preview mode as homeowner", async () => {
			const mockResponse = {
				success: true,
				token: "demo_token",
				user: { id: 2, username: "demo_homeowner" },
				previewRole: "homeowner",
				originalOwnerId: 100,
			};

			global.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await DemoAccountService.enterPreviewMode(mockToken, "homeowner");

			expect(result.success).toBe(true);
			expect(result.previewRole).toBe("homeowner");
		});

		it("should enter preview mode as businessOwner", async () => {
			const mockResponse = {
				success: true,
				token: "demo_token",
				user: { id: 3, username: "demo_business_owner" },
				previewRole: "businessOwner",
				originalOwnerId: 100,
			};

			global.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await DemoAccountService.enterPreviewMode(mockToken, "businessOwner");

			expect(result.success).toBe(true);
			expect(result.previewRole).toBe("businessOwner");
		});

		it("should enter preview mode as employee", async () => {
			const mockResponse = {
				success: true,
				token: "demo_token",
				user: { id: 4, username: "demo_employee" },
				previewRole: "employee",
				originalOwnerId: 100,
			};

			global.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await DemoAccountService.enterPreviewMode(mockToken, "employee");

			expect(result.success).toBe(true);
			expect(result.previewRole).toBe("employee");
		});

		it("should return error for invalid role", async () => {
			global.fetch.mockResolvedValue({
				ok: false,
				json: () => Promise.resolve({ error: "Invalid role: invalid" }),
			});

			const result = await DemoAccountService.enterPreviewMode(mockToken, "invalid");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Invalid role: invalid");
		});

		it("should return error when demo account not found", async () => {
			global.fetch.mockResolvedValue({
				ok: false,
				json: () => Promise.resolve({ error: "Demo account not found" }),
			});

			const result = await DemoAccountService.enterPreviewMode(mockToken, "cleaner");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Demo account not found");
		});

		it("should handle network errors", async () => {
			global.fetch.mockRejectedValue(new Error("Network error"));

			const result = await DemoAccountService.enterPreviewMode(mockToken, "cleaner");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Network error. Please check your connection.");
		});
	});

	describe("exitPreviewMode", () => {
		const ownerId = 100;

		it("should exit preview mode successfully", async () => {
			const mockResponse = {
				success: true,
				token: "owner_token",
				user: { id: 100, username: "platform_owner", type: "owner" },
			};

			global.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await DemoAccountService.exitPreviewMode(mockToken, ownerId);

			expect(global.fetch).toHaveBeenCalledWith(
				"http://test-api.example.com/api/v1/demo-accounts/exit",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${mockToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ ownerId }),
				}
			);

			expect(result.success).toBe(true);
			expect(result.token).toBe("owner_token");
			expect(result.user.type).toBe("owner");
		});

		it("should return error for invalid owner ID", async () => {
			global.fetch.mockResolvedValue({
				ok: false,
				json: () => Promise.resolve({ error: "Invalid owner ID" }),
			});

			const result = await DemoAccountService.exitPreviewMode(mockToken, 999);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Invalid owner ID");
		});

		it("should handle network errors", async () => {
			global.fetch.mockRejectedValue(new Error("Network error"));

			const result = await DemoAccountService.exitPreviewMode(mockToken, ownerId);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Network error. Please check your connection.");
		});
	});

	describe("checkDemoAccount", () => {
		it("should return exists true when demo account exists", async () => {
			const mockResponse = {
				exists: true,
				role: "cleaner",
				account: { id: 1, username: "demo_cleaner" },
			};

			global.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await DemoAccountService.checkDemoAccount(mockToken, "cleaner");

			expect(global.fetch).toHaveBeenCalledWith(
				"http://test-api.example.com/api/v1/demo-accounts/check/cleaner",
				{
					headers: {
						Authorization: `Bearer ${mockToken}`,
					},
				}
			);

			expect(result.exists).toBe(true);
			expect(result.role).toBe("cleaner");
			expect(result.account).toBeDefined();
		});

		it("should return exists false when demo account does not exist", async () => {
			const mockResponse = {
				exists: false,
				role: "cleaner",
				account: null,
			};

			global.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await DemoAccountService.checkDemoAccount(mockToken, "cleaner");

			expect(result.exists).toBe(false);
			expect(result.account).toBeNull();
		});

		it("should check all role types", async () => {
			const roles = ["cleaner", "homeowner", "businessOwner", "employee"];

			for (const role of roles) {
				global.fetch.mockResolvedValue({
					ok: true,
					json: () => Promise.resolve({ exists: true, role, account: {} }),
				});

				const result = await DemoAccountService.checkDemoAccount(mockToken, role);

				expect(global.fetch).toHaveBeenCalledWith(
					`http://test-api.example.com/api/v1/demo-accounts/check/${role}`,
					expect.any(Object)
				);

				expect(result.exists).toBe(true);
				expect(result.role).toBe(role);
			}
		});

		it("should return error on failed response", async () => {
			global.fetch.mockResolvedValue({
				ok: false,
				json: () => Promise.resolve({ error: "Invalid role" }),
			});

			const result = await DemoAccountService.checkDemoAccount(mockToken, "invalid");

			expect(result.exists).toBe(false);
			expect(result.error).toBe("Invalid role");
		});

		it("should handle network errors", async () => {
			global.fetch.mockRejectedValue(new Error("Network error"));

			const result = await DemoAccountService.checkDemoAccount(mockToken, "cleaner");

			expect(result.exists).toBe(false);
			expect(result.error).toBe("Network error. Please check your connection.");
		});
	});
});
