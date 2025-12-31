import React, { useState, useEffect, useContext } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/Feather";
import { useNavigate } from "react-router-native";
import { UserContext } from "../../context/UserContext";
import MessageService from "../../services/fetchRequests/MessageClass";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../services/styles/theme";

const NewConversationModal = ({ visible, onClose }) => {
  const { state } = useContext(UserContext);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const isOwner = state.account === "owner";
  const isHR = state.account === "humanResources";

  useEffect(() => {
    if (visible) {
      fetchStaff();
    } else {
      // Reset state when modal closes
      setSearch("");
      setSelectedMembers([]);
      setGroupName("");
    }
  }, [visible]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (visible) {
        fetchStaff(search);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchStaff = async (searchTerm = "") => {
    setLoading(true);
    const result = await MessageService.getStaffList(searchTerm, state.currentUser.token);
    if (!result.error) {
      setStaff(result.staff || []);
    }
    setLoading(false);
  };

  const toggleMember = (member) => {
    setSelectedMembers((prev) => {
      const exists = prev.find((m) => m.id === member.id);
      if (exists) {
        return prev.filter((m) => m.id !== member.id);
      }
      return [...prev, member];
    });
  };

  const handleQuickAction = async (action) => {
    setCreating(true);
    try {
      let result;
      if (action === "hr-group") {
        result = await MessageService.createHRGroupConversation(state.currentUser.token);
      } else if (action === "message-owner") {
        result = await MessageService.createDirectConversation(null, state.currentUser.token);
      }

      if (result && result.conversation) {
        onClose();
        navigate(`/messages/${result.conversation.id}`);
      }
    } catch (error) {
      console.error("Quick action error:", error);
    }
    setCreating(false);
  };

  const handleStartConversation = async () => {
    if (selectedMembers.length === 0) return;

    setCreating(true);
    try {
      let result;
      if (selectedMembers.length === 1) {
        // 1-on-1 conversation
        result = await MessageService.createDirectConversation(
          selectedMembers[0].id,
          state.currentUser.token
        );
      } else {
        // Group conversation
        result = await MessageService.createGroupConversation(
          selectedMembers.map((m) => m.id),
          groupName || null,
          state.currentUser.token
        );
      }

      if (result && result.conversation) {
        onClose();
        navigate(`/messages/${result.conversation.id}`);
      }
    } catch (error) {
      console.error("Create conversation error:", error);
    }
    setCreating(false);
  };

  const getDisplayName = (user) => {
    return user.username || "Unknown";
  };

  const getInitials = (user) => {
    const name = getDisplayName(user);
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (type) => {
    if (type === "owner") {
      return { label: "Owner", color: colors.primary[600], bg: colors.primary[50] };
    }
    if (type === "humanResources") {
      return { label: "HR", color: colors.secondary[600], bg: colors.secondary[50] };
    }
    return null;
  };

  const renderStaffItem = ({ item }) => {
    const isSelected = selectedMembers.some((m) => m.id === item.id);
    const roleBadge = getRoleBadge(item.type);

    return (
      <Pressable
        style={[styles.staffItem, isSelected && styles.staffItemSelected]}
        onPress={() => toggleMember(item)}
      >
        <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
          <Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
            {getInitials(item)}
          </Text>
        </View>
        <View style={styles.staffInfo}>
          <Text style={styles.staffName}>{getDisplayName(item)}</Text>
          {roleBadge && (
            <View style={[styles.roleBadge, { backgroundColor: roleBadge.bg }]}>
              <Text style={[styles.roleBadgeText, { color: roleBadge.color }]}>
                {roleBadge.label}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Icon name="check" size={14} color={colors.white} />}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          {/* Handle Bar */}
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Icon name="edit-3" size={20} color={colors.primary[500]} />
              </View>
              <Text style={styles.title}>New Message</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Icon name="x" size={22} color={colors.text.tertiary} />
            </Pressable>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Icon name="search" size={18} color={colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search staff..."
              placeholderTextColor={colors.text.tertiary}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")}>
                <Icon name="x" size={18} color={colors.text.tertiary} />
              </Pressable>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
            {isOwner && (
              <Pressable
                style={styles.quickAction}
                onPress={() => handleQuickAction("hr-group")}
                disabled={creating}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary[100] }]}>
                  <Icon name="users" size={18} color={colors.secondary[600]} />
                </View>
                <Text style={styles.quickActionText}>HR Team Chat</Text>
                <Icon name="chevron-right" size={18} color={colors.text.tertiary} />
              </Pressable>
            )}
            {isHR && (
              <Pressable
                style={styles.quickAction}
                onPress={() => handleQuickAction("message-owner")}
                disabled={creating}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.primary[100] }]}>
                  <Icon name="message-circle" size={18} color={colors.primary[600]} />
                </View>
                <Text style={styles.quickActionText}>Message Owner</Text>
                <Icon name="chevron-right" size={18} color={colors.text.tertiary} />
              </Pressable>
            )}
          </View>

          {/* Staff List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isOwner ? "HR STAFF" : "STAFF MEMBERS"}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary[500]} />
            </View>
          ) : staff.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="users" size={32} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>No staff members found</Text>
            </View>
          ) : (
            <FlatList
              data={staff}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderStaffItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Group Name Input (when multiple selected) */}
          {selectedMembers.length > 1 && (
            <View style={styles.groupNameContainer}>
              <TextInput
                style={styles.groupNameInput}
                placeholder="Group name (optional)"
                placeholderTextColor={colors.text.tertiary}
                value={groupName}
                onChangeText={setGroupName}
              />
            </View>
          )}

          {/* Start Conversation Button */}
          {selectedMembers.length > 0 && (
            <View style={styles.footer}>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedCount}>
                  {selectedMembers.length} selected
                </Text>
                <Text style={styles.selectedNames} numberOfLines={1}>
                  {selectedMembers.map((m) => getDisplayName(m)).join(", ")}
                </Text>
              </View>
              <Pressable
                style={[styles.startButton, creating && styles.startButtonDisabled]}
                onPress={handleStartConversation}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Icon name="send" size={18} color={colors.white} />
                    <Text style={styles.startButtonText}>Start</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: colors.neutral[100],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: spacing.xl,
  },
  handleBar: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: colors.neutral[300],
    borderRadius: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[200],
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  quickActionText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  loadingContainer: {
    padding: spacing["2xl"],
    alignItems: "center",
  },
  emptyContainer: {
    padding: spacing["2xl"],
    alignItems: "center",
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  staffItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.neutral[200],
  },
  staffItemSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.neutral[200],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarSelected: {
    backgroundColor: colors.primary[500],
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },
  avatarTextSelected: {
    color: colors.white,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.md,
  },
  roleBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.neutral[400],
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  groupNameContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  groupNameInput: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    marginTop: spacing.md,
  },
  selectedInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  selectedCount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  selectedNames: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    gap: spacing.sm,
    elevation: 2,
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  startButtonDisabled: {
    backgroundColor: colors.primary[300],
    shadowOpacity: 0,
  },
  startButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
});

export default NewConversationModal;
