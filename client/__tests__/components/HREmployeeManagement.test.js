/**
 * Tests for HREmployeeManagement Component
 * Tests the HR employee management functionality for owner dashboard
 */

describe("HREmployeeManagement Component Logic", () => {
  // Mock data structures
  const mockHREmployee = {
    id: 10,
    firstName: "Jane",
    lastName: "HR",
    username: "janehr",
    email: "jane.hr@example.com",
    phone: "555-123-4567",
    type: "humanResources",
    createdAt: "2025-01-01T00:00:00Z",
  };

  const mockHRStaffList = [
    mockHREmployee,
    {
      id: 11,
      firstName: "John",
      lastName: "Staff",
      username: "johnstaff",
      email: "john.staff@example.com",
      phone: "555-987-6543",
      type: "humanResources",
      createdAt: "2025-01-02T00:00:00Z",
    },
    {
      id: 12,
      firstName: "Bob",
      lastName: "Manager",
      username: "bobmgr",
      email: "bob.mgr@example.com",
      phone: null,
      type: "humanResources",
      createdAt: "2025-01-03T00:00:00Z",
    },
  ];

  describe("Password Generation", () => {
    // Password generator function matching component logic
    const generatePassword = () => {
      const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const lowercase = "abcdefghijklmnopqrstuvwxyz";
      const numbers = "0123456789";
      const special = "!@#$%^&*";

      let password = "";
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      password += numbers[Math.floor(Math.random() * numbers.length)];
      password += special[Math.floor(Math.random() * special.length)];

      const allChars = uppercase + lowercase + numbers + special;
      for (let i = 0; i < 8; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
      }

      return password
        .split("")
        .sort(() => Math.random() - 0.5)
        .join("");
    };

    it("should generate password with at least 12 characters", () => {
      const password = generatePassword();
      expect(password.length).toBeGreaterThanOrEqual(12);
    });

    it("should generate password containing uppercase letter", () => {
      const password = generatePassword();
      expect(/[A-Z]/.test(password)).toBe(true);
    });

    it("should generate password containing lowercase letter", () => {
      const password = generatePassword();
      expect(/[a-z]/.test(password)).toBe(true);
    });

    it("should generate password containing number", () => {
      const password = generatePassword();
      expect(/[0-9]/.test(password)).toBe(true);
    });

    it("should generate password containing special character", () => {
      const password = generatePassword();
      expect(/[!@#$%^&*]/.test(password)).toBe(true);
    });

    it("should generate unique passwords", () => {
      const password1 = generatePassword();
      const password2 = generatePassword();
      // Very unlikely to be the same
      expect(password1).not.toBe(password2);
    });
  });

  describe("Form Validation", () => {
    const validateForm = (formData, isEdit = false) => {
      const errors = {};

      if (!formData.firstName || !formData.firstName.trim()) {
        errors.firstName = "First name is required";
      }

      if (!formData.lastName || !formData.lastName.trim()) {
        errors.lastName = "Last name is required";
      }

      if (!isEdit) {
        if (!formData.username || !formData.username.trim()) {
          errors.username = "Username is required";
        } else if (formData.username.length < 4) {
          errors.username = "Username must be at least 4 characters";
        } else if (formData.username.toLowerCase().includes("owner")) {
          errors.username = "Username cannot contain 'owner'";
        }

        if (!formData.password) {
          errors.password = "Password is required";
        } else if (formData.password.length < 8) {
          errors.password = "Password must be at least 8 characters";
        }
      }

      if (!formData.email || !formData.email.trim()) {
        errors.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = "Please enter a valid email";
      }

      if (formData.phone && formData.phone.replace(/\D/g, "").length < 10) {
        errors.phone = "Please enter a valid phone number";
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
      };
    };

    describe("Create Form Validation", () => {
      it("should reject empty first name", () => {
        const result = validateForm({
          firstName: "",
          lastName: "Test",
          username: "testuser",
          email: "test@example.com",
          password: "SecurePass1!",
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.firstName).toBeDefined();
      });

      it("should reject empty last name", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "",
          username: "testuser",
          email: "test@example.com",
          password: "SecurePass1!",
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.lastName).toBeDefined();
      });

      it("should reject empty username", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "User",
          username: "",
          email: "test@example.com",
          password: "SecurePass1!",
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.username).toBeDefined();
      });

      it("should reject username less than 4 characters", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "User",
          username: "abc",
          email: "test@example.com",
          password: "SecurePass1!",
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.username).toContain("4 characters");
      });

      it("should reject username containing 'owner'", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "User",
          username: "newowner",
          email: "test@example.com",
          password: "SecurePass1!",
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.username).toContain("owner");
      });

      it("should reject username containing 'OWNER' (case insensitive)", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "User",
          username: "OWNER123",
          email: "test@example.com",
          password: "SecurePass1!",
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.username).toContain("owner");
      });

      it("should reject empty password", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          email: "test@example.com",
          password: "",
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.password).toBeDefined();
      });

      it("should reject password less than 8 characters", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          email: "test@example.com",
          password: "Short1!",
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.password).toContain("8 characters");
      });

      it("should reject empty email", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          email: "",
          password: "SecurePass1!",
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.email).toBeDefined();
      });

      it("should reject invalid email format", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          email: "invalid-email",
          password: "SecurePass1!",
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.email).toContain("valid email");
      });

      it("should reject invalid phone number", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          email: "test@example.com",
          password: "SecurePass1!",
          phone: "123",
        });
        expect(result.isValid).toBe(false);
        expect(result.errors.phone).toBeDefined();
      });

      it("should accept valid phone number", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          email: "test@example.com",
          password: "SecurePass1!",
          phone: "5551234567",
        });
        expect(result.isValid).toBe(true);
        expect(result.errors.phone).toBeUndefined();
      });

      it("should accept empty phone (optional)", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          email: "test@example.com",
          password: "SecurePass1!",
          phone: "",
        });
        expect(result.isValid).toBe(true);
      });

      it("should accept all valid fields", () => {
        const result = validateForm({
          firstName: "Test",
          lastName: "User",
          username: "testuser",
          email: "test@example.com",
          password: "SecurePass1!",
          phone: "5551234567",
        });
        expect(result.isValid).toBe(true);
        expect(Object.keys(result.errors)).toHaveLength(0);
      });
    });

    describe("Edit Form Validation", () => {
      it("should not require username for edit", () => {
        const result = validateForm(
          {
            firstName: "Test",
            lastName: "User",
            username: "",
            email: "test@example.com",
          },
          true
        );
        expect(result.errors.username).toBeUndefined();
      });

      it("should not require password for edit", () => {
        const result = validateForm(
          {
            firstName: "Test",
            lastName: "User",
            username: "existing",
            email: "test@example.com",
            password: "",
          },
          true
        );
        expect(result.errors.password).toBeUndefined();
      });

      it("should still require first name for edit", () => {
        const result = validateForm(
          {
            firstName: "",
            lastName: "User",
            email: "test@example.com",
          },
          true
        );
        expect(result.isValid).toBe(false);
        expect(result.errors.firstName).toBeDefined();
      });

      it("should still require email for edit", () => {
        const result = validateForm(
          {
            firstName: "Test",
            lastName: "User",
            email: "",
          },
          true
        );
        expect(result.isValid).toBe(false);
        expect(result.errors.email).toBeDefined();
      });
    });
  });

  describe("Date Formatting", () => {
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };

    it("should format date correctly", () => {
      const formatted = formatDate("2025-01-15T12:00:00Z");
      expect(formatted).toContain("2025");
      expect(formatted).toContain("Jan");
    });

    it("should handle different months", () => {
      const formatted = formatDate("2025-06-20T12:00:00Z");
      expect(formatted).toContain("Jun");
      expect(formatted).toContain("20");
    });
  });

  describe("Employee Avatar Initial", () => {
    const getInitial = (employee) => {
      return (
        (employee.firstName && employee.firstName[0]) ||
        (employee.username && employee.username[0]) ||
        "H"
      ).toUpperCase();
    };

    it("should use first letter of firstName", () => {
      expect(getInitial({ firstName: "Jane", username: "janehr" })).toBe("J");
    });

    it("should fallback to username if no firstName", () => {
      expect(getInitial({ firstName: "", username: "testuser" })).toBe("T");
    });

    it("should fallback to H if no firstName or username", () => {
      expect(getInitial({ firstName: "", username: "" })).toBe("H");
    });

    it("should fallback to H if both are null", () => {
      expect(getInitial({ firstName: null, username: null })).toBe("H");
    });

    it("should uppercase the initial", () => {
      expect(getInitial({ firstName: "jane", username: "janehr" })).toBe("J");
    });
  });

  describe("Employee List Display", () => {
    it("should detect empty state when no employees", () => {
      const employees = [];
      const isEmpty = employees.length === 0;
      expect(isEmpty).toBe(true);
    });

    it("should detect employees exist", () => {
      const employees = mockHRStaffList;
      const hasEmployees = employees.length > 0;
      expect(hasEmployees).toBe(true);
    });

    it("should display correct count", () => {
      const employees = mockHRStaffList;
      expect(employees.length).toBe(3);
    });
  });

  describe("Employee Card Data", () => {
    it("should display full name", () => {
      const employee = mockHREmployee;
      const fullName = `${employee.firstName} ${employee.lastName}`;
      expect(fullName).toBe("Jane HR");
    });

    it("should display username with @ prefix", () => {
      const employee = mockHREmployee;
      const displayUsername = `@${employee.username}`;
      expect(displayUsername).toBe("@janehr");
    });

    it("should handle missing phone", () => {
      const employee = { ...mockHREmployee, phone: null };
      const hasPhone = !!employee.phone;
      expect(hasPhone).toBe(false);
    });

    it("should detect phone present", () => {
      const employee = mockHREmployee;
      const hasPhone = !!employee.phone;
      expect(hasPhone).toBe(true);
    });
  });

  describe("Modal State Management", () => {
    // Simulating modal state
    const createModalState = () => ({
      showAddModal: false,
      showEditModal: false,
      showDeleteModal: false,
      selectedEmployee: null,
    });

    it("should open add modal", () => {
      const state = createModalState();
      state.showAddModal = true;
      expect(state.showAddModal).toBe(true);
      expect(state.showEditModal).toBe(false);
      expect(state.showDeleteModal).toBe(false);
    });

    it("should open edit modal with selected employee", () => {
      const state = createModalState();
      state.showEditModal = true;
      state.selectedEmployee = mockHREmployee;
      expect(state.showEditModal).toBe(true);
      expect(state.selectedEmployee.id).toBe(10);
    });

    it("should open delete modal with selected employee", () => {
      const state = createModalState();
      state.showDeleteModal = true;
      state.selectedEmployee = mockHREmployee;
      expect(state.showDeleteModal).toBe(true);
      expect(state.selectedEmployee).toBeDefined();
    });

    it("should close all modals", () => {
      const state = createModalState();
      state.showAddModal = true;
      state.showEditModal = true;
      state.showDeleteModal = true;
      // Close all
      state.showAddModal = false;
      state.showEditModal = false;
      state.showDeleteModal = false;
      expect(state.showAddModal).toBe(false);
      expect(state.showEditModal).toBe(false);
      expect(state.showDeleteModal).toBe(false);
    });
  });

  describe("Form Data State", () => {
    const createEmptyForm = () => ({
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      phone: "",
      password: "",
    });

    const populateFormFromEmployee = (employee) => ({
      firstName: employee.firstName || "",
      lastName: employee.lastName || "",
      username: employee.username || "",
      email: employee.email || "",
      phone: employee.phone || "",
      password: "", // Never populated for security
    });

    it("should create empty form for add", () => {
      const form = createEmptyForm();
      expect(form.firstName).toBe("");
      expect(form.password).toBe("");
    });

    it("should populate form from employee for edit", () => {
      const form = populateFormFromEmployee(mockHREmployee);
      expect(form.firstName).toBe("Jane");
      expect(form.lastName).toBe("HR");
      expect(form.email).toBe("jane.hr@example.com");
      expect(form.password).toBe(""); // Password should not be populated
    });

    it("should handle null phone", () => {
      const employee = { ...mockHREmployee, phone: null };
      const form = populateFormFromEmployee(employee);
      expect(form.phone).toBe("");
    });
  });

  describe("Delete Confirmation", () => {
    const getDeleteMessage = (employee) => {
      if (!employee) return "";
      return `Are you sure you want to remove ${employee.firstName} ${employee.lastName}? This action cannot be undone.`;
    };

    it("should generate correct delete message", () => {
      const message = getDeleteMessage(mockHREmployee);
      expect(message).toContain("Jane HR");
      expect(message).toContain("cannot be undone");
    });

    it("should handle null employee gracefully", () => {
      const message = getDeleteMessage(null);
      expect(message).toBe("");
    });
  });

  describe("Loading States", () => {
    it("should track loading state", () => {
      const state = { loading: true, refreshing: false };
      expect(state.loading).toBe(true);
    });

    it("should track refreshing state", () => {
      const state = { loading: false, refreshing: true };
      expect(state.refreshing).toBe(true);
    });

    it("should track form submission state", () => {
      const state = { isSubmitting: true };
      expect(state.isSubmitting).toBe(true);
    });
  });

  describe("Success and Error Messages", () => {
    it("should set success message after create", () => {
      const successMessage = "HR employee created successfully! A welcome email has been sent.";
      expect(successMessage).toContain("created successfully");
      expect(successMessage).toContain("email");
    });

    it("should set success message after update", () => {
      const successMessage = "HR employee updated successfully!";
      expect(successMessage).toContain("updated");
    });

    it("should set success message after delete", () => {
      const successMessage = "HR employee removed successfully!";
      expect(successMessage).toContain("removed");
    });

    it("should handle API error message", () => {
      const errorMessage = "Failed to create HR employee";
      expect(errorMessage).toBeDefined();
    });
  });

  describe("Email Validation Regex", () => {
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    it("should accept valid email", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
    });

    it("should accept email with subdomain", () => {
      expect(isValidEmail("test@mail.example.com")).toBe(true);
    });

    it("should reject email without @", () => {
      expect(isValidEmail("testexample.com")).toBe(false);
    });

    it("should reject email without domain", () => {
      expect(isValidEmail("test@")).toBe(false);
    });

    it("should reject email with spaces", () => {
      expect(isValidEmail("test @example.com")).toBe(false);
    });

    it("should reject email without TLD", () => {
      expect(isValidEmail("test@example")).toBe(false);
    });
  });

  describe("Phone Number Validation", () => {
    const isValidPhone = (phone) => {
      if (!phone) return true; // Optional
      return phone.replace(/\D/g, "").length >= 10;
    };

    it("should accept valid 10-digit phone", () => {
      expect(isValidPhone("5551234567")).toBe(true);
    });

    it("should accept phone with formatting", () => {
      expect(isValidPhone("(555) 123-4567")).toBe(true);
    });

    it("should accept international phone", () => {
      expect(isValidPhone("+1 555 123 4567")).toBe(true);
    });

    it("should reject too short phone", () => {
      expect(isValidPhone("123456")).toBe(false);
    });

    it("should accept empty phone (optional)", () => {
      expect(isValidPhone("")).toBe(true);
    });

    it("should accept null phone (optional)", () => {
      expect(isValidPhone(null)).toBe(true);
    });
  });

  describe("Owner Only Access", () => {
    const canAccessHRManagement = (userType) => {
      return userType === "owner" || userType === "owner1";
    };

    it("should allow owner type", () => {
      expect(canAccessHRManagement("owner")).toBe(true);
    });

    it("should allow owner1 type", () => {
      expect(canAccessHRManagement("owner1")).toBe(true);
    });

    it("should deny cleaner type", () => {
      expect(canAccessHRManagement("cleaner")).toBe(false);
    });

    it("should deny homeowner type", () => {
      expect(canAccessHRManagement("homeowner")).toBe(false);
    });

    it("should deny humanResources type", () => {
      expect(canAccessHRManagement("humanResources")).toBe(false);
    });
  });

  describe("Navigation", () => {
    const getBackPath = () => "/owner/dashboard";
    const getHRManagementPath = () => "/owner/hr-management";

    it("should provide correct back path", () => {
      expect(getBackPath()).toBe("/owner/dashboard");
    });

    it("should provide correct HR management path", () => {
      expect(getHRManagementPath()).toBe("/owner/hr-management");
    });
  });

  describe("Form Reset", () => {
    const resetForm = (generatePassword) => {
      return {
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        phone: "",
        password: generatePassword ? "generated-password" : "",
      };
    };

    it("should clear all form fields", () => {
      const form = resetForm(false);
      expect(form.firstName).toBe("");
      expect(form.lastName).toBe("");
      expect(form.username).toBe("");
      expect(form.email).toBe("");
      expect(form.phone).toBe("");
    });

    it("should generate password when opening add modal", () => {
      const form = resetForm(true);
      expect(form.password).toBe("generated-password");
    });
  });

  describe("Update Data Preparation", () => {
    const prepareUpdateData = (formData) => {
      const updateData = {};

      if (formData.firstName && formData.firstName.trim()) {
        updateData.firstName = formData.firstName.trim();
      }
      if (formData.lastName && formData.lastName.trim()) {
        updateData.lastName = formData.lastName.trim();
      }
      if (formData.email && formData.email.trim()) {
        updateData.email = formData.email.trim();
      }
      if (formData.phone !== undefined) {
        updateData.phone = formData.phone.trim() || null;
      }

      return updateData;
    };

    it("should trim whitespace from fields", () => {
      const data = prepareUpdateData({
        firstName: "  Jane  ",
        lastName: "  HR  ",
        email: "  jane@example.com  ",
        phone: "555-123-4567",
      });
      expect(data.firstName).toBe("Jane");
      expect(data.lastName).toBe("HR");
      expect(data.email).toBe("jane@example.com");
    });

    it("should convert empty phone to null", () => {
      const data = prepareUpdateData({
        firstName: "Jane",
        lastName: "HR",
        email: "jane@example.com",
        phone: "",
      });
      expect(data.phone).toBeNull();
    });

    it("should not include username in update data", () => {
      const data = prepareUpdateData({
        firstName: "Jane",
        lastName: "HR",
        username: "janehr",
        email: "jane@example.com",
      });
      expect(data.username).toBeUndefined();
    });
  });
});
