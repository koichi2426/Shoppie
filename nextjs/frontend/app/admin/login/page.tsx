import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { authenticated } from '@/lib/admin/auth';
import { AdminLogin } from '@/components/admin/admin-login';
export const metadata: Metadata = { title: '管理者ログイン | Shoppie', robots: { index: false, follow: false } };
export default async function LoginPage() {
  if (await authenticated()) redirect('/admin');
  return <AdminLogin />;
}
