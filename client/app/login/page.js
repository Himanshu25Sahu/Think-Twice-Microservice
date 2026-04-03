'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/redux/slices/authSlice';
import { fetchMyOrgs } from '@/redux/slices/orgSlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';

export default function LoginPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { loading, error } = useSelector((state) => state.auth);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [toast, setToast] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
        await dispatch(fetchMyOrgs());
        setToast({ type: 'success', message: `Welcome back, ${result.payload.user.name}!` });
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        setToast({ type: 'error', message: result.payload.message || 'Login failed' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'An error occurred. Please try again.' });
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-accent mb-2">🧠</h1>
          <h2 className="text-2xl font-bold text-primary">Think Twice</h2>
          <p className="text-secondary mt-2">Document. Debug. Decide.</p>
        </div>

        {/* Login Form */}
        <div className="card-base">
          <h3 className="text-xl font-semibold text-primary mb-6">Sign In</h3>

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
              <div className="p-3 rounded bg-red-600/10 border border-red-600/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={loading}
            >
              Sign In
            </Button>
          </form>

          {/* Link to Register */}
          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-secondary text-sm">
              Don't have an account?{' '}
              <Link href="/register" className="text-accent hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Credentials */}
        <div className="mt-6 p-3 rounded bg-indigo-600/10 border border-indigo-600/20 text-indigo-400 text-sm">
          <p className="font-semibold mb-1">Demo Credentials</p>
          <p>Email: <code className="text-indigo-300 bg-indigo-600/20 px-1 rounded">test@example.com</code></p>
          <p>Password: <code className="text-indigo-300 bg-indigo-600/20 px-1 rounded">password123</code></p>
        </div>
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