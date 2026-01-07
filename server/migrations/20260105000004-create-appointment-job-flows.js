"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("AppointmentJobFlows", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      appointmentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "UserAppointments",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      customJobFlowId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "CustomJobFlows",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "NULL for marketplace jobs or jobs without a custom flow",
      },
      usesPlatformFlow: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "True for marketplace jobs - enforces platform requirements",
      },
      checklistSnapshotData: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Frozen copy of checklist at assignment time",
      },
      checklistProgress: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Tracks completion progress per section/item",
      },
      checklistCompleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      photoRequirement: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "optional",
        comment: "required, optional, hidden, platform_required",
      },
      beforePhotoCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      afterPhotoCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      photosCompleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "True when both before and after photos uploaded",
      },
      employeeNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Notes added by employee during job",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Index for querying by appointment (unique - one flow per appointment)
    await queryInterface.addIndex("AppointmentJobFlows", ["appointmentId"], {
      name: "idx_appointment_job_flows_appointment",
      unique: true,
    });

    // Index for querying by custom flow
    await queryInterface.addIndex("AppointmentJobFlows", ["customJobFlowId"], {
      name: "idx_appointment_job_flows_custom_flow",
    });

    // Index for marketplace/platform flow jobs
    await queryInterface.addIndex("AppointmentJobFlows", ["usesPlatformFlow"], {
      name: "idx_appointment_job_flows_platform",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("AppointmentJobFlows", "idx_appointment_job_flows_platform");
    await queryInterface.removeIndex("AppointmentJobFlows", "idx_appointment_job_flows_custom_flow");
    await queryInterface.removeIndex("AppointmentJobFlows", "idx_appointment_job_flows_appointment");
    await queryInterface.dropTable("AppointmentJobFlows");
  },
};
