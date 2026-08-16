/**
 * Upsert Civil Code Arts. 2176 keywords + 2183 animal liability without a full reseed.
 */
import { prisma } from '../src/config/prisma.js';

const ART_2176_KEYWORDS =
  'quasi-delict, tort, art 2176, negligence, vehicular accident, malpractice, damages, dog bite, animal bite, aso, nakagat, giokot, iro, pet, stray dog, kagat';

const ART_2183 = {
  category: 'Civil',
  name: 'Liability of Possessors of Animals',
  fullText:
    "The possessor of an animal or whoever may make use of the same is responsible for the damage which it may cause, although it may escape or be lost. This responsibility shall cease only in case the damage should come from force majeure or from the fault of the person who has suffered damage. Common applications: dog bites, stray animals under a keeper's control, livestock causing injury.",
  link: 'https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html',
  keywords:
    'art 2183, animal liability, dog bite, aso, nakagat, giokot, iro, pet, stray dog, kagat, possessor of animal, Civil Code',
};

async function main() {
  const quasi = await prisma.lawReference.findFirst({
    where: { name: 'Quasi-Delicts (Tort Liability)' },
  });
  if (quasi) {
    await prisma.lawReference.update({
      where: { id: quasi.id },
      data: { keywords: ART_2176_KEYWORDS },
    });
    console.log('Updated Art. 2176 keywords');
  } else {
    console.log('Art. 2176 row not found; skip keyword update');
  }

  const existing = await prisma.lawReference.findFirst({
    where: { name: ART_2183.name },
  });
  if (existing) {
    await prisma.lawReference.update({
      where: { id: existing.id },
      data: ART_2183,
    });
    console.log('Updated Art. 2183');
  } else {
    await prisma.lawReference.create({ data: ART_2183 });
    console.log('Created Art. 2183');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
