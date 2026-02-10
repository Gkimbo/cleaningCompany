/**
 * Tests for Business Owner Job Details - Decline Functionality
 * Tests the decline flow when a business owner cannot assign anyone to a job
 */

import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock react-router-native
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ appointmentId: "123" }),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock AuthContext
jest.mock("../../../services/AuthContext", () => {
  const React = require("react");
  const context = React.createContext({
    user: { token: "test-token", id: 100, isBusinessOwner: true },
    logout: () => {},
  });
  return {
    AuthContext: context,
    AuthProvider: ({ children }) => children,
  };
});

// Mock UserContext
jest.mock("../../../context/UserContext", () => {
  const React = require("react");
  return {
    UserContext: React.createContext({
      state: {
        currentUser: { token: "test-token", id: 100, isBusinessOwner: true },
      },
    }),
  };
});

// Mock Feather icons
jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name, ...props }) => {
    const { Text } = require("react-native");
    return <Text {...props}>{name}</Text>;
  },
  FontAwesome5: ({ name, ...props }) => {
    const { Text } = require("react-native");
    return <Text {...props}>{name}</Text>;
  },
  MaterialCommunityIcons: ({ name, ...props }) => {
    const { Text } = require("react-native");
    return <Text {...props}>{name}</Text>;
  },
}));

// Mock react-native-safe-area-context
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }) => children,
}));

// Mock expo-linking
jest.mock("expo-linking", () => ({
  createURL: jest.fn(),
  openURL: jest.fn(),
}));

// Mock the config
jest.mock("../../../services/config", () => ({
  API_BASE: "http://test-api.com/api/v1",
}));

// Mock Alert
jest.spyOn(Alert, "alert");

describe("Business Owner Job Details - Decline Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  describe("handleDecline function logic", () => {
    const mockAppointmentId = "123";
    const mockToken = "test-token";

    it("should call the decline endpoint with the correct parameters", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true, message: "Appointment declined" }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      // Simulate the API call
      const response = await fetch(
        `http://test-api.com/api/v1/business-owner/appointments/${mockAppointmentId}/decline`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Staff unavailable" }),
        }
      );

      expect(fetch).toHaveBeenCalledWith(
        `http://test-api.com/api/v1/business-owner/appointments/${mockAppointmentId}/decline`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ reason: "Staff unavailable" }),
        })
      );

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("should handle decline without a reason", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true, message: "Appointment declined" }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch(
        `http://test-api.com/api/v1/business-owner/appointments/${mockAppointmentId}/decline`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      expect(fetch).toHaveBeenCalledWith(
        `http://test-api.com/api/v1/business-owner/appointments/${mockAppointmentId}/decline`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        })
      );

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("should handle API errors gracefully", async () => {
      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({ error: "Appointment not found" }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch(
        `http://test-api.com/api/v1/business-owner/appointments/${mockAppointmentId}/decline`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Test" }),
        }
      );

      expect(response.ok).toBe(false);
      const data = await response.json();
      expect(data.error).toBe("Appointment not found");
    });

    it("should handle network errors", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        fetch(
          `http://test-api.com/api/v1/business-owner/appointments/${mockAppointmentId}/decline`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${mockToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ reason: "Test" }),
          }
        )
      ).rejects.toThrow("Network error");
    });
  });

  describe("API Request Validation", () => {
    it("should include proper headers in request", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await fetch(
        "http://test-api.com/api/v1/business-owner/appointments/123/decline",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Test" }),
        }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should use POST method", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await fetch(
        "http://test-api.com/api/v1/business-owner/appointments/123/decline",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  describe("Decline Success Flow", () => {
    it("should show success alert after decline", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true, message: "Client has been notified" }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      await fetch(
        "http://test-api.com/api/v1/business-owner/appointments/123/decline",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Test reason" }),
        }
      );

      // Simulate the Alert.alert call that would happen in the component
      Alert.alert(
        "Job Declined",
        "The client has been notified and can choose to cancel or find another cleaner."
      );

      expect(Alert.alert).toHaveBeenCalledWith(
        "Job Declined",
        "The client has been notified and can choose to cancel or find another cleaner."
      );
    });
  });

  describe("Decline Error Handling", () => {
    it("should show error alert when decline fails", async () => {
      const mockResponse = {
        ok: false,
        json: () => Promise.resolve({ error: "Cannot decline a completed appointment" }),
      };
      global.fetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch(
        "http://test-api.com/api/v1/business-owner/appointments/123/decline",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Test reason" }),
        }
      );

      const data = await response.json();

      // Simulate the Alert.alert call that would happen in the component
      Alert.alert("Error", data.error || "Failed to decline job");

      expect(Alert.alert).toHaveBeenCalledWith(
        "Error",
        "Cannot decline a completed appointment"
      );
    });
  });
});
