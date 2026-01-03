module.exports = (sequelize, DataTypes) => {
  const RecurringSchedule = sequelize.define("RecurringSchedule", {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    // === Relationships ===
    cleanerClientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    homeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cleanerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // === Schedule configuration ===
    frequency: {
      type: DataTypes.ENUM("weekly", "biweekly", "monthly"),
      allowNull: false,
    },
    dayOfWeek: {
      type: DataTypes.INTEGER, // 0-6, 0=Sunday
      allowNull: false,
      validate: {
        min: 0,
        max: 6,
      },
    },
    timeWindow: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "anytime",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    // === Date range ===
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true, // null = ongoing indefinitely
    },
    nextScheduledDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    lastGeneratedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    // === Status ===
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    isPaused: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    pausedUntil: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    pauseReason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  });

  // Helper to calculate the next occurrence based on frequency
  RecurringSchedule.prototype.calculateNextDate = function (fromDate = new Date()) {
    const dayOfWeek = this.dayOfWeek;
    const frequency = this.frequency;

    // Start from fromDate
    let nextDate = new Date(fromDate);
    nextDate.setHours(0, 0, 0, 0);

    // Find next occurrence of dayOfWeek
    const currentDay = nextDate.getDay();
    let daysUntilNext = dayOfWeek - currentDay;
    if (daysUntilNext <= 0) {
      daysUntilNext += 7; // Next week
    }
    nextDate.setDate(nextDate.getDate() + daysUntilNext);

    // If this is after lastGeneratedDate, we may need to skip based on frequency
    if (this.lastGeneratedDate) {
      const lastGen = new Date(this.lastGeneratedDate);
      const daysDiff = Math.floor((nextDate - lastGen) / (1000 * 60 * 60 * 24));

      if (frequency === "biweekly" && daysDiff < 14) {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (frequency === "monthly") {
        // For monthly, find same day of week in next month
        const lastMonth = lastGen.getMonth();
        const nextMonth = nextDate.getMonth();
        if (lastMonth === nextMonth ||
            (nextMonth === (lastMonth + 1) % 12 && nextDate.getDate() < lastGen.getDate())) {
          // Move to next month
          nextDate.setMonth(nextDate.getMonth() + 1);
          // Find the first occurrence of dayOfWeek in that month
          nextDate.setDate(1);
          while (nextDate.getDay() !== dayOfWeek) {
            nextDate.setDate(nextDate.getDate() + 1);
          }
        }
      }
    }

    // Check if beyond endDate
    if (this.endDate && nextDate > new Date(this.endDate)) {
      return null;
    }

    return nextDate;
  };

  // Define associations
  RecurringSchedule.associate = (models) => {
    RecurringSchedule.belongsTo(models.CleanerClient, {
      foreignKey: "cleanerClientId",
      as: "cleanerClient",
    });
    RecurringSchedule.belongsTo(models.UserHomes, {
      foreignKey: "homeId",
      as: "home",
    });
    RecurringSchedule.belongsTo(models.User, {
      foreignKey: "cleanerId",
      as: "cleaner",
    });
    RecurringSchedule.belongsTo(models.User, {
      foreignKey: "clientId",
      as: "client",
    });
    RecurringSchedule.hasMany(models.UserAppointments, {
      foreignKey: "recurringScheduleId",
      as: "appointments",
    });
  };

  return RecurringSchedule;
};
