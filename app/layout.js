import Link from 'next/link';
import './globals.css';

export const metadata = {
  title: 'Mini POS',
  description: 'ระบบขายของร้านเล็ก',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>
        <header className="navbar">
          <span className="brand">Mini POS</span>
          <nav>
            <Link href="/">สินค้า</Link>
            <Link href="/sell">ขายของ</Link>
            <Link href="/history">ประวัติการขาย</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
