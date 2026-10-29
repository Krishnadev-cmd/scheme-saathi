# Content review: translations and scheme facts

Scheme Saathi gives people money-related information in three languages, so two kinds of review need a person, not code:

1. **Native-speaker review** of every Hindi and Malayalam string.
2. **Fact checks** of each scheme's amounts, eligibility and links against the official site.

The admin panel produces the sheets for both: **Admin → Schemes → Translation review sheet / Fact check sheet** (`/admin/export/translations.csv`, `/admin/export/fact-check.csv`). They open correctly in Excel and Google Sheets (UTF-8 with BOM).

## 1. Translation review (native speakers)

The sheet has one row per string: every bot message, every button label, and the name, summary, benefits and how-to-apply text of each live scheme. Columns: `key, english, hindi, hindi_corrected, malayalam, malayalam_corrected, reviewer_notes`.

What reviewers should check:
- **Meaning:** same as the English, especially amounts, ages and dates.
- **Register:** simple, respectful everyday language (आप / നിങ്ങൾ), not bureaucratic.
- **Terms people actually use:** e.g. Akshaya centre in Kerala, CSC elsewhere; ration card colours.
- **Length:** button labels should stay short (Telegram and WhatsApp clip long labels).

Applying corrections:
- Scheme text: **Admin → Schemes → Edit** (saved edits survive `npm run seed`).
- Bot messages and button labels: `src/lib/i18n.ts` (keys in the sheet match: `bot.consent` → `STR.consent`, `option.gender.female` → `GENDER_OPTIONS`).

Status: **not yet reviewed by a native speaker.** The current Hindi and Malayalam were written carefully, but need a fluent reviewer before launch.

## 2. Scheme fact check

On 29 Oct 2026 every seed scheme was checked against official sources (`.gov.in` / `.nic.in` pages, PIB, ministry guidelines), and all apply links were tested.

**Fixed in `src/lib/schemes/seed.ts`:**

| Scheme | Was | Now | Source |
| --- | --- | --- | --- |
| Sukanya Samriddhi | "matures when she turns 21" | matures 21 years after the account is opened | nsiindia.gov.in |
| PM Internship | ages 21–24, 12 months, ₹5,000 a month | ages 18–25, final-year students may apply, at least ₹9,000 a month | PIB (MCA) release; **confirm on pminternship.mca.gov.in** (pib.gov.in blocked direct checks) |
| PM SVANidhi | "up to ₹50,000" | tranches of ₹15,000 / ₹25,000 / ₹50,000, cashback up to ₹1,600, RuPay credit card | Cabinet release, Aug 2025 |
| Old age pension (IGNOAPS) | nsap.nic.in (no longer responds) | nsap.dord.gov.in | link test |
| Atal Pension Yojana | income limit ₹8 lakh (invented) | no income limit; summary still says not for income-tax payers | pfrda.org.in |
| Central Sector Scholarship | ages 17–30 (invented) | no age limit | education.gov.in |

**Confirmed correct:** PM-KISAN, PM Kisan Maandhan, PM-JAY, Ayushman Vay Vandana, PMAY-G, PMAY-U 2.0, Ujjwala, APY amounts, PMJJBY, PMSBY, Mudra (incl. Tarun Plus), PM Vishwakarma, Post-Matric scholarships, PM-SYM, e-Shram, IGNOAPS amounts, UDID, ADIP, KASP. All other apply links load.

**Still needs a person:**
- **Stand-Up India:** the original scheme period ended 31 Mar 2025 and a revamp (reported ₹2 crore cap) was announced in Mar 2026, but no notification was found. Recheck standupmitra.in.
- **Kerala Social Security Pension:** reported as ₹2,000 a month since Nov 2025 (news only, no government order found). Add the amount once confirmed.
- **PM Internship:** confirm the new figures on the official portal (see above).

Use the fact check sheet for the next review; repeat at least every quarter and whenever the pipeline reports a change for a scheme.

## Existing databases

The seed file only updates the database when it is reloaded. After pulling these fixes, run `npm run seed`, or `node --env-file-if-exists=.env --import tsx scripts/seed.ts` if npm is unavailable. Schemes edited in the admin panel are left untouched by the seed.
