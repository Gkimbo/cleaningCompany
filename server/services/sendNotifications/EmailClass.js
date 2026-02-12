const nodemailer = require("nodemailer");
const { User } = require("../../models");

// Reusable email template helper
const createEmailTemplate = ({
  title,
  subtitle,
  greeting,
  content,
  infoBox = null,
  steps = null,
  warningBox = null,
  ctaText = null,
  footerMessage = "Thank you for using Kleanr!",
  headerColor = "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
}) => {
  const infoBoxHtml = infoBox ? `
    <div style="background-color: #f0fdfa; border: 2px solid #14b8a6; border-radius: 12px; padding: 25px; margin: 25px 0;">
      <h3 style="color: #0d9488; margin: 0 0 15px 0; font-size: 18px;">
        ${infoBox.icon || "📋"} ${infoBox.title}
      </h3>
      ${infoBox.items.map(item => `
        <div style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="color: #64748b; font-size: 14px;">${item.label}:</span>
          <span style="color: #1e293b; font-size: 15px; font-weight: 600; margin-left: 8px;">${item.value}</span>
        </div>
      `).join("")}
    </div>
  ` : "";

  const stepsHtml = steps ? `
    <h3 style="color: #1e293b; margin: 30px 0 15px 0; font-size: 18px;">${steps.title}</h3>
    <ol style="color: #475569; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
      ${steps.items.map(step => `<li style="margin-bottom: 8px;">${step}</li>`).join("")}
    </ol>
  ` : "";

  const warningBoxHtml = warningBox ? `
    <div style="background-color: ${warningBox.bgColor || "#fef3c7"}; border-left: 4px solid ${warningBox.borderColor || "#f59e0b"}; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
      <p style="color: ${warningBox.textColor || "#92400e"}; font-size: 14px; margin: 0; font-weight: 500;">
        ${warningBox.icon || "⚠️"} ${warningBox.text}
      </p>
    </div>
  ` : "";

  const ctaHtml = ctaText ? `
    <div style="text-align: center; margin: 30px 0;">
      <p style="color: #475569; font-size: 15px; margin: 0;">
        ${ctaText}
      </p>
    </div>
  ` : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background: ${headerColor}; padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">${title}</h1>
        ${subtitle ? `<p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${subtitle}</p>` : ""}
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">${greeting}</h2>
        <div style="color: #475569; font-size: 16px; line-height: 1.6;">
          ${content}
        </div>
        ${infoBoxHtml}
        ${stepsHtml}
        ${warningBoxHtml}
        ${ctaHtml}
      </td>
    </tr>
    <tr>
      <td style="background-color: #1e293b; padding: 30px; text-align: center;">
        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px 0;">
          ${footerMessage} 🧹✨
        </p>
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Kleanr. All rights reserved.
        </p>
        <p style="color: #64748b; font-size: 11px; margin: 15px 0 0 0;">
          This is an automated message. Please do not reply directly to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
};

// Create transporter helper
const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Resolve recipient email for demo account redirection
 * When in preview mode, demo account emails are redirected to the owner's email
 * @param {string} email - The original recipient email
 * @returns {Promise<{email: string, isRedirected: boolean, originalEmail: string|null}>}
 */
const resolveRecipientEmail = async (email) => {
  try {
    // Find if this email belongs to a demo account with an active preview owner
    const demoAccount = await User.findOne({
      where: {
        email: email,
        isDemoAccount: true,
      },
    });

    if (demoAccount && demoAccount.currentPreviewOwnerId) {
      // This is a demo account being previewed - redirect to owner's email
      const owner = await User.findByPk(demoAccount.currentPreviewOwnerId);
      if (owner && owner.email) {
        console.log(`[Email] Redirecting demo account email from ${email} to owner ${owner.email}`);
        return {
          email: owner.email,
          isRedirected: true,
          originalEmail: email,
        };
      }
    }

    // Not a demo account or no active preview - use original email
    return {
      email: email,
      isRedirected: false,
      originalEmail: null,
    };
  } catch (error) {
    console.error("[Email] Error resolving recipient email:", error);
    // On error, fall back to original email
    return {
      email: email,
      isRedirected: false,
      originalEmail: null,
    };
  }
};

/**
 * Send email with demo account redirection support
 * Automatically redirects emails to demo accounts to the previewing owner
 * @param {Object} transporter - Nodemailer transporter
 * @param {Object} mailOptions - Mail options with 'to' field
 * @returns {Promise<Object>} Nodemailer send result
 */
const sendMailWithResolution = async (transporter, mailOptions) => {
  // Resolve the recipient email (handles demo account redirection)
  const resolved = await resolveRecipientEmail(mailOptions.to);

  // Update mail options with resolved email
  const resolvedMailOptions = {
    ...mailOptions,
    to: resolved.email,
  };

  // If redirected, add a note to the subject line
  if (resolved.isRedirected) {
    resolvedMailOptions.subject = `[DEMO: ${resolved.originalEmail}] ${mailOptions.subject}`;
  }

  return transporter.sendMail(resolvedMailOptions);
};

// Format date helper
const formatDate = (dateString) => {
  const options = {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

class Email {
  static async sendEmailCancellation(
    email,
    address,
    userName,
    appointmentDate
  ) {
    try {
      const transporter = createTransporter();
      const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zipcode}`;

      const htmlContent = createEmailTemplate({
        title: "Appointment Cancelled",
        subtitle: "Your cleaner has cancelled",
        headerColor: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
        greeting: `Hi ${userName},`,
        content: `<p>We regret to inform you that your scheduled cleaning appointment has been cancelled by the assigned cleaner.</p>
          <p>We sincerely apologize for any inconvenience this may cause.</p>`,
        infoBox: {
          icon: "📍",
          title: "Cancelled Appointment Details",
          items: [
            { label: "Address", value: fullAddress },
            { label: "Date", value: formatDate(appointmentDate) },
          ],
        },
        warningBox: {
          icon: "ℹ️",
          text: "<strong>Good News:</strong> Your appointment is still available for other cleaners to select. You will receive another email when a new cleaner confirms your appointment.",
          bgColor: "#dbeafe",
          borderColor: "#3b82f6",
          textColor: "#1e40af",
        },
        ctaText: "Log into the Kleanr app to view your appointment status.",
        footerMessage: "We appreciate your patience",
      });

      const textContent = `Hi ${userName},

We regret to inform you that your scheduled cleaning appointment has been cancelled.

CANCELLED APPOINTMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Address: ${fullAddress}
Date: ${formatDate(appointmentDate)}

Good News: Your appointment is still available for other cleaners to select. You will receive another email when a new cleaner confirms your appointment.

Log into the Kleanr app to view your appointment status.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `⚠️ Appointment Cancelled - ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Cancellation email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending cancellation email:", error);
    }
  }
  static async sendEmailConfirmation(
    email,
    address,
    userName,
    appointmentDate
  ) {
    try {
      const transporter = createTransporter();
      const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zipcode}`;

      const htmlContent = createEmailTemplate({
        title: "Appointment Confirmed! ✓",
        subtitle: "Your cleaning is scheduled",
        headerColor: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        greeting: `Great news, ${userName}! 🎉`,
        content: `<p>A cleaner has confirmed your scheduled cleaning appointment. Your home will be sparkling clean soon!</p>`,
        infoBox: {
          icon: "📅",
          title: "Confirmed Appointment Details",
          items: [
            { label: "Address", value: fullAddress },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Status", value: "✅ Confirmed" },
          ],
        },
        steps: {
          title: "📝 What's Next?",
          items: [
            "Make sure the property is accessible on the scheduled date",
            "Secure any valuables or fragile items",
            "Leave any special instructions in the app if needed",
          ],
        },
        ctaText: "Need to make changes? Log into the Kleanr app to manage your appointments.",
        footerMessage: "Thank you for choosing Kleanr",
      });

      const textContent = `Great news, ${userName}! 🎉

A cleaner has confirmed your scheduled cleaning appointment. Your home will be sparkling clean soon!

CONFIRMED APPOINTMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Address: ${fullAddress}
Date: ${formatDate(appointmentDate)}
Status: ✅ Confirmed

WHAT'S NEXT?
━━━━━━━━━━━━━━━━━━━━━━
1. Make sure the property is accessible on the scheduled date
2. Secure any valuables or fragile items
3. Leave any special instructions in the app if needed

Need to make changes? Log into the Kleanr app to manage your appointments.

Thank you for choosing Kleanr!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `✅ Cleaning Confirmed - ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Confirmation email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending confirmation email:", error);
    }
  }

  static async sendEmailCongragulations(
    firstName,
    lastName,
    username,
    password,
    email,
    type,
  ) {
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      // Determine role title and getting started steps based on user type
      let roleTitle;
      let gettingStartedSteps;
      let welcomeSubtitle;

      if (type === "humanResources") {
        roleTitle = "HR Team Member";
        welcomeSubtitle = "You've been hired to join our HR team!";
        gettingStartedSteps = [
          "Open the Kleanr app on your device",
          "Tap <strong>\"Login\"</strong> on the welcome screen",
          "Enter your username and password shown above",
          "You'll be directed to your HR Dashboard",
          "Update your password in Account Settings for security",
        ];
      } else if (type === "owner") {
        roleTitle = "Owner";
        welcomeSubtitle = "You're officially part of the team";
        gettingStartedSteps = [
          "Download the Kleanr app or visit our website",
          "Log in using the credentials above",
          "Update your password in Account Settings",
          "Start managing your cleaning business!",
        ];
      } else {
        roleTitle = "Cleaner";
        welcomeSubtitle = "You're officially part of the team";
        gettingStartedSteps = [
          "Download the Kleanr app or visit our website",
          "Log in using the credentials above",
          "Update your password in Account Settings",
          "Browse available cleaning jobs and start earning!",
        ];
      }

      const stepsHtml = gettingStartedSteps.map(step =>
        `<li style="margin-bottom: 8px;">${step}</li>`
      ).join("");

      const stepsText = gettingStartedSteps.map((step, i) =>
        `${i + 1}. ${step.replace(/<[^>]*>/g, '')}`
      ).join("\n");

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 1px;">Welcome to Kleanr!</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${welcomeSubtitle}</p>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px;">Hi ${firstName}${lastName ? ` ${lastName}` : ""}! 👋</h2>

        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
          🎉 <strong>Congratulations!</strong> You've been hired as a <strong>${roleTitle}</strong> at Kleanr! We're thrilled to have you on board. Your account has been created and you're ready to get started.
        </p>

        <!-- Credentials Box -->
        <div style="background-color: #f0fdfa; border: 2px solid #14b8a6; border-radius: 12px; padding: 25px; margin: 25px 0;">
          <h3 style="color: #0d9488; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
            🔐 Your Login Credentials
          </h3>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: #64748b; font-size: 14px;">Username:</span>
              </td>
              <td style="padding: 8px 0;">
                <span style="color: #1e293b; font-size: 16px; font-weight: 600; font-family: monospace; background-color: #ffffff; padding: 4px 12px; border-radius: 4px; border: 1px solid #e2e8f0;">${username}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: #64748b; font-size: 14px;">Password:</span>
              </td>
              <td style="padding: 8px 0;">
                <span style="color: #1e293b; font-size: 16px; font-weight: 600; font-family: monospace; background-color: #ffffff; padding: 4px 12px; border-radius: 4px; border: 1px solid #e2e8f0;">${password}</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Getting Started Steps -->
        <h3 style="color: #1e293b; margin: 30px 0 15px 0; font-size: 18px;">🚀 How to Log In</h3>
        <ol style="color: #475569; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
          ${stepsHtml}
        </ol>

        <!-- Security Warning -->
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
          <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">
            ⚠️ <strong>Security Tip:</strong> Please change your password after your first login to keep your account secure.
          </p>
        </div>

        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 25px 0 0 0;">
          If you have any questions or need assistance, don't hesitate to reach out through the app. We're here to help!
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #1e293b; padding: 30px; text-align: center;">
        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px 0;">
          Welcome to the Kleanr family! 🧹✨
        </p>
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Kleanr. All rights reserved.
        </p>
        <p style="color: #64748b; font-size: 11px; margin: 15px 0 0 0;">
          This is an automated message. Please do not reply directly to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const textContent = `Welcome to Kleanr!

Hi ${firstName}${lastName ? ` ${lastName}` : ""}!

🎉 CONGRATULATIONS! You've been hired as a ${roleTitle} at Kleanr! We're thrilled to have you on board.

YOUR LOGIN CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━
Username: ${username}
Password: ${password}

HOW TO LOG IN
━━━━━━━━━━━━━━━━━━━━━━
${stepsText}

⚠️ SECURITY TIP: Please change your password after your first login to keep your account secure.

If you have any questions or need assistance, don't hesitate to reach out through the app.

Welcome to the Kleanr family!

Best regards,
Kleanr Support Team

━━━━━━━━━━━━━━━━━━━━━━
This is an automated message. Please do not reply directly to this email.
© ${new Date().getFullYear()} Kleanr. All rights reserved.`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🎉 Congratulations ${firstName}! You've Been Hired at Kleanr`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Welcome email sent successfully:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending welcome email:", error.message);
      throw error; // Re-throw so caller can handle it
    }
  }

  static async sendEmployeeRequest(
    email,
    userName,
    cleanerName,
    cleanerRating,
    appointmentDate
  ) {
    try {
      const transporter = createTransporter();
      const ratingDisplay = cleanerRating !== "No ratings yet" ? `${cleanerRating} ⭐` : "New Cleaner";

      const htmlContent = createEmailTemplate({
        title: "New Cleaning Request",
        subtitle: "A cleaner wants to clean your home",
        headerColor: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
        greeting: `Hi ${userName}! 👋`,
        content: `<p>Great news! A cleaner has requested to clean your home. Review their details below and decide if you'd like to approve them.</p>`,
        infoBox: {
          icon: "👤",
          title: "Cleaner Details",
          items: [
            { label: "Name", value: cleanerName },
            { label: "Rating", value: ratingDisplay },
            { label: "Requested Date", value: formatDate(appointmentDate) },
          ],
        },
        steps: {
          title: "⚡ Quick Actions",
          items: [
            "Log into the Kleanr app",
            "Go to your pending requests",
            "Review and approve or decline the request",
          ],
        },
        ctaText: "Please respond to this request in the app at your earliest convenience.",
        footerMessage: "Your home deserves the best",
      });

      const textContent = `Hi ${userName}!

Great news! A cleaner has requested to clean your home.

CLEANER DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Name: ${cleanerName}
Rating: ${ratingDisplay}
Requested Date: ${formatDate(appointmentDate)}

QUICK ACTIONS
━━━━━━━━━━━━━━━━━━━━━━
1. Log into the Kleanr app
2. Go to your pending requests
3. Review and approve or decline the request

Please respond to this request at your earliest convenience.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🧹 ${cleanerName} wants to clean your home!`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Employee request email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending employee request email:", error);
    }
  }

  static async removeRequestEmail(
    email,
    userName,
    appointmentDate
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Request Withdrawn",
        subtitle: "A cleaner has cancelled their request",
        headerColor: "linear-gradient(135deg, #64748b 0%, #94a3b8 100%)",
        greeting: `Hi ${userName},`,
        content: `<p>A cleaner has withdrawn their request to clean your home on <strong>${formatDate(appointmentDate)}</strong>.</p>
          <p>You don't need to take any action at this time. Your appointment is still open for other cleaners to request.</p>`,
        warningBox: {
          icon: "ℹ️",
          text: "No action required on your part. We'll notify you when another cleaner requests this appointment.",
          bgColor: "#f1f5f9",
          borderColor: "#94a3b8",
          textColor: "#475569",
        },
        footerMessage: "Thank you for using Kleanr",
      });

      const textContent = `Hi ${userName},

A cleaner has withdrawn their request to clean your home on ${formatDate(appointmentDate)}.

You don't need to take any action at this time. Your appointment is still open for other cleaners to request.

We'll notify you when another cleaner requests this appointment.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `ℹ️ Cleaning Request Withdrawn - ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Request removal email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending request removal email:", error);
    }
  }

  static async sendNewMessageNotification(email, userName, senderName, messagePreview) {
    try {
      const transporter = createTransporter();
      const truncatedMessage = messagePreview.length > 100
        ? messagePreview.substring(0, 100) + '...'
        : messagePreview;

      const htmlContent = createEmailTemplate({
        title: "New Message",
        subtitle: `From ${senderName}`,
        headerColor: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)",
        greeting: `Hi ${userName}! 💬`,
        content: `<p>You have a new message waiting for you in the Kleanr app.</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #0ea5e9; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase;">Message Preview</p>
            <p style="color: #1e293b; font-size: 15px; margin: 0; font-style: italic;">"${truncatedMessage}"</p>
          </div>`,
        ctaText: "Log into the Kleanr app to view and respond to this message.",
        footerMessage: "Stay connected with Kleanr",
      });

      const textContent = `Hi ${userName}!

You have a new message from ${senderName}:

"${truncatedMessage}"

Log into the Kleanr app to view and respond to this message.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `💬 New message from ${senderName}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Message notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending message notification email:", error);
    }
  }

  static async sendBroadcastNotification(email, userName, title, broadcastContent) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: title,
        subtitle: "Important announcement from Kleanr",
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        greeting: `Hi ${userName}! 📢`,
        content: `<p>${broadcastContent}</p>`,
        ctaText: "Log into the Kleanr app for more details.",
        footerMessage: "Kleanr Team",
      });

      const textContent = `Hi ${userName}!

${title}
━━━━━━━━━━━━━━━━━━━━━━

${broadcastContent}

Log into the Kleanr app for more details.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `📢 ${title}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Broadcast email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending broadcast email:", error);
    }
  }

  static async sendUsernameRecovery(email, username) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Username Recovery",
        subtitle: "Here's your account information",
        headerColor: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
        greeting: "Hello! 🔑",
        content: `<p>You requested to recover your username for your Kleanr account. Here it is:</p>`,
        infoBox: {
          icon: "👤",
          title: "Your Account",
          items: [
            { label: "Username", value: `<strong style="font-family: monospace; font-size: 18px;">${username}</strong>` },
          ],
        },
        warningBox: {
          icon: "🔒",
          text: "If you did not request this information, you can safely ignore this email. Your account is secure.",
          bgColor: "#f1f5f9",
          borderColor: "#94a3b8",
          textColor: "#475569",
        },
        ctaText: "You can now log into the Kleanr app with your username.",
        footerMessage: "Account security is our priority",
      });

      const textContent = `Hello!

You requested to recover your username for your Kleanr account.

YOUR USERNAME
━━━━━━━━━━━━━━━━━━━━━━
${username}

If you did not request this information, you can safely ignore this email. Your account is secure.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "🔑 Your Kleanr Username",
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Username recovery email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending username recovery email:", error);
      throw error;
    }
  }

  static async sendPasswordReset(email, username, temporaryPassword) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Password Reset",
        subtitle: "Your temporary password is ready",
        headerColor: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
        greeting: `Hi ${username}! 🔐`,
        content: `<p>You requested to reset your password for your Kleanr account. Here's your temporary password:</p>`,
        infoBox: {
          icon: "🔑",
          title: "Temporary Password",
          items: [
            { label: "Password", value: `<strong style="font-family: monospace; font-size: 18px; letter-spacing: 2px;">${temporaryPassword}</strong>` },
          ],
        },
        warningBox: {
          icon: "⚠️",
          text: "<strong>Important:</strong> Please log in with this temporary password and change it immediately in your Account Settings for security.",
        },
        steps: {
          title: "🔒 Secure Your Account",
          items: [
            "Log in with the temporary password above",
            "Go to Account Settings",
            "Change your password to something secure",
          ],
        },
        ctaText: "If you did not request this password reset, please contact support immediately.",
        footerMessage: "Your security is our priority",
      });

      const textContent = `Hi ${username}!

You requested to reset your password for your Kleanr account.

TEMPORARY PASSWORD
━━━━━━━━━━━━━━━━━━━━━━
${temporaryPassword}

⚠️ IMPORTANT: Please log in with this temporary password and change it immediately in your Account Settings for security.

SECURE YOUR ACCOUNT
━━━━━━━━━━━━━━━━━━━━━━
1. Log in with the temporary password above
2. Go to Account Settings
3. Change your password to something secure

If you did not request this password reset, please contact support immediately.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "🔐 Password Reset - Temporary Password",
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Password reset email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending password reset email:", error);
      throw error;
    }
  }

  static async sendRequestApproved(email, cleanerName, homeownerName, address, appointmentDate, linensConfig = {}) {
    try {
      const transporter = createTransporter();
      // Only show city, state, and zip code - full address shown in app on day of appointment
      const locationInfo = `${address.city}, ${address.state} ${address.zipcode}`;

      // Build linens section if cleaner needs to bring sheets/towels
      const { bringSheets, bringTowels, sheetConfigurations, towelConfigurations } = linensConfig;
      const needsLinens = bringSheets === "yes" || bringTowels === "yes";

      let linensHtml = "";
      let linensText = "";

      if (needsLinens) {
        linensHtml = `<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <div style="font-size: 16px; font-weight: bold; color: #92400e; margin-bottom: 12px;">⚠️ Linens You Need to Bring</div>`;
        linensText = "\n\nLINENS YOU NEED TO BRING\n━━━━━━━━━━━━━━━━━━━━━━\n";

        if (bringSheets === "yes") {
          linensHtml += `<div style="margin-bottom: 12px;">
            <div style="font-weight: 600; color: #78350f; margin-bottom: 6px;">🛏️ Sheets:</div>`;
          linensText += "SHEETS:\n";

          if (sheetConfigurations && sheetConfigurations.length > 0) {
            sheetConfigurations.filter(bed => bed.needsSheets !== false).forEach(bed => {
              const size = bed.size ? bed.size.charAt(0).toUpperCase() + bed.size.slice(1) : "Standard";
              linensHtml += `<div style="color: #78350f; padding-left: 16px;">• Bed ${bed.bedNumber}: ${size} sheets</div>`;
              linensText += `  • Bed ${bed.bedNumber}: ${size} sheets\n`;
            });
          } else {
            linensHtml += `<div style="color: #78350f; padding-left: 16px;">• Sheets needed (check app for details)</div>`;
            linensText += "  • Sheets needed (check app for details)\n";
          }
          linensHtml += "</div>";
        }

        if (bringTowels === "yes") {
          linensHtml += `<div style="margin-bottom: 8px;">
            <div style="font-weight: 600; color: #78350f; margin-bottom: 6px;">🛁 Towels:</div>`;
          linensText += "TOWELS:\n";

          if (towelConfigurations && towelConfigurations.length > 0) {
            let totalTowels = 0;
            let totalWashcloths = 0;
            towelConfigurations.forEach(bath => {
              const towels = bath.towels || 0;
              const washcloths = bath.faceCloths || 0;
              totalTowels += towels;
              totalWashcloths += washcloths;
              linensHtml += `<div style="color: #78350f; padding-left: 16px;">• Bathroom ${bath.bathroomNumber}: ${towels} towel${towels !== 1 ? 's' : ''}, ${washcloths} washcloth${washcloths !== 1 ? 's' : ''}</div>`;
              linensText += `  • Bathroom ${bath.bathroomNumber}: ${towels} towel${towels !== 1 ? 's' : ''}, ${washcloths} washcloth${washcloths !== 1 ? 's' : ''}\n`;
            });
            linensHtml += `<div style="color: #78350f; padding-left: 16px; font-weight: 600; margin-top: 6px;">Total: ${totalTowels} towels, ${totalWashcloths} washcloths</div>`;
            linensText += `  Total: ${totalTowels} towels, ${totalWashcloths} washcloths\n`;
          } else {
            linensHtml += `<div style="color: #78350f; padding-left: 16px;">• Towels needed (check app for details)</div>`;
            linensText += "  • Towels needed (check app for details)\n";
          }
          linensHtml += "</div>";
        }

        linensHtml += "</div>";
      } else {
        linensHtml = `<div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 12px; padding: 16px; margin: 20px 0; border-left: 4px solid #10b981;">
          <div style="color: #065f46;"><span style="font-weight: 600;">✓ Linens Provided:</span> Sheets and towels will be provided at the home</div>
        </div>`;
        linensText = "\n\n✓ LINENS PROVIDED: Sheets and towels will be provided at the home\n";
      }

      const htmlContent = createEmailTemplate({
        title: "Request Approved! 🎉",
        subtitle: "You've got a cleaning job",
        headerColor: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        greeting: `Congratulations, ${cleanerName}! 🎊`,
        content: `<p>Great news! <strong>${homeownerName}</strong> has approved your request to clean their home. You're all set for your upcoming appointment!</p>${linensHtml}`,
        infoBox: {
          icon: "📍",
          title: "Appointment Details",
          items: [
            { label: "Homeowner", value: homeownerName },
            { label: "Location", value: locationInfo },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Status", value: "✅ Approved" },
          ],
        },
        tipBox: {
          icon: "📱",
          text: "The full address will be available in the app on the day of your appointment.",
        },
        steps: {
          title: "📋 Before Your Appointment",
          items: [
            "Review the appointment details in the app",
            "Plan your route to the location",
            "Prepare all necessary cleaning supplies",
            "Arrive on time and do your best work!",
          ],
        },
        footerMessage: "Thank you for being part of Kleanr",
      });

      const textContent = `Congratulations, ${cleanerName}! 🎉

Great news! ${homeownerName} has approved your request to clean their home.

APPOINTMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Homeowner: ${homeownerName}
Location: ${locationInfo}
Date: ${formatDate(appointmentDate)}
Status: ✅ Approved
${linensText}
Note: The full address will be available in the app on the day of your appointment.

BEFORE YOUR APPOINTMENT
━━━━━━━━━━━━━━━━━━━━━━
1. Review the appointment details in the app
2. Plan your route to the location
3. Prepare all necessary cleaning supplies
4. Arrive on time and do your best work!

Thank you for being part of Kleanr!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🎉 Request Approved - Cleaning on ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Request approved email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending request approved email:", error);
    }
  }

  static async sendLinensConfigurationUpdated(email, cleanerName, homeownerName, appointmentDate, payout, linensConfig = {}) {
    try {
      const transporter = createTransporter();
      const { bringSheets, bringTowels, sheetConfigurations, towelConfigurations, previousBringSheets, previousBringTowels } = linensConfig;
      const needsLinens = bringSheets === "yes" || bringTowels === "yes";

      // Check what was removed
      const sheetsRemoved = previousBringSheets === "yes" && bringSheets !== "yes";
      const towelsRemoved = previousBringTowels === "yes" && bringTowels !== "yes";
      const somethingRemoved = sheetsRemoved || towelsRemoved;

      let linensHtml = "";
      let linensText = "";

      // Show removed items first (good news!)
      if (somethingRemoved) {
        linensHtml += `<div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 12px; padding: 16px; margin: 20px 0; border-left: 4px solid #10b981;">
          <div style="font-size: 16px; font-weight: bold; color: #065f46; margin-bottom: 8px;">✓ Good News!</div>`;
        linensText += "\n\n✓ GOOD NEWS!\n━━━━━━━━━━━━━━━━━━━━━━\n";

        if (sheetsRemoved) {
          linensHtml += `<div style="color: #065f46; padding-left: 8px;">• You no longer need to bring sheets - they will be provided</div>`;
          linensText += "• You no longer need to bring sheets - they will be provided\n";
        }
        if (towelsRemoved) {
          linensHtml += `<div style="color: #065f46; padding-left: 8px;">• You no longer need to bring towels - they will be provided</div>`;
          linensText += "• You no longer need to bring towels - they will be provided\n";
        }
        linensHtml += "</div>";
      }

      // Show current requirements if any linens are still needed
      if (needsLinens) {
        linensHtml += `<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <div style="font-size: 16px; font-weight: bold; color: #92400e; margin-bottom: 12px;">🛏️ ${somethingRemoved ? 'Still Required' : 'Updated Linens Requirements'}</div>`;
        linensText += `\n\n${somethingRemoved ? 'STILL REQUIRED' : 'UPDATED LINENS REQUIREMENTS'}\n━━━━━━━━━━━━━━━━━━━━━━\n`;

        if (bringSheets === "yes") {
          linensHtml += `<div style="margin-bottom: 12px;">
            <div style="font-weight: 600; color: #78350f; margin-bottom: 6px;">Sheets:</div>`;
          linensText += "SHEETS:\n";

          if (sheetConfigurations && sheetConfigurations.length > 0) {
            sheetConfigurations.filter(bed => bed.needsSheets !== false).forEach(bed => {
              const size = bed.size ? bed.size.charAt(0).toUpperCase() + bed.size.slice(1) : "Standard";
              linensHtml += `<div style="color: #78350f; padding-left: 16px;">• Bed ${bed.bedNumber}: ${size} sheets</div>`;
              linensText += `  • Bed ${bed.bedNumber}: ${size} sheets\n`;
            });
          } else {
            linensHtml += `<div style="color: #78350f; padding-left: 16px;">• Sheets needed (check app for details)</div>`;
            linensText += "  • Sheets needed (check app for details)\n";
          }
          linensHtml += "</div>";
        }

        if (bringTowels === "yes") {
          linensHtml += `<div style="margin-bottom: 8px;">
            <div style="font-weight: 600; color: #78350f; margin-bottom: 6px;">Towels:</div>`;
          linensText += "TOWELS:\n";

          if (towelConfigurations && towelConfigurations.length > 0) {
            let totalTowels = 0;
            let totalWashcloths = 0;
            towelConfigurations.forEach(bath => {
              const towels = bath.towels || 0;
              const washcloths = bath.faceCloths || 0;
              totalTowels += towels;
              totalWashcloths += washcloths;
              linensHtml += `<div style="color: #78350f; padding-left: 16px;">• Bathroom ${bath.bathroomNumber}: ${towels} towel${towels !== 1 ? 's' : ''}, ${washcloths} washcloth${washcloths !== 1 ? 's' : ''}</div>`;
              linensText += `  • Bathroom ${bath.bathroomNumber}: ${towels} towel${towels !== 1 ? 's' : ''}, ${washcloths} washcloth${washcloths !== 1 ? 's' : ''}\n`;
            });
            linensHtml += `<div style="color: #78350f; padding-left: 16px; font-weight: 600; margin-top: 6px;">Total: ${totalTowels} towels, ${totalWashcloths} washcloths</div>`;
            linensText += `  Total: ${totalTowels} towels, ${totalWashcloths} washcloths\n`;
          } else {
            linensHtml += `<div style="color: #78350f; padding-left: 16px;">• Towels needed (check app for details)</div>`;
            linensText += "  • Towels needed (check app for details)\n";
          }
          linensHtml += "</div>";
        }

        linensHtml += "</div>";
      } else if (!somethingRemoved) {
        // Only show this if we haven't already shown the "removed" message
        linensHtml = `<div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 12px; padding: 16px; margin: 20px 0; border-left: 4px solid #10b981;">
          <div style="color: #065f46;"><span style="font-weight: 600;">✓ Updated:</span> Sheets and towels will now be provided at the home - you don't need to bring any!</div>
        </div>`;
        linensText = "\n\n✓ UPDATED: Sheets and towels will now be provided at the home - you don't need to bring any!\n";
      }

      const payoutFormatted = typeof payout === 'number' ? `$${payout.toFixed(2)}` : payout;

      const htmlContent = createEmailTemplate({
        title: "Appointment Update 📝",
        subtitle: "Linens requirements have changed",
        headerColor: "linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)",
        greeting: `Hi ${cleanerName},`,
        content: `<p>The homeowner <strong>${homeownerName}</strong> has updated the sheets and towels requirements for your upcoming appointment on <strong>${formatDate(appointmentDate)}</strong>.</p>${linensHtml}`,
        infoBox: {
          icon: "💰",
          title: "Updated Appointment Info",
          items: [
            { label: "Your Payout", value: payoutFormatted },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Status", value: "✅ Still Confirmed" },
          ],
        },
        tipBox: {
          icon: "📱",
          text: "Open the app to see the full updated details for this appointment.",
        },
        footerMessage: "Thank you for being part of Kleanr",
      });

      const textContent = `Hi ${cleanerName},

The homeowner ${homeownerName} has updated the sheets and towels requirements for your upcoming appointment.

UPDATED APPOINTMENT INFO
━━━━━━━━━━━━━━━━━━━━━━
Your Payout: ${payoutFormatted}
Date: ${formatDate(appointmentDate)}
Status: ✅ Still Confirmed
${linensText}
Open the app to see the full updated details for this appointment.

Thank you for being part of Kleanr!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `📝 Appointment Update - Linens changed for ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Linens configuration updated email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending linens configuration updated email:", error);
    }
  }

  static async sendRequestDenied(email, cleanerName, appointmentDate) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Request Update",
        subtitle: "About your cleaning request",
        headerColor: "linear-gradient(135deg, #64748b 0%, #94a3b8 100%)",
        greeting: `Hi ${cleanerName},`,
        content: `<p>We wanted to let you know that your request to clean on <strong>${formatDate(appointmentDate)}</strong> was not approved by the homeowner this time.</p>
          <p>Don't be discouraged – there are plenty of other opportunities waiting for you!</p>`,
        warningBox: {
          icon: "💪",
          text: "<strong>Keep going!</strong> There are plenty of other cleaning opportunities available. Check the app for new jobs in your area.",
          bgColor: "#dbeafe",
          borderColor: "#3b82f6",
          textColor: "#1e40af",
        },
        steps: {
          title: "🔍 Find Your Next Job",
          items: [
            "Open the Kleanr app",
            "Browse available appointments",
            "Request jobs that fit your schedule",
          ],
        },
        footerMessage: "Thank you for being part of Kleanr",
      });

      const textContent = `Hi ${cleanerName},

We wanted to let you know that your request to clean on ${formatDate(appointmentDate)} was not approved by the homeowner this time.

Don't be discouraged – there are plenty of other opportunities waiting for you!

FIND YOUR NEXT JOB
━━━━━━━━━━━━━━━━━━━━━━
1. Open the Kleanr app
2. Browse available appointments
3. Request jobs that fit your schedule

Thank you for being part of Kleanr!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `ℹ️ Request Update - ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Request denied email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending request denied email:", error);
    }
  }

  static async sendHomeNowInServiceArea(email, userName, homeName, homeAddress) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Great News! 🎉",
        subtitle: "Your home is now in our service area",
        headerColor: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        greeting: `Hi ${userName}!`,
        content: `<p>We're excited to let you know that we've expanded our service area, and your home is now covered!</p>`,
        infoBox: {
          icon: "🏠",
          title: "Home Now Available",
          items: [
            { label: "Property", value: homeName },
            { label: "Address", value: homeAddress },
            { label: "Status", value: "✅ In Service Area" },
          ],
        },
        steps: {
          title: "🚀 Get Started",
          items: [
            "Log into the Kleanr app",
            "Select your home from your properties",
            "Schedule your first cleaning!",
          ],
        },
        footerMessage: "Welcome to Kleanr service",
      });

      const textContent = `Hi ${userName}!

Great news! We've expanded our service area, and your home is now covered!

HOME NOW AVAILABLE
━━━━━━━━━━━━━━━━━━━━━━
Property: ${homeName}
Address: ${homeAddress}
Status: ✅ In Service Area

GET STARTED
━━━━━━━━━━━━━━━━━━━━━━
1. Log into the Kleanr app
2. Select your home from your properties
3. Schedule your first cleaning!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🎉 Great News - ${homeName} is Now in Our Service Area!`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Home in service area email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending service area email:", error);
    }
  }

  static async sendHomeNowOutsideServiceArea(email, userName, homeName, homeAddress) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Service Area Update",
        subtitle: "Important information about your home",
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        greeting: `Hi ${userName},`,
        content: `<p>We wanted to let you know about a change to our service coverage that affects one of your properties.</p>`,
        infoBox: {
          icon: "🏠",
          title: "Property Affected",
          items: [
            { label: "Property", value: homeName },
            { label: "Address", value: homeAddress },
            { label: "Status", value: "⚠️ Outside Service Area" },
          ],
        },
        warningBox: {
          icon: "ℹ️",
          text: "Your home will remain saved in your profile. Any existing confirmed appointments will still be honored. We'll notify you as soon as service becomes available again in your area.",
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        },
        ctaText: "We apologize for any inconvenience and are working hard to expand our coverage.",
        footerMessage: "We appreciate your patience",
      });

      const textContent = `Hi ${userName},

We wanted to let you know about a change to our service coverage.

PROPERTY AFFECTED
━━━━━━━━━━━━━━━━━━━━━━
Property: ${homeName}
Address: ${homeAddress}
Status: ⚠️ Outside Service Area

Your home will remain saved in your profile. Any existing confirmed appointments will still be honored.

We'll notify you as soon as service becomes available again in your area.

We apologize for any inconvenience and are working hard to expand our coverage.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `ℹ️ Service Area Update - ${homeName}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Home outside service area email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending service area email:", error);
    }
  }

  static async sendNewApplicationNotification(ownerEmail, applicantName, applicantEmail, experience) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "New Application",
        subtitle: "A cleaner wants to join the team",
        headerColor: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
        greeting: "Hello Owner! 📋",
        content: `<p>A new cleaner application has been submitted and is ready for your review.</p>`,
        infoBox: {
          icon: "👤",
          title: "Applicant Details",
          items: [
            { label: "Name", value: applicantName },
            { label: "Email", value: applicantEmail },
            { label: "Experience", value: experience || "Not specified" },
          ],
        },
        steps: {
          title: "📝 Next Steps",
          items: [
            "Log into the Kleanr owner dashboard",
            "Go to the Applications section",
            "Review the full application details",
            "Approve or decline the application",
          ],
        },
        ctaText: "Please review this application at your earliest convenience.",
        footerMessage: "Kleanr Management",
      });

      const textContent = `Hello Owner!

A new cleaner application has been submitted and is ready for your review.

APPLICANT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Name: ${applicantName}
Email: ${applicantEmail}
Experience: ${experience || "Not specified"}

NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━
1. Log into the Kleanr owner dashboard
2. Go to the Applications section
3. Review the full application details
4. Approve or decline the application

Please review this application at your earliest convenience.

Best regards,
Kleanr System`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: ownerEmail,
        subject: `📋 New Cleaner Application - ${applicantName}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ New application notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending new application notification email:", error);
    }
  }

  static async sendUnassignedAppointmentWarning(
    email,
    address,
    userName,
    appointmentDate
  ) {
    try {
      const transporter = createTransporter();
      const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zipcode}`;

      const htmlContent = createEmailTemplate({
        title: "Appointment Notice",
        subtitle: "No cleaner assigned yet",
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        greeting: `Hi ${userName},`,
        content: `<p>Your upcoming cleaning appointment is in <strong>3 days</strong> and has not yet been assigned to a cleaner.</p>`,
        infoBox: {
          icon: "📅",
          title: "Appointment Details",
          items: [
            { label: "Address", value: fullAddress },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Status", value: "⏳ Awaiting Cleaner" },
          ],
        },
        warningBox: {
          icon: "💡",
          text: "<strong>Don't worry!</strong> Cleaners are still able to pick up your appointment. Many cleaners select jobs closer to the date. However, we recommend having a backup plan just in case.",
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        },
        steps: {
          title: "📝 What You Can Do",
          items: [
            "Wait a bit longer - cleaners often pick up jobs at the last minute",
            "Check the app for any status updates",
            "Consider having a backup cleaning plan ready",
          ],
        },
        ctaText: "Log into the Kleanr app to view your appointment status or make changes.",
        footerMessage: "We're working to find you a cleaner",
      });

      const textContent = `Hi ${userName},

Your upcoming cleaning appointment is in 3 days and has not yet been assigned to a cleaner.

APPOINTMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Address: ${fullAddress}
Date: ${formatDate(appointmentDate)}
Status: Awaiting Cleaner

Don't worry! Cleaners are still able to pick up your appointment. Many cleaners select jobs closer to the date. However, we recommend having a backup plan just in case.

WHAT YOU CAN DO
━━━━━━━━━━━━━━━━━━━━━━
1. Wait a bit longer - cleaners often pick up jobs at the last minute
2. Check the app for any status updates
3. Consider having a backup cleaning plan ready

Log into the Kleanr app to view your appointment status or make changes.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `⏳ Heads Up - No Cleaner Assigned Yet for ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Unassigned warning email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending unassigned warning email:", error);
    }
  }

  // Home Size Adjustment Emails

  static async sendHomeSizeAdjustmentRequest(
    email,
    userName,
    cleanerName,
    homeAddress,
    adjustment
  ) {
    try {
      const transporter = createTransporter();
      const { originalBeds, originalBaths, reportedBeds, reportedBaths, priceDifference } = adjustment;

      const htmlContent = createEmailTemplate({
        title: "Home Size Discrepancy",
        subtitle: "Action Required",
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        greeting: `Hi ${userName},`,
        content: `<p>Your cleaner, <strong>${cleanerName}</strong>, has reported that your home has a different size than what's currently on file.</p>
          <p>Please review the details below and respond within 24 hours.</p>`,
        infoBox: {
          icon: "🏠",
          title: "Size Comparison",
          items: [
            { label: "Address", value: homeAddress },
            { label: "On File", value: `${originalBeds} bed, ${originalBaths} bath` },
            { label: "Reported", value: `${reportedBeds} bed, ${reportedBaths} bath` },
            { label: "Price Difference", value: priceDifference > 0 ? `+$${priceDifference.toFixed(2)}` : `$${priceDifference.toFixed(2)}` },
          ],
        },
        warningBox: priceDifference > 0 ? {
          icon: "💳",
          text: `If you approve this change, $${priceDifference.toFixed(2)} will be charged to your payment method on file.`,
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        } : null,
        ctaText: "Open the Kleanr app to approve or deny this request.",
        footerMessage: "Please respond within 24 hours",
      });

      const textContent = `Hi ${userName},

Your cleaner, ${cleanerName}, has reported that your home has a different size than what's currently on file.

HOME SIZE COMPARISON
━━━━━━━━━━━━━━━━━━━━━━
Address: ${homeAddress}
On File: ${originalBeds} bed, ${originalBaths} bath
Reported: ${reportedBeds} bed, ${reportedBaths} bath
Price Difference: ${priceDifference > 0 ? '+' : ''}$${priceDifference.toFixed(2)}

${priceDifference > 0 ? `If you approve this change, $${priceDifference.toFixed(2)} will be charged to your payment method.\n\n` : ''}Please respond within 24 hours by opening the Kleanr app.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🏠 Home Size Discrepancy Reported - Action Required`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Home size adjustment request email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending home size adjustment request email:", error);
    }
  }

  static async sendAdjustmentApproved(
    email,
    userName,
    homeAddress,
    newBeds,
    newBaths,
    amountCharged
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Adjustment Approved",
        subtitle: "Home size updated",
        headerColor: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
        greeting: `Hi ${userName},`,
        content: `<p>Great news! The home size adjustment for your cleaning has been approved.</p>
          <p>Your home details have been updated for all future appointments.</p>`,
        infoBox: {
          icon: "✅",
          title: "Updated Home Details",
          items: [
            { label: "Address", value: homeAddress },
            { label: "Updated Size", value: `${newBeds} bed, ${newBaths} bath` },
            ...(amountCharged > 0 ? [{ label: "Amount Charged", value: `$${amountCharged.toFixed(2)}` }] : []),
          ],
        },
        footerMessage: "Thank you for keeping your home details accurate",
      });

      const textContent = `Hi ${userName},

Great news! The home size adjustment for your cleaning has been approved.

UPDATED HOME DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Address: ${homeAddress}
Updated Size: ${newBeds} bed, ${newBaths} bath
${amountCharged > 0 ? `Amount Charged: $${amountCharged.toFixed(2)}\n` : ''}
Your home details have been updated for all future appointments.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `✅ Home Size Adjustment Approved`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Adjustment approved email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending adjustment approved email:", error);
    }
  }

  static async sendAdjustmentNeedsOwnerReview(
    email,
    ownerName,
    request,
    home,
    cleaner,
    homeowner
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Dispute Needs Review",
        subtitle: "Home size adjustment disputed",
        headerColor: "linear-gradient(135deg, #ef4444 0%, #f87171 100%)",
        greeting: `Hi ${ownerName},`,
        content: `<p>A homeowner has denied a cleaner's home size adjustment report. This dispute requires your review and resolution.</p>`,
        infoBox: {
          icon: "⚠️",
          title: "Dispute Details",
          items: [
            { label: "Home Address", value: home.address },
            { label: "Homeowner", value: homeowner.firstName || homeowner.username },
            { label: "Cleaner", value: cleaner.firstName || cleaner.username },
            { label: "On File", value: `${request.originalNumBeds} bed, ${request.originalNumBaths} bath` },
            { label: "Reported", value: `${request.reportedNumBeds} bed, ${request.reportedNumBaths} bath` },
            { label: "Price Difference", value: `$${request.priceDifference}` },
          ],
        },
        warningBox: request.homeownerResponse ? {
          icon: "💬",
          text: `<strong>Homeowner's Reason:</strong> "${request.homeownerResponse}"`,
          bgColor: "#fee2e2",
          borderColor: "#ef4444",
          textColor: "#991b1b",
        } : null,
        ctaText: "Please review this dispute in the Kleanr owner dashboard.",
        footerMessage: "This requires your attention",
      });

      const textContent = `Hi ${ownerName},

A homeowner has denied a cleaner's home size adjustment report. This dispute requires your review.

DISPUTE DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Home Address: ${home.address}
Homeowner: ${homeowner.firstName || homeowner.username}
Cleaner: ${cleaner.firstName || cleaner.username}
On File: ${request.originalNumBeds} bed, ${request.originalNumBaths} bath
Reported: ${request.reportedNumBeds} bed, ${request.reportedNumBaths} bath
Price Difference: $${request.priceDifference}
${request.homeownerResponse ? `\nHomeowner's Reason: "${request.homeownerResponse}"` : ''}

Please review this dispute in the Kleanr owner dashboard.

Best regards,
Kleanr System`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `⚠️ Home Size Dispute Needs Review - Request #${request.id}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Owner review email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending owner review email:", error);
    }
  }

  static async sendAdjustmentResolved(
    email,
    userName,
    resolution,
    finalBeds,
    finalBaths,
    amountCharged,
    ownerNote
  ) {
    try {
      const transporter = createTransporter();
      const isApproved = resolution === "approved";

      const htmlContent = createEmailTemplate({
        title: isApproved ? "Dispute Resolved - Approved" : "Dispute Resolved - Denied",
        subtitle: "Owner has reviewed your case",
        headerColor: isApproved
          ? "linear-gradient(135deg, #10b981 0%, #34d399 100%)"
          : "linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)",
        greeting: `Hi ${userName},`,
        content: isApproved
          ? `<p>A owner has reviewed the home size dispute and approved the adjustment.</p>
             <p>The home details have been updated accordingly.</p>`
          : `<p>A owner has reviewed the home size dispute and has denied the adjustment request.</p>
             <p>The original home details will remain unchanged.</p>`,
        infoBox: isApproved ? {
          icon: "✅",
          title: "Updated Home Details",
          items: [
            { label: "Final Size", value: `${finalBeds} bed, ${finalBaths} bath` },
            ...(amountCharged > 0 ? [{ label: "Amount Charged", value: `$${amountCharged.toFixed(2)}` }] : []),
          ],
        } : null,
        warningBox: ownerNote ? {
          icon: "📝",
          text: `<strong>Owner's Note:</strong> "${ownerNote}"`,
          bgColor: "#f1f5f9",
          borderColor: "#64748b",
          textColor: "#334155",
        } : null,
        footerMessage: "Thank you for your patience",
      });

      const textContent = `Hi ${userName},

A owner has reviewed the home size dispute and has ${isApproved ? 'approved' : 'denied'} the adjustment.

${isApproved ? `UPDATED HOME DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Final Size: ${finalBeds} bed, ${finalBaths} bath
${amountCharged > 0 ? `Amount Charged: $${amountCharged.toFixed(2)}\n` : ''}` : 'The original home details will remain unchanged.'}

${ownerNote ? `Owner's Note: "${ownerNote}"\n` : ''}
Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: isApproved
          ? `✅ Home Size Dispute Resolved - Approved`
          : `📋 Home Size Dispute Resolved - Denied`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Adjustment resolved email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending adjustment resolved email:", error);
    }
  }

  // Email sent to cleaner when homeowner disputes their home size claim
  static async sendAdjustmentDisputedEmail(email, cleanerName, homeAddress, reportedBeds, reportedBaths, disputeReason) {
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const htmlContent = createEmailTemplate({
        title: "Home Size Claim Disputed",
        subtitle: "Homeowner has disputed your adjustment request",
        greeting: `Hi ${cleanerName},`,
        content: `
          <p>The homeowner has disputed your home size adjustment claim. The request has been escalated to an owner for review.</p>
          <p>You'll be notified once a final decision has been made.</p>
        `,
        infoBox: {
          icon: "🏠",
          title: "Claim Details",
          items: [
            { label: "Address", value: homeAddress },
            { label: "Your Reported Size", value: `${reportedBeds} bed, ${reportedBaths} bath` },
          ],
        },
        warningBox: disputeReason ? {
          icon: "📝",
          text: `<strong>Homeowner's Reason:</strong> "${disputeReason}"`,
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        } : null,
        footerMessage: "An owner will review the evidence and make a final decision",
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      });

      const textContent = `Hi ${cleanerName},

The homeowner has disputed your home size adjustment claim.

CLAIM DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Address: ${homeAddress}
Your Reported Size: ${reportedBeds} bed, ${reportedBaths} bath

${disputeReason ? `Homeowner's Reason: "${disputeReason}"\n` : ''}
The request has been escalated to an owner for review. You'll be notified once a final decision has been made.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "⚠️ Your Home Size Claim Has Been Disputed",
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Adjustment disputed email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending adjustment disputed email:", error);
    }
  }

  // Payment failed reminder email
  static async sendPaymentFailedReminder(email, firstName, address, appointmentDate, daysRemaining) {
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const formattedDate = appointmentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      const htmlContent = createEmailTemplate({
        title: "Payment Required",
        subtitle: "Action needed to keep your appointment",
        greeting: `Hi ${firstName},`,
        content: `
          <p>We were unable to process payment for your upcoming cleaning appointment. Please log into the app and retry your payment to avoid cancellation.</p>
        `,
        infoBox: {
          icon: "🏠",
          title: "Appointment Details",
          items: [
            { label: "Date", value: formattedDate },
            { label: "Address", value: `${address.street}, ${address.city}, ${address.state} ${address.zipcode}` },
          ],
        },
        warningBox: {
          icon: "⚠️",
          text: `Your appointment will be automatically cancelled in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} if payment is not completed.`,
          bgColor: "#fef2f2",
          borderColor: "#ef4444",
          textColor: "#991b1b",
        },
        steps: {
          title: "How to Complete Payment:",
          items: [
            "Open the Kleanr app on your phone",
            "Go to your Appointments",
            "Find the appointment and tap \"Retry Payment\"",
            "Complete the payment process",
          ],
        },
        footerMessage: "If you have questions, please contact our support team.",
        headerColor: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `⚠️ Payment Failed - Action Required for ${formattedDate}`,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Payment failed reminder email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending payment failed reminder email:", error);
    }
  }

  // Application rejection email to applicant
  static async sendApplicationRejected(email, firstName, lastName, rejectionReason = null) {
    try {
      const transporter = createTransporter();
      const applicantName = `${firstName}${lastName ? ` ${lastName}` : ""}`;

      const htmlContent = createEmailTemplate({
        title: "Application Update",
        subtitle: "Thank you for your interest in Kleanr",
        headerColor: "linear-gradient(135deg, #64748b 0%, #94a3b8 100%)",
        greeting: `Dear ${applicantName},`,
        content: `<p>Thank you for taking the time to apply for a cleaner position with Kleanr. We appreciate your interest in joining our team.</p>
          <p>After careful consideration, we have decided not to move forward with your application at this time.</p>
          ${rejectionReason ? `<p><strong>Feedback:</strong> ${rejectionReason}</p>` : ""}
          <p>We encourage you to continue developing your skills and experience, and you're welcome to reapply in the future.</p>`,
        warningBox: {
          icon: "💡",
          text: "This decision does not reflect on your abilities or potential. We receive many qualified applications and making these decisions is never easy.",
          bgColor: "#f1f5f9",
          borderColor: "#94a3b8",
          textColor: "#475569",
        },
        ctaText: "We wish you the best in your job search and future endeavors.",
        footerMessage: "Thank you for considering Kleanr",
      });

      const textContent = `Dear ${applicantName},

Thank you for taking the time to apply for a cleaner position with Kleanr. We appreciate your interest in joining our team.

After careful consideration, we have decided not to move forward with your application at this time.
${rejectionReason ? `\nFeedback: ${rejectionReason}\n` : ""}
We encourage you to continue developing your skills and experience, and you're welcome to reapply in the future.

This decision does not reflect on your abilities or potential. We receive many qualified applications and making these decisions is never easy.

We wish you the best in your job search and future endeavors.

Best regards,
Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Application Update - Kleanr",
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Application rejection email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending application rejection email:", error);
    }
  }

  // Notify cleaner when homeowner cancels their appointment
  static async sendHomeownerCancelledNotification(
    email,
    cleanerName,
    appointmentDate,
    homeAddress,
    willBePaid = false,
    paymentAmount = null
  ) {
    try {
      const transporter = createTransporter();

      // Build content based on whether cleaner will be paid
      const paymentInfo = willBePaid && paymentAmount
        ? `<p style="margin-top: 15px;"><strong>Good news!</strong> Since this cancellation was within 3 days of the scheduled cleaning, you will still receive a partial payment of <strong>$${paymentAmount}</strong> for this appointment.</p>`
        : "";

      const paymentWarning = willBePaid && paymentAmount
        ? {
            icon: "💰",
            text: `You will receive <strong>$${paymentAmount}</strong> for this cancelled appointment. The payment will be processed according to the normal payout schedule.`,
            bgColor: "#d1fae5",
            borderColor: "#10b981",
            textColor: "#065f46",
          }
        : null;

      const htmlContent = createEmailTemplate({
        title: "Appointment Cancelled",
        subtitle: "The homeowner has cancelled",
        headerColor: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
        greeting: `Hi ${cleanerName},`,
        content: `<p>We wanted to let you know that the homeowner has cancelled their cleaning appointment that you were assigned to.</p>${paymentInfo}`,
        infoBox: {
          icon: "📅",
          title: "Cancelled Appointment Details",
          items: [
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Location", value: homeAddress },
            ...(willBePaid && paymentAmount ? [{ label: "Your Payment", value: `$${paymentAmount}` }] : []),
          ],
        },
        warningBox: paymentWarning,
        steps: {
          title: "🔍 Find Another Appointment",
          items: [
            "Log into the Kleanr app",
            "Browse available cleaning appointments",
            "Request jobs that fit your schedule",
          ],
        },
        ctaText: "There are plenty of other cleaning opportunities waiting for you!",
        footerMessage: "Thank you for being part of Kleanr",
      });

      const paymentText = willBePaid && paymentAmount
        ? `\n\nGOOD NEWS: Since this cancellation was within 3 days of the scheduled cleaning, you will still receive a partial payment of $${paymentAmount} for this appointment.\n`
        : "";

      const textContent = `Hi ${cleanerName},

We wanted to let you know that the homeowner has cancelled their cleaning appointment that you were assigned to.
${paymentText}
CANCELLED APPOINTMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Date: ${formatDate(appointmentDate)}
Location: ${homeAddress}
${willBePaid && paymentAmount ? `Your Payment: $${paymentAmount}\n` : ""}
FIND ANOTHER APPOINTMENT
━━━━━━━━━━━━━━━━━━━━━━
1. Log into the Kleanr app
2. Browse available cleaning appointments
3. Request jobs that fit your schedule

There are plenty of other cleaning opportunities waiting for you!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: willBePaid
          ? `⚠️ Appointment Cancelled - You'll Still Be Paid $${paymentAmount}`
          : `⚠️ Appointment Cancelled - ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Homeowner cancelled notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending homeowner cancelled notification email:", error);
    }
  }

  // Auto-sync calendar appointment notification
  static async sendAutoSyncAppointmentsCreated(
    email,
    userName,
    home,
    appointments,
    platform
  ) {
    try {
      const transporter = createTransporter();
      const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
      const homeAddress = home.nickName ||
        `${home.address || ''}, ${home.city || ''}, ${home.state || ''} ${home.zipcode || ''}`.trim();

      const appointmentCount = appointments.length;
      const totalAmount = appointments.reduce((sum, appt) => sum + (Number(appt.price) || 0), 0);

      // Create appointment list for the email
      const appointmentItems = appointments.map(appt => ({
        label: formatDate(appt.date),
        value: `$${Number(appt.price).toFixed(2)} - ${appt.source}`,
      }));

      const htmlContent = createEmailTemplate({
        title: "New Cleaning Scheduled! 🗓️",
        subtitle: `From your ${platformName} calendar`,
        headerColor: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
        greeting: `Hi ${userName}! 👋`,
        content: appointmentCount === 1
          ? `<p>Great news! A new cleaning appointment has been automatically scheduled based on an upcoming checkout from your <strong>${platformName}</strong> calendar.</p>`
          : `<p>Great news! <strong>${appointmentCount} new cleaning appointments</strong> have been automatically scheduled based on upcoming checkouts from your <strong>${platformName}</strong> calendar.</p>`,
        infoBox: {
          icon: "🏠",
          title: `${appointmentCount === 1 ? 'Appointment' : 'Appointments'} Created for ${homeAddress}`,
          items: appointmentItems,
        },
        warningBox: {
          icon: "💳",
          text: `<strong>Total Amount:</strong> $${totalAmount.toFixed(2)} has been added to your bill. A cleaner will be assigned shortly.`,
          bgColor: "#dbeafe",
          borderColor: "#3b82f6",
          textColor: "#1e40af",
        },
        steps: {
          title: "📝 What's Next?",
          items: [
            "Your appointments are now available for cleaners to select",
            "You'll receive a notification when a cleaner confirms",
            "Review and manage appointments in the Kleanr app",
          ],
        },
        ctaText: "Log into the Kleanr app to view your upcoming appointments.",
        footerMessage: "Automatic scheduling powered by Kleanr",
      });

      const appointmentListText = appointments.map(appt =>
        `  • ${formatDate(appt.date)} - $${Number(appt.price).toFixed(2)} (${appt.source})`
      ).join('\n');

      const textContent = `Hi ${userName}!

${appointmentCount === 1
  ? `A new cleaning appointment has been automatically scheduled based on an upcoming checkout from your ${platformName} calendar.`
  : `${appointmentCount} new cleaning appointments have been automatically scheduled based on upcoming checkouts from your ${platformName} calendar.`
}

APPOINTMENTS CREATED FOR ${homeAddress.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━
${appointmentListText}

Total Amount: $${totalAmount.toFixed(2)} (added to your bill)

WHAT'S NEXT?
━━━━━━━━━━━━━━━━━━━━━━
1. Your appointments are now available for cleaners to select
2. You'll receive a notification when a cleaner confirms
3. Review and manage appointments in the Kleanr app

Log into the Kleanr app to view your upcoming appointments.

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: appointmentCount === 1
          ? `🗓️ New Cleaning Scheduled - ${formatDate(appointments[0].date)}`
          : `🗓️ ${appointmentCount} New Cleanings Scheduled from ${platformName}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Auto-sync appointment notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending auto-sync appointment notification email:", error);
      throw error;
    }
  }

  // Notify owner of HR hiring decision
  static async sendHRHiringNotification(
    ownerEmail,
    hrName,
    applicantName,
    applicantEmail,
    decision,
    rejectionReason = null
  ) {
    try {
      const transporter = createTransporter();
      const isApproved = decision === "approved";

      const htmlContent = createEmailTemplate({
        title: isApproved ? "New Cleaner Hired" : "Application Rejected",
        subtitle: `HR decision by ${hrName}`,
        headerColor: isApproved
          ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
          : "linear-gradient(135deg, #64748b 0%, #94a3b8 100%)",
        greeting: "Hello,",
        content: isApproved
          ? `<p><strong>${hrName}</strong> has approved a cleaner application and created a new employee account.</p>`
          : `<p><strong>${hrName}</strong> has rejected a cleaner application.</p>`,
        infoBox: {
          icon: isApproved ? "✅" : "❌",
          title: "Application Details",
          items: [
            { label: "Applicant", value: applicantName },
            { label: "Email", value: applicantEmail },
            { label: "Decision", value: isApproved ? "Approved - Account Created" : "Rejected" },
            { label: "Decided By", value: hrName },
          ],
        },
        warningBox: !isApproved && rejectionReason ? {
          icon: "📝",
          text: `<strong>Rejection Reason:</strong> ${rejectionReason}`,
          bgColor: "#f1f5f9",
          borderColor: "#94a3b8",
          textColor: "#475569",
        } : null,
        ctaText: "Log into the Kleanr dashboard to view full details.",
        footerMessage: "Kleanr HR Notification",
      });

      const textContent = `Hello,

${hrName} has ${isApproved ? "approved" : "rejected"} a cleaner application.

APPLICATION DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Applicant: ${applicantName}
Email: ${applicantEmail}
Decision: ${isApproved ? "Approved - Account Created" : "Rejected"}
Decided By: ${hrName}
${!isApproved && rejectionReason ? `Rejection Reason: ${rejectionReason}` : ""}

Log into the Kleanr dashboard to view full details.

Best regards,
Kleanr System`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: ownerEmail,
        subject: isApproved
          ? `✅ New Cleaner Hired - ${applicantName}`
          : `❌ Application Rejected - ${applicantName}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ HR hiring notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending HR hiring notification email:", error);
    }
  }

  // Notify client when cleaner changes their cleaning price
  static async sendPriceChangeNotification({
    clientEmail,
    clientName,
    cleanerName,
    businessName,
    oldPrice,
    newPrice,
    homeAddress,
  }) {
    try {
      const transporter = createTransporter();
      const displayName = businessName || cleanerName;

      const htmlContent = createEmailTemplate({
        title: "Cleaning Price Updated",
        subtitle: `${displayName} has updated your cleaning price`,
        headerColor: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
        greeting: `Hi ${clientName},`,
        content: `<p>Your cleaning service provider has updated the price for your home cleaning.</p>`,
        infoBox: {
          icon: "💰",
          title: "Price Change Details",
          items: [
            { label: "Previous Price", value: `$${(oldPrice / 100).toFixed(2)}` },
            { label: "New Price", value: `$${(newPrice / 100).toFixed(2)}` },
            { label: "Home", value: homeAddress || "Your home" },
            { label: "Updated By", value: displayName },
          ],
        },
        ctaText: "Log into the Kleanr app to view your account details.",
        footerMessage: "Thank you for using Kleanr",
      });

      const textContent = `Hi ${clientName},

Your cleaning service provider has updated the price for your home cleaning.

PRICE CHANGE DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Previous Price: $${(oldPrice / 100).toFixed(2)}
New Price: $${(newPrice / 100).toFixed(2)}
Home: ${homeAddress || "Your home"}
Updated By: ${displayName}

Log into the Kleanr app to view your account details.

Best regards,
Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: clientEmail,
        subject: `💰 Your cleaning price has been updated`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Price change notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending price change notification email:", error);
      throw error;
    }
  }

  // Cleaning completed notification to homeowner
  static async sendCleaningCompletedNotification(
    email,
    userName,
    address,
    appointmentDate,
    cleanerName
  ) {
    try {
      const transporter = createTransporter();
      const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zipcode}`;

      const htmlContent = createEmailTemplate({
        title: "Your Home is Sparkling Clean! ✨",
        subtitle: "Your cleaning is complete",
        headerColor: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
        greeting: `Hi ${userName}! 🎉`,
        content: `<p>Great news! Your scheduled cleaning has been completed. Your home is now fresh and clean!</p>`,
        infoBox: {
          icon: "🏠",
          title: "Cleaning Details",
          items: [
            { label: "Address", value: fullAddress },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Cleaned By", value: cleanerName },
            { label: "Status", value: "✅ Completed" },
          ],
        },
        warningBox: {
          icon: "⭐",
          text: "<strong>We'd love your feedback!</strong> Please take a moment to review your cleaner. Your review helps maintain quality service and helps other homeowners.",
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        },
        steps: {
          title: "📝 Leave a Review",
          items: [
            "Open the Kleanr app on your device",
            "Go to your Dashboard or completed appointments",
            "Tap 'Leave a Review' to rate your cleaner",
            "Your feedback helps us improve!",
          ],
        },
        ctaText: "Log into the Kleanr app now to leave your review!",
        footerMessage: "Thank you for choosing Kleanr",
      });

      const textContent = `Hi ${userName}! 🎉

Great news! Your scheduled cleaning has been completed. Your home is now fresh and clean!

CLEANING DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Address: ${fullAddress}
Date: ${formatDate(appointmentDate)}
Cleaned By: ${cleanerName}
Status: ✅ Completed

⭐ WE'D LOVE YOUR FEEDBACK!
Please take a moment to review your cleaner. Your review helps maintain quality service and helps other homeowners.

HOW TO LEAVE A REVIEW
━━━━━━━━━━━━━━━━━━━━━━
1. Open the Kleanr app on your device
2. Go to your Dashboard or completed appointments
3. Tap 'Leave a Review' to rate your cleaner
4. Your feedback helps us improve!

Log into the Kleanr app now to leave your review!

Thank you for choosing Kleanr!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `✨ Your Cleaning is Complete - Leave a Review!`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Cleaning completed email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending cleaning completed email:", error);
    }
  }

  // Review reminder email to homeowner
  static async sendReviewReminderNotification(
    email,
    userName,
    pendingReviews
  ) {
    try {
      const transporter = createTransporter();
      const reviewCount = pendingReviews.length;

      // Build list of pending reviews
      const reviewItems = pendingReviews.slice(0, 5).map(review => ({
        label: formatDate(review.date),
        value: review.homeName || review.address || "Your Home",
      }));

      const htmlContent = createEmailTemplate({
        title: "Don't Forget to Review! ⭐",
        subtitle: `You have ${reviewCount} pending review${reviewCount > 1 ? 's' : ''}`,
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        greeting: `Hi ${userName}! 👋`,
        content: `<p>You have <strong>${reviewCount} completed cleaning${reviewCount > 1 ? 's' : ''}</strong> waiting for your review. Your feedback is incredibly valuable to our cleaners and helps maintain excellent service quality.</p>`,
        infoBox: {
          icon: "📋",
          title: "Cleanings Awaiting Review",
          items: reviewItems,
        },
        warningBox: {
          icon: "💡",
          text: "Leaving a review only takes a minute and really makes a difference for your cleaner!",
          bgColor: "#dbeafe",
          borderColor: "#3b82f6",
          textColor: "#1e40af",
        },
        steps: {
          title: "⚡ Quick Review Steps",
          items: [
            "Open the Kleanr app",
            "Go to your Dashboard",
            "Tap on 'Pending Reviews'",
            "Rate your cleaner and leave feedback",
          ],
        },
        ctaText: "Log into the Kleanr app now to leave your reviews!",
        footerMessage: "Your feedback helps our cleaners grow",
      });

      const pendingListText = pendingReviews.slice(0, 5).map(review =>
        `  • ${formatDate(review.date)} - ${review.homeName || review.address || "Your Home"}`
      ).join('\n');

      const textContent = `Hi ${userName}!

You have ${reviewCount} completed cleaning${reviewCount > 1 ? 's' : ''} waiting for your review.

CLEANINGS AWAITING REVIEW
━━━━━━━━━━━━━━━━━━━━━━
${pendingListText}
${reviewCount > 5 ? `  ...and ${reviewCount - 5} more\n` : ''}
Your feedback is incredibly valuable to our cleaners and helps maintain excellent service quality.

QUICK REVIEW STEPS
━━━━━━━━━━━━━━━━━━━━━━
1. Open the Kleanr app
2. Go to your Dashboard
3. Tap on 'Pending Reviews'
4. Rate your cleaner and leave feedback

Log into the Kleanr app now to leave your reviews!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `⭐ Reminder: ${reviewCount} Cleaning${reviewCount > 1 ? 's' : ''} Waiting for Your Review`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Review reminder email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending review reminder email:", error);
    }
  }

  // ==========================================
  // CLEANER CLIENT ONBOARDING EMAILS
  // ==========================================

  /**
   * Send invitation email when cleaner invites an existing client
   */
  static async sendClientInvitation(
    email,
    clientName,
    cleanerName,
    inviteToken,
    homeAddress,
    personalMessage = null
  ) {
    try {
      const transporter = createTransporter();
      const inviteUrl = `${process.env.APP_URL || 'https://app.kleanr.com'}/invite/${inviteToken}`;

      const htmlContent = createEmailTemplate({
        title: "You're Invited!",
        subtitle: `${cleanerName} uses Kleanr`,
        headerColor: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
        greeting: `Hi ${clientName}! 👋`,
        content: `
          <p><strong>${cleanerName}</strong> has invited you to join <strong>Kleanr</strong> to manage your cleaning appointments and payments.</p>
          ${personalMessage ? `<p style="font-style: italic; background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 3px solid #7c3aed;">"${personalMessage}"</p>` : ''}
          <p>With Kleanr, you'll enjoy:</p>
        `,
        steps: {
          title: "✨ Why Join Kleanr?",
          items: [
            "Easy online scheduling with your cleaner",
            "Automatic payment processing (no more checks or cash!)",
            "Reminders before each cleaning",
            "View your cleaning history and receipts anytime",
          ],
        },
        infoBox: homeAddress ? {
          icon: "🏠",
          title: "Your Home on File",
          items: [
            { label: "Address", value: homeAddress },
          ],
        } : null,
        ctaText: `
          <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); color: white; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Accept Invitation</a>
          <p style="margin-top: 15px; font-size: 13px; color: #64748b;">Or copy this link: ${inviteUrl}</p>
        `,
        footerMessage: "Welcome to easier home cleaning",
      });

      const textContent = `Hi ${clientName}!

${cleanerName} has invited you to join Kleanr to manage your cleaning appointments and payments.

${personalMessage ? `Personal message from ${cleanerName}: "${personalMessage}"` : ''}

WHY JOIN KLEANR?
━━━━━━━━━━━━━━━━━━━━━━
• Easy online scheduling with your cleaner
• Automatic payment processing (no more checks or cash!)
• Reminders before each cleaning
• View your cleaning history and receipts anytime

${homeAddress ? `YOUR HOME ON FILE\n━━━━━━━━━━━━━━━━━━━━━━\nAddress: ${homeAddress}\n` : ''}

ACCEPT INVITATION
━━━━━━━━━━━━━━━━━━━━━━
Click here to get started: ${inviteUrl}

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🏠 ${cleanerName} invited you to Kleanr`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Client invitation email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending client invitation email:", error);
      throw error;
    }
  }

  /**
   * Send reminder for pending invitation
   */
  static async sendInvitationReminder(
    email,
    clientName,
    cleanerName,
    inviteToken
  ) {
    try {
      const transporter = createTransporter();
      const inviteUrl = `${process.env.APP_URL || 'https://app.kleanr.com'}/invite/${inviteToken}`;

      const htmlContent = createEmailTemplate({
        title: "Friendly Reminder",
        subtitle: "Your invitation is waiting",
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        greeting: `Hi ${clientName}! 👋`,
        content: `
          <p>Just a friendly reminder that <strong>${cleanerName}</strong> invited you to join Kleanr a few days ago.</p>
          <p>Setting up takes less than 2 minutes, and you'll be all set for hassle-free cleaning appointments!</p>
        `,
        ctaText: `
          <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); color: white; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Accept Invitation</a>
        `,
        footerMessage: "Don't miss out on easier scheduling",
      });

      const textContent = `Hi ${clientName}!

Just a friendly reminder that ${cleanerName} invited you to join Kleanr a few days ago.

Setting up takes less than 2 minutes, and you'll be all set for hassle-free cleaning appointments!

Click here to accept: ${inviteUrl}

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `⏰ Reminder: ${cleanerName} is waiting for you on Kleanr`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Invitation reminder email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending invitation reminder email:", error);
      throw error;
    }
  }

  /**
   * Notify cleaner when their client accepts the invitation
   */
  static async sendInvitationAccepted(
    cleanerEmail,
    cleanerName,
    clientName,
    homeAddress
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Client Joined!",
        subtitle: "Great news for your business",
        headerColor: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
        greeting: `Congrats ${cleanerName}! 🎉`,
        content: `
          <p><strong>${clientName}</strong> has accepted your invitation and joined Kleanr!</p>
          <p>They're all set up and ready to schedule cleanings with you.</p>
        `,
        infoBox: {
          icon: "🏠",
          title: "New Client Details",
          items: [
            { label: "Client", value: clientName },
            { label: "Address", value: homeAddress },
          ],
        },
        steps: {
          title: "📅 What's Next?",
          items: [
            "View your client in 'My Clients'",
            "Book a cleaning for them or set up a recurring schedule",
            "They'll be automatically notified of appointments",
          ],
        },
        ctaText: "Log into the Kleanr app to manage your new client.",
        footerMessage: "Your client base is growing!",
      });

      const textContent = `Congrats ${cleanerName}!

${clientName} has accepted your invitation and joined Kleanr!

NEW CLIENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Client: ${clientName}
Address: ${homeAddress}

WHAT'S NEXT?
━━━━━━━━━━━━━━━━━━━━━━
1. View your client in 'My Clients'
2. Book a cleaning for them or set up a recurring schedule
3. They'll be automatically notified of appointments

Log into the Kleanr app to manage your new client.

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: cleanerEmail,
        subject: `🎉 ${clientName} joined Kleanr!`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Invitation accepted email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending invitation accepted email:", error);
      throw error;
    }
  }

  /**
   * Send recurring schedule confirmation to client
   */
  static async sendRecurringScheduleCreated(
    email,
    clientName,
    cleanerName,
    frequency,
    dayOfWeek,
    price,
    startDate,
    nextDates
  ) {
    try {
      const transporter = createTransporter();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[dayOfWeek];
      const frequencyText = frequency === 'weekly' ? 'Weekly' : frequency === 'biweekly' ? 'Every 2 Weeks' : 'Monthly';

      const htmlContent = createEmailTemplate({
        title: "Recurring Schedule Set",
        subtitle: "Your cleaning is on autopilot",
        headerColor: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
        greeting: `Hi ${clientName}! 📅`,
        content: `
          <p><strong>${cleanerName}</strong> has set up a recurring cleaning schedule for you.</p>
          <p>No need to book each time – we've got it covered!</p>
        `,
        infoBox: {
          icon: "🔄",
          title: "Your Schedule",
          items: [
            { label: "Frequency", value: frequencyText },
            { label: "Day", value: `${dayName}s` },
            { label: "Starting", value: formatDate(startDate) },
            { label: "Price", value: `$${parseFloat(price).toFixed(2)}` },
          ],
        },
        steps: nextDates && nextDates.length > 0 ? {
          title: "📆 Upcoming Cleanings",
          items: nextDates.slice(0, 4).map(date => formatDate(date)),
        } : null,
        warningBox: {
          icon: "💳",
          text: "Your saved payment method will be charged automatically after each cleaning is completed.",
          bgColor: "#dbeafe",
          borderColor: "#3b82f6",
          textColor: "#1e40af",
        },
        ctaText: "You can view or modify your schedule anytime in the Kleanr app.",
        footerMessage: "Set it and forget it!",
      });

      const textContent = `Hi ${clientName}!

${cleanerName} has set up a recurring cleaning schedule for you.

YOUR SCHEDULE
━━━━━━━━━━━━━━━━━━━━━━
Frequency: ${frequencyText}
Day: ${dayName}s
Starting: ${formatDate(startDate)}
Price: $${parseFloat(price).toFixed(2)}

${nextDates && nextDates.length > 0 ? `UPCOMING CLEANINGS\n━━━━━━━━━━━━━━━━━━━━━━\n${nextDates.slice(0, 4).map(date => formatDate(date)).join('\n')}\n` : ''}

💳 Your saved payment method will be charged automatically after each cleaning.

You can view or modify your schedule anytime in the Kleanr app.

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `📅 Recurring ${frequencyText} Cleaning Scheduled`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Recurring schedule email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending recurring schedule email:", error);
      throw error;
    }
  }

  /**
   * Send cleaning invoice after job completion
   */
  static async sendCleaningInvoice(
    email,
    clientName,
    cleanerName,
    appointmentDate,
    homeAddress,
    price,
    paymentStatus,
    paymentMethod = null
  ) {
    try {
      const transporter = createTransporter();
      const isPaid = paymentStatus === 'paid' || paymentStatus === 'captured';

      const htmlContent = createEmailTemplate({
        title: isPaid ? "Cleaning Complete & Paid" : "Cleaning Complete - Invoice",
        subtitle: formatDate(appointmentDate),
        headerColor: isPaid
          ? "linear-gradient(135deg, #10b981 0%, #34d399 100%)"
          : "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
        greeting: `Hi ${clientName}! ${isPaid ? '✅' : '📋'}`,
        content: isPaid
          ? `<p>Your home at <strong>${homeAddress}</strong> has been cleaned by ${cleanerName}, and payment has been processed successfully.</p>`
          : `<p>Your home at <strong>${homeAddress}</strong> has been cleaned by ${cleanerName}. Here's your invoice:</p>`,
        infoBox: {
          icon: "🧾",
          title: "Invoice Details",
          items: [
            { label: "Service", value: "Home Cleaning" },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Address", value: homeAddress },
            { label: "Cleaner", value: cleanerName },
            { label: "Amount", value: `$${parseFloat(price).toFixed(2)}` },
            { label: "Status", value: isPaid ? '<span style="color: #10b981; font-weight: bold;">PAID</span>' : '<span style="color: #f59e0b; font-weight: bold;">PENDING</span>' },
            ...(paymentMethod ? [{ label: "Payment Method", value: paymentMethod }] : []),
          ],
        },
        ctaText: isPaid
          ? "Thank you for your payment! Log into the app to leave a review."
          : `<a href="${process.env.APP_URL || 'https://app.kleanr.com'}/pay" style="display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Pay Now</a>`,
        footerMessage: "Thanks for using Kleanr!",
      });

      const textContent = `Hi ${clientName}!

Your home at ${homeAddress} has been cleaned by ${cleanerName}.

INVOICE DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Service: Home Cleaning
Date: ${formatDate(appointmentDate)}
Address: ${homeAddress}
Cleaner: ${cleanerName}
Amount: $${parseFloat(price).toFixed(2)}
Status: ${isPaid ? 'PAID' : 'PENDING'}
${paymentMethod ? `Payment Method: ${paymentMethod}` : ''}

${isPaid ? 'Thank you for your payment!' : 'Please log into the Kleanr app to complete payment.'}

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: isPaid
          ? `✅ Receipt: Cleaning on ${formatDate(appointmentDate)}`
          : `🧾 Invoice: Cleaning on ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Cleaning invoice email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending cleaning invoice email:", error);
      throw error;
    }
  }

  /**
   * Send payment reminder for overdue invoices
   */
  static async sendPaymentReminder(
    email,
    clientName,
    appointmentDate,
    homeAddress,
    price,
    daysOverdue
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Payment Reminder",
        subtitle: "Action required",
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        greeting: `Hi ${clientName}! 💳`,
        content: `
          <p>This is a friendly reminder that payment is still pending for your cleaning on <strong>${formatDate(appointmentDate)}</strong>.</p>
        `,
        infoBox: {
          icon: "🧾",
          title: "Outstanding Invoice",
          items: [
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Address", value: homeAddress },
            { label: "Amount Due", value: `<strong style="color: #dc2626;">$${parseFloat(price).toFixed(2)}</strong>` },
            { label: "Days Overdue", value: `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}` },
          ],
        },
        ctaText: `
          <a href="${process.env.APP_URL || 'https://app.kleanr.com'}/pay" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); color: white; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Pay Now</a>
        `,
        footerMessage: "Please pay at your earliest convenience",
      });

      const textContent = `Hi ${clientName}!

This is a friendly reminder that payment is still pending for your cleaning.

OUTSTANDING INVOICE
━━━━━━━━━━━━━━━━━━━━━━
Date: ${formatDate(appointmentDate)}
Address: ${homeAddress}
Amount Due: $${parseFloat(price).toFixed(2)}
Days Overdue: ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}

Please log into the Kleanr app to complete payment.

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `⚠️ Payment Reminder: $${parseFloat(price).toFixed(2)} due`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Payment reminder email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending payment reminder email:", error);
      throw error;
    }
  }

  /**
   * Send payout notification to cleaner
   * @param {string} email - Cleaner's email
   * @param {string} cleanerName - Cleaner's first name
   * @param {string} clientName - Client's full name
   * @param {string} appointmentDate - Date of appointment
   * @param {string} homeAddress - Address of home
   * @param {number} grossAmount - Gross amount before platform fee
   * @param {number} platformFee - Platform fee amount
   * @param {number} netAmount - Net amount after platform fee
   * @param {number} platformFeePercent - Platform fee percentage (default 10)
   */
  static async sendPayoutNotification(
    email,
    cleanerName,
    clientName,
    appointmentDate,
    homeAddress,
    grossAmount,
    platformFee,
    netAmount,
    platformFeePercent = 10
  ) {
    try {
      const transporter = createTransporter();
      const feeLabel = `Platform Fee (${platformFeePercent}%)`;

      const htmlContent = createEmailTemplate({
        title: "Payout Received!",
        subtitle: "Money on the way",
        headerColor: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
        greeting: `Hi ${cleanerName}! 💰`,
        content: `
          <p>Great news! Payment for your cleaning job has been processed and your payout is on the way.</p>
        `,
        infoBox: {
          icon: "💵",
          title: "Payout Details",
          items: [
            { label: "Client", value: clientName },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Address", value: homeAddress },
            { label: "Gross Amount", value: `$${parseFloat(grossAmount).toFixed(2)}` },
            { label: feeLabel, value: `-$${parseFloat(platformFee).toFixed(2)}` },
            { label: "Your Payout", value: `<strong style="color: #10b981;">$${parseFloat(netAmount).toFixed(2)}</strong>` },
          ],
        },
        warningBox: {
          icon: "🏦",
          text: "Funds typically arrive in your bank account within 2-3 business days.",
          bgColor: "#dbeafe",
          borderColor: "#3b82f6",
          textColor: "#1e40af",
        },
        ctaText: "View all your earnings in the Kleanr app.",
        footerMessage: "Keep up the great work!",
      });

      const textContent = `Hi ${cleanerName}!

Great news! Payment for your cleaning job has been processed.

PAYOUT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Client: ${clientName}
Date: ${formatDate(appointmentDate)}
Address: ${homeAddress}
Gross Amount: $${parseFloat(grossAmount).toFixed(2)}
${feeLabel}: -$${parseFloat(platformFee).toFixed(2)}
Your Payout: $${parseFloat(netAmount).toFixed(2)}

🏦 Funds typically arrive in your bank account within 2-3 business days.

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `💰 Payout: $${parseFloat(netAmount).toFixed(2)} for ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Payout notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending payout notification email:", error);
      throw error;
    }
  }

  /**
   * Send notification to business owner when their client books an appointment
   * @param {string} email - Cleaner's email
   * @param {string} cleanerName - Cleaner's first name
   * @param {string} clientName - Client's full name
   * @param {string} appointmentDate - Date of appointment
   * @param {string} homeAddress - Address of home
   * @param {number} price - Price for the cleaning
   * @param {number} appointmentId - Appointment ID
   */
  static async sendNewClientAppointmentEmail(
    email,
    cleanerName,
    clientName,
    appointmentDate,
    homeAddress,
    price,
    appointmentId
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "New Client Appointment",
        subtitle: "Your client has booked a cleaning",
        headerColor: "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)",
        greeting: `Hi ${cleanerName}! 📅`,
        content: `
          <p><strong>${clientName}</strong> has scheduled a new cleaning appointment with you.</p>
          <p>Please review and accept or decline this appointment in the Kleanr app.</p>
        `,
        infoBox: {
          icon: "🏠",
          title: "Appointment Details",
          items: [
            { label: "Client", value: clientName },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Address", value: homeAddress },
            { label: "Price", value: `$${parseFloat(price).toFixed(2)}` },
          ],
        },
        steps: {
          title: "What to do next:",
          items: [
            "<strong>Accept</strong> - If you can do this cleaning",
            "<strong>Decline</strong> - If you're unavailable (client will be notified to reschedule or find another cleaner)",
          ],
        },
        warningBox: {
          icon: "⏰",
          text: "Please respond soon so your client knows their cleaning is confirmed.",
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        },
        ctaText: "Open the Kleanr app to respond.",
        footerMessage: "Thank you for your great service!",
      });

      const textContent = `Hi ${cleanerName}!

${clientName} has scheduled a new cleaning appointment with you.

APPOINTMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Client: ${clientName}
Date: ${formatDate(appointmentDate)}
Address: ${homeAddress}
Price: $${parseFloat(price).toFixed(2)}

WHAT TO DO NEXT:
1. Accept - If you can do this cleaning
2. Decline - If you're unavailable (client will be notified)

Please respond soon so your client knows their cleaning is confirmed.

Open the Kleanr app to respond.

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `📅 New Appointment from ${clientName} - ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ New client appointment email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending new client appointment email:", error);
      throw error;
    }
  }

  /**
   * Send notification to client when business owner declines their appointment
   * @param {string} email - Client's email
   * @param {string} clientName - Client's first name
   * @param {string} appointmentDate - Date of appointment
   * @param {string} businessOwnerName - Business owner's name
   * @param {string} reason - Optional reason for declining
   */
  static async sendBusinessOwnerDeclinedEmail(
    email,
    clientName,
    appointmentDate,
    businessOwnerName,
    reason
  ) {
    try {
      const transporter = createTransporter();

      const reasonText = reason
        ? `<p><strong>Reason:</strong> ${reason}</p>`
        : "";

      const htmlContent = createEmailTemplate({
        title: "Appointment Update",
        subtitle: "Your cleaning needs attention",
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        greeting: `Hi ${clientName}!`,
        content: `
          <p>Unfortunately, <strong>${businessOwnerName}</strong> is unable to complete your cleaning scheduled for <strong>${formatDate(appointmentDate)}</strong>.</p>
          ${reasonText}
          <p>But don't worry! You have options:</p>
        `,
        steps: {
          title: "What you can do:",
          items: [
            "<strong>Cancel this appointment</strong> - We'll remove it from your schedule",
            "<strong>Find another cleaner</strong> - We'll open your appointment to our marketplace where qualified cleaners can pick it up",
          ],
        },
        infoBox: {
          icon: "💡",
          title: "About the Marketplace",
          items: [
            { label: "What is it?", value: "A pool of verified, background-checked cleaners" },
            { label: "How it works", value: "Cleaners see your job and can claim it" },
            { label: "Pricing", value: "Based on your home size and cleaning preferences" },
          ],
        },
        ctaText: "Open the Kleanr app to choose what to do next.",
        footerMessage: "We're here to help you find the right solution!",
      });

      const textContent = `Hi ${clientName}!

Unfortunately, ${businessOwnerName} is unable to complete your cleaning scheduled for ${formatDate(appointmentDate)}.
${reason ? `Reason: ${reason}` : ""}

WHAT YOU CAN DO:
1. Cancel this appointment - We'll remove it from your schedule
2. Find another cleaner - We'll open your appointment to our marketplace

ABOUT THE MARKETPLACE:
- A pool of verified, background-checked cleaners
- Cleaners see your job and can claim it
- Pricing based on your home size and cleaning preferences

Open the Kleanr app to choose what to do next.

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `⚠️ Your cleaning on ${formatDate(appointmentDate)} needs attention`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Business owner declined email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending business owner declined email:", error);
      throw error;
    }
  }

  /**
   * Send notification to cleaner when they are made a preferred cleaner
   * @param {string} email - Cleaner's email
   * @param {string} cleanerName - Cleaner's first name
   * @param {string} homeownerName - Homeowner's full name
   * @param {string} homeAddress - Address or nickname of the home
   */
  static async sendPreferredCleanerNotification(
    email,
    cleanerName,
    homeownerName,
    homeAddress
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "You Earned Preferred Status!",
        subtitle: "A homeowner loved your work",
        headerColor: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        greeting: `Congratulations ${cleanerName}!`,
        content: `
          <p><strong>${homeownerName}</strong> was so impressed with your cleaning that they've given you <strong>preferred cleaner status</strong> for their home!</p>
          <p>This means you can now book appointments for this home directly, without needing to request approval each time.</p>
        `,
        infoBox: {
          icon: "🏠",
          title: "Preferred Home",
          items: [
            { label: "Homeowner", value: homeownerName },
            { label: "Home", value: homeAddress },
            { label: "Status", value: '<span style="color: #10b981; font-weight: bold;">Preferred Cleaner</span>' },
          ],
        },
        steps: {
          title: "What this means for you:",
          items: [
            "You can book directly for this home without waiting for approval",
            "The homeowner trusts your work and wants you back",
            "This helps build your recurring client base",
          ],
        },
        warningBox: {
          icon: "⭐",
          text: "Keep up the great work! Preferred status is a sign that your clients value your service.",
          bgColor: "#ecfdf5",
          borderColor: "#10b981",
          textColor: "#065f46",
        },
        ctaText: "Open the Kleanr app to see available jobs at preferred homes.",
        footerMessage: "Thank you for providing excellent service!",
      });

      const textContent = `Congratulations ${cleanerName}!

${homeownerName} was so impressed with your cleaning that they've given you preferred cleaner status for their home!

PREFERRED HOME
━━━━━━━━━━━━━━━━━━━━━━
Homeowner: ${homeownerName}
Home: ${homeAddress}
Status: Preferred Cleaner

WHAT THIS MEANS FOR YOU:
1. You can book directly for this home without waiting for approval
2. The homeowner trusts your work and wants you back
3. This helps build your recurring client base

Keep up the great work! Preferred status is a sign that your clients value your service.

Open the Kleanr app to see available jobs at preferred homes.

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `⭐ You earned preferred status from ${homeownerName}!`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Preferred cleaner notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending preferred cleaner notification email:", error);
      throw error;
    }
  }

  static async sendPreferredCleanerBookingNotification(
    email,
    homeownerName,
    cleanerName,
    homeAddress,
    appointmentDate
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Your Preferred Cleaner Booked",
        subtitle: "Direct booking confirmation",
        headerColor: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        greeting: `Hello ${homeownerName},`,
        content: `
          <p><strong>${cleanerName}</strong>, your preferred cleaner, has booked an upcoming cleaning at your home.</p>
          <p>Since you gave them preferred status, they were able to book directly without needing your approval.</p>
        `,
        infoBox: {
          icon: "📅",
          title: "Booking Details",
          items: [
            { label: "Cleaner", value: cleanerName },
            { label: "Property", value: homeAddress },
            { label: "Date", value: appointmentDate },
            { label: "Status", value: '<span style="color: #10b981; font-weight: bold;">Confirmed</span>' },
          ],
        },
        ctaText: "Open the Kleanr app to view your upcoming appointments.",
        footerMessage: "Thank you for using Kleanr!",
      });

      const textContent = `Hello ${homeownerName},

${cleanerName}, your preferred cleaner, has booked an upcoming cleaning at your home.

Since you gave them preferred status, they were able to book directly without needing your approval.

BOOKING DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Cleaner: ${cleanerName}
Property: ${homeAddress}
Date: ${appointmentDate}
Status: Confirmed

Open the Kleanr app to view your upcoming appointments.

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `📅 ${cleanerName} booked your ${appointmentDate} cleaning`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Preferred cleaner booking notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending preferred cleaner booking notification email:", error);
      throw error;
    }
  }

  /**
   * Send suspicious activity report notification to HR/Owner
   */
  static async sendSuspiciousActivityReport({
    to,
    staffName,
    reporterName,
    reportedUserName,
    reportedUserType,
    messageContent,
    suspiciousTypes,
    appointmentId,
    reportId,
  }) {
    try {
      const transporter = createTransporter();

      const userTypeLabel =
        reportedUserType === "cleaner"
          ? "Cleaner"
          : reportedUserType === "homeowner"
          ? "Client"
          : "User";

      const htmlContent = createEmailTemplate({
        title: "Suspicious Activity Report",
        subtitle: "A message has been flagged for review",
        greeting: `Hello ${staffName},`,
        content: `
          <p>A user has reported suspicious activity in the messaging system that requires your review.</p>
          <p>The reported message may contain attempts to communicate or transact outside of the Kleanr platform.</p>
        `,
        headerColor: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
        infoBox: {
          icon: "🚨",
          title: "Report Details",
          items: [
            { label: "Report ID", value: `#${reportId}` },
            { label: "Reported By", value: reporterName },
            { label: "Reported User", value: `${reportedUserName} (${userTypeLabel})` },
            { label: "Suspicious Content", value: suspiciousTypes },
            ...(appointmentId
              ? [{ label: "Related Appointment", value: `#${appointmentId}` }]
              : []),
          ],
        },
        warningBox: {
          bgColor: "#fef2f2",
          borderColor: "#dc2626",
          textColor: "#991b1b",
          icon: "💬",
          text: `Message content: "${messageContent.substring(0, 200)}${messageContent.length > 200 ? "..." : ""}"`,
        },
        steps: {
          title: "Recommended Actions",
          items: [
            "Review the reported message and conversation context",
            "Check the user's history for similar patterns",
            "Consider warning or flagging the user if appropriate",
            "Update the report status once reviewed",
          ],
        },
        ctaText: "Log into the Kleanr admin panel to review this report and take action.",
        footerMessage: "Protecting our community is a priority.",
      });

      const textContent = `Hello ${staffName},

SUSPICIOUS ACTIVITY REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━

A user has reported suspicious activity that requires your review.

REPORT DETAILS
Report ID: #${reportId}
Reported By: ${reporterName}
Reported User: ${reportedUserName} (${userTypeLabel})
Suspicious Content: ${suspiciousTypes}
${appointmentId ? `Related Appointment: #${appointmentId}` : ""}

MESSAGE CONTENT:
"${messageContent}"

RECOMMENDED ACTIONS:
1. Review the reported message and conversation context
2. Check the user's history for similar patterns
3. Consider warning or flagging the user if appropriate
4. Update the report status once reviewed

Log into the Kleanr admin panel to review this report.

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `🚨 Suspicious Activity Report - ${reportedUserName} (${userTypeLabel})`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Suspicious activity report email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending suspicious activity report email:", error);
      throw error;
    }
  }

  // ==========================================
  // BUSINESS OWNER BOOKING EMAILS
  // ==========================================

  /**
   * Send pending booking email to client (needs approval)
   */
  static async sendPendingBookingEmail(
    to,
    appointmentDate,
    price,
    cleanerName,
    expiresAt
  ) {
    try {
      const transporter = createTransporter();
      const expiresDate = new Date(expiresAt);
      const hoursRemaining = Math.round((expiresDate - new Date()) / (1000 * 60 * 60));

      const htmlContent = createEmailTemplate({
        title: "New Booking Request",
        subtitle: "Your cleaner has scheduled a cleaning for you",
        headerColor: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
        greeting: "You have a new booking request!",
        content: `<p>${cleanerName} has scheduled a cleaning for you and is waiting for your confirmation.</p>
          <p>Please review the details below and accept or decline this booking.</p>`,
        infoBox: {
          icon: "📅",
          title: "Booking Details",
          items: [
            { label: "Cleaner", value: cleanerName },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Price", value: `$${price}` },
            { label: "Response Required By", value: formatDate(expiresAt) },
          ],
        },
        warningBox: {
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
          icon: "⏰",
          text: `This request will expire in ${hoursRemaining} hours. Please respond soon!`,
        },
        steps: {
          title: "To Accept or Decline:",
          items: [
            "Open the Kleanr app on your phone",
            "Go to your Dashboard to see the pending booking",
            "Tap to view details and Accept or Decline",
          ],
        },
        ctaText: "Open the Kleanr app to respond to this booking request.",
        footerMessage: "Thank you for using Kleanr!",
      });

      const textContent = `NEW BOOKING REQUEST

${cleanerName} has scheduled a cleaning for you!

BOOKING DETAILS
━━━━━━━━━━━━━━━
Cleaner: ${cleanerName}
Date: ${formatDate(appointmentDate)}
Price: $${price}
Response Required By: ${formatDate(expiresAt)}

⏰ This request will expire in ${hoursRemaining} hours!

TO RESPOND:
1. Open the Kleanr app
2. View the pending booking on your Dashboard
3. Accept or Decline the booking

Thank you for using Kleanr!`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `📅 New Booking Request from ${cleanerName} - ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Pending booking email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending pending booking email:", error);
      throw error;
    }
  }

  /**
   * Send booking accepted email to business owner
   */
  static async sendBookingAcceptedEmail(
    to,
    appointmentDate,
    clientName
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Booking Accepted!",
        subtitle: "Your client confirmed the appointment",
        headerColor: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        greeting: "Great news!",
        content: `<p><strong>${clientName}</strong> has accepted your booking request.</p>
          <p>The appointment is now confirmed and ready to go!</p>`,
        infoBox: {
          icon: "✅",
          title: "Confirmed Appointment",
          items: [
            { label: "Client", value: clientName },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Status", value: "Confirmed" },
          ],
        },
        ctaText: "View the appointment details in the Kleanr app.",
        footerMessage: "Happy cleaning!",
      });

      const textContent = `BOOKING ACCEPTED!

Great news! ${clientName} has accepted your booking request.

CONFIRMED APPOINTMENT
━━━━━━━━━━━━━━━━━━━━━━
Client: ${clientName}
Date: ${formatDate(appointmentDate)}
Status: Confirmed

View the appointment details in the Kleanr app.

Happy cleaning!`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `✅ Booking Accepted - ${clientName} on ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Booking accepted email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending booking accepted email:", error);
      throw error;
    }
  }

  /**
   * Send booking declined email to business owner
   */
  static async sendBookingDeclinedEmail(
    to,
    appointmentDate,
    clientName,
    declineReason = null,
    suggestedDates = null
  ) {
    try {
      const transporter = createTransporter();
      const hasSuggestions = suggestedDates && suggestedDates.length > 0;

      const infoItems = [
        { label: "Client", value: clientName },
        { label: "Requested Date", value: formatDate(appointmentDate) },
        { label: "Status", value: "Declined" },
      ];

      if (declineReason) {
        infoItems.push({ label: "Reason", value: declineReason });
      }

      if (hasSuggestions) {
        infoItems.push({
          label: "Suggested Alternatives",
          value: suggestedDates.map(d => formatDate(d)).join(", "),
        });
      }

      const htmlContent = createEmailTemplate({
        title: "Booking Declined",
        subtitle: hasSuggestions ? "But your client suggested alternatives" : "Your client couldn't accept this date",
        headerColor: hasSuggestions
          ? "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)"
          : "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
        greeting: hasSuggestions ? "Your client has another option!" : "Unfortunately...",
        content: hasSuggestions
          ? `<p><strong>${clientName}</strong> couldn't accept your booking for ${formatDate(appointmentDate)}, but they've suggested some alternative dates that work for them.</p>
             <p>Consider rebooking with one of their suggested dates!</p>`
          : `<p><strong>${clientName}</strong> has declined your booking request for ${formatDate(appointmentDate)}.</p>
             <p>You can try scheduling a different date with them.</p>`,
        infoBox: {
          icon: hasSuggestions ? "📅" : "❌",
          title: "Booking Details",
          items: infoItems,
        },
        steps: hasSuggestions ? {
          title: "What's Next?",
          items: [
            "Open the Kleanr app",
            "Go to My Clients and find this client",
            "Create a new booking with one of their suggested dates",
          ],
        } : null,
        ctaText: "Open the Kleanr app to rebook with a different date.",
        footerMessage: "Don't give up - try another date!",
      });

      const suggestedDatesText = hasSuggestions
        ? `\nSuggested Alternatives: ${suggestedDates.map(d => formatDate(d)).join(", ")}`
        : "";
      const reasonText = declineReason ? `\nReason: ${declineReason}` : "";

      const textContent = `BOOKING DECLINED

${clientName} has declined your booking request.

BOOKING DETAILS
━━━━━━━━━━━━━━━
Client: ${clientName}
Requested Date: ${formatDate(appointmentDate)}
Status: Declined${reasonText}${suggestedDatesText}

${hasSuggestions ? "WHAT'S NEXT:\n1. Open the Kleanr app\n2. Go to My Clients\n3. Rebook with one of their suggested dates" : ""}

Open the Kleanr app to try scheduling a different date.`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: hasSuggestions
          ? `📅 ${clientName} suggested new dates - Rebook needed`
          : `❌ Booking Declined - ${clientName} on ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Booking declined email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending booking declined email:", error);
      throw error;
    }
  }

  /**
   * Send booking expired email to business owner
   */
  static async sendBookingExpiredEmail(
    to,
    appointmentDate,
    clientName
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Booking Request Expired",
        subtitle: "Your client didn't respond in time",
        headerColor: "linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)",
        greeting: "Time's up!",
        content: `<p>Your booking request for <strong>${clientName}</strong> on ${formatDate(appointmentDate)} has expired.</p>
          <p>The client didn't respond within 48 hours. You can create a new booking request with a different date.</p>`,
        infoBox: {
          icon: "⏰",
          title: "Expired Request",
          items: [
            { label: "Client", value: clientName },
            { label: "Requested Date", value: formatDate(appointmentDate) },
            { label: "Status", value: "Expired (No Response)" },
          ],
        },
        steps: {
          title: "What's Next?",
          items: [
            "Open the Kleanr app",
            "Go to My Clients and find this client",
            "Try booking with a different date",
            "Or reach out to them via messaging",
          ],
        },
        ctaText: "Open the Kleanr app to schedule a new booking.",
        footerMessage: "Don't give up - try reaching out!",
      });

      const textContent = `BOOKING REQUEST EXPIRED

Your booking request for ${clientName} on ${formatDate(appointmentDate)} has expired.

The client didn't respond within 48 hours.

EXPIRED REQUEST
━━━━━━━━━━━━━━━
Client: ${clientName}
Requested Date: ${formatDate(appointmentDate)}
Status: Expired (No Response)

WHAT'S NEXT:
1. Open the Kleanr app
2. Go to My Clients
3. Try booking with a different date
4. Or message them to check in

Open the Kleanr app to schedule a new booking.`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `⏰ Booking Expired - ${clientName} didn't respond`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Booking expired email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending booking expired email:", error);
      throw error;
    }
  }

  // ============================================
  // Multi-Cleaner Job Email Templates
  // ============================================

  /**
   * Send multi-cleaner job offer email to cleaner
   */
  static async sendMultiCleanerOfferEmail(
    to,
    cleanerName,
    appointmentDate,
    earningsAmount,
    roomAssignments,
    homeAddress
  ) {
    try {
      const transporter = createTransporter();
      const earningsFormatted = `$${(earningsAmount / 100).toFixed(2)}`;

      const htmlContent = createEmailTemplate({
        title: "Multi-Cleaner Job Available",
        subtitle: "Team cleaning opportunity",
        headerColor: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
        greeting: `Hi ${cleanerName}!`,
        content: `<p>A multi-cleaner job is available and you've been selected to participate!</p>
          <p>This is a larger home that will be cleaned by a team. Your share of the earnings is shown below.</p>`,
        infoBox: {
          icon: "👥",
          title: "Job Details",
          items: [
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Your Earnings", value: earningsFormatted },
            { label: "Your Rooms", value: roomAssignments.join(", ") },
            { label: "Location", value: homeAddress || "See app for details" },
          ],
        },
        warningBox: {
          icon: "⏰",
          text: "This offer expires in 48 hours. Accept soon to secure your spot!",
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        },
        ctaText: "Open the Kleanr app to accept or decline this offer.",
        footerMessage: "Team up for bigger earnings!",
      });

      const textContent = `MULTI-CLEANER JOB AVAILABLE

Hi ${cleanerName}!

A multi-cleaner job is available and you've been selected to participate!

JOB DETAILS
━━━━━━━━━━━
Date: ${formatDate(appointmentDate)}
Your Earnings: ${earningsFormatted}
Your Rooms: ${roomAssignments.join(", ")}
Location: ${homeAddress || "See app for details"}

⏰ This offer expires in 48 hours. Accept soon to secure your spot!

Open the Kleanr app to accept or decline this offer.`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `👥 Multi-Cleaner Job Available - ${earningsFormatted} on ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Multi-cleaner offer email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending multi-cleaner offer email:", error);
      throw error;
    }
  }

  /**
   * Send cleaner dropout notification email to homeowner
   */
  static async sendCleanerDropoutEmail(
    to,
    homeownerName,
    appointmentDate,
    remainingCleaners,
    options
  ) {
    try {
      const transporter = createTransporter();

      const optionsList = options.map(opt => {
        switch(opt) {
          case "proceed_with_one": return "Proceed with remaining cleaner(s)";
          case "wait_for_replacement": return "Wait for a replacement cleaner";
          case "cancel": return "Cancel the appointment (no penalty)";
          case "reschedule": return "Reschedule to a different date";
          default: return opt;
        }
      });

      const htmlContent = createEmailTemplate({
        title: "Cleaner Update",
        subtitle: "A change to your upcoming cleaning",
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        greeting: `Hi ${homeownerName},`,
        content: `<p>We wanted to let you know that one of the cleaners scheduled for your upcoming appointment is no longer available.</p>
          <p>Don't worry - you still have ${remainingCleaners} cleaner(s) assigned, and we have several options for you.</p>`,
        infoBox: {
          icon: "🏠",
          title: "Your Appointment",
          items: [
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Cleaners Remaining", value: remainingCleaners.toString() },
            { label: "Status", value: "Needs your decision" },
          ],
        },
        steps: {
          title: "Your Options",
          items: optionsList,
        },
        ctaText: "Open the Kleanr app to choose how you'd like to proceed.",
        footerMessage: "We're here to help!",
      });

      const textContent = `CLEANER UPDATE

Hi ${homeownerName},

One of the cleaners scheduled for your upcoming appointment is no longer available.

YOUR APPOINTMENT
━━━━━━━━━━━━━━━
Date: ${formatDate(appointmentDate)}
Cleaners Remaining: ${remainingCleaners}
Status: Needs your decision

YOUR OPTIONS:
${optionsList.map((opt, i) => `${i + 1}. ${opt}`).join("\n")}

Open the Kleanr app to choose how you'd like to proceed.`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `⚠️ Cleaner Update for ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Cleaner dropout email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending cleaner dropout email:", error);
      throw error;
    }
  }

  /**
   * Send solo completion offer email to remaining cleaner
   */
  static async sendSoloCompletionOfferEmail(
    to,
    cleanerName,
    appointmentDate,
    bonusAmount,
    originalCleanerCount
  ) {
    try {
      const transporter = createTransporter();
      const bonusFormatted = `$${(bonusAmount / 100).toFixed(2)}`;

      const htmlContent = createEmailTemplate({
        title: "Solo Completion Offer",
        subtitle: "Earn the full amount!",
        headerColor: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
        greeting: `Hi ${cleanerName}!`,
        content: `<p>Great news! You have the opportunity to complete the entire job solo and earn the full cleaning amount.</p>
          <p>Your co-cleaner is no longer available. If you complete the job by yourself, you'll receive the full payment.</p>`,
        infoBox: {
          icon: "💰",
          title: "Earnings Opportunity",
          items: [
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Full Earnings", value: bonusFormatted },
            { label: "Original Team Size", value: `${originalCleanerCount} cleaners` },
            { label: "Your Decision", value: "Accept within 12 hours" },
          ],
        },
        warningBox: {
          icon: "⏰",
          text: "This offer expires in 12 hours. Respond soon!",
          bgColor: "#dbeafe",
          borderColor: "#3b82f6",
          textColor: "#1e40af",
        },
        ctaText: "Open the Kleanr app to accept or decline this offer.",
        footerMessage: "You've got this!",
      });

      const textContent = `SOLO COMPLETION OFFER

Hi ${cleanerName}!

Great news! You can complete the entire job solo and earn the full cleaning amount.

EARNINGS OPPORTUNITY
━━━━━━━━━━━━━━━━━━━
Date: ${formatDate(appointmentDate)}
Full Earnings: ${bonusFormatted}
Original Team Size: ${originalCleanerCount} cleaners
Your Decision: Accept within 12 hours

⏰ This offer expires in 12 hours. Respond soon!

Open the Kleanr app to accept or decline.`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `💰 Solo Completion Offer - Earn ${bonusFormatted} on ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Solo completion offer email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending solo completion offer email:", error);
      throw error;
    }
  }

  /**
   * Send partial completion notification to homeowner
   */
  static async sendPartialCompletionEmail(
    to,
    homeownerName,
    appointmentDate,
    completedRooms,
    totalRooms,
    options
  ) {
    try {
      const transporter = createTransporter();
      const percentage = Math.round((completedRooms / totalRooms) * 100);

      const optionsList = options.map(opt => {
        switch(opt) {
          case "accept_partial": return "Accept partial clean with prorated payment";
          case "schedule_completion": return "Schedule completion of remaining rooms";
          case "full_refund": return "Request full refund and reschedule";
          default: return opt;
        }
      });

      const htmlContent = createEmailTemplate({
        title: "Cleaning Update",
        subtitle: "Your cleaning was partially completed",
        headerColor: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        greeting: `Hi ${homeownerName},`,
        content: `<p>We wanted to update you on your recent cleaning. Due to unforeseen circumstances, your cleaning was partially completed.</p>
          <p>We apologize for any inconvenience and want to make this right.</p>`,
        infoBox: {
          icon: "🏠",
          title: "Cleaning Status",
          items: [
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Rooms Completed", value: `${completedRooms} of ${totalRooms}` },
            { label: "Completion", value: `${percentage}%` },
          ],
        },
        steps: {
          title: "Your Options",
          items: optionsList,
        },
        ctaText: "Open the Kleanr app to choose your preferred option.",
        footerMessage: "We appreciate your patience!",
      });

      const textContent = `CLEANING UPDATE

Hi ${homeownerName},

Your recent cleaning was partially completed.

CLEANING STATUS
━━━━━━━━━━━━━━
Date: ${formatDate(appointmentDate)}
Rooms Completed: ${completedRooms} of ${totalRooms}
Completion: ${percentage}%

YOUR OPTIONS:
${optionsList.map((opt, i) => `${i + 1}. ${opt}`).join("\n")}

Open the Kleanr app to choose your preferred option.`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `🏠 Cleaning Update - ${percentage}% Complete`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Partial completion email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending partial completion email:", error);
      throw error;
    }
  }

  /**
   * Send multi-cleaner job confirmation email to homeowner
   */
  static async sendMultiCleanerConfirmationEmail(
    to,
    homeownerName,
    appointmentDate,
    cleanerCount,
    cleanerNames,
    totalPrice
  ) {
    try {
      const transporter = createTransporter();
      const priceFormatted = `$${(totalPrice / 100).toFixed(2)}`;

      const htmlContent = createEmailTemplate({
        title: "Your Team is Ready!",
        subtitle: "Multi-cleaner job confirmed",
        headerColor: "linear-gradient(135deg, #10b981 0%, #14b8a6 100%)",
        greeting: `Hi ${homeownerName}!`,
        content: `<p>Great news! Your multi-cleaner team is confirmed and ready to give your home a thorough cleaning.</p>
          <p>With ${cleanerCount} cleaners working together, your cleaning will be completed faster than ever!</p>`,
        infoBox: {
          icon: "✨",
          title: "Your Cleaning Team",
          items: [
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Team Size", value: `${cleanerCount} cleaners` },
            { label: "Cleaners", value: cleanerNames.join(", ") },
            { label: "Total", value: priceFormatted },
          ],
        },
        steps: {
          title: "What to Expect",
          items: [
            "Your cleaners will arrive together at the scheduled time",
            "Each cleaner is assigned specific rooms for efficient cleaning",
            "You'll receive real-time updates as rooms are completed",
            "All cleaners complete before/after photos for quality assurance",
          ],
        },
        ctaText: "Open the Kleanr app to view your team's progress on cleaning day.",
        footerMessage: "Looking forward to a sparkling clean home!",
      });

      const textContent = `YOUR TEAM IS READY!

Hi ${homeownerName}!

Your multi-cleaner team is confirmed!

YOUR CLEANING TEAM
━━━━━━━━━━━━━━━━━
Date: ${formatDate(appointmentDate)}
Team Size: ${cleanerCount} cleaners
Cleaners: ${cleanerNames.join(", ")}
Total: ${priceFormatted}

WHAT TO EXPECT:
1. Your cleaners will arrive together
2. Each cleaner is assigned specific rooms
3. You'll receive real-time updates
4. All cleaners complete before/after photos

Open the Kleanr app to view your team's progress on cleaning day.`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `✨ Your ${cleanerCount}-Person Cleaning Team is Confirmed for ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Multi-cleaner confirmation email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending multi-cleaner confirmation email:", error);
      throw error;
    }
  }

  /**
   * Send urgent fill notification email to cleaner
   */
  static async sendUrgentFillEmail(
    to,
    cleanerName,
    appointmentDate,
    earningsAmount,
    daysRemaining
  ) {
    try {
      const transporter = createTransporter();
      const earningsFormatted = `$${(earningsAmount / 100).toFixed(2)}`;

      const htmlContent = createEmailTemplate({
        title: "Urgent: Job Needs You!",
        subtitle: "Help complete a team cleaning",
        headerColor: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
        greeting: `Hi ${cleanerName}!`,
        content: `<p>A multi-cleaner job is urgently looking for an additional cleaner. The appointment is in just ${daysRemaining} days!</p>
          <p>This is a great opportunity to earn ${earningsFormatted} and help out a homeowner in need.</p>`,
        infoBox: {
          icon: "🔥",
          title: "Urgent Opportunity",
          items: [
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Days Until Job", value: `${daysRemaining} days` },
            { label: "Your Earnings", value: earningsFormatted },
            { label: "Status", value: "Urgently Needed!" },
          ],
        },
        warningBox: {
          icon: "⚡",
          text: "This job is filling fast! Accept now to secure your spot.",
          bgColor: "#fef2f2",
          borderColor: "#ef4444",
          textColor: "#b91c1c",
        },
        ctaText: "Open the Kleanr app to accept this job now!",
        footerMessage: "Every cleaner makes a difference!",
      });

      const textContent = `URGENT: JOB NEEDS YOU!

Hi ${cleanerName}!

A multi-cleaner job urgently needs an additional cleaner!

URGENT OPPORTUNITY
━━━━━━━━━━━━━━━━━
Date: ${formatDate(appointmentDate)}
Days Until Job: ${daysRemaining} days
Your Earnings: ${earningsFormatted}
Status: Urgently Needed!

⚡ This job is filling fast! Accept now to secure your spot.

Open the Kleanr app to accept this job now!`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: `🔥 URGENT: Earn ${earningsFormatted} - Job in ${daysRemaining} Days!`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Urgent fill email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending urgent fill email:", error);
      throw error;
    }
  }

  /**
   * Send last-minute urgent job notification email to cleaner
   */
  static async sendLastMinuteUrgentEmail(
    email,
    cleanerName,
    appointmentDate,
    price,
    location,
    distanceMiles
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Urgent Job Available!",
        subtitle: "Last-Minute Cleaning Opportunity",
        headerColor: "linear-gradient(135deg, #dc2626 0%, #f97316 100%)",
        greeting: `Hi ${cleanerName}!`,
        content: `<p>A homeowner in your area needs a cleaning <strong>urgently</strong>! This is a last-minute booking that needs to be filled quickly.</p>
          <p>You're only <strong>${distanceMiles} miles</strong> away from this job!</p>`,
        infoBox: {
          icon: "📍",
          title: "Job Details",
          items: [
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Your Earnings", value: price },
            { label: "Location", value: location },
            { label: "Distance", value: `${distanceMiles} miles from you` },
          ],
        },
        warningBox: {
          icon: "⏰",
          text: "This job is available for a <strong>limited time</strong>. Open the app now to claim it before another cleaner does!",
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        },
        ctaText: "Open the Kleanr app to view and accept this job!",
        footerMessage: "Don't miss this opportunity!",
      });

      const textContent = `URGENT: Last-Minute Cleaning Available!

Hi ${cleanerName},

A homeowner near you needs a cleaning urgently. You're only ${distanceMiles} miles away!

JOB DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Date: ${formatDate(appointmentDate)}
Your Earnings: ${price}
Location: ${location}
Distance: ${distanceMiles} miles from you

⏰ This job is available for a limited time. Open the Kleanr app now to claim it!

Best regards,
Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🚨 URGENT: Last-Minute Cleaning - ${price} - ${distanceMiles} mi away`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Last-minute urgent email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending last-minute urgent email:", error);
      throw error;
    }
  }

  /**
   * Send urgent replacement email when a cleaner cancels last-minute
   */
  static async sendUrgentReplacementEmail(
    email,
    cleanerName,
    appointmentDate,
    price,
    location,
    distanceMiles
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Urgent: Replacement Needed!",
        subtitle: "A Cleaner Had to Cancel",
        headerColor: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
        greeting: `Hi ${cleanerName}!`,
        content: `<p>A homeowner in your area needs a <strong>replacement cleaner</strong> urgently! The originally assigned cleaner had to cancel, and this job needs to be filled quickly.</p>
          <p>You're only <strong>${distanceMiles} miles</strong> away from this job!</p>`,
        infoBox: {
          icon: "🆘",
          title: "Job Details",
          items: [
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Your Earnings", value: price },
            { label: "Location", value: location },
            { label: "Distance", value: `${distanceMiles} miles from you` },
          ],
        },
        warningBox: {
          icon: "⏰",
          text: "The homeowner is counting on finding a replacement quickly. Open the app now to claim this job before another cleaner does!",
          bgColor: "#fee2e2",
          borderColor: "#ef4444",
          textColor: "#991b1b",
        },
        ctaText: "Open the Kleanr app to view and accept this job!",
        footerMessage: "Help save the day!",
      });

      const textContent = `URGENT: Replacement Cleaner Needed!

Hi ${cleanerName},

A homeowner near you needs a replacement cleaner urgently - the original cleaner had to cancel. You're only ${distanceMiles} miles away!

JOB DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Date: ${formatDate(appointmentDate)}
Your Earnings: ${price}
Location: ${location}
Distance: ${distanceMiles} miles from you

⏰ The homeowner is counting on finding a replacement quickly. Open the Kleanr app now to claim it!

Best regards,
Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🆘 URGENT: Replacement Needed - ${price} - ${distanceMiles} mi away`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Urgent replacement email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending urgent replacement email:", error);
      throw error;
    }
  }

  // ============================================================================
  // EDGE CASE MULTI-CLEANER EMAILS
  // ============================================================================

  /**
   * Send edge case decision required email to homeowner
   */
  static async sendEdgeCaseDecisionRequired(
    email,
    homeownerName,
    cleanerName,
    appointmentDate,
    homeAddress,
    decisionHours,
    appointmentId,
    multiCleanerJobId
  ) {
    try {
      const transporter = createTransporter();

      const addressStr = homeAddress
        ? `${homeAddress.street}, ${homeAddress.city}`
        : "your home";

      const htmlContent = createEmailTemplate({
        title: "Action Needed",
        subtitle: "Your Cleaning Has 1 Cleaner Confirmed",
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        greeting: `Hi ${homeownerName}!`,
        content: `<p>Your cleaning scheduled for <strong>${appointmentDate}</strong> at <strong>${addressStr}</strong> has <strong>${cleanerName}</strong> confirmed, but we couldn't find a second cleaner.</p>
          <p>Since your home qualifies as a larger home, we recommend 2 cleaners. However, you have options:</p>`,
        infoBox: {
          icon: "🏠",
          title: "Your Options",
          items: [
            { label: "Option 1", value: "Proceed with 1 cleaner (same price, full pay to cleaner)" },
            { label: "Option 2", value: "Cancel with no fees (cleaner notified, no payment charged)" },
          ],
        },
        warningBox: {
          icon: "⏰",
          text: `Please respond within <strong>${decisionHours} hours</strong>. If we don't hear from you, we'll proceed with 1 cleaner and normal cancellation fees will apply.`,
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        },
        ctaText: "Open the Kleanr app to make your decision",
        footerMessage: "We're here to help make your cleaning a success!",
      });

      const textContent = `Action Needed: Your Cleaning Has 1 Cleaner Confirmed

Hi ${homeownerName},

Your cleaning scheduled for ${appointmentDate} at ${addressStr} has ${cleanerName} confirmed, but we couldn't find a second cleaner.

YOUR OPTIONS:
━━━━━━━━━━━━━━━━━━━━━━
1. Proceed with 1 cleaner (same price, full pay to cleaner)
2. Cancel with no fees (cleaner notified, no payment charged)

⏰ Please respond within ${decisionHours} hours. If we don't hear from you, we'll proceed with 1 cleaner and normal cancellation fees will apply.

Open the Kleanr app to make your decision.

Best regards,
Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `⏰ Action Needed: Your ${appointmentDate} Cleaning - 1 Cleaner Confirmed`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Edge case decision required email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending edge case decision email:", error);
      throw error;
    }
  }

  /**
   * Send edge case auto-proceeded email to homeowner
   */
  static async sendEdgeCaseAutoProceeded(
    email,
    homeownerName,
    cleanerName,
    appointmentDate,
    homeAddress,
    appointmentId
  ) {
    try {
      const transporter = createTransporter();

      const addressStr = homeAddress
        ? `${homeAddress.street}, ${homeAddress.city}`
        : "your home";

      const htmlContent = createEmailTemplate({
        title: "Cleaning Confirmed",
        subtitle: "Proceeding with 1 Cleaner",
        headerColor: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
        greeting: `Hi ${homeownerName}!`,
        content: `<p>We didn't receive a response, so we've proceeded with your cleaning as scheduled.</p>
          <p><strong>${cleanerName}</strong> will complete your cleaning on <strong>${appointmentDate}</strong> at <strong>${addressStr}</strong>.</p>`,
        infoBox: {
          icon: "📋",
          title: "What This Means",
          items: [
            { label: "Cleaner", value: cleanerName },
            { label: "Date", value: appointmentDate },
            { label: "Payment", value: "Will be captured (normal fees apply)" },
            { label: "Cancellation", value: "Normal cancellation fees now apply" },
          ],
        },
        warningBox: {
          icon: "ℹ️",
          text: "If another cleaner becomes available, they may still join the job before the cleaning date.",
          bgColor: "#e0f2fe",
          borderColor: "#0284c7",
          textColor: "#075985",
        },
        ctaText: "Open the Kleanr app to view your appointment details",
        footerMessage: "We're looking forward to your sparkling clean home!",
      });

      const textContent = `Cleaning Confirmed - Proceeding with 1 Cleaner

Hi ${homeownerName},

We didn't receive a response, so we've proceeded with your cleaning as scheduled.

${cleanerName} will complete your cleaning on ${appointmentDate} at ${addressStr}.

WHAT THIS MEANS:
━━━━━━━━━━━━━━━━━━━━━━
• Payment will be captured (normal fees apply)
• Normal cancellation fees now apply
• If another cleaner becomes available, they may still join

Open the Kleanr app to view your appointment details.

Best regards,
Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `✅ Cleaning Confirmed: ${appointmentDate} - 1 Cleaner`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Edge case auto-proceeded email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending edge case auto-proceeded email:", error);
      throw error;
    }
  }

  /**
   * Send edge case cleaner confirmed email
   */
  static async sendEdgeCaseCleanerConfirmed(
    email,
    cleanerName,
    appointmentDate,
    homeAddress,
    appointmentId,
    fullPay = true
  ) {
    try {
      const transporter = createTransporter();

      const addressStr = homeAddress
        ? `${homeAddress.street}, ${homeAddress.city}`
        : "the home";

      const paymentMessage = fullPay
        ? "You'll receive the full cleaning pay since you're the only cleaner."
        : "Payment will be split if another cleaner joins.";

      const htmlContent = createEmailTemplate({
        title: "You're Confirmed!",
        subtitle: "Sole Cleaner Assignment",
        headerColor: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
        greeting: `Great news, ${cleanerName}!`,
        content: `<p>You're confirmed as the cleaner for the appointment on <strong>${appointmentDate}</strong> at <strong>${addressStr}</strong>.</p>
          <p>${paymentMessage}</p>`,
        infoBox: {
          icon: "💰",
          title: "Assignment Details",
          items: [
            { label: "Date", value: appointmentDate },
            { label: "Location", value: addressStr },
            { label: "Status", value: fullPay ? "Sole cleaner - full pay" : "May share with another cleaner" },
          ],
        },
        warningBox: {
          icon: "ℹ️",
          text: "A second cleaner may still join before the appointment. If they do, payment will be split between both cleaners.",
          bgColor: "#e0f2fe",
          borderColor: "#0284c7",
          textColor: "#075985",
        },
        ctaText: "Open the Kleanr app to view job details",
        footerMessage: "Thank you for being a great cleaner!",
      });

      const textContent = `You're Confirmed as Sole Cleaner!

Great news, ${cleanerName}!

You're confirmed for the cleaning on ${appointmentDate} at ${addressStr}.

${paymentMessage}

ASSIGNMENT DETAILS:
━━━━━━━━━━━━━━━━━━━━━━
Date: ${appointmentDate}
Location: ${addressStr}
Status: ${fullPay ? "Sole cleaner - full pay" : "May share with another cleaner"}

Note: A second cleaner may still join before the appointment. If they do, payment will be split.

Open the Kleanr app to view job details.

Best regards,
Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `✅ Confirmed: You're the cleaner for ${appointmentDate}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Edge case cleaner confirmed email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending edge case cleaner confirmed email:", error);
      throw error;
    }
  }

  /**
   * Send edge case cancelled email to homeowner
   */
  static async sendEdgeCaseCancelled(
    email,
    homeownerName,
    appointmentDate,
    homeAddress,
    reason
  ) {
    try {
      const transporter = createTransporter();

      const addressStr = homeAddress
        ? `${homeAddress.street}, ${homeAddress.city}`
        : "your home";

      const reasonMessage = reason === "homeowner_chose_cancel"
        ? "As you requested, your cleaning has been cancelled with no fees."
        : "Your cleaning has been cancelled due to insufficient cleaners available.";

      const htmlContent = createEmailTemplate({
        title: "Cleaning Cancelled",
        subtitle: "No Cancellation Fees Applied",
        headerColor: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
        greeting: `Hi ${homeownerName}`,
        content: `<p>${reasonMessage}</p>
          <p>Your cleaning scheduled for <strong>${appointmentDate}</strong> at <strong>${addressStr}</strong> has been cancelled.</p>
          <p><strong>No payment has been charged and no cancellation fees apply.</strong></p>`,
        infoBox: {
          icon: "📋",
          title: "Cancellation Details",
          items: [
            { label: "Original Date", value: appointmentDate },
            { label: "Location", value: addressStr },
            { label: "Payment Charged", value: "None" },
            { label: "Cancellation Fee", value: "None - waived" },
          ],
        },
        ctaText: "Ready to rebook? Open the Kleanr app to schedule a new cleaning.",
        footerMessage: "We hope to clean for you again soon!",
      });

      const textContent = `Cleaning Cancelled - No Fees Applied

Hi ${homeownerName},

${reasonMessage}

CANCELLATION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━
Original Date: ${appointmentDate}
Location: ${addressStr}
Payment Charged: None
Cancellation Fee: None - waived

Ready to rebook? Open the Kleanr app to schedule a new cleaning.

Best regards,
Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Cleaning Cancelled: ${appointmentDate} - No Fees`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Edge case cancelled email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending edge case cancelled email:", error);
      throw error;
    }
  }

  /**
   * Send edge case cleaner cancelled email
   */
  static async sendEdgeCaseCleanerCancelled(
    email,
    cleanerName,
    appointmentDate,
    homeAddress,
    reason
  ) {
    try {
      const transporter = createTransporter();

      const addressStr = homeAddress
        ? `${homeAddress.street}, ${homeAddress.city}`
        : "the home";

      const htmlContent = createEmailTemplate({
        title: "Job Cancelled",
        subtitle: "No Second Cleaner Found",
        headerColor: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
        greeting: `Hi ${cleanerName}`,
        content: `<p>Unfortunately, the cleaning you were assigned on <strong>${appointmentDate}</strong> at <strong>${addressStr}</strong> has been cancelled.</p>
          <p>The homeowner chose to cancel because we couldn't find a second cleaner for this larger home.</p>`,
        infoBox: {
          icon: "📋",
          title: "Cancellation Details",
          items: [
            { label: "Original Date", value: appointmentDate },
            { label: "Location", value: addressStr },
            { label: "Reason", value: "No second cleaner available" },
          ],
        },
        warningBox: {
          icon: "ℹ️",
          text: "Don't worry - more jobs are available in the app! Check your offers to find your next cleaning opportunity.",
          bgColor: "#e0f2fe",
          borderColor: "#0284c7",
          textColor: "#075985",
        },
        ctaText: "Open the Kleanr app to view available jobs",
        footerMessage: "Thank you for being part of the Kleanr team!",
      });

      const textContent = `Job Cancelled - No Second Cleaner Found

Hi ${cleanerName},

Unfortunately, the cleaning you were assigned on ${appointmentDate} at ${addressStr} has been cancelled.

The homeowner chose to cancel because we couldn't find a second cleaner for this larger home.

CANCELLATION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━
Original Date: ${appointmentDate}
Location: ${addressStr}
Reason: No second cleaner available

Don't worry - more jobs are available! Check your offers in the app.

Best regards,
Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Job Cancelled: ${appointmentDate} - No Second Cleaner`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Edge case cleaner cancelled email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending edge case cleaner cancelled email:", error);
      throw error;
    }
  }

  /**
   * Send second cleaner joined email to original cleaner
   */
  static async sendEdgeCaseSecondCleanerJoined(
    email,
    originalCleanerName,
    newCleanerName,
    appointmentDate,
    homeAddress,
    appointmentId
  ) {
    try {
      const transporter = createTransporter();

      const addressStr = homeAddress
        ? `${homeAddress.street}, ${homeAddress.city}`
        : "the home";

      const htmlContent = createEmailTemplate({
        title: "Good News!",
        subtitle: "A Second Cleaner Has Joined",
        headerColor: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
        greeting: `Hi ${originalCleanerName}!`,
        content: `<p>Great news! <strong>${newCleanerName}</strong> has joined you for the cleaning on <strong>${appointmentDate}</strong> at <strong>${addressStr}</strong>.</p>
          <p>Payment will be split between both of you.</p>`,
        infoBox: {
          icon: "👥",
          title: "Team Details",
          items: [
            { label: "Your Partner", value: newCleanerName },
            { label: "Date", value: appointmentDate },
            { label: "Location", value: addressStr },
            { label: "Payment", value: "Split between 2 cleaners" },
          ],
        },
        ctaText: "Open the Kleanr app to view job details and coordinate with your partner",
        footerMessage: "Teamwork makes the dream work! 🧹✨",
      });

      const textContent = `Good News! A Second Cleaner Has Joined

Hi ${originalCleanerName}!

Great news! ${newCleanerName} has joined you for the cleaning on ${appointmentDate} at ${addressStr}.

Payment will be split between both of you.

TEAM DETAILS:
━━━━━━━━━━━━━━━━━━━━━━
Your Partner: ${newCleanerName}
Date: ${appointmentDate}
Location: ${addressStr}
Payment: Split between 2 cleaners

Open the Kleanr app to view job details.

Best regards,
Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `👥 ${newCleanerName} is cleaning with you on ${appointmentDate}!`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Edge case second cleaner joined email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending edge case second cleaner joined email:", error);
      throw error;
    }
  }

  // =========================================================================
  // 2-Step Completion Confirmation Email Templates
  // =========================================================================

  /**
   * Email to homeowner when cleaner submits completion (awaiting approval)
   */
  static async sendCompletionSubmittedHomeowner(
    email,
    homeownerName,
    appointmentDate,
    address,
    cleanerName,
    hoursUntilAutoApproval
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Cleaning Complete! ✨",
        subtitle: "Please review and approve",
        headerColor: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
        greeting: `Hi ${homeownerName}!`,
        content: `<p>Great news! <strong>${cleanerName}</strong> has finished cleaning your home at <strong>${address}</strong>.</p>
          <p>Please review the cleaning and let us know how it went by tapping "Looks Good" in the app.</p>`,
        infoBox: {
          icon: "🏠",
          title: "Cleaning Details",
          items: [
            { label: "Address", value: address },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Cleaned By", value: cleanerName },
            { label: "Status", value: "⏳ Awaiting Your Approval" },
          ],
        },
        warningBox: {
          icon: "⏱️",
          text: `<strong>Auto-approval in ${hoursUntilAutoApproval} hours:</strong> If you don't respond, the cleaning will be automatically approved and payment will be sent to the cleaner.`,
          bgColor: "#e0f2fe",
          borderColor: "#0ea5e9",
          textColor: "#0369a1",
        },
        steps: {
          title: "📱 Review in the App",
          items: [
            "Open the Kleanr app",
            "Go to your Dashboard",
            'Tap "Looks Good" to approve or leave feedback',
            "Your cleaner will be paid after approval",
          ],
        },
        ctaText: "Open the Kleanr app to review your cleaning!",
        footerMessage: "Thank you for choosing Kleanr",
      });

      const textContent = `Hi ${homeownerName}!

Great news! ${cleanerName} has finished cleaning your home at ${address}.

Please review the cleaning and let us know how it went.

CLEANING DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Address: ${address}
Date: ${formatDate(appointmentDate)}
Cleaned By: ${cleanerName}
Status: ⏳ Awaiting Your Approval

⏱️ AUTO-APPROVAL IN ${hoursUntilAutoApproval} HOURS
If you don't respond, the cleaning will be automatically approved and payment will be sent to the cleaner.

HOW TO REVIEW
━━━━━━━━━━━━━━━━━━━━━━
1. Open the Kleanr app
2. Go to your Dashboard
3. Tap "Looks Good" to approve or leave feedback
4. Your cleaner will be paid after approval

Open the Kleanr app to review your cleaning!

Thank you for choosing Kleanr!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `✨ ${cleanerName} finished cleaning - Please Review!`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Completion submitted email sent to homeowner:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending completion submitted email:", error);
    }
  }

  /**
   * Email to homeowner when cleaning is auto-approved
   */
  static async sendCompletionAutoApproved(
    email,
    homeownerName,
    appointmentDate,
    address,
    cleanerName
  ) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Cleaning Auto-Approved",
        subtitle: "Payment sent to cleaner",
        headerColor: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        greeting: `Hi ${homeownerName}!`,
        content: `<p>Your cleaning on <strong>${formatDate(appointmentDate)}</strong> at <strong>${address}</strong> has been <strong>auto-approved</strong> because the approval window has passed.</p>
          <p>Payment has been sent to <strong>${cleanerName}</strong>.</p>`,
        infoBox: {
          icon: "✅",
          title: "Approval Details",
          items: [
            { label: "Address", value: address },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Cleaner", value: cleanerName },
            { label: "Status", value: "✅ Auto-Approved" },
          ],
        },
        warningBox: {
          icon: "⭐",
          text: "<strong>We'd love your feedback!</strong> Even though the cleaning was auto-approved, you can still leave a review for your cleaner.",
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        },
        ctaText: "Open the Kleanr app to leave a review!",
        footerMessage: "Thank you for choosing Kleanr",
      });

      const textContent = `Hi ${homeownerName}!

Your cleaning on ${formatDate(appointmentDate)} at ${address} has been auto-approved because the approval window has passed.

Payment has been sent to ${cleanerName}.

APPROVAL DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Address: ${address}
Date: ${formatDate(appointmentDate)}
Cleaner: ${cleanerName}
Status: ✅ Auto-Approved

⭐ LEAVE A REVIEW
Even though the cleaning was auto-approved, you can still leave a review for your cleaner.

Open the Kleanr app to leave a review!

Thank you for choosing Kleanr!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `✅ Cleaning Auto-Approved - ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Completion auto-approved email sent to homeowner:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending completion auto-approved email:", error);
    }
  }

  /**
   * Email to cleaner when their work is approved
   */
  static async sendCompletionApprovedCleaner(
    email,
    cleanerName,
    appointmentDate,
    payoutAmount
  ) {
    try {
      const transporter = createTransporter();
      const formattedPayout = payoutAmount
        ? `$${parseFloat(payoutAmount).toFixed(2)}`
        : "Your share";

      const htmlContent = createEmailTemplate({
        title: "Job Approved! 🎉",
        subtitle: "Payment is on the way",
        headerColor: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
        greeting: `Congratulations, ${cleanerName}!`,
        content: `<p>Your cleaning job on <strong>${formatDate(appointmentDate)}</strong> has been approved!</p>
          <p>Payment of <strong>${formattedPayout}</strong> is being processed and will be sent to your connected bank account.</p>`,
        infoBox: {
          icon: "💰",
          title: "Payment Details",
          items: [
            { label: "Job Date", value: formatDate(appointmentDate) },
            { label: "Amount", value: formattedPayout },
            { label: "Status", value: "✅ Approved & Processing" },
          ],
        },
        warningBox: {
          icon: "🏦",
          text: "<strong>Payment Timeline:</strong> Payouts typically arrive in your bank account within 1-2 business days.",
          bgColor: "#e0f2fe",
          borderColor: "#0ea5e9",
          textColor: "#0369a1",
        },
        ctaText: "Keep up the great work!",
        footerMessage: "Thank you for being a Kleanr pro",
      });

      const textContent = `Congratulations, ${cleanerName}!

Your cleaning job on ${formatDate(appointmentDate)} has been approved!

Payment of ${formattedPayout} is being processed and will be sent to your connected bank account.

PAYMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Job Date: ${formatDate(appointmentDate)}
Amount: ${formattedPayout}
Status: ✅ Approved & Processing

🏦 PAYMENT TIMELINE
Payouts typically arrive in your bank account within 1-2 business days.

Keep up the great work!

Thank you for being a Kleanr pro!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🎉 Job Approved - Payment on the way!`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Completion approved email sent to cleaner:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending completion approved email to cleaner:", error);
    }
  }

  /**
   * Email to user when appeal is submitted
   */
  static async sendAppealSubmittedConfirmation(user, appeal) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "Appeal Submitted",
        subtitle: "We've received your cancellation appeal",
        headerColor: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        greeting: `Hi ${user.firstName}!`,
        content: `<p>Thank you for submitting your cancellation appeal. Our team will review your case carefully.</p>
          <p>We aim to respond within <strong>48 hours</strong> of submission.</p>`,
        infoBox: {
          icon: "📝",
          title: "Appeal Details",
          items: [
            { label: "Appeal ID", value: `#${appeal.id}` },
            { label: "Category", value: appeal.category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) },
            { label: "Status", value: "🔍 Under Review" },
            { label: "Priority", value: appeal.priority.charAt(0).toUpperCase() + appeal.priority.slice(1) },
          ],
        },
        steps: {
          title: "What happens next?",
          items: [
            "Our team will review your appeal and any supporting documents",
            "We may reach out if we need additional information",
            "You'll receive a notification once a decision is made",
            "If approved, any applicable fees will be refunded automatically",
          ],
        },
        warningBox: {
          icon: "📎",
          text: "<strong>Have documentation?</strong> Upload supporting documents (medical notes, photos, etc.) through the app to strengthen your appeal.",
          bgColor: "#f0f9ff",
          borderColor: "#0ea5e9",
          textColor: "#0369a1",
        },
        ctaText: "You can check your appeal status anytime in the Kleanr app.",
        footerMessage: "Thank you for your patience",
      });

      const textContent = `Hi ${user.firstName}!

Thank you for submitting your cancellation appeal. Our team will review your case carefully.

We aim to respond within 48 hours of submission.

APPEAL DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Appeal ID: #${appeal.id}
Category: ${appeal.category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
Status: 🔍 Under Review
Priority: ${appeal.priority.charAt(0).toUpperCase() + appeal.priority.slice(1)}

WHAT HAPPENS NEXT?
1. Our team will review your appeal and any supporting documents
2. We may reach out if we need additional information
3. You'll receive a notification once a decision is made
4. If approved, any applicable fees will be refunded automatically

📎 HAVE DOCUMENTATION?
Upload supporting documents (medical notes, photos, etc.) through the app to strengthen your appeal.

You can check your appeal status anytime in the Kleanr app.

Thank you for your patience!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: `📝 Appeal Submitted - Reference #${appeal.id}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Appeal submitted confirmation email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending appeal submitted email:", error);
    }
  }

  /**
   * Email to user when appeal is resolved
   */
  static async sendAppealResolved(user, appeal, decision) {
    try {
      const transporter = createTransporter();

      const isApproved = decision === "approve" || decision === "partial";
      const headerColor = isApproved
        ? "linear-gradient(135deg, #10b981 0%, #34d399 100%)"
        : "linear-gradient(135deg, #ef4444 0%, #f87171 100%)";

      const statusText = decision === "approve" ? "✅ Approved"
        : decision === "partial" ? "✅ Partially Approved"
          : "❌ Denied";

      const resolution = appeal.resolution || {};

      const content = isApproved
        ? `<p>Great news! Your cancellation appeal has been <strong>${decision === "approve" ? "approved" : "partially approved"}</strong>.</p>
           ${resolution.penaltyWaived ? "<p>✅ Cancellation penalty has been waived.</p>" : ""}
           ${resolution.feeRefunded ? `<p>✅ Cancellation fee of $${((resolution.refundAmount || 0) / 100).toFixed(2)} will be refunded.</p>` : ""}
           ${resolution.accountUnfrozen ? "<p>✅ Your account has been unfrozen.</p>" : ""}
           ${resolution.ratingRemoved ? "<p>✅ Any penalty ratings have been removed.</p>" : ""}`
        : `<p>After careful review, we were unable to approve your cancellation appeal.</p>
           <p>${appeal.reviewDecision || "If you have additional information that might support your case, please contact our support team."}</p>`;

      const htmlContent = createEmailTemplate({
        title: "Appeal Decision",
        subtitle: `Your appeal has been ${decision === "approve" ? "approved" : decision === "partial" ? "partially approved" : "reviewed"}`,
        headerColor,
        greeting: `Hi ${user.firstName}!`,
        content,
        infoBox: {
          icon: isApproved ? "🎉" : "📋",
          title: "Decision Summary",
          items: [
            { label: "Appeal ID", value: `#${appeal.id}` },
            { label: "Decision", value: statusText },
            { label: "Reviewed On", value: new Date().toLocaleDateString() },
          ],
        },
        warningBox: isApproved ? {
          icon: "💰",
          text: "<strong>Refund Timeline:</strong> Any approved refunds will be processed within 3-5 business days.",
          bgColor: "#e0f2fe",
          borderColor: "#0ea5e9",
          textColor: "#0369a1",
        } : {
          icon: "💬",
          text: "<strong>Questions?</strong> If you believe this decision was made in error or have additional documentation, please contact our support team.",
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        },
        ctaText: isApproved ? "Thank you for your patience during the review process." : "We value your business and hope to serve you better in the future.",
        footerMessage: "Thank you for using Kleanr",
      });

      const textContent = `Hi ${user.firstName}!

${isApproved
    ? `Great news! Your cancellation appeal has been ${decision === "approve" ? "approved" : "partially approved"}.
${resolution.penaltyWaived ? "✅ Cancellation penalty has been waived.\n" : ""}${resolution.feeRefunded ? `✅ Cancellation fee of $${((resolution.refundAmount || 0) / 100).toFixed(2)} will be refunded.\n` : ""}${resolution.accountUnfrozen ? "✅ Your account has been unfrozen.\n" : ""}${resolution.ratingRemoved ? "✅ Any penalty ratings have been removed.\n" : ""}`
    : `After careful review, we were unable to approve your cancellation appeal.

${appeal.reviewDecision || "If you have additional information that might support your case, please contact our support team."}`}

DECISION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━
Appeal ID: #${appeal.id}
Decision: ${statusText}
Reviewed On: ${new Date().toLocaleDateString()}

${isApproved
    ? `💰 REFUND TIMELINE
Any approved refunds will be processed within 3-5 business days.

Thank you for your patience during the review process.`
    : `💬 QUESTIONS?
If you believe this decision was made in error or have additional documentation, please contact our support team.

We value your business and hope to serve you better in the future.`}

Thank you for using Kleanr!

Best regards,
Kleanr Support Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: isApproved
          ? `✅ Appeal Approved - Reference #${appeal.id}`
          : `📋 Appeal Decision - Reference #${appeal.id}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Appeal resolved email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending appeal resolved email:", error);
    }
  }

  // =========================================================================
  // Auto-Complete Reminder Notifications
  // =========================================================================

  /**
   * Send auto-complete reminder to cleaner
   * @param {string} email - Cleaner's email
   * @param {string} cleanerName - Cleaner's first name
   * @param {string} date - Appointment date
   * @param {string} address - Home address
   * @param {number} reminderNum - Reminder number (1-5)
   * @param {number} minutesLeft - Minutes until auto-complete
   */
  static async sendAutoCompleteReminder(email, cleanerName, date, address, reminderNum, minutesLeft) {
    try {
      const urgencyLevel = reminderNum >= 4 ? "URGENT" : reminderNum >= 3 ? "Important" : "";
      const hoursLeft = Math.floor(minutesLeft / 60);
      const timeRemaining = hoursLeft > 0 ? `${hoursLeft} hours` : `${minutesLeft} minutes`;

      const reminderMessages = {
        1: "This is a friendly reminder to mark your job complete in the app.",
        2: `Your job will automatically be marked complete in ${timeRemaining}. Please submit your completion now to ensure everything is recorded correctly.`,
        3: `You have ${timeRemaining} remaining to mark this job complete yourself. After that, the system will auto-complete it.`,
        4: "URGENT: Please mark your job complete now! Only about 1 hour remaining.",
        5: `FINAL REMINDER: Your job will be auto-completed in ${minutesLeft} minutes. Mark it complete now to avoid automatic submission.`,
      };

      const html = createEmailTemplate({
        title: urgencyLevel ? `${urgencyLevel}: Complete Your Job` : "Reminder: Complete Your Job",
        subtitle: `Job on ${date}`,
        greeting: `Hi ${cleanerName}!`,
        content: `<p>${reminderMessages[reminderNum] || reminderMessages[1]}</p>`,
        infoBox: {
          icon: "📍",
          title: "Job Details",
          items: [
            { label: "Date", value: date },
            { label: "Address", value: address },
            { label: "Time Remaining", value: timeRemaining },
          ],
        },
        warningBox: reminderNum >= 4 ? {
          icon: "⚠️",
          text: "If you don't mark the job complete, the system will auto-submit it and the homeowner will have 24 hours to review.",
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        } : null,
        ctaText: "Open the Kleanr app to mark your job complete.",
        headerColor: reminderNum >= 4
          ? "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)"
          : reminderNum >= 3
          ? "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)"
          : "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `${urgencyLevel ? `[${urgencyLevel}] ` : ""}Reminder: Mark Your Job on ${date} Complete`,
        html,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Auto-complete reminder email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending auto-complete reminder email:", error);
    }
  }

  /**
   * Notify cleaner that their job was auto-completed by the system
   * @param {string} email - Cleaner's email
   * @param {string} cleanerName - Cleaner's first name
   * @param {string} date - Appointment date
   * @param {string} address - Home address
   */
  static async sendJobAutoCompleted(email, cleanerName, date, address) {
    try {
      const html = createEmailTemplate({
        title: "Job Auto-Completed",
        subtitle: `Job on ${date}`,
        greeting: `Hi ${cleanerName}!`,
        content: `<p>Your job was automatically marked as complete by our system because it wasn't submitted within the required timeframe after the scheduled end.</p>`,
        infoBox: {
          icon: "📍",
          title: "Job Details",
          items: [
            { label: "Date", value: date },
            { label: "Address", value: address },
            { label: "Status", value: "Submitted for Review" },
          ],
        },
        warningBox: {
          icon: "ℹ️",
          text: "The homeowner now has 24 hours to review the job. If they don't respond, payment will be automatically released.",
          bgColor: "#dbeafe",
          borderColor: "#3b82f6",
          textColor: "#1e40af",
        },
        ctaText: "In the future, please remember to mark your jobs complete in the app right after finishing.",
        headerColor: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Your Job on ${date} Was Auto-Completed`,
        html,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Job auto-completed email sent to cleaner:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending job auto-completed email:", error);
    }
  }

  /**
   * Notify homeowner that a job was auto-completed and needs review
   * @param {string} email - Homeowner's email
   * @param {string} homeownerName - Homeowner's first name
   * @param {string} date - Appointment date
   * @param {string} cleanerName - Cleaner's first name
   */
  static async sendJobAutoCompletedHomeowner(email, homeownerName, date, cleanerName) {
    try {
      const html = createEmailTemplate({
        title: "Your Cleaning is Complete!",
        subtitle: `Please Review Within 24 Hours`,
        greeting: `Hi ${homeownerName}!`,
        content: `<p>Good news! ${cleanerName} has finished cleaning your home on ${date}. The job has been submitted for your review.</p>`,
        infoBox: {
          icon: "🏠",
          title: "Cleaning Details",
          items: [
            { label: "Date", value: date },
            { label: "Cleaner", value: cleanerName },
            { label: "Status", value: "Awaiting Your Review" },
          ],
        },
        warningBox: {
          icon: "⏰",
          text: "You have 24 hours to review the cleaning. If you don't respond, payment will be automatically released to the cleaner.",
          bgColor: "#fef3c7",
          borderColor: "#f59e0b",
          textColor: "#92400e",
        },
        ctaText: "Open the Kleanr app to review the cleaning and approve or report any issues.",
        headerColor: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Action Required: Review Your Cleaning on ${date}`,
        html,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Job auto-completed email sent to homeowner:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending job auto-completed homeowner email:", error);
    }
  }

  /**
   * Notify an employee that they have been assigned to a job
   * @param {string} email - Employee's email
   * @param {string} employeeName - Employee's first name
   * @param {string} appointmentDate - The job date
   * @param {string} clientName - Client's name
   * @param {string} address - Job address
   * @param {number} payAmount - Pay amount in cents
   * @param {string} businessName - Business owner's business name
   */
  static async sendEmployeeJobAssigned(email, employeeName, appointmentDate, clientName, address, payAmount, businessName) {
    try {
      const transporter = createTransporter();
      const payDisplay = payAmount ? `$${(payAmount / 100).toFixed(2)}` : "TBD";

      const htmlContent = createEmailTemplate({
        title: "New Job Assigned",
        subtitle: `You've been assigned to a cleaning job`,
        headerColor: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
        greeting: `Hi ${employeeName}! 👋`,
        content: `<p>Great news! You've been assigned a new cleaning job by ${businessName}. Here are the details:</p>`,
        infoBox: {
          icon: "📋",
          title: "Job Details",
          items: [
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Client", value: clientName },
            { label: "Address", value: address },
            { label: "Your Pay", value: payDisplay },
          ],
        },
        steps: {
          title: "📱 Next Steps",
          items: [
            "Open the Kleanr app to view full job details",
            "Check the job date on your calendar",
            "On the day of the job, tap 'Start Job' when you arrive",
          ],
        },
        ctaText: "Log into the app to view more details about this job.",
        footerMessage: "Good luck with your job!",
      });

      const textContent = `Hi ${employeeName}!

Great news! You've been assigned a new cleaning job by ${businessName}.

JOB DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Date: ${formatDate(appointmentDate)}
Client: ${clientName}
Address: ${address}
Your Pay: ${payDisplay}

NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━
1. Open the Kleanr app to view full job details
2. Check the job date on your calendar
3. On the day of the job, tap 'Start Job' when you arrive

Log into the app to view more details about this job.

Best regards,
${businessName}`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `🧹 New Job Assigned - ${formatDate(appointmentDate)}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Employee job assigned email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending employee job assigned email:", error);
    }
  }

  /**
   * Send payment dispute notification to HR/Owner
   */
  static async sendPaymentDisputeNotification(
    email,
    staffName,
    dispute,
    cleaner,
    appointment
  ) {
    try {
      const transporter = createTransporter();

      const issueTypeLabels = {
        missing_payout: "Missing Payment",
        wrong_amount: "Incorrect Amount",
        delayed_payout: "Delayed Payment",
      };

      const htmlContent = createEmailTemplate({
        title: "Payment Dispute Submitted",
        subtitle: "Cleaner reported a payment issue",
        headerColor: "linear-gradient(135deg, #ef4444 0%, #f87171 100%)",
        greeting: `Hi ${staffName},`,
        content: `<p>A cleaner has submitted a payment dispute that requires your attention. Please review and resolve within the 48-hour SLA.</p>`,
        infoBox: {
          icon: "💰",
          title: "Dispute Details",
          items: [
            { label: "Issue Type", value: issueTypeLabels[dispute.issueType] || dispute.issueType },
            { label: "Cleaner", value: cleaner.firstName || cleaner.username },
            { label: "Appointment Date", value: appointment?.date ? formatDate(appointment.date) : "N/A" },
            { label: "Priority", value: dispute.priority === "high" ? "🔴 High" : "Normal" },
            ...(dispute.expectedAmount ? [{ label: "Expected Amount", value: `$${(dispute.expectedAmount / 100).toFixed(2)}` }] : []),
            ...(dispute.receivedAmount ? [{ label: "Received Amount", value: `$${(dispute.receivedAmount / 100).toFixed(2)}` }] : []),
          ],
        },
        warningBox: dispute.description ? {
          icon: "💬",
          text: `<strong>Description:</strong> "${dispute.description}"`,
          bgColor: "#fee2e2",
          borderColor: "#ef4444",
          textColor: "#991b1b",
        } : null,
        ctaText: "Please review this dispute in the Conflict Resolution Center.",
        footerMessage: "This requires your attention within 48 hours",
      });

      const textContent = `Hi ${staffName},

A cleaner has submitted a payment dispute that requires your attention.

DISPUTE DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Issue Type: ${issueTypeLabels[dispute.issueType] || dispute.issueType}
Cleaner: ${cleaner.firstName || cleaner.username}
Appointment Date: ${appointment?.date ? formatDate(appointment.date) : "N/A"}
Priority: ${dispute.priority === "high" ? "HIGH" : "Normal"}
${dispute.expectedAmount ? `Expected Amount: $${(dispute.expectedAmount / 100).toFixed(2)}` : ""}
${dispute.receivedAmount ? `Received Amount: $${(dispute.receivedAmount / 100).toFixed(2)}` : ""}

${dispute.description ? `Description: "${dispute.description}"` : ""}

Please review this dispute in the Conflict Resolution Center within 48 hours.

Best regards,
Kleanr System`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `⚠️ Payment Dispute - ${issueTypeLabels[dispute.issueType] || dispute.issueType} - Dispute #${dispute.id}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Payment dispute notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending payment dispute notification email:", error);
    }
  }

  /**
   * Send unassigned appointment reminder to business owner
   * @param {string} email - Business owner's email
   * @param {string} appointmentDate - The appointment date
   * @param {string} clientName - The client's name
   * @param {number} daysUntil - Days until the appointment
   * @param {number} reminderCount - How many reminders have been sent
   */
  static async sendUnassignedReminderToBo(email, appointmentDate, clientName, daysUntil, reminderCount) {
    try {
      const transporter = createTransporter();

      // Determine urgency level
      const isUrgent = daysUntil <= 1;
      const isWarning = daysUntil <= 2;
      const urgencyPrefix = isUrgent ? "🚨 URGENT: " : isWarning ? "⚠️ " : "";
      const daysText = daysUntil === 0 ? "TODAY" : daysUntil === 1 ? "TOMORROW" : `in ${daysUntil} days`;

      const headerColor = isUrgent
        ? "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)"
        : isWarning
          ? "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)"
          : "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)";

      const htmlContent = createEmailTemplate({
        title: `${urgencyPrefix}Unassigned Appointment`,
        subtitle: `Action required: Assign someone to this job`,
        headerColor,
        greeting: `Hi there! 👋`,
        content: `<p>You have an appointment ${daysText} that still needs someone assigned. Please assign yourself or a team member to ensure the job gets done.</p>`,
        infoBox: {
          icon: "📋",
          title: "Appointment Details",
          items: [
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Client", value: clientName },
            { label: "Status", value: "⚠️ Unassigned" },
          ],
        },
        warningBox: isUrgent ? {
          title: "Immediate Action Required",
          content: "This appointment is coming up very soon. Please assign someone right away to avoid disappointing your client.",
        } : null,
        steps: {
          title: "📱 How to Assign",
          items: [
            "Open the Kleanr app",
            "Go to your Business Dashboard",
            "Tap on the appointment or 'Assign Jobs'",
            "Select yourself or an employee to assign",
          ],
        },
        ctaText: "Open the app now to assign someone to this job.",
        footerMessage: "Don't leave your client waiting!",
      });

      const textContent = `${urgencyPrefix}UNASSIGNED APPOINTMENT REMINDER

Hi there!

You have an appointment ${daysText} that still needs someone assigned.

APPOINTMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Date: ${formatDate(appointmentDate)}
Client: ${clientName}
Status: ⚠️ Unassigned

${isUrgent ? `⚠️ IMMEDIATE ACTION REQUIRED
This appointment is coming up very soon. Please assign someone right away.

` : ""}HOW TO ASSIGN
━━━━━━━━━━━━━━━━━━━━━━
1. Open the Kleanr app
2. Go to your Business Dashboard
3. Tap on the appointment or 'Assign Jobs'
4. Select yourself or an employee to assign

Open the app now to assign someone to this job.

Best regards,
The Kleanr Team`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `${urgencyPrefix}Unassigned Appointment ${daysText} - ${clientName}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await sendMailWithResolution(transporter, mailOptions);
      console.log("✅ Unassigned reminder email sent to business owner:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending unassigned reminder email:", error);
    }
  }
}

module.exports = Email;

// Export helper functions for testing
module.exports.resolveRecipientEmail = resolveRecipientEmail;
module.exports.sendMailWithResolution = sendMailWithResolution;
