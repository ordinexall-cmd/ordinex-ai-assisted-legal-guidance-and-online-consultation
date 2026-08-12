// Delete panel walkthrough lawyer so /lawyer/register?panel=1 can be re-run.
import { prisma } from '../src/config/prisma.js';

const PANEL_EMAIL = 'panel-lawyer@ordinex.demo';

async function main() {
  const user = await prisma.user.findUnique({ where: { email: PANEL_EMAIL } });
  if (!user) {
    console.log(`No user found for ${PANEL_EMAIL}`);
    return;
  }
  await prisma.lawyerVerification.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log(`Deleted panel lawyer ${PANEL_EMAIL}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
