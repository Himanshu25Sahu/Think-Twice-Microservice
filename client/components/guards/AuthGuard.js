'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { checkAuth } from '@/redux/slices/authSlice';
import { fetchMyOrgs } from '@/redux/slices/orgSlice';

export default function AuthGuard({ children }) {
  const { isAuthenticated, loading } = useSelector((state) => state.auth);
  const { activeOrg } = useSelector((state) => state.orgs);
  const router = useRouter();
  const dispatch = useDispatch();

  useEffect(() => {
    // Check auth first
    dispatch(checkAuth()).then((result) => {
      if (result.type === checkAuth.fulfilled.type) {
        // Auth successful, now fetch orgs
        dispatch(fetchMyOrgs());
      }
    });
  }, [dispatch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  if (!activeOrg) {
    router.push('/register');
    return null;
  }

  return children;
}
