import { deleteUser, incrementCounter, listSchemes, getScheme, saveUser } from "./db";
import { env } from "./env";
import { matchSchemes, windowStatus } from "./eligibility";
import {
  AREA_OPTIONS,
  CATEGORY_OPTIONS,
  GENDER_OPTIONS,
  INCOME_OPTIONS,
  LANGUAGE_OPTIONS,
  OCCUPATION_OPTIONS,
  STR,
  YES_NO,
  fmt,
  formatDate,
  matchState,
  t,
} from "./i18n";
import { answerQuestion, interpretChoice, interpretValue } from "./llm";
import { type Lang, type Localized, type OutMessage, type OutOption, type Profile, type Scheme, type Step, type User } from "./types";

export interface Incoming {
  text: string;
  /** Set when the user tapped a button / list row. */
  optionId?: string;
}

type ChoiceDef = { id: string; label: Localized }[];

const CHOICES: Partial<Record<Step, ChoiceDef>> = {
  gender: GENDER_OPTIONS,
  area: AREA_OPTIONS,
  occupation: OCCUPATION_OPTIONS,
  income: INCOME_OPTIONS,
  category: CATEGORY_OPTIONS,
  ownsLand: YES_NO,
  disability: YES_NO,
  bpl: YES_NO,
  girlChild: YES_NO,
};

const QUESTION: Record<Exclude<Step, "language" | "consent" | "done">, Localized> = {
  age: STR.q_age,
  gender: STR.q_gender,
  state: STR.q_state,
  area: STR.q_area,
  occupation: STR.q_occupation,
  ownsLand: STR.q_ownsLand,
  income: STR.q_income,
  category: STR.q_category,
  disability: STR.q_disability,
  bpl: STR.q_bpl,
  girlChild: STR.q_girlChild,
};

/** The questions in the order they are asked (also used by the admin funnel). */
export const ORDER: Step[] = [
  "age",
  "gender",
  "state",
  "area",
  "occupation",
  "ownsLand",
  "income",
  "category",
  "disability",
  "bpl",
  "girlChild",
  "done",
];

function nextStep(current: Step, p: Profile): Step {
  let i = current === "language" || current === "consent" ? 0 : ORDER.indexOf(current) + 1;
  while (i < ORDER.length) {
    const s = ORDER[i];
    if (s === "ownsLand" && p.occupation !== "farmer") {
      i++;
      continue;
    }
    if (s === "girlChild" && p.age != null && p.age < 18) {
      i++;
      continue;
    }
    return s;
  }
  return "done";
}

const ANSWERED: Record<Exclude<Step, "language" | "consent" | "done">, (p: Profile) => boolean> = {
  age: (p) => p.age != null,
  gender: (p) => p.gender != null,
  state: (p) => p.state != null,
  area: (p) => p.area != null,
  occupation: (p) => p.occupation != null,
  ownsLand: (p) => p.ownsLand != null,
  income: (p) => p.annualIncome != null,
  category: (p) => p.category != null,
  disability: (p) => p.disability != null,
  bpl: (p) => p.bpl != null,
  girlChild: (p) => p.hasGirlChildUnder10 != null,
};

function firstUnanswered(p: Profile): Step {
  let s = nextStep("language", p);
  while (s !== "done" && ANSWERED[s as keyof typeof ANSWERED](p)) s = nextStep(s, p);
  return s;
}

// Identity numbers we must never collect: Aadhaar (12 digits), PAN, card numbers, passport.
const SENSITIVE = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  /\b[A-Z]{5}\d{4}[A-Z]\b/i,
  /\b(?:\d[\s-]?){13,19}\b/,
  /\b[A-Z]\d{7}\b/,
];

export function containsSensitiveData(text: string): boolean {
  return SENSITIVE.some((re) => re.test(text));
}

const COMMANDS: Record<string, string[]> = {
  start: ["/start", "start", "hi", "hello", "hey", "namaste", "नमस्ते", "हेलो", "ഹലോ", "നമസ്കാരം"],
  menu: ["menu", "/menu", "मेनू", "മെനു", "0"],
  restart: ["restart", "/restart", "reset", "फिर से", "വീണ്ടും"],
  schemes: ["schemes", "/schemes", "my schemes", "योजनाएँ", "योजना", "പദ്ധതികൾ", "പദ്ധതി"],
  language: ["language", "/language", "भाषा", "ഭാഷ"],
  alertsOn: ["alerts on", "/subscribe", "subscribe"],
  alertsOff: ["alerts off", "/unsubscribe", "unsubscribe", "stop"],
  help: ["help", "/help", "मदद", "സഹായം"],
  delete: ["/delete", "delete", "delete my data", "डेटा हटाएं", "डेटा हटाएँ", "मेरा डेटा हटाएं", "ഡാറ്റ ഇല്ലാതാക്കുക", "വിവരങ്ങൾ ഇല്ലാതാക്കുക"],
};

function command(text: string): string | undefined {
  const s = text.trim().toLowerCase();
  return Object.keys(COMMANDS).find((k) => COMMANDS[k].includes(s));
}

function choiceOptions(def: ChoiceDef, lang: Lang): OutOption[] {
  return def.map((o) => ({ id: o.id, label: t(o.label, lang) }));
}

function consentPrompt(lang: Lang): OutMessage {
  return {
    text: fmt(t(STR.consent, lang), { url: env().baseUrl }),
    options: [
      { id: "consent:yes", label: t(STR.consentYes, lang) },
      { id: "consent:no", label: t(STR.consentNo, lang) },
    ],
  };
}

function ask(step: Step, lang: Lang): OutMessage {
  if (step === "language") return { text: STR.welcome.en, options: LANGUAGE_OPTIONS };
  if (step === "consent") return consentPrompt(lang);
  if (step === "done") return { text: "" };
  const def = CHOICES[step];
  return { text: t(QUESTION[step], lang), options: def ? choiceOptions(def, lang) : undefined };
}

/** Resolves a reply to an option id: tapped button, number, label in any language, then Groq. */
async function resolveChoice(input: Incoming, def: { id: string; label: Localized | string }[], question: string) {
  if (input.optionId && def.some((o) => o.id === input.optionId)) return input.optionId;
  const s = input.text.trim().toLowerCase();
  const n = Number(s);
  if (Number.isInteger(n) && n >= 1 && n <= def.length) return def[n - 1].id;
  for (const o of def) {
    const labels = typeof o.label === "string" ? [o.label] : Object.values(o.label);
    if (o.id === s || labels.some((l) => l && l.toLowerCase() === s)) return o.id;
  }
  if (/^(y|yes|haan|ha|han|हाँ|हां|അതെ|ഉണ്ട്|athe|und)$/i.test(s) && def.some((o) => o.id === "yes")) return "yes";
  if (/^(n|no|nahi|nahin|नहीं|ഇല്ല|illa)$/i.test(s) && def.some((o) => o.id === "no")) return "no";
  return interpretChoice(
    question,
    input.text,
    def.map((o) => ({ id: o.id, label: typeof o.label === "string" ? o.label : o.label.en })),
  );
}

function menu(user: User): OutMessage {
  const L = user.lang;
  return {
    text: t(STR.menu, L),
    options: [
      { id: "menu:schemes", label: t(STR.m_schemes, L) },
      { id: "menu:update", label: t(STR.m_update, L) },
      { id: "menu:language", label: t(STR.m_language, L) },
      { id: "menu:alerts", label: t(user.subscribed ? STR.m_alerts_off : STR.m_alerts_on, L) },
    ],
  };
}

function shortLine(s: Scheme, lang: Lang): string {
  const status = windowStatus(s);
  const flag = status === "open" ? " 🟢" : status === "upcoming" ? " 🕒" : "";
  return `*${t(s.name, lang)}*${flag}\n   ${t(s.benefits, lang)}`;
}

export function schemeDetails(s: Scheme, lang: Lang): string {
  const lines = [`📌 *${t(s.name, lang)}*`, `_${s.ministry}_`, "", t(s.summary, lang), ""];
  lines.push(`💰 *${t(STR.benefits, lang)}:* ${t(s.benefits, lang)}`);
  if (s.documents.length) lines.push(`📄 *${t(STR.documents, lang)}:* ${s.documents.join(", ")}`);
  lines.push(`📝 *${t(STR.howToApply, lang)}:* ${t(s.howToApply, lang)}`);
  const status = windowStatus(s);
  if (status === "open" && s.closeDate) lines.push(fmt(t(STR.openTill, lang), { date: formatDate(s.closeDate, lang) }));
  if (status === "upcoming" && s.openDate) lines.push(fmt(t(STR.opensOn, lang), { date: formatDate(s.openDate, lang) }));
  lines.push(`🔗 *${t(STR.applyHere, lang)}:* ${s.applyUrl}`);
  return lines.join("\n");
}

async function results(user: User): Promise<OutMessage[]> {
  const L = user.lang;
  const matched = matchSchemes(await listSchemes(), user.profile).slice(0, 10);
  user.lastResults = matched.map((s) => s.id);
  if (!matched.length) return [{ text: t(STR.noResults, L) }];
  const body = matched.map((s, i) => `${i + 1}. ${shortLine(s, L)}`).join("\n\n");
  return [
    {
      text: `${fmt(t(STR.resultsHeader, L), { n: matched.length })}\n\n${body}\n\n${t(STR.resultsFooter, L)}`,
      options: matched.map((s) => ({ id: `scheme:${s.id}`, label: t(s.name, L) })),
    },
  ];
}

async function applyAnswer(user: User, input: Incoming): Promise<OutMessage | null> {
  const L = user.lang;
  const p = user.profile;
  const step = user.step;

  if (step === "age") {
    let age = Number(input.text.match(/\d{1,3}/)?.[0]);
    if (!age) age = Number(await interpretValue("age", input.text));
    if (!age || age < 1 || age > 120) return { text: t(STR.invalidAge, L) };
    p.age = age;
    return null;
  }
  if (step === "state") {
    let state = matchState(input.text);
    if (!state) {
      const guess = await interpretValue("state", input.text);
      state = guess ? matchState(guess) : undefined;
    }
    if (!state) return { text: t(STR.invalidState, L) };
    p.state = state;
    return null;
  }

  const def = CHOICES[step];
  if (!def) return null;
  const id = await resolveChoice(input, def, t(QUESTION[step as keyof typeof QUESTION], "en"));
  if (!id) return { text: t(STR.invalid, L), options: choiceOptions(def, L) };

  switch (step) {
    case "gender":
      p.gender = id as Profile["gender"];
      break;
    case "area":
      p.area = id as Profile["area"];
      break;
    case "occupation":
      p.occupation = id as Profile["occupation"];
      break;
    case "income":
      p.annualIncome = INCOME_OPTIONS.find((o) => o.id === id)!.value;
      break;
    case "category":
      p.category = id as Profile["category"];
      break;
    case "ownsLand":
      p.ownsLand = id === "yes";
      break;
    case "disability":
      p.disability = id === "yes";
      break;
    case "bpl":
      p.bpl = id === "yes";
      break;
    case "girlChild":
      p.hasGirlChildUnder10 = id === "yes";
      break;
  }
  return null;
}

/** Main entry point: one incoming message → replies. Persists the user. */
export async function handleMessage(user: User, input: Incoming): Promise<OutMessage[]> {
  user.lastInboundAt = new Date().toISOString();
  const out = await route(user, input);
  if (!user.deleted) await saveUser(user);
  return out.filter((m) => m.text);
}

async function route(user: User, input: Incoming): Promise<OutMessage[]> {
  const L = user.lang;

  if (!input.optionId && containsSensitiveData(input.text)) {
    return [{ text: t(STR.sensitive, L) }, user.step === "done" ? menu(user) : ask(user.step, L)];
  }

  // Button taps from menus / result lists
  const opt = input.optionId ?? "";
  if (opt.startsWith("scheme:")) {
    const s = await getScheme(opt.slice(7));
    return s ? [{ text: schemeDetails(s, L) }] : [menu(user)];
  }
  if (opt.startsWith("menu:")) return menuAction(user, opt.slice(5));

  // Right to erasure: /delete asks for confirmation, then removes everything.
  if (opt === "delete:yes") {
    await deleteUser(user.id);
    await incrementCounter("data_deleted");
    user.deleted = true;
    return [{ text: t(STR.deleted, L) }];
  }
  if (opt === "delete:no") {
    return [{ text: t(STR.deleteCancelled, L) }, user.step === "done" ? menu(user) : ask(user.step, L)];
  }

  // Consent answer
  if (opt === "consent:no" || (user.step === "consent" && /^(2|no|nahi|नहीं|ഇല്ല|വേണ്ട)$/i.test(input.text.trim()))) {
    await deleteUser(user.id); // nothing is kept without consent
    await incrementCounter("consent_declined");
    user.deleted = true;
    return [{ text: fmt(t(STR.consentDeclined, L), { url: env().baseUrl }) }];
  }
  if (opt === "consent:yes" || (user.step === "consent" && /^(1|yes|haan|हाँ|हां|അതെ|i agree)$/i.test(input.text.trim()))) {
    user.consentAt = new Date().toISOString();
    user.step = firstUnanswered(user.profile);
    if (user.step === "done") return [menu(user)];
    if (user.step !== "age") return [ask(user.step, L)];
    return [{ text: t(STR.intro, L) }, ask(user.step, L)];
  }

  const cmd = command(input.text);
  if (cmd === "delete") {
    return [
      {
        text: t(STR.deleteConfirm, L),
        options: [
          { id: "delete:yes", label: t(STR.deleteYes, L) },
          { id: "delete:no", label: t(STR.deleteNo, L) },
        ],
      },
    ];
  }
  if (cmd === "restart") return menuAction(user, "update");
  if (cmd === "language") return menuAction(user, "language");
  if (cmd === "alertsOn" || cmd === "alertsOff") {
    user.subscribed = cmd === "alertsOn";
    return [{ text: t(user.subscribed ? STR.subscribed : STR.unsubscribed, L) }];
  }
  if (cmd === "help") return [{ text: t(STR.help, L) }];

  // Language selection
  if (user.step === "language") {
    const lang = await resolveChoice(input, LANGUAGE_OPTIONS, "Which language do you prefer?");
    if (!lang || (cmd === "start" && !input.optionId)) return [ask("language", L)];
    user.lang = lang as Lang;
    if (!user.consentAt) {
      user.step = "consent";
      return [consentPrompt(user.lang)];
    }
    user.step = firstUnanswered(user.profile);
    // Language change for an existing user keeps their answers.
    if (user.step === "done") return [menu(user)];
    if (user.step !== "age") return [ask(user.step, user.lang)];
    return [{ text: t(STR.intro, user.lang) }, ask(user.step, user.lang)];
  }

  // Waiting for consent, or an existing user who never gave it: ask (once) before anything else.
  if (user.step === "consent" || !user.consentAt) {
    user.step = "consent";
    return [consentPrompt(L)];
  }

  // Profile questions
  if (user.step !== "done") {
    if (cmd === "start" || cmd === "menu") return [ask(user.step, L)];
    const err = await applyAnswer(user, input);
    if (err) return [err];
    user.step = nextStep(user.step, user.profile);
    if (user.step !== "done") return [ask(user.step, L)];
    return [...(await results(user)), { text: t(STR.subscribed, L) }];
  }

  // Profile complete
  if (cmd === "start" || cmd === "menu") return [menu(user)];
  if (cmd === "schemes") return results(user);

  const n = Number(input.text.trim());
  if (Number.isInteger(n) && n >= 1 && n <= user.lastResults.length) {
    const s = await getScheme(user.lastResults[n - 1]);
    if (s) return [{ text: schemeDetails(s, L) }];
  }

  const matched = matchSchemes(await listSchemes(), user.profile);
  const answer = await answerQuestion(input.text, L, user.profile, matched);
  if (answer) return [{ text: answer }];
  return [{ text: t(STR.help, L) }, menu(user)];
}

async function menuAction(user: User, action: string): Promise<OutMessage[]> {
  const L = user.lang;
  switch (action) {
    case "schemes":
      return user.step === "done" ? results(user) : [ask(user.step, L)];
    case "update":
      user.profile = {};
      user.step = nextStep("language", user.profile);
      return [{ text: t(STR.intro, L) }, ask(user.step, L)];
    case "language":
      user.step = "language";
      return [ask("language", L)];
    case "alerts":
      user.subscribed = !user.subscribed;
      return [{ text: t(user.subscribed ? STR.subscribed : STR.unsubscribed, L) }];
    default:
      return [menu(user)];
  }
}
