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
    try {
      const user = JSON.parse(userData);
      if (user.role !== 'admin') {
        router.push('/login');
      } else {
        setIsAuthed(true);
      }
    } catch {
      router.push('/login');
    }
  }, [router]);

  return isAuthed;
}
