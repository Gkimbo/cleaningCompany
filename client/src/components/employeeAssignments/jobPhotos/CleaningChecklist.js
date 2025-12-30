import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, spacing, radius, shadows, typography } from "../../../services/styles/theme";
import { StyleSheet } from "react-native";
import ChecklistService from "../../../services/fetchRequests/ChecklistService";

// Fallback hardcoded checklist in case API fails
const FALLBACK_CHECKLIST = {
  kitchen: {
    title: "Kitchen",
    icon: "K",
    tasks: [
      { id: "k1", task: "Clean all countertops and backsplash" },
      { id: "k2", task: "Clean inside and outside of microwave" },
      { id: "k3", task: "Clean inside and outside of oven" },
      { id: "k4", task: "Clean stovetop and burners" },
      { id: "k5", task: "Wipe down all cabinet fronts" },
      { id: "k6", task: "Clean refrigerator exterior" },
      { id: "k7", task: "Clean and sanitize sink" },
      { id: "k8", task: "Clean faucet and handles (remove water spots)" },
      { id: "k9", task: "Restock coffee supplies (coffee, creamer, filters)" },
      { id: "k10", task: "Restock paper towels" },
      { id: "k11", task: "Empty trash can and insert new trash bag" },
      { id: "k12", task: "Clean dishwasher exterior" },
      { id: "k13", task: "Dust light fixtures and ceiling fans" },
      { id: "k14", task: "Vacuum floor including corners and crevices" },
      { id: "k15", task: "Mop entire floor" },
    ],
  },
  bathrooms: {
    title: "Bathrooms",
    icon: "B",
    tasks: [
      { id: "b1", task: "Clean and sanitize toilet (inside bowl, seat, base)" },
      { id: "b2", task: "Remove ALL hair from toilet area" },
      { id: "b3", task: "Clean shower/tub thoroughly (walls, floor, door)" },
      { id: "b4", task: "Remove soap scum and mildew from shower" },
      { id: "b5", task: "Clean shower drain - remove hair buildup" },
      { id: "b6", task: "Clean and polish sink" },
      { id: "b7", task: "Clean sink drain - remove hair" },
      { id: "b8", task: "Clean faucet and handles (remove water spots)" },
      { id: "b9", task: "Clean and polish mirrors" },
      { id: "b10", task: "Wipe down all countertops" },
      { id: "b11", task: "Clean cabinet fronts" },
      { id: "b12", task: "Restock toilet paper (at least 2 rolls visible)" },
      { id: "b13", task: "Empty trash can and insert new trash bag" },
      { id: "b14", task: "Replace/arrange towels neatly" },
      { id: "b15", task: "Dust light fixtures and exhaust fan" },
      { id: "b16", task: "Vacuum floor including corners and behind toilet" },
      { id: "b17", task: "Mop entire floor" },
      { id: "b18", task: "Check for and remove hair from ALL surfaces" },
    ],
  },
  bedrooms: {
    title: "Bedrooms",
    icon: "BR",
    tasks: [
      { id: "br1", task: "Strip all bedding (sheets, pillowcases)" },
      { id: "br2", task: "Make bed with fresh sheets" },
      { id: "br3", task: "Fluff and arrange pillows" },
      { id: "br4", task: "Arrange decorative pillows/throws" },
      { id: "br5", task: "Dust all surfaces (nightstands, dressers)" },
      { id: "br6", task: "Dust headboard and bed frame" },
      { id: "br7", task: "Dust lamps and light fixtures" },
      { id: "br8", task: "Dust ceiling fan blades" },
      { id: "br9", task: "Clean mirrors" },
      { id: "br10", task: "Wipe down door handles" },
      { id: "br11", task: "Dust window sills and blinds" },
      { id: "br12", task: "Empty trash cans and insert new trash bags" },
      { id: "br13", task: "Vacuum entire floor" },
      { id: "br14", task: "Vacuum corners, edges, and under furniture" },
      { id: "br15", task: "Vacuum closet floor" },
    ],
  },
  livingAreas: {
    title: "Living Areas",
    icon: "L",
    tasks: [
      { id: "l1", task: "Dust all surfaces (tables, shelves, entertainment center)" },
      { id: "l2", task: "Dust TV screen (dry microfiber only)" },
      { id: "l3", task: "Dust electronics and remotes" },
      { id: "l4", task: "Dust decorative items and picture frames" },
      { id: "l5", task: "Dust ceiling fan blades" },
      { id: "l6", task: "Dust light fixtures and lamps" },
      { id: "l7", task: "Dust window sills and blinds" },
      { id: "l8", task: "Fluff and arrange couch cushions" },
      { id: "l9", task: "Wipe down door handles" },
      { id: "l10", task: "Clean mirrors and glass surfaces" },
      { id: "l11", task: "Empty trash cans and insert new trash bags" },
      { id: "l12", task: "Vacuum entire floor" },
      { id: "l13", task: "Vacuum corners, edges, and crevices" },
      { id: "l14", task: "Vacuum under furniture (where accessible)" },
      { id: "l15", task: "Mop hard floors" },
    ],
  },
  general: {
    title: "General/Final Walkthrough",
    icon: "G",
    tasks: [
      { id: "g1", task: "Dust all baseboards throughout home" },
      { id: "g2", task: "Dust stair railings (if applicable)" },
      { id: "g3", task: "Clean all door handles throughout home" },
      { id: "g4", task: "Clean light switches and outlets" },
      { id: "g5", task: "Remove cobwebs from corners and ceilings" },
      { id: "g6", task: "Verify all trash cans have new bags inserted" },
      { id: "g7", task: "Take all trash/recycling/compost to designated locations" },
      { id: "g8", task: "Check all lights are off (except entry)" },
      { id: "g9", task: "Lock all doors and windows" },
      { id: "g10", task: "Final walkthrough - no items left behind" },
    ],
  },
};

// Convert API sections format to local format
const convertApiToLocal = (apiData) => {
  if (!apiData || !apiData.sections) return null;

  const result = {};
  apiData.sections.forEach((section) => {
    // Create a key from the title (lowercase, no spaces)
    const key = section.title.toLowerCase().replace(/[^a-z]/g, "");
    result[key] = {
      title: section.title,
      icon: section.icon || section.title.charAt(0).toUpperCase(),
      tasks: (section.items || []).map((item, index) => ({
        id: item.id || `${key}${index + 1}`,
        task: item.content,
        formatting: item.formatting,
        indentLevel: item.indentLevel,
      })),
    };
  });
  return result;
};

const CACHE_KEY = "cleaning_checklist_cache";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

const CleaningChecklist = ({ home, token, onChecklistComplete, onProgressUpdate }) => {
  const [checkedItems, setCheckedItems] = useState({});
  const [checklistData, setChecklistData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({});

  // Load checklist from API or cache
  useEffect(() => {
    loadChecklist();
  }, []);

  const loadChecklist = async () => {
    setLoading(true);
    try {
      // Try to get cached data first
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          setChecklistData(data);
          initializeExpandedSections(data);
          setLoading(false);
          // Still try to refresh in background
          refreshFromApi();
          return;
        }
      }

      // No valid cache, fetch from API
      await refreshFromApi();
    } catch (error) {
      console.warn("Error loading checklist:", error);
      // Fallback to hardcoded data
      setChecklistData(FALLBACK_CHECKLIST);
      initializeExpandedSections(FALLBACK_CHECKLIST);
    } finally {
      setLoading(false);
    }
  };

  const refreshFromApi = async () => {
    try {
      const result = await ChecklistService.getPublishedChecklist(token);
      if (result && result.sections && result.sections.length > 0) {
        const converted = convertApiToLocal(result);
        if (converted && Object.keys(converted).length > 0) {
          setChecklistData(converted);
          initializeExpandedSections(converted);
          // Cache the result
          await AsyncStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ data: converted, timestamp: Date.now() })
          );
        }
      } else if (!checklistData) {
        // No API data and no existing data, use fallback
        setChecklistData(FALLBACK_CHECKLIST);
        initializeExpandedSections(FALLBACK_CHECKLIST);
      }
    } catch (error) {
      console.warn("Error fetching checklist from API:", error);
      if (!checklistData) {
        setChecklistData(FALLBACK_CHECKLIST);
        initializeExpandedSections(FALLBACK_CHECKLIST);
      }
    }
  };

  const initializeExpandedSections = (data) => {
    if (!data) return;
    const sections = {};
    const keys = Object.keys(data);
    keys.forEach((key, index) => {
      sections[key] = index === 0; // First section expanded by default
    });
    setExpandedSections(sections);
  };

  // Use checklistData or fallback
  const CLEANING_CHECKLIST = checklistData || FALLBACK_CHECKLIST;

  // Calculate total tasks and completed tasks
  const totalTasks = Object.values(CLEANING_CHECKLIST).reduce(
    (sum, section) => sum + section.tasks.length,
    0
  );
  const completedTasks = Object.keys(checkedItems).filter(
    (key) => checkedItems[key]
  ).length;
  const progressPercent = Math.round((completedTasks / totalTasks) * 100);

  useEffect(() => {
    if (onProgressUpdate) {
      onProgressUpdate(progressPercent, completedTasks, totalTasks);
    }
  }, [completedTasks, totalTasks]);

  const toggleItem = (itemId) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const toggleSection = (sectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const getSectionProgress = (sectionKey) => {
    const section = CLEANING_CHECKLIST[sectionKey];
    const completed = section.tasks.filter((t) => checkedItems[t.id]).length;
    return { completed, total: section.tasks.length };
  };

  const isSectionComplete = (sectionKey) => {
    const { completed, total } = getSectionProgress(sectionKey);
    return completed === total;
  };

  const isAllComplete = completedTasks === totalTasks;

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>Cleaning Progress</Text>
        <Text style={styles.progressPercent}>{progressPercent}%</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>
      <Text style={styles.progressSubtext}>
        {completedTasks} of {totalTasks} tasks completed
      </Text>
    </View>
  );

  const renderChecklistItem = (item) => {
    const isChecked = checkedItems[item.id];
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.checklistItem, isChecked && styles.checklistItemChecked]}
        onPress={() => toggleItem(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
          {isChecked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.taskText, isChecked && styles.taskTextChecked]}>
          {item.task}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSection = (sectionKey) => {
    const section = CLEANING_CHECKLIST[sectionKey];
    const isExpanded = expandedSections[sectionKey];
    const { completed, total } = getSectionProgress(sectionKey);
    const sectionComplete = completed === total;

    return (
      <View key={sectionKey} style={styles.section}>
        <TouchableOpacity
          style={[
            styles.sectionHeader,
            sectionComplete && styles.sectionHeaderComplete,
          ]}
          onPress={() => toggleSection(sectionKey)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderLeft}>
            <View
              style={[
                styles.sectionIcon,
                sectionComplete && styles.sectionIconComplete,
              ]}
            >
              <Text
                style={[
                  styles.sectionIconText,
                  sectionComplete && styles.sectionIconTextComplete,
                ]}
              >
                {sectionComplete ? "✓" : section.icon}
              </Text>
            </View>
            <View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionProgress}>
                {completed}/{total} tasks
              </Text>
            </View>
          </View>
          <Text style={styles.expandIcon}>{isExpanded ? "▼" : "▶"}</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.sectionContent}>
            {section.tasks.map((item) => renderChecklistItem(item))}
          </View>
        )}
      </View>
    );
  };

  // Show loading state
  if (loading && !checklistData) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={{ marginTop: spacing.md, color: colors.text.secondary }}>
          Loading checklist...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderProgressBar()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tip about non-applicable tasks */}
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>
            If a task doesn't apply to this home, mark it complete anyway.
          </Text>
        </View>

        {/* Home-specific reminders */}
        {(home?.specialNotes || home?.keyPadCode || home?.keyLocation) && (
          <View style={styles.remindersCard}>
            <Text style={styles.remindersTitle}>Important Reminders</Text>
            {home?.specialNotes && (
              <View style={styles.reminderItem}>
                <Text style={styles.reminderLabel}>Special Notes:</Text>
                <Text style={styles.reminderText}>{home.specialNotes}</Text>
              </View>
            )}
            {home?.trashLocation && (
              <View style={styles.reminderItem}>
                <Text style={styles.reminderLabel}>Trash Location:</Text>
                <Text style={styles.reminderText}>{home.trashLocation}</Text>
              </View>
            )}
            {home?.recyclingLocation && (
              <View style={styles.reminderItem}>
                <Text style={styles.reminderLabel}>Recycling:</Text>
                <Text style={styles.reminderText}>{home.recyclingLocation}</Text>
              </View>
            )}
            {home?.compostLocation && (
              <View style={styles.reminderItem}>
                <Text style={styles.reminderLabel}>Compost:</Text>
                <Text style={styles.reminderText}>{home.compostLocation}</Text>
              </View>
            )}
          </View>
        )}

        {/* Checklist sections */}
        {Object.keys(CLEANING_CHECKLIST).map((sectionKey) =>
          renderSection(sectionKey)
        )}

        {/* Complete button */}
        <TouchableOpacity
          style={[
            styles.completeChecklistButton,
            !isAllComplete && styles.completeChecklistButtonDisabled,
          ]}
          onPress={() => isAllComplete && onChecklistComplete && onChecklistComplete()}
          disabled={!isAllComplete}
        >
          <Text style={styles.completeChecklistButtonText}>
            {isAllComplete
              ? "Checklist Complete - Take After Photos"
              : `Complete All Tasks (${totalTasks - completedTasks} remaining)`}
          </Text>
        </TouchableOpacity>

        {/* Skip option for edge cases */}
        {!isAllComplete && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              if (progressPercent >= 90) {
                onChecklistComplete && onChecklistComplete();
              } else {
                alert(
                  "Please complete at least 90% of the checklist before proceeding. If a task doesn't apply, mark it complete anyway."
                );
              }
            }}
          >
            <Text style={styles.skipButtonText}>
              {progressPercent >= 90
                ? "Proceed Anyway"
                : "Some tasks may not apply?"}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  progressContainer: {
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  progressTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  progressPercent: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  progressBarBg: {
    height: 12,
    backgroundColor: colors.neutral[200],
    borderRadius: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.success[500],
    borderRadius: 6,
  },
  progressSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing["4xl"],
  },
  tipCard: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  tipText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    textAlign: "center",
    fontStyle: "italic",
  },
  remindersCard: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  remindersTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
    marginBottom: spacing.md,
  },
  reminderItem: {
    marginBottom: spacing.sm,
  },
  reminderLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginBottom: 2,
  },
  reminderText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[900],
  },
  section: {
    marginBottom: spacing.md,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    backgroundColor: colors.neutral[0],
  },
  sectionHeaderComplete: {
    backgroundColor: colors.success[50],
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  sectionIconComplete: {
    backgroundColor: colors.success[500],
  },
  sectionIconText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  sectionIconTextComplete: {
    color: colors.neutral[0],
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sectionProgress: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  expandIcon: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  sectionContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  checklistItemChecked: {
    backgroundColor: colors.success[50],
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: colors.success[500],
    borderColor: colors.success[500],
  },
  checkmark: {
    color: colors.neutral[0],
    fontSize: 14,
    fontWeight: "bold",
  },
  taskText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  taskTextChecked: {
    color: colors.text.secondary,
    textDecorationLine: "line-through",
  },
  completeChecklistButton: {
    backgroundColor: colors.success[600],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.lg,
    ...shadows.md,
  },
  completeChecklistButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  completeChecklistButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  skipButton: {
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  skipButtonText: {
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
  },
});

export default CleaningChecklist;
