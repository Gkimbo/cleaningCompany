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
  const MockCleaningChecklist = ({ home, onChecklistComplete, onProgressUpdate }) => {
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
  return {
    __esModule: true,
    default: MockCleaningChecklist,
    clearChecklistProgress: jest.fn().mockResolvedValue(undefined),
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
      jest.clearAllMocks();
      global.fetch = jest.fn((url) => {
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
            ok: true,
            json: () => Promise.resolve({
              success: true,
              payoutResults: [
                { cleanerId: 1, status: "success", amountCents: 13500 }
              ]
            }),
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
      jest.clearAllMocks();
      global.fetch = jest.fn((url) => {
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
            ok: true,
            json: () => Promise.resolve({
              success: true,
              payoutResults: [
                { cleanerId: 1, status: "success", amountCents: 13500 }
              ]
            }),
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
        expect(Alert.alert).toHaveBeenCalledWith(
          "Job Completed!",
          "Great work! Your payout of $135.00 has been processed.",
          expect.any(Array)
        );
      });
    });

    it("should show warning when payout is skipped due to missing Stripe setup", async () => {
      jest.clearAllMocks();
      global.fetch = jest.fn().mockImplementation((url) => {
        if (typeof url === 'string' && url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: true }),
          });
        }
        if (typeof url === 'string' && url.includes("/job-photos/") && !url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,abc", room: "Kitchen" }],
                afterPhotos: [{ id: 2, photoData: "data:image/jpeg;base64,xyz", room: "Kitchen" }],
              }),
          });
        }
        if (typeof url === 'string' && url.includes("/complete-job")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              payoutResults: [
                { cleanerId: 1, status: "skipped", reason: "Cleaner has not completed Stripe onboarding" }
              ]
            }),
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
        expect(Alert.alert).toHaveBeenCalledWith(
          "Job Completed!",
          "Job completed! However, your payout could not be processed. Please complete your Stripe account setup to receive payments.",
          expect.any(Array)
        );
      });
    });

    it("should call onJobCompleted callback after alert OK", async () => {
      jest.clearAllMocks();
      global.fetch = jest.fn().mockImplementation((url) => {
        if (typeof url === 'string' && url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: true }),
          });
        }
        if (typeof url === 'string' && url.includes("/job-photos/") && !url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,abc", room: "Kitchen" }],
                afterPhotos: [{ id: 2, photoData: "data:image/jpeg;base64,xyz", room: "Kitchen" }],
              }),
          });
        }
        if (typeof url === 'string' && url.includes("/complete-job")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              payoutResults: [
                { cleanerId: 1, status: "success", amountCents: 13500 }
              ]
            }),
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
        expect(Alert.alert).toHaveBeenCalledWith(
          "Job Completed!",
          expect.any(String),
          expect.any(Array)
        );
      });

      // Simulate pressing OK on the alert
      const alertCall = Alert.alert.mock.calls.find(
        (call) => call[0] === "Job Completed!" && Array.isArray(call[2])
      );
      const okButton = alertCall[2].find((btn) => btn.text === "OK");
      okButton.onPress();

      expect(mockOnJobCompleted).toHaveBeenCalled();
    });

    it("should show error alert when job completion fails", async () => {
      jest.clearAllMocks();
      global.fetch = jest.fn().mockImplementation((url) => {
        if (typeof url === 'string' && url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: true }),
          });
        }
        if (typeof url === 'string' && url.includes("/job-photos/") && !url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,abc", room: "Kitchen" }],
                afterPhotos: [{ id: 2, photoData: "data:image/jpeg;base64,xyz", room: "Kitchen" }],
              }),
          });
        }
        if (typeof url === 'string' && url.includes("/complete-job")) {
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
      jest.clearAllMocks();
      global.fetch = jest.fn().mockImplementation((url) => {
        if (typeof url === 'string' && url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: true }),
          });
        }
        if (typeof url === 'string' && url.includes("/job-photos/") && !url.includes("/status")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,abc", room: "Kitchen" }],
                afterPhotos: [{ id: 2, photoData: "data:image/jpeg;base64,xyz", room: "Kitchen" }],
              }),
          });
        }
        if (typeof url === 'string' && url.includes("/complete-job")) {
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

  describe("Business Owner Skip Functionality", () => {
    // Home with current user as preferred cleaner (business owner)
    const mockHomeWithBusinessOwner = {
      ...mockHome,
      preferredCleanerId: 1, // Matches currentUser.id
    };

    // Home without preferred cleaner or different preferred cleaner
    const mockHomeWithoutBusinessOwner = {
      ...mockHome,
      preferredCleanerId: 999, // Different from currentUser.id
    };

    const mockHomeWithNoPreferred = {
      ...mockHome,
      preferredCleanerId: null,
    };

    describe("Skip Buttons Visibility", () => {
      it("should show Skip Before Photos button for business owner", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
        });

        const { getByText } = renderWithContext(
          <JobCompletionFlow {...defaultProps} home={mockHomeWithBusinessOwner} />
        );

        await waitFor(() => {
          expect(getByText("Skip Before Photos")).toBeTruthy();
        });
      });

      it("should NOT show Skip Before Photos button for regular cleaner", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
        });

        const { queryByText } = renderWithContext(
          <JobCompletionFlow {...defaultProps} home={mockHomeWithoutBusinessOwner} />
        );

        await waitFor(() => {
          expect(queryByText("Skip Before Photos")).toBeNull();
        });
      });

      it("should NOT show skip button when home has no preferred cleaner", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
        });

        const { queryByText } = renderWithContext(
          <JobCompletionFlow {...defaultProps} home={mockHomeWithNoPreferred} />
        );

        await waitFor(() => {
          expect(queryByText("Skip Before Photos")).toBeNull();
        });
      });

      it("should show Skip Checklist button for business owner on cleaning step", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: false }),
        });

        const { getByText } = renderWithContext(
          <JobCompletionFlow {...defaultProps} home={mockHomeWithBusinessOwner} />
        );

        await waitFor(() => {
          expect(getByText("Skip Checklist")).toBeTruthy();
        });
      });

      it("should NOT show Skip Checklist button for regular cleaner on cleaning step", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: false }),
        });

        const { queryByText, getByTestId } = renderWithContext(
          <JobCompletionFlow {...defaultProps} home={mockHomeWithoutBusinessOwner} />
        );

        await waitFor(() => {
          expect(getByTestId("cleaning-checklist")).toBeTruthy();
          expect(queryByText("Skip Checklist")).toBeNull();
        });
      });
    });

    describe("Skip Button Navigation", () => {
      it("should advance to cleaning step when Skip Before Photos is pressed", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
        });

        const { getByText, getByTestId, queryByTestId } = renderWithContext(
          <JobCompletionFlow {...defaultProps} home={mockHomeWithBusinessOwner} />
        );

        await waitFor(() => {
          expect(getByText("Skip Before Photos")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip Before Photos"));
        });

        await waitFor(() => {
          expect(getByTestId("cleaning-checklist")).toBeTruthy();
          expect(queryByTestId("photo-capture-before")).toBeNull();
        });
      });

      it("should advance to after photos step when Skip Checklist is pressed", async () => {
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: false }),
        });

        const { getByText, getByTestId, queryByTestId } = renderWithContext(
          <JobCompletionFlow {...defaultProps} home={mockHomeWithBusinessOwner} />
        );

        await waitFor(() => {
          expect(getByText("Skip Checklist")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip Checklist"));
        });

        await waitFor(() => {
          expect(getByTestId("photo-capture-after")).toBeTruthy();
          expect(queryByTestId("cleaning-checklist")).toBeNull();
        });
      });

      it("should advance to review step when Skip After Photos is pressed", async () => {
        // Start at before photos, then navigate to after photos step
        global.fetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
          });

        const { getByText, getByTestId, queryByTestId } = renderWithContext(
          <JobCompletionFlow {...defaultProps} home={mockHomeWithBusinessOwner} />
        );

        // Skip before photos
        await waitFor(() => {
          expect(getByText("Skip Before Photos")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip Before Photos"));
        });

        // Skip checklist
        await waitFor(() => {
          expect(getByText("Skip Checklist")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip Checklist"));
        });

        // Skip after photos
        await waitFor(() => {
          expect(getByText("Skip After Photos")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip After Photos"));
        });

        // Should be at review step
        await waitFor(() => {
          expect(getByText("Review & Complete")).toBeTruthy();
          expect(queryByTestId("photo-capture-after")).toBeNull();
        });
      });
    });

    describe("Review Step Without Photos (Business Owner)", () => {
      it("should show appropriate message when no photos taken", async () => {
        global.fetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
          });

        const { getByText, queryByText } = renderWithContext(
          <JobCompletionFlow {...defaultProps} home={mockHomeWithBusinessOwner} />
        );

        // Skip through all steps to reach review
        await waitFor(() => {
          expect(getByText("Skip Before Photos")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip Before Photos"));
        });

        await waitFor(() => {
          expect(getByText("Skip Checklist")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip Checklist"));
        });

        await waitFor(() => {
          expect(getByText("Skip After Photos")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip After Photos"));
        });

        await waitFor(() => {
          expect(getByText("Complete the job for your client.")).toBeTruthy();
          expect(getByText("No photos taken for this job")).toBeTruthy();
          // Should NOT show "Before Photos" or "After Photos" sections
          expect(queryByText("Before Photos")).toBeNull();
          expect(queryByText("After Photos")).toBeNull();
        });
      });

      it("should show Complete Job button without photos for business owner", async () => {
        global.fetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
          });

        const { getByText } = renderWithContext(
          <JobCompletionFlow {...defaultProps} home={mockHomeWithBusinessOwner} />
        );

        // Skip through all steps
        await waitFor(() => {
          expect(getByText("Skip Before Photos")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip Before Photos"));
        });

        await waitFor(() => {
          expect(getByText("Skip Checklist")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip Checklist"));
        });

        await waitFor(() => {
          expect(getByText("Skip After Photos")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip After Photos"));
        });

        await waitFor(() => {
          expect(getByText("Complete Job & Get Paid")).toBeTruthy();
        });
      });

      it("should show only before photos when skipping after photos", async () => {
        global.fetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ hasBeforePhotos: true, hasAfterPhotos: false }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,abc", room: "Kitchen" }],
                afterPhotos: [],
              }),
          });

        const { getByText, queryByText, getByTestId } = renderWithContext(
          <JobCompletionFlow {...defaultProps} home={mockHomeWithBusinessOwner} />
        );

        // Take before photos (use the mocked complete)
        await waitFor(() => {
          expect(getByTestId("photo-capture-before")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByTestId("complete-before-photos"));
        });

        // Skip checklist
        await waitFor(() => {
          expect(getByText("Skip Checklist")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip Checklist"));
        });

        // Skip after photos
        await waitFor(() => {
          expect(getByText("Skip After Photos")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip After Photos"));
        });

        await waitFor(() => {
          // Should show before photos section but not after
          expect(getByText("Before Photos")).toBeTruthy();
          expect(queryByText("After Photos")).toBeNull();
        });
      });
    });

    describe("Business Owner Job Completion", () => {
      it("should successfully complete job without photos for business owner", async () => {
        jest.clearAllMocks();
        global.fetch = jest.fn().mockImplementation((url) => {
          if (typeof url === "string" && url.includes("/status")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ hasBeforePhotos: false, hasAfterPhotos: false }),
            });
          }
          if (typeof url === "string" && url.includes("/job-photos/") && !url.includes("/status")) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
            });
          }
          if (typeof url === "string" && url.includes("/complete-job")) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  success: true,
                  payoutResults: [{ cleanerId: 1, status: "success", amountCents: 13500 }],
                }),
            });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        const { getByText } = renderWithContext(
          <JobCompletionFlow {...defaultProps} home={mockHomeWithBusinessOwner} />
        );

        // Skip all steps
        await waitFor(() => {
          expect(getByText("Skip Before Photos")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip Before Photos"));
        });

        await waitFor(() => {
          expect(getByText("Skip Checklist")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip Checklist"));
        });

        await waitFor(() => {
          expect(getByText("Skip After Photos")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Skip After Photos"));
        });

        // Complete the job
        await waitFor(() => {
          expect(getByText("Complete Job & Get Paid")).toBeTruthy();
        });

        await act(async () => {
          fireEvent.press(getByText("Complete Job & Get Paid"));
        });

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalledWith(
            "Job Completed!",
            "Great work! Your payout of $135.00 has been processed.",
            expect.any(Array)
          );
        });
      });
    });
  });
});
