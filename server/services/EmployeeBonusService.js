/**
 * EmployeeBonusService
 *
 * Service for managing employee bonuses given by business owners.
 * Handles creating, paying, and tracking bonuses.
 */

class EmployeeBonusService {
	/**
	 * Create a new bonus for an employee
	 * @param {number} businessOwnerId - Business owner giving the bonus
	 * @param {number} employeeId - Employee receiving the bonus
	 * @param {number} amount - Bonus amount in cents
	 * @param {string} reason - Optional reason for the bonus
	 * @returns {Promise<Object>} Created bonus
	 */
	static async createBonus(businessOwnerId, employeeId, amount, reason = null) {
		const { EmployeeBonus, BusinessEmployee, User } = require("../models");

		// Validate amount
		if (!amount || amount <= 0) {
			throw new Error("Bonus amount must be greater than 0");
		}

		// Validate business owner
		const businessOwner = await User.findByPk(businessOwnerId);
		if (!businessOwner || !businessOwner.isBusinessOwner) {
			throw new Error("Invalid business owner");
		}

		// Validate employee relationship
		// Note: BusinessEmployee uses 'userId' to link to the User account
		const businessEmployee = await BusinessEmployee.findOne({
			where: {
				businessOwnerId,
				userId: employeeId,
				status: "active",
			},
		});

		if (!businessEmployee) {
			throw new Error("Employee not found or not active");
		}

		// Create the bonus
		const bonus = await EmployeeBonus.create({
			businessOwnerId,
			employeeId,
			businessEmployeeId: businessEmployee.id,
			amount,
			reason,
			status: "pending",
		});

		// Fetch with associations for response
		const createdBonus = await EmployeeBonus.findByPk(bonus.id, {
			include: [
				{
					model: User,
					as: "employee",
					attributes: ["id", "firstName", "lastName", "email"],
				},
			],
		});

		return this.serializeBonus(createdBonus);
	}

	/**
	 * Mark a bonus as paid
	 * @param {number} bonusId - Bonus ID
	 * @param {number} businessOwnerId - Business owner marking the payment
	 * @param {string} note - Optional note about payment method
	 * @returns {Promise<Object>} Updated bonus
	 */
	static async markBonusPaid(bonusId, businessOwnerId, note = null) {
		const { EmployeeBonus, User } = require("../models");

		const bonus = await EmployeeBonus.findOne({
			where: {
				id: bonusId,
				businessOwnerId,
			},
		});

		if (!bonus) {
			throw new Error("Bonus not found");
		}

		if (bonus.status !== "pending") {
			throw new Error(`Cannot mark bonus as paid - current status is ${bonus.status}`);
		}

		await bonus.update({
			status: "paid",
			paidAt: new Date(),
			paidNote: note,
		});

		// Fetch with associations for response
		const updatedBonus = await EmployeeBonus.findByPk(bonus.id, {
			include: [
				{
					model: User,
					as: "employee",
					attributes: ["id", "firstName", "lastName", "email"],
				},
			],
		});

		return this.serializeBonus(updatedBonus);
	}

	/**
	 * Cancel a pending bonus
	 * @param {number} bonusId - Bonus ID
	 * @param {number} businessOwnerId - Business owner cancelling
	 * @returns {Promise<Object>} Cancelled bonus
	 */
	static async cancelBonus(bonusId, businessOwnerId) {
		const { EmployeeBonus } = require("../models");

		const bonus = await EmployeeBonus.findOne({
			where: {
				id: bonusId,
				businessOwnerId,
			},
		});

		if (!bonus) {
			throw new Error("Bonus not found");
		}

		if (bonus.status !== "pending") {
			throw new Error(`Cannot cancel bonus - current status is ${bonus.status}`);
		}

		await bonus.update({
			status: "cancelled",
		});

		return { success: true, message: "Bonus cancelled" };
	}

	/**
	 * Get pending bonuses for a business owner
	 * @param {number} businessOwnerId - Business owner ID
	 * @returns {Promise<Array>} List of pending bonuses
	 */
	static async getPendingBonuses(businessOwnerId) {
		const { EmployeeBonus, User } = require("../models");

		const bonuses = await EmployeeBonus.findAll({
			where: {
				businessOwnerId,
				status: "pending",
			},
			include: [
				{
					model: User,
					as: "employee",
					attributes: ["id", "firstName", "lastName", "email"],
				},
			],
			order: [["createdAt", "DESC"]],
		});

		return bonuses.map((b) => this.serializeBonus(b));
	}

	/**
	 * Get all bonuses for a business owner (with optional filters)
	 * @param {number} businessOwnerId - Business owner ID
	 * @param {Object} options - Filter options
	 * @returns {Promise<Array>} List of bonuses
	 */
	static async getBonusesForBusinessOwner(businessOwnerId, options = {}) {
		const { EmployeeBonus, User } = require("../models");
		const { Op } = require("sequelize");

		const { status, employeeId, limit = 50 } = options;

		const where = { businessOwnerId };
		if (status) {
			where.status = status;
		}
		if (employeeId) {
			where.employeeId = employeeId;
		}

		const bonuses = await EmployeeBonus.findAll({
			where,
			include: [
				{
					model: User,
					as: "employee",
					attributes: ["id", "firstName", "lastName", "email"],
				},
			],
			order: [["createdAt", "DESC"]],
			limit,
		});

		return bonuses.map((b) => this.serializeBonus(b));
	}

	/**
	 * Get bonuses received by an employee
	 * @param {number} employeeId - Employee ID
	 * @param {Object} options - Filter options
	 * @returns {Promise<Array>} List of bonuses
	 */
	static async getBonusesForEmployee(employeeId, options = {}) {
		const { EmployeeBonus, User } = require("../models");

		const { limit = 50, includePending = false } = options;

		const statusFilter = includePending ? ["pending", "paid"] : ["paid"];

		const bonuses = await EmployeeBonus.findAll({
			where: {
				employeeId,
				status: statusFilter,
			},
			include: [
				{
					model: User,
					as: "businessOwner",
					attributes: ["id", "firstName", "lastName"],
				},
			],
			order: [["createdAt", "DESC"]],
			limit,
		});

		return bonuses.map((b) => this.serializeBonusForEmployee(b));
	}

	/**
	 * Get bonus summary for a business owner
	 * @param {number} businessOwnerId - Business owner ID
	 * @returns {Promise<Object>} Summary stats
	 */
	static async getBonusSummary(businessOwnerId) {
		const { EmployeeBonus, sequelize } = require("../models");

		const [pending, paid] = await Promise.all([
			EmployeeBonus.findOne({
				where: { businessOwnerId, status: "pending" },
				attributes: [
					[sequelize.fn("SUM", sequelize.col("amount")), "total"],
					[sequelize.fn("COUNT", sequelize.col("id")), "count"],
				],
				raw: true,
			}),
			EmployeeBonus.findOne({
				where: { businessOwnerId, status: "paid" },
				attributes: [
					[sequelize.fn("SUM", sequelize.col("amount")), "total"],
					[sequelize.fn("COUNT", sequelize.col("id")), "count"],
				],
				raw: true,
			}),
		]);

		return {
			pending: {
				total: parseInt(pending.total) || 0,
				totalFormatted: `$${((parseInt(pending.total) || 0) / 100).toFixed(2)}`,
				count: parseInt(pending.count) || 0,
			},
			paid: {
				total: parseInt(paid.total) || 0,
				totalFormatted: `$${((parseInt(paid.total) || 0) / 100).toFixed(2)}`,
				count: parseInt(paid.count) || 0,
			},
		};
	}

	/**
	 * Serialize bonus for API response (business owner view)
	 */
	static serializeBonus(bonus) {
		return {
			id: bonus.id,
			employeeId: bonus.employeeId,
			employeeName: bonus.employee
				? `${bonus.employee.firstName} ${bonus.employee.lastName}`
				: null,
			employeeEmail: bonus.employee?.email,
			amount: bonus.amount,
			amountFormatted: `$${(bonus.amount / 100).toFixed(2)}`,
			reason: bonus.reason,
			status: bonus.status,
			paidAt: bonus.paidAt,
			paidNote: bonus.paidNote,
			createdAt: bonus.createdAt,
		};
	}

	/**
	 * Serialize bonus for employee view (limited info)
	 */
	static serializeBonusForEmployee(bonus) {
		return {
			id: bonus.id,
			amount: bonus.amount,
			amountFormatted: `$${(bonus.amount / 100).toFixed(2)}`,
			reason: bonus.reason,
			status: bonus.status,
			paidAt: bonus.paidAt,
			createdAt: bonus.createdAt,
			fromBusinessOwner: bonus.businessOwner
				? `${bonus.businessOwner.firstName} ${bonus.businessOwner.lastName}`
				: null,
		};
	}
}

module.exports = EmployeeBonusService;
