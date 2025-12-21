/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
const express = require("express");
const passport = require("passport");
const { User, TermsAndConditions } = require("../../../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const UserSerializer = require("../../../serializers/userSerializer");
const authenticateToken = require("../../../middleware/authenticatedToken");
const Email = require("../../../services/sendNotifications/EmailClass");

const sessionRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

sessionRouter.post("/", passport.authenticate("local"), async (req, res) => {
	try {
		const user = await User.findOne({ where: { id: req.user.id } });
		res.status(201).json(user);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Internal server error" });
	}
});

sessionRouter.post("/login", async (req, res) => {
	const { username, password } = req.body;

	try {
		const user = await User.findOne({ where: { username } });
		if (user) {
			const passwordMatch = await bcrypt.compare(password, user.password);
			if (passwordMatch) {
				req.login(user, async (err) => {
					if (err) {
						console.error(err);
						res.status(500).json({ message: "Internal server error" });
					} else {
						const serializedUser = UserSerializer.login(user);
						const token = jwt.sign({ userId: user.id }, secretKey);

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

						return res.status(201).json({
							user: serializedUser,
							token: token,
							requiresTermsAcceptance,
							terms: termsData,
						});
					}
				});
			} else {
				res.status(401).json({ error: "Invalid password" });
			}
		} else {
			res.status(404).json({ error: "No Username" });
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
		const serializedUser = UserSerializer.serializeOne(user);
		const token = jwt.sign({ userId: user.id }, secretKey);
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

// POST: Forgot Username - sends username to email
sessionRouter.post("/forgot-username", async (req, res) => {
	const { email } = req.body;

	if (!email) {
		return res.status(400).json({ error: "Email is required" });
	}

	try {
		const user = await User.findOne({ where: { email } });

		if (!user) {
			// Return success even if user not found for security (don't reveal if email exists)
			return res.status(200).json({
				message: "If an account with that email exists, we've sent the username to it."
			});
		}

		// Send username recovery email
		await Email.sendUsernameRecovery(email, user.username);
		console.log(`✅ Username recovery email sent to ${email}`);

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
	const { email } = req.body;

	if (!email) {
		return res.status(400).json({ error: "Email is required" });
	}

	try {
		const user = await User.findOne({ where: { email } });

		if (!user) {
			// Return success even if user not found for security
			return res.status(200).json({
				message: "If an account with that email exists, we've sent password reset instructions to it."
			});
		}

		// Generate a temporary password (12 characters)
		const temporaryPassword = crypto.randomBytes(6).toString("hex");

		// Hash the temporary password
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

		// Update user's password
		await user.update({ password: hashedPassword });

		// Send password reset email
		await Email.sendPasswordReset(email, user.username, temporaryPassword);
		console.log(`✅ Password reset email sent to ${email}`);

		return res.status(200).json({
			message: "If an account with that email exists, we've sent password reset instructions to it."
		});
	} catch (error) {
		console.error("Error in forgot password:", error);
		return res.status(500).json({ error: "Failed to process request. Please try again." });
	}
});

module.exports = sessionRouter;
