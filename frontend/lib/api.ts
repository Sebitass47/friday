// Función para iniciar sesión
export async function loginUser(email: string, password: string) {
  const response = await fetch('http://localhost:8000/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('Error al iniciar sesión');
  }

  const data = await response.json();
  return data;
}

// Función para registrar un nuevo usuario
export async function registerUser(email: string, password: string, fullName: string) {
  const response = await fetch('http://localhost:8000/api/v1/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, full_name: fullName }),
  });

  if (!response.ok) {
    throw new Error('Error al registrarse');
  }

  const data = await response.json();
  return data;
}

// Función para obtener el usuario actual
export async function getCurrentUser(token: string) {
  const response = await fetch('http://localhost:8000/api/v1/auth/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Error al obtener el usuario');
  }

  const data = await response.json();
  return data;
}