import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Example seed data
  await prisma.user.createMany({
    data: [
      {
        email: "user1@example.com",
        password: "password123",
        role: "USER",
      },
      {
        email: "admin@example.com",
        password: "password123",
        role: "ADMIN",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seeding completed.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
