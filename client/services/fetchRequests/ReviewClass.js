/* eslint-disable no-console */
const baseURL = "http://localhost:3000";

class Review {
  static async addReviewToDb(data) {
    try {
      const response = await fetch(baseURL + "/api/v1/reviews/submit", {
        method: "post",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "Review/json",
        },
      });
      if (!response.ok) {
        if (response.status === 400) {
          const responseData = await response.json();
          return responseData;
        }
        const error = new Error(`${response.status}(${response.statusText})`);
        throw error;
      }
      const responseData = await response.json();
      return true;
    } catch (err) {
      return err;
    }
  }

  static async deleteReview(id) {
    try {
      const response = await fetch(baseURL + `/api/v1/reviews/${id}`, {
        method: "delete",
        headers: {
          "Content-Type": "Review/json",
        },
      });
      if (!response.ok) {
        if (response.status === 400) {
          const responseData = await response.json();
          throw new Error(`Bad Request: ${JSON.stringify(responseData)}`);
        }
        throw new Error(`${response.status} (${response.statusText})`);
      }
      const responseData = await response.json();
      console.log(responseData)
      return responseData;
    } catch (err) {
      console.log(err);
      throw new Error(`Failed to delete appointment: ${err.message}`);
    }
  }

  static async getReviews(userId) {
    try {
      const response = await fetch(baseURL + `/api/v1/reviews/${userId}`);
      if (!response.ok) {
        throw new Error("No data received");
      }
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      return error;
    }
  }

}

export default Review;
