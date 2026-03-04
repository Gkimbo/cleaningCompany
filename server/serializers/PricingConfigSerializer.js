class PricingConfigSerializer {
	// Convert cents to dollars for display
	static toDollars(cents) {
		if (cents === null || cents === undefined) return null;
		return (cents / 100).toFixed(2);
	}

	static serializeOne(config) {
		const data = config.dataValues || config;

		return {
			id: data.id,
			basePrice: this.toDollars(data.basePrice),
			extraBedBathFee: this.toDollars(data.extraBedBathFee),
			halfBathFee: this.toDollars(data.halfBathFee),
			sheetFeePerBed: this.toDollars(data.sheetFeePerBed),
			towelFee: this.toDollars(data.towelFee),
			faceClothFee: this.toDollars(data.faceClothFee),
			timeWindowAnytime: this.toDollars(data.timeWindowAnytime),
			timeWindow10To3: this.toDollars(data.timeWindow10To3),
			timeWindow11To4: this.toDollars(data.timeWindow11To4),
			timeWindow12To2: this.toDollars(data.timeWindow12To2),
			cancellationFee: this.toDollars(data.cancellationFee),
			cancellationWindowDays: data.cancellationWindowDays,
			homeownerPenaltyDays: data.homeownerPenaltyDays,
			cleanerPenaltyDays: data.cleanerPenaltyDays,
			refundPercentage: parseFloat(data.refundPercentage),
			platformFeePercent: parseFloat(data.platformFeePercent),
			businessOwnerFeePercent: parseFloat(data.businessOwnerFeePercent || data.platformFeePercent),
			incentiveRefundPercent: parseFloat(data.incentiveRefundPercent || 0.10),
			incentiveCleanerPercent: parseFloat(data.incentiveCleanerPercent || 0.40),
			highVolumeFee: this.toDollars(data.highVolumeFee),
			multiCleanerPlatformFeePercent: parseFloat(data.multiCleanerPlatformFeePercent || 0.13),
			soloLargeHomeBonus: this.toDollars(data.soloLargeHomeBonus || 0),
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
			lastMinuteFee: this.toDollars(data.lastMinuteFee || 5000),
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
			basePrice: this.toDollars(data.basePrice),
			extraBedBathFee: this.toDollars(data.extraBedBathFee),
			halfBathFee: this.toDollars(data.halfBathFee),
			linens: {
				sheetFeePerBed: this.toDollars(data.sheetFeePerBed),
				towelFee: this.toDollars(data.towelFee),
				faceClothFee: this.toDollars(data.faceClothFee)
			},
			timeWindows: {
				anytime: {
					surcharge: this.toDollars(data.timeWindowAnytime),
					label: "Anytime",
					description: data.timeWindowAnytime > 0
						? `+$${this.toDollars(data.timeWindowAnytime)} per cleaning`
						: "Most flexible, best pricing"
				},
				"10-3": {
					surcharge: this.toDollars(data.timeWindow10To3),
					label: "10am - 3pm",
					description: `+$${this.toDollars(data.timeWindow10To3)} per cleaning`
				},
				"11-4": {
					surcharge: this.toDollars(data.timeWindow11To4),
					label: "11am - 4pm",
					description: `+$${this.toDollars(data.timeWindow11To4)} per cleaning`
				},
				"12-2": {
					surcharge: this.toDollars(data.timeWindow12To2),
					label: "12pm - 2pm",
					description: `+$${this.toDollars(data.timeWindow12To2)} per cleaning`
				}
			},
			cancellation: {
				fee: this.toDollars(data.cancellationFee),
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
			highVolumeFee: this.toDollars(data.highVolumeFee),
			multiCleaner: {
				platformFeePercent: parseFloat(data.multiCleanerPlatformFeePercent || 0.13),
				soloLargeHomeBonus: this.toDollars(data.soloLargeHomeBonus || 0),
				largeHomeBedsThreshold: data.largeHomeBedsThreshold || 3,
				largeHomeBathsThreshold: data.largeHomeBathsThreshold || 3,
				offerExpirationHours: data.multiCleanerOfferExpirationHours || 48,
				urgentFillDays: data.urgentFillDays || 7,
				finalWarningDays: data.finalWarningDays || 3
			},
			lastMinute: {
				fee: this.toDollars(data.lastMinuteFee || 5000),
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
			basePrice: this.toDollars(data.basePrice),
			extraBedBathFee: this.toDollars(data.extraBedBathFee),
			halfBathFee: this.toDollars(data.halfBathFee),
			sheetFeePerBed: this.toDollars(data.sheetFeePerBed),
			towelFee: this.toDollars(data.towelFee),
			faceClothFee: this.toDollars(data.faceClothFee),
			timeWindowAnytime: this.toDollars(data.timeWindowAnytime),
			timeWindow10To3: this.toDollars(data.timeWindow10To3),
			timeWindow11To4: this.toDollars(data.timeWindow11To4),
			timeWindow12To2: this.toDollars(data.timeWindow12To2),
			cancellationFee: this.toDollars(data.cancellationFee),
			cancellationWindowDays: data.cancellationWindowDays,
			highVolumeFee: this.toDollars(data.highVolumeFee)
		};
	}
}

module.exports = PricingConfigSerializer;
