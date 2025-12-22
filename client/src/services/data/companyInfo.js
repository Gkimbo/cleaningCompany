/**
 * Company Information Configuration
 *
 * NOTE: All pricing is now fetched from the database via PricingContext.
 * Use the usePricing() hook to access pricing values.
 * This file only contains non-pricing company information.
 */

export const cleaningCompany = {
  // Company location and service area
  location: "Barnstable, MA",
  maxDistance: 10,

  // Booking constraints
  maxBookingDays: 14,
  cleaningHours: { start: 10, end: 16 },

  // Marketing content
  bookingInfo: {
    description:
      "Clients can easily schedule cleaning appointments up to two weeks in advance. We offer flexible options for one-bedroom, one-bathroom, and studio rentals. Additional charges apply for extra beds and baths, accommodating various property sizes. Clients can opt to provide their own clean sheets and pillowcases or request our cleaning service to handle this for an additional fee per bed. Appointments are available daily between 10 am and 4 pm.",
  },

  specialConsiderations: {
    description:
      "On high-volume days, such as holidays or holiday weekends, an extra fee will be applied to ensure availability and accommodate increased demand. This additional charge helps us manage the increased workload on these specific days.",
  },

  cancellationPolicy: {
    description:
      "We understand that plans can change. Clients can cancel appointments up to one week prior to the scheduled cleaning without incurring any fees. However, cancellations within one week of the cleaning date will result in a cancellation fee. This policy is in place to account for the planning and resources allocated to each appointment.",
  },

  aboutService: {
    description:
      "Our goal is to deliver exceptional cleaning services that meet the unique needs of short-term rental properties. By maintaining transparency in our pricing, offering flexible booking options, and accommodating special requests, we aim to provide a seamless experience for both property owners and guests. Our dedicated team ensures that each property is thoroughly cleaned and prepared for the next set of visitors.",
  },

  ourWorryFreeGuarantee: {
    description:
      "When you trust your property to our team, you can rest easy knowing every turnover is handled with care and precision. We understand how important five-star reviews, on-time check-ins, and consistent cleanliness are to your success. You deserve the confidence that each guest will walk into a spotless, guest-ready space—every single time. We provide the peace of mind you're looking for with reliable, detail-driven turnover cleanings performed by friendly, trustworthy professionals. Our Worry-Free Guarantee reflects our commitment to going the extra mile so your rental always feels welcoming and professionally maintained.",
  },
};
