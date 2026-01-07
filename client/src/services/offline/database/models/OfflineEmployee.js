import { Model } from "@nozbe/watermelondb";
import { field, date, readonly, json } from "@nozbe/watermelondb/decorators";

/**
 * OfflineEmployee - WatermelonDB model for cached employee data
 *
 * Used by business owners to view their employees offline.
 * This is read-only cache data that syncs from the server.
 */
export default class OfflineEmployee extends Model {
  static table = "offline_employees";

  @field("server_id") serverId;
  @field("user_id") userId;
  @field("email") email;
  @field("status") status;

  @json("employee_data", (raw) => raw || {}) employeeData;

  @readonly @date("created_at") createdAt;
  @date("updated_at") updatedAt;

  // Computed properties from employeeData
  get name() {
    const data = this.employeeData;
    if (data.user?.firstName || data.user?.lastName) {
      return `${data.user.firstName || ""} ${data.user.lastName || ""}`.trim();
    }
    return data.name || this.email;
  }

  get phone() {
    return this.employeeData.user?.phone || this.employeeData.phone || null;
  }

  get hourlyRate() {
    return this.employeeData.hourlyRate || 0;
  }

  get isActive() {
    return this.status === "active";
  }

  get isPendingInvite() {
    return this.status === "pending_invite";
  }

  get formattedStatus() {
    switch (this.status) {
      case "pending_invite":
        return "Pending Invite";
      case "active":
        return "Active";
      case "inactive":
        return "Inactive";
      case "terminated":
        return "Terminated";
      default:
        return this.status;
    }
  }
}
