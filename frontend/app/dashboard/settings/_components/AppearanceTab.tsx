import { useTheme } from 'next-themes';
import { useAppStore } from '@/lib/store';
import { Monitor, Moon, Sun, Type } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useEffect, useState } from 'react';

const FONT_OPTIONS = [
  { value: 'sm', label: 'Small', size: 14 },
  { value: 'md', label: 'Medium', size: 16 },
  { value: 'lg', label: 'Large', size: 18 },
  { value: 'xl', label: 'Extra Large', size: 20 },
] as const;

export default function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const fontScale = useAppStore((state) => state.appearance?.fontScale || 'md');
  const setFontScale = useAppStore((state) => state.setFontScale);

  // Avoid hydration mismatch for theme
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const fontScaleIndex = FONT_OPTIONS.findIndex((o) => o.value === fontScale);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-zinc-100 mb-1 flex items-center gap-2">
          <Monitor size={20} className="text-zinc-400" />
          Theme Preferences
        </h2>
        <p className="text-sm text-zinc-400 mb-6">Choose how SalesPilot looks to you.</p>

        <RadioGroup
          value={theme || 'system'}
          onValueChange={setTheme}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* Light Theme */}
          <Label
            htmlFor="theme-light"
            className={`cursor-pointer flex flex-col items-center justify-between rounded-xl border-2 p-4 transition-all hover:bg-zinc-800/50 ${
              theme === 'light' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800'
            }`}
          >
            <RadioGroupItem value="light" id="theme-light" className="sr-only" />
            <div className="w-full flex justify-center mb-3 text-zinc-300">
              <Sun size={32} />
            </div>
            <span className="font-semibold text-zinc-200">Light</span>
          </Label>

          {/* Dark Theme */}
          <Label
            htmlFor="theme-dark"
            className={`cursor-pointer flex flex-col items-center justify-between rounded-xl border-2 p-4 transition-all hover:bg-zinc-800/50 ${
              theme === 'dark' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800'
            }`}
          >
            <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
            <div className="w-full flex justify-center mb-3 text-zinc-300">
              <Moon size={32} />
            </div>
            <span className="font-semibold text-zinc-200">Dark</span>
          </Label>

          {/* System Theme */}
          <Label
            htmlFor="theme-system"
            className={`cursor-pointer flex flex-col items-center justify-between rounded-xl border-2 p-4 transition-all hover:bg-zinc-800/50 ${
              theme === 'system' ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800'
            }`}
          >
            <RadioGroupItem value="system" id="theme-system" className="sr-only" />
            <div className="w-full flex justify-center mb-3 text-zinc-300">
              <Monitor size={32} />
            </div>
            <span className="font-semibold text-zinc-200">System</span>
          </Label>
        </RadioGroup>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-zinc-100 mb-1 flex items-center gap-2">
          <Type size={20} className="text-zinc-400" />
          Interface Scale
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Adjust the size of text and UI elements. This setting only affects your current device.
        </p>

        <div className="space-y-6 pt-4">
          <Slider
            value={[fontScaleIndex !== -1 ? fontScaleIndex : 1]}
            max={3}
            step={1}
            onValueChange={(val) => {
              const index = Array.isArray(val) ? val[0] : val as number;
              setFontScale(FONT_OPTIONS[index].value);
            }}
            className="w-full"
          />
          <div className="flex justify-between text-xs font-semibold text-zinc-500">
            {FONT_OPTIONS.map((opt) => (
              <span key={opt.value}>{opt.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
