class PricingConfigSerializer {
	static serializeOne(config) {
		const data = config.dataValues || config;

		return {
			id: data.id,
			basePrice: data.basePrice,
			extraBedBathFee: data.extraBedBathFee,
			halfBathFee: data.halfBathFee,
			sheetFeePerBed: data.sheetFeePerBed,
			towelFee: data.towelFee,
			faceClothFee: data.faceClothFee,
			timeWindowAnytime: data.timeWindowAnytime,
			timeWindow10To3: data.timeWindow10To3,
			timeWindow11To4: data.timeWindow11To4,
			timeWindow12To2: data.timeWindow12To2,
			cancellationFee: data.cancellationFee,
			cancellationWindowDays: data.cancellationWindowDays,
			homeownerPenaltyDays: data.homeownerPenaltyDays,
			cleanerPenaltyDays: data.cleanerPenaltyDays,
			refundPercentage: parseFloat(data.refundPercentage),
			platformFeePercent: parseFloat(data.platformFeePercent),
			businessOwnerFeePercent: parseFloat(data.businessOwnerFeePercent || data.platformFeePercent),
			incentiveRefundPercent: parseFloat(data.incentiveRefundPercent || 0.10),
			incentiveCleanerPercent: parseFloat(data.incentiveCleanerPercent || 0.40),
			highVolumeFee: data.highVolumeFee,
			multiCleanerPlatformFeePercent: parseFloat(data.multiCleanerPlatformFeePercent || 0.13),
			soloLargeHomeBonus: data.soloLargeHomeBonus || 0,
			largeHomeBedsThreshold: data.largeHomeBedsThreshold || 3,
			largeHomeBathsThreshold: data.largeHomeBathsThreshold || 3,
			multiCleanerOfferExpirationHours: data.multiCleanerOfferExpirationHours || 48,
			urgentFillDays: data.urgentFillDays || 7,
			finalWarningDays: data.finalWarningDays || 3,
			// Large business fee fields
			largeBusinessFeePercent: parseFloat(data.largeBusinessFeePercent || 0.07),
			largeBusinessMonthlyThreshold: data.largeBusinessMonthlyThreshold || 50,
			largeBusinessLookbackMonths: data.largeBusinessLookbackMonths || 1,
			// Last-minute booking fields
			lastMinuteFee: data.lastMinuteFee || 50,
			lastMinuteThresholdHours: data.lastMinuteThresholdHours || 48,
			lastMinuteNotificationRadiusMiles: parseFloat(data.lastMinuteNotificationRadiusMiles || 25),
			// Application settings
			idVerificationEnabled: data.idVerificationEnabled || false,
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
		if (!config) return null;

		const data = config.dataValues || config;

		return {
			basePrice: data.basePrice,
			extraBedBathFee: data.extraBedBathFee,
			halfBathFee: data.halfBathFee,
			linens: {
				sheetFeePerBed: data.sheetFeePerBed,
				towelFee: data.towelFee,
				faceClothFee: data.faceClothFee
			},
			timeWindows: {
				anytime: {
					surcharge: data.timeWindowAnytime,
					label: "Anytime",
					description: data.timeWindowAnytime > 0
						? `+$${data.timeWindowAnytime} per cleaning`
						: "Most flexible, best pricing"
				},
				"10-3": {
					surcharge: data.timeWindow10To3,
					label: "10am - 3pm",
					description: `+$${data.timeWindow10To3} per cleaning`
				},
				"11-4": {
					surcharge: data.timeWindow11To4,
					label: "11am - 4pm",
					description: `+$${data.timeWindow11To4} per cleaning`
				},
				"12-2": {
					surcharge: data.timeWindow12To2,
					label: "12pm - 2pm",
					description: `+$${data.timeWindow12To2} per cleaning`
				}
			},
			cancellation: {
				fee: data.cancellationFee,
				windowDays: data.cancellationWindowDays,
				homeownerPenaltyDays: data.homeownerPenaltyDays,
				cleanerPenaltyDays: data.cleanerPenaltyDays,
				refundPercentage: parseFloat(data.refundPercentage),
				incentiveRefundPercent: parseFloat(data.incentiveRefundPercent || 0.10),
				incentiveCleanerPercent: parseFloat(data.incentiveCleanerPercent || 0.40)
			},
			platform: {
				feePercent: parseFloat(data.platformFeePercent),
				businessOwnerFeePercent: parseFloat(data.businessOwnerFeePercent || data.platformFeePercent),
				largeBusinessFeePercent: parseFloat(data.largeBusinessFeePercent || 0.07),
				largeBusinessMonthlyThreshold: data.largeBusinessMonthlyThreshold || 50,
				largeBusinessLookbackMonths: data.largeBusinessLookbackMonths || 1
			},
			highVolumeFee: data.highVolumeFee,
			multiCleaner: {
				platformFeePercent: parseFloat(data.multiCleanerPlatformFeePercent || 0.13),
				soloLargeHomeBonus: data.soloLargeHomeBonus || 0,
				largeHomeBedsThreshold: data.largeHomeBedsThreshold || 3,
				largeHomeBathsThreshold: data.largeHomeBathsThreshold || 3,
				offerExpirationHours: data.multiCleanerOfferExpirationHours || 48,
				urgentFillDays: data.urgentFillDays || 7,
				finalWarningDays: data.finalWarningDays || 3
			},
			lastMinute: {
				fee: data.lastMinuteFee || 50,
				thresholdHours: data.lastMinuteThresholdHours || 48,
				notificationRadiusMiles: parseFloat(data.lastMinuteNotificationRadiusMiles || 25)
			},
			applications: {
				idVerificationEnabled: data.idVerificationEnabled || false
			}
		};
	}

	static serializeHistory(configs) {
		return configs.map((config) => {
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

	static serializeForPublic(config) {
		if (!config) return null;

		const data = config.dataValues || config;

		return {
			basePrice: data.basePrice,
			extraBedBathFee: data.extraBedBathFee,
			halfBathFee: data.halfBathFee,
			sheetFeePerBed: data.sheetFeePerBed,
			towelFee: data.towelFee,
			faceClothFee: data.faceClothFee,
			timeWindowAnytime: data.timeWindowAnytime,
			timeWindow10To3: data.timeWindow10To3,
			timeWindow11To4: data.timeWindow11To4,
			timeWindow12To2: data.timeWindow12To2,
			cancellationFee: data.cancellationFee,
			cancellationWindowDays: data.cancellationWindowDays,
			highVolumeFee: data.highVolumeFee
		};
	}
}

module.exports = PricingConfigSerializer;
