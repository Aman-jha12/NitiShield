import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.upsert({
    where: { email: "demo@claimshield.local" },
    update: { passwordHash, name: "Demo User" },
    create: {
      email: "demo@claimshield.local",
      name: "Demo User",
      passwordHash,
    },
  });
  console.log("Seeding completed. Demo login: demo@claimshield.local / password123");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
