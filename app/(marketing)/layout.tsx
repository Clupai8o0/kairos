import { JetBrains_Mono } from 'next/font/google';
import './landing.css';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jb-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className={mono.variable}>{children}</div>;
}
