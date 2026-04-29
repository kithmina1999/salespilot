export interface Rule {
  ID: number;
  business_id: number | null;
  keywords: string;
  responses: string; // JSON: {"en":"...","si":"...","ta":"..."}
  response: string;  // legacy fallback
  sinhala_response: string; // legacy fallback
  is_active: boolean;
  usage_count: number;
}

export interface LangMeta {
  label: string;
  nativeLabel: string;
  flag: string;
  color: string;
  placeholder: string;
}

/** All languages SalesPilot supports */
export const LANG_META: Record<string, LangMeta> = {
  en: { label: 'English',     nativeLabel: 'English',          flag: '🇬🇧', color: 'text-blue-400',   placeholder: 'We deliver island-wide within 3 business days...' },
  si: { label: 'Sinhala',     nativeLabel: 'සිංහල',             flag: '🇱🇰', color: 'text-green-400',  placeholder: 'අපගේ බෙදාහැරීමේ ක්‍රියාවලිය...' },
  ta: { label: 'Tamil',       nativeLabel: 'தமிழ்',              flag: '🇱🇰', color: 'text-purple-400', placeholder: 'அனைத்து தீவுகளிலும் 3 நாட்களில் விதரிக்கிறோம்...' },
  ar: { label: 'Arabic',      nativeLabel: 'العربية',            flag: '🇦🇪', color: 'text-amber-400',  placeholder: 'نحن نوصل في غضون 3 أيام...' },
  th: { label: 'Thai',        nativeLabel: 'ภาษาไทย',          flag: '🇹🇭', color: 'text-pink-400',   placeholder: 'เราจัดส่งทั่วประเทศ...' },
  ms: { label: 'Malay',       nativeLabel: 'Bahasa Melayu',   flag: '🇲🇾', color: 'text-cyan-400',   placeholder: 'Kami menghantar seluruh negara...' },
  id: { label: 'Indonesian',  nativeLabel: 'Bahasa Indonesia',flag: '🇮🇩', color: 'text-red-400',    placeholder: 'Kami mengirimkan ke seluruh Indonesia...' },
  hi: { label: 'Hindi',       nativeLabel: 'हिन्दी',            flag: '🇮🇳', color: 'text-orange-400', placeholder: 'हम समग्र भारत में डिलिवर करते हैं...' },
};

export function parseResponses(
  raw: string,
  legacy_en: string,
  legacy_si: string
): Record<string, string> {
  let map: Record<string, string> = {};
  try { map = JSON.parse(raw || '{}'); } catch { /* ignore */ }
  if (!map['en'] && legacy_en) map['en'] = legacy_en;
  if (!map['si'] && legacy_si) map['si'] = legacy_si;
  return map;
}
