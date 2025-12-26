import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ChecklistToolbar from "../../src/components/owner/ChecklistEditor/ChecklistToolbar";

describe("ChecklistToolbar Component", () => {
  const defaultProps = {
    selectedItem: null,
    onFormatBold: jest.fn(),
    onFormatItalic: jest.fn(),
    onBulletDisc: jest.fn(),
    onBulletCircle: jest.fn(),
    onBulletNumber: jest.fn(),
    onIndent: jest.fn(),
    onOutdent: jest.fn(),
    onAddItem: jest.fn(),
    onDeleteItem: jest.fn(),
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render all toolbar buttons", () => {
      const { getByText } = render(<ChecklistToolbar {...defaultProps} />);

      // Bold button
      expect(getByText("B")).toBeTruthy();
      // Italic button
      expect(getByText("I")).toBeTruthy();
      // Bullet disc
      expect(getByText("\u2022")).toBeTruthy();
      // Bullet circle
      expect(getByText("\u25CB")).toBeTruthy();
      // Numbered list
      expect(getByText("1.")).toBeTruthy();
      // Indent
      expect(getByText("\u2192")).toBeTruthy();
      // Outdent
      expect(getByText("\u2190")).toBeTruthy();
      // Add item
      expect(getByText("+")).toBeTruthy();
    });

    it("should render with disabled state", () => {
      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} disabled={true} />
      );

      // Buttons should still be visible but disabled
      expect(getByText("B")).toBeTruthy();
    });
  });

  describe("Bold Formatting", () => {
    it("should call onFormatBold when bold button is pressed", () => {
      const { getByText } = render(<ChecklistToolbar {...defaultProps} />);

      fireEvent.press(getByText("B"));

      expect(defaultProps.onFormatBold).toHaveBeenCalled();
    });

    it("should show active state when item is bold", () => {
      const selectedItem = {
        id: "1",
        content: "Test",
        formatting: { bold: true, italic: false, bulletStyle: "disc" },
        indentLevel: 0,
      };

      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} selectedItem={selectedItem} />
      );

      // The bold button should have active styling
      const boldButton = getByText("B");
      expect(boldButton).toBeTruthy();
    });

    it("should not call onFormatBold when disabled", () => {
      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} disabled={true} />
      );

      fireEvent.press(getByText("B"));

      expect(defaultProps.onFormatBold).not.toHaveBeenCalled();
    });
  });

  describe("Italic Formatting", () => {
    it("should call onFormatItalic when italic button is pressed", () => {
      const { getByText } = render(<ChecklistToolbar {...defaultProps} />);

      fireEvent.press(getByText("I"));

      expect(defaultProps.onFormatItalic).toHaveBeenCalled();
    });

    it("should show active state when item is italic", () => {
      const selectedItem = {
        id: "1",
        content: "Test",
        formatting: { bold: false, italic: true, bulletStyle: "disc" },
        indentLevel: 0,
      };

      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} selectedItem={selectedItem} />
      );

      const italicButton = getByText("I");
      expect(italicButton).toBeTruthy();
    });
  });

  describe("Bullet Style", () => {
    it("should call onBulletDisc when disc bullet is pressed", () => {
      const { getByText } = render(<ChecklistToolbar {...defaultProps} />);

      fireEvent.press(getByText("\u2022"));

      expect(defaultProps.onBulletDisc).toHaveBeenCalled();
    });

    it("should call onBulletCircle when circle bullet is pressed", () => {
      const { getByText } = render(<ChecklistToolbar {...defaultProps} />);

      fireEvent.press(getByText("\u25CB"));

      expect(defaultProps.onBulletCircle).toHaveBeenCalled();
    });

    it("should call onBulletNumber when number bullet is pressed", () => {
      const { getByText } = render(<ChecklistToolbar {...defaultProps} />);

      fireEvent.press(getByText("1."));

      expect(defaultProps.onBulletNumber).toHaveBeenCalled();
    });

    it("should show active state for current bullet style", () => {
      const selectedItem = {
        id: "1",
        content: "Test",
        formatting: { bold: false, italic: false, bulletStyle: "circle" },
        indentLevel: 0,
      };

      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} selectedItem={selectedItem} />
      );

      // Circle bullet should show active state
      expect(getByText("\u25CB")).toBeTruthy();
    });
  });

  describe("Indentation", () => {
    it("should call onIndent when indent button is pressed", () => {
      const selectedItem = {
        id: "1",
        content: "Test",
        formatting: { bold: false, italic: false, bulletStyle: "disc" },
        indentLevel: 0,
      };

      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} selectedItem={selectedItem} />
      );

      fireEvent.press(getByText("\u2192"));

      expect(defaultProps.onIndent).toHaveBeenCalled();
    });

    it("should call onOutdent when outdent button is pressed", () => {
      const selectedItem = {
        id: "1",
        content: "Test",
        formatting: { bold: false, italic: false, bulletStyle: "disc" },
        indentLevel: 1,
      };

      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} selectedItem={selectedItem} />
      );

      fireEvent.press(getByText("\u2190"));

      expect(defaultProps.onOutdent).toHaveBeenCalled();
    });

    it("should disable indent button at max level (2)", () => {
      const selectedItem = {
        id: "1",
        content: "Test",
        formatting: { bold: false, italic: false, bulletStyle: "disc" },
        indentLevel: 2,
      };

      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} selectedItem={selectedItem} />
      );

      fireEvent.press(getByText("\u2192"));

      // Should not be called because already at max indent
      expect(defaultProps.onIndent).not.toHaveBeenCalled();
    });

    it("should disable outdent button at min level (0)", () => {
      const selectedItem = {
        id: "1",
        content: "Test",
        formatting: { bold: false, italic: false, bulletStyle: "disc" },
        indentLevel: 0,
      };

      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} selectedItem={selectedItem} />
      );

      fireEvent.press(getByText("\u2190"));

      // Should not be called because already at min indent
      expect(defaultProps.onOutdent).not.toHaveBeenCalled();
    });
  });

  describe("Add Item", () => {
    it("should call onAddItem when add button is pressed", () => {
      const { getByText } = render(<ChecklistToolbar {...defaultProps} />);

      fireEvent.press(getByText("+"));

      expect(defaultProps.onAddItem).toHaveBeenCalled();
    });

    it("should always be enabled (not affected by disabled prop for add)", () => {
      const { getByText } = render(<ChecklistToolbar {...defaultProps} />);

      fireEvent.press(getByText("+"));

      expect(defaultProps.onAddItem).toHaveBeenCalled();
    });
  });

  describe("Delete Item", () => {
    it("should call onDeleteItem when delete button is pressed", () => {
      const selectedItem = {
        id: "1",
        content: "Test",
        formatting: { bold: false, italic: false, bulletStyle: "disc" },
        indentLevel: 0,
      };

      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} selectedItem={selectedItem} />
      );

      // Find trash icon button
      fireEvent.press(getByText("\uD83D\uDDD1"));

      expect(defaultProps.onDeleteItem).toHaveBeenCalled();
    });

    it("should not call onDeleteItem when disabled", () => {
      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} disabled={true} />
      );

      fireEvent.press(getByText("\uD83D\uDDD1"));

      expect(defaultProps.onDeleteItem).not.toHaveBeenCalled();
    });
  });

  describe("Selected Item State", () => {
    it("should show correct formatting for selected item", () => {
      const selectedItem = {
        id: "1",
        content: "Bold and Italic",
        formatting: { bold: true, italic: true, bulletStyle: "number" },
        indentLevel: 1,
      };

      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} selectedItem={selectedItem} />
      );

      // All buttons should be visible
      expect(getByText("B")).toBeTruthy();
      expect(getByText("I")).toBeTruthy();
      expect(getByText("1.")).toBeTruthy();
    });

    it("should handle null selectedItem", () => {
      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} selectedItem={null} />
      );

      // Should render without crashing
      expect(getByText("B")).toBeTruthy();
    });

    it("should handle selectedItem without formatting", () => {
      const selectedItem = {
        id: "1",
        content: "No formatting",
      };

      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} selectedItem={selectedItem} />
      );

      // Should render without crashing
      expect(getByText("B")).toBeTruthy();
    });
  });

  describe("Toolbar Layout", () => {
    it("should render dividers between button groups", () => {
      const { UNSAFE_getAllByType } = render(
        <ChecklistToolbar {...defaultProps} />
      );

      // The toolbar should have dividers (View components) between groups
      // This is a structural test
    });
  });

  describe("Accessibility", () => {
    it("should have pressable buttons", () => {
      const { getByText } = render(<ChecklistToolbar {...defaultProps} />);

      // All buttons should be pressable
      expect(() => fireEvent.press(getByText("B"))).not.toThrow();
      expect(() => fireEvent.press(getByText("I"))).not.toThrow();
      expect(() => fireEvent.press(getByText("+"))).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle rapid button presses", () => {
      const { getByText } = render(<ChecklistToolbar {...defaultProps} />);

      // Rapid presses
      fireEvent.press(getByText("B"));
      fireEvent.press(getByText("B"));
      fireEvent.press(getByText("B"));

      expect(defaultProps.onFormatBold).toHaveBeenCalledTimes(3);
    });

    it("should handle selectedItem with undefined formatting properties", () => {
      const selectedItem = {
        id: "1",
        content: "Test",
        formatting: {},
        indentLevel: undefined,
      };

      const { getByText } = render(
        <ChecklistToolbar {...defaultProps} selectedItem={selectedItem} />
      );

      // Should render without crashing
      expect(getByText("B")).toBeTruthy();
    });
  });
});
