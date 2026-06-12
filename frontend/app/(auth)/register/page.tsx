'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirigir al login
        router.push('/login');
      } else {
        setError(data.detail || 'Error al registrarse');
      }
    } catch (err) {
      setError('Error de conexión. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">FRIDAY</h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-md text-red-500 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="fullName" className="text-white">Nombre completo</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 bg-[#0A0A0A] border-[#2A2A2A] text-white"
              required
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-white">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 bg-[#0A0A0A] border-[#2A2A2A] text-white"
              required
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-white">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 bg-[#0A0A0A] border-[#2A2A2A] text-white"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-[#4F8EF7] hover:bg-[#4F8EF7]/90 text-black font-bold py-2 px-4 rounded-md transition-colors"
            disabled={isLoading}
          >
            {isLoading ? 'Registrando...' : 'Regístrate'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-[#4F8EF7] hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}