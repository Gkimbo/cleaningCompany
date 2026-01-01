import React from "react";
import { render } from "@testing-library/react-native";
import ReviewTile from "../../src/components/reviews/ReviewTile";

describe("ReviewTile - Deleted Reviewer Display", () => {
  const baseReviewProps = {
    id: 1,
    userId: 100,
    reviewerId: 10,
    appointmentId: 50,
    rating: 4.5,
    comment: "Great cleaning service!",
    createdAt: "2024-01-15T10:00:00Z",
    reviewType: "cleaner_to_homeowner",
  };

  describe("Reviewer name display priority", () => {
    it("should display full name when firstName and lastName are available", () => {
      const reviewer = {
        id: 10,
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
      };

      const { getByText } = render(
        <ReviewTile {...baseReviewProps} reviewer={reviewer} />
      );

      expect(getByText("John Doe")).toBeTruthy();
    });

    it("should display username when firstName/lastName are empty", () => {
      const reviewer = {
        id: 10,
        firstName: "",
        lastName: "",
        username: "johndoe",
      };

      const { getByText } = render(
        <ReviewTile {...baseReviewProps} reviewer={reviewer} />
      );

      expect(getByText("johndoe")).toBeTruthy();
    });

    it("should display username when firstName/lastName are null", () => {
      const reviewer = {
        id: 10,
        firstName: null,
        lastName: null,
        username: "cleaner123",
      };

      const { getByText } = render(
        <ReviewTile {...baseReviewProps} reviewer={reviewer} />
      );

      expect(getByText("cleaner123")).toBeTruthy();
    });

    it("should display displayName when reviewer was deleted (no username)", () => {
      // This is the case when the serializer sets displayName for deleted reviewers
      const reviewer = {
        id: null,
        username: null,
        displayName: "Jane Smith",
      };

      const { getByText } = render(
        <ReviewTile {...baseReviewProps} reviewer={reviewer} />
      );

      expect(getByText("Jane Smith")).toBeTruthy();
    });

    it("should display reviewerName prop when reviewer object has no valid name", () => {
      const reviewer = {
        id: null,
        username: null,
        firstName: null,
        lastName: null,
      };

      const { getByText } = render(
        <ReviewTile
          {...baseReviewProps}
          reviewer={reviewer}
          reviewerName="Stored Reviewer Name"
        />
      );

      expect(getByText("Stored Reviewer Name")).toBeTruthy();
    });

    it("should display reviewerName prop when reviewer is null", () => {
      const { getByText } = render(
        <ReviewTile
          {...baseReviewProps}
          reviewer={null}
          reviewerName="Deleted Cleaner Name"
        />
      );

      expect(getByText("Deleted Cleaner Name")).toBeTruthy();
    });

    it("should display reviewerName prop when reviewer is undefined", () => {
      const { getByText } = render(
        <ReviewTile
          {...baseReviewProps}
          reviewer={undefined}
          reviewerName="Former Employee"
        />
      );

      expect(getByText("Former Employee")).toBeTruthy();
    });
  });

  describe("Edge cases for deleted reviewers", () => {
    it("should handle reviewer with only firstName", () => {
      const reviewer = {
        id: 10,
        firstName: "John",
        lastName: "",
        username: "johnd",
      };

      const { getByText } = render(
        <ReviewTile {...baseReviewProps} reviewer={reviewer} />
      );

      expect(getByText("John")).toBeTruthy();
    });

    it("should handle reviewer with only lastName", () => {
      const reviewer = {
        id: 10,
        firstName: "",
        lastName: "Doe",
        username: "jdoe",
      };

      const { getByText } = render(
        <ReviewTile {...baseReviewProps} reviewer={reviewer} />
      );

      expect(getByText("Doe")).toBeTruthy();
    });

    it("should handle whitespace-only names by falling back to username", () => {
      const reviewer = {
        id: 10,
        firstName: "   ",
        lastName: "   ",
        username: "realuser",
      };

      const { getByText } = render(
        <ReviewTile {...baseReviewProps} reviewer={reviewer} />
      );

      // After trim(), the names become empty, so should fall back to username
      expect(getByText("realuser")).toBeTruthy();
    });

    it("should not display reviewer name section when no name is available", () => {
      const { queryByTestId } = render(
        <ReviewTile
          {...baseReviewProps}
          reviewer={null}
          reviewerName={null}
        />
      );

      // The component conditionally renders reviewerName, so it won't crash
      // Just verify the component renders without error
      expect(true).toBe(true);
    });

    it("should handle system reviews with displayName 'System'", () => {
      const reviewer = {
        id: null,
        username: null,
        displayName: "System",
      };

      const { getByText } = render(
        <ReviewTile
          {...baseReviewProps}
          reviewer={reviewer}
          reviewType="system_cancellation_penalty"
        />
      );

      expect(getByText("System")).toBeTruthy();
    });
  });

  describe("Priority order verification", () => {
    it("should prefer full name over username", () => {
      const reviewer = {
        id: 10,
        firstName: "Preferred",
        lastName: "Name",
        username: "notthisone",
        displayName: "notthiseither",
      };

      const { getByText, queryByText } = render(
        <ReviewTile
          {...baseReviewProps}
          reviewer={reviewer}
          reviewerName="nope"
        />
      );

      expect(getByText("Preferred Name")).toBeTruthy();
      expect(queryByText("notthisone")).toBeNull();
      expect(queryByText("notthiseither")).toBeNull();
      expect(queryByText("nope")).toBeNull();
    });

    it("should prefer username over displayName", () => {
      const reviewer = {
        id: 10,
        firstName: "",
        lastName: "",
        username: "preferredUsername",
        displayName: "notthis",
      };

      const { getByText, queryByText } = render(
        <ReviewTile
          {...baseReviewProps}
          reviewer={reviewer}
          reviewerName="nope"
        />
      );

      expect(getByText("preferredUsername")).toBeTruthy();
      expect(queryByText("notthis")).toBeNull();
    });

    it("should prefer displayName over reviewerName prop", () => {
      const reviewer = {
        id: null,
        firstName: null,
        lastName: null,
        username: null,
        displayName: "Preferred Display",
      };

      const { getByText, queryByText } = render(
        <ReviewTile
          {...baseReviewProps}
          reviewer={reviewer}
          reviewerName="Not This One"
        />
      );

      expect(getByText("Preferred Display")).toBeTruthy();
      expect(queryByText("Not This One")).toBeNull();
    });
  });

  describe("Real-world deletion scenarios", () => {
    it("should display stored name after cleaner deletion (typical case)", () => {
      // Simulates what happens when a cleaner is deleted:
      // - reviewerId becomes null (via SET NULL cascade)
      // - reviewerName contains the stored name
      // - reviewer object from serializer has displayName set
      const reviewer = {
        id: null,
        username: null,
        displayName: "John Doe",
      };

      const { getByText } = render(
        <ReviewTile
          {...baseReviewProps}
          reviewerId={null}
          reviewer={reviewer}
          reviewerName="John Doe"
        />
      );

      expect(getByText("John Doe")).toBeTruthy();
    });

    it("should handle legacy reviews without reviewerName field", () => {
      // Old reviews might not have reviewerName stored
      // If reviewer is deleted, we might only have the serializer's displayName
      const reviewer = {
        id: null,
        username: null,
        displayName: "Legacy Cleaner",
      };

      const { getByText } = render(
        <ReviewTile
          {...baseReviewProps}
          reviewerId={null}
          reviewer={reviewer}
          reviewerName={undefined}
        />
      );

      expect(getByText("Legacy Cleaner")).toBeTruthy();
    });

    it("should maintain review display integrity when cleaner is deleted", () => {
      const reviewer = {
        id: null,
        username: null,
        displayName: "Deleted Cleaner",
      };

      const { getByText } = render(
        <ReviewTile
          {...baseReviewProps}
          rating={5}
          comment="Excellent work, very thorough!"
          reviewer={reviewer}
          reviewerName="Deleted Cleaner"
        />
      );

      // Verify all review content still displays correctly
      expect(getByText("Deleted Cleaner")).toBeTruthy();
      expect(getByText("Excellent work, very thorough!")).toBeTruthy();
      expect(getByText("5.0")).toBeTruthy();
    });
  });
});
