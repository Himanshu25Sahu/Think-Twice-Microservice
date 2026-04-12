'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { checkAuth, login } from '@/redux/slices/authSlice';
import { fetchMyOrgs } from '@/redux/slices/orgSlice';
import { initializeProjects } from '@/redux/slices/projectSlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';
import { OrgOnboarding } from '@/components/onboarding/OrgOnboarding';

export default function LoginPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, error } = useSelector((state) => state.auth);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [toast, setToast] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    if (!oauthStatus) {
      return;
    }

    if (oauthStatus === 'error') {
      setToast({ type: 'error', message: 'Google sign in failed. Please try again.' });
      return;
    }

    if (oauthStatus === 'success') {
      const isNewUser = searchParams.get('new') === 'true';

      dispatch(checkAuth()).then(async (authResult) => {
        if (authResult.meta.requestStatus === 'fulfilled') {
          if (isNewUser) {
            // New Google user — show org onboarding instead of going to dashboard
            setToast({ type: 'success', message: `Welcome, ${authResult.payload.user.name}! Set up your organization.` });
            setTimeout(() => setShowOnboarding(true), 900);
            return;
          }

          const orgResult = await dispatch(fetchMyOrgs());
          const preferredOrgId = orgResult.payload?.orgs?.find((org) => org._id === orgResult.payload?.preferredOrgId)?._id || orgResult.payload?.orgs?.[0]?._id;

          if (preferredOrgId) {
            await dispatch(initializeProjects(preferredOrgId));
          }

          setToast({ type: 'success', message: `Welcome back, ${authResult.payload.user.name}!` });
          setTimeout(() => router.push('/dashboard'), 900);
        } else {
          setToast({ type: 'error', message: 'Google sign in succeeded but session setup failed. Try again.' });
        }
      });
    }
  }, [dispatch, router, searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTestLogin = () => {
    setFormData({ email: 'himpreetak@gmail.com', password: '123456' });
    setTimeout(() => {
      dispatch(login({ email: 'himpreetak@gmail.com', password: '123456' })).then(async (result) => {
        if (result.meta.requestStatus === 'fulfilled') {
          const orgResult = await dispatch(fetchMyOrgs());
          const preferredOrgId = orgResult.payload?.orgs?.find((org) => org._id === orgResult.payload?.preferredOrgId)?._id || orgResult.payload?.orgs?.[0]?._id;
          if (preferredOrgId) {
            await dispatch(initializeProjects(preferredOrgId));
          }
          setToast({ type: 'success', message: `Welcome back, ${result.payload.user.name}!` });
          setTimeout(() => router.push('/dashboard'), 1000);
        } else {
          setToast({ type: 'error', message: result.payload?.message || 'Login failed' });
        }
      });
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setToast({ type: 'error', message: 'Please fill in all fields' });
      return;
    }

    try {
      const result = await dispatch(login(formData));
      if (result.meta.requestStatus === 'fulfilled') {
        // Fetch user's orgs after successful login
        const orgResult = await dispatch(fetchMyOrgs());
        const preferredOrgId = orgResult.payload?.orgs?.find((org) => org._id === orgResult.payload?.preferredOrgId)?._id || orgResult.payload?.orgs?.[0]?._id;
        if (preferredOrgId) {
          await dispatch(initializeProjects(preferredOrgId));
        }
        setToast({ type: 'success', message: `Welcome back, ${result.payload.user.name}!` });
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        setToast({ type: 'error', message: result.payload.message || 'Login failed' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'An error occurred. Please try again.' });
    }
  };

  const handleGoogleLogin = () => {
    if (typeof window === 'undefined') {
      return;
    }
    window.location.href = '/api/auth/google';
  };

  if (showOnboarding) {
    return <OrgOnboarding />;
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/15 border border-indigo-500/25 mb-4 text-3xl">
            🧠
          </div>
          <h2 className="text-2xl font-bold text-primary tracking-tight">Think Twice</h2>
          <p className="text-secondary mt-1 text-sm">Document. Debug. Decide.</p>
        </div>

        {/* Login Form */}
        <div className="card-base">
          <h3 className="text-lg font-semibold text-primary mb-6">Welcome back</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              disabled={loading}
            />

            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              disabled={loading}
            />

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-600/10 border border-red-500/25 text-red-400 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              loading={loading}
            >
              Sign In
            </Button>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 p-3 rounded-lg border border-border text-primary hover:border-indigo-400/60 hover:bg-indigo-600/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                 <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                 <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                 <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                 <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </form>

          {/* Link to Register */}
          <div className="mt-6 pt-5 border-t border-border text-center">
            <p className="text-secondary text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-accent hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Test User Login */}
        <button
          type="button"
          onClick={handleTestLogin}
          disabled={loading}
          className="mt-4 w-full flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-indigo-600/10 border border-indigo-500/25 text-indigo-300 text-sm font-medium hover:bg-indigo-600/20 hover:border-indigo-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Signing in…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Continue as Test User
            </>
          )}
        </button>

      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}