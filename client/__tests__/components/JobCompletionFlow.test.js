import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock the UserContext with React.createContext
jest.mock("../../src/context/UserContext", () => {
  const React = require("react");
  return {
    UserContext: React.createContext({ currentUser: null }),
  };
});

// Mock the PricingContext
jest.mock("../../src/context/PricingContext", () => ({
  usePricing: () => ({
    pricing: {
      platform: {
        feePercent: 0.1,
      },
    },
  }),
}));

// Mock the child components to isolate JobCompletionFlow tests
jest.mock("../../src/components/employeeAssignments/jobPhotos/JobPhotoCapture", () => {
  const React = require("react");
  const { View, Text, TouchableOpacity } = require("react-native");
  return ({ appointmentId, photoType, onPhotosUpdated, onComplete }) => (
    <View testID={`photo-capture-${photoType}`}>
      <Text>Photo Capture: {photoType}</Text>
      <TouchableOpacity testID={`complete-${photoType}-photos`} onPress={onComplete}>
        <Text>Complete {photoType} photos</Text>
      </TouchableOpacity>
      <TouchableOpacity testID={`update-${photoType}-photos`} onPress={onPhotosUpdated}>
        <Text>Update photos</Text>
      </TouchableOpacity>
    </View>
  );
});

jest.mock("../../src/components/employeeAssignments/jobPhotos/CleaningChecklist", () => {
  const React = require("react");
  const { View, Text, TouchableOpacity } = require("react-native");
  return ({ home, onChecklistComplete, onProgressUpdate }) => {
    React.useEffect(() => {
      if (onProgressUpdate) {
        onProgressUpdate(50, 37, 73);
      }
    }, []);
    return (
      <View testID="cleaning-checklist">
        <Text>Cleaning Checklist</Text>
        <TouchableOpacity testID="complete-checklist" onPress={onChecklistComplete}>
          <Text>Complete Checklist</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

// Mock styles
jest.mock("../../src/components/employeeAssignments/jobPhotos/JobCompletionFlowStyles", () => ({}));

// Mock config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

// Import the component after mocks
import JobCompletionFlow from "../../src/components/employeeAssignments/jobPhotos/JobCompletionFlow";
import { UserContext } from "../../src/context/UserContext";

// Create mock provider
const MockUserProvider = ({ children }) => (
  <UserContext.Provider value={{ currentUser: { id: 1, token: "test-token" } }}>
    {children}
  </UserContext.Provider>
);

describe("JobCompletionFlow Component", () => {
  const mockAppointment = {
    id: 123,
    homeId: 456,
    date: "2024-01-15",
    price: 150,
    completed: false,
    bringSheets: "No",
    bringTowels: "No",
  };

  const mockHome = {
    id: 456,
    nickName: "Beach House",
    address: "123 Ocean Dr",
    city: "Miami",
    state: "FL",
    zipcode: "33139",
    numBeds: 3,
    numBaths: 2,
    contact: "555-1234",
    keyPadCode: "1234",
    keyLocation: "Under mat",
    trashLocation: "Garage",
    recyclingLocation: "Side of house",
    compostLocation: "Kitchen",
    specialNotes: "Be careful with antiques",
  };

  const mockOnJobCompleted = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    appointment: mockAppointment,
    home: mockHome,
    onJobCompleted: mockOnJobCompleted,
    onCancel: mockOnCancel,
  };

  const renderWithContext = (ui) => {
    return render(<MockUserProvider>{ui}</MockUserProvider>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe("Initial Rendering", () => {
    it("should render the job completion flow container", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
      });

      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      expect(getByText("Job Completion")).toBeTruthy();
    });

    it("should render step indicator with all four steps", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
      });

      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      expect(getByText("Before")).toBeTruthy();
      expect(getByText("Clean")).toBeTruthy();
      expect(getByText("After")).toBeTruthy();
      expect(getByText("Complete")).toBeTruthy();
    });

    it("should render cancel button", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
      });

      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      expect(getByText("Cancel")).toBeTruthy();
    });

    it("should start on before photos step when no photos exist", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
      });

      const { getByTestId } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByTestId("photo-capture-before")).toBeTruthy();
      });
    });
  });

  describe("Photo Status Checking", () => {
    it("should check photo status on mount", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
      });

      renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/v1/job-photos/${mockAppointment.id}/status`),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "Bearer test-token",
            }),
          })
        );
      });
    });

    it("should auto-advance to cleaning step when before photos exist", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: false }),
      });

      const { getByTestId } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByTestId("cleaning-checklist")).toBeTruthy();
      });
    });

    it("should auto-advance to review step when both before and after photos exist", async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
        });

      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Review & Complete")).toBeTruthy();
      });
    });
  });

  describe("Step Navigation", () => {
    it("should advance from before photos to cleaning when before photos completed", async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: false }),
        });

      const { getByTestId, queryByTestId } = renderWithContext(
        <JobCompletionFlow {...defaultProps} />
      );

      await waitFor(() => {
        expect(getByTestId("photo-capture-before")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId("complete-before-photos"));
      });

      await waitFor(() => {
        expect(getByTestId("cleaning-checklist")).toBeTruthy();
        expect(queryByTestId("photo-capture-before")).toBeNull();
      });
    });

    it("should advance from cleaning to after photos when checklist completed", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: false }),
      });

      const { getByTestId, queryByTestId } = renderWithContext(
        <JobCompletionFlow {...defaultProps} />
      );

      await waitFor(() => {
        expect(getByTestId("cleaning-checklist")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId("complete-checklist"));
      });

      await waitFor(() => {
        expect(getByTestId("photo-capture-after")).toBeTruthy();
        expect(queryByTestId("cleaning-checklist")).toBeNull();
      });
    });

    it("should advance from after photos to review when after photos completed", async () => {
      // Start at cleaning step
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: false }),
      });

      const { getByTestId, getByText } = renderWithContext(
        <JobCompletionFlow {...defaultProps} />
      );

      // Move to after photos
      await waitFor(() => {
        expect(getByTestId("cleaning-checklist")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId("complete-checklist"));
      });

      // Mock the photo status check and load photos for review
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,abc", room: "Kitchen" }],
              afterPhotos: [{ id: 2, photoData: "data:image/jpeg;base64,xyz", room: "Kitchen" }],
            }),
        });

      await act(async () => {
        fireEvent.press(getByTestId("complete-after-photos"));
      });

      await waitFor(() => {
        expect(getByText("Review & Complete")).toBeTruthy();
      });
    });
  });

  describe("Review Step", () => {
    beforeEach(() => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,abc", room: "Kitchen" }],
              afterPhotos: [{ id: 2, photoData: "data:image/jpeg;base64,xyz", room: "Kitchen" }],
            }),
        });
    });

    it("should display payout amount correctly", async () => {
      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        // Price is $150, cleaner gets 90% (1 - 0.1 fee)
        expect(getByText("$135.00")).toBeTruthy();
      });
    });

    it("should display review title and subtitle", async () => {
      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Review & Complete")).toBeTruthy();
        expect(getByText("Review your before and after photos, then complete the job.")).toBeTruthy();
      });
    });

    it("should display before and after photos sections", async () => {
      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Before Photos")).toBeTruthy();
        expect(getByText("After Photos")).toBeTruthy();
      });
    });

    it("should display Complete Job button", async () => {
      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Complete Job & Get Paid")).toBeTruthy();
      });
    });

    it("should display Add More After Photos button", async () => {
      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Add More After Photos")).toBeTruthy();
      });
    });
  });

  describe("Job Completion", () => {
    const setupReviewStep = () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,abc", room: "Kitchen" }],
              afterPhotos: [{ id: 2, photoData: "data:image/jpeg;base64,xyz", room: "Kitchen" }],
            }),
        });
    };

    it("should call complete-job API when Complete Job button pressed", async () => {
      setupReviewStep();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, payout: 135 }),
      });

      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Complete Job & Get Paid")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Complete Job & Get Paid"));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/payments/complete-job"),
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer test-token",
            }),
            body: JSON.stringify({
              appointmentId: mockAppointment.id,
              cleanerId: 1,
            }),
          })
        );
      });
    });

    it("should show success alert when job completed successfully", async () => {
      setupReviewStep();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, payout: 135 }),
      });

      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Complete Job & Get Paid")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Complete Job & Get Paid"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "Job Completed!",
          "Great work! Your payout has been processed.",
          expect.any(Array)
        );
      });
    });

    it("should call onJobCompleted callback after alert OK", async () => {
      setupReviewStep();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, payout: 135 }),
      });

      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Complete Job & Get Paid")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Complete Job & Get Paid"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Simulate pressing OK on the alert
      const alertCall = Alert.alert.mock.calls[0];
      const okButton = alertCall[2].find((btn) => btn.text === "OK");
      okButton.onPress();

      expect(mockOnJobCompleted).toHaveBeenCalled();
    });

    it("should show error alert when job completion fails", async () => {
      // Use mockImplementation to handle URL-based responses
      global.fetch.mockImplementation((url) => {
        if (url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: true }),
          });
        }
        if (url.includes("/job-photos/") && !url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,abc", room: "Kitchen" }],
                afterPhotos: [{ id: 2, photoData: "data:image/jpeg;base64,xyz", room: "Kitchen" }],
              }),
          });
        }
        if (url.includes("/complete-job")) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: "Payment processing failed" }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Complete Job & Get Paid")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Complete Job & Get Paid"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Error", "Payment processing failed");
      });
    });

    it("should show generic error when API throws exception", async () => {
      // Use mockImplementation to handle URL-based responses
      global.fetch.mockImplementation((url) => {
        if (url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: true }),
          });
        }
        if (url.includes("/job-photos/") && !url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,abc", room: "Kitchen" }],
                afterPhotos: [{ id: 2, photoData: "data:image/jpeg;base64,xyz", room: "Kitchen" }],
              }),
          });
        }
        if (url.includes("/complete-job")) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Complete Job & Get Paid")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Complete Job & Get Paid"));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to complete job. Please try again.");
      });
    });
  });

  describe("Cancel Functionality", () => {
    it("should call onCancel when cancel button is pressed", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
      });

      const { getByText } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      fireEvent.press(getByText("Cancel"));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe("Add More Photos from Review", () => {
    it("should navigate back to after photos when Add More After Photos is pressed", async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,abc", room: "Kitchen" }],
              afterPhotos: [{ id: 2, photoData: "data:image/jpeg;base64,xyz", room: "Kitchen" }],
            }),
        });

      const { getByText, getByTestId } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Add More After Photos")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("Add More After Photos"));
      });

      expect(getByTestId("photo-capture-after")).toBeTruthy();
    });
  });

  describe("Payout Calculation", () => {
    it("should calculate payout correctly with different prices", async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
        });

      const appointmentWithDifferentPrice = { ...mockAppointment, price: 200 };

      const { getByText } = renderWithContext(
        <JobCompletionFlow {...defaultProps} appointment={appointmentWithDifferentPrice} />
      );

      await waitFor(() => {
        // 200 * 0.9 = 180
        expect(getByText("$180.00")).toBeTruthy();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle photo status check failure gracefully", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const { getByTestId } = renderWithContext(<JobCompletionFlow {...defaultProps} />);

      // Should still render the before photos step as fallback
      await waitFor(() => {
        expect(getByTestId("photo-capture-before")).toBeTruthy();
      });
    });
  });
});
