import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  // Extra buffer for OAuth session hydration (e.g. after Google sign-in redirect)
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Give the auth state a moment to settle after an OAuth redirect
    const timer = setTimeout(() => setHydrated(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
