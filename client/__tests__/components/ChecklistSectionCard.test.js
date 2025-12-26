import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// Mock react-native-draggable-flatlist
jest.mock("react-native-draggable-flatlist", () => {
  const { View } = require("react-native");
  return ({ data, renderItem, keyExtractor, onDragEnd }) => (
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

import SectionCard from "../../src/components/owner/ChecklistEditor/SectionCard";

describe("SectionCard Component", () => {
  const mockSection = {
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
      {
        id: "item-3",
        content: "Use soap",
        displayOrder: 2,
        indentLevel: 1,
        formatting: { bold: false, italic: false, bulletStyle: "circle" },
      },
    ],
  };

  const defaultProps = {
    section: mockSection,
    selectedItem: null,
    onSelectItem: jest.fn(),
    onTitleChange: jest.fn(),
    onIconChange: jest.fn(),
    onItemContentChange: jest.fn(),
    onItemReorder: jest.fn(),
    onAddItem: jest.fn(),
    onDeleteItem: jest.fn(),
    onDeleteSection: jest.fn(),
    drag: jest.fn(),
    isActive: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render section title", () => {
      const { getByDisplayValue } = render(<SectionCard {...defaultProps} />);

      expect(getByDisplayValue("Kitchen")).toBeTruthy();
    });

    it("should render section icon", () => {
      const { getByText } = render(<SectionCard {...defaultProps} />);

      expect(getByText("K")).toBeTruthy();
    });

    it("should render all items", () => {
      const { getByDisplayValue } = render(<SectionCard {...defaultProps} />);

      expect(getByDisplayValue("Clean countertops")).toBeTruthy();
      expect(getByDisplayValue("Wash dishes")).toBeTruthy();
      expect(getByDisplayValue("Use soap")).toBeTruthy();
    });

    it("should render Add Task button", () => {
      const { getByText } = render(<SectionCard {...defaultProps} />);

      expect(getByText("+ Add Task")).toBeTruthy();
    });

    it("should render drag handle", () => {
      const { getAllByText } = render(<SectionCard {...defaultProps} />);

      // Hamburger menu icon for drag (each item has one)
      const dragHandles = getAllByText("\u2630");
      expect(dragHandles.length).toBeGreaterThan(0);
    });

    it("should render delete section button", () => {
      const { getAllByText } = render(<SectionCard {...defaultProps} />);

      // X button for delete
      const deleteButtons = getAllByText("\u00D7");
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  describe("Section Title Editing", () => {
    it("should call onTitleChange when title is edited", () => {
      const { getByDisplayValue } = render(<SectionCard {...defaultProps} />);

      const titleInput = getByDisplayValue("Kitchen");
      fireEvent.changeText(titleInput, "Kitchen Area");

      expect(defaultProps.onTitleChange).toHaveBeenCalledWith(
        "section-1",
        "Kitchen Area"
      );
    });
  });

  describe("Item Selection", () => {
    it("should call onSelectItem when item is pressed", () => {
      const { getByDisplayValue } = render(<SectionCard {...defaultProps} />);

      const itemInput = getByDisplayValue("Clean countertops");
      fireEvent(itemInput, "focus");

      expect(defaultProps.onSelectItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: "item-1" })
      );
    });

    it("should show selected state for selected item", () => {
      const selectedItem = mockSection.items[0];
      const { getByDisplayValue } = render(
        <SectionCard {...defaultProps} selectedItem={selectedItem} />
      );

      // Selected item should be visually different
      expect(getByDisplayValue("Clean countertops")).toBeTruthy();
    });
  });

  describe("Item Content Editing", () => {
    it("should call onItemContentChange when item content is edited", () => {
      const { getByDisplayValue } = render(<SectionCard {...defaultProps} />);

      const itemInput = getByDisplayValue("Clean countertops");
      fireEvent.changeText(itemInput, "Clean all countertops");

      expect(defaultProps.onItemContentChange).toHaveBeenCalledWith(
        "item-1",
        "Clean all countertops"
      );
    });
  });

  describe("Adding Items", () => {
    it("should call onAddItem when Add Task is pressed", () => {
      const { getByText } = render(<SectionCard {...defaultProps} />);

      fireEvent.press(getByText("+ Add Task"));

      expect(defaultProps.onAddItem).toHaveBeenCalledWith("section-1");
    });
  });

  describe("Deleting Items", () => {
    it("should call onDeleteItem when item delete is pressed", () => {
      const { getAllByText } = render(<SectionCard {...defaultProps} />);

      // There should be delete buttons for each item plus section
      const deleteButtons = getAllByText("\u00D7");
      // Press the first item's delete button (after section delete)
      fireEvent.press(deleteButtons[1]);

      expect(defaultProps.onDeleteItem).toHaveBeenCalled();
    });
  });

  describe("Deleting Section", () => {
    it("should call onDeleteSection when section delete is pressed", () => {
      const { getAllByText } = render(<SectionCard {...defaultProps} />);

      // The first × button should be the section delete
      const deleteButtons = getAllByText("\u00D7");
      fireEvent.press(deleteButtons[0]);

      expect(defaultProps.onDeleteSection).toHaveBeenCalledWith("section-1");
    });
  });

  describe("Empty Section", () => {
    it("should show empty state message when no items", () => {
      const emptySection = {
        ...mockSection,
        items: [],
      };

      const { getByText } = render(
        <SectionCard {...defaultProps} section={emptySection} />
      );

      expect(getByText("No items in this section")).toBeTruthy();
    });

    it("should still show Add Task button when empty", () => {
      const emptySection = {
        ...mockSection,
        items: [],
      };

      const { getByText } = render(
        <SectionCard {...defaultProps} section={emptySection} />
      );

      expect(getByText("+ Add Task")).toBeTruthy();
    });
  });

  describe("Indentation", () => {
    it("should render indented items with appropriate styling", () => {
      const { getByDisplayValue } = render(<SectionCard {...defaultProps} />);

      // The indented item should have left margin
      const indentedItem = getByDisplayValue("Use soap");
      expect(indentedItem).toBeTruthy();
    });
  });

  describe("Bullet Styles", () => {
    it("should render disc bullet for level 0 items", () => {
      const { getAllByText } = render(<SectionCard {...defaultProps} />);

      // Disc bullets (•)
      const discBullets = getAllByText("\u2022");
      expect(discBullets.length).toBeGreaterThan(0);
    });

    it("should render circle bullet for indented items", () => {
      const { getByText } = render(<SectionCard {...defaultProps} />);

      // Circle bullet (○)
      expect(getByText("\u25CB")).toBeTruthy();
    });
  });

  describe("Formatting Display", () => {
    it("should display bold items with bold style", () => {
      const sectionWithBold = {
        ...mockSection,
        items: [
          {
            id: "item-1",
            content: "Bold item",
            formatting: { bold: true, italic: false, bulletStyle: "disc" },
            indentLevel: 0,
          },
        ],
      };

      const { getByDisplayValue } = render(
        <SectionCard {...defaultProps} section={sectionWithBold} />
      );

      expect(getByDisplayValue("Bold item")).toBeTruthy();
    });

    it("should display italic items with italic style", () => {
      const sectionWithItalic = {
        ...mockSection,
        items: [
          {
            id: "item-1",
            content: "Italic item",
            formatting: { bold: false, italic: true, bulletStyle: "disc" },
            indentLevel: 0,
          },
        ],
      };

      const { getByDisplayValue } = render(
        <SectionCard {...defaultProps} section={sectionWithItalic} />
      );

      expect(getByDisplayValue("Italic item")).toBeTruthy();
    });
  });

  describe("Drag State", () => {
    it("should apply active styles when dragging", () => {
      const { getByDisplayValue } = render(
        <SectionCard {...defaultProps} isActive={true} />
      );

      // Should still render correctly when being dragged
      expect(getByDisplayValue("Kitchen")).toBeTruthy();
    });
  });

  describe("Numbered Lists", () => {
    it("should render numbered items correctly", () => {
      const sectionWithNumbers = {
        ...mockSection,
        items: [
          {
            id: "item-1",
            content: "First item",
            formatting: { bulletStyle: "number" },
            indentLevel: 0,
          },
          {
            id: "item-2",
            content: "Second item",
            formatting: { bulletStyle: "number" },
            indentLevel: 0,
          },
        ],
      };

      const { getByText } = render(
        <SectionCard {...defaultProps} section={sectionWithNumbers} />
      );

      expect(getByText("1.")).toBeTruthy();
      expect(getByText("2.")).toBeTruthy();
    });
  });

  describe("Section Icon", () => {
    it("should display custom icon", () => {
      const sectionWithCustomIcon = {
        ...mockSection,
        icon: "B",
      };

      const { getByText } = render(
        <SectionCard {...defaultProps} section={sectionWithCustomIcon} />
      );

      expect(getByText("B")).toBeTruthy();
    });

    it("should display default icon when none provided", () => {
      const sectionWithoutIcon = {
        ...mockSection,
        icon: null,
      };

      const { getByText } = render(
        <SectionCard {...defaultProps} section={sectionWithoutIcon} />
      );

      // Should use "S" as default
      expect(getByText("S")).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("should handle items without formatting property", () => {
      const sectionWithNoFormatting = {
        ...mockSection,
        items: [
          {
            id: "item-1",
            content: "No formatting",
            indentLevel: 0,
          },
        ],
      };

      const { getByDisplayValue } = render(
        <SectionCard {...defaultProps} section={sectionWithNoFormatting} />
      );

      expect(getByDisplayValue("No formatting")).toBeTruthy();
    });

    it("should handle items without indentLevel", () => {
      const sectionWithNoIndent = {
        ...mockSection,
        items: [
          {
            id: "item-1",
            content: "No indent level",
            formatting: { bulletStyle: "disc" },
          },
        ],
      };

      const { getByDisplayValue } = render(
        <SectionCard {...defaultProps} section={sectionWithNoIndent} />
      );

      expect(getByDisplayValue("No indent level")).toBeTruthy();
    });

    it("should handle null items array", () => {
      const sectionWithNullItems = {
        ...mockSection,
        items: null,
      };

      const { getByText } = render(
        <SectionCard {...defaultProps} section={sectionWithNullItems} />
      );

      // Should show empty state
      expect(getByText("No items in this section")).toBeTruthy();
    });
  });
});
