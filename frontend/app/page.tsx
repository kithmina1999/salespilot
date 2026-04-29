'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bot, Zap, MessageCircle, BarChart3, Shield, Clock,
  ChevronRight, Check, Star, Menu, X, Globe, ArrowRight,
  Sparkles, Package, Users, TrendingUp, Phone, Mail,
  ChevronDown, PlayCircle
} from 'lucide-react';

// ── Bilingual content ──────────────────────────────────────────────────────────
const CONTENT = {
  en: {
    nav: { features: 'Features', pricing: 'Pricing', faq: 'FAQ', login: 'Sign In', cta: 'Start Free Trial' },
    hero: {
      badge: '🇱🇰 Built for Sri Lankan Businesses',
      h1a: 'Your WhatsApp,',
      h1b: 'On Autopilot.',
      sub: 'SalesPilot turns your WhatsApp into a 24/7 AI sales agent — answering customers, taking orders, and growing your business while you sleep.',
      cta1: 'Start Free — 14 Days',
      cta2: 'Watch Demo',
      trust: 'No credit card required  ·  Setup in 5 minutes  ·  Cancel anytime',
    },
    stats: [
      { value: '24/7', label: 'AI Always Online' },
      { value: '< 2s', label: 'Response Time' },
      { value: '3x', label: 'More Sales Closed' },
      { value: '5 min', label: 'Setup Time' },
    ],
    features: {
      title: 'Everything your business needs',
      sub: 'Stop losing customers to slow replies. SalesPilot handles your WhatsApp so you can focus on running your business.',
      items: [
        { icon: 'Bot', title: 'AI-Powered Replies', desc: 'Gemini AI understands your customers and replies instantly — even at 2AM. In Sinhala, English, or both.' },
        { icon: 'Package', title: 'Smart Order Taking', desc: 'Customers can browse your catalog, ask questions, and place orders — all through WhatsApp. No app needed.' },
        { icon: 'Zap', title: 'Instant FAQ Engine', desc: 'Train your bot with your own rules. Price queries, delivery info, return policy — answered in seconds.' },
        { icon: 'BarChart3', title: 'Sales Dashboard', desc: 'See every conversation, order, and customer in one place. Know exactly what your customers are asking.' },
        { icon: 'Globe', title: 'Sinhala + English', desc: 'Your bot speaks both languages. Customers can message in Sinhala — it replies in Sinhala. Magic.' },
        { icon: 'Shield', title: 'Enterprise Security', desc: 'Your data stays yours. Encrypted sessions, secure API keys, and daily cloud backups.' },
      ],
    },
    howItWorks: {
      title: 'Up and running in 5 minutes',
      sub: 'No technical skills required. If you can send a WhatsApp message, you can set up SalesPilot.',
      steps: [
        { n: '01', title: 'Register & Choose Your Industry', desc: 'Tell us what you sell — clothing, food, electronics, beauty. We pre-load your bot with industry-specific knowledge.' },
        { n: '02', title: 'Scan QR Code', desc: 'Link your WhatsApp Business number by scanning a QR code. Takes 30 seconds. Your number stays yours.' },
        { n: '03', title: 'Go Live', desc: 'Your AI bot is now answering customers. Watch replies happen in real-time on your dashboard.' },
      ],
    },
    pricing: {
      title: 'Simple, honest pricing',
      sub: 'Start free. Scale when you\'re ready. No surprise fees.',
      plans: [
        {
          name: 'Free',
          price: 'Free',
          period: 'forever',
          desc: 'Perfect to try SalesPilot with no commitment.',
          features: ['50 AI replies / month', '10 FAQ rules', '1 WhatsApp number', 'Basic dashboard', 'Community support'],
          cta: 'Get Started Free',
          highlight: false,
          badge: null,
        },
        {
          name: 'Starter',
          price: 'LKR 4,500',
          period: '/ month',
          desc: 'For active businesses ready to automate sales.',
          features: ['3,000 AI replies / month', 'Unlimited FAQ rules', '1 WhatsApp number', 'Full analytics dashboard', 'Priority WhatsApp support', 'Daily cloud backups', 'Sinhala + English AI'],
          cta: 'Start 14-Day Free Trial',
          highlight: true,
          badge: 'Most Popular',
        },
        {
          name: 'Pro',
          price: 'LKR 9,500',
          period: '/ month',
          desc: 'For power sellers and growing teams.',
          features: ['Unlimited AI replies', 'Unlimited FAQ rules', 'Up to 3 WhatsApp numbers', 'Advanced analytics', 'Priority phone support', 'Custom AI personality', 'White-label options'],
          cta: 'Contact Sales',
          highlight: false,
          badge: 'Coming Soon',
        },
      ],
    },
    testimonials: [
      { name: 'Kasun Perera', biz: 'KP Fashion, Colombo', text: 'Before SalesPilot I was missing messages at night. Now my bot handles everything. Sales went up 40% in the first month.', stars: 5 },
      { name: 'Nimasha Silva', biz: 'Sweet Delights Bakery, Kandy', text: 'Setup was unbelievably easy. 5 minutes and my bot was live. Customers love getting instant replies in Sinhala!', stars: 5 },
      { name: 'Roshan Fernando', biz: 'TechZone Electronics, Gampaha', text: 'The AI handles product questions perfectly. I spend my time on deliveries, not answering "ada mila kiyanneko".', stars: 5 },
    ],
    faq: {
      title: 'Frequently asked questions',
      items: [
        { q: 'Will I lose my WhatsApp number or chats?', a: 'No. You link your existing WhatsApp Business number via QR code. Your number stays yours. You can unlink anytime.' },
        { q: 'Does it work in Sinhala?', a: 'Yes! SalesPilot is built specifically for Sri Lankan businesses. The AI understands Sinhala, Singlish (mixed Sinhala-English), and English. It replies in whichever language the customer uses.' },
        { q: 'What happens after the 14-day trial?', a: 'You\'ll be on the Free plan automatically — no charges, no card required. You can upgrade to Starter anytime using a bank transfer or online payment.' },
        { q: 'How do I pay? Do you accept bank transfers?', a: 'Yes! We accept bank transfers, Frimi, eZ Cash, and PayHere online payments. Most Sri Lankan businesses prefer bank transfer — we make it easy.' },
        { q: 'Can I customize what the bot says?', a: 'Absolutely. You control every reply through your FAQ rules. The AI uses your rules first, then falls back to Gemini AI for questions you haven\'t covered. You can also set a custom bot name and personality.' },
        { q: 'What if a customer asks something the bot doesn\'t know?', a: 'The bot either asks a clarifying question, transfers to you (the human), or uses Gemini AI to give a sensible answer. Unanswered questions are flagged in your dashboard so you can add them as FAQ rules.' },
      ],
    },
    cta: {
      title: 'Ready to stop missing sales?',
      sub: 'Join Sri Lankan businesses already using SalesPilot to serve customers 24/7.',
      btn: 'Start Your Free Trial',
      note: 'No credit card · 14 days free · Cancel anytime',
    },
    footer: {
      tagline: 'WhatsApp AI for Sri Lankan businesses.',
      links: ['Features', 'Pricing', 'FAQ', 'Login'],
      legal: ['Privacy Policy', 'Terms of Service'],
      copy: '© 2026 SalesPilot. Built in 🇱🇰 Sri Lanka.',
    },
  },
  si: {
    nav: { features: 'විශේෂාංග', pricing: 'මිල', faq: 'FAQ', login: 'ලොගින්', cta: 'නොමිලේ ආරම්භ කරන්න' },
    hero: {
      badge: '🇱🇰 ශ්‍රී ලංකා ව්‍යාපාර සඳහාම නිර්මාණය කළ',
      h1a: 'ඔබේ WhatsApp Business එක,',
      h1b: 'Auto Pilot මත.',
       sub: 'SalesPilot ඔබේ WhatsApp 24/7 AI sales agent එකක් බවට පත් කරනවා — customers ට instant reply දෙනවා, orders ගන්නවා, ඔබ නිදාගෙන ඉන්නකොටත් business grow කරනවා.',
      cta1: 'FREE TRIAL එක පටන් ගන්න',
      cta2: 'Demo එක බලන්න',
      trust: 'Card අවශ්‍ය නැහැ  ·  Setup: මිනිත්තු 5යි  ·  ඕන වෙලාවක cancel කරන්න',
    },
    stats: [
      { value: '24/7', label: 'AI සෑම විටම Online' },
      { value: '< 2s', label: 'Reply Time' },
      { value: '3x', label: 'වැඩි Sales' },
      { value: '5 min', label: 'Setup Time' },
    ],
    features: {
      title: 'ඔබේ ව්‍යාපාරයට ඕන සියල්ල',
      sub: 'Slow replies නිසා customers අහිමි කරගන්න එපා. SalesPilot WhatsApp handle කරනවා — ඔබ business run කරන්න.',
      items: [
        { icon: 'Bot', title: 'AI Replies', desc: 'Gemini AI ඔබේ customers ට instant reply දෙනවා — රාත්‍රී 2 ට වුනත්. සිංහලෙනුත්, ඉංග්‍රීසියෙනුත්.' },
        { icon: 'Package', title: 'Smart Order Taking', desc: 'Customers WhatsApp හරහාම catalog බලලා orders දාන්න පුළුවන්. App download කරන්නෙ නැතුව.' },
        { icon: 'Zap', title: 'FAQ Engine', desc: 'ඔබේම rules දාන්න. මිල, delivery, returns — seconds ඇතුළත answer.' },
        { icon: 'BarChart3', title: 'Sales Dashboard', desc: 'සෑම conversation, order, customer එකක්ම එක තැනකින් බලන්න.' },
        { icon: 'Globe', title: 'සිංහල + English', desc: 'Customer සිංහලෙන් message කළාම, bot සිංහලෙන් reply කරනවා. Magic.' },
        { icon: 'Shield', title: 'Secure', desc: 'ඔබේ data ඔබේමයි. Encrypted sessions, daily cloud backups.' },
      ],
    },
    howItWorks: {
      title: 'මිනිත්තු 5ක් ඇතුළත Live කරන්න',
      sub: 'Technical skills ඕනෙ නැහැ. WhatsApp use කරන්න දන්නවා නම් SalesPilot setup කරන්න දන්නවා.',
      steps: [
        { n: '01', title: 'Register කරලා Industry තෝරන්න', desc: 'ඔබ මොනවද විකුණන්නේ කියන්න — ඇඳුම්, කෑම, electronics. Industry ගැලපෙන knowledge AI ට pre-load කරනවා.' },
        { n: '02', title: 'QR Code Scan කරන්න', desc: 'WhatsApp Business number QR code scan කරලා link කරන්න. Seconds 30 යි. Number ඔබේමයි.' },
        { n: '03', title: 'Live කරන්න', desc: 'AI bot දැන් customers ට reply කරනවා. Dashboard එකෙන් real-time බලන්න.' },
      ],
    },
    pricing: {
      title: 'සරල, හිතවත් මිල ගණන්',
      sub: 'නොමිලේ ආරම්භ කරන්න. Ready වෙනකොට upgrade කරන්න.',
      plans: [
        {
          name: 'Free',
          price: 'නොමිලේ',
          period: 'සදාකාලිකව',
          desc: 'SalesPilot try කරන්න.',
          features: ['AI replies 50 / month', 'FAQ rules 10', 'WhatsApp number 1', 'Basic dashboard', 'Community support'],
          cta: 'නොමිලේ ආරම්භ කරන්න',
          highlight: false,
          badge: null,
        },
        {
          name: 'Starter',
          price: 'රු. 4,500',
          period: '/ month',
          desc: 'Sales automate කරන්න ready ව්‍යාපාර වලට.',
          features: ['AI replies 3,000 / month', 'Unlimited FAQ rules', 'WhatsApp number 1', 'Full analytics', 'Priority support', 'Daily backups', 'සිංහල + English AI'],
          cta: 'දින 14 නොමිලේ Trial',
          highlight: true,
          badge: 'Most Popular',
        },
        {
          name: 'Pro',
          price: 'රු. 9,500',
          period: '/ month',
          desc: 'Growing teams සඳහා.',
          features: ['Unlimited AI replies', 'Unlimited FAQ rules', 'Numbers 3ක් දක්වා', 'Advanced analytics', 'Priority phone support', 'Custom AI personality'],
          cta: 'Sales Team Contact',
          highlight: false,
          badge: 'Coming Soon',
        },
      ],
    },
    testimonials: [
      { name: 'කසුන් පෙරේරා', biz: 'KP Fashion, කොළඹ', text: 'SalesPilot ට කලින් රාත්‍රී messages miss වෙනවා. දැන් bot handle කරනවා. පළමු මාසේ sales 40%ක් ගියා.', stars: 5 },
      { name: 'නිමාෂා සිල්වා', biz: 'Sweet Delights Bakery, මහනුවර', text: 'Setup ගොඩාක් ලේසි. මිනිත්තු 5ක් ඇතුළත bot live. Customers සිංහලෙන් instant reply ලැබෙනවා!', stars: 5 },
      { name: 'රෝශාන් ප්‍රනාන්දු', biz: 'TechZone Electronics, ගම්පහ', text: '"අද මිල කියන්නකො" කියලා message reply කරන්නෙ bot. මම deliveries කරනවා.', stars: 5 },
    ],
    faq: {
      title: 'නිතර අසන ප්‍රශ්න',
      items: [
        { q: 'WhatsApp number හෝ chats නැතිවෙනවද?', a: 'නැහැ. QR code scan කරලා existing WhatsApp Business number link කරනවා. Number ඔබේමයි. ඕන වෙලාවක unlink කරන්න පුළුවන්.' },
        { q: 'සිංහලෙන් work කරනවාද?', a: 'ඔව්! SalesPilot ශ්‍රී ලංකා businesses සඳහාම build කළා. AI සිංහල, Singlish, English තේරෙනවා. Customer යවන භාෂාවෙන්ම reply කරනවා.' },
        { q: 'Trial ඉවර වෙලාද?', a: 'Free plan ට automatically යනවා — charges නැහැ, card ඕනෙ නැහැ. Starter ට upgrade කරන්න bank transfer හෝ online payment use කරන්න.' },
        { q: 'Payment — bank transfer accept කරනවාද?', a: 'ඔව්! Bank transfer, Frimi, eZ Cash, PayHere accept කරනවා.' },
        { q: 'Bot කියන දේ customize කරන්න පළුවන්ද?', a: 'ඔව්. FAQ rules හරහා ඔබ සෑම reply එකක්ම control කරනවා. Bot name, personality customize කරන්න පළුවන්.' },
        { q: 'Bot නොදන්නා ප්‍රශ්නයකට?', a: 'Gemini AI sensible answer දෙනවා, නැත්නම් human ට escalate කරනවා. Dashboard ෙ unanswered questions flag කරනවා.' },
      ],
    },
    cta: {
      title: 'Sales miss කරන එක නවත්වන්නද?',
      sub: 'SalesPilot use කරන ශ්‍රී ලංකා businesses ට join වෙන්න.',
      btn: 'නොමිලේ Trial ආරම්භ කරන්න',
      note: 'Card ඕනෙ නැහැ · දින 14 නොමිලේ · ඕන වෙලාවක cancel',
    },
    footer: {
      tagline: 'ශ්‍රී ලංකා businesses සඳහා WhatsApp AI.',
      links: ['විශේෂාංග', 'මිල', 'FAQ', 'ලොගින්'],
      legal: ['Privacy Policy', 'Terms of Service'],
      copy: '© 2026 SalesPilot. 🇱🇰 ශ්‍රී ලංකාවේ නිර්මාණය.',
    },
  },
};

// ── WhatsApp Chat Mockup ───────────────────────────────────────────────────────
const chatMessages = [
  { from: 'customer', text: 'Hello, ada enna dress ekak mila kiyanneko? 👗', delay: 0 },
  { from: 'bot', text: 'ආයුබෝවන්! 😊 Spring Collection ඇඳුම් LKR 2,800 සිට ලැබෙනවා!\n\nColors: Black, Red, Blue, White\nSizes: S, M, L, XL\n\nWhich color ද?', delay: 1200 },
  { from: 'customer', text: 'Red ekak M size. Delivery gampahata?', delay: 2600 },
  { from: 'bot', text: '✅ Red — M size stock ඇත!\n\n🚚 Gampaha delivery: LKR 350\n📦 Days 2-3 ඇතුළත\n\nOrder confirm කරන්නද? 😊', delay: 4000 },
  { from: 'customer', text: 'Yes! COD ok da?', delay: 5200 },
  { from: 'bot', text: '✅ COD OK!\n\nOrder confirmed! 🎉\nOrder #SP-2847\n\nAddress send කරන්නකෝ 🙏', delay: 6400 },
];

function ChatMockup() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (visibleCount >= chatMessages.length) {
      // Loop after a pause
      const t = setTimeout(() => setVisibleCount(0), 4000);
      return () => clearTimeout(t);
    }
    const msg = chatMessages[visibleCount];
    const showTyping = msg.from === 'bot';
    if (showTyping) setIsTyping(true);
    const t = setTimeout(() => {
      setIsTyping(false);
      setVisibleCount(v => v + 1);
    }, showTyping ? 900 : 400);
    return () => clearTimeout(t);
  }, [visibleCount]);

  return (
    <div style={{
      background: '#0f1117',
      border: '1px solid rgba(34,197,94,0.2)',
      borderRadius: '24px',
      overflow: 'hidden',
      boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,197,94,0.1)',
      width: '340px',
      maxWidth: '100%',
    }}>
      {/* Header */}
      <div style={{ background: '#1a1d27', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={20} color="#fff" />
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#e8eaf0' }}>SalesPilot AI</p>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#22c55e' }}>● Online 24/7</p>
        </div>
      </div>
      {/* Messages */}
      <div style={{ padding: '16px 14px', minHeight: '280px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABpJREFUeNpiYGBg+M9AAWAiSRKmkHQFAAIMAAADAAECAAIAAAAASUVORK5CYII=") rgba(13,13,20,0.98)' }}>
        {chatMessages.slice(0, visibleCount).map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'customer' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '82%',
              padding: '9px 13px',
              borderRadius: msg.from === 'customer' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
              background: msg.from === 'customer' ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)',
              border: msg.from === 'customer' ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.78rem',
              color: '#e8eaf0',
              lineHeight: 1.5,
              whiteSpace: 'pre-line',
              animation: 'fadeSlideUp 0.3s ease',
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '10px 14px', borderRadius: '4px 16px 16px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'block', animation: `bounce 1s ${i * 0.15}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── FAQ Accordion ─────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', background: 'none', border: 'none', padding: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: '16px' }}
      >
        <span style={{ color: '#e8eaf0', fontWeight: 600, fontSize: '0.95rem', textAlign: 'left' }}>{q}</span>
        <ChevronDown size={18} color="#6b7280" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }} />
      </button>
      {open && (
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1.7, paddingBottom: '20px', margin: 0 }}>{a}</p>
      )}
    </div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const [lang, setLang] = useState<'en' | 'si'>('en');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const t = CONTENT[lang];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const iconMap: Record<string, React.ReactNode> = {
    Bot: <Bot size={22} />, Package: <Package size={22} />, Zap: <Zap size={22} />,
    BarChart3: <BarChart3 size={22} />, Globe: <Globe size={22} />, Shield: <Shield size={22} />,
  };

  return (
    <div style={{ background: '#080b10', color: '#e8eaf0', fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bounce { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-6px); } }
        @keyframes float { 0%,100% { transform:translateY(0px); } 50% { transform:translateY(-12px); } }
        @keyframes pulse-glow { 0%,100% { box-shadow:0 0 20px rgba(34,197,94,0.2); } 50% { box-shadow:0 0 40px rgba(34,197,94,0.4); } }
        .nav-link { color:#9ca3af; text-decoration:none; font-size:0.9rem; font-weight:500; transition:color 0.2s; }
        .nav-link:hover { color:#e8eaf0; }
        .btn-primary { background:linear-gradient(135deg,#22c55e,#16a34a); color:#fff; border:none; padding:14px 28px; border-radius:14px; font-weight:700; font-size:0.95rem; cursor:pointer; transition:all 0.2s; display:inline-flex; align-items:center; gap:8px; box-shadow:0 8px 24px rgba(34,197,94,0.25); text-decoration:none; }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(34,197,94,0.35); }
        .btn-ghost { background:rgba(255,255,255,0.05); color:#e8eaf0; border:1px solid rgba(255,255,255,0.1); padding:14px 24px; border-radius:14px; font-weight:600; font-size:0.9rem; cursor:pointer; transition:all 0.2s; display:inline-flex; align-items:center; gap:8px; text-decoration:none; }
        .btn-ghost:hover { background:rgba(255,255,255,0.09); border-color:rgba(255,255,255,0.2); }
        .feature-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:20px; padding:28px; transition:all 0.3s; }
        .feature-card:hover { background:rgba(255,255,255,0.055); border-color:rgba(34,197,94,0.2); transform:translateY(-2px); }
        .pricing-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:24px; padding:32px; transition:all 0.3s; }
        .pricing-card.highlight { background:rgba(34,197,94,0.06); border-color:rgba(34,197,94,0.3); box-shadow:0 0 40px rgba(34,197,94,0.08); }
        .testimonial-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:20px; padding:28px; }
        .step-number { background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05)); border:1px solid rgba(34,197,94,0.25); border-radius:16px; width:56px; height:56px; display:flex; align-items:center; justify-content:center; font-size:0.85rem; font-weight:900; color:#22c55e; letter-spacing:1px; flex-shrink:0; }
      `}</style>

      {/* ── NAV ───────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? 'rgba(8,11,16,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : 'none',
        transition: 'all 0.3s',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#22c55e,#16a34a)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}>
              <Bot size={20} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff', letterSpacing: '-0.5px' }}>SalesPilot</span>
          </div>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }} className="desktop-nav">
            {['features', 'pricing', 'faq'].map(key => (
              <a key={key} href={`#${key}`} className="nav-link">{t.nav[key as keyof typeof t.nav]}</a>
            ))}
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Lang toggle */}
            <button
              onClick={() => setLang(l => l === 'en' ? 'si' : 'en')}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 12px', color: '#9ca3af', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Globe size={14} />
              {lang === 'en' ? 'සිං' : 'EN'}
            </button>
            <Link href="/login" className="nav-link" style={{ display: 'none' }}>{t.nav.login}</Link>
            <Link href="/register" className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>
              {t.nav.cta}
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ display: 'none', background: 'none', border: 'none', color: '#e8eaf0', cursor: 'pointer', padding: 4 }} id="mobile-menu-btn">
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div style={{ background: 'rgba(8,11,16,0.97)', backdropFilter: 'blur(20px)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {['features', 'pricing', 'faq'].map(key => (
              <a key={key} href={`#${key}`} className="nav-link" style={{ fontSize: '1rem' }} onClick={() => setMobileMenuOpen(false)}>{t.nav[key as keyof typeof t.nav]}</a>
            ))}
            <Link href="/login" style={{ color: '#9ca3af', textDecoration: 'none', fontWeight: 500 }}>{t.nav.login}</Link>
            <Link href="/register" className="btn-primary" style={{ justifyContent: 'center' }}>{t.nav.cta}</Link>
          </div>
        )}
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '100px 24px 60px', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '600px', background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '10%', width: '400px', height: '400px', background: 'radial-gradient(ellipse, rgba(99,102,241,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
          {/* Left */}
          <div style={{ animation: 'fadeSlideUp 0.7s ease' }}>
            {/* Badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '100px', padding: '6px 16px', marginBottom: '28px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#22c55e' }}>{t.hero.badge}</span>
            </div>

            <h1 style={{ fontSize: 'clamp(2.4rem,5vw,3.8rem)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-2px', margin: '0 0 20px', color: '#fff' }}>
              {t.hero.h1a}<br />
              <span style={{ background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 50%, #86efac 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {t.hero.h1b}
              </span>
            </h1>

            <p style={{ fontSize: '1.05rem', color: '#9ca3af', lineHeight: 1.7, marginBottom: '36px', maxWidth: '480px' }}>{t.hero.sub}</p>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <Link href="/register" className="btn-primary">
                {t.hero.cta1} <ArrowRight size={17} />
              </Link>
              <a href="#features" className="btn-ghost">
                <PlayCircle size={17} /> {t.hero.cta2}
              </a>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#4b5563', margin: 0 }}>{t.hero.trust}</p>
          </div>

          {/* Right — Chat mockup */}
          <div style={{ display: 'flex', justifyContent: 'center', animation: 'float 6s ease-in-out infinite' }}>
            <ChatMockup />
          </div>
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '20px 24px 80px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'rgba(255,255,255,0.07)', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
          {t.stats.map((s, i) => (
            <div key={i} style={{ background: 'rgba(8,11,16,0.9)', padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: '2.2rem', fontWeight: 900, color: '#22c55e', margin: '0 0 6px', letterSpacing: '-1px' }}>{s.value}</p>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0, fontWeight: 500 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: '100px', padding: '5px 14px', marginBottom: '20px' }}>
              <Sparkles size={13} color="#22c55e" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '1px' }}>Features</span>
            </div>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', margin: '0 0 16px' }}>{t.features.title}</h2>
            <p style={{ color: '#6b7280', fontSize: '1rem', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>{t.features.sub}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
            {t.features.items.map((f, i) => (
              <div key={i} className="feature-card">
                <div style={{ width: 48, height: 48, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', marginBottom: '18px' }}>
                  {iconMap[f.icon]}
                </div>
                <h3 style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', margin: '0 0 10px' }}>{f.title}</h3>
                <p style={{ color: '#6b7280', fontSize: '0.88rem', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', margin: '0 0 14px' }}>{t.howItWorks.title}</h2>
            <p style={{ color: '#6b7280', maxWidth: '520px', margin: '0 auto', lineHeight: 1.7 }}>{t.howItWorks.sub}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '32px' }}>
            {t.howItWorks.steps.map((step, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                  <div className="step-number">{step.n}</div>
                </div>
                <h3 style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem', margin: '0 0 12px' }}>{step.title}</h3>
                <p style={{ color: '#6b7280', fontSize: '0.88rem', lineHeight: 1.65, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '100px', padding: '5px 14px', marginBottom: '20px' }}>
              <Zap size={13} color="#f59e0b" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px' }}>Pricing</span>
            </div>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', margin: '0 0 14px' }}>{t.pricing.title}</h2>
            <p style={{ color: '#6b7280', maxWidth: '440px', margin: '0 auto', lineHeight: 1.7 }}>{t.pricing.sub}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '24px', alignItems: 'start' }}>
            {t.pricing.plans.map((plan, i) => (
              <div key={i} className={`pricing-card${plan.highlight ? ' highlight' : ''}`} style={{ position: 'relative' }}>
                {plan.badge && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: plan.highlight ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.1)',
                    color: plan.highlight ? '#fff' : '#9ca3af',
                    padding: '4px 16px', borderRadius: '100px', fontSize: '0.73rem', fontWeight: 800, whiteSpace: 'nowrap',
                  }}>
                    {plan.badge}
                  </div>
                )}
                <h3 style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', margin: '0 0 6px' }}>{plan.name}</h3>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 20px' }}>{plan.desc}</p>
                <div style={{ marginBottom: '24px' }}>
                  <span style={{ fontSize: '2.4rem', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px' }}>{plan.price}</span>
                  <span style={{ color: '#4b5563', fontSize: '0.85rem', marginLeft: '4px' }}>{plan.period}</span>
                </div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginBottom: '24px' }} />
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {plan.features.map((f, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', color: '#d1d5db' }}>
                      <Check size={15} color="#22c55e" style={{ flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={i === 2 ? 'mailto:sales@salespilot.lk' : '/register'}
                  style={plan.highlight ? {
                    display: 'block', textAlign: 'center', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', padding: '14px', borderRadius: '14px', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', boxShadow: '0 8px 24px rgba(34,197,94,0.25)',
                  } : {
                    display: 'block', textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8eaf0', padding: '14px', borderRadius: '14px', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: '#4b5563', fontSize: '0.82rem', marginTop: '28px' }}>
            🏦 Accept bank transfer, Frimi, eZ Cash, PayHere · All prices in Sri Lankan Rupees
          </p>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h2 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.4rem)', fontWeight: 900, color: '#fff', letterSpacing: '-1px', margin: '0 0 10px' }}>
              Trusted by Sri Lankan businesses
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Real stories from real business owners</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
            {t.testimonials.map((t2, i) => (
              <div key={i} className="testimonial-card">
                <div style={{ display: 'flex', gap: '2px', marginBottom: '16px' }}>
                  {Array(t2.stars).fill(0).map((_, j) => <Star key={j} size={14} color="#f59e0b" fill="#f59e0b" />)}
                </div>
                <p style={{ color: '#d1d5db', fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 20px', fontStyle: 'italic' }}>"{t2.text}"</p>
                <div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem', margin: '0 0 2px' }}>{t2.name}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>{t2.biz}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section id="faq" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h2 style={{ fontSize: 'clamp(1.6rem,3.5vw,2.4rem)', fontWeight: 900, color: '#fff', letterSpacing: '-1px', margin: '0 0 10px' }}>{t.faq.title}</h2>
          </div>
          <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '8px 28px', background: 'rgba(255,255,255,0.02)' }}>
            {t.faq.items.map((item, i) => <FAQItem key={i} {...item} />)}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px 100px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '32px', padding: '64px 48px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-100px', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '300px', background: 'radial-gradient(ellipse, rgba(34,197,94,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg,#22c55e,#16a34a)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 24px rgba(34,197,94,0.3)', animation: 'pulse-glow 3s ease-in-out infinite' }}>
              <Bot size={32} color="#fff" />
            </div>
            <h2 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, color: '#fff', letterSpacing: '-1.5px', margin: '0 0 14px' }}>{t.cta.title}</h2>
            <p style={{ color: '#6b7280', fontSize: '1rem', margin: '0 0 36px', lineHeight: 1.7 }}>{t.cta.sub}</p>
            <Link href="/register" className="btn-primary" style={{ fontSize: '1rem', padding: '16px 36px' }}>
              {t.cta.btn} <ArrowRight size={18} />
            </Link>
            <p style={{ color: '#4b5563', fontSize: '0.82rem', marginTop: '16px' }}>{t.cta.note}</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '40px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#22c55e,#16a34a)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={17} color="#fff" />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, color: '#fff', fontSize: '0.9rem' }}>SalesPilot</p>
              <p style={{ margin: 0, color: '#4b5563', fontSize: '0.75rem' }}>{t.footer.tagline}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {['features', 'pricing', 'faq'].map(key => (
              <a key={key} href={`#${key}`} style={{ color: '#4b5563', textDecoration: 'none', fontSize: '0.83rem', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4b5563')}>
                {t.nav[key as keyof typeof t.nav]}
              </a>
            ))}
            <Link href="/login" style={{ color: '#4b5563', textDecoration: 'none', fontSize: '0.83rem' }}>{t.nav.login}</Link>
          </div>
          <p style={{ color: '#374151', fontSize: '0.78rem', margin: 0 }}>{t.footer.copy}</p>
        </div>
      </footer>

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 900px) {
          section > div { grid-template-columns: 1fr !important; }
          .desktop-nav { display: none !important; }
          #mobile-menu-btn { display: flex !important; }
        }
        @media (max-width: 640px) {
          .pricing-card, .feature-card, .testimonial-card { padding: 22px !important; }
        }
      `}</style>
    </div>
  );
}
