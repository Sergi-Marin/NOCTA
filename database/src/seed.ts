import { db } from "./index.js";

async function seed(): Promise<void> {
  console.log("Seeding database...");

  // Example: upsert a dev guild
  await db.guild.upsert({
    where: { discordId: "000000000000000000" },
    update: {},
    create: {
      discordId: "000000000000000000",
      name: "NOCTA Dev Server",
      settings: {
        create: {
          prefix: "!",
          language: "en",
        },
      },
    },
  });

  console.log("Seeding complete.");
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
