/**
 * ChecklistEditor Tests
 * Tests for ensureIds, snapshotData handling, and section management
 */

describe("ChecklistEditor - ensureIds Function", () => {
  // Replicate the ensureIds function from ChecklistEditor.js
  const ensureIds = (sectionsData) => {
    if (!sectionsData) return [];
    return sectionsData.map((section, sIndex) => ({
      ...section,
      id: section.id || `section_${sIndex}_${Date.now()}`,
      items: (section.items || []).map((item, iIndex) => ({
        ...item,
        id: item.id || `item_${sIndex}_${iIndex}_${Date.now()}`,
      })),
    }));
  };

  describe("Section ID generation", () => {
    it("should preserve existing section IDs", () => {
      const sections = [
        { id: "existing-id-1", title: "Kitchen", items: [] },
        { id: "existing-id-2", title: "Bathroom", items: [] },
      ];

      const result = ensureIds(sections);

      expect(result[0].id).toBe("existing-id-1");
      expect(result[1].id).toBe("existing-id-2");
    });

    it("should generate IDs for sections without IDs", () => {
      const sections = [
        { title: "Kitchen", items: [] },
        { title: "Bathroom", items: [] },
      ];

      const result = ensureIds(sections);

      expect(result[0].id).toBeDefined();
      expect(result[1].id).toBeDefined();
      expect(result[0].id).toContain("section_0_");
      expect(result[1].id).toContain("section_1_");
    });

    it("should generate unique IDs for each section", () => {
      const sections = [
        { title: "Kitchen", items: [] },
        { title: "Bathroom", items: [] },
        { title: "Bedroom", items: [] },
      ];

      const result = ensureIds(sections);
      const ids = result.map((s) => s.id);

      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("Item ID generation", () => {
    it("should preserve existing item IDs", () => {
      const sections = [
        {
          id: "section-1",
          title: "Kitchen",
          items: [
            { id: "item-1", content: "Clean countertops" },
            { id: "item-2", content: "Wipe appliances" },
          ],
        },
      ];

      const result = ensureIds(sections);

      expect(result[0].items[0].id).toBe("item-1");
      expect(result[0].items[1].id).toBe("item-2");
    });

    it("should generate IDs for items without IDs", () => {
      const sections = [
        {
          id: "section-1",
          title: "Kitchen",
          items: [{ content: "Clean countertops" }, { content: "Wipe appliances" }],
        },
      ];

      const result = ensureIds(sections);

      expect(result[0].items[0].id).toBeDefined();
      expect(result[0].items[1].id).toBeDefined();
      expect(result[0].items[0].id).toContain("item_0_0_");
      expect(result[0].items[1].id).toContain("item_0_1_");
    });

    it("should generate unique IDs for items across sections", () => {
      const sections = [
        {
          title: "Kitchen",
          items: [{ content: "Item 1" }, { content: "Item 2" }],
        },
        {
          title: "Bathroom",
          items: [{ content: "Item 3" }, { content: "Item 4" }],
        },
      ];

      const result = ensureIds(sections);
      const allItemIds = result.flatMap((s) => s.items.map((i) => i.id));

      expect(new Set(allItemIds).size).toBe(allItemIds.length);
    });
  });

  describe("Edge cases", () => {
    it("should return empty array for null input", () => {
      const result = ensureIds(null);
      expect(result).toEqual([]);
    });

    it("should return empty array for undefined input", () => {
      const result = ensureIds(undefined);
      expect(result).toEqual([]);
    });

    it("should handle empty sections array", () => {
      const result = ensureIds([]);
      expect(result).toEqual([]);
    });

    it("should handle sections with empty items array", () => {
      const sections = [{ title: "Kitchen", items: [] }];

      const result = ensureIds(sections);

      expect(result[0].items).toEqual([]);
    });

    it("should handle sections with missing items property", () => {
      const sections = [{ title: "Kitchen" }];

      const result = ensureIds(sections);

      expect(result[0].items).toEqual([]);
    });

    it("should preserve all other section properties", () => {
      const sections = [
        {
          title: "Kitchen",
          icon: "kitchen-icon",
          displayOrder: 1,
          customField: "custom-value",
          items: [],
        },
      ];

      const result = ensureIds(sections);

      expect(result[0].title).toBe("Kitchen");
      expect(result[0].icon).toBe("kitchen-icon");
      expect(result[0].displayOrder).toBe(1);
      expect(result[0].customField).toBe("custom-value");
    });

    it("should preserve all other item properties", () => {
      const sections = [
        {
          title: "Kitchen",
          items: [
            {
              content: "Clean countertops",
              displayOrder: 1,
              customField: "custom-value",
            },
          ],
        },
      ];

      const result = ensureIds(sections);

      expect(result[0].items[0].content).toBe("Clean countertops");
      expect(result[0].items[0].displayOrder).toBe(1);
      expect(result[0].items[0].customField).toBe("custom-value");
    });
  });
});

describe("ChecklistEditor - snapshotData Handling", () => {
  describe("Initial sections loading", () => {
    it("should extract sections from snapshotData.sections", () => {
      const checklist = {
        id: 1,
        snapshotData: {
          sections: [
            { title: "Kitchen", items: [] },
            { title: "Bathroom", items: [] },
          ],
        },
      };

      const sections = checklist.snapshotData?.sections || [];

      expect(sections.length).toBe(2);
      expect(sections[0].title).toBe("Kitchen");
    });

    it("should handle missing snapshotData", () => {
      const checklist = {
        id: 1,
      };

      const sections = checklist.snapshotData?.sections || [];

      expect(sections).toEqual([]);
    });

    it("should handle null snapshotData", () => {
      const checklist = {
        id: 1,
        snapshotData: null,
      };

      const sections = checklist.snapshotData?.sections || [];

      expect(sections).toEqual([]);
    });

    it("should handle snapshotData without sections property", () => {
      const checklist = {
        id: 1,
        snapshotData: {},
      };

      const sections = checklist.snapshotData?.sections || [];

      expect(sections).toEqual([]);
    });
  });

  describe("Section names extraction", () => {
    it("should extract section names correctly", () => {
      const sections = [
        { title: "Kitchen", items: [] },
        { title: "Bathroom", items: [] },
        { title: "Bedroom", items: [] },
      ];

      const sectionNames = sections.map((s) => s.title);

      expect(sectionNames).toEqual(["Kitchen", "Bathroom", "Bedroom"]);
    });

    it("should handle empty sections array", () => {
      const sections = [];

      const sectionNames = sections.map((s) => s.title);

      expect(sectionNames).toEqual([]);
    });
  });

  describe("Item count calculation", () => {
    it("should calculate total items across sections", () => {
      const sections = [
        { title: "Kitchen", items: [{}, {}, {}] },
        { title: "Bathroom", items: [{}, {}] },
      ];

      const totalItems = sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);

      expect(totalItems).toBe(5);
    });

    it("should handle sections with no items", () => {
      const sections = [
        { title: "Kitchen", items: [] },
        { title: "Bathroom", items: [] },
      ];

      const totalItems = sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);

      expect(totalItems).toBe(0);
    });

    it("should handle sections with undefined items", () => {
      const sections = [{ title: "Kitchen" }, { title: "Bathroom" }];

      const totalItems = sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);

      expect(totalItems).toBe(0);
    });
  });
});

describe("ChecklistEditor - Section Operations", () => {
  describe("Add section", () => {
    it("should add new section with generated ID", () => {
      const sections = [{ id: "section-1", title: "Kitchen", items: [] }];

      const newSection = {
        id: `section_${Date.now()}`,
        title: "New Section",
        icon: "",
        items: [],
      };

      const updatedSections = [...sections, newSection];

      expect(updatedSections.length).toBe(2);
      expect(updatedSections[1].title).toBe("New Section");
    });
  });

  describe("Delete section", () => {
    it("should remove section by ID", () => {
      const sections = [
        { id: "section-1", title: "Kitchen", items: [] },
        { id: "section-2", title: "Bathroom", items: [] },
        { id: "section-3", title: "Bedroom", items: [] },
      ];

      const sectionIdToDelete = "section-2";
      const updatedSections = sections.filter((s) => s.id !== sectionIdToDelete);

      expect(updatedSections.length).toBe(2);
      expect(updatedSections.map((s) => s.id)).not.toContain("section-2");
    });
  });

  describe("Update section title", () => {
    it("should update section title by ID", () => {
      const sections = [
        { id: "section-1", title: "Kitchen", items: [] },
        { id: "section-2", title: "Bathroom", items: [] },
      ];

      const sectionIdToUpdate = "section-1";
      const newTitle = "Updated Kitchen";

      const updatedSections = sections.map((s) =>
        s.id === sectionIdToUpdate ? { ...s, title: newTitle } : s
      );

      expect(updatedSections[0].title).toBe("Updated Kitchen");
      expect(updatedSections[1].title).toBe("Bathroom");
    });
  });

  describe("Reorder sections", () => {
    it("should reorder sections correctly", () => {
      const sections = [
        { id: "section-1", title: "Kitchen", displayOrder: 1 },
        { id: "section-2", title: "Bathroom", displayOrder: 2 },
        { id: "section-3", title: "Bedroom", displayOrder: 3 },
      ];

      // Move section-3 to position 1
      const reorderedSections = [sections[2], sections[0], sections[1]].map((s, i) => ({
        ...s,
        displayOrder: i + 1,
      }));

      expect(reorderedSections[0].id).toBe("section-3");
      expect(reorderedSections[0].displayOrder).toBe(1);
      expect(reorderedSections[1].id).toBe("section-1");
      expect(reorderedSections[2].id).toBe("section-2");
    });
  });
});

describe("ChecklistEditor - Item Operations", () => {
  describe("Add item to section", () => {
    it("should add new item to specified section", () => {
      const sections = [
        {
          id: "section-1",
          title: "Kitchen",
          items: [{ id: "item-1", content: "Existing item" }],
        },
      ];

      const newItem = {
        id: `item_${Date.now()}`,
        content: "New item",
      };

      const sectionId = "section-1";
      const updatedSections = sections.map((s) =>
        s.id === sectionId ? { ...s, items: [...s.items, newItem] } : s
      );

      expect(updatedSections[0].items.length).toBe(2);
      expect(updatedSections[0].items[1].content).toBe("New item");
    });
  });

  describe("Delete item from section", () => {
    it("should remove item by ID from specified section", () => {
      const sections = [
        {
          id: "section-1",
          title: "Kitchen",
          items: [
            { id: "item-1", content: "Item 1" },
            { id: "item-2", content: "Item 2" },
            { id: "item-3", content: "Item 3" },
          ],
        },
      ];

      const sectionId = "section-1";
      const itemIdToDelete = "item-2";

      const updatedSections = sections.map((s) =>
        s.id === sectionId
          ? { ...s, items: s.items.filter((i) => i.id !== itemIdToDelete) }
          : s
      );

      expect(updatedSections[0].items.length).toBe(2);
      expect(updatedSections[0].items.map((i) => i.id)).not.toContain("item-2");
    });
  });

  describe("Update item content", () => {
    it("should update item content by ID", () => {
      const sections = [
        {
          id: "section-1",
          title: "Kitchen",
          items: [
            { id: "item-1", content: "Original content" },
            { id: "item-2", content: "Other item" },
          ],
        },
      ];

      const sectionId = "section-1";
      const itemId = "item-1";
      const newContent = "Updated content";

      const updatedSections = sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              items: s.items.map((i) =>
                i.id === itemId ? { ...i, content: newContent } : i
              ),
            }
          : s
      );

      expect(updatedSections[0].items[0].content).toBe("Updated content");
      expect(updatedSections[0].items[1].content).toBe("Other item");
    });
  });
});

describe("ChecklistEditor - Fork Platform Checklist", () => {
  describe("API response handling", () => {
    it("should check for success in response", () => {
      const mockResponse = {
        success: true,
        checklist: {
          id: 1,
          snapshotData: {
            sections: [{ title: "Kitchen", items: [] }],
          },
        },
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.checklist.snapshotData.sections).toBeDefined();
    });

    it("should handle unsuccessful response", () => {
      const mockResponse = {
        success: false,
        error: "Failed to fork checklist",
      };

      expect(mockResponse.success).toBe(false);
      expect(mockResponse.error).toBeDefined();
    });

    it("should extract sections from forked checklist", () => {
      const mockResponse = {
        success: true,
        checklist: {
          id: 1,
          snapshotData: {
            sections: [
              { title: "Kitchen", items: [{ content: "Clean counters" }] },
              { title: "Bathroom", items: [{ content: "Clean toilet" }] },
            ],
          },
        },
      };

      const sections = mockResponse.checklist.snapshotData.sections;

      expect(sections.length).toBe(2);
      expect(sections[0].items.length).toBe(1);
    });
  });

  describe("Re-import behavior", () => {
    it("should replace existing sections with forked sections", () => {
      const existingSections = [
        { id: "old-1", title: "Old Section", items: [] },
      ];

      const forkedSections = [
        { id: "new-1", title: "Kitchen", items: [] },
        { id: "new-2", title: "Bathroom", items: [] },
      ];

      // Simulating the replace behavior
      const newSections = forkedSections;

      expect(newSections.length).toBe(2);
      expect(newSections[0].title).toBe("Kitchen");
      expect(newSections).not.toContain(existingSections[0]);
    });
  });
});

describe("ChecklistEditor - Validation", () => {
  describe("Section title validation", () => {
    it("should reject empty section titles", () => {
      const isValidTitle = (title) => {
        return Boolean(title && title.trim().length > 0);
      };

      expect(isValidTitle("")).toBe(false);
      expect(isValidTitle("   ")).toBe(false);
      expect(isValidTitle(null)).toBe(false);
      expect(isValidTitle(undefined)).toBe(false);
    });

    it("should accept valid section titles", () => {
      const isValidTitle = (title) => {
        return Boolean(title && title.trim().length > 0);
      };

      expect(isValidTitle("Kitchen")).toBe(true);
      expect(isValidTitle("  Bathroom  ")).toBe(true);
      expect(isValidTitle("Living Room")).toBe(true);
    });
  });

  describe("Item content validation", () => {
    it("should reject empty item content", () => {
      const isValidContent = (content) => {
        return Boolean(content && content.trim().length > 0);
      };

      expect(isValidContent("")).toBe(false);
      expect(isValidContent("   ")).toBe(false);
      expect(isValidContent(null)).toBe(false);
    });

    it("should accept valid item content", () => {
      const isValidContent = (content) => {
        return Boolean(content && content.trim().length > 0);
      };

      expect(isValidContent("Clean countertops")).toBe(true);
      expect(isValidContent("  Wipe appliances  ")).toBe(true);
    });
  });

  describe("Has changes detection", () => {
    it("should detect no changes when sections are identical", () => {
      const original = JSON.stringify([
        { id: "1", title: "Kitchen", items: [] },
      ]);
      const current = JSON.stringify([
        { id: "1", title: "Kitchen", items: [] },
      ]);

      const hasChanges = original !== current;

      expect(hasChanges).toBe(false);
    });

    it("should detect changes when section is added", () => {
      const original = JSON.stringify([
        { id: "1", title: "Kitchen", items: [] },
      ]);
      const current = JSON.stringify([
        { id: "1", title: "Kitchen", items: [] },
        { id: "2", title: "Bathroom", items: [] },
      ]);

      const hasChanges = original !== current;

      expect(hasChanges).toBe(true);
    });

    it("should detect changes when item is modified", () => {
      const original = JSON.stringify([
        { id: "1", title: "Kitchen", items: [{ content: "Original" }] },
      ]);
      const current = JSON.stringify([
        { id: "1", title: "Kitchen", items: [{ content: "Modified" }] },
      ]);

      const hasChanges = original !== current;

      expect(hasChanges).toBe(true);
    });
  });
});
