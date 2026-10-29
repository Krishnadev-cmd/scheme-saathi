export const LANGS = ["en", "hi", "ml"] as const;
export type Lang = (typeof LANGS)[number];

/** Text available in every supported language (en is always required). */
export type Localized = { en: string; hi?: string; ml?: string };

export type Channel = "telegram" | "whatsapp" | "web";

export type Gender = "male" | "female" | "transgender";
export type Area = "rural" | "urban";
export type Category = "general" | "obc" | "sc" | "st" | "ews" | "minority";
export type Occupation =
  | "farmer"
  | "student"
  | "salaried"
  | "self_employed"
  | "street_vendor"
  | "artisan"
  | "labourer"
  | "homemaker"
  | "unemployed"
  | "retired";

/**
 * Everything the agent collects. Deliberately excludes identity numbers
 * (Aadhaar, PAN, etc.) — the bot never asks for or stores them.
 */
export interface Profile {
  age?: number;
  gender?: Gender;
  state?: string; // canonical English state/UT name, e.g. "Kerala"
  area?: Area;
  occupation?: Occupation;
  annualIncome?: number; // upper bound of the selected band, in ₹
  category?: Category;
  disability?: boolean;
  bpl?: boolean; // holds a BPL / priority (AAY/PHH) ration card
  ownsLand?: boolean; // only asked to farmers
  hasGirlChildUnder10?: boolean;
}

export interface EligibilityRules {
  minAge?: number;
  maxAge?: number;
  genders?: Gender[];
  occupations?: Occupation[];
  categories?: Category[];
  maxIncome?: number;
  /** Empty / missing = all India. */
  states?: string[];
  area?: Area;
  requiresDisability?: boolean;
  requiresBpl?: boolean;
  requiresLand?: boolean;
  requiresGirlChildUnder10?: boolean;
  /** At least one of these rule sets must also pass (e.g. "SC/ST OR woman"). */
  anyOf?: EligibilityRules[];
}

export interface Scheme {
  id: string;
  name: Localized;
  ministry: string;
  level: "central" | "state";
  summary: Localized;
  benefits: Localized;
  documents: string[];
  howToApply: Localized;
  applyUrl: string;
  rules: EligibilityRules;
  /** Application window (ISO dates). Missing = always open / rolling. */
  openDate?: string;
  closeDate?: string;
  source: "seed" | "pipeline";
  sourceUrl?: string;
  updatedAt: string;
  /**
   * Review state for schemes the pipeline discovers. Missing means approved
   * (seed schemes). Pending and rejected schemes are never shown or alerted.
   */
  review?: "pending" | "approved" | "rejected";
  /** A window change the pipeline found, waiting for an admin to approve it. */
  pendingWindow?: PendingWindow;
  /** Window keys ("open..close") an admin rejected, so they aren't proposed again. */
  rejectedWindows?: string[];
  reviewedAt?: string;
  /** Hidden by an admin: kept, but never shown or alerted. */
  hidden?: boolean;
  /** Set when an admin edits the scheme; `npm run seed` then leaves it alone. */
  editedAt?: string;
}

export interface PendingWindow {
  openDate?: string;
  closeDate?: string;
  sourceUrl: string;
  foundAt: string;
}

export interface OutOption {
  id: string;
  label: string;
}

/** Channel-agnostic outgoing message; adapters render options as buttons/lists. */
export interface OutMessage {
  text: string;
  options?: OutOption[];
}

export type Step =
  | "language"
  | "consent"
  | "age"
  | "gender"
  | "state"
  | "area"
  | "occupation"
  | "ownsLand"
  | "income"
  | "category"
  | "disability"
  | "bpl"
  | "girlChild"
  | "done";

export interface User {
  id: string; // `${channel}:${externalId}`
  channel: Channel;
  externalId: string;
  lang: Lang;
  step: Step;
  profile: Profile;
  subscribed: boolean;
  /** Scheme ids from the last results list, so "2" can mean the 2nd scheme. */
  lastResults: string[];
  lastInboundAt?: string;
  /** When the user agreed to the data notice (DPDP Act 2023). Questions are only asked after this. */
  consentAt?: string;
  createdAt: string;
  /** Set when the user deleted their data in this request, so it isn't saved again. */
  deleted?: boolean;
}
