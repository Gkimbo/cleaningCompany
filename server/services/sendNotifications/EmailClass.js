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

      const roleTitle = type === "manager" ? "Manager" : "Cleaner";

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
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">You're officially part of the team</p>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px;">Hi ${firstName} ${lastName}! 👋</h2>

        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
          Congratulations on joining Kleanr as a <strong>${roleTitle}</strong>! We're thrilled to have you on board. Your account has been created and you're ready to get started.
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
        <h3 style="color: #1e293b; margin: 30px 0 15px 0; font-size: 18px;">🚀 Getting Started</h3>
        <ol style="color: #475569; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Download the Kleanr app or visit our website</li>
          <li style="margin-bottom: 8px;">Log in using the credentials above</li>
          <li style="margin-bottom: 8px;">Update your password in Account Settings</li>
          <li style="margin-bottom: 8px;">Browse available cleaning jobs and start earning!</li>
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

Hi ${firstName} ${lastName}!

Congratulations on joining Kleanr as a ${roleTitle}! We're thrilled to have you on board.

YOUR LOGIN CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━
Username: ${username}
Password: ${password}

GETTING STARTED
━━━━━━━━━━━━━━━━━━━━━━
1. Download the Kleanr app or visit our website
2. Log in using the credentials above
3. Update your password in Account Settings
4. Browse available cleaning jobs and start earning!

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
        subject: `🎉 Welcome to Kleanr, ${firstName}! Your Account is Ready`,
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

  static async sendNewApplicationNotification(managerEmail, applicantName, applicantEmail, experience) {
    try {
      const transporter = createTransporter();

      const htmlContent = createEmailTemplate({
        title: "New Application",
        subtitle: "A cleaner wants to join the team",
        headerColor: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
        greeting: "Hello Manager! 📋",
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
            "Log into the Kleanr manager dashboard",
            "Go to the Applications section",
            "Review the full application details",
            "Approve or decline the application",
          ],
        },
        ctaText: "Please review this application at your earliest convenience.",
        footerMessage: "Kleanr Management",
      });

      const textContent = `Hello Manager!

A new cleaner application has been submitted and is ready for your review.

APPLICANT DETAILS
━━━━━━━━━━━━━━━━━━━━━━
Name: ${applicantName}
Email: ${applicantEmail}
Experience: ${experience || "Not specified"}

NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━
1. Log into the Kleanr manager dashboard
2. Go to the Applications section
3. Review the full application details
4. Approve or decline the application

Please review this application at your earliest convenience.

Best regards,
Kleanr System`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: managerEmail,
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
}

module.exports = Email;
