import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// Mock the UserContext
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

// Mock the offline services
jest.mock("../../src/services/offline", () => ({
  useNetworkStatus: jest.fn(() => ({ isOnline: true, isOffline: false })),
  PhotoStorage: {
    getPhotosForJob: jest.fn(),
    savePhoto: jest.fn(),
    saveNARecord: jest.fn(),
    hasNAPassesForJob: jest.fn(),
    deletePhoto: jest.fn(),
  },
}));

// Mock config
jest.mock("../../src/services/config", () => ({
  API_BASE: "http://localhost:3000/api/v1",
}));

// Mock theme
jest.mock("../../src/services/styles/theme", () => ({
  colors: {
    primary: { 50: "#f0f", 300: "#f0f", 500: "#f0f", 600: "#f0f", 700: "#f0f" },
    secondary: { 50: "#0f0", 300: "#0f0", 500: "#0f0", 700: "#0f0" },
    neutral: { 0: "#fff", 50: "#f5f5f5", 100: "#e5e5e5", 200: "#d5d5d5", 300: "#c5c5c5" },
    success: { 50: "#0f0", 100: "#0f0", 600: "#0f0", 700: "#0f0" },
    warning: { 100: "#ff0", 500: "#ff0", 700: "#ff0", 800: "#ff0" },
    error: { 500: "#f00", 700: "#f00" },
    text: { primary: "#000", secondary: "#666", tertiary: "#999" },
    border: { default: "#ccc" },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  radius: { sm: 4, md: 8, lg: 12, full: 999 },
  shadows: { sm: {}, md: {} },
  typography: {
    fontSize: { xs: 10, sm: 12, base: 14, lg: 16, "2xl": 24 },
    fontWeight: { medium: "500", semibold: "600", bold: "700" },
  },
}));

// Import after mocks
import PassVerificationCapture from "../../src/components/employeeAssignments/jobPhotos/PassVerificationCapture";
import { UserContext } from "../../src/context/UserContext";
import * as ImagePicker from "expo-image-picker";
import { useNetworkStatus, PhotoStorage } from "../../src/services/offline";

// Create mock provider
const MockUserProvider = ({ children }) => (
  <UserContext.Provider value={{ currentUser: { id: 1, token: "test-token" } }}>
    {children}
  </UserContext.Provider>
);

describe("PassVerificationCapture Component", () => {
  const mockOnPhotosUpdated = jest.fn();
  const mockOnComplete = jest.fn();

  const defaultProps = {
    appointmentId: 123,
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

    // Default network status (online)
    useNetworkStatus.mockReturnValue({ isOnline: true, isOffline: false });

    // Default PhotoStorage mocks
    PhotoStorage.getPhotosForJob.mockResolvedValue([]);
    PhotoStorage.hasNAPassesForJob.mockResolvedValue(false);
  });

  describe("Initial Rendering", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ passesPhotos: [] }),
      });
    });

    it("should render title and subtitle", async () => {
      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      expect(getByText("Pass Verification")).toBeTruthy();
      expect(getByText(/Take photos of any beach passes/)).toBeTruthy();
    });

    it("should render N/A option", async () => {
      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      expect(getByText("No Passes Available")).toBeTruthy();
      expect(getByText(/This property does not have/)).toBeTruthy();
    });

    it("should render all pass type sections", async () => {
      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Beach Pass")).toBeTruthy();
        expect(getByText("Parking Pass")).toBeTruthy();
        expect(getByText("Lift Pass")).toBeTruthy();
        expect(getByText("Pool Pass")).toBeTruthy();
        expect(getByText("Other Pass")).toBeTruthy();
      });
    });

    it("should show verification required status initially", async () => {
      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/Verification required/)).toBeTruthy();
      });
    });

    it("should render Continue button", async () => {
      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      expect(getByText("Continue to Review")).toBeTruthy();
    });
  });

  describe("N/A Selection", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ passesPhotos: [] }),
      });
    });

    it("should submit N/A when pressed and online", async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, photo: { isNotApplicable: true } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ passesPhotos: [{ isNotApplicable: true }] }),
        });

      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("No Passes Available")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("No Passes Available"));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/job-photos/upload"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"isNotApplicable":true'),
          })
        );
      });
    });

    it("should save N/A locally when offline", async () => {
      useNetworkStatus.mockReturnValue({ isOnline: false, isOffline: true });

      const { getByText } = renderWithContext(
        <PassVerificationCapture {...defaultProps} localJobId="local_123" />
      );

      await waitFor(() => {
        expect(getByText("No Passes Available")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("No Passes Available"));
      });

      await waitFor(() => {
        expect(PhotoStorage.saveNARecord).toHaveBeenCalledWith(
          "local_123",
          "No passes available at this property"
        );
      });
    });

    it("should show confirmation when photos exist and N/A pressed", async () => {
      // Reset and set up fresh mock for this test - need photos to exist
      global.fetch.mockReset();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            passesPhotos: [{ id: 1, photoType: "passes", photoData: "data", room: "Beach Pass" }],
          }),
      });

      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      // Wait for photos to load and display
      await waitFor(() => {
        expect(getByText("1 photo")).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText("No Passes Available"));
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        "Confirm",
        expect.stringContaining("already uploaded pass photos"),
        expect.any(Array)
      );
    });
  });

  describe("Photo Capture", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ passesPhotos: [] }),
      });
    });

    it("should request camera permissions when taking photo", async () => {
      ImagePicker.launchCameraAsync.mockResolvedValueOnce({ canceled: true });

      const { getAllByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Camera").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Camera")[0]);
      });

      expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
      expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
    });

    it("should show alert when camera permission denied", async () => {
      ImagePicker.requestCameraPermissionsAsync.mockResolvedValueOnce({ status: "denied" });

      const { getAllByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Camera").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Camera")[0]);
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        "Permissions Required",
        "Camera and photo library permissions are needed to capture pass photos."
      );
    });

    it("should upload photo with pass type when camera returns result", async () => {
      const mockPhotoResult = {
        canceled: false,
        assets: [{ base64: "mockBase64Data", uri: "file://photo.jpg" }],
      };
      ImagePicker.launchCameraAsync.mockResolvedValueOnce(mockPhotoResult);

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, photo: { id: 1 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              passesPhotos: [{ id: 1, photoType: "passes", room: "Beach Pass" }],
            }),
        });

      const { getAllByText, getByText } = renderWithContext(
        <PassVerificationCapture {...defaultProps} />
      );

      await waitFor(() => {
        expect(getByText("Beach Pass")).toBeTruthy();
      });

      const cameraButtons = getAllByText("Camera");

      await act(async () => {
        fireEvent.press(cameraButtons[0]); // First Camera button is Beach Pass
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/job-photos/upload"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"photoType":"passes"'),
          })
        );
      });
    });

    it("should save photo locally when offline", async () => {
      useNetworkStatus.mockReturnValue({ isOnline: false, isOffline: true });

      const mockPhotoResult = {
        canceled: false,
        assets: [{ base64: "mockBase64Data", uri: "file://photo.jpg" }],
      };
      ImagePicker.launchCameraAsync.mockResolvedValueOnce(mockPhotoResult);

      const { getAllByText } = renderWithContext(
        <PassVerificationCapture {...defaultProps} localJobId="local_123" />
      );

      await waitFor(() => {
        expect(getAllByText("Camera").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Camera")[0]);
      });

      await waitFor(() => {
        expect(PhotoStorage.savePhoto).toHaveBeenCalledWith(
          "file://photo.jpg",
          "local_123",
          "passes",
          "Beach Pass",
          expect.objectContaining({
            photoType: "passes",
            room: "Beach Pass",
          })
        );
      });
    });

    it("should call onPhotosUpdated after successful upload", async () => {
      const mockPhotoResult = {
        canceled: false,
        assets: [{ base64: "mockBase64Data", uri: "file://photo.jpg" }],
      };
      ImagePicker.launchCameraAsync.mockResolvedValueOnce(mockPhotoResult);

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, photo: { id: 1 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ passesPhotos: [{ id: 1 }] }),
        });

      const { getAllByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Camera").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Camera")[0]);
      });

      await waitFor(() => {
        expect(mockOnPhotosUpdated).toHaveBeenCalled();
      });
    });

    it("should show error alert when photo upload fails", async () => {
      const mockPhotoResult = {
        canceled: false,
        assets: [{ base64: "mockBase64Data", uri: "file://photo.jpg" }],
      };
      ImagePicker.launchCameraAsync.mockResolvedValueOnce(mockPhotoResult);

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Upload failed" }),
      });

      const { getAllByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getAllByText("Camera").length).toBeGreaterThan(0);
      });

      await act(async () => {
        fireEvent.press(getAllByText("Camera")[0]);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("Error", "Upload failed");
      });
    });
  });

  describe("Gallery Selection", () => {
    beforeEach(() => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ passesPhotos: [] }),
      });
    });

    it("should launch image library when Gallery button pressed", async () => {
      ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true });

      const { getAllByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

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
  });

  describe("Photo Display and Deletion", () => {
    it("should display existing passes photos", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            passesPhotos: [
              { id: 1, photoType: "passes", photoData: "data1", room: "Beach Pass" },
              { id: 2, photoType: "passes", photoData: "data2", room: "Parking Pass" },
            ],
          }),
      });

      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/2 pass photo\(s\) uploaded/)).toBeTruthy();
      });
    });

    it("should show delete confirmation when delete pressed", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            passesPhotos: [{ id: 1, photoType: "passes", photoData: "data1", room: "Beach Pass" }],
          }),
      });

      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("1 photo")).toBeTruthy();
      });

      fireEvent.press(getByText("×"));

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
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              passesPhotos: [{ id: 1, photoType: "passes", photoData: "data1", room: "Beach Pass" }],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ passesPhotos: [] }),
        });

      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("1 photo")).toBeTruthy();
      });

      fireEvent.press(getByText("×"));

      const deleteButton = Alert.alert.mock.calls[0][2].find((btn) => btn.text === "Delete");

      await act(async () => {
        await deleteButton.onPress();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/job-photos/1"),
          expect.objectContaining({
            method: "DELETE",
          })
        );
      });
    });
  });

  describe("Continue Button Validation", () => {
    it("should show alert when Continue pressed with no photos or N/A", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ passesPhotos: [] }),
      });

      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("Continue to Review")).toBeTruthy();
      });

      fireEvent.press(getByText("Continue to Review"));

      expect(Alert.alert).toHaveBeenCalledWith(
        "Verification Required",
        expect.stringContaining("Please take a photo of any passes")
      );
    });

    it("should call onComplete when passes photos exist", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            passesPhotos: [{ id: 1, photoType: "passes", photoData: "data1", room: "Beach Pass" }],
          }),
      });

      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/1 pass photo\(s\) uploaded/)).toBeTruthy();
      });

      fireEvent.press(getByText("Continue to Review"));

      expect(mockOnComplete).toHaveBeenCalled();
    });

    it("should call onComplete when N/A is marked", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            passesPhotos: [{ id: 1, photoType: "passes", isNotApplicable: true }],
          }),
      });

      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/Marked as N\/A/)).toBeTruthy();
      });

      fireEvent.press(getByText("Continue to Review"));

      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  describe("Offline Mode Display", () => {
    it("should show offline banner when offline", async () => {
      useNetworkStatus.mockReturnValue({ isOnline: false, isOffline: true });

      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText(/Offline - Photos saved locally/)).toBeTruthy();
      });
    });

    it("should show 'saved locally' in status when offline with photos", async () => {
      useNetworkStatus.mockReturnValue({ isOnline: false, isOffline: true });
      PhotoStorage.getPhotosForJob.mockResolvedValue([
        { id: "1", photoType: "passes", localUri: "file://photo.jpg", room: "Beach Pass", _raw: {} },
      ]);

      const { getByText } = renderWithContext(
        <PassVerificationCapture {...defaultProps} localJobId="local_123" />
      );

      await waitFor(() => {
        expect(getByText(/saved locally/)).toBeTruthy();
      });
    });

    it("should show Local badge on locally saved photos", async () => {
      useNetworkStatus.mockReturnValue({ isOnline: false, isOffline: true });
      PhotoStorage.getPhotosForJob.mockResolvedValue([
        {
          id: "1",
          photoType: "passes",
          localUri: "file://photo.jpg",
          room: "Beach Pass",
          uploaded: false,
          _raw: {},
        },
      ]);

      const { getByText } = renderWithContext(
        <PassVerificationCapture {...defaultProps} localJobId="local_123" />
      );

      await waitFor(() => {
        expect(getByText("Local")).toBeTruthy();
      });
    });
  });

  describe("Photo Count Display", () => {
    it("should show photo count per pass type", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            passesPhotos: [
              { id: 1, photoType: "passes", photoData: "data1", room: "Beach Pass" },
              { id: 2, photoType: "passes", photoData: "data2", room: "Beach Pass" },
            ],
          }),
      });

      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("2 photos")).toBeTruthy();
      });
    });

    it("should show singular 'photo' for single photo", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            passesPhotos: [{ id: 1, photoType: "passes", photoData: "data1", room: "Beach Pass" }],
          }),
      });

      const { getByText } = renderWithContext(<PassVerificationCapture {...defaultProps} />);

      await waitFor(() => {
        expect(getByText("1 photo")).toBeTruthy();
      });
    });
  });
});
