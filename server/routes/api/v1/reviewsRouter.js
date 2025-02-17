const express = require("express");
const jwt = require("jsonwebtoken");
const {
  User,
  UserAppointments,
  UserReviews
} = require("../../../models");
const AppointmentSerializer = require("../../../serializers/AppointmentSerializer");
const UserInfo = require("../../../services/UserInfoClass");
const calculatePrice = require("../../../services/CalculatePrice");
const HomeSerializer = require("../../../serializers/homesSerializer");
const { emit } = require("nodemon");
const ReviewsClass = require("../../../services/ReviewsClass");

const reviewsRouter = express.Router();
const secretKey = process.env.SESSION_SECRET;

reviewsRouter.get("/:userId", async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  try {
    const userAppointments = await UserAppointments.findAll({
      where: { hasBeenAssigned: false },
    });
    const serializedAppointments =
      AppointmentSerializer.serializeArray(userAppointments);

    return res.status(200).json({ appointments: serializedAppointments });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

reviewsRouter.post("/submit", async (req, res) => {
    const { userId, reviewerId, appointmentId, rating, comment } = req.body;
    try{
        const newReview = await ReviewsClass.addReviewToDB(userId, reviewerId, appointmentId, rating, comment)
        
        return res.status(200).json({ newReview });
    }catch(error){
        return res.status(401).json({ error: "Invalid or expired token" });
    }
  
});

reviewsRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const appointmentToDelete = await UserAppointments.findOne({
      where: { id: id },
    });

    const connectionsToDelete = await UserCleanerAppointments.destroy({
      where: { appointmentId: id },
    });

    const deletedAppointmentInfo = await UserAppointments.destroy({
      where: { id: id },
    });

    return res.status(201).json({ message: "Appointment Deleted" });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

module.exports = reviewsRouter;

