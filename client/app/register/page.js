'use client';

import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register } from '@/redux/slices/authSlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';
import { OrgOnboarding } from '@/components/onboarding/OrgOnboarding';

export default function RegisterPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { loading, error } = useSelector((state) => state.auth);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', passwordConfirm: '' });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast] = useState(null);

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

    try {
      const result = await dispatch(register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      }));

      if (result.payload.success) {
        setToast({ type: 'success', message: 'Registration successful!' });
        setShowOnboarding(true);
      } else {
        setToast({ type: 'error', message: result.payload.message || 'Registration failed' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'An error occurred. Please try again.' });
    }
  };

  if (showOnboarding) {
    return <OrgOnboarding />;
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-accent mb-2">🧠</h1>
          <h2 className="text-2xl font-bold text-primary">Think Twice</h2>
          <p className="text-secondary mt-2">Document. Debug. Decide.</p>
        </div>

        {/* Registration Form */}
        <div className="card-base">
          <h3 className="text-xl font-semibold text-primary mb-6">Create Account</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              disabled={loading}
            />

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

            <Input
              label="Confirm Password"
              type="password"
              name="passwordConfirm"
              value={formData.passwordConfirm}
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
              Create Account
            </Button>
          </form>

          {/* Link to Login */}
          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-secondary text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-accent hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
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