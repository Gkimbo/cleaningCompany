/**
 * Last-Minute Booking Notification Service
 *
 * Handles sending urgent notifications to cleaners within radius of a property
 * when a homeowner books a last-minute appointment.
 */

const { User, Notification } = require("../models");
const { calculateDistance } = require("../utils/geoUtils");
const { getPricingConfig } = require("../config/businessConfig");
const EncryptionService = require("./EncryptionService");
const PushNotification = require("./sendNotifications/PushNotificationClass");
const Email = require("./sendNotifications/EmailClass");
const { Op } = require("sequelize");

// Convert miles to meters for distance calculation
const MILES_TO_METERS = 1609.34;

class LastMinuteNotificationService {
  /**
   * Find all cleaners within radius of a property
   * Verified businesses are prioritized and returned first
   * @param {number} homeLat - Property latitude (decrypted)
   * @param {number} homeLon - Property longitude (decrypted)
   * @param {number} radiusMiles - Search radius in miles
   * @param {Object} options - Additional options
   * @param {boolean} options.prioritizeVerified - Whether to sort verified businesses first (default: true)
   * @returns {Promise<Array>} Array of nearby cleaners with distance info
   */
  static async findNearbyCleaners(homeLat, homeLon, radiusMiles, options = {}) {
    const { prioritizeVerified = true } = options;

    // Get all active cleaners with location data
    const cleaners = await User.findAll({
      where: {
        type: "cleaner",
        accountFrozen: false,
        serviceAreaLatitude: { [Op.not]: null },
        serviceAreaLongitude: { [Op.not]: null },
      },
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "expoPushToken",
        "serviceAreaLatitude",
        "serviceAreaLongitude",
        "serviceAreaRadiusMiles",
        "notifications",
        // Business verification fields
        "isBusinessOwner",
        "businessVerificationStatus",
        "businessName",
        "businessHighlightOptIn",
      ],
    });

    const radiusMeters = radiusMiles * MILES_TO_METERS;
    const nearbyCleaners = [];

    for (const cleaner of cleaners) {
      // Cleaner lat/long are stored as TEXT and encrypted in the DB
      // But after afterFind hook, they should be decrypted in dataValues
      // However, lat/long are not in PII_FIELDS, so they're stored as plain TEXT
      // Let's parse them directly
      let cleanerLat, cleanerLon;

      try {
        // serviceAreaLatitude and serviceAreaLongitude are stored as TEXT (not encrypted)
        cleanerLat = parseFloat(cleaner.serviceAreaLatitude);
        cleanerLon = parseFloat(cleaner.serviceAreaLongitude);
      } catch (e) {
        console.warn(
          `[LastMinuteNotification] Could not parse coordinates for cleaner ${cleaner.id}`
        );
        continue;
      }

      if (isNaN(cleanerLat) || isNaN(cleanerLon)) {
        continue;
      }

      const distanceMeters = calculateDistance(
        homeLat,
        homeLon,
        cleanerLat,
        cleanerLon
      );

      if (distanceMeters === null) {
        continue;
      }

      // Check if home is within cleaner's service area AND within our notification radius
      const cleanerServiceRadius =
        (parseFloat(cleaner.serviceAreaRadiusMiles) || 30) * MILES_TO_METERS;
      const isWithinCleanerServiceArea = distanceMeters <= cleanerServiceRadius;
      const isWithinNotificationRadius = distanceMeters <= radiusMeters;

      // Only include if within both radiuses
      if (isWithinCleanerServiceArea && isWithinNotificationRadius) {
        // Check if this is a verified business
        const isVerifiedBusiness =
          cleaner.isBusinessOwner &&
          cleaner.businessVerificationStatus === "verified" &&
          cleaner.businessHighlightOptIn !== false;

        nearbyCleaners.push({
          id: cleaner.id,
          firstName: cleaner.firstName,
          lastName: cleaner.lastName,
          email: cleaner.email,
          expoPushToken: cleaner.expoPushToken,
          notifications: cleaner.notifications,
          distanceMeters,
          distanceMiles: (distanceMeters / MILES_TO_METERS).toFixed(1),
          // Verification info
          isBusinessOwner: cleaner.isBusinessOwner || false,
          isVerifiedBusiness,
          businessName: cleaner.businessName,
        });
      }
    }

    // Sort: verified businesses first, then by distance
    if (prioritizeVerified) {
      nearbyCleaners.sort((a, b) => {
        // Verified businesses come first
        if (a.isVerifiedBusiness && !b.isVerifiedBusiness) return -1;
        if (!a.isVerifiedBusiness && b.isVerifiedBusiness) return 1;
        // Then sort by distance
        return a.distanceMeters - b.distanceMeters;
      });
    } else {
      // Just sort by distance
      nearbyCleaners.sort((a, b) => a.distanceMeters - b.distanceMeters);
    }

    const verifiedCount = nearbyCleaners.filter(c => c.isVerifiedBusiness).length;
    console.log(
      `[LastMinuteNotification] Found ${nearbyCleaners.length} cleaners within ${radiusMiles} miles (${verifiedCount} verified businesses)`
    );

    return nearbyCleaners;
  }

  /**
   * Send last-minute booking notifications to nearby cleaners
   * @param {Object} appointment - The UserAppointments record
   * @param {Object} home - The UserHomes record with lat/long
   * @param {Object} io - Socket.io instance for real-time updates
   * @returns {Promise<{notifiedCount: number, cleanerIds: Array}>}
   */
  static async notifyNearbyCleaners(appointment, home, io = null) {
    const pricing = await getPricingConfig();
    const radiusMiles = pricing?.lastMinute?.notificationRadiusMiles ?? 25;

    // Get home coordinates (they're encrypted, need to decrypt)
    let homeLat, homeLon;

    try {
      // UserHomes latitude/longitude are encrypted TEXT fields
      homeLat = parseFloat(EncryptionService.decrypt(home.latitude));
      homeLon = parseFloat(EncryptionService.decrypt(home.longitude));
    } catch (e) {
      console.error(
        "[LastMinuteNotification] Could not decrypt home coordinates:",
        home.id
      );
      return { notifiedCount: 0, cleanerIds: [] };
    }

    if (isNaN(homeLat) || isNaN(homeLon)) {
      console.error(
        "[LastMinuteNotification] Home has invalid coordinates:",
        home.id
      );
      return { notifiedCount: 0, cleanerIds: [] };
    }

    // Find nearby cleaners
    const nearbyCleaners = await this.findNearbyCleaners(
      homeLat,
      homeLon,
      radiusMiles
    );

    if (nearbyCleaners.length === 0) {
      console.log(
        "[LastMinuteNotification] No cleaners found within radius for appointment",
        appointment.id
      );
      return { notifiedCount: 0, cleanerIds: [] };
    }

    // Prepare notification content
    const priceDisplay = `$${parseFloat(appointment.price).toFixed(2)}`;
    const cityDisplay = home.city || "your area";
    const appointmentDate = appointment.date;

    const notifiedCleanerIds = [];

    for (const cleaner of nearbyCleaners) {
      try {
        // 1. Create in-app notification
        await Notification.create({
          userId: cleaner.id,
          type: "last_minute_urgent",
          title: "Urgent: Last-Minute Cleaning Available!",
          body: `${priceDisplay} cleaning in ${cityDisplay} (${cleaner.distanceMiles} mi away). Book now!`,
          data: {
            appointmentId: appointment.id,
            homeId: home.id,
            price: appointment.price,
            lastMinuteFee: appointment.lastMinuteFeeApplied,
            distanceMiles: cleaner.distanceMiles,
            isLastMinute: true,
          },
          actionRequired: true,
          relatedAppointmentId: appointment.id,
          expiresAt: new Date(appointmentDate + "T23:59:59"),
        });

        // 2. Send push notification
        if (cleaner.expoPushToken) {
          await PushNotification.sendPushNotification(
            cleaner.expoPushToken,
            "🚨 Urgent: Last-Minute Cleaning!",
            `${priceDisplay} in ${cityDisplay} - ${cleaner.distanceMiles} mi away. Tap to view!`,
            {
              type: "last_minute_urgent",
              appointmentId: appointment.id,
              screen: "JobDetails",
            }
          );
        }

        // 3. Send email if user has email notifications enabled
        if (cleaner.notifications?.includes("email") && cleaner.email) {
          await Email.sendLastMinuteUrgentEmail(
            cleaner.email,
            cleaner.firstName,
            appointmentDate,
            priceDisplay,
            cityDisplay,
            cleaner.distanceMiles
          );
        }

        // 4. Emit socket event for real-time update
        if (io) {
          io.to(`user_${cleaner.id}`).emit("last_minute_job", {
            appointmentId: appointment.id,
            price: appointment.price,
            city: cityDisplay,
            distanceMiles: cleaner.distanceMiles,
          });

          // Also emit notification count update
          const unreadCount = await Notification.getUnreadCount(cleaner.id);
          io.to(`user_${cleaner.id}`).emit("notification_count_update", {
            unreadCount,
          });
        }

        notifiedCleanerIds.push(cleaner.id);
      } catch (error) {
        console.error(
          `[LastMinuteNotification] Error notifying cleaner ${cleaner.id}:`,
          error
        );
        // Continue with other cleaners
      }
    }

    // Update appointment to mark notifications sent
    await appointment.update({
      lastMinuteNotificationsSentAt: new Date(),
    });

    console.log(
      `[LastMinuteNotification] Notified ${notifiedCleanerIds.length} cleaners for appointment ${appointment.id}`
    );

    return {
      notifiedCount: notifiedCleanerIds.length,
      cleanerIds: notifiedCleanerIds,
    };
  }
}

module.exports = LastMinuteNotificationService;
