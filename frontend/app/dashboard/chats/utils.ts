export const STATUS_ORDER = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
export const STATUS_STYLE: Record<string, string> = {
  new:       'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  confirmed: 'text-blue-400  border-blue-400/30  bg-blue-400/10',
  shipped:   'text-purple-400 border-purple-400/30 bg-purple-400/10',
  delivered: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  cancelled: 'text-red-400   border-red-400/30   bg-red-400/10',
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export const isLID = (p = '') => { 
  const d = p.split('@')[0].split(':')[0].replace(/\D/g, ''); 
  return d.length >= 13; 
};

export const formatPhone = (p = '') => {
  if (!p) return 'Unknown';
  if (isLID(p)) return 'Privacy Contact';
  const d = p.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (!d) return p;
  if (d.startsWith('94') && d.length === 11) return `+94 ${d.slice(2,4)} ${d.slice(4,7)} ${d.slice(7)}`;
  if (d.startsWith('94') && d.length === 12) return `+94 ${d.slice(2,5)} ${d.slice(5,8)} ${d.slice(8)}`;
  if (d.startsWith('1')  && d.length === 11) return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  if (d.length >= 7) return `+${d}`;
  return p;
};

export const displayName = (name?: string, phone?: string) => {
  const n = name?.trim();
  if (n) return n;
  if (phone && isLID(phone)) return 'WhatsApp Contact';
  return phone ? formatPhone(phone) : 'Customer';
};

export const fmtTime = (s: string) => new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const fmtDate = (s: string) => new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric' });

export const parseItems = (j: string) => { 
  try { return JSON.parse(j); } catch { return []; } 
};

export const initials = (name?: string) => {
  const n = name?.trim();
  if (n) return n.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  return '';
};
