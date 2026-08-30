import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '声动课堂｜AI普通话纠音与演讲训练',
  description: '让每一次开口，都更有力量。面向演讲与口才课程的AI普通话纠音、即兴演讲训练与成长分析系统。',
  openGraph: {
    title: '声动课堂｜让每一次开口，都更有力量',
    description: 'AI普通话纠音、即兴演讲、录音诊断与成长档案。',
    images: ['https://yun999-ccc.github.io/shengdong-classroom/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '声动课堂｜让每一次开口，都更有力量',
    description: 'AI普通话纠音、即兴演讲、录音诊断与成长档案。',
    images: ['https://yun999-ccc.github.io/shengdong-classroom/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
