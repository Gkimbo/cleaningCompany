import { schemaMigrations, createTable, addColumns } from "@nozbe/watermelondb/Schema/migrations";

// Define migrations for schema updates
export default schemaMigrations({
  migrations: [
    // Version 2: Add business owner tables
    {
      toVersion: 2,
      steps: [
        createTable({
          name: "offline_employees",
          columns: [
            { name: "server_id", type: "number", isIndexed: true },
            { name: "user_id", type: "number", isOptional: true },
            { name: "email", type: "string" },
            { name: "status", type: "string", isIndexed: true },
            { name: "employee_data", type: "string" },
            { name: "created_at", type: "number" },
            { name: "updated_at", type: "number" },
          ],
        }),
        createTable({
          name: "offline_owner_assignments",
          columns: [
            { name: "server_id", type: "number", isIndexed: true },
            { name: "appointment_id", type: "number", isIndexed: true },
            { name: "employee_id", type: "number", isIndexed: true },
            { name: "status", type: "string", isIndexed: true },
            { name: "scheduled_date", type: "number", isIndexed: true },
            { name: "assignment_data", type: "string" },
            { name: "created_at", type: "number" },
            { name: "updated_at", type: "number" },
          ],
        }),
        createTable({
          name: "offline_dashboard_cache",
          columns: [
            { name: "cache_key", type: "string", isIndexed: true },
            { name: "data", type: "string" },
            { name: "cached_at", type: "number" },
            { name: "expires_at", type: "number" },
          ],
        }),
      ],
    },
    // Version 3: Add offline messages table
    {
      toVersion: 3,
      steps: [
        createTable({
          name: "offline_messages",
          columns: [
            { name: "server_id", type: "number", isOptional: true },
            { name: "job_id", type: "string", isIndexed: true },
            { name: "appointment_id", type: "number", isOptional: true },
            { name: "recipient_id", type: "number", isOptional: true },
            { name: "message_type", type: "string" },
            { name: "content", type: "string" },
            { name: "status", type: "string", isIndexed: true },
            { name: "created_at", type: "number" },
            { name: "synced_at", type: "number", isOptional: true },
          ],
        }),
      ],
    },
    // Version 4: Add is_not_applicable column to offline_photos for pass verification
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: "offline_photos",
          columns: [
            { name: "is_not_applicable", type: "boolean", isOptional: true },
          ],
        }),
      ],
    },
  ],
});
