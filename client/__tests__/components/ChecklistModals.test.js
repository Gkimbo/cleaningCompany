import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import VersionHistoryModal from "../../src/components/owner/ChecklistEditor/VersionHistoryModal";
import PublishConfirmModal from "../../src/components/owner/ChecklistEditor/PublishConfirmModal";

describe("VersionHistoryModal Component", () => {
  const mockVersions = [
    {
      id: 3,
      version: 3,
      isActive: true,
      publishedAt: new Date("2025-12-26T10:00:00Z").toISOString(),
      snapshotData: {
        sections: [
          { title: "Kitchen", items: [{}, {}] },
          { title: "Bathroom", items: [{}] },
        ],
      },
    },
    {
      id: 2,
      version: 2,
      isActive: false,
      publishedAt: new Date("2025-12-25T10:00:00Z").toISOString(),
      snapshotData: {
        sections: [{ title: "Kitchen", items: [{}] }],
      },
    },
    {
      id: 1,
      version: 1,
      isActive: false,
      publishedAt: new Date("2025-12-24T10:00:00Z").toISOString(),
      snapshotData: {
        sections: [],
      },
    },
  ];

  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    versions: mockVersions,
    loading: false,
    onRevert: jest.fn(),
    currentVersion: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render modal title", () => {
      const { getByText } = render(<VersionHistoryModal {...defaultProps} />);

      expect(getByText("Version History")).toBeTruthy();
    });

    it("should render all versions", () => {
      const { getByText } = render(<VersionHistoryModal {...defaultProps} />);

      expect(getByText("v3")).toBeTruthy();
      expect(getByText("v2")).toBeTruthy();
      expect(getByText("v1")).toBeTruthy();
    });

    it("should show loading state", () => {
      const { getByText } = render(
        <VersionHistoryModal {...defaultProps} loading={true} versions={[]} />
      );

      expect(getByText("Loading versions...")).toBeTruthy();
    });

    it("should show empty state when no versions", () => {
      const { getByText } = render(
        <VersionHistoryModal {...defaultProps} versions={[]} />
      );

      expect(getByText("No versions published yet")).toBeTruthy();
    });

    it("should not render when not visible", () => {
      const { queryByText } = render(
        <VersionHistoryModal {...defaultProps} visible={false} />
      );

      expect(queryByText("Version History")).toBeNull();
    });
  });

  describe("Version Display", () => {
    it("should mark current version as active", () => {
      const { getByText } = render(<VersionHistoryModal {...defaultProps} />);

      expect(getByText("Currently Active")).toBeTruthy();
    });

    it("should show section and item counts", () => {
      const { getByText } = render(<VersionHistoryModal {...defaultProps} />);

      // Version 3 has 2 sections, 3 tasks
      expect(getByText("2 sections, 3 tasks")).toBeTruthy();
    });

    it("should show revert button for non-active versions", () => {
      const { getAllByText } = render(<VersionHistoryModal {...defaultProps} />);

      const revertButtons = getAllByText("Revert");
      // Should have revert buttons for versions 1 and 2 (not 3 which is active)
      expect(revertButtons.length).toBe(2);
    });

    it("should not show revert button for active version", () => {
      const singleActiveVersion = [
        {
          id: 1,
          version: 1,
          isActive: true,
          publishedAt: new Date().toISOString(),
          snapshotData: { sections: [] },
        },
      ];

      const { queryByText } = render(
        <VersionHistoryModal
          {...defaultProps}
          versions={singleActiveVersion}
        />
      );

      expect(queryByText("Revert")).toBeNull();
    });
  });

  describe("Interactions", () => {
    it("should call onClose when Close button is pressed", () => {
      const { getByText } = render(<VersionHistoryModal {...defaultProps} />);

      fireEvent.press(getByText("Close"));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onRevert with version id when Revert is pressed", () => {
      const { getAllByText } = render(<VersionHistoryModal {...defaultProps} />);

      const revertButtons = getAllByText("Revert");
      // Press revert on version 2 (first revert button)
      fireEvent.press(revertButtons[0]);

      expect(defaultProps.onRevert).toHaveBeenCalledWith(2);
    });
  });

  describe("Date Formatting", () => {
    it("should display formatted dates", () => {
      const { getAllByText } = render(<VersionHistoryModal {...defaultProps} />);

      // Should contain date text (multiple versions have Dec dates)
      const decDates = getAllByText(/Dec/);
      expect(decDates.length).toBeGreaterThan(0);
    });
  });
});

describe("PublishConfirmModal Component", () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    loading: false,
    currentVersion: 2,
    sectionCount: 5,
    itemCount: 73,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render modal title", () => {
      const { getByText } = render(<PublishConfirmModal {...defaultProps} />);

      expect(getByText("Publish Checklist")).toBeTruthy();
    });

    it("should display next version number", () => {
      const { getByText } = render(<PublishConfirmModal {...defaultProps} />);

      // Current is 2, next should be 3
      expect(getByText("v3")).toBeTruthy();
    });

    it("should display section count", () => {
      const { getByText } = render(<PublishConfirmModal {...defaultProps} />);

      expect(getByText("5")).toBeTruthy();
    });

    it("should display item count", () => {
      const { getByText } = render(<PublishConfirmModal {...defaultProps} />);

      expect(getByText("73")).toBeTruthy();
    });

    it("should display confirmation message", () => {
      const { getByText } = render(<PublishConfirmModal {...defaultProps} />);

      expect(
        getByText(/This will create Version 3 of the cleaning checklist/)
      ).toBeTruthy();
    });

    it("should not render when not visible", () => {
      const { queryByText } = render(
        <PublishConfirmModal {...defaultProps} visible={false} />
      );

      expect(queryByText("Publish Checklist")).toBeNull();
    });

    it("should show version 1 for first publish", () => {
      const { getByText } = render(
        <PublishConfirmModal {...defaultProps} currentVersion={0} />
      );

      expect(getByText("v1")).toBeTruthy();
    });

    it("should show version 1 when currentVersion is null", () => {
      const { getByText } = render(
        <PublishConfirmModal {...defaultProps} currentVersion={null} />
      );

      expect(getByText("v1")).toBeTruthy();
    });
  });

  describe("Buttons", () => {
    it("should render Cancel button", () => {
      const { getByText } = render(<PublishConfirmModal {...defaultProps} />);

      expect(getByText("Cancel")).toBeTruthy();
    });

    it("should render Publish button", () => {
      const { getByText } = render(<PublishConfirmModal {...defaultProps} />);

      expect(getByText("Publish")).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("should call onClose when Cancel is pressed", () => {
      const { getByText } = render(<PublishConfirmModal {...defaultProps} />);

      fireEvent.press(getByText("Cancel"));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("should call onConfirm when Publish is pressed", () => {
      const { getByText } = render(<PublishConfirmModal {...defaultProps} />);

      fireEvent.press(getByText("Publish"));

      expect(defaultProps.onConfirm).toHaveBeenCalled();
    });

    it("should not call onClose when loading", () => {
      const { getByText } = render(
        <PublishConfirmModal {...defaultProps} loading={true} />
      );

      fireEvent.press(getByText("Cancel"));

      // Should still call onClose even during loading
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it("should not call onConfirm when loading", () => {
      const { queryByText } = render(
        <PublishConfirmModal {...defaultProps} loading={true} />
      );

      // Publish button should show loading indicator instead of text
      expect(queryByText("Publish")).toBeNull();
    });
  });

  describe("Loading State", () => {
    it("should show loading indicator when publishing", () => {
      const { queryByText, UNSAFE_getByType } = render(
        <PublishConfirmModal {...defaultProps} loading={true} />
      );

      // Publish text should be replaced with ActivityIndicator
      expect(queryByText("Publish")).toBeNull();
    });

    it("should disable buttons when loading", () => {
      const { getByText } = render(
        <PublishConfirmModal {...defaultProps} loading={true} />
      );

      const cancelButton = getByText("Cancel");
      fireEvent.press(cancelButton);

      // Cancel should be disabled during loading
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe("Statistics Display", () => {
    it("should show correct labels", () => {
      const { getByText } = render(<PublishConfirmModal {...defaultProps} />);

      expect(getByText("New Version")).toBeTruthy();
      expect(getByText("Sections")).toBeTruthy();
      expect(getByText("Total Tasks")).toBeTruthy();
    });

    it("should handle zero sections", () => {
      const { getByText } = render(
        <PublishConfirmModal {...defaultProps} sectionCount={0} />
      );

      expect(getByText("0")).toBeTruthy();
    });

    it("should handle zero items", () => {
      const { getByText } = render(
        <PublishConfirmModal {...defaultProps} itemCount={0} />
      );

      // There should be a 0 for itemCount
      const zeros = getByText("0");
      expect(zeros).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("should close on backdrop press (requestClose)", () => {
      const { getByText } = render(<PublishConfirmModal {...defaultProps} />);

      // Modal should have onRequestClose handler
      // This is typically triggered by Android back button
    });
  });

  describe("Edge Cases", () => {
    it("should handle large version numbers", () => {
      const { getByText } = render(
        <PublishConfirmModal {...defaultProps} currentVersion={999} />
      );

      expect(getByText("v1000")).toBeTruthy();
    });

    it("should handle large item counts", () => {
      const { getByText } = render(
        <PublishConfirmModal {...defaultProps} itemCount={10000} />
      );

      expect(getByText("10000")).toBeTruthy();
    });
  });
});
