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
        subject:
          "DO NOT REPLY: Employment Notification (Automated Message)",
        text: `Dear ${firstName} ${lastName},

Congragulations! You have been selected to be a cleaner for Kleanr!
You can login to the app using the following username and password.


- Username: ${username}

- Password: ${password}


Please log into the app to find cleaning jobs you'd like to take on!

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
}

module.exports = Email;
