import { Model } from "@nozbe/watermelondb";
import { field, date, readonly, json } from "@nozbe/watermelondb/decorators";

/**
 * OfflineOwnerAssignment - WatermelonDB model for cached assignment data
 *
 * Used by business owners to view their job assignments offline.
 * This is read-only cache data that syncs from the server.
 */
export default class OfflineOwnerAssignment extends Model {
  static table = "offline_owner_assignments";

  @field("server_id") serverId;
  @field("appointment_id") appointmentId;
  @field("employee_id") employeeId;
  @field("status") status;
  @date("scheduled_date") scheduledDate;

  @json("assignment_data", (raw) => raw || {}) assignmentData;

  @readonly @date("created_at") createdAt;
  @date("updated_at") updatedAt;

  // Computed properties from assignmentData
  get appointment() {
    return this.assignmentData.appointment || {};
  }

  get employee() {
    return this.assignmentData.employee || {};
  }

  get employeeName() {
    const emp = this.employee;
    if (emp.user?.firstName || emp.user?.lastName) {
      return `${emp.user.firstName || ""} ${emp.user.lastName || ""}`.trim();
    }
    return emp.email || "Unassigned";
  }

  get home() {
    return this.assignmentData.home || this.appointment.home || {};
  }

  get homeowner() {
    return this.assignmentData.homeowner || this.appointment.user || {};
  }

  get payAmount() {
    return this.assignmentData.payAmount || 0;
  }

  get formattedPayAmount() {
    return `$${(this.payAmount / 100).toFixed(2)}`;
  }

  get isSelfAssignment() {
    return this.assignmentData.isSelfAssignment || false;
  }

  get formattedStatus() {
    switch (this.status) {
      case "assigned":
        return "Assigned";
      case "started":
        return "In Progress";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return this.status;
    }
  }

  get isUpcoming() {
    return this.scheduledDate && new Date(this.scheduledDate) > new Date();
  }

  get isToday() {
    if (!this.scheduledDate) return false;
    const today = new Date();
    const scheduled = new Date(this.scheduledDate);
    return (
      today.getFullYear() === scheduled.getFullYear() &&
      today.getMonth() === scheduled.getMonth() &&
      today.getDate() === scheduled.getDate()
    );
  }
}
