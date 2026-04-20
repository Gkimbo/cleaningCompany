const EncryptionService = require("../services/EncryptionService");

class StripeConnectAccountSerializer {
	static decryptField(value) {
		if (!value) return null;
		return EncryptionService.decrypt(value);
	}

	static serializeUser(user) {
		if (!user) return null;
		const data = user.dataValues || user;
		return {
			id: data.id,
			firstName: this.decryptField(data.firstName),
			lastName: this.decryptField(data.lastName),
			email: this.decryptField(data.email)
		};
	}

	static serializeOne(account) {
		const data = account.dataValues || account;

		const serialized = {
			id: data.id,
			userId: data.userId,
			// Note: stripeAccountId intentionally excluded - use serializeForAdmin if needed
			accountStatus: data.accountStatus,
			payoutsEnabled: data.payoutsEnabled,
			chargesEnabled: data.chargesEnabled,
			detailsSubmitted: data.detailsSubmitted,
			onboardingComplete: data.onboardingComplete,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		// Add convenience flags
		serialized.isFullyActive = data.payoutsEnabled && data.chargesEnabled && data.onboardingComplete;
		serialized.needsOnboarding = !data.onboardingComplete;

		// Serialize user if included
		if (account.user) {
			serialized.user = this.serializeUser(account.user);
		}

		return serialized;
	}

	static serializeArray(accounts) {
		return accounts.map((account) => this.serializeOne(account));
	}

	static serializeForList(account) {
		const data = account.dataValues || account;

		const serialized = {
			id: data.id,
			userId: data.userId,
			accountStatus: data.accountStatus,
			payoutsEnabled: data.payoutsEnabled,
			onboardingComplete: data.onboardingComplete,
			isFullyActive: data.payoutsEnabled && data.chargesEnabled && data.onboardingComplete
		};

		if (account.user) {
			serialized.user = this.serializeUser(account.user);
		}

		return serialized;
	}

	static serializeArrayForList(accounts) {
		return accounts.map((account) => this.serializeForList(account));
	}

	static serializeStatus(account) {
		const data = account.dataValues || account;

		return {
			id: data.id,
			accountStatus: data.accountStatus,
			payoutsEnabled: data.payoutsEnabled,
			chargesEnabled: data.chargesEnabled,
			detailsSubmitted: data.detailsSubmitted,
			onboardingComplete: data.onboardingComplete,
			isFullyActive: data.payoutsEnabled && data.chargesEnabled && data.onboardingComplete,
			needsOnboarding: !data.onboardingComplete
		};
	}

	static serializeForCleaner(account) {
		const data = account.dataValues || account;

		return {
			id: data.id,
			accountStatus: data.accountStatus,
			payoutsEnabled: data.payoutsEnabled,
			onboardingComplete: data.onboardingComplete,
			isFullyActive: data.payoutsEnabled && data.chargesEnabled && data.onboardingComplete,
			needsOnboarding: !data.onboardingComplete
		};
	}

	/**
	 * Admin-only serializer that includes sensitive Stripe IDs
	 * Only use this for IT support tools and admin dashboards
	 */
	static serializeForAdmin(account) {
		const data = account.dataValues || account;

		const serialized = {
			id: data.id,
			userId: data.userId,
			stripeAccountId: data.stripeAccountId, // Only exposed for admin use
			accountStatus: data.accountStatus,
			payoutsEnabled: data.payoutsEnabled,
			chargesEnabled: data.chargesEnabled,
			detailsSubmitted: data.detailsSubmitted,
			onboardingComplete: data.onboardingComplete,
			isFullyActive: data.payoutsEnabled && data.chargesEnabled && data.onboardingComplete,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		};

		if (account.user) {
			serialized.user = this.serializeUser(account.user);
		}

		return serialized;
	}
}

module.exports = StripeConnectAccountSerializer;
