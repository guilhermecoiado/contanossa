import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { AccountSetupAssistantProvider } from '@/contexts/AccountSetupAssistantContext';
import { ValuesVisibilityProvider } from '@/contexts/ValuesVisibilityContext';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <ValuesVisibilityProvider>
      <AccountSetupAssistantProvider>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <main className="lg:pl-[272px]">
            <div className="w-full max-w-6xl mx-auto px-3 pt-16 pb-32 sm:px-4 lg:px-8 lg:pt-8 lg:pb-8">
              {children}
            </div>
          </main>
        </div>
      </AccountSetupAssistantProvider>
    </ValuesVisibilityProvider>
  );
}
