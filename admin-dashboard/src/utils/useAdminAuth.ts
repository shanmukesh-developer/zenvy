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

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 5000; // 5s between retries (server needs ~30-60s to wake)

    const checkSession = async (attempt = 1): Promise<void> => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout per attempt

        const res = await fetch(`${apiUrl}/api/admin/config`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (res.status === 401) {
          console.warn('Admin session expired or invalid token. Clearing auth...');
          // Only clear auth-specific keys, preserve cart/favorites/preferences
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login');
          return;
        }

        if (!res.ok && attempt < MAX_RETRIES) {
          console.warn(`[Auth] Server returned ${res.status}, retrying (${attempt}/${MAX_RETRIES})...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          return checkSession(attempt + 1);
        }

        const user = JSON.parse(userData);
        if (user.role !== 'admin') {
          router.push('/login');
        } else {
          setIsAuthed(true);
        }
      } catch (err: unknown) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        const isNetwork = err instanceof TypeError && err.message.includes('fetch');

        if ((isAbort || isNetwork) && attempt < MAX_RETRIES) {
          console.warn(`[Auth] Server waking up, retry ${attempt}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          return checkSession(attempt + 1);
        }

        console.error('Auth verify failed after retries:', err);
        // On persistent network error, stay authed with cached credentials
        // This prevents logout during temporary outages
        setIsAuthed(true); 
      }
    };

    checkSession();
  }, [router]);

  return isAuthed;
}
