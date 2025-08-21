// prisma/seed.js
/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Pakai email sebagai "username" admin
  const emailAsUsername = process.env.SEED_ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'kerja@arkwork.com';
  const rawPassword     = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'tanpaBatas*888';
  const passwordHash    = await bcrypt.hash(rawPassword, 10);

  // Pastikan kolom `username` di tabel "Admin" memiliki unique index
  const admin = await prisma.admin.upsert({
    where: { username: emailAsUsername },
    update: { passwordHash },
    create: { username: emailAsUsername, passwordHash },
  });

  console.log('Seeded admin:', admin.username);
}

main()
  .catch((e) => {
    console.error('SEED ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  