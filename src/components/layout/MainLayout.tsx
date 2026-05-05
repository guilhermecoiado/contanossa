import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { ValuesVisibilityProvider } from '@/contexts/ValuesVisibilityContext';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <ValuesVisibilityProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="lg:pl-64">
          <div className="w-full max-w-6xl mx-auto px-3 pt-16 pb-16 sm:px-4 lg:px-8 lg:pt-8 lg:pb-8">
            {children}
          </div>
        </main>
      </div>
    </ValuesVisibilityProvider>
  );
}
