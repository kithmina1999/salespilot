'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /upgrade now consolidates into /usage (Usage & Plan page)
export default function UpgradeRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/usage'); }, [router]);
  return null;
}
