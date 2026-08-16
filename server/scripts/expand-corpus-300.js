import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extPath = path.join(__dirname, '../prisma/phLawsExtended.json');
const basePath = path.join(__dirname, '../prisma/phLaws.json');

const baseLaws = JSON.parse(fs.readFileSync(basePath, 'utf8'));
const existingExt = JSON.parse(fs.readFileSync(extPath, 'utf8'));

const existingNames = new Set([...baseLaws.map(l => l.name.toLowerCase()), ...existingExt.map(l => l.name.toLowerCase())]);

const newLaws = [
  // 1. Civil Law & Property
  {
    category: "Civil Law",
    name: "Civil Law — Right of Way and Legal Easement (Access to Public Highway)",
    citation: "Civil Code Arts. 649-657",
    region: "National",
    priority: "high",
    fullText: "An owner or possessor of an immovable property surrounded by other estates without adequate outlet to a public highway is entitled to demand a right of way through neighboring estates upon payment of proper indemnity. The easement must be established at the point least prejudicial to the servient estate and where the distance to the public highway is shortest.",
    link: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html",
    keywords: "right of way, easement, enclosed estate, driveway, neighbor land, access road, servient estate, dominant estate, daanan"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Boundary Encroachment in Good Faith vs Bad Faith",
    citation: "Civil Code Arts. 448 & 450",
    region: "National",
    priority: "high",
    fullText: "A builder in good faith who constructs a house or structure partially on adjoining land is protected: the landowner must choose between appropriating the building after paying indemnity or compelling the builder to purchase the land (unless value is considerably higher). A builder in bad faith loses whatever is built without indemnity and is liable for damages.",
    link: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html",
    keywords: "encroachment, boundary line, built on my land, overstepping wall, good faith builder, bad faith, bakod, harang, lupang nasakop"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Nuisance and Abatement of Hazardous or Noisy Structures",
    citation: "Civil Code Arts. 694-707",
    region: "National",
    priority: "high",
    fullText: "A nuisance is any act, omission, or condition that endangers life or health, offends the senses, shocks decency, or obstructs the free use of property. A private nuisance may be abated by the injured party without judicial proceedings only if executed without breach of peace, with prior demand, and approval of local health authority.",
    link: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html",
    keywords: "nuisance, loud noise, foul odor, hazardous building, barking dogs, videoke curfew, tree branches overhang, perwisyo"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Action for Ejectment (Forcible Entry and Unlawful Detainer)",
    citation: "Rules of Court Rule 70; Civil Code Art. 539",
    region: "National",
    priority: "high",
    fullText: "A person deprived of physical possession of land or building by force, intimidation, threat, strategy, or stealth (forcible entry) or a lessor/vendor whose tenant/buyer unlawfully withholds possession after expiration of right (unlawful detainer) may file an ejectment suit in the MTC within 1 year from unlawful withholding or discovery.",
    link: "https://sc.judiciary.gov.ph",
    keywords: "ejectment, unlawful detainer, forcible entry, eviction, squatting, illegal occupant, demand letter to vacate, paalisin"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Accion Publiciana (Recovery of Plenary Possession Beyond One Year)",
    citation: "Civil Code Art. 555; Jurisprudence",
    region: "National",
    priority: "high",
    fullText: "Accion Publiciana is an ordinary plenary civil action for the recovery of the better right of possession (jus possessionis) of real property when the dispossession has lasted for more than one year, filed in the RTC or MTC depending on the assessed value of the real property.",
    link: "https://sc.judiciary.gov.ph",
    keywords: "accion publiciana, recovery of possession, more than 1 year, squatter occupant, right of possession, bawi ng lupa"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Accion Reivindicatoria (Recovery of Ownership and Possession)",
    citation: "Civil Code Art. 434; Jurisprudence",
    region: "National",
    priority: "high",
    fullText: "Accion Reivindicatoria is an action whereby the plaintiff claims ownership of a parcel of land and seeks the recovery of full possession and title from the defendant. The plaintiff must prove the identity of the land and valid title (such as a Torrens title or incontestable patent).",
    link: "https://sc.judiciary.gov.ph",
    keywords: "accion reivindicatoria, recovery of ownership, torrens title dispute, fake title, claim of land, agawan ng lupa, titulo"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Extrajudicial Settlement of Estate with Deed of Sale",
    citation: "Rules of Court Rule 74 §1; Civil Code Arts. 1078-1105",
    region: "National",
    priority: "high",
    fullText: "If the decedent left no will and no debts, the heirs of age may divide the estate among themselves extrajudicially by a public instrument filed with the Register of Deeds, accompanied by publication in a newspaper of general circulation once a week for 3 consecutive weeks, subject to a 2-year lien under Rule 74 §4.",
    link: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html",
    keywords: "extrajudicial settlement, EJS, inheritance partition, pamana, namatay na magulang, heirs partition, estate tax, deed of partition"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Preterition and Disinheritance of Compulsory Heirs",
    citation: "Civil Code Arts. 854 & 915-923",
    region: "National",
    priority: "medium",
    fullText: "The preterition (total omission) of one, some, or all of the compulsory heirs in the direct line, whether living at the execution of the will or born after the death of the testator, annuls the institution of heir. Disinheritance can only be effected through a valid will stating a legal cause specified by law.",
    link: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html",
    keywords: "preterition, disinheritance, compulsory heir, illegitimate child inheritance, excluded in will, mana, mana ng anak, testamento"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Donation Inter Vivos and Revocation for Ingratitude",
    citation: "Civil Code Arts. 725-773",
    region: "National",
    priority: "medium",
    fullText: "A donation of immovable property must be made in a public document specifying the property and acceptance by the donee. A donation may be revoked by the donor on grounds of ingratitude: if the donee commits an offense against the person, honor, or property of the donor or refuses support when legally bound.",
    link: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html",
    keywords: "donation inter vivos, deed of donation, revoke donation, ingratitude, binigay na lupa, bawiin ang donasyon"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Quasi-Delict / Vehicular Accident Liability of Vehicle Owner and Driver",
    citation: "Civil Code Arts. 2176, 2180, & 2184",
    region: "National",
    priority: "high",
    fullText: "Whoever by act or omission causes damage to another through fault or negligence is obliged to pay for the damage. Registered owners of motor vehicles are primarily and directly liable to third parties for damages caused by the operation of the vehicle, with employer subsidiary liability under Art. 2180.",
    link: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html",
    keywords: "vehicular accident, car crash, hit and run, quasi-delict, damages, registered owner rule, nabangga, danyos perwisyo, insurance claim"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Breach of Contract and Rescission under Article 1191",
    citation: "Civil Code Art. 1191",
    region: "National",
    priority: "high",
    fullText: "The power to rescind reciprocal obligations is implied in case one of the obligors should not comply with what is incumbent upon him. The injured party may choose between the fulfillment and the rescission of the obligation, with the payment of damages in either case.",
    link: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html",
    keywords: "breach of contract, rescission, cancel contract, failed to deliver, refund deposit, contract of sale, kasunduan, atraso"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Law on Maceda (Installment Buyer Protection Act)",
    citation: "RA 6552 (Maceda Law)",
    region: "National",
    priority: "high",
    fullText: "Protects buyers of real estate on installment (subdivision lots, condominium units). If buyer has paid at least 2 years of installments, they are entitled to a grace period of 1 month for every year of installment and a cash surrender value of at least 50% (+5% per year up to 90%) upon cancellation of contract.",
    link: "https://lawphil.net/statutes/repacts/ra1972/ra_6552_1972.html",
    keywords: "maceda law, condo installment refund, subdivision lot cancellation, cash surrender value, grace period, hulugang lupa"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Condominium Act and Master Deed Restrictions",
    citation: "RA 4726 (Condominium Act)",
    region: "National",
    priority: "medium",
    fullText: "Governs ownership of individual condo units and co-ownership of common areas. Unit owners are bound by the Master Deed and Declaration of Restrictions. Assessment of dues, condo corp voting rights, and repair/rebuilding after damage or condemnation are regulated under this law.",
    link: "https://lawphil.net/statutes/repacts/ra1966/ra_4726_1966.html",
    keywords: "condominium act, condo dues, master deed, condo corporation, common areas, condo association dispute, bawal alagang hayop"
  },

  // 2. Family Law & Domestic Relations
  {
    category: "Family Law",
    name: "Family Law — Psychological Incapacity (Nullity of Marriage under Article 36)",
    citation: "Family Code Art. 36; Tan-Andal v. Andal (G.R. No. 196359, 2021)",
    region: "National",
    priority: "high",
    fullText: "A marriage contracted by any party who, at the time of the celebration, was psychologically incapacitated to comply with the essential marital obligations of marriage, shall be void ab initio. Under the Tan-Andal doctrine, psychological incapacity is a legal concept, not strictly medical, proved through clear and convincing evidence of enduring personality structure.",
    link: "https://sc.judiciary.gov.ph",
    keywords: "annulment, nullity of marriage, article 36, psychological incapacity, tan-andal, hiwalayan, kasal, void marriage"
  },
  {
    category: "Family Law",
    name: "Family Law — Legal Separation vs Annulment (Grounds and Effects)",
    citation: "Family Code Arts. 55-67",
    region: "National",
    priority: "high",
    fullText: "Legal separation allows spouses to live separately and dissolves the absolute community/conjugal property without severing the marital bond (neither party can remarry). Grounds include repeated physical violence, sexual infidelity, abandonment for more than 1 year, and lesbianism/homosexuality.",
    link: "https://lawphil.net/statutes/repacts/ra1987/ra_209_1987.html",
    keywords: "legal separation, conjugal property dissolution, abandonment, infidelity, concubinage, separate lives, hiwalay pero kasal"
  },
  {
    category: "Family Law",
    name: "Family Law — Child Custody and the Tender Age Presumption",
    citation: "Family Code Art. 213; Supreme Court En Banc Jurisprudence",
    region: "National",
    priority: "high",
    fullText: "In all custody disputes, the best interest of the child is paramount. No child under seven (7) years of age shall be separated from the mother unless the court finds compelling reasons (such as extreme neglect, drug abuse, or moral depravity) to order otherwise.",
    link: "https://sc.judiciary.gov.ph",
    keywords: "child custody, tender age rule, under 7 years old, visitation rights, custody battle, ina ang bata, sustento"
  },
  {
    category: "Family Law",
    name: "Family Law — Compulsory Child Support and Legal Remedies for Non-Support",
    citation: "Family Code Arts. 194-208; RA 9262 §5(e)",
    region: "National",
    priority: "high",
    fullText: "Parents are legally obliged to provide support (sustenance, dwelling, clothing, medical attendance, and education) to their children in proportion to their resources and child's necessity. Wilful deprivation of financial support to a child or spouse is punishable as economic abuse under RA 9262 §5(e).",
    link: "https://lawphil.net/statutes/repacts/ra2004/ra_9262_2004.html",
    keywords: "child support, sustento, non-support, economic abuse, tuition fee, allowance, illegitimate child support, tatay ayaw magsustento"
  },
  {
    category: "Family Law",
    name: "Family Law — Paternity, Filiation, and Proof of Illegitimate Children",
    citation: "Family Code Arts. 172-176; RA 9858",
    region: "National",
    priority: "high",
    fullText: "Illegitimate children shall use the surname of their father if their filiation has been expressly recognized by the father in the record of birth, or in a public instrument or private handwritten instrument. Illegitimate children are entitled to support and legitime equal to one-half of the legitime of a legitimate child.",
    link: "https://lawphil.net/statutes/repacts/ra2009/ra_9858_2009.html",
    keywords: "paternity, recognition of child, birth certificate acknowledgment, AUSF, affidavit of acknowledgment, surname of father, mana ng bastardo"
  },
  {
    category: "Family Law",
    name: "Family Law — Domestic Administrative Adoption and Child Care Act",
    citation: "RA 11642 (Domestic Administrative Adoption Act)",
    region: "National",
    priority: "medium",
    fullText: "RA 11642 established the National Child Care Authority (NACC) and streamlined the adoption process into an administrative proceeding, removing the mandatory judicial court filing for domestic adoptions, making adoption faster, inexpensive, and child-centered.",
    link: "https://lawphil.net/statutes/repacts/ra2022/ra_11642_2022.html",
    keywords: "adoption, administrative adoption, NACC, adopt child, DSWD adoption, simulated birth rectification, ampon"
  },
  {
    category: "Family Law",
    name: "Family Law — Simulation of Birth Rectification Act",
    citation: "RA 11222",
    region: "National",
    priority: "medium",
    fullText: "Grants administrative amnesty to persons who simulated the birth record of a child prior to March 2019, provided the child has been living with the person for at least 3 years and simulation was done for the best interest of the child. Rectification is processed through NACC/DSWD without criminal liability.",
    link: "https://lawphil.net/statutes/repacts/ra2019/ra_11222_2019.html",
    keywords: "simulation of birth, fake birth certificate, fix child birth cert, amnesty, rectified adoption, inayos na birth cert"
  },
  {
    category: "Family Law",
    name: "Family Law — Barangay Protection Order (BPO) and Temporary Protection Order (TPO)",
    citation: "RA 9262 §§8-15 (Anti-VAWC Act)",
    region: "National",
    priority: "high",
    fullText: "A victim of domestic or dating violence can immediately obtain an ex-parte Barangay Protection Order (BPO) from the Punong Barangay effective for 15 days, or apply for a Temporary Protection Order (TPO) from the Family Court / RTC prohibiting perpetrator from contacting, approaching within distance, or possessing weapons.",
    link: "https://lawphil.net/statutes/repacts/ra2004/ra_9262_2004.html",
    keywords: "BPO, TPO, PPO, protection order, barangay protection order, domestic violence, restraining order, binugbog, bantang pananakit"
  },
  {
    category: "Family Law",
    name: "Family Law — Solo Parents Welfare and Expanded Benefits Act",
    citation: "RA 11861 (Expanded Solo Parents Welfare Act)",
    region: "National",
    priority: "high",
    fullText: "Provides comprehensive benefits for solo parents: ₱1,000 monthly cash subsidy for low-income solo parents, 10% discount and VAT exemption on baby food/diapers/medicines for children up to 6 years old, 7 days paid parental leave, and priority in housing and scholarship programs.",
    link: "https://lawphil.net/statutes/repacts/ra2022/ra_11861_2022.html",
    keywords: "solo parent, single mother, single father, solo parent ID, solo parent cash subsidy, parental leave, DSWD solo parent"
  },

  // 3. Labor & Employment Law
  {
    category: "Labor Law",
    name: "Labor Law — Just Causes vs Authorized Causes for Termination of Employment",
    citation: "Labor Code Arts. 297-298 [282-283]",
    region: "National",
    priority: "high",
    fullText: "Just causes for dismissal include serious misconduct, willful disobedience, gross neglect of duties, fraud/loss of confidence, or crime against employer (no separation pay). Authorized causes include installation of labor-saving devices, redundancy, retrenchment to prevent losses, or closure (mandatory separation pay).",
    link: "https://www.dole.gov.ph",
    keywords: "illegal dismissal, just cause, authorized cause, redundancy, separation pay, tinanggal sa trabaho, DOLE complaint, NLRC"
  },
  {
    category: "Labor Law",
    name: "Labor Law — Redundancy and Retrenchment Separation Pay Computation",
    citation: "Labor Code Art. 298; DOLE DO 147-15",
    region: "National",
    priority: "high",
    fullText: "In redundancy, separation pay must be at least 1 month pay or 1 month pay per year of service, whichever is higher. In retrenchment, at least 1 month pay or 1/2 month pay per year of service. Mandatory 30-day written notice to employee and DOLE Regional Office is required.",
    link: "https://www.dole.gov.ph",
    keywords: "redundancy pay, retrenchment computation, separation package, 30 days notice, DOLE notice, lay off, tinanggal"
  },
  {
    category: "Labor Law",
    name: "Labor Law — Constructive Dismissal (Forced Resignation and Hostile Work Environment)",
    citation: "Labor Code; Supreme Court Jurisprudence",
    region: "National",
    priority: "high",
    fullText: "Constructive dismissal exists when an employee is forced to resign because continued employment is rendered impossible, unreasonable, or unlikely due to demotion in rank, diminution in pay, harassment, or unbearable discrimination by the employer. Entitles employee to reinstatement, backwages, and moral damages.",
    link: "https://sc.judiciary.gov.ph",
    keywords: "constructive dismissal, forced resignation, pinag-resign, demotion, floating status over 6 months, harassment sa opisina"
  },
  {
    category: "Labor Law",
    name: "Labor Law — Floating Status Rule (Suspension of Operation Limit of 6 Months)",
    citation: "Labor Code Art. 301 [286]; DOLE DO 215-20",
    region: "National",
    priority: "high",
    fullText: "Bona-fide suspension of the operation of a business or temporary off-detail (floating status of security guards/BPO agents) shall not exceed six (6) months. If the employee is not recalled or placed after 6 months, they are deemed constructively dismissed and entitled to separation pay.",
    link: "https://www.dole.gov.ph",
    keywords: "floating status, security guard off-detail, 6 months floating, standby walang sahod, constructive dismissal"
  },
  {
    category: "Labor Law",
    name: "Labor Law — 13th Month Pay Presidential Decree and DOLE Guidelines",
    citation: "PD 851; DOLE Labor Advisory No. 25-23",
    region: "National",
    priority: "high",
    fullText: "All rank-and-file employees who have worked for at least 1 month during the calendar year are entitled to 13th month pay not later than December 24. Computation is total basic salary earned during the year divided by 12. No exemptions are allowed for distressed employers.",
    link: "https://www.dole.gov.ph",
    keywords: "13th month pay, mandatory bonus, december 24 deadline, DOLE 13th month computation, walang 13th month"
  },
  {
    category: "Labor Law",
    name: "Labor Law — Service Incentive Leave (SIL) and Cash Conversion",
    citation: "Labor Code Art. 95",
    region: "National",
    priority: "medium",
    fullText: "Every employee who has rendered at least one year of service is entitled to a yearly service incentive leave of five (5) days with pay. Unused SIL must be converted to its cash equivalent at the end of the year or upon separation from service.",
    link: "https://www.dole.gov.ph",
    keywords: "service incentive leave, SIL, 5 days leave, leave monetization, unused leave conversion, bayad sa leave"
  },
  {
    category: "Labor Law",
    name: "Labor Law — Maternity Leave Benefits under 105-Day Expanded Act",
    citation: "RA 11210 (Expanded Maternity Leave Act)",
    region: "National",
    priority: "high",
    fullText: "All female workers in the public and private sectors are granted 105 days paid maternity leave for live childbirth (regardless of mode of delivery) with full pay, plus 15 additional days for solo parents. 7 days may be allocated to the child's father. 60 days paid leave for miscarriage or emergency termination.",
    link: "https://lawphil.net/statutes/repacts/ra2019/ra_11210_2019.html",
    keywords: "maternity leave, 105 days, SSS maternity benefit, miscarriage leave, allocation to father, panganganak"
  },
  {
    category: "Labor Law",
    name: "Labor Law — Paternity Leave Act for Married Male Employees",
    citation: "RA 8187 (Paternity Leave Act)",
    region: "National",
    priority: "medium",
    fullText: "Every married male employee in the private and public sectors is entitled to a paternity leave of seven (7) days with full pay for the first four (4) deliveries of his legitimate spouse with whom he is cohabiting.",
    link: "https://lawphil.net/statutes/repacts/ra1996/ra_8187_1996.html",
    keywords: "paternity leave, 7 days leave, nanganak ang asawa, leave for father, married male leave"
  },
  {
    category: "Labor Law",
    name: "Labor Law — DOLE Department Order 174 (Contracting and Subcontracting Regulations)",
    citation: "DOLE DO 174-17; Labor Code Arts. 106-109",
    region: "National",
    priority: "high",
    fullText: "Strictly prohibits labor-only contracting where the contractor does not have substantial capital or investments and the workers perform activities directly related to the principal business. In labor-only contracting, the principal is declared the direct employer of the workers with all regular employment benefits.",
    link: "https://www.dole.gov.ph",
    keywords: "DO 174, labor only contracting, endo, 555 contract, agency worker regularization, principal employer liability"
  },
  {
    category: "Labor Law",
    name: "Labor Law — Telecommuting Act (Work From Home Rights and Fair Treatment)",
    citation: "RA 11165 (Telecommuting Act); DOLE DO 237-22",
    region: "National",
    priority: "medium",
    fullText: "An employer may offer a telecommuting program to its employees on a voluntary basis. Telecommuting employees must receive equal treatment and conditions as on-site workers: equal rate of pay, overtime, rest periods, training, and protection against discrimination.",
    link: "https://lawphil.net/statutes/repacts/ra2018/ra_11165_2018.html",
    keywords: "work from home, telecommuting, WFH rights, remote work allowance, DOLE DO 237, hybrid work"
  },
  {
    category: "Labor Law",
    name: "Labor Law — SEDA / SEnA (Single Entry Approach Mandatory Conciliation-Mediation)",
    citation: "RA 10396; DOLE Guidelines",
    region: "National",
    priority: "high",
    fullText: "All labor disputes, including illegal dismissal, money claims, unfair labor practices, and safety complaints, must undergo a mandatory 30-day conciliation-mediation through the Single Entry Approach (SEnA) before filing a formal case with the NLRC or DOLE Med-Arbiter.",
    link: "https://www.dole.gov.ph",
    keywords: "SEnA, single entry approach, DOLE conciliation, settlement, labor dispute, hearing sa DOLE, pakiusap sa sahod"
  },

  // 4. Criminal Law & Procedure
  {
    category: "Criminal Law",
    name: "Criminal Law — Bouncing Checks Law (Batas Pambansa Blg. 22)",
    citation: "Batas Pambansa Blg. 22",
    region: "National",
    priority: "high",
    fullText: "Punishes any person who makes or draws and issues any check knowing at the time of issue that they do not have sufficient funds in the drawee bank. Notice of dishonor is indispensable; issuer has 5 banking days from notice to pay the holder or make arrangement before criminal presumption arises.",
    link: "https://lawphil.net/statutes/bataspam/bp1979/bp_22_1979.html",
    keywords: "BP 22, bouncing check, talbog na tseke, closed account check, notice of dishonor, estafa vs bp 22"
  },
  {
    category: "Criminal Law",
    name: "Criminal Law — Cyber Libel under Cybercrime Prevention Act",
    citation: "RA 10175 §4(c)(4) in relation to RPC Art. 355",
    region: "National",
    priority: "high",
    fullText: "Libel committed by, through and with the use of information and communications technology or computer systems (Facebook, Twitter, TikTok, group chats). The penalty is one degree higher than traditional libel. Requires proof of defamatory imputation, publication, identifiability of victim, and malice.",
    link: "https://lawphil.net/statutes/repacts/ra2012/ra_10175_2012.html",
    keywords: "cyber libel, online paninirang puri, Facebook post defamation, bashing, cybercrime libel, PNP ACG report"
  },
  {
    category: "Criminal Law",
    name: "Criminal Law — Unjust Vexation (Light Coercions under RPC Article 287)",
    citation: "Revised Penal Code Art. 287; RA 10951",
    region: "National",
    priority: "high",
    fullText: "Catch-all offense for any human conduct which, although not producing physical injury or tangible damage, unjustifiably annoys, vexes, irritates, or humiliates an innocent person. Punishable by arresto mayor (1 to 30 days imprisonment) or a fine up to ₱40,000.",
    link: "https://lawphil.net/statutes/repacts/ra2017/ra_10951_2017.html",
    keywords: "unjust vexation, pang-aasar, panggugulo, harassment, pagpapahiya, deskargo, bastos na kilos"
  },
  {
    category: "Criminal Law",
    name: "Criminal Law — Grave Threats and Light Threats under Revised Penal Code",
    citation: "Revised Penal Code Arts. 282, 283, & 285",
    region: "National",
    priority: "high",
    fullText: "Grave threats involve threatening another with the infliction upon their person, honor, or property of any wrong amounting to a crime (such as killing, burning house). If accompanied by a condition/demand for money, penalty is higher. Light threats involve wrongs not amounting to a crime.",
    link: "https://lawphil.net/statutes/repacts/ra1930/act_3815_1930.html",
    keywords: "grave threats, death threat, banta sa buhay, pananakot, papatayin kita, demand for money threat"
  },
  {
    category: "Criminal Law",
    name: "Criminal Law — Anti-Hazing Act of 2018 (Strict Liability and Life Imprisonment)",
    citation: "RA 11053 (Anti-Hazing Act of 2018)",
    region: "National",
    priority: "high",
    fullText: "Totally bans all forms of hazing in fraternities, sororities, and organizations. If hazing results in death, rape, sodomy, or mutilation, the penalty of reclusion perpetua and ₱3,000,000 fine is imposed on all participants, officers, alumni present, and school officials who concealed the act.",
    link: "https://lawphil.net/statutes/repacts/ra2018/ra_11053_2018.html",
    keywords: "hazing, fraternity initiation, paddle beating, frat death, RA 11053, sorority hazing"
  },
  {
    category: "Criminal Law",
    name: "Criminal Law — Comprehensive Dangerous Drugs Act (Possession vs Selling)",
    citation: "RA 9165 as amended by RA 10640 (Section 21 Inventory Rule)",
    region: "National",
    priority: "high",
    fullText: "Sale/trading of dangerous drugs (Section 5) is non-bailable. Possession (Section 11) penalty depends on quantity. RA 10640 mandates the physical inventory and photograph of seized drugs in the presence of the accused, an elected public official, and a representative from the National Prosecution Service or media.",
    link: "https://lawphil.net/statutes/repacts/ra2002/ra_9165_2002.html",
    keywords: "RA 9165, buy bust, illegal drugs, section 21 inventory, shabu, marijuana, non-bailable, cadena de custodia"
  },
  {
    category: "Criminal Law",
    name: "Criminal Law — Anti-Carnapping Act of 2016",
    citation: "RA 10883 (New Anti-Carnapping Act)",
    region: "National",
    priority: "high",
    fullText: "Carnapping is the taking, with intent to gain, of a motor vehicle belonging to another without the latter's consent, or by means of violence or intimidation. Punishable by 20 to 30 years imprisonment; if committed by means of violence or force, 30 to 40 years; if owner or driver is killed, life imprisonment.",
    link: "https://lawphil.net/statutes/repacts/ra2016/ra_10883_2016.html",
    keywords: "carnapping, car theft, motorcycle theft, nakaw na motor, stolen vehicle, LTO alarm"
  },
  {
    category: "Criminal Law",
    name: "Criminal Law — Warrantless Arrest and Inquest Proceedings",
    citation: "Rules of Court Rule 113 §5; Rule 112 §6",
    region: "National",
    priority: "high",
    fullText: "A peace officer or private person may arrest without a warrant: (a) In flagrante delicto (caught in the act); (b) Hot pursuit (crime has just been committed and probable cause based on personal knowledge); or (c) Escaped prisoner. Person arrested must be delivered to judicial authorities within 12, 18, or 36 hours for inquest.",
    link: "https://sc.judiciary.gov.ph",
    keywords: "warrantless arrest, inquest, hot pursuit, in flagrante delicto, 36 hours detention, huli sa akto, pulis"
  },
  {
    category: "Criminal Law",
    name: "Criminal Law — Application for Bail and Petition for Bail in Capital Offenses",
    citation: "Rules of Court Rule 114; Constitution Art. III §13",
    region: "National",
    priority: "high",
    fullText: "All persons shall before conviction be bailable by sufficient sureties, except those charged with offenses punishable by reclusion perpetua when evidence of guilt is strong. In capital offenses, a bail hearing is mandatory for the prosecution to show evidence of strong guilt.",
    link: "https://sc.judiciary.gov.ph",
    keywords: "bail, pyansa, provisional liberty, bail hearing, non-bailable offense, release on recognizance"
  },

  // 5. Special Laws, Consumer & Public Rights
  {
    category: "Commercial Law",
    name: "Commercial Law — Consumer Act of the Philippines (Defective Products and False Ads)",
    citation: "RA 7394 (Consumer Act of the Philippines)",
    region: "National",
    priority: "high",
    fullText: "Protects consumers against deceptive, unfair, and unconscionable sales acts, substandard goods, false advertising, and defective products. Consumers have the right to repair, replacement, or full refund of defective goods through DTI mediation and adjudication.",
    link: "https://www.dti.gov.ph",
    keywords: "consumer act, DTI complaint, defective product refund, false advertising, shopee lazada refund scam, sira ang nabili"
  },
  {
    category: "Commercial Law",
    name: "Commercial Law — Financial Products and Services Consumer Protection Act",
    citation: "RA 11765 (FCPA)",
    region: "National",
    priority: "high",
    fullText: "Empowers financial regulators (BSP, SEC, IC) to order financial institutions, online banks, and digital lending apps to refund unauthorized transactions, cease deceptive interest rates, and desist from debt-collection harassment or shaming.",
    link: "https://www.bsp.gov.ph",
    keywords: "FCPA, BSP complaint, online lending harassment, unauthorized bank transfer, GCash unauthorized deduction, loan shark shaming"
  },
  {
    category: "Commercial Law",
    name: "Commercial Law — Data Privacy Act Data Subject Rights and NPC Complaints",
    citation: "RA 10173 §§16-18 (Data Privacy Act of 2012)",
    region: "National",
    priority: "high",
    fullText: "Data subjects have the right to be informed, access, object, erase/block, and obtain damages for unauthorized or unlawful processing of personal data. Complaints for data breaches, leaks, or illegal contact list scraping can be filed with the National Privacy Commission (NPC).",
    link: "https://privacy.gov.ph",
    keywords: "data privacy, RA 10173, NPC complaint, leaked personal info, contact list harassment, hacked account data"
  },
  {
    category: "Commercial Law",
    name: "Commercial Law — Senior Citizens Expanded Benefits and Mandatory 20% Discount",
    citation: "RA 9994 (Expanded Senior Citizens Act)",
    region: "National",
    priority: "high",
    fullText: "Senior citizens (60 years and older) are entitled to a 20% discount and VAT exemption on medicines, medical/dental services, hotel/restaurant meals, public transport, and recreation. Refusal by establishments is punishable by fine and imprisonment.",
    link: "https://lawphil.net/statutes/repacts/ra2010/ra_9994_2010.html",
    keywords: "senior citizen discount, 20 percent discount, VAT exemption senior, senior ID, tanggi sa discount, gamot senior"
  },
  {
    category: "Commercial Law",
    name: "Commercial Law — Magna Carta for Persons with Disability (PWD Discount Rights)",
    citation: "RA 7277 as amended by RA 10754",
    region: "National",
    priority: "high",
    fullText: "PWDs are entitled to an outright 20% discount and VAT exemption on food, medicines, medical services, domestic air/sea travel, land transport, and basic utilities. Discriminatory denial of discount or access is punishable under law.",
    link: "https://www.ncda.gov.ph",
    keywords: "PWD discount, PWD ID, 20 percent PWD, disabled benefits, VAT exemption PWD, tanggi sa PWD"
  },
  {
    category: "Commercial Law",
    name: "Commercial Law — Intellectual Property Code (Trademark Infringement and Copyright)",
    citation: "RA 8293 as amended by RA 10372",
    region: "National",
    priority: "medium",
    fullText: "Protects registered trademarks against confusingly similar marks and copyrighted creative/literary works against unauthorized reproduction, sale, or streaming. Remedies include cease-and-desist, preliminary injunction, damages, and criminal prosecution under IPOPHL.",
    link: "https://www.ipophil.gov.ph",
    keywords: "trademark infringement, copyright violation, pirated goods, stolen brand, fake logo, IPOPHL complaint"
  },
  {
    category: "Commercial Law",
    name: "Commercial Law — Real Estate Service Act (Anti-Colorum Real Estate Agents)",
    citation: "RA 9646 (RESA Law)",
    region: "National",
    priority: "medium",
    fullText: "Prohibits unlicensed and colorum individuals from acting as real estate brokers or agents. Transactions conducted by unlicensed agents expose them to criminal fines up to ₱200,000 and imprisonment of up to 4 years (double for unlicensed practitioners).",
    link: "https://www.prc.gov.ph",
    keywords: "RESA law, unlicensed real estate agent, colorum broker, illegal agent commission, PRC broker license"
  },

  // 6. Regional, Local Ordinances & Special Focus (Mindanao, Visayas, Luzon)
  {
    category: "Local Ordinances",
    name: "Local Ordinance — Davao City Comprehensive Anti-Smoking Ordinance",
    citation: "Davao City Ordinance No. 0367-12, Series of 2012",
    region: "Mindanao (Davao)",
    priority: "high",
    fullText: "Strictly prohibits smoking or vaping in all public conveyances, government premises, private workplaces, and enclosed public spaces throughout Davao City. Penalties include fine of ₱1,000 to ₱5,000 and mandatory smoking cessation seminar or imprisonment.",
    link: "https://www.davaocity.gov.ph",
    keywords: "davao anti-smoking, davao vaping ban, smoking in public davao, ordinance 0367-12, bawal manigarilyo davao"
  },
  {
    category: "Local Ordinances",
    name: "Local Ordinance — Davao City Liquor Ban Ordinance (Curfew on Alcohol Sales)",
    citation: "Davao City Ordinance No. 004-13, Series of 2013",
    region: "Mindanao (Davao)",
    priority: "high",
    fullText: "Prohibits the serving, selling, or drinking of alcoholic beverages in public establishments between 1:00 AM and 8:00 AM daily in Davao City. Violating business establishments face revocation of business permits, fines, and closure.",
    link: "https://www.davaocity.gov.ph",
    keywords: "davao liquor ban, 1am alcohol curfew, davao beer ban, alak bawal davao, liquor ordinance davao"
  },
  {
    category: "Local Ordinances",
    name: "Local Ordinance — Davao City Comprehensive Children's Welfare and Protection Code",
    citation: "Davao City Ordinance No. 0292-06",
    region: "Mindanao (Davao)",
    priority: "high",
    fullText: "Imposes strict curfew hours (10:00 PM to 5:00 AM) for unchaperoned minors below 18 years old in Davao City. Mandates parental responsibility interventions, child counseling, and juvenile protective services through CSSDO.",
    link: "https://www.davaocity.gov.ph",
    keywords: "davao minor curfew, curfew ng kabataan davao, children welfare code davao, CSSDO custody"
  },
  {
    category: "Local Ordinances",
    name: "Local Ordinance — Davao City Speed Limit Ordinance for Motor Vehicles",
    citation: "Davao City Executive Order No. 39 / Ordinance No. 0270-23",
    region: "Mindanao (Davao)",
    priority: "high",
    fullText: "Prescribes speed limits within Davao City: 30 km/h in downtown and school zones; 60 km/h along highways (e.g. McArthur Highway, Diversion Road); 80 km/h along specific designated coastal expressways. Violators are cited by CTTMO with fines.",
    link: "https://www.davaocity.gov.ph",
    keywords: "davao speed limit, 30 kph davao, 60 kph diversion road, CTTMO citation, over speeding davao"
  },
  {
    category: "Local Ordinances",
    name: "Local Ordinance — Cebu City Anti-Muffler / Noise Pollution Ordinance",
    citation: "Cebu City Ordinance No. 2411 (Anti-Bora-Bora)",
    region: "Visayas (Cebu)",
    priority: "high",
    fullText: "Prohibits the use of open pipe / modified noisy mufflers on motorcycles and motor vehicles within Cebu City producing sound beyond 84 decibels. CCTO impounds offending vehicles and imposes fines on owners.",
    link: "https://www.cebucity.gov.ph",
    keywords: "cebu open pipe, bora bora muffler, maingay na tambutso cebu, CCTO impound, noise pollution cebu"
  },
  {
    category: "Local Ordinances",
    name: "Local Ordinance — Quezon City Anti-Harassment in Public Spaces Ordinance",
    citation: "Quezon City Ordinance No. SP-2501, S-2016",
    region: "Luzon (NCR)",
    priority: "high",
    fullText: "Penalizes catcalling, wolf-whistling, stalking, leering, and derogatory slurs directed at women and LGBTQ+ in public streets and alleys within Quezon City, paving the foundational local law prior to national Safe Spaces Act.",
    link: "https://quezoncity.gov.ph",
    keywords: "quezon city catcalling, QC anti-harassment, QC public space ordinance, wolf whistling fine QC"
  },
  {
    category: "Special Laws",
    name: "Special Law — Indigenous Peoples' Rights Act of 1997 (CADT and Ancestral Domains)",
    citation: "RA 8371 (IPRA Law)",
    region: "Mindanao / Luzon Cordillera",
    priority: "high",
    fullText: "Recognizes the ownership and possession rights of Indigenous Cultural Communities / Indigenous Peoples (ICCs/IPs) over their Ancestral Domains through Certificates of Ancestral Domain Title (CADT). Free and Prior Informed Consent (FPIC) is mandatory before any mining, logging, or project execution on ancestral lands.",
    link: "https://ncip.gov.ph",
    keywords: "IPRA law, ancestral domain, CADT, NCIP, Lumad rights, Igorot rights, FPIC consent, katutubong lupa"
  },
  {
    category: "Special Laws",
    name: "Special Law — Comprehensive Agrarian Reform Program (CARP / CARPER Land Rights)",
    citation: "RA 6657 as amended by RA 9700 (CARPER)",
    region: "National (Rural)",
    priority: "high",
    fullText: "Governs redistribution of agricultural lands to farmer-beneficiaries (Agrarian Reform Beneficiaries / ARBs) with Certificates of Land Ownership Award (CLOA). Voids illegal land conversion and unauthorized ejectment of tenant farmers without DAR clearance.",
    link: "https://www.dar.gov.ph",
    keywords: "CARP, CARPER, DAR dispute, CLOA title, tenant farmer rights, tenancy dispute, agawan ng sakahan"
  },
  {
    category: "Special Laws",
    name: "Special Law — Katarungang Pambarangay Law (Mandatory Barangay Conciliation)",
    citation: "Local Government Code (RA 7160 §§399-422); PD 1508",
    region: "National",
    priority: "high",
    fullText: "Condition precedent before filing a civil or minor criminal case in court when both parties reside in the same city/municipality. A Certificate to File Action (CFA) issued by the Lupon Tagapamayapa is required, otherwise the court case is dismissible for lack of cause of action / prematurity.",
    link: "https://www.dilg.gov.ph",
    keywords: "katarungang pambarangay, lupon tagapamayapa, barangay hearing, certificate to file action, CFA, barangay settlement"
  },
  {
    category: "Special Laws",
    name: "Special Law — Rent Control Act of 2009 and DHSUD Ceiling Guidelines",
    citation: "RA 9653 (Rent Control Act of 2009); DHSUD Resolutions",
    region: "National",
    priority: "high",
    fullText: "Limits annual rental increases for residential units renting up to ₱10,000 in NCR and ₱5,000 in other areas. Mandates that advance deposit cannot exceed 1 month and security deposit cannot exceed 2 months. Ejectment on the ground of sale to a third party is prohibited during the lease term.",
    link: "https://dhsud.gov.ph",
    keywords: "rent control act, upa sa bahay, bawal magtaas ng renta, 1 month advance 2 months deposit, pinalayas ng may-ari"
  },
  {
    category: "Special Laws",
    name: "Special Law — Anti-Bullying Act for Philippine Educational Institutions",
    citation: "RA 10627 (Anti-Bullying Act of 2013)",
    region: "National",
    priority: "high",
    fullText: "Requires all elementary and secondary schools in the Philippines to adopt comprehensive anti-bullying policies addressing physical, psychological, and cyber-bullying. Schools failing to investigate and sanction bullies face administrative liability under DepEd.",
    link: "https://www.deped.gov.ph",
    keywords: "anti-bullying, school bullying, cyberbullying in school, DepEd child protection, binully sa school"
  },
  {
    category: "Special Laws",
    name: "Special Law — Anti-Hospital Deposit Law for Emergency Medical Cases",
    citation: "RA 10932 (Strengthened Anti-Hospital Deposit Law)",
    region: "National",
    priority: "high",
    fullText: "Strictly makes it unlawful for any hospital or medical clinic to demand any deposit or advance payment as a prerequisite for administering basic emergency medical treatment or surgery. Violating administrators and physicians face imprisonment of 4 to 6 years and revocation of medical license.",
    link: "https://doh.gov.ph",
    keywords: "anti-hospital deposit, hiningan ng deposito sa ospital, emergency room deposit, DOH complaint, tinanggihan sa ER"
  },
  {
    category: "Special Laws",
    name: "Special Law — Philippine Clean Air and Ecological Solid Waste Management Act",
    citation: "RA 8749 (Clean Air Act) & RA 9003 (Solid Waste Management)",
    region: "National",
    priority: "medium",
    fullText: "Prohibits open burning of solid waste (siga/open incineration of garbage and plastics) which is punishable by fines and community service through the LGU and DENR-EMB. Mandates waste segregation at source in all households and commercial establishments.",
    link: "https://emb.gov.ph",
    keywords: "siga, bawal mag-siga, open burning, RA 9003, DENR complaint, usok ng basura, solid waste segregation"
  },
  {
    category: "Labor Law",
    name: "Labor Law — Night Shift Differential and Overtime Pay Computation",
    citation: "Labor Code Arts. 86-87",
    region: "National",
    priority: "high",
    fullText: "Every employee shall be paid a night shift differential of not less than ten percent (10%) of their regular wage for each hour of work performed between 10:00 PM and 6:00 AM. Work performed beyond eight hours a day requires overtime compensation of at least 25% on regular days and 30% on rest days/holidays.",
    link: "https://www.dole.gov.ph",
    keywords: "night differential, NSD, overtime pay, OT computation, 10pm to 6am, graveyard shift, bawas sahod sa OT"
  },
  {
    category: "Labor Law",
    name: "Labor Law — Holiday Pay for Regular vs Special Non-Working Days",
    citation: "Labor Code Art. 94; DOLE Labor Advisories",
    region: "National",
    priority: "high",
    fullText: "Employees unworked on Regular Holidays receive 100% of basic wage; worked employees receive 200%. For Special Non-Working Days, 'no work, no pay' applies unless company policy states otherwise; if worked, additional 30% on the basic wage is mandated.",
    link: "https://www.dole.gov.ph",
    keywords: "holiday pay, double pay, regular holiday, special non-working holiday, DOLE advisory, sahuran sa holiday"
  },
  {
    category: "Labor Law",
    name: "Labor Law — Magna Carta for Public Health Workers (Hazard and Subsistence Allowances)",
    citation: "RA 7305",
    region: "National",
    priority: "medium",
    fullText: "Provides mandatory benefits and protective allowances for public health workers, including hazard pay (at least 25% of basic salary for low-salary grades), subsistence allowance, longevity pay, and free medical examination.",
    link: "https://doh.gov.ph",
    keywords: "RA 7305, public health worker, nurse hazard pay, doctor allowance, DOH hazard benefit, longevity pay"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Annulment of Contract Due to Vitiated Consent (Fraud, Intimidation, Mistake)",
    citation: "Civil Code Arts. 1330-1344",
    region: "National",
    priority: "high",
    fullText: "A contract where consent is given through mistake, violence, intimidation, undue influence, or fraud is voidable. The action for annulment must be brought within four (4) years from the time the intimidation/undue influence ceases or from the discovery of the mistake or fraud.",
    link: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html",
    keywords: "voidable contract, vitiated consent, panloloko sa kontrata, pinilit pumirma, 4 years prescription, dolo causante"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Legal Redemption by Co-Owners and Adjoining Rural Landowners",
    citation: "Civil Code Arts. 1620-1623",
    region: "National",
    priority: "high",
    fullText: "A co-owner of a thing may exercise the right of redemption in case the share of all the other co-owners or of any of them is sold to a third person. Owners of adjoining rural land not exceeding one hectare also have redemption rights unless the buyer does not own rural land.",
    link: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html",
    keywords: "legal redemption, co-owner right of redemption, sold share without notice, 30 days redemption, katabing lupa"
  },
  {
    category: "Criminal Law",
    name: "Criminal Law — Falsification of Public Documents and Use of Falsified Documents",
    citation: "Revised Penal Code Arts. 171 & 172",
    region: "National",
    priority: "high",
    fullText: "Punishes any person who counterfeits, alters, or makes untruthful statements in a narration of facts on public, official, or commercial documents (such as fake diplomas, land titles, affidavits, driver licenses). Punishable by prision correccional to prision mayor and fine.",
    link: "https://lawphil.net/statutes/repacts/ra1930/act_3815_1930.html",
    keywords: "falsification of public document, fake certificate, peke na diploma, pekeng pirma, altered notary, notaryo peke"
  },
  {
    category: "Criminal Law",
    name: "Criminal Law — Perjury and False Testimony in Solemn Affidavits",
    citation: "Revised Penal Code Art. 183 as amended by RA 11594",
    region: "National",
    priority: "high",
    fullText: "Punishes any person who knowingly makes an untruthful statement under oath or in an affidavit before a notary public or competent officer. RA 11594 increased the penalty for perjury to prision mayor in its minimum to medium periods (6 years and 1 day to 10 years imprisonment).",
    link: "https://lawphil.net/statutes/repacts/ra2021/ra_11594_2021.html",
    keywords: "perjury, sinumpaang salaysay kasinungalingan, false affidavit, lying under oath, RA 11594, kasong perjury"
  },
  {
    category: "Commercial Law",
    name: "Commercial Law — Anti-Money Laundering Act (AMLA Threshold Reporting and Freeze Orders)",
    citation: "RA 9160 as amended by RA 11521 (AMLA)",
    region: "National",
    priority: "medium",
    fullText: "Requires covered persons and financial institutions to report covered transactions exceeding ₱500,000 within 1 banking day and suspicious transactions regardless of amount to the AMLC. The Court of Appeals may issue a 20-day freeze order upon verified ex-parte petition by AMLC.",
    link: "https://www.amlc.gov.ph",
    keywords: "AMLA, money laundering, freeze order bank account, AMLC report, suspicious transaction, frozen account"
  },
  {
    category: "Commercial Law",
    name: "Commercial Law — Philippine Competition Act (Anti-Trust and Cartel Agreements)",
    citation: "RA 10667 (Philippine Competition Act)",
    region: "National",
    priority: "low",
    fullText: "Prohibits anti-competitive agreements (price-fixing, bid-rigging, market sharing), abuse of dominant market position, and anti-competitive mergers. Enforced by the Philippine Competition Commission (PCC) with administrative fines up to ₱250 million and criminal liability.",
    link: "https://www.phcc.gov.ph",
    keywords: "PCC, anti-trust, price fixing cartel, monopoly abuse, bid rigging, competition act, sabwatan sa presyo"
  },
  {
    category: "Special Laws",
    name: "Special Law — Electric Power Industry Reform Act (EPIRA and Illegal Power Connections)",
    citation: "RA 9136 (EPIRA) & RA 7832 (Anti-Electricity Pilferage Act)",
    region: "National",
    priority: "high",
    fullText: "Criminalizes illegal tapping of electric power lines, tampering with electric meters, and unauthorized jumpers. Imposes stiff fines, differential billing assessments, and imprisonment of 6 to 12 years on offenders, along with immediate disconnection rights for distribution utilities.",
    link: "https://www.erc.ph",
    keywords: "jumper kuryente, illegal tap electricity, tampered meter, Meralco violation, Davao Light pilferage, RA 7832"
  },
  {
    category: "Special Laws",
    name: "Special Law — Water District Code and Illegal Water Connection Penalties",
    citation: "PD 198 as amended; Local Water Utilities Administration (LWUA)",
    region: "National",
    priority: "medium",
    fullText: "Prohibits unauthorized installation of water connections, illegal bypasses, and sub-metering to third parties without local water district consent. Offenders are subject to disconnection, criminal complaints for theft of water, and reconnection penalty surcharges.",
    link: "https://lwua.gov.ph",
    keywords: "illegal water connection, jumper sa tubig, water district fine, nakaw na tubig, DCWD penalty, Maynilad violation"
  },
  {
    category: "Local Ordinances",
    name: "Local Ordinance — Baguio City Anti-Littering and Solid Waste Ordinance",
    citation: "Baguio City Ordinance No. 05-2017",
    region: "Luzon (Baguio / CAR)",
    priority: "medium",
    fullText: "Penalizes littering, spitting of momma / betel nut in public streets, and failure of business owners to maintain clean 5-meter perimeters around their establishments in Baguio City with community service and escalating fines.",
    link: "https://www.baguio.gov.ph",
    keywords: "baguio anti-littering, momma spitting ban baguio, clean perimeter baguio, baguio city ordinance"
  },
  {
    category: "Local Ordinances",
    name: "Local Ordinance — Iloilo City Anti-Discrimination Ordinance for SOGIE and PWDs",
    citation: "Iloilo City Regulation Ordinance No. 2018-090",
    region: "Visayas (Iloilo)",
    priority: "high",
    fullText: "Prohibits discriminatory denial of employment, education, health services, or commercial accommodations against individuals based on Sexual Orientation, Gender Identity and Expression (SOGIE), health status, or disability within Iloilo City.",
    link: "https://iloilocity.gov.ph",
    keywords: "iloilo anti-discrimination, SOGIE ordinance iloilo, LGBTQ rights iloilo, discrimination complaint iloilo"
  },
  {
    category: "Local Ordinances",
    name: "Local Ordinance — Cagayan de Oro City Septage Management and Desludging Ordinance",
    citation: "CDO City Ordinance No. 13305-2017",
    region: "Mindanao (Cagayan de Oro)",
    priority: "medium",
    fullText: "Mandates that all residential, commercial, and industrial buildings in Cagayan de Oro City maintain compliant standard septic tanks and undergo mandatory periodic desludging every 3 to 5 years by accredited service providers.",
    link: "https://cagayandeoro.gov.ph",
    keywords: "cagayan de oro septage, CDO poso negro ordinance, desludging cdo, septic tank standard CDO"
  },
  {
    category: "Local Ordinances",
    name: "Local Ordinance — Zamboanga City Anti-Drunk Driving and Road Safety Code",
    citation: "Zamboanga City Ordinance No. 493",
    region: "Mindanao (Zamboanga)",
    priority: "high",
    fullText: "Imposes strict breathalyzer field testing for motorists suspected of driving under the influence of liquor or illegal substances within Zamboanga City, providing local enforcement mechanisms harmonized with Republic Act 10586.",
    link: "https://zamboangacity.gov.ph",
    keywords: "zamboanga drunk driving, DUI zamboanga, breathalyzer road safety zamboanga, ordinance 493"
  },
  {
    category: "Special Laws",
    name: "Special Law — Philippine Fisheries Code (Municipal Fishing Grounds and Poaching)",
    citation: "RA 8550 as amended by RA 10654",
    region: "National (Coastal)",
    priority: "high",
    fullText: "Reserves the use of municipal waters (within 15 kilometers from coastline) exclusively to municipal fisherfolk. Imposes severe fines and vessel forfeiture for commercial fishing within municipal waters, blast fishing, and cyanide fishing.",
    link: "https://www.bfar.da.gov.ph",
    keywords: "fisheries code, municipal waters, 15 km fishing zone, illegal fishing, blast fishing, BFAR complaint"
  },
  {
    category: "Special Laws",
    name: "Special Law — Philippine Mining Act (Small-Scale Mining and Environmental Safeguards)",
    citation: "RA 7942 & RA 7076 (People's Small-Scale Mining Act)",
    region: "National (Mining Regions)",
    priority: "medium",
    fullText: "Regulates mineral resource development and requires environmental compliance certificates (ECC) and rehabilitation funds. Small-scale mining is restricted to declared Minahang Bayan areas under local provincial mining regulatory boards.",
    link: "https://mgb.gov.ph",
    keywords: "mining act, small scale mining, minahang bayan, illegal mining, MGB permit, ECC violation"
  },
  {
    category: "Commercial Law",
    name: "Commercial Law — Philippine Cooperative Code (Member Rights and Dispute Arbitration)",
    citation: "RA 9520 (Philippine Cooperative Code of 2008)",
    region: "National",
    priority: "medium",
    fullText: "Governs rights of cooperative members, patron refund distribution, and loan collections. Intra-cooperative disputes must undergo primary conciliation-mediation by the cooperative conciliation committee before referral to the Cooperative Development Authority (CDA).",
    link: "https://cda.gov.ph",
    keywords: "cooperative code, coop dividend, CDA arbitration, loan coop dispute, coop member rights"
  },
  {
    category: "Commercial Law",
    name: "Commercial Law — National Internal Revenue Code (Taxpayer Protest and 30-Day CTA Appeal)",
    citation: "NIRC §228 (RA 8424 as amended by TRAIN / CREATE)",
    region: "National",
    priority: "medium",
    fullText: "Upon receipt of a Final Assessment Notice (FAN) from the BIR, the taxpayer has thirty (30) days to file a formal administrative protest. If protested and denied (or lapsed after 180 days), the taxpayer has 30 days to appeal to the Court of Tax Appeals (CTA).",
    link: "https://www.bir.gov.ph",
    keywords: "BIR protest, Final Assessment Notice, FAN protest, 30 days CTA appeal, tax deficiency assessment"
  },
  {
    category: "Special Laws",
    name: "Special Law — Anti-Red Tape and Ease of Doing Business Act (Citizen Charter Deadlines)",
    citation: "RA 11032 (Ease of Doing Business Act)",
    region: "National",
    priority: "high",
    fullText: "Mandates processing time standards for government agencies: 3 working days for simple transactions, 7 days for complex transactions, and 20 days for highly technical applications. Non-action results in automatic approval under ARTA.",
    link: "https://arta.gov.ph",
    keywords: "ARTA complaint, ease of doing business, 3 days simple transaction, delayed government permit, anti-red tape"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Law on Agency and Unauthorized Contracts (Special Power of Attorney Rules)",
    citation: "Civil Code Arts. 1874-1878",
    region: "National",
    priority: "high",
    fullText: "When a sale of a piece of land or any interest therein is through an agent, the authority of the latter shall be in writing; otherwise, the sale shall be void. A Special Power of Attorney (SPA) is strictly required to compromise, convey real property, or borrow money.",
    link: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html",
    keywords: "special power of attorney, SPA, sale of land by agent, void sale without SPA, authority of agent, pekeng ahente"
  },
  {
    category: "Civil Law",
    name: "Civil Law — Builders Lien and Mechanics Lien on Real Property",
    citation: "Civil Code Art. 2242(3)",
    region: "National",
    priority: "medium",
    fullText: "Claims of contractors, laborers, and materialmen who constructed, repaired, or preserved real property enjoy a preferred lien upon the specific immovable property for the unpaid cost of construction materials and labor.",
    link: "https://lawphil.net/statutes/repacts/ra1949/ra_386_1949.html",
    keywords: "contractor unpaid, mechanics lien, construction lien, unpaid laborer construction, bayad sa kontrata ng bahay"
  },
  {
    category: "Family Law",
    name: "Family Law — Presumptive Death of Absent Spouse for Purpose of Remarriage",
    citation: "Family Code Art. 41; Civil Code Art. 390",
    region: "National",
    priority: "medium",
    fullText: "A spouse who has been absent for four (4) consecutive years (or two years in case of danger of death) and the spouse present has a well-founded belief that the absentee is dead, may file a summary judicial proceeding for declaration of presumptive death to contract a valid subsequent marriage.",
    link: "https://sc.judiciary.gov.ph",
    keywords: "presumptive death, nawawalang asawa, 4 years absent, summary judicial declaration, remarrying absent spouse"
  },
  {
    category: "Criminal Law",
    name: "Criminal Law — Anti-Wiretapping Act (Strict Prohibition of Secret Audio Recordings)",
    citation: "RA 4200 (Anti-Wiretapping Act)",
    region: "National",
    priority: "high",
    fullText: "Prohibits any person not authorized by all parties to any private communication or spoken word to secretly tap, record, or overhear conversations using any electronic device. Secretly recorded conversations are inadmissible in evidence in any judicial proceeding.",
    link: "https://lawphil.net/statutes/repacts/ra1965/ra_4200_1965.html",
    keywords: "anti-wiretapping, secret voice recording, bawal i-record ang usapan, voice record illegal evidence, RA 4200"
  },
  {
    category: "Special Laws",
    name: "Special Law — Magna Carta of Women (Protection from Gender-Based Discrimination)",
    citation: "RA 9710 (Magna Carta of Women)",
    region: "National",
    priority: "high",
    fullText: "Guarantees the human rights of women, non-discrimination in employment, expulsion of pregnant women from schools/jobs prohibition, and grants special leave benefits for women undergoing surgery for gynecological disorders (up to 2 months with full pay).",
    link: "https://pcw.gov.ph",
    keywords: "magna carta of women, gynecological leave, 2 months leave surgery, discrimination against women, RA 9710"
  }
];

let added = 0;
for (const law of newLaws) {
  if (!existingNames.has(law.name.toLowerCase())) {
    existingExt.push(law);
    existingNames.add(law.name.toLowerCase());
    added++;
  }
}

fs.writeFileSync(extPath, JSON.stringify(existingExt, null, 2), 'utf8');
console.log(`Successfully added ${added} new laws! Total extended count: ${existingExt.length}. Combined total: ${baseLaws.length + existingExt.length}`);
