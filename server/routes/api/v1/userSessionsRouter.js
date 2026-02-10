/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
const express = require("express");
const passport = require("passport");
const { User, TermsAndConditions } = require("../../../models");
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const UserSerializer = require("../../../serializers/userSerializer");
const authenticateToken = require("../../../middleware/authenticatedToken");
const Email = require("../../../services/sendNotifications/EmailClass");
const PushNotification = require("../../../services/sendNotifications/PushNotificationClass");
const EncryptionService = require("../../../services/EncryptionService");

const sessionRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

sessionRouter.post("/", passport.authenticate("local"), async (req, res) => {
	try {
		const user = await User.findOne({ where: { id: req.user.id } });
		res.status(201).json(UserSerializer.serializeOne(user));
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Internal server error" });
	}
});

// Helper function to detect device type from User-Agent
const detectDeviceType = (userAgent) => {
	if (!userAgent) return "unknown";
	const ua = userAgent.toLowerCase();

	// Check for tablets first (they often contain "mobile" too)
	if (ua.includes("ipad") || (ua.includes("android") && !ua.includes("mobile"))) {
		return "tablet";
	}

	// Check for mobile devices
	if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android") ||
	    ua.includes("webos") || ua.includes("blackberry") || ua.includes("opera mini") ||
	    ua.includes("windows phone") || ua.includes("iemobile")) {
		return "mobile";
	}

	// Default to desktop
	return "desktop";
};

// Helper to get display name for account type
const getAccountDisplayName = (user) => {
	if (user.type === "employee") {
		return "Business Employee";
	}
	if (user.type === "cleaner" && user.isMarketplaceCleaner) {
		return "Marketplace Cleaner";
	}
	if (user.type === "cleaner") {
		return "Cleaner";
	}
	if (user.type === "owner") {
		return "Owner";
	}
	if (user.type === "humanResources") {
		return "HR Staff";
	}
	return "Homeowner";
};

// Helper to get account type identifier
const getAccountType = (user) => {
	if (user.type === "employee") return "employee";
	if (user.type === "cleaner" && user.isMarketplaceCleaner) return "marketplace_cleaner";
	if (user.type === "cleaner") return "cleaner";
	if (user.type === "owner") return "owner";
	if (user.type === "humanResources") return "hr";
	return "homeowner";
};

// Helper to match user to account type
const matchesAccountType = (user, accountType) => {
	if (accountType === "employee") return user.type === "employee";
	if (accountType === "marketplace_cleaner") return user.type === "cleaner" && user.isMarketplaceCleaner === true;
	if (accountType === "cleaner") return user.type === "cleaner" && !user.isMarketplaceCleaner;
	if (accountType === "owner") return user.type === "owner";
	if (accountType === "hr") return user.type === "humanResources";
	if (accountType === "homeowner") return !user.type || user.type === null;
	return false;
};

// GET: Check if email has multiple accounts (for login form account type selection)
sessionRouter.get("/check-accounts", async (req, res) => {
	const { email } = req.query;

	// If not an email, no need to check
	if (!email || !email.includes("@")) {
		return res.json({ multipleAccounts: false });
	}

	try {
		// Hash the email to search by emailHash (email is encrypted in DB)
		const emailHash = EncryptionService.hash(email);
		const users = await User.findAll({ where: { emailHash } });

		if (users.length <= 1) {
			return res.json({ multipleAccounts: false });
		}

		// Multiple accounts found - return account options
		const accountOptions = users.map((u) => ({
			accountType: getAccountType(u),
			displayName: getAccountDisplayName(u),
		}));

		return res.json({
			multipleAccounts: true,
			accountOptions,
		});
	} catch (error) {
		console.error("Error checking accounts:", error);
		return res.json({ multipleAccounts: false });
	}
});

sessionRouter.post("/login", async (req, res) => {
	const { username, password, accountType } = req.body;

	try {
		let user;
		const isEmail = username && username.includes("@");

		if (isEmail) {
			// Email login - check for multiple accounts
			// Hash the email to search by emailHash (email is encrypted in DB)
			const emailHash = EncryptionService.hash(username);
			const usersWithEmail = await User.findAll({
				where: { emailHash }
			});

			if (usersWithEmail.length === 0) {
				// No users with this email, try as username
				user = await User.findOne({ where: { username } });
			} else if (usersWithEmail.length === 1) {
				// Only one account with this email
				user = usersWithEmail[0];
			} else {
				// Multiple accounts with same email - need account type selection
				if (!accountType) {
					// Return available account types for selection
					const accountOptions = usersWithEmail.map((u) => ({
						accountType: getAccountType(u),
						displayName: getAccountDisplayName(u),
					}));

					return res.status(300).json({
						message: "Multiple accounts found. Please select account type.",
						requiresAccountSelection: true,
						accountOptions,
					});
				}

				// User specified account type, find matching account
				user = usersWithEmail.find((u) => matchesAccountType(u, accountType));

				if (!user) {
					return res.status(401).json({ error: "Invalid credentials" });
				}
			}
		} else {
			// Username login - works as before (username is unique)
			user = await User.findOne({ where: { username } });
		}

		if (user) {
			// Check if account is locked
			if (user.lockedUntil && user.lockedUntil > new Date()) {
				const remainingMinutes = Math.ceil((user.lockedUntil - new Date()) / (1000 * 60));
				return res.status(423).json({
					error: `Account temporarily locked. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`
				});
			}

			const passwordMatch = await bcrypt.compare(password, user.password);
			if (passwordMatch) {
				req.login(user, async (err) => {
					if (err) {
						console.error(err);
						res.status(500).json({ message: "Internal server error" });
					} else {
						// Detect and store device type
						const userAgent = req.headers["user-agent"];
						const deviceType = detectDeviceType(userAgent);

						// Reset failed attempts and update login info on successful login
						await user.update({
							lastLogin: new Date(),
							lastDeviceType: deviceType,
							loginCount: (user.loginCount || 0) + 1,
							failedLoginAttempts: 0,
							lockedUntil: null
						});

						const serializedUser = UserSerializer.login(user);
						const token = jwt.sign({ userId: user.id }, secretKey, { expiresIn: '24h' });

						// Check if user needs to accept new terms
						const userType = user.type === "cleaner" ? "cleaner" : "homeowner";
						const currentTerms = await TermsAndConditions.findOne({
							where: { type: userType },
							order: [["version", "DESC"]],
						});

						let requiresTermsAcceptance = false;
						let termsData = null;

						if (currentTerms) {
							// User needs to accept if they haven't accepted any version or their version is outdated
							if (!user.termsAcceptedVersion || user.termsAcceptedVersion < currentTerms.version) {
								requiresTermsAcceptance = true;
								termsData = {
									id: currentTerms.id,
									title: currentTerms.title,
									version: currentTerms.version,
									contentType: currentTerms.contentType,
									content: currentTerms.contentType === "text" ? currentTerms.content : null,
									pdfUrl: currentTerms.contentType === "pdf" ? `/api/v1/terms/pdf/${currentTerms.id}` : null,
								};
							}
						}

						// Get linked accounts (other accounts with same email) for account switching
						let linkedAccounts = [];
						if (user.email) {
							const otherAccounts = await User.findAll({
								where: {
									email: user.email,
									id: { [Op.ne]: user.id }
								}
							});
							linkedAccounts = otherAccounts.map((u) => ({
								accountType: getAccountType(u),
								displayName: getAccountDisplayName(u),
							}));
						}

						return res.status(201).json({
							user: serializedUser,
							token: token,
							requiresTermsAcceptance,
							terms: termsData,
							linkedAccounts,
						});
					}
				});
			} else {
				// Track failed login attempt
				const failedAttempts = (user.failedLoginAttempts || 0) + 1;
				const lockAccount = failedAttempts >= 5;

				await user.update({
					failedLoginAttempts: failedAttempts,
					lockedUntil: lockAccount ? new Date(Date.now() + 15 * 60 * 1000) : null // 15 min lockout
				});

				if (lockAccount) {
					return res.status(423).json({
						error: "Account locked due to too many failed attempts. Try again in 15 minutes."
					});
				}

				// Use same error for invalid password to prevent username enumeration
				res.status(401).json({ error: "Invalid credentials" });
			}
		} else {
			// Use same error for missing user to prevent username enumeration
			res.status(401).json({ error: "Invalid credentials" });
		}
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Internal server error" });
	}
});

sessionRouter.get("/current", authenticateToken, async (req, res) => {
	try {
		const user = await User.findOne({
			where: { id: req.userId },
		});
		if (!user) {
			return res.status(401).json({ message: "User not found" });
		}
		const serializedUser = UserSerializer.serializeOne(user);
		const token = jwt.sign({ userId: user.id }, secretKey, { expiresIn: '24h' });
		res.status(200).json({ user: serializedUser, token });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Internal server error" });
	}
});

sessionRouter.post("/logout", (req, res) => {
	req.session.destroy();
	res.clearCookie("token");
	res.status(200).json({ message: "Logout successful" });
});

// POST: Forgot Username - sends username(s) to email
// If multiple accounts share the same email, sends all usernames
sessionRouter.post("/forgot-username", async (req, res) => {
	const { email } = req.body;

	if (!email) {
		return res.status(400).json({ error: "Email is required" });
	}

	try {
		// Hash the email to search by emailHash (email is encrypted in DB)
		const emailHash = EncryptionService.hash(email);
		const usersWithEmail = await User.findAll({ where: { emailHash } });

		if (usersWithEmail.length === 0) {
			// Return success even if user not found for security (don't reveal if email exists)
			return res.status(200).json({
				message: "If an account with that email exists, we've sent the username to it."
			});
		}

		// Collect all usernames with their account types
		const usernames = usersWithEmail.map((u) => ({
			username: u.username,
			accountType: getAccountDisplayName(u),
		}));

		// Send username recovery email with all usernames (use the plain email from request, not encrypted)
		await Email.sendUsernameRecovery(email, usernames.map((u) => `${u.username} (${u.accountType})`).join(", "));
		console.log(`✅ Username recovery email sent with ${usernames.length} username(s)`);

		// Send push notification to each user that has a token
		for (const user of usersWithEmail) {
			if (user.expoPushToken) {
				await PushNotification.sendPushUsernameRecovery(user.expoPushToken, user.username);
			}
		}

		return res.status(200).json({
			message: "If an account with that email exists, we've sent the username to it."
		});
	} catch (error) {
		console.error("Error in forgot username:", error);
		return res.status(500).json({ error: "Failed to process request. Please try again." });
	}
});

// POST: Forgot Password - generates temporary password and sends to email
sessionRouter.post("/forgot-password", async (req, res) => {
	const { email, accountType } = req.body;

	if (!email) {
		return res.status(400).json({ error: "Email is required" });
	}

	try {
		// Hash the email to search by emailHash (email is encrypted in DB)
		const emailHash = EncryptionService.hash(email);
		const usersWithEmail = await User.findAll({ where: { emailHash } });

		if (usersWithEmail.length === 0) {
			// Return success even if user not found for security
			return res.status(200).json({
				message: "If an account with that email exists, we've sent password reset instructions to it."
			});
		}

		// If multiple accounts and no accountType specified, ask which one
		if (usersWithEmail.length > 1 && !accountType) {
			const accountOptions = usersWithEmail.map((u) => ({
				accountType: getAccountType(u),
				displayName: getAccountDisplayName(u),
			}));

			return res.status(300).json({
				message: "Multiple accounts found. Please select which account to reset.",
				requiresAccountSelection: true,
				accountOptions,
			});
		}

		// Find the user to reset
		let user;
		if (usersWithEmail.length === 1) {
			user = usersWithEmail[0];
		} else {
			user = usersWithEmail.find((u) => matchesAccountType(u, accountType));
			if (!user) {
				return res.status(400).json({ error: "Invalid account type selected" });
			}
		}

		// Generate a temporary password (12 characters)
		const temporaryPassword = crypto.randomBytes(6).toString("hex");

		// Hash the temporary password
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

		// Update user's password
		await user.update({ password: hashedPassword });

		// Send password reset email (use the plain email from request, not encrypted)
		await Email.sendPasswordReset(email, user.username, temporaryPassword);
		console.log(`✅ Password reset email sent for ${user.username}`);

		// Send push notification if user has a stored token
		if (user.expoPushToken) {
			await PushNotification.sendPushPasswordReset(user.expoPushToken, user.username);
		}

		return res.status(200).json({
			message: "If an account with that email exists, we've sent password reset instructions to it."
		});
	} catch (error) {
		console.error("Error in forgot password:", error);
		return res.status(500).json({ error: "Failed to process request. Please try again." });
	}
});

module.exports = sessionRouter;
