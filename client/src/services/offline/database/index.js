import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import Constants from "expo-constants";
import { Platform } from "react-native";
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

// Check if running in Expo Go (native modules not available)
const isExpoGo = Constants.appOwnership === "expo";

// Check if running in SSR/Node.js context (expo-router server rendering)
const isSSR = typeof window === "undefined" && Platform.OS === "web";

let database = null;

if (isSSR) {
  // Skip database initialization during server-side rendering
  console.log("WatermelonDB skipped during SSR");
} else if (isExpoGo) {
  console.warn(
    "WatermelonDB offline database is not available in Expo Go. " +
    "Use a development build for offline functionality: npx expo run:ios"
  );
} else {
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
  database = new Database({
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
}

// Export collections for direct access (null if in Expo Go)
export const offlineJobsCollection = database?.get("offline_jobs") ?? null;
export const offlinePhotosCollection = database?.get("offline_photos") ?? null;
export const offlineChecklistItemsCollection = database?.get("offline_checklist_items") ?? null;
export const syncQueueCollection = database?.get("sync_queue") ?? null;
export const syncConflictsCollection = database?.get("sync_conflicts") ?? null;
// Business Owner collections
export const offlineEmployeesCollection = database?.get("offline_employees") ?? null;
export const offlineOwnerAssignmentsCollection = database?.get("offline_owner_assignments") ?? null;
export const offlineDashboardCacheCollection = database?.get("offline_dashboard_cache") ?? null;
// Messaging collection
export const offlineMessagesCollection = database?.get("offline_messages") ?? null;

// Export the database instance (null if in Expo Go)
export default database;

// Export flag to check if offline is available
export const isOfflineAvailable = !isExpoGo && database !== null;

// Utility function to reset the database (for testing/debugging)
export async function resetDatabase() {
  if (!database) return;
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
}

// Get pending sync count
export async function getPendingSyncCount() {
  if (!syncQueueCollection) return 0;
  const pending = await syncQueueCollection
    .query()
    .fetch();
  return pending.filter((op) => op.status === "pending" || op.status === "failed").length;
}

// Get all jobs requiring sync
export async function getJobsRequiringSync() {
  if (!offlineJobsCollection) return [];
  return await offlineJobsCollection
    .query()
    .fetch()
    .then((jobs) => jobs.filter((job) => job.requiresSync));
}
