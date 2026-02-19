import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Get all clans
  const clans = await prisma.clan.findMany({ select: { id: true, name: true } });

  console.log(`Found ${clans.length} clans to migrate`);

  for (const clan of clans) {
    // Check if a default topic already exists
    const existing = await prisma.chatTopic.findFirst({
      where: { clanId: clan.id, isDefault: true },
    });

    if (existing) {
      console.log(`  Clan "${clan.name}" already has default topic, skipping creation`);
      // Still update messages that don't have a topicId
      const updated = await prisma.message.updateMany({
        where: { clanId: clan.id, topicId: null },
        data: { topicId: existing.id },
      });
      console.log(`  Updated ${updated.count} messages to topic "${existing.name}"`);
      continue;
    }

    // Get the clan creator to use as topic creator
    const clanData = await prisma.clan.findUnique({
      where: { id: clan.id },
      select: { createdById: true },
    });

    if (!clanData) continue;

    // Create default "General" topic
    const topic = await prisma.chatTopic.create({
      data: {
        clanId: clan.id,
        name: "General",
        description: "General chat",
        isDefault: true,
        sortOrder: 0,
        createdById: clanData.createdById,
      },
    });

    console.log(`  Created "General" topic for clan "${clan.name}"`);

    // Update all existing messages in this clan to point to the General topic
    const updated = await prisma.message.updateMany({
      where: { clanId: clan.id, topicId: null },
      data: { topicId: topic.id },
    });

    console.log(`  Updated ${updated.count} messages`);
  }

  console.log("\nMigration complete!");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
