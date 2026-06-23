'use client';

import { Suspense, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { checkAuth, login, register } from '@/redux/slices/authSlice';
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

function RegisterPageContent() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { error } = useSelector((state) => state.auth);
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', passwordConfirm: '' });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    if (oauthStatus === 'success' && searchParams.get('new') === 'true') {
      setSubmitting(true);
      dispatch(checkAuth()).then((authResult) => {
        if (authResult.meta.requestStatus === 'fulfilled') {
          setToast({ type: 'success', message: `Welcome, ${authResult.payload.user.name}! Set up your organization.` });
          setTimeout(() => setShowOnboarding(true), 700);
        } else {
          setSubmitting(false);
        }
      });
    }
  }, [dispatch, searchParams]);

  const handleGoogleRegister = () => {
    if (typeof window === 'undefined') return;
    setSubmitting(true);
    window.location.href = '/api/auth/google';
  };

  const handleTestLogin = async () => {
    setSubmitting(true);
    try {
      const result = await dispatch(login({ email: 'himpreetak@gmail.com', password: '123456' }));
      if (result.meta.requestStatus === 'fulfilled') {
        const orgResult = await dispatch(fetchMyOrgs());
        const preferredOrgId = orgResult.payload?.orgs?.find((org) => org._id === orgResult.payload?.preferredOrgId)?._id || orgResult.payload?.orgs?.[0]?._id;
        if (preferredOrgId) {
          await dispatch(initializeProjects(preferredOrgId));
        }
        setToast({ type: 'success', message: `Welcome back, ${result.payload.user.name}!` });
        router.push('/dashboard');
      } else {
        setToast({ type: 'error', message: result.payload?.message || 'Login failed' });
        setSubmitting(false);
      }
    } catch (err) {
      setToast({ type: 'error', message: 'An error occurred. Please try again.' });
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password || !formData.passwordConfirm) {
      setToast({ type: 'error', message: 'Please fill in all fields' });
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      setToast({ type: 'error', message: 'Passwords do not match' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await dispatch(register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      }));

      if (result.meta.requestStatus === 'fulfilled') {
        setToast({ type: 'success', message: `Account created! Welcome, ${result.payload.user.name}!` });
        setShowOnboarding(true);
      } else {
        setToast({ type: 'error', message: result.payload.message || 'Registration failed' });
        setSubmitting(false);
      }
    } catch (err) {
      setToast({ type: 'error', message: 'An error occurred. Please try again.' });
      setSubmitting(false);
    }
  };

  if (showOnboarding) {
    return <OrgOnboarding />;
  }

  const inputCls = 'w-full rounded-lg border border-[#E7E2D6] bg-white px-3.5 py-2.5 text-sm text-[#18181B] placeholder:text-zinc-400 outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 disabled:opacity-60';

  return (
    <div className="min-h-screen bg-[#FCFBF7] text-[#18181B] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center gap-2 mb-3">
            <span className="inline-block w-3 h-3 rounded-sm bg-[#2563EB]" />
            <span className="text-2xl font-bold tracking-tight text-[#18181B]">Think Twice</span>
          </Link>
          <p className="text-zinc-500 text-sm">Document. Debug. Decide.</p>
        </div>

        {/* Registration Form */}
        <div className="bg-white border border-[#E7E2D6] rounded-2xl p-7 shadow-[0_12px_40px_rgba(24,24,27,0.06)]">
          <h3 className="text-lg font-semibold text-[#18181B] mb-6">Create account</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#27272A] mb-1.5">Full name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange}
                placeholder="John Doe" disabled={submitting} className={inputCls} />
            </div>

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

            <div>
              <label className="block text-sm font-medium text-[#27272A] mb-1.5">Confirm password</label>
              <input type="password" name="passwordConfirm" value={formData.passwordConfirm} onChange={handleChange}
                placeholder="••••••••" disabled={submitting} className={inputCls} />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold px-4 py-2.5 transition-colors active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? (<><Spinner /> Creating account…</>) : 'Create Account'}
            </button>

            <button type="button" onClick={handleGoogleRegister} disabled={submitting}
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

          {/* Link to Login */}
          <div className="mt-6 pt-5 border-t border-[#E7E2D6] text-center">
            <p className="text-zinc-500 text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-[#1D4ED8] hover:underline font-medium">
                Sign in
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FCFBF7]" />}>
      <RegisterPageContent />
    </Suspense>
  );
}
