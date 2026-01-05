/**
 * Tests for CleanerPreferredPerksSerializer
 */

const CleanerPreferredPerksSerializer = require("../../serializers/CleanerPreferredPerksSerializer");

describe("CleanerPreferredPerksSerializer", () => {
	describe("serializeOne", () => {
		it("should serialize a perk record correctly", () => {
			const perks = {
				dataValues: {
					id: 1,
					cleanerId: 100,
					tierLevel: "gold",
					preferredHomeCount: 7,
					bonusPercent: "5.00",
					fasterPayouts: true,
					payoutHours: 24,
					earlyAccess: false,
					lastCalculatedAt: new Date("2026-01-05"),
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			};

			const result = CleanerPreferredPerksSerializer.serializeOne(perks);

			expect(result.id).toBe(1);
			expect(result.cleanerId).toBe(100);
			expect(result.tierLevel).toBe("gold");
			expect(result.preferredHomeCount).toBe(7);
			expect(result.bonusPercent).toBe(5);
			expect(result.fasterPayouts).toBe(true);
			expect(result.payoutHours).toBe(24);
			expect(result.earlyAccess).toBe(false);
		});

		it("should return null for null input", () => {
			expect(CleanerPreferredPerksSerializer.serializeOne(null)).toBeNull();
		});

		it("should handle bonusPercent as number or string", () => {
			const perks = {
				bonusPercent: 3,
				tierLevel: "silver",
			};

			const result = CleanerPreferredPerksSerializer.serializeOne(perks);
			expect(result.bonusPercent).toBe(3);
		});
	});

	describe("serializeForDashboard", () => {
		it("should serialize perk status for dashboard display", () => {
			const perkStatus = {
				cleanerId: 100,
				tier: "silver",
				preferredHomeCount: 4,
				bonusPercent: 3,
				fasterPayouts: false,
				payoutHours: 48,
				earlyAccess: false,
				nextTier: "gold",
				homesNeededForNextTier: 2,
				tierBenefits: ["3% bonus on preferred jobs"],
				lastCalculatedAt: new Date(),
			};

			const result = CleanerPreferredPerksSerializer.serializeForDashboard(perkStatus);

			expect(result.tier).toBe("silver");
			expect(result.tierDisplayName).toBe("Silver");
			expect(result.nextTier).toBe("gold");
			expect(result.nextTierDisplayName).toBe("Gold");
			expect(result.homesNeededForNextTier).toBe(2);
		});

		it("should return defaults for null input", () => {
			const result = CleanerPreferredPerksSerializer.serializeForDashboard(null);

			expect(result.tier).toBe("bronze");
			expect(result.bonusPercent).toBe(0);
			expect(result.nextTier).toBe("silver");
		});
	});

	describe("getTierDisplayName", () => {
		it("should return correct display names for all tiers", () => {
			expect(CleanerPreferredPerksSerializer.getTierDisplayName("bronze")).toBe("Bronze");
			expect(CleanerPreferredPerksSerializer.getTierDisplayName("silver")).toBe("Silver");
			expect(CleanerPreferredPerksSerializer.getTierDisplayName("gold")).toBe("Gold");
			expect(CleanerPreferredPerksSerializer.getTierDisplayName("platinum")).toBe("Platinum");
		});

		it("should return input for unknown tier", () => {
			expect(CleanerPreferredPerksSerializer.getTierDisplayName("unknown")).toBe("unknown");
		});
	});

	describe("serializeTierInfo", () => {
		it("should serialize tier info correctly", () => {
			const tierInfo = {
				tiers: [
					{ name: "bronze", minHomes: 1, maxHomes: 2, bonusPercent: 0, benefits: ["Build reputation"] },
					{ name: "silver", minHomes: 3, maxHomes: 5, bonusPercent: 3, benefits: ["3% bonus"] },
					{ name: "gold", minHomes: 6, maxHomes: 10, bonusPercent: 5, fasterPayouts: true, payoutHours: 24, benefits: ["5% bonus", "Faster payouts"] },
					{ name: "platinum", minHomes: 11, maxHomes: null, bonusPercent: 7, fasterPayouts: true, payoutHours: 24, earlyAccess: true, benefits: ["7% bonus", "Faster payouts", "Early access"] },
				],
			};

			const result = CleanerPreferredPerksSerializer.serializeTierInfo(tierInfo);

			expect(result.tiers).toHaveLength(4);
			expect(result.tiers[0].displayName).toBe("Bronze");
			expect(result.tiers[2].fasterPayouts).toBe(true);
			expect(result.tiers[3].earlyAccess).toBe(true);
		});

		it("should return empty tiers for null input", () => {
			const result = CleanerPreferredPerksSerializer.serializeTierInfo(null);
			expect(result.tiers).toEqual([]);
		});
	});

	describe("serializeBadge", () => {
		it("should serialize minimal badge info", () => {
			const perks = {
				dataValues: {
					tierLevel: "gold",
					bonusPercent: 5,
					preferredHomeCount: 8,
				},
			};

			const result = CleanerPreferredPerksSerializer.serializeBadge(perks);

			expect(result.tier).toBe("gold");
			expect(result.displayName).toBe("Gold");
			expect(result.bonusPercent).toBe(5);
			expect(result.preferredHomeCount).toBe(8);
		});

		it("should return bronze defaults for null input", () => {
			const result = CleanerPreferredPerksSerializer.serializeBadge(null);

			expect(result.tier).toBe("bronze");
			expect(result.displayName).toBe("Bronze");
			expect(result.bonusPercent).toBe(0);
		});
	});

	describe("serializeArray", () => {
		it("should serialize an array of perks", () => {
			const perksArray = [
				{ id: 1, cleanerId: 100, tierLevel: "silver" },
				{ id: 2, cleanerId: 101, tierLevel: "gold" },
			];

			const result = CleanerPreferredPerksSerializer.serializeArray(perksArray);

			expect(result).toHaveLength(2);
			expect(result[0].tierLevel).toBe("silver");
			expect(result[1].tierLevel).toBe("gold");
		});
	});
});
