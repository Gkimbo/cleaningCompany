import React, { useState } from "react";

const CleanerApplicationForm = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    experience: "",
    availability: "",
    message: "",
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // You can send the form data to your backend here
    console.log("Form submitted:", formData);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
        <h1>Thank You for Applying!</h1>
        <p>
          Your application has been submitted successfully. We will review your
          information and get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Cleaner Job Application</h1>
      <p>
        Please fill out the form below to apply for a position as a cleaner with
        our company.
      </p>
      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Full Name */}
        <label>
          <strong>Full Name</strong>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            required
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              marginTop: "4px",
            }}
          />
        </label>

        {/* Email */}
        <label>
          <strong>Email Address</strong>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              marginTop: "4px",
            }}
          />
        </label>

        {/* Phone */}
        <label>
          <strong>Phone Number</strong>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              marginTop: "4px",
            }}
          />
        </label>

        {/* Experience */}
        <label>
          <strong>Experience</strong>
          <select
            name="experience"
            value={formData.experience}
            onChange={handleChange}
            required
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              marginTop: "4px",
            }}
          >
            <option value="" disabled>
              Select your experience level
            </option>
            <option value="No experience">No experience</option>
            <option value="Less than 1 year">Less than 1 year</option>
            <option value="1-2 years">1-2 years</option>
            <option value="3+ years">3+ years</option>
          </select>
        </label>

        {/* Availability */}
        <label>
          <strong>Availability</strong>
          <textarea
            name="availability"
            value={formData.availability}
            onChange={handleChange}
            required
            placeholder="E.g., Mondays, Fridays, weekends only"
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              marginTop: "4px",
              height: "80px",
            }}
          />
        </label>

        {/* Additional Message */}
        <label>
          <strong>Why Do You Want to Work With Us?</strong>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            placeholder="Tell us why you're interested in this job"
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              marginTop: "4px",
              height: "100px",
            }}
          />
        </label>

        {/* Submit Button */}
        <button
          type="submit"
          style={{
            padding: "10px 20px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          Submit Application
        </button>
      </form>
    </div>
  );
};

export default CleanerApplicationForm;
