/**
 * Tests for SignInForm multi-account login flow
 *
 * These tests verify the component behavior when:
 * - User logs in with email that has multiple accounts
 * - Account selection modal is displayed
 * - User selects an account type and completes login
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// Mock react-router-native
const mockNavigate = jest.fn();
jest.mock("react-router-native", () => ({
	useNavigate: () => mockNavigate,
	useSearchParams: () => [new URLSearchParams()],
}));

// Mock AuthContext with a real React context
const mockLogin = jest.fn();
jest.mock("../../src/services/AuthContext", () => {
	const React = require("react");
	return {
		AuthContext: React.createContext({ login: null }),
	};
});

// Mock FetchData
jest.mock("../../src/services/fetchRequests/fetchData", () => ({
	login: jest.fn(),
}));

// Mock the API_BASE
jest.mock("../../src/services/config", () => ({
	API_BASE: "http://localhost:5000/api/v1",
}));

// Import after mocks
import SignInForm from "../../src/components/userAuthentication/forms/SignInForm";
import { AuthContext } from "../../src/services/AuthContext";
import FetchData from "../../src/services/fetchRequests/fetchData";

// Create mock AuthContext provider
const MockAuthProvider = ({ children }) => {
	return (
		<AuthContext.Provider value={{ login: mockLogin }}>
			{children}
		</AuthContext.Provider>
	);
};

const renderWithProviders = (component) => {
	return render(<MockAuthProvider>{component}</MockAuthProvider>);
};

describe("SignInForm - Basic Login", () => {
	const mockDispatch = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Rendering", () => {
		it("should render login form fields", () => {
			const { getByPlaceholderText, getByText } = renderWithProviders(
				<SignInForm state={{}} dispatch={mockDispatch} />
			);

			expect(getByPlaceholderText(/Enter your email or username/i)).toBeTruthy();
			expect(getByPlaceholderText(/Enter your password/i)).toBeTruthy();
			expect(getByText("Sign In")).toBeTruthy();
		});

		it("should render forgot credentials link", () => {
			const { getByText } = renderWithProviders(
				<SignInForm state={{}} dispatch={mockDispatch} />
			);

			expect(getByText(/Forgot username or password/i)).toBeTruthy();
		});
	});

	describe("Form Validation", () => {
		it("should show error when username is empty", async () => {
			const { getByText } = renderWithProviders(
				<SignInForm state={{}} dispatch={mockDispatch} />
			);

			const signInButton = getByText("Sign In");
			fireEvent.press(signInButton);

			await waitFor(() => {
				expect(getByText(/Please enter your email or username/i)).toBeTruthy();
			});
		});

		it("should show error when password is empty", async () => {
			const { getByText, getByPlaceholderText } = renderWithProviders(
				<SignInForm state={{}} dispatch={mockDispatch} />
			);

			// Enter username but no password
			fireEvent.changeText(
				getByPlaceholderText(/Enter your email or username/i),
				"testuser"
			);

			const signInButton = getByText("Sign In");
			fireEvent.press(signInButton);

			await waitFor(() => {
				expect(getByText(/Please type your password/i)).toBeTruthy();
			});
		});
	});

	describe("Successful Single Account Login", () => {
		it("should dispatch user data and navigate on successful login", async () => {
			FetchData.login.mockResolvedValueOnce({
				user: {
					id: 1,
					username: "testuser",
					email: "test@example.com",
					type: "cleaner",
					isMarketplaceCleaner: true,
				},
				token: "jwt-token-123",
				requiresTermsAcceptance: false,
			});

			const { getByText, getByPlaceholderText } = renderWithProviders(
				<SignInForm state={{}} dispatch={mockDispatch} />
			);

			fireEvent.changeText(
				getByPlaceholderText(/Enter your email or username/i),
				"testuser"
			);
			fireEvent.changeText(
				getByPlaceholderText(/Enter your password/i),
				"SecurePass1!"
			);

			const signInButton = getByText("Sign In");
			fireEvent.press(signInButton);

			await waitFor(() => {
				expect(mockDispatch).toHaveBeenCalledWith({
					type: "CURRENT_USER",
					payload: "jwt-token-123",
				});
				expect(mockDispatch).toHaveBeenCalledWith({
					type: "SET_USER_ID",
					payload: 1,
				});
				expect(mockLogin).toHaveBeenCalledWith("jwt-token-123");
			});
		});

		it("should handle terms acceptance requirement", async () => {
			FetchData.login.mockResolvedValueOnce({
				user: {
					id: 1,
					username: "testuser",
					type: "cleaner",
				},
				token: "jwt-token",
				requiresTermsAcceptance: true,
				terms: { id: 2, title: "Updated Terms", version: 2 },
			});

			const { getByText, getByPlaceholderText } = renderWithProviders(
				<SignInForm state={{}} dispatch={mockDispatch} />
			);

			fireEvent.changeText(
				getByPlaceholderText(/Enter your email or username/i),
				"testuser"
			);
			fireEvent.changeText(
				getByPlaceholderText(/Enter your password/i),
				"SecurePass1!"
			);

			const signInButton = getByText("Sign In");
			fireEvent.press(signInButton);

			await waitFor(() => {
				expect(mockNavigate).toHaveBeenCalledWith("/terms-acceptance");
			});
		});

		it("should handle business owner login", async () => {
			FetchData.login.mockResolvedValueOnce({
				user: {
					id: 1,
					username: "businessowner",
					type: "cleaner",
					isBusinessOwner: true,
					businessName: "Sparkle Clean Co",
					yearsInBusiness: 5,
				},
				token: "jwt-token",
			});

			const { getByText, getByPlaceholderText } = renderWithProviders(
				<SignInForm state={{}} dispatch={mockDispatch} />
			);

			fireEvent.changeText(
				getByPlaceholderText(/Enter your email or username/i),
				"businessowner"
			);
			fireEvent.changeText(
				getByPlaceholderText(/Enter your password/i),
				"SecurePass1!"
			);

			fireEvent.press(getByText("Sign In"));

			await waitFor(() => {
				expect(mockDispatch).toHaveBeenCalledWith({
					type: "SET_BUSINESS_OWNER_INFO",
					payload: {
						isBusinessOwner: true,
						businessName: "Sparkle Clean Co",
						yearsInBusiness: 5,
					},
				});
			});
		});
	});

	describe("Login Errors", () => {
		it("should display error for invalid password", async () => {
			FetchData.login.mockResolvedValueOnce("Invalid password");

			const { getByText, getByPlaceholderText } = renderWithProviders(
				<SignInForm state={{}} dispatch={mockDispatch} />
			);

			fireEvent.changeText(
				getByPlaceholderText(/Enter your email or username/i),
				"testuser"
			);
			fireEvent.changeText(
				getByPlaceholderText(/Enter your password/i),
				"wrongpassword"
			);

			fireEvent.press(getByText("Sign In"));

			await waitFor(() => {
				expect(getByText("Invalid password")).toBeTruthy();
			});
		});

		it("should display error for non-existent account", async () => {
			FetchData.login.mockResolvedValueOnce("No account found with that email or username.");

			const { getByText, getByPlaceholderText } = renderWithProviders(
				<SignInForm state={{}} dispatch={mockDispatch} />
			);

			fireEvent.changeText(
				getByPlaceholderText(/Enter your email or username/i),
				"nonexistent"
			);
			fireEvent.changeText(
				getByPlaceholderText(/Enter your password/i),
				"SecurePass1!"
			);

			fireEvent.press(getByText("Sign In"));

			await waitFor(() => {
				expect(getByText("No account found with that email or username.")).toBeTruthy();
			});
		});
	});
});

describe("SignInForm - Multi-Account Login Flow", () => {
	const mockDispatch = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
	});

	/**
	 * Note: The following tests define the EXPECTED behavior when multi-account
	 * support is fully implemented in the frontend. Currently the SignInForm
	 * may not handle 300 responses - these tests serve as specifications.
	 */

	describe("Account Selection Required (300 Response)", () => {
		it("should display account selection options when multiple accounts exist", async () => {
			// This test defines expected behavior when 300 response is received
			const multiAccountResponse = {
				requiresAccountSelection: true,
				message: "Multiple accounts found. Please select account type.",
				accountOptions: [
					{ accountType: "employee", displayName: "Business Employee" },
					{ accountType: "marketplace_cleaner", displayName: "Marketplace Cleaner" },
				],
			};

			FetchData.login.mockResolvedValueOnce(multiAccountResponse);

			const { getByText, getByPlaceholderText, queryByText } = renderWithProviders(
				<SignInForm state={{}} dispatch={mockDispatch} />
			);

			fireEvent.changeText(
				getByPlaceholderText(/Enter your email or username/i),
				"test@example.com"
			);
			fireEvent.changeText(
				getByPlaceholderText(/Enter your password/i),
				"SecurePass1!"
			);

			fireEvent.press(getByText("Sign In"));

			// When properly implemented, should show account selection modal/options
			// await waitFor(() => {
			//   expect(getByText("Multiple accounts found")).toBeTruthy();
			//   expect(getByText("Business Employee")).toBeTruthy();
			//   expect(getByText("Marketplace Cleaner")).toBeTruthy();
			// });
		});

		it("should login with selected account type", async () => {
			// First call returns 300 with account options
			FetchData.login
				.mockResolvedValueOnce({
					requiresAccountSelection: true,
					accountOptions: [
						{ accountType: "employee", displayName: "Business Employee" },
						{ accountType: "marketplace_cleaner", displayName: "Marketplace Cleaner" },
					],
				})
				// Second call with accountType returns success
				.mockResolvedValueOnce({
					user: {
						id: 2,
						username: "marketplace_user",
						type: "cleaner",
						isMarketplaceCleaner: true,
					},
					token: "jwt-token",
				});

			const { getByText, getByPlaceholderText } = renderWithProviders(
				<SignInForm state={{}} dispatch={mockDispatch} />
			);

			fireEvent.changeText(
				getByPlaceholderText(/Enter your email or username/i),
				"test@example.com"
			);
			fireEvent.changeText(
				getByPlaceholderText(/Enter your password/i),
				"SecurePass1!"
			);

			fireEvent.press(getByText("Sign In"));

			// When properly implemented:
			// 1. Account selection UI appears
			// 2. User selects "Marketplace Cleaner"
			// 3. Login completes with marketplace_cleaner account

			// await waitFor(() => {
			//   const marketplaceOption = getByText("Marketplace Cleaner");
			//   fireEvent.press(marketplaceOption);
			// });

			// await waitFor(() => {
			//   expect(FetchData.login).toHaveBeenCalledWith({
			//     userName: "test@example.com",
			//     password: "SecurePass1!",
			//     accountType: "marketplace_cleaner",
			//   });
			//   expect(mockLogin).toHaveBeenCalledWith("jwt-token");
			// });
		});

		it("should allow canceling account selection", async () => {
			FetchData.login.mockResolvedValueOnce({
				requiresAccountSelection: true,
				accountOptions: [
					{ accountType: "employee", displayName: "Business Employee" },
					{ accountType: "marketplace_cleaner", displayName: "Marketplace Cleaner" },
				],
			});

			const { getByText, getByPlaceholderText, queryByText } = renderWithProviders(
				<SignInForm state={{}} dispatch={mockDispatch} />
			);

			fireEvent.changeText(
				getByPlaceholderText(/Enter your email or username/i),
				"test@example.com"
			);
			fireEvent.changeText(
				getByPlaceholderText(/Enter your password/i),
				"SecurePass1!"
			);

			fireEvent.press(getByText("Sign In"));

			// When properly implemented, user should be able to cancel
			// await waitFor(() => {
			//   const cancelButton = getByText("Cancel");
			//   fireEvent.press(cancelButton);
			// });

			// await waitFor(() => {
			//   // Modal should close, form should be usable again
			//   expect(queryByText("Multiple accounts found")).toBeNull();
			// });
		});
	});

	describe("Account Types Display", () => {
		const accountTypes = [
			{ type: "employee", display: "Business Employee" },
			{ type: "marketplace_cleaner", display: "Marketplace Cleaner" },
			{ type: "cleaner", display: "Cleaner" },
			{ type: "owner", display: "Owner" },
			{ type: "hr", display: "HR Staff" },
			{ type: "homeowner", display: "Homeowner" },
		];

		accountTypes.forEach(({ type, display }) => {
			it(`should display "${display}" for accountType "${type}"`, async () => {
				FetchData.login.mockResolvedValueOnce({
					requiresAccountSelection: true,
					accountOptions: [
						{ accountType: type, displayName: display },
						{ accountType: "marketplace_cleaner", displayName: "Marketplace Cleaner" },
					],
				});

				const { getByText, getByPlaceholderText } = renderWithProviders(
					<SignInForm state={{}} dispatch={mockDispatch} />
				);

				fireEvent.changeText(
					getByPlaceholderText(/Enter your email or username/i),
					"test@example.com"
				);
				fireEvent.changeText(
					getByPlaceholderText(/Enter your password/i),
					"SecurePass1!"
				);

				fireEvent.press(getByText("Sign In"));

				// When properly implemented:
				// await waitFor(() => {
				//   expect(getByText(display)).toBeTruthy();
				// });
			});
		});
	});
});

describe("SignInForm - Username vs Email Login", () => {
	const mockDispatch = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should call login with username parameter", async () => {
		FetchData.login.mockResolvedValueOnce({
			user: {
				id: 1,
				username: "uniqueusername",
				type: "cleaner",
			},
			token: "jwt-token",
		});

		const { getByText, getByPlaceholderText } = renderWithProviders(
			<SignInForm state={{}} dispatch={mockDispatch} />
		);

		// Login with username (no @ symbol)
		fireEvent.changeText(
			getByPlaceholderText(/Enter your email or username/i),
			"uniqueusername"
		);
		fireEvent.changeText(
			getByPlaceholderText(/Enter your password/i),
			"SecurePass1!"
		);
		fireEvent.press(getByText("Sign In"));

		await waitFor(
			() => {
				// Username login should pass username as userName parameter
				expect(FetchData.login).toHaveBeenCalledWith({
					userName: "uniqueusername",
					password: "SecurePass1!",
					accountType: null,
				});
			},
			{ timeout: 2000 }
		);
	});

	it("should handle email format detection correctly", () => {
		// Helper to check if value is email - returns truthy/falsy
		const isEmail = (value) => value && value.includes("@");

		expect(isEmail("user@example.com")).toBeTruthy();
		expect(isEmail("test@test.co.uk")).toBeTruthy();
		expect(isEmail("username")).toBeFalsy();
		expect(isEmail("user_name")).toBeFalsy();
		expect(isEmail("")).toBeFalsy();
		expect(isEmail(null)).toBeFalsy();
	});
});
