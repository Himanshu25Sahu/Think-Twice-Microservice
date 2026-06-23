'use client';

import { Suspense, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { checkAuth, login } from '@/redux/slices/authSlice';
import { fetchMyOrgs } from '@/redux/slices/orgSlice';
import { initializeProjects } from '@/redux/slices/projectSlice';
import { Toast } from '@/components/ui/Toast';
import { OrgOnboarding } from '@/components/onboarding/OrgOnboarding';

const Spinner = ({ className = 'h-4 w-4' }) => (
  <svg className={`animate-spin shrink-0 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

function LoginPageContent() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error } = useSelector((state) => state.auth);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [toast, setToast] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // `submitting` stays true across the whole login → orgs → projects → navigate flow,
  // so the button shows one continuous loader instead of flickering off mid-way.
  const [submitting, setSubmitting] = useState(false);

  // After a successful login we hydrate the user's orgs + projects, then navigate.
  const hydrateAndGo = async (userName) => {
    const orgResult = await dispatch(fetchMyOrgs());
    const preferredOrgId = orgResult.payload?.orgs?.find((org) => org._id === orgResult.payload?.preferredOrgId)?._id || orgResult.payload?.orgs?.[0]?._id;
    if (preferredOrgId) {
      await dispatch(initializeProjects(preferredOrgId));
    }
    setToast({ type: 'success', message: `Welcome back, ${userName}!` });
    router.push('/dashboard'); // navigate immediately — keep `submitting` true until the route changes
  };

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
      setSubmitting(true);

      dispatch(checkAuth()).then(async (authResult) => {
        if (authResult.meta.requestStatus === 'fulfilled') {
          if (isNewUser) {
            setToast({ type: 'success', message: `Welcome, ${authResult.payload.user.name}! Set up your organization.` });
            setTimeout(() => setShowOnboarding(true), 700);
            return;
          }
          await hydrateAndGo(authResult.payload.user.name);
        } else {
          setSubmitting(false);
          setToast({ type: 'error', message: 'Google sign in succeeded but session setup failed. Try again.' });
        }
      });
    }
  }, [dispatch, router, searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const runLogin = async (credentials) => {
    setSubmitting(true);
    try {
      const result = await dispatch(login(credentials));
      if (result.meta.requestStatus === 'fulfilled') {
        await hydrateAndGo(result.payload.user.name);
      } else {
        setToast({ type: 'error', message: result.payload?.message || 'Login failed' });
        setSubmitting(false);
      }
    } catch (err) {
      setToast({ type: 'error', message: 'An error occurred. Please try again.' });
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setToast({ type: 'error', message: 'Please fill in all fields' });
      return;
    }
    runLogin(formData);
  };

  const handleTestLogin = () => {
    const demo = { email: 'himpreetak@gmail.com', password: '123456' };
    setFormData(demo);
    runLogin(demo);
  };

  const handleGoogleLogin = () => {
    if (typeof window === 'undefined') {
      return;
    }
    setSubmitting(true);
    window.location.href = '/api/auth/google';
  };

  if (showOnboarding) {
    return <OrgOnboarding />;
  }

  const inputCls = 'w-full rounded-lg border border-[#E7E2D6] bg-white px-3.5 py-2.5 text-sm text-[#18181B] placeholder:text-zinc-400 outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 disabled:opacity-60';

  return (
    <div className="min-h-screen bg-[#FCFBF7] text-[#18181B] flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center gap-2 mb-3">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#2563EB]" />
            <span className="text-2xl font-bold tracking-tight text-[#18181B]">Think Twice</span>
          </Link>
          <p className="text-zinc-500 text-sm">Document. Debug. Decide.</p>
        </div>

        {/* Login Form */}
        <div className="bg-white border border-[#E7E2D6] rounded-2xl p-7 shadow-[0_12px_40px_rgba(24,24,27,0.06)]">
          <h3 className="text-lg font-semibold text-[#18181B] mb-6">Welcome back</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#27272A] mb-1.5">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange}
                placeholder="your@email.com" disabled={submitting} className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#27272A] mb-1.5">Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange}
                placeholder="••••••••" disabled={submitting} className={inputCls} />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold px-4 py-2.5 transition-colors active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? (<><Spinner /> Signing in…</>) : 'Sign In'}
            </button>

            <button type="button" onClick={handleGoogleLogin} disabled={submitting}
              className="w-full mt-2 flex items-center justify-center gap-2 p-2.5 rounded-lg border border-[#E7E2D6] bg-white text-[#18181B] text-sm hover:border-[#d0c9ba] hover:bg-[#FCFBF7] transition-all disabled:opacity-60 disabled:cursor-not-allowed">
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
          <div className="mt-6 pt-5 border-t border-[#E7E2D6] text-center">
            <p className="text-zinc-500 text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-[#1D4ED8] hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Login */}
        <button type="button" onClick={handleTestLogin} disabled={submitting}
          className="mt-4 w-full flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-[#2563EB]/8 border border-[#2563EB]/25 text-[#1D4ED8] text-sm font-medium hover:bg-[#2563EB]/12 hover:border-[#2563EB]/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
          {submitting ? (
            <><Spinner /> Signing in…</>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              View live demo — no signup
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FCFBF7]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
