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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Payment reminder email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending payment reminder email:", error);
      throw error;
    }
  }

  /**
   * Send payout notification to cleaner
   */
  static async sendPayoutNotification(
    email,
    cleanerName,
    clientName,
    appointmentDate,
    homeAddress,
    grossAmount,
    platformFee,
    netAmount
  ) {
    try {
      const transporter = createTransporter();

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
            { label: "Platform Fee (10%)", value: `-$${parseFloat(platformFee).toFixed(2)}` },
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
Platform Fee (10%): -$${parseFloat(platformFee).toFixed(2)}
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ New client appointment email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending new client appointment email:", error);
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

      const info = await transporter.sendMail(mailOptions);
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

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Preferred cleaner booking notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending preferred cleaner booking notification email:", error);
      throw error;
    }
  }
}

module.exports = Email;
