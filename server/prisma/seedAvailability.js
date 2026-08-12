// Shared availability slot seeding for demo lawyers (used by seed.js and reset-demo-state.js).

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} lawyerId
 * @param {string} publicLawyerId
 */
export async function seedAvailabilitySlots(prisma, lawyerId, publicLawyerId) {
  const seedSlotsFor = async (lid) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const slots = [];
    let day = 1;
    while (slots.length < 5 && day < 14) {
      const d = new Date(today.getTime() + day * 86400_000);
      const weekday = d.getUTCDay();
      if (weekday !== 0 && weekday !== 6) {
        slots.push({ date: d, startTime: '09:00', endTime: '10:00' });
        if (slots.length < 5) slots.push({ date: d, startTime: '14:00', endTime: '15:00' });
      }
      day++;
    }
    const existing = await prisma.availability.findMany({
      where: { lawyerId: lid },
      select: { id: true },
    });
    const availabilityIds = existing.map((a) => a.id);

    await prisma.$transaction(async (tx) => {
      if (availabilityIds.length > 0) {
        const bookings = await tx.booking.findMany({
          where: { availabilityId: { in: availabilityIds } },
          select: { id: true },
        });
        const bookingIds = bookings.map((b) => b.id);
        if (bookingIds.length > 0) {
          await tx.recordHash.deleteMany({ where: { bookingId: { in: bookingIds } } });
          await tx.review.deleteMany({ where: { bookingId: { in: bookingIds } } });
          await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
        }
      }
      await tx.availability.deleteMany({ where: { lawyerId: lid } });
      for (const s of slots) {
        await tx.availability.create({ data: { ...s, lawyerId: lid } });
      }
    });

    return slots.length;
  };

  const lawyerSlots = await seedSlotsFor(lawyerId);
  const publicSlots = publicLawyerId ? await seedSlotsFor(publicLawyerId) : 0;
  return { lawyerSlots, publicSlots };
}
