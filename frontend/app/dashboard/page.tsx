'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Verificar si hay token en localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      // Si no hay token, redirigir al login
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-[#141414] rounded-lg shadow-xl p-8 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Bienvenido a FRIDAY</h1>
        <p className="text-gray-400">Estás conectado al sistema de proyección financiera.</p>
      </div>
    </div>
  );
}