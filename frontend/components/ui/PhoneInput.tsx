'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';
import { ChevronDown, Search, AlertCircle, CheckCircle2 } from 'lucide-react';

// ── Country data ────────────────────────────────────────────────────────────
// Focused on heavy-WhatsApp markets (Asian + Gulf + Global)
const COUNTRIES: { code: CountryCode; name: string; dial: string; flag: string }[] = [
  { code: 'LK', name: 'Sri Lanka',          dial: '+94',  flag: '🇱🇰' },
  { code: 'IN', name: 'India',              dial: '+91',  flag: '🇮🇳' },
  { code: 'PK', name: 'Pakistan',           dial: '+92',  flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh',         dial: '+880', flag: '🇧🇩' },
  { code: 'MY', name: 'Malaysia',           dial: '+60',  flag: '🇲🇾' },
  { code: 'SG', name: 'Singapore',          dial: '+65',  flag: '🇸🇬' },
  { code: 'ID', name: 'Indonesia',          dial: '+62',  flag: '🇮🇩' },
  { code: 'TH', name: 'Thailand',           dial: '+66',  flag: '🇹🇭' },
  { code: 'PH', name: 'Philippines',        dial: '+63',  flag: '🇵🇭' },
  { code: 'VN', name: 'Vietnam',            dial: '+84',  flag: '🇻🇳' },
  { code: 'AE', name: 'UAE',                dial: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia',       dial: '+966', flag: '🇸🇦' },
  { code: 'QA', name: 'Qatar',              dial: '+974', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait',             dial: '+965', flag: '🇰🇼' },
  { code: 'BH', name: 'Bahrain',            dial: '+973', flag: '🇧🇭' },
  { code: 'OM', name: 'Oman',               dial: '+968', flag: '🇴🇲' },
  { code: 'EG', name: 'Egypt',              dial: '+20',  flag: '🇪🇬' },
  { code: 'NG', name: 'Nigeria',            dial: '+234', flag: '🇳🇬' },
  { code: 'ZA', name: 'South Africa',       dial: '+27',  flag: '🇿🇦' },
  { code: 'KE', name: 'Kenya',              dial: '+254', flag: '🇰🇪' },
  { code: 'GB', name: 'United Kingdom',     dial: '+44',  flag: '🇬🇧' },
  { code: 'US', name: 'United States',      dial: '+1',   flag: '🇺🇸' },
  { code: 'CA', name: 'Canada',             dial: '+1',   flag: '🇨🇦' },
  { code: 'AU', name: 'Australia',          dial: '+61',  flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand',        dial: '+64',  flag: '🇳🇿' },
  { code: 'DE', name: 'Germany',            dial: '+49',  flag: '🇩🇪' },
  { code: 'FR', name: 'France',             dial: '+33',  flag: '🇫🇷' },
  { code: 'IT', name: 'Italy',              dial: '+39',  flag: '🇮🇹' },
  { code: 'ES', name: 'Spain',              dial: '+34',  flag: '🇪🇸' },
  { code: 'BR', name: 'Brazil',             dial: '+55',  flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico',             dial: '+52',  flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina',          dial: '+54',  flag: '🇦🇷' },
  { code: 'RU', name: 'Russia',             dial: '+7',   flag: '🇷🇺' },
  { code: 'TR', name: 'Turkey',             dial: '+90',  flag: '🇹🇷' },
  { code: 'JP', name: 'Japan',              dial: '+81',  flag: '🇯🇵' },
  { code: 'CN', name: 'China',              dial: '+86',  flag: '🇨🇳' },
  { code: 'KR', name: 'South Korea',        dial: '+82',  flag: '🇰🇷' },
  { code: 'MM', name: 'Myanmar',            dial: '+95',  flag: '🇲🇲' },
  { code: 'KH', name: 'Cambodia',           dial: '+855', flag: '🇰🇭' },
  { code: 'LK', name: 'Sri Lanka (tamil)',  dial: '+94',  flag: '🇱🇰' },
];

// Deduplicate by dial+name
const UNIQUE_COUNTRIES = Array.from(
  new Map(COUNTRIES.map(c => [`${c.code}-${c.dial}`, c])).values()
);

export interface PhoneInputValue {
  e164: string;       // Full E.164 string e.g. "+94771234567"
  isValid: boolean;
  countryCode: CountryCode;
}

interface PhoneInputProps {
  id?: string;
  label?: string;
  defaultCountry?: CountryCode;
  value?: string;           // controlled E.164 value from parent
  onChange: (val: PhoneInputValue) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function PhoneInput({
  id = 'phone-input',
  label,
  defaultCountry = 'LK',
  value: controlledValue,
  onChange,
  required,
  disabled,
}: PhoneInputProps) {
  const [selected, setSelected] = useState(() =>
    UNIQUE_COUNTRIES.find(c => c.code === defaultCountry) ?? UNIQUE_COUNTRIES[0]
  );
  const [localNumber, setLocalNumber] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [touched, setTouched] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sync from controlled E.164 value (e.g. on edit forms)
  useEffect(() => {
    if (controlledValue && controlledValue.startsWith('+')) {
      try {
        const parsed = parsePhoneNumber(controlledValue);
        if (parsed) {
          const country = UNIQUE_COUNTRIES.find(c => c.code === parsed.country);
          if (country) setSelected(country);
          setLocalNumber(parsed.nationalNumber);
        }
      } catch { /* ignore */ }
    }
  }, [controlledValue]);

  // Emit change whenever country or number changes
  const emit = useCallback((country: typeof selected, number: string) => {
    const raw = country.dial + number.replace(/\s/g, '');
    let e164 = raw;
    let valid = false;
    try {
      if (isValidPhoneNumber(raw, country.code)) {
        const parsed = parsePhoneNumber(raw, country.code);
        e164 = parsed?.format('E.164') ?? raw;
        valid = true;
      }
    } catch { /* ignore */ }
    onChange({ e164, isValid: valid, countryCode: country.code });
  }, [onChange]);

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/[^\d\s\-()]/g, '');
    setLocalNumber(val);
    emit(selected, val);
  }

  function handleSelect(country: typeof selected) {
    setSelected(country);
    setOpen(false);
    setSearch('');
    emit(country, localNumber);
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const filtered = UNIQUE_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  // Validation state
  const raw = selected.dial + localNumber.replace(/\s/g, '');
  let isValid = false;
  try { isValid = localNumber.length > 3 && isValidPhoneNumber(raw, selected.code); } catch { /**/ }
  const showError = touched && localNumber.length > 0 && !isValid;
  const showOk = touched && isValid;

  return (
    <div className="phone-input-root" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label htmlFor={id} className="form-label">{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      )}

      <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
        {/* Country picker trigger */}
        <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            id={`${id}-country`}
            onClick={() => setOpen(o => !o)}
            disabled={disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 10px',
              height: 42,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: '#e8eaf0',
              cursor: 'pointer',
              fontSize: '0.9rem',
              whiteSpace: 'nowrap',
              minWidth: 90,
              transition: 'border-color 0.2s',
            }}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{selected.flag}</span>
            <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>{selected.dial}</span>
            <ChevronDown size={13} style={{ color: '#6b7280', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
          </button>

          {open && (
            <div
              role="listbox"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                zIndex: 999,
                width: 280,
                maxHeight: 300,
                overflowY: 'auto',
                background: '#1a1d27',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Search */}
              <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={13} style={{ color: '#6b7280', flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search country..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#e8eaf0',
                    fontSize: '0.82rem',
                    width: '100%',
                  }}
                />
              </div>

              {/* Country list */}
              <div style={{ overflowY: 'auto' }}>
                {filtered.length === 0 && (
                  <div style={{ padding: '12px 14px', color: '#6b7280', fontSize: '0.82rem' }}>No results</div>
                )}
                {filtered.map(c => (
                  <button
                    key={`${c.code}-${c.dial}`}
                    type="button"
                    role="option"
                    aria-selected={c.code === selected.code}
                    onClick={() => handleSelect(c)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 14px',
                      background: c.code === selected.code ? 'rgba(16,185,129,0.12)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#e8eaf0',
                      fontSize: '0.85rem',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = c.code === selected.code ? 'rgba(16,185,129,0.12)' : 'transparent')}
                  >
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{c.flag}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ color: '#6b7280', fontSize: '0.78rem', flexShrink: 0 }}>{c.dial}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Number input */}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            id={id}
            type="tel"
            inputMode="numeric"
            className="form-input"
            style={{
              width: '100%',
              height: 42,
              borderColor: showError ? 'rgba(239,68,68,0.5)' : showOk ? 'rgba(16,185,129,0.4)' : undefined,
              paddingRight: (showError || showOk) ? 36 : undefined,
            }}
            placeholder="77 123 4567"
            value={localNumber}
            onChange={handleNumberChange}
            onBlur={() => setTouched(true)}
            disabled={disabled}
            autoComplete="tel-national"
            aria-invalid={showError}
            aria-describedby={showError ? `${id}-error` : undefined}
          />
          {/* Validation icon */}
          {showOk && (
            <CheckCircle2 size={15} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#10b981', pointerEvents: 'none' }} />
          )}
          {showError && (
            <AlertCircle size={15} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#ef4444', pointerEvents: 'none' }} />
          )}
        </div>
      </div>

      {/* Error message */}
      {showError && (
        <p id={`${id}-error`} className="form-error-msg" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#f87171', margin: 0 }}>
          <AlertCircle size={11} />
          Invalid phone number for {selected.name}. Please check the number.
        </p>
      )}
    </div>
  );
}
