import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { lovable } from '@/integrations/lovable/index';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Radio, Loader2, Mail, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string; inviteCode?: string }>({});
  
  const { signIn, resetPasswordForEmail, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string; confirmPassword?: string; inviteCode?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    if (!isForgotPassword) {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }

      if (isSignUp && password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }

      if (isSignUp && !inviteCode.trim()) {
        newErrors.inviteCode = 'An invite code is required to create an account';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (isForgotPassword) {
        const { error } = await resetPasswordForEmail(email);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Check your email for a password reset link!');
          setIsForgotPassword(false);
        }
      } else if (isSignUp) {
        // Call the invite-code edge function instead of supabase signUp directly
        const { data, error } = await supabase.functions.invoke('validate-invite-code', {
          body: { email, password, inviteCode: inviteCode.trim() },
        });

        if (error || data?.error) {
          const msg = data?.error || error?.message || 'An unexpected error occurred.';
          toast.error(msg);
        } else {
          toast.success('Account created! Check your email to confirm your account.');
          setIsSignUp(false);
          setInviteCode('');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password. Please try again.');
          } else {
            toast.error(error.message);
          }
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (error) {
        toast.error('Failed to sign in with Google. Please try again.');
      }
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Radio className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-2xl text-foreground">CitiSignal</span>
          </div>

          {/* Heading */}
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            {isForgotPassword ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isForgotPassword
              ? "Enter your email and we'll send you a reset link"
              : isSignUp 
                ? 'Enter your invite code to get started' 
                : 'Sign in to access your property dashboard'}
          </p>

          {/* Google Sign-In (sign-in only) */}
          {!isForgotPassword && !isSignUp && (
            <>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full mb-4"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Continue with Google
              </Button>
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`pl-10 ${errors.email ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            {!isForgotPassword && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`pl-10 pr-10 ${errors.password ? 'border-destructive' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                {/* Forgot Password Link (sign-in only) */}
                {!isSignUp && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setErrors({});
                      }}
                      className="text-sm text-accent hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`pl-10 ${errors.confirmPassword ? 'border-destructive' : ''}`}
                        />
                      </div>
                      {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="inviteCode">Invite Code</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="inviteCode"
                          type="text"
                          placeholder="e.g. CITIBETA"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          className={`pl-10 font-mono tracking-widest ${errors.inviteCode ? 'border-destructive' : ''}`}
                          autoComplete="off"
                          autoCapitalize="characters"
                        />
                      </div>
                      {errors.inviteCode && <p className="text-sm text-destructive">{errors.inviteCode}</p>}
                    </div>
                  </>
                )}
              </>
            )}

            <Button 
              type="submit" 
              variant="hero" 
              size="lg" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isForgotPassword ? (
                'Send Reset Link'
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Toggle */}
          <p className="mt-6 text-center text-muted-foreground">
            {isForgotPassword ? (
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setErrors({});
                }}
                className="text-accent font-medium hover:underline"
              >
                ← Back to sign in
              </button>
            ) : (
              <>
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrors({});
                    setInviteCode('');
                  }}
                  className="text-accent font-medium hover:underline"
                >
                  {isSignUp ? 'Sign in' : 'Sign up'}
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 gradient-hero items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center mx-auto mb-8">
            <Radio className="w-10 h-10 text-accent" />
          </div>
          <h2 className="font-display text-3xl font-bold text-primary-foreground mb-4">
            Property compliance,<br />simplified.
          </h2>
          <p className="text-primary-foreground/70 text-lg">
            Monitor NYC violations, coordinate vendors via SMS, and never miss a deadline again.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
