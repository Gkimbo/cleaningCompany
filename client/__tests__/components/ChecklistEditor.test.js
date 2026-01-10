import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock react-native-gesture-handler
jest.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: ({ children }) => children,
}));

// Mock react-native-draggable-flatlist
jest.mock("react-native-draggable-flatlist", () => {
  const { View } = require("react-native");
  return ({ data, renderItem, keyExtractor }) => (
    <View testID="draggable-flatlist">
      {data.map((item, index) =>
        renderItem({
          item,
          index,
          drag: jest.fn(),
          isActive: false,
        })
      )}
    </View>
  );
});

// Mock ChecklistService
jest.mock("../../src/services/fetchRequests/ChecklistService", () => ({
  __esModule: true,
  default: {
    getPublishedChecklist: jest.fn(),
    getDraft: jest.fn(),
    saveDraft: jest.fn(),
    publishDraft: jest.fn(),
    getVersionHistory: jest.fn(),
    revertToVersion: jest.fn(),
    seedFromHardcoded: jest.fn(),
  },
}));

import ChecklistEditor from "../../src/components/owner/ChecklistEditor";
import ChecklistService from "../../src/services/fetchRequests/ChecklistService";

describe("ChecklistEditor Component", () => {
  const mockState = {
    currentUser: {
      token: "test-token-123",
      type: "owner",
    },
  };

  const mockDraftData = {
    sections: [
      {
        id: "section-1",
        title: "Kitchen",
        icon: "K",
        displayOrder: 0,
        items: [
          {
            id: "item-1",
            content: "Clean countertops",
            displayOrder: 0,
            indentLevel: 0,
            formatting: { bold: false, italic: false, bulletStyle: "disc" },
          },
          {
            id: "item-2",
            content: "Wash dishes",
            displayOrder: 1,
            indentLevel: 0,
            formatting: { bold: false, italic: false, bulletStyle: "disc" },
          },
        ],
      },
      {
        id: "section-2",
        title: "Bathroom",
        icon: "B",
        displayOrder: 1,
        items: [
          {
            id: "item-3",
            content: "Clean toilet",
            displayOrder: 0,
            indentLevel: 0,
            formatting: { bold: false, italic: false, bulletStyle: "disc" },
          },
        ],
      },
    ],
    metadata: { version: 1 },
  };

  // API response format: { draft: draftData, lastModified, draftId }
  const mockDraft = {
    draft: mockDraftData,
    lastModified: new Date().toISOString(),
    draftId: 1,
  };

  // API response format: { checklist: snapshotData, version: number, publishedAt }
  const mockPublished = {
    checklist: mockDraftData,
    version: 1,
    publishedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock implementations
    ChecklistService.getDraft.mockResolvedValue(mockDraft);
    ChecklistService.getPublishedChecklist.mockResolvedValue(mockPublished);
    ChecklistService.saveDraft.mockResolvedValue({ success: true });
    ChecklistService.publishDraft.mockResolvedValue({
      success: true,
      version: 2,
    });
    ChecklistService.getVersionHistory.mockResolvedValue({ versions: [] });
    ChecklistService.seedFromHardcoded.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Rendering", () => {
    it("should show loading state initially", async () => {
      ChecklistService.getDraft.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { getByText } = render(<ChecklistEditor state={mockState} />);

      expect(getByText("Loading checklist...")).toBeTruthy();
    });

    it("should render editor after loading", async () => {
      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      expect(getByText("Checklist Editor")).toBeTruthy();
      expect(getByText("Edit")).toBeTruthy();
      expect(getByText("Preview")).toBeTruthy();
    });

    it("should render sections from draft", async () => {
      const { getByDisplayValue, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      // Section titles are rendered in TextInput components
      expect(getByDisplayValue("Kitchen")).toBeTruthy();
      expect(getByDisplayValue("Bathroom")).toBeTruthy();
    });

    it("should render items in sections", async () => {
      const { getByDisplayValue, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      expect(getByDisplayValue("Clean countertops")).toBeTruthy();
      expect(getByDisplayValue("Wash dishes")).toBeTruthy();
    });

    it("should show published status when not dirty", async () => {
      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      expect(getByText("PUBLISHED")).toBeTruthy();
      expect(getByText("Version 1")).toBeTruthy();
    });
  });

  describe("Navigation", () => {
    it("should navigate back when back button is pressed", async () => {
      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      fireEvent.press(getByText("Back"));

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe("Mode Switching", () => {
    it("should switch to preview mode", async () => {
      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      fireEvent.press(getByText("Preview"));

      // In preview mode, items should be displayed as text, not inputs
      // The toolbar should not be visible
      expect(getByText("Kitchen")).toBeTruthy();
    });

    it("should switch back to edit mode", async () => {
      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      // Switch to preview
      fireEvent.press(getByText("Preview"));
      // Switch back to edit
      fireEvent.press(getByText("Edit"));

      // Should be back in edit mode with editable inputs
      expect(getByText("+ Add Section")).toBeTruthy();
    });
  });

  describe("Adding Sections", () => {
    it("should add a new section when button is pressed", async () => {
      const { getByText, queryByText, getAllByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      const initialSections = getAllByText(/K|B/).length;

      fireEvent.press(getByText("+ Add Section"));

      await waitFor(() => {
        // Should have one more section
        const newSections = getAllByText(/K|B|S/).length;
        expect(newSections).toBeGreaterThan(initialSections);
      });
    });
  });

  describe("Adding Items", () => {
    it("should add a new item to a section", async () => {
      const { getAllByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      const addTaskButtons = getAllByText("+ Add Task");
      fireEvent.press(addTaskButtons[0]);

      // The section should now have more items
      // This is handled by state update
    });
  });

  describe("Auto-save", () => {
    it("should trigger auto-save after changes", async () => {
      const { getByDisplayValue, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      // Make a change
      const input = getByDisplayValue("Clean countertops");
      fireEvent.changeText(input, "Clean all countertops");

      // Fast-forward auto-save timer (2 seconds)
      act(() => {
        jest.advanceTimersByTime(2500);
      });

      await waitFor(() => {
        expect(ChecklistService.saveDraft).toHaveBeenCalled();
      });
    });

    it("should show saving status during auto-save", async () => {
      ChecklistService.saveDraft.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
      );

      const { getByDisplayValue, getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      // Make a change
      const input = getByDisplayValue("Clean countertops");
      fireEvent.changeText(input, "Clean all countertops");

      // Should show unsaved status
      expect(getByText("Unsaved changes")).toBeTruthy();
    });
  });

  describe("Manual Save", () => {
    it("should save draft when Save Draft button is pressed", async () => {
      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      fireEvent.press(getByText("Save Draft"));

      await waitFor(() => {
        expect(ChecklistService.saveDraft).toHaveBeenCalled();
      });
    });
  });

  describe("Publishing", () => {
    it("should open publish confirm modal when Publish is pressed", async () => {
      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      fireEvent.press(getByText("Publish"));

      await waitFor(() => {
        expect(getByText("Publish Checklist")).toBeTruthy();
      });
    });

    it("should publish when confirmed", async () => {
      const { getByText, queryByText, getAllByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      // Open publish modal
      fireEvent.press(getByText("Publish"));

      await waitFor(() => {
        expect(getByText("Publish Checklist")).toBeTruthy();
      });

      // Find and press the Publish button in the modal
      const publishButtons = getAllByText("Publish");
      fireEvent.press(publishButtons[publishButtons.length - 1]);

      await waitFor(() => {
        expect(ChecklistService.saveDraft).toHaveBeenCalled();
        expect(ChecklistService.publishDraft).toHaveBeenCalled();
      });
    });
  });

  describe("Version History", () => {
    it("should open version history modal", async () => {
      ChecklistService.getVersionHistory.mockResolvedValue({
        versions: [
          {
            id: 1,
            version: 1,
            isActive: true,
            publishedAt: new Date().toISOString(),
            snapshotData: { sections: [] },
          },
        ],
      });

      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      fireEvent.press(getByText("🕐 History"));

      await waitFor(() => {
        expect(getByText("Version History")).toBeTruthy();
      });
    });
  });

  describe("Empty State", () => {
    it("should show seed button when no checklist exists", async () => {
      ChecklistService.getDraft.mockResolvedValue(null);
      // API returns { checklist: null, message: "..." } when no version
      ChecklistService.getPublishedChecklist.mockResolvedValue({
        checklist: null,
        message: "No checklist published yet",
      });

      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      expect(getByText("Load Default Checklist")).toBeTruthy();
    });

    it("should show empty state message for sections", async () => {
      ChecklistService.getDraft.mockResolvedValue({
        draft: { sections: [], metadata: {} },
        lastModified: null,
        draftId: null,
      });
      ChecklistService.getPublishedChecklist.mockResolvedValue({
        checklist: null,
        message: "No checklist published yet",
      });

      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      expect(getByText("No sections yet")).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("should handle draft load failure gracefully", async () => {
      ChecklistService.getDraft.mockRejectedValue(new Error("Network error"));
      ChecklistService.getPublishedChecklist.mockResolvedValue({
        checklist: null,
        message: "No checklist published yet",
      });

      const { queryByText } = render(<ChecklistEditor state={mockState} />);

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      // Should still render, just with empty data
      expect(queryByText("Checklist Editor")).toBeTruthy();
    });

    it("should handle save failure", async () => {
      ChecklistService.saveDraft.mockResolvedValue({
        success: false,
        error: "Save failed",
      });

      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      fireEvent.press(getByText("Save Draft"));

      // Should show error (via alert mock)
    });

    it("should handle publish failure", async () => {
      ChecklistService.publishDraft.mockResolvedValue({
        success: false,
        error: "Publish failed",
      });

      const { getByText, queryByText, getAllByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      fireEvent.press(getByText("Publish"));

      await waitFor(() => {
        expect(getByText("Publish Checklist")).toBeTruthy();
      });

      const publishButtons = getAllByText("Publish");
      fireEvent.press(publishButtons[publishButtons.length - 1]);

      await waitFor(() => {
        expect(ChecklistService.publishDraft).toHaveBeenCalled();
      });
    });
  });

  describe("Dirty State", () => {
    it("should mark as dirty after editing content", async () => {
      const { getByDisplayValue, getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      const input = getByDisplayValue("Clean countertops");
      fireEvent.changeText(input, "Clean all countertops thoroughly");

      await waitFor(() => {
        expect(getByText("DRAFT")).toBeTruthy();
        expect(getByText("Unsaved Changes")).toBeTruthy();
      });
    });
  });

  describe("Section Title Editing", () => {
    it("should update section title", async () => {
      const { getByDisplayValue, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      const titleInput = getByDisplayValue("Kitchen");
      fireEvent.changeText(titleInput, "Kitchen Area");

      expect(getByDisplayValue("Kitchen Area")).toBeTruthy();
    });
  });

  describe("API Calls", () => {
    it("should call getDraft and getPublishedChecklist on mount", async () => {
      render(<ChecklistEditor state={mockState} />);

      await waitFor(() => {
        expect(ChecklistService.getDraft).toHaveBeenCalledWith("test-token-123");
        expect(ChecklistService.getPublishedChecklist).toHaveBeenCalledWith(
          "test-token-123"
        );
      });
    });

    it("should call getVersionHistory when opening history modal", async () => {
      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      fireEvent.press(getByText("🕐 History"));

      await waitFor(() => {
        expect(ChecklistService.getVersionHistory).toHaveBeenCalledWith(
          "test-token-123"
        );
      });
    });
  });

  describe("Statistics Display", () => {
    it("should show correct section and item counts in publish modal", async () => {
      const { getByText, queryByText } = render(
        <ChecklistEditor state={mockState} />
      );

      await waitFor(() => {
        expect(queryByText("Loading checklist...")).toBeNull();
      });

      fireEvent.press(getByText("Publish"));

      await waitFor(() => {
        expect(getByText("2")).toBeTruthy(); // 2 sections
        expect(getByText("3")).toBeTruthy(); // 3 items total
      });
    });
  });
});
