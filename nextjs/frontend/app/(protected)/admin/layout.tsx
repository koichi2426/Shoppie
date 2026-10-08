import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { authenticated } from '@/lib/admin/auth';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '管理者画面 | Shoppie', robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!await authenticated()) redirect('/admin/login');
  return children;
}
