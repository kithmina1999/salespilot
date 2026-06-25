import Image from 'next/image';
import Link from 'next/link';

interface AuthShellProps {
  children: React.ReactNode;
  /** Headline shown on the illustration panel */
  panelTitle?: string;
  panelSub?: string;
}

const features = [
  '24/7 AI replies in Sinhala & English',
  'Smart order taking via WhatsApp',
  'Instant FAQ engine — no coding needed',
  'Full sales analytics dashboard',
];

const marketingSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://salespilot.lk';

export default function AuthShell({ children, panelTitle, panelSub }: AuthShellProps) {
  return (
    <div className="flex min-h-screen font-sans relative w-full h-screen">
      {/* ─── Background illustration ─── */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/assets/auth-bg.png"
          alt="SalesPilot WhatsApp automation"
          fill
          priority
          className="object-cover object-center "
        />
        {/* Soft overlay for better text contrast */}
      </div>

      {/* ─── Left panel — text ────────────────────────── */}
      <div className="hidden md:flex flex-col w-[55%] shrink-0 pt-8 px-12 pb-10 relative z-10">

        {/* Text content aligned left, slightly shifted left to middle */}
        <div className="absolute bottom-[10%] left-[40%]">
          <h2 className="text-black text-4xl lg:text-5xl font-extrabold tracking-[1px] mb-4 leading-[1.2] drop-shadow-lg">
            {panelTitle ?? 'Your WhatsApp, on autopilot.'}
          </h2>
          <p className="text-gray-900/80 text-[1.05rem] lg:text-[1.125rem] leading-[1.6] mb-8 drop-shadow-md">
            {panelSub ?? 'Join Sri Lankan businesses already serving customers 24/7 with AI.'}
          </p>
          <ul className="flex flex-col gap-4 m-0 p-0 list-none">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-[#333333] text-[0.95rem] lg:text-[1.05rem] font-medium drop-shadow-md">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ─── Right panel — form ───────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto relative z-10">
        <div className="relative w-full max-w-[400px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 border border-gray-100">
          {/* Logo */}
          <div className="absolute -top-10 right-2 flex items-center gap-1">
            <div className="w-[24px] h-[24px] bg-linear-to-br  flex items-center justify-center  shrink-0">
              <Image src="/assets/logo-sm.png" alt="SalesPilot" width={55} height={55} />
            </div>
            <Link href={marketingSiteUrl} className="font-bold text-[1.15rem] text-black no-underline tracking-[.5px] drop-shadow-md">
              SalesPilot
            </Link>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

