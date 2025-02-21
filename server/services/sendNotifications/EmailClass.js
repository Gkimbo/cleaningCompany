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
}

module.exports = Email;
