"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add bookedByCleanerId - indicates this appointment was booked by a cleaner for their client
    await queryInterface.addColumn("UserAppointments", "bookedByCleanerId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Add recurringScheduleId - links to the recurring schedule that generated this appointment
    await queryInterface.addColumn("UserAppointments", "recurringScheduleId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "RecurringSchedules",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    // Add autoPayEnabled - whether to auto-charge when complete
    await queryInterface.addColumn("UserAppointments", "autoPayEnabled", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    // Add indexes
    await queryInterface.addIndex("UserAppointments", ["bookedByCleanerId"], {
      name: "appointments_booked_by_cleaner_idx",
    });
    await queryInterface.addIndex("UserAppointments", ["recurringScheduleId"], {
      name: "appointments_recurring_schedule_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("UserAppointments", "appointments_recurring_schedule_idx");
    await queryInterface.removeIndex("UserAppointments", "appointments_booked_by_cleaner_idx");
    await queryInterface.removeColumn("UserAppointments", "autoPayEnabled");
    await queryInterface.removeColumn("UserAppointments", "recurringScheduleId");
    await queryInterface.removeColumn("UserAppointments", "bookedByCleanerId");
  },
};
