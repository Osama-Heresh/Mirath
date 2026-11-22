import type { Metadata } from 'next';
import { Cairo, Tajawal } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const fontSans = Cairo({
  variable: '--font-sans',
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '700'], // Added weights
  display: 'swap',
});

const fontMono = Tajawal({
  variable: '--font-mono',
  subsets: ['arabic', 'latin'],
  weight: ['400'], // Added weight
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'الميراث الذكي - Smart Inheritance',
  description: 'تطبيق لحساب الميراث الإسلامي وعدة الأرملة.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
