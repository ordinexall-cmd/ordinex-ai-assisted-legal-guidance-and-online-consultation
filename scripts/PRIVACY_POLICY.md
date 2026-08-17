# Ordinex — Privacy Policy

> **Website note:** The in-app page at `/privacy` is a shorter plain-language summary for users. This file is the fuller written policy for the repository and submissions. Facts should match.

**System:** Ordinex (OXfinal) — Philippine legal pre-guidance and lawyer marketplace  
**Effective date:** 1 January 2026  
**Governing law:** Republic Act No. 10173 (Data Privacy Act of 2012)  
**Supervisory authority:** National Privacy Commission (NPC)

This is a **capstone / prototype** privacy notice. It describes how Ordinex intends to handle personal data. It is not a substitute for formal NPC registration, a designated Data Protection Officer appointment, or advice from counsel.

---

## 1. Who we are

Ordinex is operated by the **Ordinex Capstone Project Team** for educational demonstration of AI-assisted legal pre-guidance, verified lawyer discovery, booking, video consultation, and payments.

Contact for privacy questions (placeholder): `privacy@ordinex.local`

---

## 2. Scope

This policy applies to:

- Citizens who create accounts, run AI analyses, book lawyers, pay for consultations, or use messaging/video  
- Lawyers who register, verify identity, set fees/availability, and conduct consultations  
- Visitors who use guest preview features on the landing page (limited data)

---

## 3. Personal data we process

Depending on your role and features you use, we may process:

| Category | Examples |
|----------|----------|
| Account | Name, email, phone, password hash, role (citizen/lawyer) |
| Profile | Bio, avatar, address, occupation, civil status, date of birth (citizen); bar/roll number, specializations, fees, credentials (lawyer) |
| Case / AI | Case descriptions, uploaded documents (PDF/DOCX text extracts), AI analysis results, follow-up chat |
| Booking | Slot times, case notes shared with a booked lawyer, booking status |
| Payments | Booking amounts, platform fee (10%), PayMongo session/payment references (not full card numbers stored by Ordinex) |
| Communications | In-app booking chat, optional translations, video session metadata; recording/transcript only if you consent in preflight |
| Technical | Auth tokens, IP/device signals for security and rate limits, PWA install preference |

Sensitive or case-related content may reveal health, family, or criminal-matter context. Treat such content as confidential and share only what is needed for the service.

---

## 4. Purposes of processing

We process personal data to:

1. Create and secure accounts (including OTP and optional Google Sign-In)  
2. Provide AI **pre-guidance** (not formal legal advice)  
3. Match and book consultations with lawyers  
4. Process payments and ledger platform fees  
5. Enable messaging and optional video consultations  
6. Verify lawyer identity for marketplace trust  
7. Improve reliability, prevent abuse, and meet academic demo requirements  

Legal bases under RA 10173 typically include **consent** (signup checkbox), **contract** (providing the booked service), and **legitimate interests** limited to security and service integrity.

---

## 5. Third-party processors and services

Ordinex may share data with the following processors **only as needed** to run the product. Each is subject to its own terms and privacy practices:

| Processor | Role |
|-----------|------|
| **Groq** | Large-language-model inference for analysis, follow-up, and translation (when configured) |
| **Google Gemini** | LLM fallback, vision KYC, and multimodal (when configured) |
| **Supabase** | Cloud database, file storage, and vector search (when configured for production) |
| **PayMongo** | Payment checkout (e.g. GCash) |
| **Google** | OAuth sign-in; Fonts/Icons CDN; WebRTC STUN |
| **Semaphore** | SMS OTP delivery (when configured) |
| **Gmail SMTP** | Transactional email & OTP delivery (when configured) |
| **PeerJS cloud / TURN** | WebRTC signaling and NAT traversal defaults for video |

Local development may use SQLite and simulated payments without cloud processors.

---

## 6. AI disclaimer

AI outputs are **informational pre-guidance only**. They do not create an attorney–client relationship and are not a substitute for advice from a licensed Philippine lawyer. Case text you submit may be sent to configured AI processors to generate results.

---

## 7. Retention

- Account and profile data: while the account remains active, or until deletion is requested and processed  
- Analyses and bookings: retained for service history, recycle-bin retention windows, and demo reset procedures  
- Payment records: retained as needed for ledger reconciliation and dispute review  
- OTP challenges: short-lived  

Capstone databases may be wiped for defense demos (`defense-reset`). Do not store irreplaceable personal data in demo environments.

---

## 8. Your rights

Subject to RA 10173 and applicable exceptions, you may request:

- Access to personal data we hold about you  
- Correction of inaccurate data  
- Withdrawal of consent (may limit features)  
- Deletion or account closure, where feasible for a prototype  

Use in-app account settings where available, or contact the team email above. You may also lodge a complaint with the NPC.

---

## 9. Security measures

Ordinex uses industry-common controls appropriate for a student prototype, including password hashing (bcrypt), JWT session tokens, HTTPS in deployed/tunnel environments, Helmet security headers, and rate limiting. No system is perfectly secure; avoid uploading highly sensitive originals when a summary will do.

---

## 10. Children

The service is intended for adults (18+) seeking legal information or lawyer consultations. We do not knowingly target children.

---

## 11. Changes

We may update this notice as the product evolves. Material changes will be reflected by updating the effective date on this page and in `docs/legal/PRIVACY_POLICY.md`.

---

## 12. Related documents

- [Terms of Service](/terms)  
- [Open-source licenses & credits](/licenses)  
- Repository `LICENSE` file
