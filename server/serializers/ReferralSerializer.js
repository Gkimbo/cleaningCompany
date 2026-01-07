const EncryptionService = require("../services/EncryptionService");

class ReferralSerializer {
	static decryptUserField(value) {
		if (!value) return null;
		return EncryptionService.decrypt(value);
	}

	static serializeUser(user) {
		if (!user) return null;
		const data = user.dataValues || user;
		return {
			id: data.id,
			firstName: this.decryptUserField(data.firstName),
			lastName: this.decryptUserField(data.lastName),
			type: data.type
		};
	}

	static serializeOne(referral) {
		const data = referral.dataValues || referral;

		const serialized = {
			id: data.id,
			referrerId: data.referrerId,
			referredId: data.referredId,
			referralCode: data.referralCode,
			programType: data.programType,
			status: data.status,
			cleaningsRequired: data.cleaningsRequired,
			cleaningsCompleted: data.cleaningsCompleted,
			referrerRewardAmount: data.referrerRewardAmount,
			referredRewardAmount: data.referredRewardAmount,
			referrerRewardType: data.referrerRewardType,
			referredRewardType: data.referredRewardType,
			referrerRewardApplied: data.referrerRewardApplied,
			referrerRewardAppliedAt: data.referrerRewardAppliedAt,
			referrerRewardAppointmentId: data.referrerRewardAppointmentId,
			referredRewardApplied: data.referredRewardApplied,
			referredRewardAppliedAt: data.referredRewardAppliedAt,
			referredRewardAppointmentId: data.referredRewardAppointmentId,
			qualifiedAt: data.qualifiedAt,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Format reward amounts in dollars
		serialized.referrerRewardAmountDollars = (data.referrerRewardAmount / 100).toFixed(2);
		if (data.referredRewardAmount) {
			serialized.referredRewardAmountDollars = (data.referredRewardAmount / 100).toFixed(2);
		}

		// Calculate progress percentage
		serialized.progressPercent = data.cleaningsRequired > 0
			? Math.min(100, Math.round((data.cleaningsCompleted / data.cleaningsRequired) * 100))
			: 0;

		// Serialize related users if included
		if (referral.referrer) {
			serialized.referrer = this.serializeUser(referral.referrer);
		}

		if (referral.referred) {
			serialized.referred = this.serializeUser(referral.referred);
		}

		return serialized;
	}

	static serializeArray(referrals) {
		return referrals.map((referral) => this.serializeOne(referral));
	}

	static serializeProgress(referral) {
		const data = referral.dataValues || referral;

		return {
			id: data.id,
			status: data.status,
			cleaningsRequired: data.cleaningsRequired,
			cleaningsCompleted: data.cleaningsCompleted,
			progressPercent: data.cleaningsRequired > 0
				? Math.min(100, Math.round((data.cleaningsCompleted / data.cleaningsRequired) * 100))
				: 0,
			referrerRewardAmount: data.referrerRewardAmount,
			referrerRewardAmountDollars: (data.referrerRewardAmount / 100).toFixed(2),
			referrerRewardApplied: data.referrerRewardApplied
		};
	}

	static serializeForList(referral) {
		const data = referral.dataValues || referral;

		const serialized = {
			id: data.id,
			programType: data.programType,
			status: data.status,
			cleaningsCompleted: data.cleaningsCompleted,
			cleaningsRequired: data.cleaningsRequired,
			referrerRewardAmount: data.referrerRewardAmount,
			referrerRewardAmountDollars: (data.referrerRewardAmount / 100).toFixed(2),
			createdAt: data.createdAt
		};

		if (referral.referred) {
			serialized.referred = this.serializeUser(referral.referred);
		}

		return serialized;
	}

	static serializeArrayForList(referrals) {
		return referrals.map((referral) => this.serializeForList(referral));
	}

	static serializeStats(stats) {
		return {
			totalReferrals: stats.totalReferrals,
			pending: stats.pending,
			qualified: stats.qualified,
			rewarded: stats.rewarded,
			totalEarned: stats.totalEarned,
			totalEarnedDollars: (stats.totalEarned / 100).toFixed(2)
		};
	}
}

module.exports = ReferralSerializer;
