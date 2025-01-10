import React, { useState } from "react";

const CleanerApplications = () => {
  // Mock data for applications
  const [applications, setApplications] = useState([
    {
      id: 1,
      name: "John Doe",
      email: "john.doe@example.com",
      experience: "2 years",
      availability: "Monday to Friday",
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "jane.smith@example.com",
      experience: "1 year",
      availability: "Weekends only",
    },
    {
      id: 3,
      name: "Alice Johnson",
      email: "alice.johnson@example.com",
      experience: "3 years",
      availability: "Flexible",
    },
  ]);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Cleaner Applications</h1>
      {applications.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {applications.map((app) => (
            <li
              key={app.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "12px",
              }}
            >
              <h2 style={{ margin: "0 0 8px 0" }}>{app.name}</h2>
              <p>
                <strong>Email:</strong> {app.email}
              </p>
              <p>
                <strong>Experience:</strong> {app.experience}
              </p>
              <p>
                <strong>Availability:</strong> {app.availability}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No applications available.</p>
      )}
    </div>
  );
};

export default CleanerApplications;
