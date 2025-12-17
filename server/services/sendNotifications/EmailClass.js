const nodemailer = require("nodemailer");

class Email {
  static async sendEmailCancellation(
    email,
    address,
    userName,
    appointmentDate
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

      const formattedDate = (dateString) => {
        const options = {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        };
        return new Date(dateString).toLocaleDateString(undefined, options);
      };

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject:
          "DO NOT REPLY: Appointment Cancellation Notice (Automated Message)",
        text: `Dear ${userName},
  
  We regret to inform you that your scheduled cleaning appointment has been cancelled. 
  
  Appointment Details:
  - Address: ${address.street}, ${address.city}, ${address.state}, ${
          address.zipcode
        }
  - Date: ${formattedDate(appointmentDate)}
  
  We sincerely apologize for any inconvenience this may cause. Your appointment is still up for cleaners to select. You will get another email when your cleaning has been selected.
  
  Best regards,
  Kleanr Support Team`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Email sent successfully:", info.response);
    } catch (error) {
      console.error("❌ Error sending email:", error);
    }
  }
  static async sendEmailConfirmation(
    email,
    address,
    userName,
    appointmentDate
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

      const formattedDate = (dateString) => {
        const options = {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        };
        return new Date(dateString).toLocaleDateString(undefined, options);
      };

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "DO NOT REPLY: Appointment Confirmation (Automated Message)",
        text: `Dear ${userName},
  
  We are pleased to inform you that a cleaner has confirmed your scheduled cleaning appointment.
  
  Appointment Details:
  - Address: ${address.street}, ${address.city}, ${address.state}, ${
          address.zipcode
        }
  - Date: ${formattedDate(appointmentDate)}
  
  If you have any questions or need to make changes to your appointment, please log onto the app and go to your appointments.
  
  Thank you for choosing Kleanr. We look forward to serving you.
  
  Best regards,
  Kleanr Support Team`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Email sent successfully:", info.response);
    } catch (error) {
      console.error("❌ Error sending email:", error);
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
      console.log(email, username, password, type);
      const formattedDate = (dateString) => {
        const options = {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        };
        return new Date(dateString).toLocaleDateString(undefined, options);
      };

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Welcome to Kleanr - Your Login Credentials",
        text: `Dear ${firstName} ${lastName},

Congratulations! You have been hired as a cleaner for Kleanr!

You can login to the app using the following credentials:

Username: ${username}
Password: ${password}

Please log into the app to find cleaning jobs you'd like to take on!

For security, we recommend changing your password after your first login.

Best regards,
Kleanr Support Team`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Email sent successfully:", info.response);
      return "✅ Email sent successfully:", info.response;
    } catch (error) {
      console.error("❌ Error sending email:", error);
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
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
      console.log(email, userName, cleanerName, cleanerRating, appointmentDate);
      const formattedDate = (dateString) => {
        const options = {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        };
        return new Date(dateString).toLocaleDateString(undefined, options);
      };

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject:
          "DO NOT REPLY: Cleaner Request Notification (Automated Message)",
        text: `Dear ${userName},

A cleaner has requested to clean your home. Here are the details of the cleaner:


- Name: ${cleanerName}

- Rating: ${
          cleanerRating !== "No ratings yet"
            ? `${cleanerRating} ⭐`
            : cleanerRating
        }

- Requested Date: ${formattedDate(appointmentDate)}


Please log into the app to confirm or decline the request.

Best regards,  
Kleanr Support Team`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Email sent successfully:", info.response);
      return "✅ Email sent successfully:", info.response;
    } catch (error) {
      console.error("❌ Error sending email:", error);
    }
  }

  static async removeRequestEmail(
    email,
    userName,
    appointmentDate
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

      const formattedDate = (dateString) => {
        const options = {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        };
        return new Date(dateString).toLocaleDateString(undefined, options);
      };

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject:
          "DO NOT REPLY: Cleaner Request Removal Notification (Automated Message)",
        text: `Dear ${userName},

A cleaner has removed their request to clean your home on ${formattedDate(appointmentDate)}.
You do not need to do anything at this time.

Best regards,
Kleanr Support Team`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Email sent successfully:", info.response);
      return "✅ Email sent successfully:", info.response;
    } catch (error) {
      console.error("❌ Error sending email:", error);
    }
  }

  static async sendNewMessageNotification(email, userName, senderName, messagePreview) {
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

      const truncatedMessage = messagePreview.length > 100
        ? messagePreview.substring(0, 100) + '...'
        : messagePreview;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "DO NOT REPLY: New Message Notification (Automated Message)",
        text: `Dear ${userName},

You have received a new message from ${senderName}:

"${truncatedMessage}"

Please log into the Kleanr app to view and respond to this message.

Best regards,
Kleanr Support Team`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Message notification email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending message notification email:", error);
    }
  }

  static async sendBroadcastNotification(email, userName, title, content) {
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

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `DO NOT REPLY: ${title} (Automated Message)`,
        text: `Dear ${userName},

${content}

Please log into the Kleanr app for more details.

Best regards,
Kleanr Support Team`,
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
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "DO NOT REPLY: Username Recovery (Automated Message)",
        text: `Hello,

You requested to recover your username for your Kleanr account.

Your username is: ${username}

If you did not request this, please ignore this email.

Best regards,
Kleanr Support Team`,
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
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "DO NOT REPLY: Password Reset (Automated Message)",
        text: `Hello ${username},

You requested to reset your password for your Kleanr account.

Your temporary password is: ${temporaryPassword}

Please log in with this temporary password and change it immediately in your Account Settings for security.

If you did not request this password reset, please contact support immediately.

Best regards,
Kleanr Support Team`,
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
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const formattedDate = (dateString) => {
        const options = {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        };
        return new Date(dateString).toLocaleDateString(undefined, options);
      };

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "DO NOT REPLY: Cleaning Request Approved! (Automated Message)",
        text: `Dear ${cleanerName},

Great news! Your request to clean has been approved by ${homeownerName}.

Appointment Details:
- Address: ${address.street}, ${address.city}, ${address.state}, ${address.zipcode}
- Date: ${formattedDate(appointmentDate)}

Please log into the Kleanr app to view the full details of your upcoming appointment.

Thank you for being a part of the Kleanr team!

Best regards,
Kleanr Support Team`,
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
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const formattedDate = (dateString) => {
        const options = {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        };
        return new Date(dateString).toLocaleDateString(undefined, options);
      };

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "DO NOT REPLY: Cleaning Request Update (Automated Message)",
        text: `Dear ${cleanerName},

We wanted to let you know that your request to clean on ${formattedDate(appointmentDate)} was not approved by the homeowner.

Don't worry - there are plenty of other cleaning opportunities available! Please log into the Kleanr app to browse and request other available appointments.

Thank you for being a part of the Kleanr team!

Best regards,
Kleanr Support Team`,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Request denied email sent:", info.response);
      return info.response;
    } catch (error) {
      console.error("❌ Error sending request denied email:", error);
    }
  }
}

module.exports = Email;
