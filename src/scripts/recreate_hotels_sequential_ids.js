// src/scripts/recreate_hotels_sequential_ids.js
// !!! EXTREMELY DANGEROUS SCRIPT !!!
// ATTEMPTS TO DIRECTLY MODIFY PRIMARY KEY IDS USING RAW SQL.
// THIS IS UNSUPPORTED, HIGHLY RISKY, AND VERY LIKELY TO FAIL OR CORRUPT DATA,
// ESPECIALLY WHEN USING PRISMA ACCELERATE.
// PROCEED ONLY BECAUSE THE USER EXPLICITLY REQUESTED IT AND STATED DATA IS VALUELESS.
// DO NOT USE THIS SCRIPT IN ANY NORMAL CIRCUMSTANCE.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// The value to subtract from each ID
const ID_OFFSET = 11368;

async function attemptDirectIdSubtraction() {
  console.log('--- Starting EXTREMELY DANGEROUS direct ID subtraction ---');
  console.warn('!!! WARNING: This operation is unsupported and highly likely to fail or corrupt data !!!');

  // Verify there are hotels to update
  const hotelCount = await prisma.hotel.count();
  if (hotelCount === 0) {
    console.log('No hotels found in the database. Nothing to do.');
    return;
  }
  console.log(`Found ${hotelCount} hotels.`);

  // Check if the minimum ID allows subtraction
  const minIdHotel = await prisma.hotel.findFirst({ orderBy: { id: 'asc' } });
  if (minIdHotel && minIdHotel.id <= ID_OFFSET) {
      console.error(`Error: Minimum hotel ID (${minIdHotel.id}) is less than or equal to the offset (${ID_OFFSET}).`);
      console.error('Cannot subtract offset as it would result in non-positive or zero IDs.');
      return; // Prevent non-positive IDs
  }

  console.log(`Attempting to subtract ${ID_OFFSET} from all Hotel IDs.`);

  // --- RAW SQL OPERATIONS - HIGH RISK --- 
  // These commands are PostgreSQL specific and might require specific permissions.
  // They are very unlikely to work correctly or at all via Prisma Accelerate.

  try {
    // Use a transaction for multiple raw SQL steps
    await prisma.$transaction(async (tx) => {
      console.log('Step 1: Attempting to temporarily disable FK constraints (SET session_replication_role)... This might fail.');
      // This often requires superuser privileges and might be blocked by Accelerate
      await tx.$executeRawUnsafe(`SET session_replication_role = 'replica';`);
      console.log('  (Command sent, no guarantee it worked)');

      console.log(`Step 2: Attempting to execute UPDATE "Hotel" SET "id" = "id" - ${ID_OFFSET} ORDER BY "id" ASC... This is the core risky operation.`);
      const updateResult = await tx.$executeRawUnsafe(`UPDATE "Hotel" SET "id" = "id" - ${ID_OFFSET} ORDER BY "id" ASC;`);
      console.log(`  UPDATE command executed. Rows affected (theoretical): ${updateResult}`); // Note: Row count might not be accurate for this type of update.

      console.log('Step 3: Attempting to re-enable FK constraints (SET session_replication_role)... This might fail.');
      await tx.$executeRawUnsafe(`SET session_replication_role = 'origin';`);
      console.log('  (Command sent)');

      console.log('Step 4: Attempting to reset sequence counter... This is VERY unlikely to work via Accelerate and requires correct sequence name.');
      // Find sequence name (usually ModelName_id_seq)
      const sequenceName = 'Hotel_id_seq'; // Assuming default name for PostgreSQL
      // Reset sequence to the next value after the new maximum ID
      // This command might fail if the sequence name is wrong or due to Accelerate/permissions
      console.log(`  Attempting to reset sequence '${sequenceName}'`);
      await tx.$executeRawUnsafe(`SELECT setval('"${sequenceName}"', (SELECT MAX(id) FROM "Hotel"), true);`);
      console.log(`  (Sequence reset command sent for ${sequenceName}, no guarantee it worked)`);

    }, {
      timeout: 60000, // Increase timeout for potentially long operation
    });

    console.log('--- DANGEROUS OPERATION ATTEMPTED --- ');
    console.log('If no errors occurred, the IDs *might* have been updated, but the sequence counter might be incorrect.');
    console.log('Please verify the data and sequence counter manually.');

  } catch (error) {
    console.error('!!! ERROR DURING DANGEROUS RAW SQL OPERATIONS !!!');
    console.error('The operation likely failed. The database state might be inconsistent.');
    console.error('Check error details below:');
    console.error(error);
  }
}

attemptDirectIdSubtraction()
  .catch((e) => {
    // Catch errors outside the transaction as well
    console.error('Script failed unexpectedly:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('--- Script finished attempt ---');
  }); 