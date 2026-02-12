import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { API_BASE } from "../../services/config";
import { formatCurrency } from "../../services/formatters";
import { parseLocalDate } from "../../utils/dateUtils";

// Helper to format time window display
const formatTimeWindow = (timeWindow) => {
  if (!timeWindow) return null;
  const timeWindowLabels = {
    anytime: "Anytime",
    "10to3": "10am - 3pm",
    "11to4": "11am - 4pm",
    "12to2": "12pm - 2pm",
  };
  return timeWindowLabels[timeWindow] || timeWindow;
};

// Helper to safely parse JSON configurations (can be string or array)
const parseConfig = (config) => {
  if (!config) return [];
  if (Array.isArray(config)) return config;
  if (typeof config === 'string') {
    try {
      const parsed = JSON.parse(config);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const BusinessOwnerJobDetails = ({ state }) => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    fetchJobDetails();
  }, [appointmentId]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `${API_BASE}/business-owner/my-jobs/${appointmentId}`,
        {
          headers: {
            Authorization: `Bearer ${state.currentUser?.token}`,
          },
        }
      );
      const data = await response.json();
      if (response.ok) {
        setJobData(data);
      } else {
        setError(data.error || "Failed to load job details");
      }
    } catch (err) {
      console.error("Error fetching job details:", err);
      setError("Failed to load job details");
    } finally {
      setLoading(false);
    }
  };

  const handleSelfAssign = async () => {
    try {
      setAssigning(true);
      const response = await fetch(
        `${API_BASE}/business-owner/self-assign/${appointmentId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${state.currentUser?.token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json();
      if (response.ok) {
        Alert.alert("Success", "You have been assigned to this job");
        fetchJobDetails();
      } else {
        Alert.alert("Error", data.error || "Failed to assign");
      }
    } catch (err) {
      console.error("Error self-assigning:", err);
      Alert.alert("Error", "Failed to assign to job");
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignEmployee = async (employeeId) => {
    try {
      setAssigning(true);
      setShowEmployeeList(false);
      const response = await fetch(`${API_BASE}/business-owner/assignments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${state.currentUser?.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          appointmentId: parseInt(appointmentId),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert("Success", "Employee has been assigned to this job");
        fetchJobDetails();
      } else {
        Alert.alert("Error", data.error || "Failed to assign employee");
      }
    } catch (err) {
      console.error("Error assigning employee:", err);
      Alert.alert("Error", "Failed to assign employee");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async () => {
    const isMultiCleaner = jobData?.job?.isMultiCleaner;
    const assignmentIds = jobData?.job?.assignmentIds || [jobData?.job?.assignmentId];

    Alert.alert(
      "Unassign from Job",
      isMultiCleaner
        ? `Are you sure you want to remove all ${assignmentIds.length} cleaners from this job?`
        : "Are you sure you want to remove the assignment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unassign",
          style: "destructive",
          onPress: async () => {
            try {
              setAssigning(true);

              let response;
              if (isMultiCleaner) {
                // Use bulk endpoint for multi-cleaner jobs to avoid race conditions
                response = await fetch(
                  `${API_BASE}/business-owner/appointments/${appointmentId}/assignments`,
                  {
                    method: "DELETE",
                    headers: {
                      Authorization: `Bearer ${state.currentUser?.token}`,
                    },
                  }
                );
              } else {
                // Single cleaner - use existing endpoint
                const assignmentId = assignmentIds[0];
                response = await fetch(
                  `${API_BASE}/business-owner/assignments/${assignmentId}`,
                  {
                    method: "DELETE",
                    headers: {
                      Authorization: `Bearer ${state.currentUser?.token}`,
                    },
                  }
                );
              }

              if (response.ok) {
                Alert.alert("Success", "Assignment removed", [
                  { text: "OK", onPress: () => navigate("/business-owner/all-jobs") }
                ]);
              } else {
                const data = await response.json();
                Alert.alert("Error", data.error || "Failed to unassign");
                fetchJobDetails();
              }
            } catch (err) {
              console.error("Error unassigning:", err);
              Alert.alert("Error", "Failed to unassign");
            } finally {
              setAssigning(false);
            }
          },
        },
      ]
    );
  };

  const handleDecline = async () => {
    try {
      setDeclining(true);
      const response = await fetch(
        `${API_BASE}/business-owner/appointments/${appointmentId}/decline`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${state.currentUser?.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: declineReason || undefined,
          }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setShowDeclineModal(false);
        Alert.alert(
          "Job Declined",
          "The client has been notified and can choose to cancel or find another cleaner.",
          [{ text: "OK", onPress: () => navigate(-1) }]
        );
      } else {
        Alert.alert("Error", data.error || "Failed to decline job");
      }
    } catch (err) {
      console.error("Error declining job:", err);
      Alert.alert("Error", "Failed to decline job");
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading job details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIconContainer}>
          <Icon name="exclamation-circle" size={48} color="#ef4444" />
        </View>
        <Text style={styles.errorTitle}>Unable to Load Job</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchJobDetails}>
          <Icon name="refresh" size={16} color="#fff" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
        <Pressable style={styles.backLink} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={14} color="#6366f1" />
          <Text style={styles.backLinkText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const { job, home, client, employees } = jobData;
  const appointmentDate = parseLocalDate(job.date);
  const formattedDate = appointmentDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeWindowDisplay = formatTimeWindow(job.timeWindow);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backArrow} onPress={() => navigate(-1)}>
          <Icon name="arrow-left" size={20} color="#374151" />
        </Pressable>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Hero Card - Date, Time & Status */}
      <View style={styles.heroCard}>
        <View style={styles.heroDateSection}>
          <View style={styles.calendarIcon}>
            <Icon name="calendar" size={24} color="#6366f1" />
          </View>
          <View style={styles.heroDateContent}>
            <Text style={styles.heroDate}>{formattedDate}</Text>
            {timeWindowDisplay && (
              <View style={styles.timeWindowBadge}>
                <Icon name="clock-o" size={14} color="#6366f1" />
                <Text style={styles.timeWindowText}>{timeWindowDisplay}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroStatusSection}>
          <View
            style={[
              styles.statusBadge,
              job.isAssigned ? styles.assignedBadge : styles.unassignedBadge,
            ]}
          >
            <Icon
              name={job.isAssigned ? "check-circle" : "exclamation-circle"}
              size={14}
              color={job.isAssigned ? "#166534" : "#92400e"}
            />
            <Text
              style={[
                styles.statusText,
                job.isAssigned ? styles.assignedText : styles.unassignedText,
              ]}
            >
              {job.isAssigned
                ? (job.isMultiCleaner ? `${job.assignees?.length} Cleaners` : "Assigned")
                : "Needs Assignment"}
            </Text>
          </View>
          {job.isAssigned && job.assignedTo && !job.isMultiCleaner && (
            <Text style={styles.assignedToText}>
              {job.assignedTo.name}
            </Text>
          )}
        </View>
      </View>

      {/* Price Banner */}
      <View style={styles.priceBanner}>
        <View style={styles.priceContent}>
          <Text style={styles.priceLabel}>Job Earnings</Text>
          <Text style={styles.priceValue}>
            {formatCurrency((job.price || 0) * 100)}
          </Text>
        </View>
        <View style={styles.priceIcon}>
          <Icon name="dollar" size={20} color="#10b981" />
        </View>
      </View>

      {/* Assignment Actions */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name="user-plus" size={18} color="#6366f1" />
          <Text style={styles.cardTitle}>Assignment</Text>
        </View>

        {assigning ? (
          <View style={styles.assigningContainer}>
            <ActivityIndicator size="small" color="#6366f1" />
            <Text style={styles.assigningText}>Processing...</Text>
          </View>
        ) : job.isAssigned ? (
          <View style={styles.assignedActions}>
            {/* Multi-cleaner display */}
            {job.isMultiCleaner && job.assignees?.length > 0 ? (
              <View style={styles.multiCleanerAssignment}>
                <View style={styles.multiCleanerHeader}>
                  <Icon name="users" size={14} color="#6366f1" />
                  <Text style={styles.multiCleanerTitle}>
                    {job.assignees.length} Cleaners Assigned
                  </Text>
                </View>
                {job.assignees.map((assignee, index) => (
                  <View
                    key={assignee.id || index}
                    style={[
                      styles.assigneeRow,
                      index === job.assignees.length - 1 && styles.assigneeRowLast,
                    ]}
                  >
                    <View style={[
                      styles.assigneeIcon,
                      assignee.isSelfAssignment && styles.assigneeIconSelf,
                    ]}>
                      <Icon
                        name={assignee.isSelfAssignment ? "star" : "user"}
                        size={12}
                        color={assignee.isSelfAssignment ? "#d97706" : "#6366f1"}
                      />
                    </View>
                    <Text style={[
                      styles.assigneeName,
                      assignee.isSelfAssignment && styles.assigneeNameSelf,
                    ]}>
                      {assignee.name}
                    </Text>
                    {assignee.payAmount > 0 && (
                      <Text style={styles.assigneePay}>
                        {formatCurrency(assignee.payAmount)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              /* Single cleaner display */
              <View style={styles.currentAssignment}>
                <View style={styles.currentAssignmentIcon}>
                  <Icon name="user" size={16} color="#fff" />
                </View>
                <View style={styles.currentAssignmentInfo}>
                  <Text style={styles.currentAssignmentLabel}>Currently assigned to</Text>
                  <Text style={styles.currentAssignmentName}>{job.assignedTo?.name}</Text>
                </View>
              </View>
            )}
            {job.actions.canUnassign && (
              <Pressable
                style={styles.unassignButton}
                onPress={handleUnassign}
              >
                <Icon name="times" size={14} color="#ef4444" />
                <Text style={styles.unassignButtonText}>Remove Assignment</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.assignmentOptions}>
            {job.actions.canSelfAssign && (
              <Pressable
                style={styles.selfAssignButton}
                onPress={handleSelfAssign}
              >
                <Icon name="hand-pointer-o" size={18} color="#fff" />
                <Text style={styles.selfAssignButtonText}>
                  Assign to Myself
                </Text>
              </Pressable>
            )}
            {job.actions.canAssignEmployee && employees.length > 0 && (
              <>
                <Pressable
                  style={styles.assignEmployeeButton}
                  onPress={() => setShowEmployeeList(!showEmployeeList)}
                >
                  <Icon name="users" size={16} color="#6366f1" />
                  <Text style={styles.assignEmployeeButtonText}>
                    Assign to Employee
                  </Text>
                  <Icon
                    name={showEmployeeList ? "chevron-up" : "chevron-down"}
                    size={12}
                    color="#6366f1"
                    style={styles.chevronIcon}
                  />
                </Pressable>
                {showEmployeeList && (
                  <View style={styles.employeeList}>
                    {employees.map((emp, index) => (
                      <Pressable
                        key={emp.id}
                        style={[
                          styles.employeeItem,
                          index === employees.length - 1 && styles.employeeItemLast,
                        ]}
                        onPress={() => handleAssignEmployee(emp.id)}
                      >
                        <View style={styles.employeeAvatar}>
                          <Text style={styles.employeeAvatarText}>
                            {emp.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.employeeName}>{emp.name}</Text>
                        <View style={styles.assignEmployeeIcon}>
                          <Icon name="plus" size={12} color="#6366f1" />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Divider before decline option */}
            <View style={styles.assignmentDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Can't Assign / Decline Button */}
            <Pressable
              style={styles.declineButton}
              onPress={() => setShowDeclineModal(true)}
            >
              <Icon name="times-circle" size={16} color="#dc2626" />
              <Text style={styles.declineButtonText}>Can't Assign Anyone</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Property Details */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name="home" size={18} color="#6366f1" />
          <Text style={styles.cardTitle}>Property Details</Text>
        </View>

        <View style={styles.propertyStats}>
          <View style={styles.propertyStat}>
            <View style={styles.propertyStatIcon}>
              <Icon name="bed" size={16} color="#6366f1" />
            </View>
            <Text style={styles.propertyStatValue}>{home.numBeds}</Text>
            <Text style={styles.propertyStatLabel}>Beds</Text>
          </View>
          <View style={styles.propertyStatDivider} />
          <View style={styles.propertyStat}>
            <View style={styles.propertyStatIcon}>
              <Icon name="tint" size={16} color="#6366f1" />
            </View>
            <Text style={styles.propertyStatValue}>{home.numBaths}</Text>
            <Text style={styles.propertyStatLabel}>Baths</Text>
          </View>
          {home.numHalfBaths && home.numHalfBaths !== "0" && (
            <>
              <View style={styles.propertyStatDivider} />
              <View style={styles.propertyStat}>
                <View style={styles.propertyStatIcon}>
                  <Icon name="tint" size={14} color="#9ca3af" />
                </View>
                <Text style={styles.propertyStatValue}>{home.numHalfBaths}</Text>
                <Text style={styles.propertyStatLabel}>Half</Text>
              </View>
            </>
          )}
          {home.squareFootage && (
            <>
              <View style={styles.propertyStatDivider} />
              <View style={styles.propertyStat}>
                <View style={styles.propertyStatIcon}>
                  <Icon name="square-o" size={16} color="#6366f1" />
                </View>
                <Text style={styles.propertyStatValue}>{home.squareFootage}</Text>
                <Text style={styles.propertyStatLabel}>Sq Ft</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.addressSection}>
          <Icon name="map-marker" size={16} color="#6b7280" />
          <Text style={styles.addressText}>
            {home.address}, {home.city}, {home.state} {home.zipcode}
          </Text>
        </View>

        {job.timeToBeCompleted && (
          <View style={styles.timeEstimate}>
            <Icon name="hourglass-half" size={14} color="#6b7280" />
            <Text style={styles.timeEstimateText}>
              Estimated time: {job.timeToBeCompleted} hours
            </Text>
          </View>
        )}
      </View>

      {/* Access Information */}
      {(home.keyPadCode || home.keyLocation || home.contact) && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="key" size={18} color="#6366f1" />
            <Text style={styles.cardTitle}>Access Information</Text>
          </View>

          <View style={styles.accessGrid}>
            {home.keyPadCode && (
              <View style={styles.accessItem}>
                <View style={styles.accessItemIcon}>
                  <Icon name="th" size={14} color="#6366f1" />
                </View>
                <View>
                  <Text style={styles.accessItemLabel}>Keypad Code</Text>
                  <Text style={styles.accessItemValue}>{home.keyPadCode}</Text>
                </View>
              </View>
            )}
            {home.keyLocation && (
              <View style={styles.accessItem}>
                <View style={styles.accessItemIcon}>
                  <Icon name="map-pin" size={14} color="#6366f1" />
                </View>
                <View style={styles.accessItemContent}>
                  <Text style={styles.accessItemLabel}>Key Location</Text>
                  <Text style={styles.accessItemValue}>{home.keyLocation}</Text>
                </View>
              </View>
            )}
            {home.contact && (
              <View style={styles.accessItem}>
                <View style={styles.accessItemIcon}>
                  <Icon name="phone" size={14} color="#6366f1" />
                </View>
                <View>
                  <Text style={styles.accessItemLabel}>Contact</Text>
                  <Text style={styles.accessItemValue}>{home.contact}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Linens */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name="tasks" size={18} color="#6366f1" />
          <Text style={styles.cardTitle}>Linens</Text>
        </View>

        {/* Sheets Section */}
        <View style={styles.linenSection}>
          <View style={styles.linenSectionHeader}>
            <View style={styles.linenSectionIconContainer}>
              <Icon name="bed" size={16} color={job.bringSheets === "yes" ? "#6366f1" : "#9ca3af"} />
            </View>
            <Text style={styles.linenSectionTitle}>Sheets</Text>
          </View>
          <View style={styles.linenDetailsList}>
            {job.bringSheets === "yes" ? (
              <>
                {parseConfig(job.sheetConfigurations || home.bedConfigurations)
                  .filter(bed => bed.needsSheets)
                  .map((bed, index) => (
                    <View key={index} style={styles.linenDetailItem}>
                      <Icon name="check" size={12} color="#10b981" />
                      <Text style={styles.linenDetailText}>
                        Bed {bed.bedNumber}: <Text style={styles.linenDetailBold}>{bed.size}</Text> sheets
                      </Text>
                    </View>
                  ))
                }
                {!parseConfig(job.sheetConfigurations || home.bedConfigurations).some(bed => bed.needsSheets) && (
                  <View style={styles.linenDetailItem}>
                    <Icon name="check" size={12} color="#10b981" />
                    <Text style={styles.linenDetailText}>Sheets required (details not specified)</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.linenDetailItem}>
                <Icon name="times" size={12} color="#9ca3af" />
                <Text style={styles.linenDetailTextMuted}>No sheets required - homeowner provides</Text>
              </View>
            )}
          </View>
        </View>

        {/* Towels Section */}
        <View style={[styles.linenSection, styles.linenSectionBorder]}>
          <View style={styles.linenSectionHeader}>
            <View style={styles.linenSectionIconContainer}>
              <Icon name="tint" size={16} color={job.bringTowels === "yes" ? "#6366f1" : "#9ca3af"} />
            </View>
            <Text style={styles.linenSectionTitle}>Towels</Text>
          </View>
          <View style={styles.linenDetailsList}>
            {job.bringTowels === "yes" ? (
              <>
                {parseConfig(job.towelConfigurations || home.bathroomConfigurations)
                  .filter(bath => bath.towels > 0 || bath.faceCloths > 0)
                  .map((bath, index) => (
                    <View key={index} style={styles.linenDetailItem}>
                      <Icon name="check" size={12} color="#10b981" />
                      <Text style={styles.linenDetailText}>
                        Bathroom {bath.bathroomNumber}: {' '}
                        {bath.towels > 0 && (
                          <Text style={styles.linenDetailBold}>{bath.towels} towel{bath.towels > 1 ? 's' : ''}</Text>
                        )}
                        {bath.towels > 0 && bath.faceCloths > 0 && ', '}
                        {bath.faceCloths > 0 && (
                          <Text style={styles.linenDetailBold}>{bath.faceCloths} face cloth{bath.faceCloths > 1 ? 's' : ''}</Text>
                        )}
                      </Text>
                    </View>
                  ))
                }
                {!parseConfig(job.towelConfigurations || home.bathroomConfigurations).some(bath => bath.towels > 0 || bath.faceCloths > 0) && (
                  <View style={styles.linenDetailItem}>
                    <Icon name="check" size={12} color="#10b981" />
                    <Text style={styles.linenDetailText}>Towels required (details not specified)</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.linenDetailItem}>
                <Icon name="times" size={12} color="#9ca3af" />
                <Text style={styles.linenDetailTextMuted}>No towels required - homeowner provides</Text>
              </View>
            )}
          </View>
        </View>

        {/* Summary totals - only show if at least one linen type is required */}
        {(job.bringSheets === "yes" || job.bringTowels === "yes") && (
          <View style={styles.linenSummary}>
            {job.bringSheets === "yes" && (() => {
              const sheetConfigs = parseConfig(job.sheetConfigurations || home.bedConfigurations);
              const totalBeds = sheetConfigs.filter(bed => bed.needsSheets).length;
              return totalBeds > 0 ? (
                <View style={styles.linenSummaryItem}>
                  <Icon name="bed" size={14} color="#6b7280" />
                  <Text style={styles.linenSummaryText}>{totalBeds} bed{totalBeds > 1 ? 's' : ''} total</Text>
                </View>
              ) : null;
            })()}
            {job.bringTowels === "yes" && (() => {
              const towelConfigs = parseConfig(job.towelConfigurations || home.bathroomConfigurations);
              const totalTowels = towelConfigs.reduce((sum, bath) => sum + (bath.towels || 0), 0);
              const totalFaceCloths = towelConfigs.reduce((sum, bath) => sum + (bath.faceCloths || 0), 0);
              return (totalTowels > 0 || totalFaceCloths > 0) ? (
                <View style={styles.linenSummaryItem}>
                  <Icon name="tint" size={14} color="#6b7280" />
                  <Text style={styles.linenSummaryText}>
                    {totalTowels > 0 && `${totalTowels} towel${totalTowels > 1 ? 's' : ''}`}
                    {totalTowels > 0 && totalFaceCloths > 0 && ', '}
                    {totalFaceCloths > 0 && `${totalFaceCloths} face cloth${totalFaceCloths > 1 ? 's' : ''}`}
                    {' '}total
                  </Text>
                </View>
              ) : null;
            })()}
          </View>
        )}
      </View>

      {/* Special Notes */}
      {home.specialNotes && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="sticky-note" size={18} color="#6366f1" />
            <Text style={styles.cardTitle}>Special Notes</Text>
          </View>
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{home.specialNotes}</Text>
          </View>
        </View>
      )}

      {/* Client Info */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name="user-circle" size={18} color="#6366f1" />
          <Text style={styles.cardTitle}>Client Information</Text>
        </View>

        <View style={styles.clientCard}>
          <View style={styles.clientAvatar}>
            <Text style={styles.clientAvatarText}>
              {client.fullName?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{client.fullName}</Text>
            {client.phone && (
              <View style={styles.clientContact}>
                <Icon name="phone" size={12} color="#6b7280" />
                <Text style={styles.clientPhone}>{client.phone}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.bottomPadding} />

      {/* Decline Modal */}
      <Modal
        visible={showDeclineModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeclineModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Icon name="exclamation-circle" size={28} color="#dc2626" />
              </View>
              <Text style={styles.modalTitle}>Can't Assign Anyone?</Text>
              <Text style={styles.modalSubtitle}>
                The client will be notified and can choose to cancel or find another cleaner.
              </Text>
            </View>

            <View style={styles.reasonInputContainer}>
              <Text style={styles.reasonLabel}>Reason (optional)</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="e.g., Staff unavailable, scheduling conflict..."
                placeholderTextColor="#9ca3af"
                value={declineReason}
                onChangeText={setDeclineReason}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelModalButton}
                onPress={() => {
                  setShowDeclineModal(false);
                  setDeclineReason("");
                }}
                disabled={declining}
              >
                <Text style={styles.cancelModalButtonText}>Go Back</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmDeclineButton, declining && styles.buttonDisabled]}
                onPress={handleDecline}
                disabled={declining}
              >
                {declining ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="times" size={14} color="#fff" />
                    <Text style={styles.confirmDeclineButtonText}>Decline Job</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 32,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6366f1",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 6,
  },
  backLinkText: {
    color: "#6366f1",
    fontSize: 16,
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  heroCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  heroDateSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  calendarIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
  },
  heroDateContent: {
    flex: 1,
  },
  heroDate: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  timeWindowBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eef2ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
    gap: 6,
  },
  timeWindowText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366f1",
  },
  heroDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 16,
  },
  heroStatusSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  assignedBadge: {
    backgroundColor: "#dcfce7",
  },
  unassignedBadge: {
    backgroundColor: "#fef3c7",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  assignedText: {
    color: "#166534",
  },
  unassignedText: {
    color: "#92400e",
  },
  assignedToText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  priceBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ecfdf5",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  priceContent: {
    gap: 2,
  },
  priceLabel: {
    fontSize: 13,
    color: "#047857",
    fontWeight: "500",
  },
  priceValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#065f46",
  },
  priceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#d1fae5",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  assigningContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
  },
  assigningText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  assignedActions: {
    gap: 16,
  },
  currentAssignment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f0fdf4",
    padding: 14,
    borderRadius: 12,
  },
  currentAssignmentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
  },
  currentAssignmentInfo: {
    flex: 1,
  },
  currentAssignmentLabel: {
    fontSize: 12,
    color: "#166534",
    marginBottom: 2,
  },
  currentAssignmentName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#166534",
  },
  // Multi-cleaner styles
  multiCleanerAssignment: {
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    overflow: "hidden",
  },
  multiCleanerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#dcfce7",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#bbf7d0",
  },
  multiCleanerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#166534",
  },
  assigneeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#dcfce7",
  },
  assigneeRowLast: {
    borderBottomWidth: 0,
  },
  assigneeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e0e7ff",
    justifyContent: "center",
    alignItems: "center",
  },
  assigneeIconSelf: {
    backgroundColor: "#fef3c7",
  },
  assigneeName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#166534",
  },
  assigneeNameSelf: {
    fontWeight: "600",
  },
  assigneePay: {
    fontSize: 13,
    fontWeight: "600",
    color: "#047857",
  },
  unassignButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    backgroundColor: "#fef2f2",
  },
  unassignButtonText: {
    fontSize: 14,
    color: "#ef4444",
    fontWeight: "600",
  },
  assignmentOptions: {
    gap: 12,
  },
  selfAssignButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#6366f1",
    paddingVertical: 16,
    borderRadius: 12,
  },
  selfAssignButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  assignEmployeeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#6366f1",
  },
  assignEmployeeButtonText: {
    color: "#6366f1",
    fontSize: 16,
    fontWeight: "700",
  },
  chevronIcon: {
    marginLeft: 4,
  },
  employeeList: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    overflow: "hidden",
  },
  employeeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  employeeItemLast: {
    borderBottomWidth: 0,
  },
  employeeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e0e7ff",
    justifyContent: "center",
    alignItems: "center",
  },
  employeeAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6366f1",
  },
  employeeName: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
  assignEmployeeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
  },
  propertyStats: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  propertyStat: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  propertyStatIcon: {
    marginBottom: 6,
  },
  propertyStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  propertyStatLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  propertyStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e5e7eb",
  },
  addressSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  timeEstimate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f3f4f6",
    padding: 10,
    borderRadius: 8,
  },
  timeEstimateText: {
    fontSize: 13,
    color: "#6b7280",
  },
  accessGrid: {
    gap: 12,
  },
  accessItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#f9fafb",
    padding: 14,
    borderRadius: 10,
  },
  accessItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
  },
  accessItemContent: {
    flex: 1,
  },
  accessItemLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 2,
  },
  accessItemValue: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
  },
  linenSection: {
    marginBottom: 4,
  },
  linenSectionBorder: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  linenSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  linenSectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
  },
  linenSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  linenDetailsList: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  linenDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  linenDetailText: {
    fontSize: 14,
    color: "#374151",
  },
  linenDetailTextMuted: {
    fontSize: 14,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  linenDetailBold: {
    fontWeight: "600",
    color: "#111827",
  },
  linenSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  linenSummaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  linenSummaryText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  noLinensContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#f0fdf4",
    padding: 16,
    borderRadius: 10,
  },
  noLinensText: {
    fontSize: 14,
    color: "#166534",
    fontWeight: "500",
  },
  notesBox: {
    backgroundColor: "#fffbeb",
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#fbbf24",
  },
  notesText: {
    fontSize: 14,
    color: "#78350f",
    lineHeight: 20,
  },
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#f9fafb",
    padding: 14,
    borderRadius: 12,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  clientAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  clientContact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clientPhone: {
    fontSize: 14,
    color: "#6b7280",
  },
  bottomPadding: {
    height: 40,
  },
  // Decline button and modal styles
  assignmentDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "500",
  },
  declineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#dc2626",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  reasonInputContainer: {
    marginBottom: 20,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  reasonInput: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  cancelModalButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  confirmDeclineButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmDeclineButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default BusinessOwnerJobDetails;
