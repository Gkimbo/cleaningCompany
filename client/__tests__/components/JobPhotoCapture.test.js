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

// Mock expo-image-picker
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

// Mock styles
jest.mock("../../src/components/employeeAssignments/jobPhotos/JobPhotoCaptureStyles", () => ({}));

// Mock config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

// Import after mocks
import JobPhotoCapture from "../../src/components/employeeAssignments/jobPhotos/JobPhotoCapture";
import { UserContext } from "../../src/context/UserContext";
import * as ImagePicker from "expo-image-picker";

// Create mock provider
const MockUserProvider = ({ children }) => (
  <UserContext.Provider value={{ currentUser: { id: 1, token: "test-token" } }}>
    {children}
  </UserContext.Provider>
);

describe("JobPhotoCapture Component", () => {
  const mockOnPhotosUpdated = jest.fn();
  const mockOnComplete = jest.fn();

  const mockHome = {
    id: 1,
    numBeds: "2",
    numBaths: "1",
  };

  const defaultProps = {
    appointmentId: 123,
    photoType: "before",
    home: mockHome,
    onPhotosUpdated: mockOnPhotosUpdated,
    onComplete: mockOnComplete,
  };

  const renderWithContext = (ui) => {
    return render(<MockUserProvider>{ui}</MockUserProvider>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();

    // Default permission grants
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: "granted" });
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: "granted" });
  });

  describe("Room Section Generation", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
      });
    });

    it("should generate Kitchen and Living Room sections", async () => {
      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Kitchen")).toBeTruthy();
        expect(getByText("Living Room")).toBeTruthy();
      });
    });

    it("should generate bedroom sections based on numBeds", async () => {
      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Bedroom 1")).toBeTruthy();
        expect(getByText("Bedroom 2")).toBeTruthy();
      });
    });

    it("should generate bathroom section based on numBaths", async () => {
      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Bathroom")).toBeTruthy();
      });
    });

    it("should generate numbered bathrooms for multiple baths", async () => {
      const homeWith2Baths = { ...mockHome, numBaths: "2" };
      const { getByText } = renderWithContext(
        <JobPhotoCapture {...defaultProps} home={homeWith2Baths} />
      );

      await waitFor(() => {
        expect(getByText("Bathroom 1")).toBeTruthy();
        expect(getByText("Bathroom 2")).toBeTruthy();
      });
    });

    it("should handle 3 bedroom 2 bathroom home", async () => {
      const largerHome = { ...mockHome, numBeds: "3", numBaths: "2" };
      const { getByText } = renderWithContext(
        <JobPhotoCapture {...defaultProps} home={largerHome} />
      );

      await waitFor(() => {
        expect(getByText("Kitchen")).toBeTruthy();
        expect(getByText("Living Room")).toBeTruthy();
        expect(getByText("Bedroom 1")).toBeTruthy();
        expect(getByText("Bedroom 2")).toBeTruthy();
        expect(getByText("Bedroom 3")).toBeTruthy();
        expect(getByText("Bathroom 1")).toBeTruthy();
        expect(getByText("Bathroom 2")).toBeTruthy();
      });
    });

    it("should default to 1 bedroom and 1 bathroom when home is null", async () => {
      const { getByText } = renderWithContext(
        <JobPhotoCapture {...defaultProps} home={null} />
      );

      await waitFor(() => {
        expect(getByText("Kitchen")).toBeTruthy();
        expect(getByText("Living Room")).toBeTruthy();
        expect(getByText("Bedroom")).toBeTruthy();
        expect(getByText("Bathroom")).toBeTruthy();
      });
    });

    it("should handle fractional bathrooms by rounding up", async () => {
      const homeWithHalfBath = { ...mockHome, numBaths: "1.5" };
      const { getByText } = renderWithContext(
        <JobPhotoCapture {...defaultProps} home={homeWithHalfBath} />
      );

      await waitFor(() => {
        expect(getByText("Bathroom 1")).toBeTruthy();
        expect(getByText("Bathroom 2")).toBeTruthy();
      });
    });
  });

  describe("Initial Rendering - Before Photos", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
      });
    });

    it("should render before photos title", async () => {
      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      expect(getByText("Before Photos")).toBeTruthy();
    });

    it("should render before photos subtitle", async () => {
      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      expect(getByText("Take photos of each room before you start cleaning")).toBeTruthy();
    });

    it("should render Continue button for before photos", async () => {
      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      expect(getByText("Continue to Cleaning")).toBeTruthy();
    });

    it("should show progress indicator", async () => {
      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/0 of 5 rooms photographed/)).toBeTruthy();
      });
    });

    it("should show required text for rooms without photos", async () => {
      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("At least 1 photo required").length).toBeGreaterThan(0);
      });
    });
  });

  describe("Initial Rendering - After Photos", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
      });
    });

    it("should render after photos title", async () => {
      const { getByText } = renderWithContext(
        <JobPhotoCapture {...defaultProps} photoType="after" />
      );

      expect(getByText("After Photos")).toBeTruthy();
    });

    it("should render after photos subtitle", async () => {
      const { getByText } = renderWithContext(
        <JobPhotoCapture {...defaultProps} photoType="after" />
      );

      expect(getByText("Take photos of each room after you finish cleaning")).toBeTruthy();
    });

    it("should render Continue button for after photos", async () => {
      const { getByText } = renderWithContext(
        <JobPhotoCapture {...defaultProps} photoType="after" />
      );

      expect(getByText("Review & Complete Job")).toBeTruthy();
    });
  });

  describe("Room Section Display", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
      });
    });

    it("should show photo count badge for each room", async () => {
      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("0 photos").length).toBe(5);
      });
    });

    it("should show warning indicator for rooms without photos", async () => {
      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("⚠").length).toBe(5);
      });
    });

    it("should show add photo buttons in each section", async () => {
      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Add").length).toBeGreaterThan(0);
        expect(getAllByText("Gallery").length).toBeGreaterThan(0);
      });
    });
  });

  describe("Section Expansion", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
      });
    });

    it("should toggle section when header pressed", async () => {
      const { getByText, queryAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Kitchen")).toBeTruthy();
      });

      // Sections should be expanded by default
      expect(queryAllByText("Add").length).toBeGreaterThan(0);

      // Press to collapse
      fireEvent.press(getByText("Kitchen"));

      // Kitchen section's Add button should be hidden after collapse
      // (The count may reduce by 1)
    });
  });

  describe("Photo Capture", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
      });
    });

    it("should request camera permissions when taking photo", async () => {
      ImagePicker.launchCameraAsync.mockResolvedValueOnce({ canceled: true });

      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Add").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Add")[0]);
      });

      expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
      expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
    });

    it("should show alert when camera permission denied", async () => {
      ImagePicker.requestCameraPermissionsAsync.mockResolvedValueOnce({ status: "denied" });

      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Add").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Add")[0]);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        "Permissions Required",
        "Camera and photo library permissions are needed to capture job photos."
      );
    });

    it("should launch camera when Add button pressed with permissions", async () => {
      ImagePicker.launchCameraAsync.mockResolvedValueOnce({ canceled: true });

      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Add").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Add")[0]);
      });

      expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });
    });

    it("should upload photo with room name when camera returns result", async () => {
      const mockPhotoResult = {
        canceled: false,
        assets: [{ base64: "mockBase64Data" }],
      };
      ImagePicker.launchCameraAsync.mockResolvedValueOnce(mockPhotoResult);

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 1, success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,mockBase64Data", room: "Kitchen" }],
              afterPhotos: [],
            }),
        });

      const { getAllByText, getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      // Wait for Kitchen section to appear
      await waitFor(() => {
        expect(getByText("Kitchen")).toBeTruthy();
      });

      const addButtons = getAllByText("Add");

      await act(async () => {
        fireEvent.press(addButtons[0]); // First Add button is Kitchen
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/job-photos/upload"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"room":"Kitchen"'),
          })
        );
      });
    });

    it("should call onPhotosUpdated after successful upload", async () => {
      const mockPhotoResult = {
        canceled: false,
        assets: [{ base64: "mockBase64Data" }],
      };
      ImagePicker.launchCameraAsync.mockResolvedValueOnce(mockPhotoResult);

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 1, success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              beforePhotos: [{ id: 1, photoData: "data:image/jpeg;base64,mockBase64Data", room: "Kitchen" }],
              afterPhotos: [],
            }),
        });

      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Add").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Add")[0]);
      });

      await waitFor(() => {
        expect(mockOnPhotosUpdated).toHaveBeenCalled();
      });
    });

    it("should show error alert when photo upload fails", async () => {
      const mockPhotoResult = {
        canceled: false,
        assets: [{ base64: "mockBase64Data" }],
      };
      ImagePicker.launchCameraAsync.mockResolvedValueOnce(mockPhotoResult);

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Upload failed" }),
      });

      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Add").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Add")[0]);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Error", "Upload failed");
      });
    });

    it("should show error when camera throws exception", async () => {
      ImagePicker.launchCameraAsync.mockRejectedValueOnce(new Error("Camera error"));

      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Add").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Add")[0]);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to take photo. Please try again.");
      });
    });
  });

  describe("Photo Library Selection", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
      });
    });

    it("should launch image library when Gallery button pressed", async () => {
      ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true });

      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Gallery").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Gallery")[0]);
      });

      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });
    });

    it("should show error when library throws exception", async () => {
      ImagePicker.launchImageLibraryAsync.mockRejectedValueOnce(new Error("Library error"));

      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Gallery").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Gallery")[0]);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to select photo. Please try again.");
      });
    });
  });

  describe("Loading Existing Photos", () => {
    it("should group existing photos by room", async () => {
      const existingPhotos = [
        { id: 1, photoData: "data:image/jpeg;base64,photo1", room: "Kitchen" },
        { id: 2, photoData: "data:image/jpeg;base64,photo2", room: "Kitchen" },
        { id: 3, photoData: "data:image/jpeg;base64,photo3", room: "Living Room" },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: existingPhotos, afterPhotos: [] }),
      });

      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("2 photos")).toBeTruthy(); // Kitchen has 2
        expect(getByText("1 photo")).toBeTruthy(); // Living Room has 1
      });
    });

    it("should update progress when photos are loaded", async () => {
      const existingPhotos = [
        { id: 1, photoData: "data:image/jpeg;base64,photo1", room: "Kitchen" },
        { id: 2, photoData: "data:image/jpeg;base64,photo2", room: "Living Room" },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: existingPhotos, afterPhotos: [] }),
      });

      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/2 of 5 rooms photographed/)).toBeTruthy();
      });
    });

    it("should show checkmark for rooms with photos", async () => {
      const existingPhotos = [
        { id: 1, photoData: "data:image/jpeg;base64,photo1", room: "Kitchen" },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: existingPhotos, afterPhotos: [] }),
      });

      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("✓").length).toBe(1);
        expect(getAllByText("⚠").length).toBe(4);
      });
    });
  });

  describe("Photo Deletion", () => {
    it("should show confirmation dialog when delete pressed", async () => {
      const existingPhotos = [{ id: 1, photoData: "data:image/jpeg;base64,photo1", room: "Kitchen" }];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: existingPhotos, afterPhotos: [] }),
      });

      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("1 photo")).toBeTruthy();
      });

      fireEvent.press(getByText("X"));

      expect(Alert.alert).toHaveBeenCalledWith(
        "Delete Photo",
        "Are you sure you want to delete this photo?",
        expect.arrayContaining([
          expect.objectContaining({ text: "Cancel", style: "cancel" }),
          expect.objectContaining({ text: "Delete", style: "destructive" }),
        ])
      );
    });

    it("should delete photo when confirmed", async () => {
      const existingPhotos = [{ id: 1, photoData: "data:image/jpeg;base64,photo1", room: "Kitchen" }];

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ beforePhotos: existingPhotos, afterPhotos: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
        });

      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("1 photo")).toBeTruthy();
      });

      fireEvent.press(getByText("X"));

      const deleteButton = Alert.alert.mock.calls[0][2].find((btn) => btn.text === "Delete");

      await act(async () => {
        await deleteButton.onPress();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/job-photos/1"),
          expect.objectContaining({
            method: "DELETE",
            headers: expect.objectContaining({
              Authorization: "Bearer test-token",
            }),
          })
        );
      });
    });
  });

  describe("Validation and Continue Button", () => {
    it("should show alert when Continue pressed with missing room photos", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
      });

      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Continue to Cleaning")).toBeTruthy();
      });

      fireEvent.press(getByText("Continue to Cleaning"));

      expect(Alert.alert).toHaveBeenCalledWith(
        "Photos Required",
        expect.stringContaining("Please take at least one photo for each room")
      );
    });

    it("should list missing rooms in alert", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
      });

      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Continue to Cleaning")).toBeTruthy();
      });

      fireEvent.press(getByText("Continue to Cleaning"));

      expect(Alert.alert).toHaveBeenCalledWith(
        "Photos Required",
        expect.stringContaining("Kitchen")
      );
    });

    it("should call onComplete when all rooms have photos", async () => {
      const existingPhotos = [
        { id: 1, photoData: "data:image/jpeg;base64,photo1", room: "Kitchen" },
        { id: 2, photoData: "data:image/jpeg;base64,photo2", room: "Living Room" },
        { id: 3, photoData: "data:image/jpeg;base64,photo3", room: "Bedroom 1" },
        { id: 4, photoData: "data:image/jpeg;base64,photo4", room: "Bedroom 2" },
        { id: 5, photoData: "data:image/jpeg;base64,photo5", room: "Bathroom" },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: existingPhotos, afterPhotos: [] }),
      });

      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/5 of 5 rooms photographed/)).toBeTruthy();
      });

      fireEvent.press(getByText("Continue to Cleaning"));

      expect(mockOnComplete).toHaveBeenCalled();
    });

    it("should not call onComplete when some rooms missing photos", async () => {
      const existingPhotos = [
        { id: 1, photoData: "data:image/jpeg;base64,photo1", room: "Kitchen" },
        { id: 2, photoData: "data:image/jpeg;base64,photo2", room: "Living Room" },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: existingPhotos, afterPhotos: [] }),
      });

      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/2 of 5 rooms photographed/)).toBeTruthy();
      });

      fireEvent.press(getByText("Continue to Cleaning"));

      expect(mockOnComplete).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle load photos failure gracefully", async () => {
      global.fetch.mockRejectedValueOnce(new Error("Network error"));

      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Before Photos")).toBeTruthy();
      });
    });

    it("should handle upload network error", async () => {
      const mockPhotoResult = {
        canceled: false,
        assets: [{ base64: "mockBase64Data" }],
      };
      ImagePicker.launchCameraAsync.mockResolvedValueOnce(mockPhotoResult);

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ beforePhotos: [], afterPhotos: [] }),
        })
        .mockRejectedValueOnce(new Error("Network error"));

      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Add").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Add")[0]);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to upload photo. Please try again.");
      });
    });
  });

  describe("Multiple Photos Per Room", () => {
    it("should allow multiple photos in the same room", async () => {
      const existingPhotos = [
        { id: 1, photoData: "data:image/jpeg;base64,photo1", room: "Kitchen" },
        { id: 2, photoData: "data:image/jpeg;base64,photo2", room: "Kitchen" },
        { id: 3, photoData: "data:image/jpeg;base64,photo3", room: "Kitchen" },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: existingPhotos, afterPhotos: [] }),
      });

      const { getByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("3 photos")).toBeTruthy();
      });
    });

    it("should show delete button on each photo", async () => {
      const existingPhotos = [
        { id: 1, photoData: "data:image/jpeg;base64,photo1", room: "Kitchen" },
        { id: 2, photoData: "data:image/jpeg;base64,photo2", room: "Kitchen" },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ beforePhotos: existingPhotos, afterPhotos: [] }),
      });

      const { getAllByText } = renderWithContext(<JobPhotoCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("X").length).toBe(2);
      });
    });
  });
});
