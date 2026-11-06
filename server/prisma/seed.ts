// Idempotent seed: safe to run many times (upserts by unique keys).
// Demo account passwords come ONLY from the DEMO_USER_PASSWORD environment variable.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, ItemStatus, Role } from '@prisma/client';

const prisma = new PrismaClient();

const LOCATIONS = [
  { code: 'HW-LAB', name: 'CPE Hardware Lab' },
  { code: 'MEDIA', name: 'CPE Media Room' },
];

const CATEGORIES = ['Laptop', 'Microcontroller Kit', 'Camera', 'Projector'];

const ITEMS: Array<{
  assetTag: string;
  name: string;
  description: string;
  category: string;
  location: string;
  status?: ItemStatus;
}> = [
  { assetTag: 'LAP-001', name: 'Dell Latitude 5440', description: '14-inch laptop, Core i5, 16 GB RAM', category: 'Laptop', location: 'HW-LAB' },
  { assetTag: 'LAP-002', name: 'Dell Latitude 5440', description: '14-inch laptop, Core i5, 16 GB RAM', category: 'Laptop', location: 'HW-LAB' },
  { assetTag: 'LAP-003', name: 'Lenovo ThinkPad E14', description: '14-inch laptop, Ryzen 5, 16 GB RAM', category: 'Laptop', location: 'HW-LAB' },
  { assetTag: 'ARD-001', name: 'Arduino Uno Starter Kit', description: 'Uno R3 board, breadboard, sensors', category: 'Microcontroller Kit', location: 'HW-LAB' },
  { assetTag: 'ARD-002', name: 'Arduino Uno Starter Kit', description: 'Uno R3 board, breadboard, sensors', category: 'Microcontroller Kit', location: 'HW-LAB' },
  // Seeded in MAINTENANCE for the "request rejected" demo (BR-01).
  { assetTag: 'ARD-003', name: 'ESP32 DevKit Set', description: 'ESP32 board with USB cable', category: 'Microcontroller Kit', location: 'HW-LAB', status: ItemStatus.MAINTENANCE },
  { assetTag: 'CAM-001', name: 'Canon EOS M50', description: 'Mirrorless camera with 15-45 mm lens', category: 'Camera', location: 'MEDIA' },
  { assetTag: 'CAM-002', name: 'Sony ZV-E10', description: 'Mirrorless camera for video', category: 'Camera', location: 'MEDIA' },
  { assetTag: 'PRJ-001', name: 'Epson EB-X51', description: 'Portable XGA projector', category: 'Projector', location: 'MEDIA' },
  { assetTag: 'PRJ-002', name: 'BenQ MW560', description: 'Portable WXGA projector', category: 'Projector', location: 'MEDIA' },
];

const USERS: Array<{ email: string; name: string; role: Role; locations: string[] }> = [
  { email: 'borrower1@lendlab.test', name: 'Borrower One', role: Role.BORROWER, locations: [] },
  { email: 'borrower2@lendlab.test', name: 'Borrower Two', role: Role.BORROWER, locations: [] },
  { email: 'custodian.hw@lendlab.test', name: 'Hardware Lab Custodian', role: Role.CUSTODIAN, locations: ['HW-LAB'] },
  { email: 'custodian.media@lendlab.test', name: 'Media Room Custodian', role: Role.CUSTODIAN, locations: ['MEDIA'] },
];

export async function seed(client: PrismaClient = prisma, demoPassword = process.env.DEMO_USER_PASSWORD) {
  if (!demoPassword || demoPassword.length < 8) {
    throw new Error('DEMO_USER_PASSWORD must be set (at least 8 characters) before seeding.');
  }

  const locationIds: Record<string, number> = {};
  for (const loc of LOCATIONS) {
    const row = await client.location.upsert({
      where: { code: loc.code },
      update: { name: loc.name },
      create: loc,
    });
    locationIds[loc.code] = row.id;
  }

  const categoryIds: Record<string, number> = {};
  for (const name of CATEGORIES) {
    const row = await client.category.upsert({ where: { name }, update: {}, create: { name } });
    categoryIds[name] = row.id;
  }

  for (const item of ITEMS) {
    const data = {
      name: item.name,
      description: item.description,
      categoryId: categoryIds[item.category],
      locationId: locationIds[item.location],
    };
    // On re-seed, keep the current status of existing items (do not undo real loans).
    await client.item.upsert({
      where: { assetTag: item.assetTag },
      update: data,
      create: { ...data, assetTag: item.assetTag, status: item.status ?? ItemStatus.AVAILABLE },
    });
  }

  const passwordHash = await bcrypt.hash(demoPassword, 10);
  for (const user of USERS) {
    // Password, role, and isActive are set only when the account is first created.
    // Re-running the seed (e.g. on the Lab 5 database) must not reset passwords
    // or re-activate accounts that were deactivated.
    const row = await client.user.upsert({
      where: { email: user.email },
      update: { name: user.name },
      create: { email: user.email, name: user.name, role: user.role, passwordHash },
    });
    for (const code of user.locations) {
      await client.custodianLocation.upsert({
        where: { userId_locationId: { userId: row.id, locationId: locationIds[code] } },
        update: {},
        create: { userId: row.id, locationId: locationIds[code] },
      });
    }
  }

  return { locations: LOCATIONS.length, categories: CATEGORIES.length, items: ITEMS.length, users: USERS.length };
}

// Run directly with: npm run db:seed
const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('prisma/seed.ts');
if (isDirectRun) {
  seed()
    .then((counts) => console.log('Seed complete:', counts))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
