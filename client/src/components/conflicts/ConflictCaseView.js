import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
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

// Section Components
import CaseOverviewSection from "./sections/CaseOverviewSection";
import EvidenceGallerySection from "./sections/EvidenceGallerySection";
import ChecklistReviewSection from "./sections/ChecklistReviewSection";
import MessageThreadSection from "./sections/MessageThreadSection";
import AuditTrailSection from "./sections/AuditTrailSection";
import FinancialSection from "./sections/FinancialSection";
import ResolutionActionsPanel from "./sections/ResolutionActionsPanel";

// Modals
import RefundModal from "./modals/RefundModal";
import PayoutModal from "./modals/PayoutModal";
import PhotoViewerModal from "./modals/PhotoViewerModal";
import PhotoComparisonModal from "./modals/PhotoComparisonModal";
import AddNoteModal from "./modals/AddNoteModal";

const TABS = [
  { id: "overview", label: "Overview", icon: "info-circle" },
  { id: "evidence", label: "Evidence", icon: "camera" },
  { id: "context", label: "Context", icon: "list-alt" },
  { id: "messages", label: "Messages", icon: "comments" },
  { id: "activity", label: "Activity", icon: "history" },
  { id: "financial", label: "Financial", icon: "usd" },
];

const ConflictCaseView = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const { caseId, caseType } = route.params;

  const [caseData, setCaseData] = useState(null);
  const [photos, setPhotos] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [messages, setMessages] = useState(null);
  const [auditTrail, setAuditTrail] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabLoading, setTabLoading] = useState({});

  // Modal states
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const fetchCaseData = useCallback(async () => {
    try {
      const result = await ConflictService.getCase(user.token, caseType, caseId);
      if (result.success) {
        setCaseData(result.case);
      }
    } catch (err) {
      console.error("Failed to fetch case data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.token, caseType, caseId]);

  const fetchTabData = useCallback(async (tab) => {
    if (tabLoading[tab]) return;

    setTabLoading(prev => ({ ...prev, [tab]: true }));

    try {
      switch (tab) {
        case "evidence":
          if (!photos) {
            const result = await ConflictService.getPhotos(user.token, caseType, caseId);
            if (result.success) {
              setPhotos(result);
            }
          }
          break;
        case "context":
          if (!checklist) {
            const result = await ConflictService.getChecklist(user.token, caseType, caseId);
            if (result.success) {
              setChecklist(result);
            }
          }
          break;
        case "messages":
          if (!messages) {
            const result = await ConflictService.getMessages(user.token, caseType, caseId);
            if (result.success) {
              setMessages(result);
            }
          }
          break;
        case "activity":
          if (!auditTrail) {
            const result = await ConflictService.getAuditTrail(user.token, caseType, caseId);
            if (result.success) {
              setAuditTrail(result.auditTrail);
            }
          }
          break;
      }
    } catch (err) {
      console.error(`Failed to fetch ${tab} data:`, err);
    } finally {
      setTabLoading(prev => ({ ...prev, [tab]: false }));
    }
  }, [user.token, caseType, caseId, photos, checklist, messages, auditTrail, tabLoading]);

  useEffect(() => {
    fetchCaseData();
  }, [fetchCaseData]);

  useEffect(() => {
    if (activeTab !== "overview" && activeTab !== "financial") {
      fetchTabData(activeTab);
    }
  }, [activeTab, fetchTabData]);

  const onRefresh = () => {
    setRefreshing(true);
    setPhotos(null);
    setChecklist(null);
    setMessages(null);
    setAuditTrail(null);
    fetchCaseData();
  };

  const handlePhotoPress = (photo) => {
    setSelectedPhoto(photo);
    setShowPhotoViewer(true);
  };

  const handleRefundSuccess = () => {
    setShowRefundModal(false);
    onRefresh();
  };

  const handlePayoutSuccess = () => {
    setShowPayoutModal(false);
    onRefresh();
  };

  const handleNoteAdded = () => {
    setShowAddNoteModal(false);
    setAuditTrail(null);
    fetchTabData("activity");
  };

  const handleResolveSuccess = () => {
    onRefresh();
    navigation.goBack();
  };

  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds <= 0) return "Overdue";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }
    return `${hours}h ${minutes}m remaining`;
  };

  const getStatusColor = (status) => {
    const statusColors = {
      submitted: colors.warning[500],
      under_review: colors.primary[500],
      awaiting_documents: colors.warning[600],
      escalated: colors.error[500],
      pending_homeowner: colors.warning[500],
      pending_owner: colors.warning[600],
      approved: colors.success[500],
      owner_approved: colors.success[500],
      denied: colors.error[500],
      owner_denied: colors.error[500],
      partially_approved: colors.primary[500],
    };
    return statusColors[status] || colors.neutral[500];
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <CaseOverviewSection
            caseData={caseData}
            caseType={caseType}
          />
        );
      case "evidence":
        return (
          <EvidenceGallerySection
            photos={photos}
            evidencePhotos={caseData?.evidencePhotos}
            loading={tabLoading.evidence}
            onPhotoPress={handlePhotoPress}
            onComparePress={() => setShowComparisonModal(true)}
          />
        );
      case "context":
        return (
          <ChecklistReviewSection
            checklist={checklist}
            appointment={caseData?.appointment}
            loading={tabLoading.context}
          />
        );
      case "messages":
        return (
          <MessageThreadSection
            messages={messages}
            loading={tabLoading.messages}
          />
        );
      case "activity":
        return (
          <AuditTrailSection
            auditTrail={auditTrail}
            loading={tabLoading.activity}
          />
        );
      case "financial":
        return (
          <FinancialSection
            caseData={caseData}
            caseType={caseType}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading case details...</Text>
      </View>
    );
  }

  if (!caseData) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="exclamation-triangle" size={48} color={colors.error[400]} />
        <Text style={styles.errorTitle}>Case not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isClosed = ["approved", "denied", "partially_approved", "owner_approved", "owner_denied"].includes(caseData.status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backArrow} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={20} color={colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.caseNumberRow}>
            <View style={[styles.caseTypeBadge, { backgroundColor: caseType === "appeal" ? colors.primary[100] : colors.warning[100] }]}>
              <Icon
                name={caseType === "appeal" ? "gavel" : "home"}
                size={12}
                color={caseType === "appeal" ? colors.primary[600] : colors.warning[600]}
              />
            </View>
            <Text style={styles.caseNumber}>{caseData.caseNumber}</Text>
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(caseData.status) + "20" }]}>
              <Text style={[styles.statusText, { color: getStatusColor(caseData.status) }]}>
                {caseData.status.replace(/_/g, " ")}
              </Text>
            </View>
            {!isClosed && caseData.slaDeadline && (
              <View style={[styles.slaBadge, caseData.isPastSLA && styles.slaBadgeOverdue]}>
                <Icon name="clock-o" size={10} color={caseData.isPastSLA ? colors.error[600] : colors.warning[600]} />
                <Text style={[styles.slaText, caseData.isPastSLA && styles.slaTextOverdue]}>
                  {formatTimeRemaining(caseData.timeUntilSLA)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Icon
                name={tab.icon}
                size={14}
                color={activeTab === tab.id ? colors.primary[600] : colors.text.tertiary}
              />
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
          />
        }
      >
        {renderTabContent()}
      </ScrollView>

      {/* Actions Panel (sticky at bottom) */}
      {!isClosed && (
        <ResolutionActionsPanel
          caseData={caseData}
          caseType={caseType}
          caseId={caseId}
          onRefund={() => setShowRefundModal(true)}
          onPayout={() => setShowPayoutModal(true)}
          onAddNote={() => setShowAddNoteModal(true)}
          onResolveSuccess={handleResolveSuccess}
        />
      )}

      {/* Modals */}
      <RefundModal
        visible={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        onSuccess={handleRefundSuccess}
        caseData={caseData}
        caseType={caseType}
        caseId={caseId}
      />

      <PayoutModal
        visible={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        onSuccess={handlePayoutSuccess}
        caseData={caseData}
        caseType={caseType}
        caseId={caseId}
      />

      <PhotoViewerModal
        visible={showPhotoViewer}
        onClose={() => setShowPhotoViewer(false)}
        photo={selectedPhoto}
        allPhotos={photos}
      />

      <PhotoComparisonModal
        visible={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        beforePhotos={photos?.before || []}
        afterPhotos={photos?.after || []}
      />

      <AddNoteModal
        visible={showAddNoteModal}
        onClose={() => setShowAddNoteModal(false)}
        onSuccess={handleNoteAdded}
        caseType={caseType}
        caseId={caseId}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral[50],
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[500],
    borderRadius: radius.lg,
  },
  backButtonText: {
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.semibold,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.md,
  },
  backArrow: {
    padding: spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  caseNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  caseTypeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  caseNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: "capitalize",
  },
  slaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
  },
  slaBadgeOverdue: {
    backgroundColor: colors.error[100],
  },
  slaText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
  },
  slaTextOverdue: {
    color: colors.error[700],
    fontWeight: typography.fontWeight.semibold,
  },
  tabsContainer: {
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  tabsContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    gap: spacing.xs,
  },
  tabActive: {
    borderBottomColor: colors.primary[500],
  },
  tabText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: 120,
  },
});

export default ConflictCaseView;
