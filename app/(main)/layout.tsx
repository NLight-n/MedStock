'use client'
import LayoutWithConditionalHeader from '@/components/LayoutWithConditionalHeader';
import Providers from '@/components/Providers';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <LayoutWithConditionalHeader>{children}</LayoutWithConditionalHeader>
    </Providers>
  );
} 