/**
 * Rule-based quick-capture classifier.
 *
 * Pure and deterministic: takes raw text (Thai or English) and returns the
 * most likely entity type plus structured payload. AI classification can
 * replace or augment this later without changing the callers.
 */

export type CaptureSuggestionType =
  | "EXPENSE"
  | "INCOME"
  | "TODO"
  | "JOURNAL_ENTRY"
  | "IDEA"
  | "NOTE";

export interface CaptureSuggestion {
  type: CaptureSuggestionType;
  title: string;
  amount: number | null;
  currency: string;
  dueDate: string | null;
  suggestedTags: string[];
  areaHint: string | null;
}

/** Keyword -> Area name hints for tagging context automatically. */
const AREA_HINTS: Array<{ area: string; patterns: RegExp[] }> = [
  { area: "Hobby", patterns: [/hobby/i, /งานอดิเรก/, /keyboard/i, /กีตาร์/, /กล้อง/] },
  { area: "Work", patterns: [/\bwork\b/i, /ทำงาน/, /งาน(?!\s*อดิเรก)/, /\bmeeting\b/i, /ประชุม/] },
  { area: "Health", patterns: [/health/i, /สุขภาพ/, /ออกกำลัง/, /วิ่ง/, /\brun\b/i, /ยิม/, /\bgym\b/i] },
  { area: "Finance", patterns: [/finance/i, /การเงิน/, /เงินเดือน/, /\bsalary\b/i, /\bbudget\b/i] },
  { area: "Family", patterns: [/family/i, /ครอบครัว/, /ลูก/, /แม่/, /พ่อ/] },
  { area: "Learning", patterns: [/learning/i, /เรียน/, /\bstudy\b/i, /\bcourse\b/i, /คอร์ส/] },
];

const CURRENCY_MARKERS: Array<{ pattern: RegExp; currency: string }> = [
  { pattern: /(?:บาท|\bthb\b|฿)/i, currency: "THB" },
  { pattern: /(?:\$|\busd\b|\bdollar)/i, currency: "USD" },
  { pattern: /(?:€|\beur\b|\beuro)/i, currency: "EUR" },
  { pattern: /(?:¥|\bjpy\b|เยน)/i, currency: "JPY" },
];

const SPEND_VERBS =
  /ซื้อ|จ่าย|ชำระ|ค่า(?:ใช้จ่าย|อาหาร|เดินทาง|น้ำ|ไฟ|เน็ต|โทร)|bought|paid|pay(?:ment)?|purchase|spent|order/i;
const INCOME_VERBS =
  /เงินเดือน|รายได้|ได้เงิน|รับเงิน|ขาย(?:ได้)?|ค่าจ้าง|salary|income|received|earned|got paid|refund/i;
const JOURNAL_MARKERS =
  /รู้สึก|เหนื่อย|ดีใจ|มีความสุข|ผิดหวัง|เครียด|อารมณ์|ขอบคุณ(?:ที่)?|feel(?:ing)?|\btired\b|\bhappy\b|\bgrateful\b|\bstressed\b/i;
const IDEA_MARKERS =
  /อยาก(?:ทำ|ลอง|มี|สร้าง)?|ไอเดีย|ควร(?:ทำ|ลอง)|\bidea\b|\bwhat if\b|\bmaybe\b/i;
const TODO_MARKERS =
  /พรุ่งนี้|มะรืน|สัปดาห์(?:หน้า|นี้)|เดือนหน้า|ต้อง(?:ส่ง|ทำ|ไป|จ่าย|โทร)|โทร(?:หา)?|นัด|จอง|สมัคร|ซ่อม|ส่ง(?:งาน|รายงาน|เมล)|อ่าน(?:ต่อ)?|\btomorrow\b|\bnext week\b|\bcall\b|\bemail\b|\bsend\b|\bsubmit\b|\bbook\b|\brenew\b|\bfix\b|\breview\b|\bdue\b/i;

const AMOUNT_WITH_CURRENCY =
  /(?:฿|\$|€|¥)?\s?([\d,]+(?:\.\d{1,2})?)\s*(?:บาท|\bbaht\b|\bthb\b|\busd\b|\bdollars?\b|\beuros?\b|\bjpy\b|เหรียญ|เยน)/i;
const AMOUNT_PREFIXED = /(?:฿|\$|€|¥)\s?([\d,]+(?:\.\d{1,2})?)/;

/** Strips amount fragments so the remaining text can be used as a title. */
function buildTitle(raw: string, amount: number | null): string {
  let title = raw
    .replace(/\bสำหรับ\b|\bfor\b/gi, " ")
    .replace(/(ซื้อ|จ่าย|ชำระ|bought|paid for|purchased)\s*/gi, "")
    .replace(/(รับเงิน|ได้เงิน|received|earned)\s*/gi, "")
    .trim();
  if (amount !== null) {
    title = title
      .replace(new RegExp(String.raw`(?:฿|\$|€|¥)?\s?${amount.toLocaleString("en-US").replace(/,/g, ",?")}(?:\.\d{1,2})?\s*(?:บาท|\bbaht\b|\bthb\b|\busd\b|\bdollars?\b|\beuros?\b|\bjpy\b|เยน)?`, "i"), " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return title.length > 0 ? title : raw.trim();
}

function detectAmount(raw: string): { amount: number | null; currency: string } {
  const currency =
    CURRENCY_MARKERS.find(({ pattern }) => pattern.test(raw))?.currency ?? "THB";

  const match = raw.match(AMOUNT_WITH_CURRENCY) ?? raw.match(AMOUNT_PREFIXED);
  if (!match) return { amount: null, currency };

  const value = parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return { amount: null, currency };
  return { amount: value, currency };
}

function detectDueDate(raw: string, now: Date): string | null {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const localDateKey = (d: Date) => {
    // Local calendar date, never an ISO instant — a UTC round-trip would
    // shift the day for users east of UTC.
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
  };
  if (/พรุ่งนี้|tomorrow/i.test(raw)) {
    const d = startOfDay(now);
    d.setDate(d.getDate() + 1);
    return localDateKey(d);
  }
  if (/มะรืน|day after tomorrow/i.test(raw)) {
    const d = startOfDay(now);
    d.setDate(d.getDate() + 2);
    return localDateKey(d);
  }
  return null;
}

function detectAreaHint(raw: string): string | null {
  for (const { area, patterns } of AREA_HINTS) {
    if (patterns.some((p) => p.test(raw))) return area;
  }
  return null;
}

function detectTags(raw: string): string[] {
  const tags: string[] = [];
  const explicit = raw.match(/(?:สำหรับ|for)\s+([\p{L}\p{N}_-]{2,30})/iu);
  if (explicit) tags.push(explicit[1].trim().toLowerCase());
  const hashtag = raw.match(/#([\p{L}\p{N}_-]{2,30})/u);
  if (hashtag) tags.push(hashtag[1].toLowerCase());
  return [...new Set(tags)];
}

export function classifyCapture(raw: string, now: Date = new Date()): CaptureSuggestion {
  const text = raw.trim();
  const { amount, currency } = detectAmount(text);
  const isJournal = JOURNAL_MARKERS.test(text);

  let type: CaptureSuggestionType;
  if (isJournal) {
    type = "JOURNAL_ENTRY";
  } else if (amount !== null && INCOME_VERBS.test(text)) {
    type = "INCOME";
  } else if (amount !== null && (SPEND_VERBS.test(text) || CURRENCY_MARKERS.some(({ pattern }) => pattern.test(text)))) {
    type = "EXPENSE";
  } else if (IDEA_MARKERS.test(text)) {
    type = "IDEA";
  } else if (TODO_MARKERS.test(text)) {
    type = "TODO";
  } else {
    type = "NOTE";
  }

  return {
    type,
    title: buildTitle(text, type === "EXPENSE" || type === "INCOME" ? amount : null),
    amount: type === "EXPENSE" || type === "INCOME" ? amount : null,
    currency,
    dueDate: type === "TODO" ? detectDueDate(text, now) : null,
    suggestedTags: detectTags(text),
    areaHint: detectAreaHint(text),
  };
}
