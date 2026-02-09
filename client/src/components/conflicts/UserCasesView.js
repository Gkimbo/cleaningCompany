import React, { useState, useContext, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Alert,
} from "react-native";
import { useNavigate, useLocation } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { AuthContext } from "../../services/AuthContext";
import ConflictService from "../../services/fetchRequests/ConflictService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

const UserCasesView = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const { users: initialUsers, searchQuery } = location.state || {};

  const [selectedUser, setSelectedUser] = useState(
    initialUsers?.length === 1 ? initialUsers[0] : null
  );
  const [users, setUsers] = useState(initialUsers || []);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Fetch cases for selected user
  const fetchUserCases = useCallback(async () => {
    if (!selectedUser?.id) return;

    setLoading(true);
    try {
      const result = await ConflictService.getUserCases(
        user.token,
        selectedUser.id,
        showResolved
      );
      if (result.success) {
        setCases(result.cases || []);
      }
    } catch (err) {
      console.error("Failed to fetch user cases:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.token, selectedUser?.id, showResolved]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserCases();
    }
  }, [selectedUser, fetchUserCases]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserCases();
  };

  const handleCasePress = (caseItem) => {
    navigate(`/conflicts/${caseItem.caseType}/${caseItem.id}`);
  };

  const handleCreateTicket = () => {
    // Navigate to create support ticket with user pre-filled
    navigate("/conflicts/support/create", {
      state: { prefillUser: selectedUser }
    });
  };

  const getUserTypeLabel = (type) => {
    const labels = {
      homeowner: "Homeowner",
      cleaner: "Cleaner",
      businessOwner: "Business Owner",
      businessEmployee: "Business Employee",
      admin: "Admin",
      hr: "HR",
    };
    return labels[type] || type;
  };

  const getUserTypeColor = (type) => {
    const typeColors = {
      homeowner: { bg: colors.primary[100], text: colors.primary[600] },
      cleaner: { bg: colors.success[100], text: colors.success[600] },
      businessOwner: { bg: colors.warning[100], text: colors.warning[600] },
      businessEmployee: { bg: colors.secondary[100], text: colors.secondary[600] },
      admin: { bg: colors.error[100], text: colors.error[600] },
      hr: { bg: colors.primary[100], text: colors.primary[600] },
    };
    return typeColors[type] || { bg: colors.neutral[100], text: colors.neutral[600] };
  };

  const getCaseTypeColors = (caseType) => {
    const colorMap = {
      appeal: { bg: colors.primary[100], text: colors.primary[600] },
      payment: { bg: colors.error[100], text: colors.error[600] },
      adjustment: { bg: colors.warning[100], text: colors.warning[600] },
      support: { bg: colors.secondary[100], text: colors.secondary[600] },
    };
    return colorMap[caseType] || { bg: colors.neutral[100], text: colors.neutral[600] };
  };

  const getCaseTypeIcon = (caseType) => {
    const iconMap = {
      appeal: "gavel",
      payment: "dollar",
      adjustment: "home",
      support: "life-ring",
    };
    return iconMap[caseType] || "question";
  };

  const getStatusColor = (status) => {
    if (status.includes("approved") || status === "resolved") return colors.success[500];
    if (status.includes("denied") || status === "closed") return colors.error[500];
    if (status.includes("pending") || status === "submitted") return colors.warning[500];
    return colors.neutral[500];
  };

  const renderUserSelector = () => {
    if (users.length <= 1) return null;

    return (
      <View style={styles.userSelectorContainer}>
        <Text style={styles.userSelectorLabel}>Multiple users found for "{searchQuery}"</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.userSelector}>
          {users.map((u) => {
            const typeColors = getUserTypeColor(u.type);
            const isSelected = selectedUser?.id === u.id;
            return (
              <TouchableOpacity
                key={u.id}
                style={[styles.userChip, isSelected && styles.userChipSelected]}
                onPress={() => setSelectedUser(u)}
              >
                <View style={[styles.userChipType, { backgroundColor: typeColors.bg }]}>
                  <Text style={[styles.userChipTypeText, { color: typeColors.text }]}>
                    {getUserTypeLabel(u.type)}
                  </Text>
                </View>
                <Text style={[styles.userChipName, isSelected && styles.userChipNameSelected]}>
                  {u.name || u.email}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderUserInfo = () => {
    if (!selectedUser) return null;

    const typeColors = getUserTypeColor(selectedUser.type);

    return (
      <View style={styles.userInfoCard}>
        <View style={styles.userInfoHeader}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {(selectedUser.name || selectedUser.email || "?")[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfoDetails}>
            <Text style={styles.userName}>{selectedUser.name || "Unknown"}</Text>
            <View style={[styles.userTypeBadge, { backgroundColor: typeColors.bg }]}>
              <Text style={[styles.userTypeText, { color: typeColors.text }]}>
                {getUserTypeLabel(selectedUser.type)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.userContactInfo}>
          {selectedUser.email && (
            <View style={styles.contactRow}>
              <Icon name="envelope" size={14} color={colors.text.tertiary} />
              <Text style={styles.contactText}>{selectedUser.email}</Text>
            </View>
          )}
          {selectedUser.phone && (
            <View style={styles.contactRow}>
              <Icon name="phone" size={14} color={colors.text.tertiary} />
              <Text style={styles.contactText}>{selectedUser.phone}</Text>
            </View>
          )}
          <View style={styles.contactRow}>
            <Icon name="id-badge" size={14} color={colors.text.tertiary} />
            <Text style={styles.contactText}>User ID: {selectedUser.id}</Text>
          </View>
        </View>

        {/* Create Support Ticket Button */}
        <TouchableOpacity style={styles.createTicketButton} onPress={handleCreateTicket}>
          <Icon name="plus-circle" size={16} color={colors.neutral[0]} />
          <Text style={styles.createTicketButtonText}>Create Support Ticket</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCaseItem = ({ item }) => {
    const caseColors = getCaseTypeColors(item.caseType);
    const caseIcon = getCaseTypeIcon(item.caseType);

    return (
      <TouchableOpacity
        style={styles.caseCard}
        onPress={() => handleCasePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.caseHeader}>
          <View style={[styles.caseTypeBadge, { backgroundColor: caseColors.bg }]}>
            <Icon name={caseIcon} size={12} color={caseColors.text} />
            <Text style={[styles.caseTypeText, { color: caseColors.text }]}>
              {item.caseNumber}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.replace(/_/g, " ")}
            </Text>
          </View>
        </View>

        {item.description && (
          <Text style={styles.caseDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.caseFooter}>
          <Text style={styles.caseDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          <Icon name="chevron-right" size={14} color={colors.text.tertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  const openCases = cases.filter((c) => !["resolved", "closed", "approved", "denied"].includes(c.status));
  const resolvedCases = cases.filter((c) => ["resolved", "closed", "approved", "denied"].includes(c.status));
  const displayedCases = showResolved ? cases : openCases;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={18} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>User Cases</Text>
          {searchQuery && (
            <Text style={styles.subtitle}>Search: "{searchQuery}"</Text>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
          />
        }
      >
        {renderUserSelector()}
        {renderUserInfo()}

        {selectedUser && (
          <View style={styles.casesSection}>
            <View style={styles.casesSectionHeader}>
              <Text style={styles.casesSectionTitle}>
                Cases ({displayedCases.length})
              </Text>
              <TouchableOpacity
                style={styles.resolvedToggle}
                onPress={() => setShowResolved(!showResolved)}
              >
                <Icon
                  name={showResolved ? "eye" : "eye-slash"}
                  size={14}
                  color={colors.text.secondary}
                />
                <Text style={styles.resolvedToggleText}>
                  {showResolved ? "Showing all" : `+${resolvedCases.length} resolved`}
                </Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary[500]} />
                <Text style={styles.loadingText}>Loading cases...</Text>
              </View>
            ) : displayedCases.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="folder-open-o" size={32} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>
                  {showResolved ? "No cases found" : "No open cases"}
                </Text>
              </View>
            ) : (
              <View style={styles.casesList}>
                {displayedCases.map((item) => (
                  <View key={`${item.caseType}-${item.id}`}>
                    {renderCaseItem({ item })}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {!selectedUser && users.length > 1 && (
          <View style={styles.selectUserPrompt}>
            <Icon name="hand-pointer-o" size={32} color={colors.text.tertiary} />
            <Text style={styles.selectUserPromptText}>
              Select a user above to view their cases
            </Text>
          </View>
        )}

        {!selectedUser && users.length === 0 && (
          <View style={styles.noUsersContainer}>
            <Icon name="user-times" size={48} color={colors.text.tertiary} />
            <Text style={styles.noUsersText}>No users found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  userSelectorContainer: {
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  userSelectorLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  userSelector: {
    paddingHorizontal: spacing.md,
  },
  userChip: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginHorizontal: spacing.xs,
    minWidth: 120,
    borderWidth: 2,
    borderColor: "transparent",
  },
  userChipSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  userChipType: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
    marginBottom: spacing.xs,
  },
  userChipTypeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  userChipName: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  userChipNameSelected: {
    color: colors.primary[700],
  },
  userInfoCard: {
    backgroundColor: colors.neutral[0],
    margin: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  userInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[500],
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  userInfoDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  userTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
  },
  userTypeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  userContactInfo: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginBottom: spacing.md,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  contactText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  createTicketButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.secondary[500],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  createTicketButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  casesSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  casesSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  casesSectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  resolvedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  resolvedToggleText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  casesList: {
    gap: spacing.sm,
  },
  caseCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  caseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  caseTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  caseTypeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: "capitalize",
  },
  caseDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  caseFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  caseDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  selectUserPrompt: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl * 2,
  },
  selectUserPromptText: {
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
  noUsersContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl * 2,
  },
  noUsersText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
});

export default UserCasesView;
