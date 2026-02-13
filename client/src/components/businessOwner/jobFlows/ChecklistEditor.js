import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { colors, spacing, radius, typography, shadows } from "../../../services/styles/theme";
import JobFlowService from "../../../services/fetchRequests/JobFlowService";

// Generate a unique ID for new items
const generateId = () => `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const ChecklistItem = ({ item, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(item.content);
  const [notes, setNotes] = useState(item.notes || "");

  const handleSave = () => {
    if (!content.trim()) {
      Alert.alert("Error", "Item content is required");
      return;
    }
    onUpdate({ ...item, content: content.trim(), notes: notes.trim() || null });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setContent(item.content);
    setNotes(item.notes || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <View style={styles.itemEditing}>
        <TextInput
          style={styles.itemInput}
          value={content}
          onChangeText={setContent}
          placeholder="Checklist item..."
          placeholderTextColor={colors.text.tertiary}
          autoFocus
        />
        <TextInput
          style={[styles.itemInput, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes for employees (optional)"
          placeholderTextColor={colors.text.tertiary}
          multiline
        />
        <View style={styles.itemEditActions}>
          <Pressable style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.saveItemButton} onPress={handleSave}>
            <Text style={styles.saveItemButtonText}>Save</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable style={styles.itemRow} onPress={() => setIsEditing(true)}>
      <View style={styles.itemContent}>
        <Icon name="check-square-o" size={14} color={colors.neutral[400]} />
        <View style={styles.itemTextContainer}>
          <Text style={styles.itemText}>{item.content}</Text>
          {item.notes && (
            <Text style={styles.itemNotes} numberOfLines={1}>
              {item.notes}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.itemActions}>
        <Pressable
          style={[styles.moveButton, isFirst && styles.moveButtonDisabled]}
          onPress={onMoveUp}
          disabled={isFirst}
        >
          <Icon name="chevron-up" size={12} color={isFirst ? colors.neutral[300] : colors.neutral[500]} />
        </Pressable>
        <Pressable
          style={[styles.moveButton, isLast && styles.moveButtonDisabled]}
          onPress={onMoveDown}
          disabled={isLast}
        >
          <Icon name="chevron-down" size={12} color={isLast ? colors.neutral[300] : colors.neutral[500]} />
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={onDelete}>
          <Icon name="trash-o" size={14} color={colors.error[500]} />
        </Pressable>
      </View>
    </Pressable>
  );
};

const ChecklistSection = ({
  section,
  onUpdateSection,
  onDeleteSection,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onMoveItem,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(section.title);

  const handleSaveTitle = () => {
    if (!title.trim()) {
      Alert.alert("Error", "Section title is required");
      return;
    }
    onUpdateSection({ ...section, title: title.trim() });
    setIsEditingTitle(false);
  };

  return (
    <View style={styles.sectionContainer}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        {isEditingTitle ? (
          <View style={styles.sectionTitleEdit}>
            <TextInput
              style={styles.sectionTitleInput}
              value={title}
              onChangeText={setTitle}
              autoFocus
              onBlur={handleSaveTitle}
              onSubmitEditing={handleSaveTitle}
            />
          </View>
        ) : (
          <Pressable style={styles.sectionTitleRow} onPress={() => setIsEditingTitle(true)}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Icon name="pencil" size={12} color={colors.neutral[400]} />
          </Pressable>
        )}
        <View style={styles.sectionActions}>
          <Pressable
            style={[styles.sectionMoveButton, isFirst && styles.moveButtonDisabled]}
            onPress={onMoveUp}
            disabled={isFirst}
          >
            <Icon name="chevron-up" size={12} color={isFirst ? colors.neutral[300] : colors.neutral[500]} />
          </Pressable>
          <Pressable
            style={[styles.sectionMoveButton, isLast && styles.moveButtonDisabled]}
            onPress={onMoveDown}
            disabled={isLast}
          >
            <Icon name="chevron-down" size={12} color={isLast ? colors.neutral[300] : colors.neutral[500]} />
          </Pressable>
          <Pressable style={styles.deleteSectionButton} onPress={onDeleteSection}>
            <Icon name="trash-o" size={14} color={colors.error[500]} />
          </Pressable>
        </View>
      </View>

      {/* Items */}
      <View style={styles.itemsContainer}>
        {(section.items || []).map((item, index) => (
          <ChecklistItem
            key={item.id}
            item={item}
            onUpdate={(updated) => onUpdateItem(section.id, updated)}
            onDelete={() => onDeleteItem(section.id, item.id)}
            onMoveUp={() => onMoveItem(section.id, index, index - 1)}
            onMoveDown={() => onMoveItem(section.id, index, index + 1)}
            isFirst={index === 0}
            isLast={index === section.items.length - 1}
          />
        ))}

        {/* Add Item Button */}
        <Pressable style={styles.addItemButton} onPress={() => onAddItem(section.id)}>
          <Icon name="plus" size={12} color={colors.primary[600]} />
          <Text style={styles.addItemText}>Add Item</Text>
        </Pressable>
      </View>
    </View>
  );
};

const ChecklistEditor = ({
  flowId,
  token,
  initialChecklist,
  onSave,
  onClose,
}) => {
  // Ensure all sections and items have IDs (platform checklist may not have them)
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

  // Handle both snapshotData.sections (from API) and sections (legacy)
  const getInitialSections = () => {
    if (!initialChecklist) return [];
    const rawSections = initialChecklist.snapshotData?.sections || initialChecklist.sections || [];
    return ensureIds(rawSections);
  };
  const [sections, setSections] = useState(getInitialSections());
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const markChanged = useCallback(() => {
    setHasChanges(true);
  }, []);

  // Section operations
  const handleAddSection = () => {
    const newSection = {
      id: generateId(),
      title: "New Section",
      displayOrder: sections.length,
      items: [],
    };
    setSections([...sections, newSection]);
    markChanged();
  };

  const handleUpdateSection = (updatedSection) => {
    setSections(sections.map((s) => (s.id === updatedSection.id ? updatedSection : s)));
    markChanged();
  };

  const handleDeleteSection = (sectionId) => {
    Alert.alert(
      "Delete Section",
      "Are you sure you want to delete this section and all its items?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setSections(sections.filter((s) => s.id !== sectionId));
            markChanged();
          },
        },
      ]
    );
  };

  const handleMoveSection = (index, newIndex) => {
    if (newIndex < 0 || newIndex >= sections.length) return;
    const newSections = [...sections];
    const [moved] = newSections.splice(index, 1);
    newSections.splice(newIndex, 0, moved);
    // Update display orders
    newSections.forEach((s, i) => (s.displayOrder = i));
    setSections(newSections);
    markChanged();
  };

  // Item operations
  const handleAddItem = (sectionId) => {
    const newItem = {
      id: generateId(),
      content: "New item",
      displayOrder: 0,
      indentLevel: 0,
      children: [],
    };
    setSections(
      sections.map((s) => {
        if (s.id === sectionId) {
          const items = [...(s.items || [])];
          newItem.displayOrder = items.length;
          return { ...s, items: [...items, newItem] };
        }
        return s;
      })
    );
    markChanged();
  };

  const handleUpdateItem = (sectionId, updatedItem) => {
    setSections(
      sections.map((s) => {
        if (s.id === sectionId) {
          return {
            ...s,
            items: s.items.map((item) =>
              item.id === updatedItem.id ? updatedItem : item
            ),
          };
        }
        return s;
      })
    );
    markChanged();
  };

  const handleDeleteItem = (sectionId, itemId) => {
    setSections(
      sections.map((s) => {
        if (s.id === sectionId) {
          return {
            ...s,
            items: s.items.filter((item) => item.id !== itemId),
          };
        }
        return s;
      })
    );
    markChanged();
  };

  const handleMoveItem = (sectionId, fromIndex, toIndex) => {
    if (toIndex < 0) return;
    setSections(
      sections.map((s) => {
        if (s.id === sectionId) {
          if (toIndex >= s.items.length) return s;
          const items = [...s.items];
          const [moved] = items.splice(fromIndex, 1);
          items.splice(toIndex, 0, moved);
          items.forEach((item, i) => (item.displayOrder = i));
          return { ...s, items };
        }
        return s;
      })
    );
    markChanged();
  };

  // Fork platform checklist
  const handleForkPlatform = async () => {
    if (sections.length > 0) {
      Alert.alert(
        "Replace Checklist?",
        "This will replace your current checklist with the platform default. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace",
            style: "destructive",
            onPress: async () => {
              await doForkPlatform();
            },
          },
        ]
      );
    } else {
      await doForkPlatform();
    }
  };

  const doForkPlatform = async () => {
    setSaving(true);
    try {
      // Fork platform checklist (backend automatically replaces existing)
      const result = await JobFlowService.forkPlatformChecklist(token, flowId);
      if (result.success && result.checklist) {
        // Sections are available directly or inside snapshotData
        const rawSections = result.checklist.sections || result.checklist.snapshotData?.sections || [];
        setSections(ensureIds(rawSections));
        setHasChanges(false);
        Alert.alert("Success", "Platform checklist imported successfully");
      } else {
        Alert.alert("Error", result.error || "Failed to import platform checklist");
      }
    } catch (error) {
      console.error("Error forking platform checklist:", error);
      Alert.alert("Error", "Failed to import platform checklist");
    } finally {
      setSaving(false);
    }
  };

  // Save checklist
  const handleSave = async () => {
    if (sections.length === 0) {
      Alert.alert("Error", "Add at least one section with items");
      return;
    }

    // Validate all sections have items
    const emptySections = sections.filter((s) => !s.items || s.items.length === 0);
    if (emptySections.length > 0) {
      Alert.alert("Error", `Section "${emptySections[0].title}" has no items`);
      return;
    }

    setSaving(true);
    try {
      let result;
      if (initialChecklist) {
        result = await JobFlowService.updateChecklist(token, flowId, sections);
      } else {
        result = await JobFlowService.createChecklist(token, flowId, sections);
      }

      if (result.success) {
        setHasChanges(false);
        onSave?.(result.checklist);
        Alert.alert("Success", "Checklist saved successfully");
      } else {
        Alert.alert("Error", result.error || "Failed to save checklist");
      }
    } catch (error) {
      console.error("Error saving checklist:", error);
      Alert.alert("Error", "Failed to save checklist");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Are you sure you want to close?",
        [
          { text: "Stay", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: onClose },
        ]
      );
    } else {
      onClose?.();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <Icon name="times" size={18} color={colors.text.secondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Checklist</Text>
        <Pressable
          style={[styles.saveButton, (!hasChanges || saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.neutral[0]} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </Pressable>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Pressable style={styles.quickActionButton} onPress={handleForkPlatform}>
          <Icon name="clone" size={14} color={colors.primary[600]} />
          <Text style={styles.quickActionText}>Import Platform Checklist</Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="list-alt" size={40} color={colors.neutral[300]} />
            <Text style={styles.emptyTitle}>No Checklist Items</Text>
            <Text style={styles.emptySubtitle}>
              Add sections and items, or import the platform checklist
            </Text>
          </View>
        ) : (
          sections.map((section, index) => (
            <ChecklistSection
              key={section.id}
              section={section}
              onUpdateSection={handleUpdateSection}
              onDeleteSection={() => handleDeleteSection(section.id)}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onMoveItem={handleMoveItem}
              onMoveUp={() => handleMoveSection(index, index - 1)}
              onMoveDown={() => handleMoveSection(index, index + 1)}
              isFirst={index === 0}
              isLast={index === sections.length - 1}
            />
          ))
        )}

        {/* Add Section Button */}
        <Pressable style={styles.addSectionButton} onPress={handleAddSection}>
          <Icon name="plus-circle" size={16} color={colors.primary[600]} />
          <Text style={styles.addSectionText}>Add Section</Text>
        </Pressable>

        <View style={styles.bottomPadding} />
      </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background.primary,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  saveButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minWidth: 70,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  quickActions: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing["3xl"],
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: "center",
  },
  sectionContainer: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.neutral[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sectionTitleEdit: {
    flex: 1,
  },
  sectionTitleInput: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    backgroundColor: colors.background.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary[400],
  },
  sectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  sectionMoveButton: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteSectionButton: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  itemsContainer: {
    padding: spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: spacing.sm,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  itemNotes: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
    marginTop: 2,
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  moveButton: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  moveButtonDisabled: {
    opacity: 0.3,
  },
  deleteButton: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  itemEditing: {
    padding: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  itemInput: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  itemEditActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  saveItemButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  saveItemButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral[0],
  },
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  addItemText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  addSectionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  addSectionText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  bottomPadding: {
    height: 100,
  },
});

export default ChecklistEditor;
