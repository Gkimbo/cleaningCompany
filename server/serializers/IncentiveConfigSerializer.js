class IncentiveConfigSerializer {
	static serializeOne(config) {
		const data = config.dataValues || config;

		return {
			id: data.id,
			cleanerIncentiveEnabled: data.cleanerIncentiveEnabled,
			cleanerFeeReductionPercent: parseFloat(data.cleanerFeeReductionPercent),
			cleanerEligibilityDays: data.cleanerEligibilityDays,
			cleanerMaxCleanings: data.cleanerMaxCleanings,
			homeownerIncentiveEnabled: data.homeownerIncentiveEnabled,
			homeownerDiscountPercent: parseFloat(data.homeownerDiscountPercent),
			homeownerMaxCleanings: data.homeownerMaxCleanings,
			isActive: data.isActive,
			updatedBy: data.updatedBy,
			changeNote: data.changeNote,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};
	}

	static serializeArray(configs) {
		return configs.map((config) => this.serializeOne(config));
	}

	static serializeFormatted(config) {
		if (!config) {
			return {
				cleaner: {
					enabled: false,
					feeReductionPercent: 1.0,
					eligibilityDays: 30,
					maxCleanings: 5
				},
				homeowner: {
					enabled: false,
					discountPercent: 0.1,
					maxCleanings: 4
				}
			};
		}

		const data = config.dataValues || config;

		return {
			cleaner: {
				enabled: data.cleanerIncentiveEnabled,
				feeReductionPercent: parseFloat(data.cleanerFeeReductionPercent),
				eligibilityDays: data.cleanerEligibilityDays,
				maxCleanings: data.cleanerMaxCleanings
			},
			homeowner: {
				enabled: data.homeownerIncentiveEnabled,
				discountPercent: parseFloat(data.homeownerDiscountPercent),
				maxCleanings: data.homeownerMaxCleanings
			}
		};
	}

	static serializeHistory(configs) {
		return configs.map((config) => {
			const data = config.dataValues || config;
			const serialized = this.serializeOne(config);

			// Include updater info if available
			if (config.updatedByUser) {
				serialized.updatedByUser = {
					id: config.updatedByUser.id,
					username: config.updatedByUser.username,
					email: config.updatedByUser.email
				};
			}

			return serialized;
		});
	}
}

module.exports = IncentiveConfigSerializer;
