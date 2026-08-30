import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '声动课堂｜AI普通话纠音与演讲训练',
  description: '面向演讲与口才课程的AI普通话纠音、即兴演讲训练与成长分析系统。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
