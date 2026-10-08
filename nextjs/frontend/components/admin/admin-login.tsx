'use client';
import Link from 'next/link';
import { useAdminLogin } from '@/hooks/use-admin-login';
import styles from './admin.module.css';
export function AdminLogin() {
  const vm = useAdminLogin();
  return <main className={styles.loginPage}><div className={styles.loginCard}>
    <Link href="/" className={styles.brand}><span className={styles.brandMark}>s</span>shoppie<span className={styles.adminBadge}>ADMIN</span></Link>
    <div className={styles.loginLabel}>サービスの改善を、データから。</div><h1>管理者ログイン</h1><p>利用状況と会話の記録を確認します。</p>
    <form onSubmit={vm.submit}>
      <label>ユーザー名<input name="username" autoComplete="username" value={vm.username} onChange={event => vm.setUsername(event.target.value)} required /></label>
      <label>パスワード<input name="password" type="password" autoComplete="current-password" value={vm.password} onChange={event => vm.setPassword(event.target.value)} required /></label>
      {vm.error && <div role="alert" className={styles.error}>{vm.error}</div>}
      <button className={styles.primaryButton} disabled={vm.loading}>{vm.loading ? 'ログイン中…' : 'ログイン'}<span aria-hidden>→</span></button>
    </form><Link href="/" className={styles.backLink}>← Shoppieに戻る</Link>
  </div><span className={styles.loginFoot}>SHOPPIE · ADMIN CONSOLE</span></main>;
}
