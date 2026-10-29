import type { Lang, Localized } from "./types";

export function t(text: Localized | undefined, lang: Lang): string {
  if (!text) return "";
  return text[lang] || text.en;
}

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function formatDate(iso: string, lang: Lang): string {
  const locale = { en: "en-IN", hi: "hi-IN", ml: "ml-IN" }[lang];
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export const STR = {
  welcome: {
    en:
      "🙏 Namaste! I'm *Scheme Saathi*. I help you find government schemes you can apply for.\n\n" +
      "Please choose your language / कृपया अपनी भाषा चुनें / ദയവായി നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക",
  },
  intro: {
    en: "Great! I'll ask a few quick questions (about 2 minutes) to find schemes for you.\n🔒 I will never ask for Aadhaar, PAN, bank account or any other ID number.",
    hi: "बढ़िया! आपके लिए योजनाएँ खोजने के लिए मैं कुछ छोटे सवाल पूछूँगा (लगभग 2 मिनट)।\n🔒 मैं कभी भी आधार, पैन, बैंक खाता या कोई अन्य पहचान संख्या नहीं माँगूँगा।",
    ml: "കൊള്ളാം! നിങ്ങൾക്ക് അനുയോജ്യമായ പദ്ധതികൾ കണ്ടെത്താൻ ഞാൻ ചില ചെറിയ ചോദ്യങ്ങൾ ചോദിക്കും (ഏകദേശം 2 മിനിറ്റ്).\n🔒 ആധാർ, പാൻ, ബാങ്ക് അക്കൗണ്ട് തുടങ്ങിയ ഒരു തിരിച്ചറിയൽ നമ്പറും ഞാൻ ചോദിക്കില്ല.",
  },
  consent: {
    en: "Before we start: to find schemes for you, Scheme Saathi stores your chat ID and your answers (age, state, work, income band and similar). We use them only to match schemes and to send alerts, which you can stop anytime. We never ask for Aadhaar, PAN or bank numbers.\n\nYou can delete everything anytime by sending /delete. Privacy policy: {url}/privacy\n\nDo you agree?",
    hi: "शुरू करने से पहले: आपके लिए योजनाएँ खोजने के लिए स्कीम साथी आपकी चैट आईडी और आपके जवाब (उम्र, राज्य, काम, आय वर्ग आदि) सहेजता है। हम इनका उपयोग केवल योजनाएँ मिलाने और सूचनाएँ भेजने के लिए करते हैं, जिन्हें आप कभी भी बंद कर सकते हैं। हम कभी आधार, पैन या बैंक नंबर नहीं माँगते।\n\nआप कभी भी /delete भेजकर अपना सारा डेटा हटा सकते हैं। गोपनीयता नीति: {url}/privacy\n\nक्या आप सहमत हैं?",
    ml: "തുടങ്ങുന്നതിന് മുമ്പ്: നിങ്ങൾക്ക് അനുയോജ്യമായ പദ്ധതികൾ കണ്ടെത്താൻ സ്കീം സാഥി നിങ്ങളുടെ ചാറ്റ് ഐഡിയും ഉത്തരങ്ങളും (പ്രായം, സംസ്ഥാനം, തൊഴിൽ, വരുമാന വിഭാഗം തുടങ്ങിയവ) സൂക്ഷിക്കുന്നു. പദ്ധതികൾ കണ്ടെത്താനും അറിയിപ്പുകൾ അയയ്ക്കാനും മാത്രമാണ് ഇവ ഉപയോഗിക്കുന്നത്; അറിയിപ്പുകൾ എപ്പോൾ വേണമെങ്കിലും നിർത്താം. ആധാർ, പാൻ, ബാങ്ക് നമ്പറുകൾ ഞങ്ങൾ ഒരിക്കലും ചോദിക്കില്ല.\n\n/delete അയച്ച് എപ്പോൾ വേണമെങ്കിലും എല്ലാ വിവരങ്ങളും ഇല്ലാതാക്കാം. സ്വകാര്യതാ നയം: {url}/privacy\n\nനിങ്ങൾ സമ്മതിക്കുന്നുണ്ടോ?",
  },
  consentYes: { en: "I agree", hi: "मैं सहमत हूँ", ml: "ഞാൻ സമ്മതിക്കുന്നു" },
  consentNo: { en: "No, thanks", hi: "नहीं, धन्यवाद", ml: "വേണ്ട, നന്ദി" },
  consentDeclined: {
    en: "Okay. We have not saved your details. You can still browse schemes on our website: {url}\nSend hi anytime if you change your mind.",
    hi: "ठीक है। हमने आपकी जानकारी सहेजी नहीं है। आप हमारी वेबसाइट पर योजनाएँ देख सकते हैं: {url}\nमन बदले तो कभी भी hi भेजें।",
    ml: "ശരി. നിങ്ങളുടെ വിവരങ്ങൾ ഞങ്ങൾ സൂക്ഷിച്ചിട്ടില്ല. ഞങ്ങളുടെ വെബ്സൈറ്റിൽ പദ്ധതികൾ കാണാം: {url}\nമനസ്സ് മാറിയാൽ എപ്പോൾ വേണമെങ്കിലും hi അയയ്ക്കുക.",
  },
  deleteConfirm: {
    en: "This will permanently delete your answers, language, alert settings and alert history. Continue?",
    hi: "इससे आपके जवाब, भाषा, सूचना सेटिंग और सूचनाओं का इतिहास हमेशा के लिए हट जाएगा। जारी रखें?",
    ml: "ഇത് നിങ്ങളുടെ ഉത്തരങ്ങൾ, ഭാഷ, അറിയിപ്പ് ക്രമീകരണങ്ങൾ, അറിയിപ്പ് ചരിത്രം എന്നിവ സ്ഥിരമായി ഇല്ലാതാക്കും. തുടരണോ?",
  },
  deleteYes: { en: "Yes, delete", hi: "हाँ, हटाएँ", ml: "അതെ, ഇല്ലാതാക്കുക" },
  deleteNo: { en: "Cancel", hi: "रद्द करें", ml: "റദ്ദാക്കുക" },
  deleted: {
    en: "Your data has been deleted: answers, language, alert settings and alert history. Send hi anytime to start again.",
    hi: "आपका डेटा हटा दिया गया है: जवाब, भाषा, सूचना सेटिंग और सूचनाओं का इतिहास। दोबारा शुरू करने के लिए कभी भी hi भेजें।",
    ml: "നിങ്ങളുടെ വിവരങ്ങൾ ഇല്ലാതാക്കി: ഉത്തരങ്ങൾ, ഭാഷ, അറിയിപ്പ് ക്രമീകരണങ്ങൾ, അറിയിപ്പ് ചരിത്രം. വീണ്ടും തുടങ്ങാൻ എപ്പോൾ വേണമെങ്കിലും hi അയയ്ക്കുക.",
  },
  deleteCancelled: { en: "Nothing was deleted.", hi: "कुछ भी नहीं हटाया गया।", ml: "ഒന്നും ഇല്ലാതാക്കിയില്ല." },
  q_age: {
    en: "1️⃣ What is your age (in years)?",
    hi: "1️⃣ आपकी उम्र कितनी है (वर्षों में)?",
    ml: "1️⃣ നിങ്ങളുടെ പ്രായം എത്ര (വർഷത്തിൽ)?",
  },
  q_gender: { en: "2️⃣ Your gender?", hi: "2️⃣ आपका लिंग?", ml: "2️⃣ നിങ്ങളുടെ ലിംഗഭേദം?" },
  q_state: {
    en: "3️⃣ Which state or union territory do you live in? (type the name, e.g. Kerala)",
    hi: "3️⃣ आप किस राज्य या केंद्र शासित प्रदेश में रहते हैं? (नाम लिखें, जैसे उत्तर प्रदेश)",
    ml: "3️⃣ നിങ്ങൾ ഏത് സംസ്ഥാനത്ത് / കേന്ദ്രഭരണ പ്രദേശത്താണ് താമസിക്കുന്നത്? (പേര് ടൈപ്പ് ചെയ്യുക, ഉദാ: കേരളം)",
  },
  q_area: {
    en: "4️⃣ Do you live in a rural or urban area?",
    hi: "4️⃣ आप ग्रामीण क्षेत्र में रहते हैं या शहरी?",
    ml: "4️⃣ നിങ്ങൾ ഗ്രാമപ്രദേശത്താണോ നഗരപ്രദേശത്താണോ താമസിക്കുന്നത്?",
  },
  q_occupation: {
    en: "5️⃣ What best describes your work?",
    hi: "5️⃣ आपका काम क्या है?",
    ml: "5️⃣ നിങ്ങളുടെ തൊഴിൽ ഏതാണ്?",
  },
  q_ownsLand: {
    en: "🌾 Does your family own cultivable land in your name?",
    hi: "🌾 क्या आपके परिवार के नाम पर खेती योग्य ज़मीन है?",
    ml: "🌾 നിങ്ങളുടെ കുടുംബത്തിന്റെ പേരിൽ കൃഷിഭൂമി ഉണ്ടോ?",
  },
  q_income: {
    en: "6️⃣ What is your family's total annual income?",
    hi: "6️⃣ आपके परिवार की कुल वार्षिक आय कितनी है?",
    ml: "6️⃣ നിങ്ങളുടെ കുടുംബത്തിന്റെ ആകെ വാർഷിക വരുമാനം എത്ര?",
  },
  q_category: {
    en: "7️⃣ Your social category?",
    hi: "7️⃣ आपकी सामाजिक श्रेणी?",
    ml: "7️⃣ നിങ്ങളുടെ സാമൂഹിക വിഭാഗം?",
  },
  q_disability: {
    en: "8️⃣ Do you have a disability (40% or more)?",
    hi: "8️⃣ क्या आप दिव्यांग हैं (40% या अधिक)?",
    ml: "8️⃣ നിങ്ങൾക്ക് ഭിന്നശേഷി ഉണ്ടോ (40% അല്ലെങ്കിൽ കൂടുതൽ)?",
  },
  q_bpl: {
    en: "9️⃣ Does your family have a BPL / priority (AAY, PHH, yellow/pink) ration card?",
    hi: "9️⃣ क्या आपके परिवार के पास बीपीएल / अंत्योदय / प्राथमिकता राशन कार्ड है?",
    ml: "9️⃣ നിങ്ങളുടെ കുടുംബത്തിന് BPL / മുൻഗണനാ (മഞ്ഞ / പിങ്ക്) റേഷൻ കാർഡ് ഉണ്ടോ?",
  },
  q_girlChild: {
    en: "🔟 Do you have a daughter below 10 years of age?",
    hi: "🔟 क्या आपकी 10 वर्ष से कम उम्र की बेटी है?",
    ml: "🔟 നിങ്ങൾക്ക് 10 വയസ്സിൽ താഴെയുള്ള മകളുണ്ടോ?",
  },
  invalid: {
    en: "Sorry, I didn't understand that. Please choose one of the options (or reply with its number).",
    hi: "माफ़ कीजिए, मैं समझ नहीं पाया। कृपया कोई एक विकल्प चुनें (या उसका नंबर भेजें)।",
    ml: "ക്ഷമിക്കണം, എനിക്ക് മനസ്സിലായില്ല. ദയവായി ഒരു ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക (അല്ലെങ്കിൽ അതിന്റെ നമ്പർ അയയ്ക്കുക).",
  },
  invalidAge: {
    en: "Please send your age as a number, e.g. 34.",
    hi: "कृपया अपनी उम्र अंकों में भेजें, जैसे 34।",
    ml: "ദയവായി പ്രായം അക്കത്തിൽ അയയ്ക്കുക, ഉദാ: 34.",
  },
  invalidState: {
    en: "I couldn't recognise that state. Please type the full name, e.g. Kerala, Tamil Nadu, Uttar Pradesh.",
    hi: "मैं यह राज्य पहचान नहीं पाया। कृपया पूरा नाम लिखें, जैसे केरल, तमिलनाडु, उत्तर प्रदेश।",
    ml: "ആ സംസ്ഥാനം തിരിച്ചറിയാനായില്ല. ദയവായി പൂർണ്ണ പേര് ടൈപ്പ് ചെയ്യുക, ഉദാ: കേരളം, തമിഴ്നാട്.",
  },
  sensitive: {
    en: "⚠️ Please don't share Aadhaar, PAN, bank, card or other ID numbers here — I don't need them and haven't saved that message. Enter such details only on the official government portal.",
    hi: "⚠️ कृपया यहाँ आधार, पैन, बैंक, कार्ड या कोई अन्य पहचान संख्या साझा न करें — मुझे इनकी ज़रूरत नहीं है और मैंने वह संदेश सहेजा नहीं है। ऐसी जानकारी केवल आधिकारिक सरकारी पोर्टल पर ही दर्ज करें।",
    ml: "⚠️ ദയവായി ആധാർ, പാൻ, ബാങ്ക്, കാർഡ് തുടങ്ങിയ നമ്പറുകൾ ഇവിടെ പങ്കിടരുത് — എനിക്ക് അവ ആവശ്യമില്ല, ആ സന്ദേശം ഞാൻ സൂക്ഷിച്ചിട്ടുമില്ല. ഇത്തരം വിവരങ്ങൾ ഔദ്യോഗിക സർക്കാർ പോർട്ടലിൽ മാത്രം നൽകുക.",
  },
  resultsHeader: {
    en: "🎯 Based on your details, you may be eligible for *{n}* schemes:",
    hi: "🎯 आपकी जानकारी के आधार पर आप *{n}* योजनाओं के लिए पात्र हो सकते हैं:",
    ml: "🎯 നിങ്ങളുടെ വിവരങ്ങൾ അനുസരിച്ച് *{n}* പദ്ധതികൾക്ക് നിങ്ങൾ യോഗ്യരായേക്കാം:",
  },
  noResults: {
    en: "I couldn't find a matching scheme right now. I'll notify you when a new scheme you may qualify for opens. Send *menu* to update your details.",
    hi: "अभी मुझे कोई उपयुक्त योजना नहीं मिली। जब आपके लिए कोई नई योजना खुलेगी, मैं आपको सूचित करूँगा। जानकारी बदलने के लिए *menu* भेजें।",
    ml: "ഇപ്പോൾ അനുയോജ്യമായ പദ്ധതി കണ്ടെത്താനായില്ല. നിങ്ങൾക്ക് യോഗ്യതയുള്ള പുതിയ പദ്ധതി തുറക്കുമ്പോൾ ഞാൻ അറിയിക്കാം. വിവരങ്ങൾ മാറ്റാൻ *menu* അയയ്ക്കുക.",
  },
  resultsFooter: {
    en: "Reply with a number to see details and how to apply. Send *menu* for more options.\n_Eligibility is indicative — please confirm on the official portal._",
    hi: "विवरण और आवेदन का तरीका देखने के लिए नंबर भेजें। और विकल्पों के लिए *menu* भेजें।\n_पात्रता अनुमानित है — कृपया आधिकारिक पोर्टल पर पुष्टि करें।_",
    ml: "വിശദാംശങ്ങളും അപേക്ഷിക്കേണ്ട വിധവും കാണാൻ നമ്പർ അയയ്ക്കുക. കൂടുതൽ ഓപ്ഷനുകൾക്ക് *menu* അയയ്ക്കുക.\n_യോഗ്യത ഏകദേശമാണ് — ഔദ്യോഗിക പോർട്ടലിൽ ഉറപ്പാക്കുക._",
  },
  benefits: { en: "Benefits", hi: "लाभ", ml: "ആനുകൂല്യങ്ങൾ" },
  documents: { en: "Documents usually needed", hi: "आमतौर पर ज़रूरी दस्तावेज़", ml: "സാധാരണ ആവശ്യമായ രേഖകൾ" },
  howToApply: { en: "How to apply", hi: "आवेदन कैसे करें", ml: "എങ്ങനെ അപേക്ഷിക്കാം" },
  applyHere: { en: "Official link", hi: "आधिकारिक लिंक", ml: "ഔദ്യോഗിക ലിങ്ക്" },
  openTill: {
    en: "🗓️ Applications open till *{date}*",
    hi: "🗓️ आवेदन *{date}* तक खुले हैं",
    ml: "🗓️ *{date}* വരെ അപേക്ഷിക്കാം",
  },
  opensOn: {
    en: "🗓️ Applications open on *{date}*",
    hi: "🗓️ आवेदन *{date}* से शुरू होंगे",
    ml: "🗓️ *{date}* മുതൽ അപേക്ഷിക്കാം",
  },
  menu: {
    en: "📋 *Menu* — what would you like to do?",
    hi: "📋 *मेनू* — आप क्या करना चाहेंगे?",
    ml: "📋 *മെനു* — നിങ്ങൾ എന്ത് ചെയ്യാൻ ആഗ്രഹിക്കുന്നു?",
  },
  m_schemes: { en: "My schemes", hi: "मेरी योजनाएँ", ml: "എന്റെ പദ്ധതികൾ" },
  m_update: { en: "Update my details", hi: "जानकारी बदलें", ml: "വിവരങ്ങൾ മാറ്റുക" },
  m_language: { en: "Change language", hi: "भाषा बदलें", ml: "ഭാഷ മാറ്റുക" },
  m_alerts_off: { en: "Stop alerts", hi: "सूचनाएँ बंद करें", ml: "അറിയിപ്പുകൾ നിർത്തുക" },
  m_alerts_on: { en: "Start alerts", hi: "सूचनाएँ चालू करें", ml: "അറിയിപ്പുകൾ ആരംഭിക്കുക" },
  subscribed: {
    en: "🔔 Alerts are ON. I'll message you when a scheme you may qualify for opens or is about to close.",
    hi: "🔔 सूचनाएँ चालू हैं। आपके लायक कोई योजना खुलने या बंद होने वाली होगी तो मैं आपको संदेश भेजूँगा।",
    ml: "🔔 അറിയിപ്പുകൾ ഓണാണ്. നിങ്ങൾക്ക് യോഗ്യതയുള്ള പദ്ധതി തുറക്കുമ്പോഴോ അവസാനിക്കാറാകുമ്പോഴോ ഞാൻ അറിയിക്കാം.",
  },
  unsubscribed: {
    en: "🔕 Alerts are OFF. Send *alerts on* anytime to turn them back on.",
    hi: "🔕 सूचनाएँ बंद हैं। दोबारा चालू करने के लिए कभी भी *alerts on* भेजें।",
    ml: "🔕 അറിയിപ്പുകൾ ഓഫാണ്. വീണ്ടും ഓണാക്കാൻ എപ്പോൾ വേണമെങ്കിലും *alerts on* അയയ്ക്കുക.",
  },
  help: {
    en: "ℹ️ Commands: *menu*, *schemes*, *restart* (answer the questions again), *language*, *alerts on* / *alerts off*, */delete* (erase your data). You can also ask me a question about any scheme.",
    hi: "ℹ️ कमांड: *menu*, *schemes*, *restart* (सवाल दोबारा), *language*, *alerts on* / *alerts off*, */delete* (अपना डेटा हटाएँ)। आप किसी भी योजना के बारे में सवाल भी पूछ सकते हैं।",
    ml: "ℹ️ കമാൻഡുകൾ: *menu*, *schemes*, *restart* (ചോദ്യങ്ങൾ വീണ്ടും), *language*, *alerts on* / *alerts off*, */delete* (വിവരങ്ങൾ ഇല്ലാതാക്കുക). ഏതെങ്കിലും പദ്ധതിയെക്കുറിച്ച് ചോദ്യങ്ങളും ചോദിക്കാം.",
  },
  notifyOpened: {
    en: "🔔 *{name}* is now open for applications{till}.\nYou may be eligible based on your details.\n{benefit}\n👉 {url}\n\nReply *schemes* to see all your schemes.",
    hi: "🔔 *{name}* के लिए आवेदन अब खुले हैं{till}।\nआपकी जानकारी के अनुसार आप पात्र हो सकते हैं।\n{benefit}\n👉 {url}\n\nअपनी सभी योजनाएँ देखने के लिए *schemes* भेजें।",
    ml: "🔔 *{name}* ഇപ്പോൾ അപേക്ഷകൾ സ്വീകരിക്കുന്നു{till}.\nനിങ്ങളുടെ വിവരങ്ങൾ അനുസരിച്ച് നിങ്ങൾ യോഗ്യരായേക്കാം.\n{benefit}\n👉 {url}\n\nഎല്ലാ പദ്ധതികളും കാണാൻ *schemes* അയയ്ക്കുക.",
  },
  choose: { en: "Choose", hi: "चुनें", ml: "തിരഞ്ഞെടുക്കുക" },
  tillSuffix:{ en: " till {date}", hi: " ({date} तक)", ml: " ({date} വരെ)" },
  notifyClosing: {
    en: "⏰ Reminder: applications for *{name}* close on *{date}*. Apply soon 👉 {url}",
    hi: "⏰ याद दिलाना: *{name}* के आवेदन *{date}* को बंद हो जाएँगे। जल्दी आवेदन करें 👉 {url}",
    ml: "⏰ ഓർമ്മപ്പെടുത്തൽ: *{name}* അപേക്ഷ *{date}*-ന് അവസാനിക്കും. വേഗം അപേക്ഷിക്കൂ 👉 {url}",
  },
} satisfies Record<string, Localized>;

export const LANGUAGE_OPTIONS = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "ml", label: "മലയാളം" },
];

export const YES_NO: { id: "yes" | "no"; label: Localized }[] = [
  { id: "yes", label: { en: "Yes", hi: "हाँ", ml: "അതെ" } },
  { id: "no", label: { en: "No", hi: "नहीं", ml: "ഇല്ല" } },
];

export const GENDER_OPTIONS = [
  { id: "male", label: { en: "Male", hi: "पुरुष", ml: "പുരുഷൻ" } },
  { id: "female", label: { en: "Female", hi: "महिला", ml: "സ്ത്രീ" } },
  { id: "transgender", label: { en: "Transgender", hi: "ट्रांसजेंडर", ml: "ട്രാൻസ്ജെൻഡർ" } },
];

export const AREA_OPTIONS = [
  { id: "rural", label: { en: "Rural (village)", hi: "ग्रामीण (गाँव)", ml: "ഗ്രാമം" } },
  { id: "urban", label: { en: "Urban (town/city)", hi: "शहरी (कस्बा/शहर)", ml: "നഗരം" } },
];

export const OCCUPATION_OPTIONS = [
  { id: "farmer", label: { en: "Farmer", hi: "किसान", ml: "കർഷകൻ" } },
  { id: "student", label: { en: "Student", hi: "छात्र / छात्रा", ml: "വിദ്യാർത്ഥി" } },
  { id: "salaried", label: { en: "Salaried job", hi: "नौकरीपेशा", ml: "ശമ്പള ജോലി" } },
  { id: "self_employed", label: { en: "Own business", hi: "स्वरोज़गार / व्यवसाय", ml: "സ്വയംതൊഴിൽ / ബിസിനസ്" } },
  { id: "street_vendor", label: { en: "Street vendor", hi: "रेहड़ी-पटरी विक्रेता", ml: "വഴിയോര കച്ചവടം" } },
  { id: "artisan", label: { en: "Artisan / craftsperson", hi: "कारीगर / शिल्पकार", ml: "കരകൗശല തൊഴിലാളി" } },
  { id: "labourer", label: { en: "Daily-wage worker", hi: "दिहाड़ी मज़दूर", ml: "ദിവസക്കൂലി തൊഴിലാളി" } },
  { id: "homemaker", label: { en: "Homemaker", hi: "गृहिणी", ml: "വീട്ടമ്മ / ഗൃഹനാഥൻ" } },
  { id: "unemployed", label: { en: "Unemployed", hi: "बेरोज़गार", ml: "തൊഴിൽരഹിതർ" } },
  { id: "retired", label: { en: "Retired", hi: "सेवानिवृत्त", ml: "വിരമിച്ചവർ" } },
];

/** `value` is the band's upper bound in ₹, used for maxIncome checks. */
export const INCOME_OPTIONS = [
  { id: "inc_1l", value: 100_000, label: { en: "Up to ₹1 lakh", hi: "₹1 लाख तक", ml: "₹1 ലക്ഷം വരെ" } },
  { id: "inc_2_5l", value: 250_000, label: { en: "₹1 – 2.5 lakh", hi: "₹1 – 2.5 लाख", ml: "₹1 – 2.5 ലക്ഷം" } },
  { id: "inc_5l", value: 500_000, label: { en: "₹2.5 – 5 lakh", hi: "₹2.5 – 5 लाख", ml: "₹2.5 – 5 ലക്ഷം" } },
  { id: "inc_8l", value: 800_000, label: { en: "₹5 – 8 lakh", hi: "₹5 – 8 लाख", ml: "₹5 – 8 ലക്ഷം" } },
  { id: "inc_more", value: 10_000_000, label: { en: "Above ₹8 lakh", hi: "₹8 लाख से अधिक", ml: "₹8 ലക്ഷത്തിൽ കൂടുതൽ" } },
];

export const CATEGORY_OPTIONS = [
  { id: "general", label: { en: "General", hi: "सामान्य", ml: "പൊതു വിഭാഗം" } },
  { id: "obc", label: { en: "OBC", hi: "ओबीसी", ml: "ഒബിസി" } },
  { id: "sc", label: { en: "SC", hi: "अनुसूचित जाति (SC)", ml: "പട്ടികജാതി (SC)" } },
  { id: "st", label: { en: "ST", hi: "अनुसूचित जनजाति (ST)", ml: "പട്ടികവർഗ്ഗം (ST)" } },
  { id: "ews", label: { en: "EWS", hi: "ईडब्ल्यूएस (EWS)", ml: "ഇഡബ്ല്യുഎസ് (EWS)" } },
  { id: "minority", label: { en: "Minority community", hi: "अल्पसंख्यक", ml: "ന്യൂനപക്ഷം" } },
];

/** Canonical English names plus Hindi / Malayalam / common aliases. */
export const STATES: { name: string; aliases: string[] }[] = [
  { name: "Andhra Pradesh", aliases: ["आंध्र प्रदेश", "ആന്ധ്രാപ്രദേശ്", "ap", "andhra"] },
  { name: "Arunachal Pradesh", aliases: ["अरुणाचल प्रदेश", "അരുണാചൽ പ്രദേശ്"] },
  { name: "Assam", aliases: ["असम", "അസം"] },
  { name: "Bihar", aliases: ["बिहार", "ബിഹാർ"] },
  { name: "Chhattisgarh", aliases: ["छत्तीसगढ़", "ഛത്തീസ്ഗഢ്", "chattisgarh"] },
  { name: "Goa", aliases: ["गोवा", "ഗോവ"] },
  { name: "Gujarat", aliases: ["गुजरात", "ഗുജറാത്ത്"] },
  { name: "Haryana", aliases: ["हरियाणा", "ഹരിയാന"] },
  { name: "Himachal Pradesh", aliases: ["हिमाचल प्रदेश", "ഹിമാചൽ പ്രദേശ്", "hp", "himachal"] },
  { name: "Jharkhand", aliases: ["झारखंड", "ജാർഖണ്ഡ്"] },
  { name: "Karnataka", aliases: ["कर्नाटक", "കർണാടക"] },
  { name: "Kerala", aliases: ["केरल", "കേരളം", "കേരള", "keralam"] },
  { name: "Madhya Pradesh", aliases: ["मध्य प्रदेश", "മധ്യപ്രദേശ്", "mp"] },
  { name: "Maharashtra", aliases: ["महाराष्ट्र", "മഹാരാഷ്ട്ര"] },
  { name: "Manipur", aliases: ["मणिपुर", "മണിപ്പൂർ"] },
  { name: "Meghalaya", aliases: ["मेघालय", "മേഘാലയ"] },
  { name: "Mizoram", aliases: ["मिज़ोरम", "മിസോറാം"] },
  { name: "Nagaland", aliases: ["नागालैंड", "നാഗാലാൻഡ്"] },
  { name: "Odisha", aliases: ["ओडिशा", "ഒഡീഷ", "orissa"] },
  { name: "Punjab", aliases: ["पंजाब", "പഞ്ചാബ്"] },
  { name: "Rajasthan", aliases: ["राजस्थान", "രാജസ്ഥാൻ"] },
  { name: "Sikkim", aliases: ["सिक्किम", "സിക്കിം"] },
  { name: "Tamil Nadu", aliases: ["तमिलनाडु", "തമിഴ്നാട്", "tn", "tamilnadu"] },
  { name: "Telangana", aliases: ["तेलंगाना", "തെലങ്കാന"] },
  { name: "Tripura", aliases: ["त्रिपुरा", "ത്രിപുര"] },
  { name: "Uttar Pradesh", aliases: ["उत्तर प्रदेश", "ഉത്തർപ്രദേശ്", "up"] },
  { name: "Uttarakhand", aliases: ["उत्तराखंड", "ഉത്തരാഖണ്ഡ്", "uttaranchal"] },
  { name: "West Bengal", aliases: ["पश्चिम बंगाल", "പശ്ചിമ ബംഗാൾ", "wb", "bengal"] },
  { name: "Andaman and Nicobar Islands", aliases: ["अंडमान और निकोबार", "ആൻഡമാൻ നിക്കോബാർ", "andaman"] },
  { name: "Chandigarh", aliases: ["चंडीगढ़", "ചണ്ഡീഗഢ്"] },
  { name: "Dadra and Nagar Haveli and Daman and Diu", aliases: ["दादरा और नगर हवेली", "दमन और दीव", "daman", "diu", "dadra"] },
  { name: "Delhi", aliases: ["दिल्ली", "ഡൽഹി", "new delhi", "nct"] },
  { name: "Jammu and Kashmir", aliases: ["जम्मू और कश्मीर", "ജമ്മു കശ്മീർ", "j&k", "jk", "kashmir"] },
  { name: "Ladakh", aliases: ["लद्दाख", "ലഡാക്ക്"] },
  { name: "Lakshadweep", aliases: ["लक्षद्वीप", "ലക്ഷദ്വീപ്"] },
  { name: "Puducherry", aliases: ["पुडुचेरी", "പുതുച്ചേരി", "pondicherry"] },
];

export function matchState(input: string): string | undefined {
  const s = input.trim().toLowerCase();
  if (!s) return undefined;
  for (const st of STATES) {
    if (st.name.toLowerCase() === s || st.aliases.some((a) => a.toLowerCase() === s)) return st.name;
  }
  // Loose match for longer inputs like "I live in Kerala"
  for (const st of STATES) {
    const names = [st.name, ...st.aliases.filter((a) => a.length > 3)];
    if (names.some((n) => s.includes(n.toLowerCase()))) return st.name;
  }
  return undefined;
}
