import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionPlan } from '@/lib/plans';

interface PlanRouteProps {
  allow: SubscriptionPlan[];
  children: React.ReactNode;
}

export function PlanRoute({ allow, children }: PlanRouteProps) {
  const location = useLocation();
  const { isLoading, currentPlan } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!allow.includes(currentPlan)) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
