'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /billing is replaced by /usage (Usage & Plan page)
export default function BillingRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/usage'); }, [router]);
  return null;
}
