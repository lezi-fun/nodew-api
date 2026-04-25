import { prisma } from '../../src/lib/prisma.js';

export const resetDatabase = async () => {
  await prisma.usageLog.deleteMany();
  await prisma.relaySelectionState.deleteMany();
  await prisma.aPIKey.deleteMany();
  await prisma.redemption.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.systemOption.deleteMany();
  await prisma.setupState.deleteMany();
  await prisma.user.deleteMany();
  await prisma.group.deleteMany();
};

export const disconnectDatabase = async () => {
  await prisma.$disconnect();
};
