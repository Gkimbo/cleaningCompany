import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useNavigate } from "react-router-native";
import DraggableFlatList from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ChecklistService from "../../../services/fetchRequests/ChecklistService";
import ChecklistToolbar from "./ChecklistToolbar";
import SectionCard from "./SectionCard";
import VersionHistoryModal from "./VersionHistoryModal";
import PublishConfirmModal from "./PublishConfirmModal";
import styles from "./ChecklistEditorStyles";
import { colors } from "../../../services/styles/theme";

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const ChecklistEditor = ({ state }) => {
  const navigate = useNavigate();
  const token = state?.currentUser?.token;

  // State
  const [mode, setMode] = useState("edit"); // 'edit' | 'preview'
  const [draft, setDraft] = useState({ sections: [], metadata: {} });
  const [publishedVersion, setPublishedVersion] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("saved"); // 'saved' | 'saving' | 'unsaved'

  // Modals
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Auto-save timer
  const autoSaveTimer = useRef(null);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Auto-save when draft changes
  useEffect(() => {
    if (isDirty) {
      setAutoSaveStatus("unsaved");
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
      autoSaveTimer.current = setTimeout(() => {
        handleAutoSave();
      }, 2000);
    }
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [draft, isDirty]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load draft and published version in parallel
      const [draftResult, publishedResult] = await Promise.all([
        ChecklistService.getDraft(token),
        ChecklistService.getPublishedChecklist(token),
      ]);

      // API returns { draft: draftData, lastModified, draftId }
      if (draftResult && draftResult.draft) {
        setDraft(draftResult.draft);
      } else if (publishedResult && publishedResult.checklist) {
        // No draft, use published version as starting point
        // API returns { checklist: snapshotData, version, publishedAt }
        setDraft(publishedResult.checklist);
      }

      // Set published version from API response
      if (publishedResult && publishedResult.version) {
        setPublishedVersion(publishedResult.version);
      }
    } catch (error) {
      console.error("Error loading checklist:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSave = async () => {
    if (!isDirty) return;
    setAutoSaveStatus("saving");
    setSaving(true);
    try {
      const result = await ChecklistService.saveDraft(token, draft);
      if (result.success) {
        setAutoSaveStatus("saved");
        setIsDirty(false);
      } else {
        setAutoSaveStatus("unsaved");
      }
    } catch (error) {
      setAutoSaveStatus("unsaved");
      console.error("Auto-save failed:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleManualSave = async () => {
    setSaving(true);
    setAutoSaveStatus("saving");
    try {
      const result = await ChecklistService.saveDraft(token, draft);
      if (result.success) {
        setAutoSaveStatus("saved");
        setIsDirty(false);
        showAlert("Saved", "Draft saved successfully");
      } else {
        showAlert("Error", result.error || "Failed to save draft");
      }
    } catch (error) {
      showAlert("Error", "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      // First save the current draft
      await ChecklistService.saveDraft(token, draft);

      // Then publish
      const result = await ChecklistService.publishDraft(token);
      if (result.success) {
        // API returns { success, version: number, publishedAt }
        setPublishedVersion(result.version);
        setIsDirty(false);
        setShowPublishConfirm(false);
        showAlert("Published", `Version ${result.version} is now live!`);
      } else {
        showAlert("Error", result.error || "Failed to publish");
      }
    } catch (error) {
      showAlert("Error", "Failed to publish checklist");
    } finally {
      setPublishing(false);
    }
  };

  const loadVersionHistory = async () => {
    setVersionsLoading(true);
    try {
      const result = await ChecklistService.getVersionHistory(token);
      if (result.versions) {
        setVersions(result.versions);
      }
    } catch (error) {
      console.error("Error loading versions:", error);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRevertToVersion = async (versionId) => {
    try {
      const result = await ChecklistService.revertToVersion(token, versionId);
      if (result.success) {
        // API updates the draft in DB, we need to reload
        setShowVersionHistory(false);
        await loadData();
        setIsDirty(true);
        showAlert("Reverted", `Reverted to version ${result.revertedToVersion}. Remember to publish!`);
      } else {
        showAlert("Error", result.error || "Failed to revert");
      }
    } catch (error) {
      showAlert("Error", "Failed to revert to version");
    }
  };

  const handleSeedFromHardcoded = async () => {
    const confirmSeed = () => {
      return new Promise((resolve) => {
        if (Platform.OS === "web") {
          resolve(window.confirm("This will load the default checklist from the app. Continue?"));
        } else {
          Alert.alert(
            "Load Default Checklist",
            "This will load the default checklist from the app. Continue?",
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Load", onPress: () => resolve(true) },
            ]
          );
        }
      });
    };

    const confirmed = await confirmSeed();
    if (!confirmed) return;

    setLoading(true);
    try {
      const result = await ChecklistService.seedFromHardcoded(token);
      if (result.success) {
        await loadData();
        showAlert("Loaded", "Default checklist loaded successfully");
      } else {
        showAlert("Error", result.error || "Failed to load default checklist");
      }
    } catch (error) {
      showAlert("Error", "Failed to load default checklist");
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title, message) => {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Draft manipulation functions
  const updateDraft = (newDraft) => {
    setDraft(newDraft);
    setIsDirty(true);
  };

  const addSection = () => {
    const newSection = {
      id: generateId(),
      title: "New Section",
      icon: "S",
      displayOrder: draft.sections.length,
      items: [],
    };
    updateDraft({
      ...draft,
      sections: [...draft.sections, newSection],
    });
  };

  const deleteSection = (sectionId) => {
    const confirmDelete = () => {
      updateDraft({
        ...draft,
        sections: draft.sections.filter((s) => s.id !== sectionId),
      });
    };

    if (Platform.OS === "web") {
      if (window.confirm("Delete this section and all its tasks?")) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        "Delete Section",
        "Delete this section and all its tasks?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: confirmDelete },
        ]
      );
    }
  };

  const updateSectionTitle = (sectionId, title) => {
    updateDraft({
      ...draft,
      sections: draft.sections.map((s) =>
        s.id === sectionId ? { ...s, title } : s
      ),
    });
  };

  const reorderSections = (data) => {
    updateDraft({
      ...draft,
      sections: data.map((s, index) => ({ ...s, displayOrder: index })),
    });
  };

  const addItem = (sectionId) => {
    const newItem = {
      id: generateId(),
      content: "",
      displayOrder: 0,
      indentLevel: 0,
      formatting: { bold: false, italic: false, bulletStyle: "disc" },
    };

    updateDraft({
      ...draft,
      sections: draft.sections.map((s) => {
        if (s.id === sectionId) {
          const items = [...(s.items || []), newItem];
          return {
            ...s,
            items: items.map((item, index) => ({ ...item, displayOrder: index })),
          };
        }
        return s;
      }),
    });

    setSelectedItem(newItem);
    setSelectedSectionId(sectionId);
  };

  const deleteItem = (itemId) => {
    updateDraft({
      ...draft,
      sections: draft.sections.map((s) => ({
        ...s,
        items: (s.items || []).filter((i) => i.id !== itemId),
      })),
    });

    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
    }
  };

  const updateItemContent = (itemId, content) => {
    updateDraft({
      ...draft,
      sections: draft.sections.map((s) => ({
        ...s,
        items: (s.items || []).map((i) =>
          i.id === itemId ? { ...i, content } : i
        ),
      })),
    });
  };

  const reorderItems = (sectionId, newItems) => {
    updateDraft({
      ...draft,
      sections: draft.sections.map((s) =>
        s.id === sectionId
          ? { ...s, items: newItems.map((i, idx) => ({ ...i, displayOrder: idx })) }
          : s
      ),
    });
  };

  // Formatting functions
  const updateSelectedItemFormatting = (key, value) => {
    if (!selectedItem) return;

    updateDraft({
      ...draft,
      sections: draft.sections.map((s) => ({
        ...s,
        items: (s.items || []).map((i) => {
          if (i.id === selectedItem.id) {
            const updated = {
              ...i,
              formatting: { ...i.formatting, [key]: value },
            };
            setSelectedItem(updated);
            return updated;
          }
          return i;
        }),
      })),
    });
  };

  const updateSelectedItemIndent = (delta) => {
    if (!selectedItem) return;

    const newLevel = Math.max(0, Math.min(2, (selectedItem.indentLevel || 0) + delta));

    updateDraft({
      ...draft,
      sections: draft.sections.map((s) => ({
        ...s,
        items: (s.items || []).map((i) => {
          if (i.id === selectedItem.id) {
            const updated = { ...i, indentLevel: newLevel };
            setSelectedItem(updated);
            return updated;
          }
          return i;
        }),
      })),
    });
  };

  const countTotalItems = () => {
    return draft.sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
  };

  const renderSectionItem = ({ item, drag, isActive }) => (
    <SectionCard
      section={item}
      selectedItem={selectedItem}
      onSelectItem={(i) => {
        setSelectedItem(i);
        setSelectedSectionId(item.id);
      }}
      onTitleChange={updateSectionTitle}
      onItemContentChange={updateItemContent}
      onItemReorder={reorderItems}
      onAddItem={addItem}
      onDeleteItem={deleteItem}
      onDeleteSection={deleteSection}
      drag={drag}
      isActive={isActive}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading checklist...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => navigate(-1)} style={styles.backButton}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Checklist Editor</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerButton}
              onPress={() => {
                loadVersionHistory();
                setShowVersionHistory(true);
              }}
            >
              <Text style={styles.headerButtonText}>History</Text>
            </Pressable>
          </View>
        </View>

        {/* Status Banner */}
        {publishedVersion ? (
          <View style={[styles.statusBanner, isDirty && styles.statusBannerDraft]}>
            <View style={[styles.statusBadge, isDirty && styles.statusBadgeDraft]}>
              <Text style={styles.statusBadgeText}>
                {isDirty ? "DRAFT" : "PUBLISHED"}
              </Text>
            </View>
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, isDirty && styles.statusTitleDraft]}>
                {isDirty ? "Unsaved Changes" : `Version ${publishedVersion}`}
              </Text>
              <Text style={[styles.statusMeta, isDirty && styles.statusMetaDraft]}>
                {isDirty
                  ? "Save and publish to update the live checklist"
                  : "Currently live for all cleaners"}
              </Text>
            </View>
          </View>
        ) : (
          <Pressable style={styles.seedButton} onPress={handleSeedFromHardcoded}>
            <Text style={styles.seedButtonText}>
              Load Default Checklist
            </Text>
          </Pressable>
        )}

        {/* Auto-save indicator */}
        <View style={styles.autoSaveIndicator}>
          <Text
            style={[
              styles.autoSaveText,
              autoSaveStatus === "saving" && styles.autoSaveTextSaving,
              autoSaveStatus === "saved" && styles.autoSaveTextSaved,
            ]}
          >
            {autoSaveStatus === "saving" && "Saving..."}
            {autoSaveStatus === "saved" && "All changes saved"}
            {autoSaveStatus === "unsaved" && "Unsaved changes"}
          </Text>
        </View>

        {/* Mode Tabs */}
        <View style={styles.modeTabs}>
          <Pressable
            style={[styles.modeTab, mode === "edit" && styles.modeTabActive]}
            onPress={() => setMode("edit")}
          >
            <Text
              style={[styles.modeTabText, mode === "edit" && styles.modeTabTextActive]}
            >
              Edit
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeTab, mode === "preview" && styles.modeTabActive]}
            onPress={() => setMode("preview")}
          >
            <Text
              style={[styles.modeTabText, mode === "preview" && styles.modeTabTextActive]}
            >
              Preview
            </Text>
          </Pressable>
        </View>

        {mode === "edit" && (
          <>
            {/* Toolbar */}
            <ChecklistToolbar
              selectedItem={selectedItem}
              disabled={!selectedItem}
              onFormatBold={() =>
                updateSelectedItemFormatting("bold", !selectedItem?.formatting?.bold)
              }
              onFormatItalic={() =>
                updateSelectedItemFormatting("italic", !selectedItem?.formatting?.italic)
              }
              onBulletDisc={() => updateSelectedItemFormatting("bulletStyle", "disc")}
              onBulletCircle={() => updateSelectedItemFormatting("bulletStyle", "circle")}
              onBulletNumber={() => updateSelectedItemFormatting("bulletStyle", "number")}
              onIndent={() => updateSelectedItemIndent(1)}
              onOutdent={() => updateSelectedItemIndent(-1)}
              onAddItem={() => {
                if (selectedSectionId) {
                  addItem(selectedSectionId);
                } else if (draft.sections.length > 0) {
                  addItem(draft.sections[0].id);
                }
              }}
              onDeleteItem={() => {
                if (selectedItem) {
                  deleteItem(selectedItem.id);
                }
              }}
            />

            {/* Sections */}
            {draft.sections.length > 0 ? (
              <DraggableFlatList
                data={draft.sections}
                keyExtractor={(item) => item.id}
                renderItem={renderSectionItem}
                onDragEnd={({ data }) => reorderSections(data)}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No sections yet</Text>
                <Text style={styles.emptyStateHint}>
                  Add a section to get started, or load the default checklist
                </Text>
              </View>
            )}

            {/* Add Section Button */}
            <Pressable style={styles.addSectionButton} onPress={addSection}>
              <Text style={styles.addSectionButtonText}>+ Add Section</Text>
            </Pressable>
          </>
        )}

        {mode === "preview" && (
          <View>
            {draft.sections.map((section) => (
              <View key={section.id} style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}>
                    <Text style={styles.sectionIconText}>{section.icon}</Text>
                  </View>
                  <Text style={[styles.sectionTitleInput, { backgroundColor: "transparent", borderWidth: 0 }]}>
                    {section.title}
                  </Text>
                </View>
                <View style={styles.sectionContent}>
                  {(section.items || []).map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        styles.itemRow,
                        { marginLeft: (item.indentLevel || 0) * 24, borderWidth: 0 },
                      ]}
                    >
                      <View style={styles.itemBullet}>
                        <Text style={styles.itemBulletText}>
                          {item.formatting?.bulletStyle === "circle"
                            ? "\u25CB"
                            : item.formatting?.bulletStyle === "number"
                            ? `${index + 1}.`
                            : "\u2022"}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.itemContentInput,
                          item.formatting?.bold && { fontWeight: "bold" },
                          item.formatting?.italic && { fontStyle: "italic" },
                        ]}
                      >
                        {item.content}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleManualSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.neutral[0]} />
            ) : (
              <Text style={styles.saveButtonText}>Save Draft</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.publishButton}
            onPress={() => setShowPublishConfirm(true)}
          >
            <Text style={styles.publishButtonText}>Publish</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modals */}
      <VersionHistoryModal
        visible={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        versions={versions}
        loading={versionsLoading}
        onRevert={handleRevertToVersion}
        currentVersion={publishedVersion}
      />

      <PublishConfirmModal
        visible={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        onConfirm={handlePublish}
        loading={publishing}
        currentVersion={publishedVersion}
        sectionCount={draft.sections.length}
        itemCount={countTotalItems()}
      />
    </GestureHandlerRootView>
  );
};

export default ChecklistEditor;
