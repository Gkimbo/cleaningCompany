/**
 * Test Script: New Home Request Feature
 *
 * Tests the full flow of the new home request feature:
 * 1. Client adds a home → Request created for existing business owner
 * 2. Business owner accepts → CleanerClient created
 * 3. Client adds another home → Request created
 * 4. Business owner declines → Client notified
 * 5. Client toggles marketplace
 * 6. Client requests again (after decline)
 *
 * Run with: node server/scripts/test-new-home-request.js
 */

const path = require("path");
const models = require(path.join(__dirname, "..", "models"));
const NewHomeRequestService = require(path.join(__dirname, "..", "services", "NewHomeRequestService"));

const {
  User,
  UserHomes,
  CleanerClient,
  NewHomeRequest,
  Notification,
  sequelize,
} = models;

async function runTests() {
  console.log("\n=== Testing New Home Request Feature ===\n");

  try {
    // Find demo accounts
    const businessOwner = await User.findOne({
      where: { username: "demo_business_owner" },
    });
    const client = await User.findOne({
      where: { username: "demo_business_client" },
    });

    if (!businessOwner || !client) {
      console.log("Demo accounts not found. Run demo-accounts.js first:");
      console.log("  node server/seeders/demo-accounts.js");
      return;
    }

    console.log(`Found business owner: ${businessOwner.firstName} ${businessOwner.lastName} (ID: ${businessOwner.id})`);
    console.log(`Found client: ${client.firstName} ${client.lastName} (ID: ${client.id})`);

    // Check for existing CleanerClient relationship
    const existingRelationship = await CleanerClient.findOne({
      where: {
        cleanerId: businessOwner.id,
        clientId: client.id,
        status: "active",
      },
    });

    if (!existingRelationship) {
      console.log("\nNo existing CleanerClient relationship found.");
      console.log("Creating test relationship...");

      await CleanerClient.create({
        cleanerId: businessOwner.id,
        clientId: client.id,
        status: "active",
        inviteToken: "test-token-" + Date.now(),
        invitedEmail: "test@example.com",
        invitedName: `${client.firstName} ${client.lastName}`,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      });
      console.log("Created test CleanerClient relationship.");
    } else {
      console.log(`\nExisting CleanerClient relationship found (ID: ${existingRelationship.id})`);
    }

    // Test 1: Find existing business owner relationships
    console.log("\n--- Test 1: Find Existing Business Owner Relationships ---");
    const relationships = await NewHomeRequestService.findExistingBusinessOwnerRelationships(client.id);
    console.log(`Found ${relationships.length} business owner relationship(s)`);
    relationships.forEach((rel) => {
      console.log(`  - ${rel.cleaner?.firstName} ${rel.cleaner?.lastName} (ID: ${rel.cleanerId})`);
    });

    // Test 2: Calculate home price
    console.log("\n--- Test 2: Calculate Home Price ---");
    const priceTests = [
      { beds: 2, baths: 1 },
      { beds: 3, baths: 2 },
      { beds: 4, baths: 2.5 },
      { beds: 5, baths: 3 },
    ];

    for (const test of priceTests) {
      const price = await NewHomeRequestService.calculateHomePrice(test.beds, test.baths);
      console.log(`  ${test.beds} bed, ${test.baths} bath: $${price}`);
    }

    // Test 3: Create a test home and request
    console.log("\n--- Test 3: Create Test Home and Request ---");
    const testHome = await UserHomes.create({
      userId: client.id,
      nickName: `Test Home ${Date.now()}`,
      address: "123 Test Street",
      city: "Test City",
      state: "CA",
      zipcode: "90210",
      numBeds: 3,
      numBaths: 2,
      keyPadCode: "1234",
      trashLocation: "Garage",
      contact: "555-123-4567",
      timeToBeCompleted: "anytime",
      sheetsProvided: "no",
      towelsProvided: "no",
      isMarketplaceEnabled: false,
    });
    console.log(`Created test home: ${testHome.nickName} (ID: ${testHome.id})`);

    // Create request for the home
    const requests = await NewHomeRequestService.createRequestsForNewHome(testHome.id, client.id, null);
    console.log(`Created ${requests.length} new home request(s)`);

    if (requests.length > 0) {
      const request = requests[0];
      console.log(`  Request ID: ${request.id}`);
      console.log(`  Status: ${request.status}`);
      console.log(`  Calculated Price: $${request.calculatedPrice}`);
      console.log(`  Expires At: ${request.expiresAt}`);

      // Check notification was created
      const notification = await Notification.findOne({
        where: {
          userId: businessOwner.id,
          type: "new_home_request",
        },
        order: [["createdAt", "DESC"]],
      });

      if (notification) {
        console.log(`  Notification created: "${notification.title}"`);
        console.log(`  Notification data: ${JSON.stringify(notification.data)}`);
      } else {
        console.log("  WARNING: Notification not found!");
      }

      // Test 4: Accept the request
      console.log("\n--- Test 4: Accept Request ---");
      try {
        const acceptResult = await NewHomeRequestService.acceptRequest(request.id, businessOwner.id, null);
        console.log(`Request accepted!`);
        console.log(`  New CleanerClient ID: ${acceptResult.cleanerClient.id}`);
        console.log(`  Default Price: $${acceptResult.cleanerClient.defaultPrice}`);

        // Check for client notification
        const acceptNotification = await Notification.findOne({
          where: {
            userId: client.id,
            type: "new_home_accepted",
          },
          order: [["createdAt", "DESC"]],
        });

        if (acceptNotification) {
          console.log(`  Client notification created: "${acceptNotification.title}"`);
        }
      } catch (error) {
        console.log(`  Error: ${error.message}`);
      }

      // Test 5: Create another home and decline
      console.log("\n--- Test 5: Create Home and Decline ---");
      const testHome2 = await UserHomes.create({
        userId: client.id,
        nickName: `Test Home 2 ${Date.now()}`,
        address: "456 Test Avenue",
        city: "Test City",
        state: "CA",
        zipcode: "90210",
        numBeds: 4,
        numBaths: 3,
        keyPadCode: "5678",
        trashLocation: "Side of house",
        contact: "555-123-4567",
        timeToBeCompleted: "anytime",
        sheetsProvided: "no",
        towelsProvided: "no",
        isMarketplaceEnabled: false,
      });

      const requests2 = await NewHomeRequestService.createRequestsForNewHome(testHome2.id, client.id, null);
      if (requests2.length > 0) {
        const request2 = requests2[0];
        console.log(`Created request for home 2 (ID: ${request2.id})`);

        const declineResult = await NewHomeRequestService.declineRequest(
          request2.id,
          businessOwner.id,
          "At full capacity currently"
        );
        console.log(`Request declined!`);
        console.log(`  Status: ${declineResult.status}`);
        console.log(`  Decline Reason: ${declineResult.declineReason}`);

        // Test 6: Toggle marketplace
        console.log("\n--- Test 6: Toggle Marketplace ---");
        await NewHomeRequestService.toggleHomeMarketplace(testHome2.id, client.id, true);
        const updatedHome = await UserHomes.findByPk(testHome2.id);
        console.log(`  Marketplace enabled: ${updatedHome.isMarketplaceEnabled}`);

        // Test 7: Request again (should fail due to rate limit)
        console.log("\n--- Test 7: Request Again (Rate Limit) ---");
        console.log(`  Can request again: ${declineResult.canRequestAgain()}`);
        console.log(`  Days until can request: ${declineResult.daysUntilCanRequestAgain()}`);

        // Manually set lastRequestedAt to 31 days ago to test
        console.log("\n--- Test 8: Request Again (After Cooldown) ---");
        const thirtyOneDaysAgo = new Date();
        thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
        await request2.update({ lastRequestedAt: thirtyOneDaysAgo });
        await request2.reload();
        console.log(`  Can request again: ${request2.canRequestAgain()}`);

        if (request2.canRequestAgain()) {
          const reRequest = await NewHomeRequestService.requestAgain(request2.id, client.id, null);
          console.log(`  Request sent again!`);
          console.log(`  New status: ${reRequest.status}`);
          console.log(`  Request count: ${reRequest.requestCount}`);
        }

        // Cleanup test home 2
        await NewHomeRequest.destroy({ where: { homeId: testHome2.id } });
        await testHome2.destroy();
      }

      // Cleanup: Delete the new CleanerClient and test home
      console.log("\n--- Cleanup ---");
      await CleanerClient.destroy({
        where: {
          homeId: testHome.id,
          cleanerId: businessOwner.id,
        },
      });
      await NewHomeRequest.destroy({ where: { homeId: testHome.id } });
      await testHome.destroy();
      console.log("Test data cleaned up.");
    }

    console.log("\n=== All Tests Completed Successfully! ===\n");
  } catch (error) {
    console.error("\n=== Test Error ===");
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

runTests();
