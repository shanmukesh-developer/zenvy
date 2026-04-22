"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useAdminAuth() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      router.push('/login');
      return;
    }

    const checkSession = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';
        const res = await fetch(`${apiUrl}/api/admin/config`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
          console.warn('Admin session expired or account missing. Logging out...');
          localStorage.clear();
          router.push('/login');
          return;
        }

        const user = JSON.parse(userData);
        if (user.role !== 'admin') {
          router.push('/login');
        } else {
          setIsAuthed(true);
        }
      } catch (err) {
        console.error('Auth verify failed:', err);
        // On network error, we stay authed for now to allow offline view if possible
        setIsAuthed(true); 
      }
    };

    checkSession();
  }, [router]);

  return isAuthed;
}
