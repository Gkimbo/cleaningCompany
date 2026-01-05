import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { offlineSchema } from "./schema";
import migrations from "./migrations";
import OfflineJob from "./models/OfflineJob";
import OfflinePhoto from "./models/OfflinePhoto";
import OfflineChecklistItem from "./models/OfflineChecklistItem";
import SyncQueue from "./models/SyncQueue";
import SyncConflict from "./models/SyncConflict";
// Business Owner models
import OfflineEmployee from "./models/OfflineEmployee";
import OfflineOwnerAssignment from "./models/OfflineOwnerAssignment";
import OfflineDashboardCache from "./models/OfflineDashboardCache";
// Messaging
import OfflineMessage from "./models/OfflineMessage";

// Create the SQLite adapter
const adapter = new SQLiteAdapter({
  schema: offlineSchema,
  migrations,
  // React Native SQLite location
  dbName: "cleaningapp_offline",
  // Enable WAL mode for better performance
  jsi: true,
  onSetUpError: (error) => {
    console.error("WatermelonDB setup error:", error);
  },
});

// Create the database instance
const database = new Database({
  adapter,
  modelClasses: [
    OfflineJob,
    OfflinePhoto,
    OfflineChecklistItem,
    SyncQueue,
    SyncConflict,
    // Business Owner models
    OfflineEmployee,
    OfflineOwnerAssignment,
    OfflineDashboardCache,
    // Messaging
    OfflineMessage,
  ],
});

// Export collections for direct access
export const offlineJobsCollection = database.get("offline_jobs");
export const offlinePhotosCollection = database.get("offline_photos");
export const offlineChecklistItemsCollection = database.get("offline_checklist_items");
export const syncQueueCollection = database.get("sync_queue");
export const syncConflictsCollection = database.get("sync_conflicts");
// Business Owner collections
export const offlineEmployeesCollection = database.get("offline_employees");
export const offlineOwnerAssignmentsCollection = database.get("offline_owner_assignments");
export const offlineDashboardCacheCollection = database.get("offline_dashboard_cache");
// Messaging collection
export const offlineMessagesCollection = database.get("offline_messages");

// Export the database instance
export default database;

// Utility function to reset the database (for testing/debugging)
export async function resetDatabase() {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
}

// Get pending sync count
export async function getPendingSyncCount() {
  const pending = await syncQueueCollection
    .query()
    .fetch();
  return pending.filter((op) => op.status === "pending" || op.status === "failed").length;
}

// Get all jobs requiring sync
export async function getJobsRequiringSync() {
  return await offlineJobsCollection
    .query()
    .fetch()
    .then((jobs) => jobs.filter((job) => job.requiresSync));
}
