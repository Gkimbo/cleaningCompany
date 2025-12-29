const nodemailer = require("nodemailer");

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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Welcome email sent successfully:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending welcome email:", error);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Password reset email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending password reset email:", error);
      throw error;
    }
  }

  static async sendRequestApproved(email, cleanerName, homeownerName, address, appointmentDate) {
    try {
      const transporter = createTransporter();
      const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zipcode}`;

      const htmlContent = createEmailTemplate({
        title: "Request Approved! 🎉",
        subtitle: "You've got a cleaning job",
        headerColor: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        greeting: `Congratulations, ${cleanerName}! 🎊`,
        content: `<p>Great news! <strong>${homeownerName}</strong> has approved your request to clean their home. You're all set for your upcoming appointment!</p>`,
        infoBox: {
          icon: "📍",
          title: "Appointment Details",
          items: [
            { label: "Homeowner", value: homeownerName },
            { label: "Address", value: fullAddress },
            { label: "Date", value: formatDate(appointmentDate) },
            { label: "Status", value: "✅ Approved" },
          ],
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
Address: ${fullAddress}
Date: ${formatDate(appointmentDate)}
Status: ✅ Approved

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

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Request approved email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending request approved email:", error);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Adjustment resolved email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending adjustment resolved email:", error);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Application rejection email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending application rejection email:", error);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ HR hiring notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending HR hiring notification email:", error);
    }
  }
}

module.exports = Email;
