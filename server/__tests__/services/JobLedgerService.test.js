/**
 * Tests for the JobLedgerService
 * Tests the accounting ledger functionality including
 * recording entries, cancellations, and reconciliation.
 */

// Mock Stripe
jest.mock("stripe", () => {
	return jest.fn(() => ({
		paymentIntents: {
			retrieve: jest.fn().mockResolvedValue({
				id: "pi_test_123",
				amount: 15000,
			}),
		},
		charges: {
			retrieve: jest.fn().mockResolvedValue({
				id: "ch_test_123",
				amount: 2500,
			}),
		},
		refunds: {
			retrieve: jest.fn().mockResolvedValue({
				id: "re_test_123",
				amount: 7500,
			}),
		},
		transfers: {
			retrieve: jest.fn().mockResolvedValue({
				id: "tr_test_123",
				amount: 8000,
			}),
		},
	}));
});

// Mock sequelize transaction
const mockTransaction = {
	commit: jest.fn(),
	rollback: jest.fn(),
};

// Mock models
const mockLedgerCreate = jest.fn();
const mockLedgerFindAll = jest.fn();
const mockLedgerUpdate = jest.fn();

jest.mock("../../models", () => ({
	JobLedger: {
		create: (...args) => mockLedgerCreate(...args),
		findAll: (...args) => mockLedgerFindAll(...args),
		update: (...args) => mockLedgerUpdate(...args),
	},
	sequelize: {
		transaction: jest.fn(() => mockTransaction),
		fn: jest.fn(),
		col: jest.fn(),
		literal: jest.fn(),
		Sequelize: {
			Op: {
				ne: Symbol("ne"),
				between: Symbol("between"),
			},
		},
	},
	Op: {
		ne: Symbol("ne"),
		between: Symbol("between"),
	},
}));

const JobLedgerService = require("../../services/JobLedgerService");

describe("JobLedgerService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("record", () => {
		it("should create a ledger entry with correct fields", async () => {
			mockLedgerCreate.mockResolvedValue({
				id: 1,
				appointmentId: 1,
				entryType: "booking_revenue",
				amount: 15000,
				direction: "credit",
			});

			const result = await JobLedgerService.record({
				appointmentId: 1,
				entryType: "booking_revenue",
				amount: 15000,
				direction: "credit",
				accountType: "revenue",
				partyType: "homeowner",
				partyUserId: 100,
				description: "Booking revenue - base cleaning",
			});

			expect(mockLedgerCreate).toHaveBeenCalled();
			const callArgs = mockLedgerCreate.mock.calls[0][0];
			expect(callArgs.appointmentId).toBe(1);
			expect(callArgs.entryType).toBe("booking_revenue");
			expect(callArgs.amount).toBe(15000);
			expect(callArgs.direction).toBe("credit");
			expect(callArgs.accountType).toBe("revenue");
			expect(callArgs.partyType).toBe("homeowner");
			expect(callArgs.partyUserId).toBe(100);
			expect(result).toBeDefined();
		});

		it("should calculate tax year and quarter from effective date", async () => {
			const effectiveDate = new Date("2026-07-15");
			mockLedgerCreate.mockResolvedValue({ id: 1 });

			await JobLedgerService.record({
				appointmentId: 1,
				entryType: "booking_revenue",
				amount: 15000,
				direction: "credit",
				accountType: "revenue",
				partyType: "homeowner",
				description: "Test entry",
				effectiveDate,
			});

			expect(mockLedgerCreate).toHaveBeenCalled();
			const callArgs = mockLedgerCreate.mock.calls[0][0];
			expect(callArgs.taxYear).toBe(2026);
			expect(callArgs.taxQuarter).toBe(3); // July is Q3
		});

		it("should mark 1099 eligible for cleaner payouts >= $600", async () => {
			mockLedgerCreate.mockResolvedValue({ id: 1 });

			await JobLedgerService.record({
				appointmentId: 1,
				entryType: "cleaner_payout_job",
				amount: 60000, // $600
				direction: "debit",
				accountType: "payouts_payable",
				partyType: "cleaner",
				partyUserId: 200,
				description: "Cleaner payout",
			});

			expect(mockLedgerCreate).toHaveBeenCalled();
			const callArgs = mockLedgerCreate.mock.calls[0][0];
			expect(callArgs.form1099Eligible).toBe(true);
		});

		it("should not mark 1099 eligible for payouts < $600", async () => {
			mockLedgerCreate.mockResolvedValue({ id: 1 });

			await JobLedgerService.record({
				appointmentId: 1,
				entryType: "cleaner_payout_job",
				amount: 50000, // $500
				direction: "debit",
				accountType: "payouts_payable",
				partyType: "cleaner",
				partyUserId: 200,
				description: "Cleaner payout",
			});

			expect(mockLedgerCreate).toHaveBeenCalled();
			const callArgs = mockLedgerCreate.mock.calls[0][0];
			expect(callArgs.form1099Eligible).toBe(false);
		});
	});

	describe("recordCancellation", () => {
		it("should create all entries for a cancellation with refund and fee", async () => {
			mockLedgerCreate.mockResolvedValue({ id: 1 });

			const entries = await JobLedgerService.recordCancellation(1, {
				homeownerId: 100,
				refundAmount: 7500,
				refundPercentage: 50,
				cancellationFee: 2500,
				cleanerPayouts: [
					{ cleanerId: 200, netAmount: 6000, platformFee: 750 },
				],
				stripeDetails: {
					refundId: "re_test_123",
					feeChargeId: "ch_test_456",
					stripeFees: 150,
				},
				originalAmount: 15000,
			});

			// Should create: refund, fee, cleaner payout, platform fee, stripe fees
			expect(mockLedgerCreate).toHaveBeenCalledTimes(5);

			// Get all call arguments
			const allCalls = mockLedgerCreate.mock.calls.map(call => call[0]);

			// Check refund entry
			const refundEntry = allCalls.find(c => c.entryType === "cancellation_partial_refund");
			expect(refundEntry).toBeDefined();
			expect(refundEntry.amount).toBe(7500);
			expect(refundEntry.direction).toBe("debit");
			expect(refundEntry.accountType).toBe("refunds_payable");

			// Check fee entry
			const feeEntry = allCalls.find(c => c.entryType === "cancellation_fee_revenue");
			expect(feeEntry).toBeDefined();
			expect(feeEntry.amount).toBe(2500);
			expect(feeEntry.direction).toBe("credit");

			// Check cleaner payout
			const payoutEntry = allCalls.find(c => c.entryType === "cleaner_payout_cancellation");
			expect(payoutEntry).toBeDefined();
			expect(payoutEntry.amount).toBe(6000);
			expect(payoutEntry.partyType).toBe("cleaner");

			expect(mockTransaction.commit).toHaveBeenCalled();
		});

		it("should use cancellation_refund for full refund", async () => {
			mockLedgerCreate.mockResolvedValue({ id: 1 });

			await JobLedgerService.recordCancellation(1, {
				homeownerId: 100,
				refundAmount: 15000,
				refundPercentage: 100,
				cancellationFee: 0,
				cleanerPayouts: [],
				stripeDetails: { refundId: "re_test_123" },
				originalAmount: 15000,
			});

			expect(mockLedgerCreate).toHaveBeenCalled();
			const callArgs = mockLedgerCreate.mock.calls[0][0];
			expect(callArgs.entryType).toBe("cancellation_refund");
			expect(callArgs.amount).toBe(15000);
		});

		it("should rollback on error", async () => {
			mockLedgerCreate.mockRejectedValue(new Error("DB error"));

			await expect(JobLedgerService.recordCancellation(1, {
				homeownerId: 100,
				refundAmount: 7500,
				originalAmount: 15000,
			})).rejects.toThrow("DB error");

			expect(mockTransaction.rollback).toHaveBeenCalled();
		});
	});

	describe("recordAppealResolution", () => {
		it("should create entries for appeal refund and fee reversal", async () => {
			mockLedgerCreate.mockResolvedValue({ id: 1 });

			await JobLedgerService.recordAppealResolution(1, 10, {
				homeownerId: 100,
				refundAmount: 2500,
				feeReversal: 2500,
				stripeDetails: {
					refundId: "re_test_123",
					feeRefundId: "re_test_456",
				},
			});

			expect(mockLedgerCreate).toHaveBeenCalledTimes(2);

			const allCalls = mockLedgerCreate.mock.calls.map(call => call[0]);

			// Check appeal refund
			const refundEntry = allCalls.find(c => c.entryType === "appeal_refund");
			expect(refundEntry).toBeDefined();
			expect(refundEntry.appealId).toBe(10);

			// Check fee reversal
			const feeEntry = allCalls.find(c => c.entryType === "appeal_fee_reversal");
			expect(feeEntry).toBeDefined();
			expect(feeEntry.appealId).toBe(10);
		});

		it("should only create refund entry if no fee reversal", async () => {
			mockLedgerCreate.mockResolvedValue({ id: 1 });

			await JobLedgerService.recordAppealResolution(1, 10, {
				homeownerId: 100,
				refundAmount: 2500,
				feeReversal: 0,
				stripeDetails: { refundId: "re_test_123" },
			});

			expect(mockLedgerCreate).toHaveBeenCalledTimes(1);
			const callArgs = mockLedgerCreate.mock.calls[0][0];
			expect(callArgs.entryType).toBe("appeal_refund");
		});
	});

	describe("getJobLedger", () => {
		it("should return ledger entries with summary", async () => {
			mockLedgerFindAll.mockResolvedValue([
				{ id: 1, entryType: "booking_revenue", amount: 15000, direction: "credit", accountType: "revenue", partyType: "homeowner" },
				{ id: 2, entryType: "cleaner_payout_job", amount: 10000, direction: "debit", accountType: "payouts_payable", partyType: "cleaner" },
				{ id: 3, entryType: "platform_fee_standard", amount: 1500, direction: "credit", accountType: "platform_revenue", partyType: "platform" },
			]);

			const result = await JobLedgerService.getJobLedger(1);

			expect(result.appointmentId).toBe(1);
			expect(result.entries).toHaveLength(3);
			expect(result.summary).toBeDefined();
			expect(result.summary.totalRevenue).toBe(16500); // 15000 + 1500
			expect(result.summary.totalPayouts).toBe(10000);
		});
	});

	describe("calculateSummary", () => {
		it("should calculate correct totals from entries", () => {
			const entries = [
				{ entryType: "booking_revenue", amount: 15000, direction: "credit", accountType: "revenue", partyType: "homeowner" },
				{ entryType: "cancellation_partial_refund", amount: 7500, direction: "debit", accountType: "refunds_payable", partyType: "homeowner" },
				{ entryType: "cancellation_fee_revenue", amount: 2500, direction: "credit", accountType: "platform_revenue", partyType: "homeowner" },
				{ entryType: "cleaner_payout_cancellation", amount: 6000, direction: "debit", accountType: "payouts_payable", partyType: "cleaner" },
			];

			const summary = JobLedgerService.calculateSummary(entries);

			expect(summary.totalRevenue).toBe(17500); // 15000 + 2500
			expect(summary.totalRefunds).toBe(7500);
			expect(summary.totalPayouts).toBe(6000);
			expect(summary.netPlatformRevenue).toBe(2500);
			expect(summary.byEntryType.booking_revenue.count).toBe(1);
			expect(summary.byEntryType.booking_revenue.total).toBe(15000);
		});
	});

	describe("calculateBalance", () => {
		it("should calculate running balance", () => {
			const entries = [
				{ amount: 15000, direction: "credit" },
				{ amount: 7500, direction: "debit" },
				{ amount: 2500, direction: "credit" },
			];

			const balance = JobLedgerService.calculateBalance(entries);

			expect(balance).toBe(10000); // 15000 - 7500 + 2500
		});

		it("should return 0 for empty entries", () => {
			expect(JobLedgerService.calculateBalance([])).toBe(0);
		});
	});

	describe("getTaxCategory", () => {
		it("should return correct categories", () => {
			expect(JobLedgerService.getTaxCategory("booking_revenue")).toBe("income");
			expect(JobLedgerService.getTaxCategory("cancellation_refund")).toBe("refund");
			expect(JobLedgerService.getTaxCategory("cleaner_payout_job")).toBe("payout");
			expect(JobLedgerService.getTaxCategory("cancellation_fee_revenue")).toBe("income");
			expect(JobLedgerService.getTaxCategory("stripe_fee")).toBe("expense");
			expect(JobLedgerService.getTaxCategory("appeal_fee_reversal")).toBe("refund");
		});
	});

	describe("getAddonEntryType", () => {
		it("should return correct addon entry types", () => {
			expect(JobLedgerService.getAddonEntryType("linens")).toBe("addon_linens");
			expect(JobLedgerService.getAddonEntryType("timeWindow")).toBe("addon_time_window");
			expect(JobLedgerService.getAddonEntryType("highVolume")).toBe("addon_high_volume");
			expect(JobLedgerService.getAddonEntryType("lastMinute")).toBe("addon_last_minute");
			expect(JobLedgerService.getAddonEntryType("unknown")).toBe("booking_revenue");
		});
	});

	describe("generateReport", () => {
		it("should generate grouped report", async () => {
			mockLedgerFindAll.mockResolvedValue([
				{ entryType: "booking_revenue", amount: 15000, direction: "credit", effectiveDate: new Date() },
				{ entryType: "booking_revenue", amount: 12000, direction: "credit", effectiveDate: new Date() },
				{ entryType: "cleaner_payout_job", amount: 20000, direction: "debit", effectiveDate: new Date() },
			]);

			const report = await JobLedgerService.generateReport({
				taxYear: 2026,
				taxQuarter: 1,
				groupBy: "entryType",
			});

			expect(report.taxPeriod).toEqual({ taxYear: 2026, taxQuarter: 1 });
			expect(report.totalEntries).toBe(3);
			expect(report.totals.credits).toBe(27000);
			expect(report.totals.debits).toBe(20000);
			expect(report.grouped.booking_revenue.count).toBe(2);
			expect(report.grouped.booking_revenue.credits).toBe(27000);
		});
	});

	describe("reconcile", () => {
		it("should reconcile entries with Stripe", async () => {
			const mockEntry = {
				id: 1,
				stripeObjectType: "refund",
				stripeObjectId: "re_test_123",
				amount: 7500,
				update: jest.fn().mockResolvedValue(true),
			};
			mockLedgerFindAll.mockResolvedValue([mockEntry]);

			const results = await JobLedgerService.reconcile();

			expect(results.batch).toMatch(/^RECON-/);
			expect(results.matched).toBe(1);
			expect(mockEntry.update).toHaveBeenCalledWith(expect.objectContaining({
				reconciled: true,
			}));
		});

		it("should mark mismatched entries", async () => {
			const mockEntry = {
				id: 1,
				stripeObjectType: "refund",
				stripeObjectId: "re_test_123",
				amount: 5000, // Doesn't match Stripe's 7500
				update: jest.fn().mockResolvedValue(true),
			};
			mockLedgerFindAll.mockResolvedValue([mockEntry]);

			const results = await JobLedgerService.reconcile();

			expect(results.mismatched).toBe(1);
			expect(mockEntry.update).toHaveBeenCalledWith(expect.objectContaining({
				reconciled: false,
				discrepancyAmount: 2500,
			}));
		});
	});
});
