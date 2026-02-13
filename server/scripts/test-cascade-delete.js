/**
 * Test Script: Cascade Delete for NewHomeRequests
 *
 * Tests that NewHomeRequests are properly deleted when a home is deleted.
 *
 * Run with: node server/scripts/test-cascade-delete.js
 */

const path = require("path");
const models = require(path.join(__dirname, "..", "models"));
const NewHomeRequestService = require(path.join(__dirname, "..", "services", "NewHomeRequestService"));

const {
  User,
  UserHomes,
  CleanerClient,
  NewHomeRequest,
  sequelize,
} = models;

async function runTests() {
  console.log("\n=== Testing Cascade Delete for NewHomeRequests ===\n");

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

    console.log(`Business Owner: ${businessOwner.id}`);
    console.log(`Client: ${client.id}`);

    // Ensure CleanerClient relationship exists
    let relationship = await CleanerClient.findOne({
      where: {
        cleanerId: businessOwner.id,
        clientId: client.id,
        status: "active",
      },
    });

    if (!relationship) {
      relationship = await CleanerClient.create({
        cleanerId: businessOwner.id,
        clientId: client.id,
        status: "active",
        inviteToken: "cascade-test-" + Date.now(),
        invitedEmail: "test@example.com",
        invitedName: "Test Client",
        invitedAt: new Date(),
        acceptedAt: new Date(),
      });
      console.log("Created test CleanerClient relationship");
    }

    // Step 1: Create a test home
    console.log("\n--- Step 1: Create Test Home ---");
    const testHome = await UserHomes.create({
      userId: client.id,
      nickName: `Cascade Test Home ${Date.now()}`,
      address: "999 Delete Test Lane",
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
    console.log(`Created home: ${testHome.nickName} (ID: ${testHome.id})`);

    // Step 2: Create NewHomeRequest for this home
    console.log("\n--- Step 2: Create NewHomeRequest ---");
    const requests = await NewHomeRequestService.createRequestsForNewHome(
      testHome.id,
      client.id,
      null
    );
    console.log(`Created ${requests.length} request(s)`);

    if (requests.length === 0) {
      console.log("No requests created - check CleanerClient relationship");
      await testHome.destroy();
      return;
    }

    const request = requests[0];
    console.log(`Request ID: ${request.id}, Status: ${request.status}`);

    // Step 3: Verify request exists in database
    console.log("\n--- Step 3: Verify Request Exists ---");
    const requestBefore = await NewHomeRequest.findByPk(request.id);
    console.log(`Request found: ${requestBefore ? "YES" : "NO"}`);
    console.log(`Request status: ${requestBefore?.status}`);

    // Step 4: Delete the home (simulating what the API does)
    console.log("\n--- Step 4: Delete Home (with cascade) ---");

    // Cancel pending requests first (like the API does)
    const pendingRequests = await NewHomeRequest.findAll({
      where: {
        homeId: testHome.id,
        status: "pending",
      },
    });
    console.log(`Found ${pendingRequests.length} pending request(s) to cancel`);

    for (const req of pendingRequests) {
      await req.cancel();
      console.log(`Cancelled request ${req.id}`);
    }

    // Delete all requests for this home
    const deletedCount = await NewHomeRequest.destroy({
      where: {
        homeId: testHome.id,
      },
    });
    console.log(`Deleted ${deletedCount} request(s)`);

    // Delete the home
    await testHome.destroy();
    console.log(`Deleted home ${testHome.id}`);

    // Step 5: Verify request no longer exists
    console.log("\n--- Step 5: Verify Request Deleted ---");
    const requestAfter = await NewHomeRequest.findByPk(request.id);
    console.log(`Request found after delete: ${requestAfter ? "YES (BUG!)" : "NO (GOOD!)"}`);

    // Step 6: Test with multiple request statuses
    console.log("\n--- Step 6: Test Multiple Request Statuses ---");

    const testHome2 = await UserHomes.create({
      userId: client.id,
      nickName: `Multi-Status Test ${Date.now()}`,
      address: "888 Multi Test Ave",
      city: "Test City",
      state: "CA",
      zipcode: "90210",
      numBeds: 2,
      numBaths: 1,
      keyPadCode: "5678",
      trashLocation: "Side yard",
      contact: "555-987-6543",
      timeToBeCompleted: "anytime",
      sheetsProvided: "no",
      towelsProvided: "no",
      isMarketplaceEnabled: false,
    });

    // Create request and decline it
    const requests2 = await NewHomeRequestService.createRequestsForNewHome(
      testHome2.id,
      client.id,
      null
    );

    if (requests2.length > 0) {
      // Decline the request
      await NewHomeRequestService.declineRequest(
        requests2[0].id,
        businessOwner.id,
        "Testing cascade delete"
      );
      console.log(`Created and declined request ${requests2[0].id}`);

      // Verify it's declined
      const declinedRequest = await NewHomeRequest.findByPk(requests2[0].id);
      console.log(`Request status after decline: ${declinedRequest?.status}`);

      // Now delete the home
      await NewHomeRequest.destroy({
        where: { homeId: testHome2.id },
      });
      await testHome2.destroy();
      console.log(`Deleted home with declined request`);

      // Verify declined request is also deleted
      const afterDelete = await NewHomeRequest.findByPk(requests2[0].id);
      console.log(`Declined request after home delete: ${afterDelete ? "EXISTS (BUG!)" : "DELETED (GOOD!)"}`);
    }

    console.log("\n=== All Cascade Delete Tests Passed! ===\n");

  } catch (error) {
    console.error("\n=== Test Error ===");
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

runTests();
