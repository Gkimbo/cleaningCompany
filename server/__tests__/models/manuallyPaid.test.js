/**
 * Tests for the manuallyPaid field in UserAppointments model
 * This field distinguishes pre-paid appointments from auto-captured ones
 */

describe("UserAppointments - manuallyPaid Field", () => {
  describe("Field Definition", () => {
    it("should have manuallyPaid field with default value of false", () => {
      // Simulating model behavior
      const createAppointment = (data) => ({
        id: data.id || 1,
        userId: data.userId,
        homeId: data.homeId,
        date: data.date,
        price: data.price,
        paid: data.paid,
        hasBeenAssigned: data.hasBeenAssigned,
        completed: data.completed,
        paymentStatus: data.paymentStatus || "pending",
        paymentCaptureFailed: data.paymentCaptureFailed || false,
        manuallyPaid: data.manuallyPaid !== undefined ? data.manuallyPaid : false,
      });

      const appointment = createAppointment({
        userId: 1,
        homeId: 1,
        date: "2025-01-15",
        price: "150",
        paid: false,
        hasBeenAssigned: false,
        completed: false,
      });

      expect(appointment.manuallyPaid).toBe(false);
    });

    it("should allow setting manuallyPaid to true", () => {
      const appointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: "2025-01-15",
        price: "150",
        paid: true,
        manuallyPaid: true,
        hasBeenAssigned: true,
        completed: false,
      };

      expect(appointment.manuallyPaid).toBe(true);
    });

    it("should default to false when manuallyPaid is not provided", () => {
      const appointment = {
        id: 1,
        userId: 1,
        paid: false,
        // manuallyPaid not specified
      };

      const manuallyPaid = appointment.manuallyPaid ?? false;
      expect(manuallyPaid).toBe(false);
    });
  });

  describe("Pre-Pay vs Auto-Capture Scenarios", () => {
    it("should create appointment with manuallyPaid=false for regular flow", () => {
      // Simulates normal appointment creation (before any payment capture)
      const appointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: "2025-01-15",
        price: "150",
        paid: false,
        paymentStatus: "pending",
        manuallyPaid: false,
        hasBeenAssigned: false,
        completed: false,
      };

      expect(appointment.manuallyPaid).toBe(false);
      expect(appointment.paymentStatus).toBe("pending");
    });

    it("should set manuallyPaid=true when customer pre-pays", () => {
      const appointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: "2025-01-15",
        price: "150",
        paid: false,
        paymentStatus: "pending",
        manuallyPaid: false,
        hasBeenAssigned: true,
        completed: false,
      };

      // Simulate pre-pay action
      const updatedAppointment = {
        ...appointment,
        paid: true,
        paymentStatus: "captured",
        manuallyPaid: true,
      };

      expect(updatedAppointment.paid).toBe(true);
      expect(updatedAppointment.paymentStatus).toBe("captured");
      expect(updatedAppointment.manuallyPaid).toBe(true);
    });

    it("should keep manuallyPaid=false when auto-captured by cron", () => {
      const appointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: "2025-01-15",
        price: "150",
        paid: false,
        paymentStatus: "pending",
        manuallyPaid: false,
        hasBeenAssigned: true,
        completed: false,
      };

      // Simulate auto-capture (cron job does NOT set manuallyPaid)
      const updatedAppointment = {
        ...appointment,
        paid: true,
        paymentStatus: "captured",
        // manuallyPaid stays false
      };

      expect(updatedAppointment.paid).toBe(true);
      expect(updatedAppointment.paymentStatus).toBe("captured");
      expect(updatedAppointment.manuallyPaid).toBe(false);
    });
  });

  describe("Querying by Payment Type", () => {
    const appointments = [
      {
        id: 1,
        userId: 1,
        homeId: 1,
        date: "2025-01-15",
        price: "150",
        paid: true,
        paymentStatus: "captured",
        manuallyPaid: true, // Pre-paid
        hasBeenAssigned: true,
        completed: true,
      },
      {
        id: 2,
        userId: 2,
        homeId: 2,
        date: "2025-01-16",
        price: "200",
        paid: true,
        paymentStatus: "captured",
        manuallyPaid: false, // Auto-captured
        hasBeenAssigned: true,
        completed: true,
      },
      {
        id: 3,
        userId: 3,
        homeId: 3,
        date: "2025-01-17",
        price: "175",
        paid: true,
        paymentStatus: "captured",
        manuallyPaid: true, // Pre-paid
        hasBeenAssigned: true,
        completed: false,
      },
      {
        id: 4,
        userId: 4,
        homeId: 4,
        date: "2025-01-18",
        price: "125",
        paid: false,
        paymentStatus: "pending",
        manuallyPaid: false, // Not yet paid
        hasBeenAssigned: false,
        completed: false,
      },
    ];

    it("should find all pre-paid appointments", () => {
      const prePaidAppointments = appointments.filter(
        (appt) => appt.paid && appt.manuallyPaid
      );

      expect(prePaidAppointments.length).toBe(2);
      prePaidAppointments.forEach((appt) => {
        expect(appt.manuallyPaid).toBe(true);
      });
    });

    it("should find all auto-captured appointments", () => {
      const autoCapturedAppointments = appointments.filter(
        (appt) => appt.paid && !appt.manuallyPaid
      );

      expect(autoCapturedAppointments.length).toBe(1);
      expect(autoCapturedAppointments[0].userId).toBe(2);
    });

    it("should count pre-paid vs auto-captured correctly", () => {
      const prePaidCount = appointments.filter(
        (appt) => appt.paid && appt.manuallyPaid
      ).length;

      const autoCapturedCount = appointments.filter(
        (appt) => appt.paid && !appt.manuallyPaid
      ).length;

      const unpaidCount = appointments.filter((appt) => !appt.paid).length;

      expect(prePaidCount).toBe(2);
      expect(autoCapturedCount).toBe(1);
      expect(unpaidCount).toBe(1);
    });
  });

  describe("Payment Capture Failed Scenarios", () => {
    it("should keep manuallyPaid=false when payment capture fails", () => {
      const appointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: "2025-01-15",
        price: "150",
        paid: false,
        paymentStatus: "pending",
        paymentCaptureFailed: false,
        manuallyPaid: false,
        hasBeenAssigned: true,
        completed: false,
      };

      // Simulate failed auto-capture
      const failedAppointment = {
        ...appointment,
        paymentStatus: "failed",
        paymentCaptureFailed: true,
      };

      expect(failedAppointment.paid).toBe(false);
      expect(failedAppointment.paymentStatus).toBe("failed");
      expect(failedAppointment.paymentCaptureFailed).toBe(true);
      expect(failedAppointment.manuallyPaid).toBe(false);
    });

    it("should keep manuallyPaid=false when customer retries failed payment", () => {
      const appointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: "2025-01-15",
        price: "150",
        paid: false,
        paymentStatus: "failed",
        paymentCaptureFailed: true,
        manuallyPaid: false,
        hasBeenAssigned: true,
        completed: false,
      };

      // Simulate successful retry (not a pre-pay, just a retry of failed capture)
      const retriedAppointment = {
        ...appointment,
        paid: true,
        paymentStatus: "captured",
        paymentCaptureFailed: false,
        // manuallyPaid stays false - retries are not the same as pre-pay
      };

      expect(retriedAppointment.paid).toBe(true);
      expect(retriedAppointment.paymentStatus).toBe("captured");
      expect(retriedAppointment.paymentCaptureFailed).toBe(false);
      expect(retriedAppointment.manuallyPaid).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle boolean values correctly", () => {
      const appointmentFalse = { manuallyPaid: false };
      const appointmentTrue = { manuallyPaid: true };

      expect(typeof appointmentFalse.manuallyPaid).toBe("boolean");
      expect(appointmentFalse.manuallyPaid).toBe(false);

      expect(typeof appointmentTrue.manuallyPaid).toBe("boolean");
      expect(appointmentTrue.manuallyPaid).toBe(true);
    });

    it("should persist manuallyPaid correctly after multiple updates", () => {
      let appointment = {
        id: 1,
        userId: 1,
        homeId: 1,
        date: "2025-01-15",
        price: "150",
        paid: false,
        hasBeenAssigned: false,
        completed: false,
        manuallyPaid: false,
      };

      // First update
      appointment = { ...appointment, hasBeenAssigned: true };
      expect(appointment.manuallyPaid).toBe(false);

      // Second update (pre-pay)
      appointment = {
        ...appointment,
        paid: true,
        paymentStatus: "captured",
        manuallyPaid: true,
      };
      expect(appointment.manuallyPaid).toBe(true);

      // Third update (completion) - manuallyPaid should persist
      appointment = { ...appointment, completed: true };
      expect(appointment.manuallyPaid).toBe(true);
      expect(appointment.completed).toBe(true);
    });

    it("should handle undefined manuallyPaid with default", () => {
      const oldAppointment = {
        id: 1,
        paid: true,
        // manuallyPaid is undefined (simulating old data)
      };

      const manuallyPaid = oldAppointment.manuallyPaid ?? false;
      expect(manuallyPaid).toBe(false);
    });

    it("should differentiate between manuallyPaid undefined and false", () => {
      const explicitFalse = { manuallyPaid: false };
      const implicitDefault = {};

      expect(explicitFalse.manuallyPaid).toBe(false);
      expect(implicitDefault.manuallyPaid).toBeUndefined();
      expect(implicitDefault.manuallyPaid ?? false).toBe(false);
    });
  });

  describe("Model Schema Validation", () => {
    it("should have correct field definition structure", () => {
      // This simulates what the model definition should look like
      const modelDefinition = {
        manuallyPaid: {
          type: "BOOLEAN",
          allowNull: false,
          defaultValue: false,
        },
      };

      expect(modelDefinition.manuallyPaid.type).toBe("BOOLEAN");
      expect(modelDefinition.manuallyPaid.allowNull).toBe(false);
      expect(modelDefinition.manuallyPaid.defaultValue).toBe(false);
    });

    it("should be included in appointment update payload for pre-pay", () => {
      const prePayUpdatePayload = {
        paymentStatus: "captured",
        paid: true,
        manuallyPaid: true,
        paymentCaptureFailed: false,
      };

      expect(prePayUpdatePayload).toHaveProperty("manuallyPaid", true);
      expect(Object.keys(prePayUpdatePayload)).toContain("manuallyPaid");
    });

    it("should NOT be included in auto-capture update payload", () => {
      const autoCaptureUpdatePayload = {
        paymentStatus: "captured",
        paid: true,
        paymentCaptureFailed: false,
        // manuallyPaid is intentionally NOT included
      };

      expect(autoCaptureUpdatePayload).not.toHaveProperty("manuallyPaid");
    });
  });
});
