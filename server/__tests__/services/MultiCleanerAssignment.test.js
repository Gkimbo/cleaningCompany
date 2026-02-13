/**
 * Multi-Cleaner Assignment Tests
 * Tests for assigning multiple cleaners (employees + business owner) to a single job
 * with adjusted duration and pay calculations
 */

describe("Multi-Cleaner Assignment Logic", () => {
  describe("Duration Adjustment Calculations", () => {
    // Helper function that mirrors the frontend calculation
    // Rounds up to nearest 0.5 hour increment
    const roundToHalfHour = (hours) => Math.ceil(hours * 2) / 2;

    const calculateAdjustedDuration = (baseDuration, numCleaners) => {
      if (numCleaners <= 1) return baseDuration;
      const rawDuration = baseDuration / numCleaners;
      return roundToHalfHour(rawDuration);
    };

    it("should not adjust duration for single cleaner", () => {
      const baseDuration = 2;
      const result = calculateAdjustedDuration(baseDuration, 1);
      expect(result).toBe(2);
    });

    it("should halve duration for 2 cleaners", () => {
      const baseDuration = 2;
      const result = calculateAdjustedDuration(baseDuration, 2);
      expect(result).toBe(1);
    });

    it("should reduce duration to 1 hour for 3 cleaners on 3 hour job", () => {
      const baseDuration = 3;
      const result = calculateAdjustedDuration(baseDuration, 3);
      expect(result).toBe(1);
    });

    it("should round up fractional results to nearest 0.5", () => {
      // 2 hours / 3 cleaners = 0.667 hours → rounds up to 1.0 hour
      const baseDuration = 2;
      const result = calculateAdjustedDuration(baseDuration, 3);
      expect(result).toBe(1);
    });

    it("should handle 4 cleaners on a 2 hour job", () => {
      const baseDuration = 2;
      const result = calculateAdjustedDuration(baseDuration, 4);
      expect(result).toBe(0.5);
    });

    it("should round 0.7 hours up to 1 hour", () => {
      // Direct test of rounding
      expect(roundToHalfHour(0.7)).toBe(1);
    });

    it("should round 1.1 hours up to 1.5 hours", () => {
      expect(roundToHalfHour(1.1)).toBe(1.5);
    });

    it("should keep exact 0.5 increments unchanged", () => {
      expect(roundToHalfHour(0.5)).toBe(0.5);
      expect(roundToHalfHour(1.0)).toBe(1.0);
      expect(roundToHalfHour(1.5)).toBe(1.5);
      expect(roundToHalfHour(2.0)).toBe(2.0);
    });

    it("should round 0.3 hours up to 0.5 hours", () => {
      expect(roundToHalfHour(0.3)).toBe(0.5);
    });

    it("should round 0.51 hours up to 1 hour", () => {
      expect(roundToHalfHour(0.51)).toBe(1);
    });
  });

  describe("Employee Pay Calculations with Adjusted Hours", () => {
    // Helper function that mirrors the frontend calculation
    const calculateEmployeePayWithAdjustedHours = (employee, jobPrice, hours) => {
      if (!employee) return { amount: 0, payType: "flat_rate" };

      const empPayType = employee.payType || "per_job";

      switch (empPayType) {
        case "hourly":
          const hourlyRate = employee.defaultHourlyRate || 0;
          return {
            amount: Math.round(hourlyRate * hours),
            payType: "hourly",
          };
        case "percentage":
          const percentage = parseFloat(employee.payRate) || 0;
          const calculatedPay = Math.round((percentage / 100) * (jobPrice || 0));
          return {
            amount: calculatedPay,
            payType: "percentage",
          };
        case "per_job":
        case "flat_rate":
        default:
          const jobRate = employee.defaultJobRate || 0;
          return {
            amount: jobRate,
            payType: "flat_rate",
          };
      }
    };

    describe("Hourly Pay Type", () => {
      const hourlyEmployee = {
        id: 1,
        payType: "hourly",
        defaultHourlyRate: 2000, // $20/hour in cents
      };

      it("should calculate full pay for single cleaner (2 hours)", () => {
        const result = calculateEmployeePayWithAdjustedHours(hourlyEmployee, 15000, 2);
        expect(result.amount).toBe(4000); // $40 (2 hours × $20)
        expect(result.payType).toBe("hourly");
      });

      it("should calculate half pay for 2 cleaners (1 hour each)", () => {
        const result = calculateEmployeePayWithAdjustedHours(hourlyEmployee, 15000, 1);
        expect(result.amount).toBe(2000); // $20 (1 hour × $20)
      });

      it("should calculate pay for 3 cleaners with rounded hours", () => {
        // 2 hours / 3 cleaners = 0.667 hours → rounds up to 1 hour
        const adjustedHours = 1; // After rounding
        const result = calculateEmployeePayWithAdjustedHours(hourlyEmployee, 15000, adjustedHours);
        expect(result.amount).toBe(2000); // $20 (1 hour × $20)
      });

      it("should handle $0 hourly rate", () => {
        const zeroRateEmployee = { ...hourlyEmployee, defaultHourlyRate: 0 };
        const result = calculateEmployeePayWithAdjustedHours(zeroRateEmployee, 15000, 2);
        expect(result.amount).toBe(0);
      });
    });

    describe("Flat Rate Pay Type", () => {
      const flatRateEmployee = {
        id: 2,
        payType: "flat_rate",
        defaultJobRate: 5000, // $50 per job
      };

      it("should return same flat rate regardless of hours", () => {
        const result1 = calculateEmployeePayWithAdjustedHours(flatRateEmployee, 15000, 2);
        const result2 = calculateEmployeePayWithAdjustedHours(flatRateEmployee, 15000, 1);
        const result3 = calculateEmployeePayWithAdjustedHours(flatRateEmployee, 15000, 0.5);

        expect(result1.amount).toBe(5000);
        expect(result2.amount).toBe(5000);
        expect(result3.amount).toBe(5000);
        expect(result1.payType).toBe("flat_rate");
      });

      it("should handle per_job as alias for flat_rate", () => {
        const perJobEmployee = { ...flatRateEmployee, payType: "per_job" };
        const result = calculateEmployeePayWithAdjustedHours(perJobEmployee, 15000, 2);
        expect(result.amount).toBe(5000);
        expect(result.payType).toBe("flat_rate");
      });
    });

    describe("Percentage Pay Type", () => {
      const percentageEmployee = {
        id: 3,
        payType: "percentage",
        payRate: 40, // 40% of job price
      };

      it("should calculate percentage of job price (not affected by hours)", () => {
        const jobPrice = 15000; // $150
        const result1 = calculateEmployeePayWithAdjustedHours(percentageEmployee, jobPrice, 2);
        const result2 = calculateEmployeePayWithAdjustedHours(percentageEmployee, jobPrice, 1);

        expect(result1.amount).toBe(6000); // 40% of $150 = $60
        expect(result2.amount).toBe(6000); // Same regardless of hours
        expect(result1.payType).toBe("percentage");
      });

      it("should handle decimal percentages", () => {
        const decimalPercentEmployee = { ...percentageEmployee, payRate: 33.5 };
        const result = calculateEmployeePayWithAdjustedHours(decimalPercentEmployee, 20000, 2);
        expect(result.amount).toBe(6700); // 33.5% of $200 = $67
      });
    });

    describe("Edge Cases", () => {
      it("should handle null employee", () => {
        const result = calculateEmployeePayWithAdjustedHours(null, 15000, 2);
        expect(result.amount).toBe(0);
        expect(result.payType).toBe("flat_rate");
      });

      it("should handle undefined payType (defaults to per_job)", () => {
        const noPayTypeEmployee = { id: 4, defaultJobRate: 4000 };
        const result = calculateEmployeePayWithAdjustedHours(noPayTypeEmployee, 15000, 2);
        expect(result.amount).toBe(4000);
        expect(result.payType).toBe("flat_rate");
      });

      it("should handle zero job price", () => {
        const percentageEmployee = { id: 5, payType: "percentage", payRate: 40 };
        const result = calculateEmployeePayWithAdjustedHours(percentageEmployee, 0, 2);
        expect(result.amount).toBe(0);
      });
    });
  });

  describe("Total Cleaner Count Calculation", () => {
    const calculateTotalCleaners = (selectedEmployees, includeSelf) => {
      return selectedEmployees.length + (includeSelf ? 1 : 0);
    };

    it("should count only employees when owner not included", () => {
      const employees = [{ id: 1 }, { id: 2 }];
      expect(calculateTotalCleaners(employees, false)).toBe(2);
    });

    it("should include owner in count when selected", () => {
      const employees = [{ id: 1 }, { id: 2 }];
      expect(calculateTotalCleaners(employees, true)).toBe(3);
    });

    it("should return 1 when only owner is selected", () => {
      expect(calculateTotalCleaners([], true)).toBe(1);
    });

    it("should return 0 when nothing selected", () => {
      expect(calculateTotalCleaners([], false)).toBe(0);
    });
  });

  describe("Profit Calculation with Multiple Cleaners", () => {
    const calculateProfit = (jobPrice, platformFeePercent, totalEmployeePay) => {
      const platformFee = Math.round(jobPrice * (platformFeePercent / 100));
      return jobPrice - platformFee - totalEmployeePay;
    };

    it("should calculate profit for single employee", () => {
      const jobPrice = 15000; // $150
      const platformFeePercent = 10;
      const employeePay = 5000; // $50

      const profit = calculateProfit(jobPrice, platformFeePercent, employeePay);
      // $150 - $15 (10% fee) - $50 = $85
      expect(profit).toBe(8500);
    });

    it("should calculate profit with multiple employees (adjusted pay)", () => {
      const jobPrice = 15000; // $150
      const platformFeePercent = 10;
      // 2 hourly employees at $20/hr, job takes 1 hour each (adjusted from 2 hours)
      const employee1Pay = 2000; // $20
      const employee2Pay = 2000; // $20
      const totalEmployeePay = employee1Pay + employee2Pay;

      const profit = calculateProfit(jobPrice, platformFeePercent, totalEmployeePay);
      // $150 - $15 (10% fee) - $40 = $95
      expect(profit).toBe(9500);
    });

    it("should calculate higher profit when owner cleans with employee", () => {
      const jobPrice = 15000; // $150
      const platformFeePercent = 10;
      // 1 employee at $20/hr for 1 hour (adjusted from 2 hours because owner helps)
      // Owner pays nothing
      const employeePay = 2000; // $20
      const ownerPay = 0;
      const totalPay = employeePay + ownerPay;

      const profit = calculateProfit(jobPrice, platformFeePercent, totalPay);
      // $150 - $15 (10% fee) - $20 = $115
      expect(profit).toBe(11500);
    });

    it("should calculate full profit when owner cleans alone", () => {
      const jobPrice = 15000; // $150
      const platformFeePercent = 10;
      const ownerPay = 0;

      const profit = calculateProfit(jobPrice, platformFeePercent, ownerPay);
      // $150 - $15 (10% fee) - $0 = $135
      expect(profit).toBe(13500);
    });
  });

  describe("Multi-Assignment Data Structure", () => {
    // Helper to round to nearest 0.5 hour
    const roundToHalfHour = (hours) => Math.ceil(hours * 2) / 2;

    const buildAssignments = (selectedEmployees, includeSelf, appointmentId, baseDuration, numCleaners) => {
      const rawDuration = numCleaners > 1 ? baseDuration / numCleaners : baseDuration;
      const adjustedDuration = roundToHalfHour(rawDuration);

      const calculatePay = (emp) => {
        if (emp.payType === "hourly") {
          return Math.round(emp.defaultHourlyRate * adjustedDuration);
        }
        return emp.defaultJobRate || 0;
      };

      const assignments = selectedEmployees.map((emp) => ({
        appointmentId,
        employeeId: emp.id,
        payAmount: calculatePay(emp),
        payType: emp.payType || "flat_rate",
        isSelfAssign: false,
      }));

      if (includeSelf) {
        assignments.push({
          appointmentId,
          employeeId: null,
          payAmount: 0,
          payType: "none",
          isSelfAssign: true,
        });
      }

      return assignments;
    };

    it("should build correct structure for employees only", () => {
      const employees = [
        { id: 1, payType: "flat_rate", defaultJobRate: 5000 },
        { id: 2, payType: "flat_rate", defaultJobRate: 4000 },
      ];
      const assignments = buildAssignments(employees, false, 100, 2, 2);

      expect(assignments).toHaveLength(2);
      expect(assignments[0]).toEqual({
        appointmentId: 100,
        employeeId: 1,
        payAmount: 5000,
        payType: "flat_rate",
        isSelfAssign: false,
      });
      expect(assignments[1]).toEqual({
        appointmentId: 100,
        employeeId: 2,
        payAmount: 4000,
        payType: "flat_rate",
        isSelfAssign: false,
      });
    });

    it("should include owner self-assignment when selected", () => {
      const employees = [{ id: 1, payType: "flat_rate", defaultJobRate: 5000 }];
      const assignments = buildAssignments(employees, true, 100, 2, 2);

      expect(assignments).toHaveLength(2);
      expect(assignments[1]).toEqual({
        appointmentId: 100,
        employeeId: null,
        payAmount: 0,
        payType: "none",
        isSelfAssign: true,
      });
    });

    it("should build owner-only assignment", () => {
      const assignments = buildAssignments([], true, 100, 2, 1);

      expect(assignments).toHaveLength(1);
      expect(assignments[0]).toEqual({
        appointmentId: 100,
        employeeId: null,
        payAmount: 0,
        payType: "none",
        isSelfAssign: true,
      });
    });

    it("should calculate adjusted hourly pay in assignments", () => {
      const employees = [
        { id: 1, payType: "hourly", defaultHourlyRate: 2000 },
        { id: 2, payType: "hourly", defaultHourlyRate: 2500 },
      ];
      // 2 cleaners on a 2-hour job = 1 hour each
      const assignments = buildAssignments(employees, false, 100, 2, 2);

      expect(assignments[0].payAmount).toBe(2000); // $20/hr × 1 hr
      expect(assignments[1].payAmount).toBe(2500); // $25/hr × 1 hr
    });

    it("should calculate adjusted hourly pay with owner included", () => {
      const employees = [{ id: 1, payType: "hourly", defaultHourlyRate: 2000 }];
      // 2 cleaners (1 employee + owner) on a 2-hour job = 1 hour each
      const assignments = buildAssignments(employees, true, 100, 2, 2);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].payAmount).toBe(2000); // $20/hr × 1 hr
      expect(assignments[1].payAmount).toBe(0); // Owner pays nothing
    });

    it("should round up hours for 3 cleaners on 2 hour job", () => {
      const employees = [
        { id: 1, payType: "hourly", defaultHourlyRate: 2000 },
        { id: 2, payType: "hourly", defaultHourlyRate: 2000 },
        { id: 3, payType: "hourly", defaultHourlyRate: 2000 },
      ];
      // 3 cleaners on a 2-hour job = 0.667 hours each → rounds to 1 hour
      const assignments = buildAssignments(employees, false, 100, 2, 3);

      // Each employee gets 1 hour × $20/hr = $20
      expect(assignments[0].payAmount).toBe(2000);
      expect(assignments[1].payAmount).toBe(2000);
      expect(assignments[2].payAmount).toBe(2000);
    });
  });
});
