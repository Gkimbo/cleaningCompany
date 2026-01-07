/**
 * Tests for HomePreferredCleanerSerializer
 */

jest.mock("../../services/EncryptionService", () => ({
	decrypt: jest.fn((value) => {
		if (!value) return null;
		return value.replace("encrypted_", "");
	}),
}));

const HomePreferredCleanerSerializer = require("../../serializers/HomePreferredCleanerSerializer");

describe("HomePreferredCleanerSerializer", () => {
	describe("serializeOne", () => {
		it("should serialize a preferred cleaner record", () => {
			const record = {
				dataValues: {
					id: 1,
					homeId: 10,
					cleanerId: 100,
					preferenceLevel: "preferred",
					priority: 0,
					setAt: new Date("2026-01-01"),
					setBy: "review",
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			};

			const result = HomePreferredCleanerSerializer.serializeOne(record);

			expect(result.id).toBe(1);
			expect(result.homeId).toBe(10);
			expect(result.cleanerId).toBe(100);
			expect(result.preferenceLevel).toBe("preferred");
			expect(result.priority).toBe(0);
			expect(result.setBy).toBe("review");
		});

		it("should default preferenceLevel to preferred", () => {
			const record = {
				dataValues: {
					id: 1,
					homeId: 10,
					cleanerId: 100,
				},
			};

			const result = HomePreferredCleanerSerializer.serializeOne(record);

			expect(result.preferenceLevel).toBe("preferred");
		});

		it("should return null for null input", () => {
			expect(HomePreferredCleanerSerializer.serializeOne(null)).toBeNull();
		});

		it("should include cleaner info if available", () => {
			const record = {
				dataValues: {
					id: 1,
					homeId: 10,
					cleanerId: 100,
				},
				cleaner: {
					dataValues: {
						id: 100,
						firstName: "encrypted_John",
						lastName: "encrypted_Doe",
						email: "encrypted_john@test.com",
					},
				},
			};

			const result = HomePreferredCleanerSerializer.serializeOne(record);

			expect(result.cleaner).toBeDefined();
			expect(result.cleaner.firstName).toBe("John");
			expect(result.cleaner.lastName).toBe("Doe");
		});
	});

	describe("serializeForCleanerView", () => {
		it("should serialize for cleaner's preferred homes list", () => {
			const record = {
				dataValues: {
					homeId: 10,
					preferenceLevel: "preferred",
					priority: 0,
					setAt: new Date(),
					setBy: "review",
				},
				home: {
					dataValues: {
						id: 10,
						nickName: "Beach House",
						address: "encrypted_123 Main St",
						city: "encrypted_Boston",
						state: "encrypted_MA",
						numBeds: 3,
						numBaths: 2,
					},
				},
			};

			const result = HomePreferredCleanerSerializer.serializeForCleanerView(record);

			expect(result.homeId).toBe(10);
			expect(result.preferenceLevel).toBe("preferred");
			expect(result.home.nickName).toBe("Beach House");
			expect(result.home.address).toBe("123 Main St");
			expect(result.home.city).toBe("Boston");
		});
	});

	describe("serializeForHomeownerView", () => {
		it("should serialize for homeowner's preferred cleaners list", () => {
			const record = {
				dataValues: {
					id: 1,
					cleanerId: 100,
					preferenceLevel: "favorite",
					priority: 1,
					setAt: new Date(),
					setBy: "settings",
				},
				cleaner: {
					dataValues: {
						id: 100,
						firstName: "encrypted_Jane",
						lastName: "encrypted_Smith",
					},
				},
			};

			const stats = {
				totalBookings: 12,
				avgDurationMinutes: 95,
				avgReviewScore: 4.8,
			};

			const result = HomePreferredCleanerSerializer.serializeForHomeownerView(record, stats);

			expect(result.cleanerId).toBe(100);
			expect(result.preferenceLevel).toBe("favorite");
			expect(result.preferenceLevelDisplay).toBe("Favorite");
			expect(result.setByDisplay).toBe("Manual Selection");
			expect(result.stats.totalBookings).toBe(12);
			expect(result.stats.avgReviewScore).toBe(4.8);
		});
	});

	describe("getPreferenceLevelDisplay", () => {
		it("should return correct display names", () => {
			expect(HomePreferredCleanerSerializer.getPreferenceLevelDisplay("preferred")).toBe("Preferred");
			expect(HomePreferredCleanerSerializer.getPreferenceLevelDisplay("favorite")).toBe("Favorite");
			expect(HomePreferredCleanerSerializer.getPreferenceLevelDisplay("unknown")).toBe("Preferred");
		});
	});

	describe("getSetByDisplay", () => {
		it("should return correct display names", () => {
			expect(HomePreferredCleanerSerializer.getSetByDisplay("review")).toBe("After Review");
			expect(HomePreferredCleanerSerializer.getSetByDisplay("settings")).toBe("Manual Selection");
			expect(HomePreferredCleanerSerializer.getSetByDisplay("invitation")).toBe("Via Invitation");
		});
	});

	describe("serializeGroupedByLevel", () => {
		it("should group records by preference level", () => {
			const records = [
				{ dataValues: { id: 1, cleanerId: 100, preferenceLevel: "preferred", priority: 1 } },
				{ dataValues: { id: 2, cleanerId: 101, preferenceLevel: "favorite", priority: 0 } },
				{ dataValues: { id: 3, cleanerId: 102, preferenceLevel: "preferred", priority: 0 } },
			];

			const result = HomePreferredCleanerSerializer.serializeGroupedByLevel(records);

			expect(result.preferred).toHaveLength(2);
			expect(result.favorite).toHaveLength(1);
			expect(result.total).toBe(3);
			expect(result.preferredCount).toBe(2);
			expect(result.favoriteCount).toBe(1);
			// Verify sorting by priority
			expect(result.preferred[0].cleanerId).toBe(102); // priority 0
			expect(result.preferred[1].cleanerId).toBe(100); // priority 1
		});
	});

	describe("serializeSummary", () => {
		it("should return summary info for home", () => {
			const records = [
				{ dataValues: { cleanerId: 100, preferenceLevel: "preferred", priority: 1 } },
				{ dataValues: { cleanerId: 101, preferenceLevel: "preferred", priority: 0 } },
				{ dataValues: { cleanerId: 102, preferenceLevel: "favorite", priority: 0 } },
			];

			const result = HomePreferredCleanerSerializer.serializeSummary(records);

			expect(result.hasPreferredCleaners).toBe(true);
			expect(result.totalCount).toBe(3);
			expect(result.preferredCount).toBe(2);
			expect(result.favoriteCount).toBe(1);
			expect(result.primaryCleanerId).toBe(101); // lowest priority preferred
		});

		it("should return empty summary for no records", () => {
			const result = HomePreferredCleanerSerializer.serializeSummary([]);

			expect(result.hasPreferredCleaners).toBe(false);
			expect(result.totalCount).toBe(0);
			expect(result.primaryCleanerId).toBeNull();
		});
	});

	describe("serializeArray", () => {
		it("should serialize an array of records", () => {
			const records = [
				{ dataValues: { id: 1, homeId: 10, cleanerId: 100 } },
				{ dataValues: { id: 2, homeId: 10, cleanerId: 101 } },
			];

			const result = HomePreferredCleanerSerializer.serializeArray(records);

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe(1);
			expect(result[1].id).toBe(2);
		});
	});
});
