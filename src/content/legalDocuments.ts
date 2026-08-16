export interface LegalSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly string[];
  readonly table?: readonly { readonly label: string; readonly value: string }[];
}

export interface LegalDocument {
  readonly title: string;
  readonly subtitle: string;
  readonly effective: string;
  readonly sections: readonly LegalSection[];
}

export const PRIVACY_DOCUMENT: LegalDocument = {
  title: 'Privacy',
  subtitle:
    'A plain-language summary of how Ordinex uses your information. We follow the Philippine Data Privacy Act (RA 10173). This is a student capstone prototype — not a formal NPC filing.',
  effective: 'Updated January 2026',
  sections: [
    {
      heading: 'In short',
      paragraphs: [
        'We collect only what we need to run your account, AI pre-guidance, lawyer bookings, chat/video, and payments. We do not sell your personal data. Some features send information to trusted service partners (listed below) so those features can work.',
      ],
    },
    {
      heading: 'Who runs Ordinex',
      paragraphs: [
        'Ordinex is built and operated by the Ordinex Capstone Project Team for education and demonstration.',
        'Questions about privacy: privacy@ordinex.local (placeholder contact for the team).',
      ],
    },
    {
      heading: 'What we collect',
      paragraphs: ['Depending on how you use the app, this can include:'],
      bullets: [
        'Account basics — name, email, phone, password (stored securely), and whether you are a citizen or lawyer',
        'Profile details you choose to add — bio, photo, address, occupation; for lawyers, credentials and fees',
        'Case text and files you upload for AI analysis, plus the results and follow-up chat',
        'Booking details — schedule, notes shared with your lawyer, and status updates',
        'Payment amounts and references from checkout (we do not store full card numbers)',
        'Messages, and video session details if you use consultation video (recordings only if you agree)',
        'Basic technical signals needed for login security and to keep the service stable',
      ],
    },
    {
      heading: 'Why we use it',
      paragraphs: ['We use your information to:'],
      bullets: [
        'Create and protect your account (including SMS codes and optional Google sign-in)',
        'Run AI pre-guidance so you can understand your situation before booking a lawyer',
        'Help you find, book, and pay for consultations',
        'Support chat and optional video between you and your lawyer',
        'Verify lawyers so citizens can trust who they book',
        'Prevent abuse and keep the platform reliable',
      ],
    },
    {
      heading: 'Who we share with',
      paragraphs: [
        'We only share data with partners when a feature needs them. They must follow their own privacy rules too:',
      ],
      bullets: [
        'AI providers (such as Groq, and OpenAI if enabled) — to generate analysis and translations from the text you submit',
        'PayMongo — to process GCash / checkout payments',
        'Supabase — cloud database and file storage when the project is configured for production hosting',
        'Google — sign-in, fonts/icons, and helping video calls connect',
        'Email / SMS providers (such as Google SMTP or Semaphore) — for one-time codes or notifications when enabled',
        'PeerJS network defaults — to help video consultation connect across different networks',
      ],
    },
    {
      heading: 'About the AI',
      paragraphs: [
        'AI answers are pre-guidance only — helpful starting points, not formal legal advice, and not a lawyer–client relationship with Ordinex. Text you submit for analysis may be sent to the AI providers above to produce a result.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'Under RA 10173 you can ask to see, correct, or delete your data, or withdraw consent (some features may stop working). Use Account Settings where available, or email the team contact above. You can also reach the National Privacy Commission if you have a complaint.',
        'We keep account and service records while needed to run the prototype. Demo environments may be reset for presentations — avoid storing irreplaceable personal files there.',
      ],
    },
    {
      heading: 'Safety and age',
      paragraphs: [
        'We use standard protections such as hashed passwords, signed login sessions, and rate limits. No system is perfect — share only what you need for your case.',
        'Ordinex is intended for adults (18 and older).',
      ],
    },
  ],
};

export const TERMS_DOCUMENT: LegalDocument = {
  title: 'Terms of use',
  subtitle:
    'Simple rules for using Ordinex. By signing up, agreeing to the privacy checkbox, or paying at checkout, you accept these terms. This is a student prototype, not commercial legal counsel.',
  effective: 'Updated January 2026',
  sections: [
    {
      heading: 'What Ordinex is',
      paragraphs: [
        'Ordinex helps Filipinos get AI pre-guidance on a legal concern, then find and book a verified lawyer, chat or meet by video, and pay at booking time.',
        'Ordinex is not a law firm. We do not practice law ourselves.',
      ],
    },
    {
      heading: 'Your account',
      paragraphs: [
        'Please give accurate information. Citizens and lawyers have different tools. Lawyers must finish verification before they appear as verified counsel. Keep your login private. We may suspend accounts used for abuse or fraud.',
      ],
    },
    {
      heading: 'About AI results',
      paragraphs: [
        'AI output can be incomplete or wrong. Using the AI alone does not create a lawyer–client relationship with Ordinex. For formal advice, book a licensed lawyer on the platform or consult counsel elsewhere.',
      ],
    },
    {
      heading: 'Bookings and consultations',
      paragraphs: [
        'Requests, quotes, and sessions follow the statuses you see in the app. Notes you attach to a booking may be visible to that lawyer. Video recording or transcripts only happen if the app asks and you agree.',
      ],
    },
    {
      heading: 'Paying for bookings',
      paragraphs: [
        'You pay when you book — there is no monthly Ordinex membership fee. From the lawyer’s quoted fee, Ordinex keeps 15% as a platform fee; the rest is credited to the lawyer in the app.',
        'Checkout may use PayMongo (for example GCash). Capstone demos often use test mode or a simulated payment. Refunds and real bank payouts may be limited in this prototype.',
      ],
    },
    {
      heading: 'Please do not',
      paragraphs: ['You agree not to:'],
      bullets: [
        'Attack, overload, or break into the system',
        'Pretend to be someone else or fake lawyer credentials',
        'Use Ordinex for harassment, fraud, or other illegal activity',
        'Resell access without permission',
        'Upload content you have no right to share',
      ],
    },
    {
      heading: 'Limits of responsibility',
      paragraphs: [
        'Ordinex is provided as-is for learning and demonstration. To the fullest extent Philippine law allows, the team is not responsible for losses from downtime, incorrect AI results, or outcomes of legal matters. If something goes wrong with a paid booking, any responsibility is limited to what you paid for that booking through Ordinex (or zero if you paid nothing), except where the law says we cannot limit liability.',
      ],
    },
    {
      heading: 'Law that applies',
      paragraphs: [
        'These terms follow the laws of the Republic of the Philippines. How we handle personal data is explained on the Privacy page.',
      ],
    },
  ],
};

export const LICENSES_DOCUMENT: LegalDocument = {
  title: 'Credits & licenses',
  subtitle:
    'Thank-you notes for the tools and services behind Ordinex. Our own code is shared under an MIT license. Partner companies keep their own terms.',
  effective: 'Copyright © 2026 Ordinex Capstone Project Team',
  sections: [
    {
      heading: 'Our code',
      paragraphs: [
        'The Ordinex application was built by the Ordinex Capstone Project Team. We release our own source code under the MIT license, which means others may use and share it with credit. The full legal text is in the project’s LICENSE file.',
      ],
    },
    {
      heading: 'What we built with',
      paragraphs: [
        'Like most modern apps, Ordinex stands on open-source building blocks. We gratefully use:',
      ],
      bullets: [
        'React — the screens and interactions you see in the browser',
        'Express and Prisma — the server API and database layer',
        'Socket.IO — live updates for bookings and chat',
        'PeerJS — connecting video consultations',
        'Tailwind CSS, web fonts, and Material icons — layout and visual design',
        'Workbox / PWA tooling — so you can install Ordinex on your phone home screen',
      ],
    },
    {
      heading: 'Allowed to use?',
      paragraphs: [
        'Yes. These libraries use friendly open-source licenses (mainly MIT, Apache, and BSD). That means we can use them in this project as long as we give credit — which this page and our repository notices are for.',
      ],
    },
    {
      heading: 'Online services we connect to',
      paragraphs: [
        'Some features talk to outside companies. Those services are not “open source packages”; they run under each company’s own terms:',
      ],
      bullets: [
        'PayMongo — GCash and checkout payments',
        'Groq (and OpenAI if enabled) — AI analysis and translation',
        'Supabase — hosted database and files when configured',
        'Google — sign-in, fonts, and helping video calls connect',
        'SMS / email providers — one-time codes and notices when enabled',
      ],
    },
    {
      heading: 'Public legal research sources',
      paragraphs: [
        'These are public Philippine websites, not software Ordinex owns or ships. We list them because AI case analysis and legal research in this project are grounded in publicly available Philippine law materials. Ordinex does not claim ownership of their content; visit each site for its own terms of use.',
      ],
      bullets: [
        'Official Gazette — https://www.officialgazette.gov.ph/',
        'Department of Justice — https://www.doj.gov.ph/',
        'Supreme Court e-Library — https://elibrary.judiciary.gov.ph/',
        'LawPhil — https://lawphil.net/',
      ],
    },
    {
      heading: 'Full technical list',
      paragraphs: [
        'For reviewers who need every software package name and license type, the project includes a generated file called THIRD_PARTY_NOTICES.md in the repository (refresh with npm run licenses:generate). Everyday users do not need that list — this page is the human summary. Public research sites above are credits for sources, not npm licenses, so they are not duplicated in that file.',
      ],
    },
  ],
};
