module.exports = (sequelize, DataTypes) => {
	const EmployeeBonus = sequelize.define("EmployeeBonus", {
		id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			autoIncrement: true,
			primaryKey: true,
		},
		businessOwnerId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			comment: "Business owner who gave the bonus",
		},
		employeeId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			comment: "Employee (user) who received the bonus",
		},
		businessEmployeeId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			comment: "Link to BusinessEmployee relationship record",
		},
		amount: {
			type: DataTypes.INTEGER,
			allowNull: false,
			comment: "Bonus amount in cents",
		},
		reason: {
			type: DataTypes.TEXT,
			allowNull: true,
			comment: "Reason for the bonus (e.g., 'Top performer February 2026')",
		},
		status: {
			type: DataTypes.ENUM("pending", "paid", "cancelled"),
			allowNull: false,
			defaultValue: "pending",
		},
		paidAt: {
			type: DataTypes.DATE,
			allowNull: true,
			comment: "When the bonus was marked as paid",
		},
		paidNote: {
			type: DataTypes.STRING,
			allowNull: true,
			comment: "Optional note about payment method (e.g., 'Paid via Venmo')",
		},
	}, {
		tableName: 'EmployeeBonuses',
	});

	// Instance methods
	EmployeeBonus.prototype.getFormattedAmount = function () {
		return `$${(this.amount / 100).toFixed(2)}`;
	};

	EmployeeBonus.prototype.isPending = function () {
		return this.status === "pending";
	};

	EmployeeBonus.prototype.isPaid = function () {
		return this.status === "paid";
	};

	// Class methods
	EmployeeBonus.getPendingForBusinessOwner = async function (businessOwnerId) {
		return this.findAll({
			where: {
				businessOwnerId,
				status: "pending",
			},
			include: [
				{
					model: sequelize.models.User,
					as: "employee",
					attributes: ["id", "firstName", "lastName", "email"],
				},
			],
			order: [["createdAt", "DESC"]],
		});
	};

	EmployeeBonus.getForEmployee = async function (employeeId, options = {}) {
		const { limit = 50, includeStatus = ["paid"] } = options;
		return this.findAll({
			where: {
				employeeId,
				status: includeStatus,
			},
			include: [
				{
					model: sequelize.models.User,
					as: "businessOwner",
					attributes: ["id", "firstName", "lastName"],
				},
			],
			order: [["createdAt", "DESC"]],
			limit,
		});
	};

	EmployeeBonus.getTotalPendingAmount = async function (businessOwnerId) {
		const result = await this.findOne({
			where: {
				businessOwnerId,
				status: "pending",
			},
			attributes: [
				[sequelize.fn("SUM", sequelize.col("amount")), "total"],
				[sequelize.fn("COUNT", sequelize.col("id")), "count"],
			],
			raw: true,
		});
		return {
			total: parseInt(result.total) || 0,
			count: parseInt(result.count) || 0,
		};
	};

	EmployeeBonus.associate = (models) => {
		EmployeeBonus.belongsTo(models.User, {
			foreignKey: "businessOwnerId",
			as: "businessOwner",
		});
		EmployeeBonus.belongsTo(models.User, {
			foreignKey: "employeeId",
			as: "employee",
		});
		EmployeeBonus.belongsTo(models.BusinessEmployee, {
			foreignKey: "businessEmployeeId",
			as: "businessEmployee",
		});
	};

	return EmployeeBonus;
};
