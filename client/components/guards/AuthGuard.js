'use client';

import { useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { checkAuth } from '@/redux/slices/authSlice';
import { fetchMyOrgs } from '@/redux/slices/orgSlice';

export default function AuthGuard({ children }) {
  const { isAuthenticated, authChecked } = useSelector((state) => state.auth);
  const { activeOrg } = useSelector((state) => state.orgs);
  const router = useRouter();
  const dispatch = useDispatch();
  const [ready,setReady] = useState(false);

  useEffect(() => {
    dispatch(checkAuth()).then((result) => {
      if (result.type === checkAuth.fulfilled.type) {
        dispatch(fetchMyOrgs()).then(()=>setReady(true));
      }else{
        setReady(true);
      }
    });
  }, [dispatch]);

  // Wait for auth check to complete before making redirect decisions
  if (!ready) {
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
