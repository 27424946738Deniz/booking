// count_hotels.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.hotel.count();
    console.log(`Total hotels in database: ${count}`);
  } catch (e) {
    console.error("Error counting hotels:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 