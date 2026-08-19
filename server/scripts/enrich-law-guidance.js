/**
 * Attach steps/documents/cautions to preloaded law cards from the statute
 * restatement already stored on each card (LawPhil / .gov.ph sourced).
 * Also audits links and marks everyday PH concerns as high priority.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isAllowedPhLegalUrl } from '../src/utils/phLegalHosts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HIGH_RE =
  /vawc|9262|estafa|theft|swindl|labor|dismiss|wage|13th|land|title|eject|tenant|rent|9653|maceda|consumer|7394|cyber|10175|8484|gcash|maya|bank|11765|privacy|10173|barangay|katarungang|7160|support|custody|annul|family code|physical injur|homicide|murder|traffic|4136|blotter|phishing|unauthorized|access device|solo parent|child abuse|7610|illegal recruitment/i;

const LOW_RE =
  /aviation|hijack|aircraft|mining|forestry|trademark|patent|copyright|sec registration|corporate rehabilitation|agrarian reform beneficiary|electric pilfer|water tapping/i;

function hay(law) {
  return `${law.name || ''} ${law.fullText || ''} ${law.keywords || ''} ${law.category || ''}`.toLowerCase();
}

function pickPriority(law) {
  const h = hay(law);
  if (law.region === 'Davao' || law.category === 'Davao') return 'high';
  if (HIGH_RE.test(h)) return 'high';
  if (LOW_RE.test(h)) return 'low';
  return law.priority || 'medium';
}

function guidanceFor(law) {
  const h = hay(law);
  const steps = [];
  const docs = [];
  const cautions = [];
  let agency = '';

  const add = (arr, item) => {
    if (item && !arr.includes(item)) arr.push(item);
  };

  if (/vawc|9262|domestic|child abuse|7610/.test(h)) {
    add(steps, 'Report to the barangay, PNP Women and Children Protection Desk, or the prosecutor and ask about a protection order.');
    add(docs, 'Valid ID');
    add(docs, 'Medical certificate or photos if there was injury');
    add(docs, 'Messages, recordings, or witnesses that show the abuse');
    add(cautions, 'Do not confront the person if it is unsafe. Ask the barangay or police for help first.');
    agency = 'Barangay / PNP WCPD / DSWD / Prosecutor';
  }
  if (/estafa|scam|fraud|phishing|swindl|unauthorized|gcash|maya|8484|10175|11765|bank/.test(h)) {
    add(steps, 'Freeze or dispute the account with the bank or e-wallet issuer right away, then blotter with PNP or PNP Anti-Cybercrime Group.');
    add(docs, 'Account statements, SMS, receipts, and screenshots of the transfer');
    add(docs, 'Valid ID and a written timeline of what happened');
    add(cautions, 'Do not send more money or share one-time PINs with anyone who claims they can reverse the transfer.');
    agency = agency || 'Bank or e-wallet issuer / BSP / PNP-ACG / NBI';
  }
  if (/labor|dismiss|wage|dole|nlrc|13th|overtime/.test(h) || law.category === 'Labor') {
    add(steps, 'Write down dates, pay, and what management said. File at DOLE or the NLRC if talks fail.');
    add(docs, 'Employment contract, payslips, company ID, and notices');
    agency = agency || 'DOLE / NLRC';
  }
  if (/land|title|eject|tenant|rent|maceda|9653|property/.test(h) || law.category === 'Property') {
    add(steps, 'Keep copies of the title, tax declaration, or lease. Many land and rental disputes start at the barangay.');
    add(docs, 'Title, tax declaration, lease, receipts, and demand letters');
    agency = agency || 'Barangay / Register of Deeds / DHSUD or court as the law provides';
  }
  if (/consumer|7394|warranty|refund/.test(h) || law.category === 'Consumer') {
    add(steps, 'Write the seller a demand for repair, replacement, or refund and keep proof of purchase.');
    add(docs, 'Official receipt, warranty card, photos of the defect, and chat or email with the seller');
    agency = agency || 'DTI / seller complaint desk';
  }
  if (/privacy|10173/.test(h) || law.category === 'Data Privacy') {
    add(steps, 'Write the organization that holds your data, then complain to the National Privacy Commission if they do not act.');
    add(docs, 'Proof of the leak or misuse and copies of your requests');
    agency = agency || 'National Privacy Commission';
  }
  if (/barangay|katarungang|7160/.test(h)) {
    add(steps, 'Ask the barangay for conciliation under the Katarungang Pambarangay rules before going to court, when the dispute is covered.');
    add(docs, 'Valid ID and a short written account of the dispute');
    agency = agency || 'Barangay';
  }
  if (/traffic|4136|lto|license/.test(h)) {
    add(steps, 'Keep the citation or towing record and follow up with LTO or the local traffic office named on the ticket.');
    add(docs, 'Driver’s license, OR/CR, and the ticket or photos of the incident');
    agency = agency || 'LTO / local traffic office';
  }
  if (!steps.length) {
    add(steps, 'Keep a written timeline and copies of papers. Ask the barangay or the agency named in this law where to file.');
    add(docs, 'Valid ID and any contracts, receipts, messages, or photos that prove what happened');
    add(cautions, 'Do not sign a waiver or quitclaim you do not understand.');
    agency = agency || 'Barangay / PAO / the agency named in this law';
  }
  if (!cautions.length) {
    add(cautions, 'Do not ignore a summons, demand letter, or hearing notice.');
  }

  return {
    suggestedNextSteps: steps,
    documentsNeeded: docs,
    cautions,
    recommendedAgency: agency,
  };
}

function fixLink(law) {
  if (law.link && isAllowedPhLegalUrl(law.link)) return law.link;
  if (law.category === 'Davao' || law.region === 'Davao') {
    return 'https://www.davaocity.gov.ph';
  }
  if (law.link && !isAllowedPhLegalUrl(law.link)) {
    return null;
  }
  return law.link || null;
}

function enrichList(list) {
  let droppedLinks = 0;
  const out = list.map((law) => {
    const link = fixLink(law);
    if (law.link && !link) droppedLinks += 1;
    const g = guidanceFor(law);
    return {
      ...law,
      link,
      priority: pickPriority(law),
      suggestedNextSteps: g.suggestedNextSteps,
      documentsNeeded: g.documentsNeeded,
      cautions: g.cautions,
      recommendedAgency: g.recommendedAgency,
    };
  });
  return { out, droppedLinks };
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

const files = [
  path.join(__dirname, '../prisma/phLaws.json'),
  path.join(__dirname, '../prisma/phLawsExtended.json'),
  path.join(__dirname, '../data/davaoLegalSeed.json'),
];

for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const { out, droppedLinks } = enrichList(raw);
  writeJson(file, out);
  const high = out.filter((l) => l.priority === 'high').length;
  console.log(`${path.basename(file)}: ${out.length} cards, ${high} high-priority, ${droppedLinks} disallowed links cleared`);
}
