import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const offlineSchema = appSchema({
  version: 4,
  tables: [
    tableSchema({
      name: "offline_jobs",
      columns: [
        { name: "server_id", type: "number", isIndexed: true },
        { name: "appointment_id", type: "number", isIndexed: true },
        { name: "status", type: "string", isIndexed: true },
        { name: "job_data", type: "string" }, // JSON stringified
        { name: "started_at", type: "number", isOptional: true },
        { name: "completed_at", type: "number", isOptional: true },
        { name: "start_latitude", type: "number", isOptional: true },
        { name: "start_longitude", type: "number", isOptional: true },
        { name: "checklist_progress", type: "string", isOptional: true }, // JSON stringified
        { name: "requires_sync", type: "boolean" },
        { name: "locked", type: "boolean" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "offline_photos",
      columns: [
        { name: "job_id", type: "string", isIndexed: true },
        { name: "photo_type", type: "string" }, // before, after, passes
        { name: "room", type: "string" },
        { name: "local_uri", type: "string" },
        { name: "watermark_data", type: "string", isOptional: true }, // JSON stringified
        { name: "uploaded", type: "boolean" },
        { name: "upload_attempts", type: "number" },
        { name: "is_not_applicable", type: "boolean", isOptional: true }, // For passes marked as N/A
        { name: "created_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "offline_checklist_items",
      columns: [
        { name: "job_id", type: "string", isIndexed: true },
        { name: "item_id", type: "number" },
        { name: "room", type: "string" },
        { name: "description", type: "string" },
        { name: "completed", type: "boolean" },
        { name: "completed_at", type: "number", isOptional: true },
        { name: "created_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "sync_queue",
      columns: [
        { name: "job_id", type: "string", isIndexed: true },
        { name: "operation_type", type: "string" }, // start, accuracy, before_photo, checklist, after_photo, complete
        { name: "sequence_number", type: "number", isIndexed: true },
        { name: "payload", type: "string", isOptional: true }, // JSON stringified
        { name: "status", type: "string", isIndexed: true }, // pending, in_progress, completed, failed
        { name: "attempts", type: "number" },
        { name: "last_error", type: "string", isOptional: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "sync_conflicts",
      columns: [
        { name: "job_id", type: "string", isIndexed: true },
        { name: "conflict_type", type: "string" }, // cancellation, multi_cleaner, data_mismatch
        { name: "local_data", type: "string" }, // JSON stringified
        { name: "server_data", type: "string" }, // JSON stringified
        { name: "resolution", type: "string", isOptional: true }, // local_wins, server_wins, merged
        { name: "resolved", type: "boolean" },
        { name: "created_at", type: "number" },
        { name: "resolved_at", type: "number", isOptional: true },
      ],
    }),
    // Business Owner tables (for offline caching)
    tableSchema({
      name: "offline_employees",
      columns: [
        { name: "server_id", type: "number", isIndexed: true },
        { name: "user_id", type: "number", isOptional: true },
        { name: "email", type: "string" },
        { name: "status", type: "string", isIndexed: true }, // pending_invite, active, inactive, terminated
        { name: "employee_data", type: "string" }, // JSON stringified (name, phone, hourlyRate, etc.)
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "offline_owner_assignments",
      columns: [
        { name: "server_id", type: "number", isIndexed: true },
        { name: "appointment_id", type: "number", isIndexed: true },
        { name: "employee_id", type: "number", isIndexed: true },
        { name: "status", type: "string", isIndexed: true },
        { name: "scheduled_date", type: "number", isIndexed: true },
        { name: "assignment_data", type: "string" }, // JSON stringified (full assignment details)
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "offline_dashboard_cache",
      columns: [
        { name: "cache_key", type: "string", isIndexed: true }, // dashboard, calendar_YYYY_MM, etc.
        { name: "data", type: "string" }, // JSON stringified
        { name: "cached_at", type: "number" },
        { name: "expires_at", type: "number" },
      ],
    }),
    // Offline messages and job notes
    tableSchema({
      name: "offline_messages",
      columns: [
        { name: "server_id", type: "number", isOptional: true }, // null until synced
        { name: "job_id", type: "string", isIndexed: true }, // local job ID
        { name: "appointment_id", type: "number", isOptional: true },
        { name: "recipient_id", type: "number", isOptional: true }, // null for job notes
        { name: "message_type", type: "string" }, // job_note, draft_message, coworker_message
        { name: "content", type: "string" },
        { name: "status", type: "string", isIndexed: true }, // draft, pending_sync, synced, failed
        { name: "created_at", type: "number" },
        { name: "synced_at", type: "number", isOptional: true },
      ],
    }),
  ],
});
