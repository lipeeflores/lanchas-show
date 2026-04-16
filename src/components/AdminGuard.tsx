import React from 'react';
import { Navigate } from 'react-router-dom';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const isAuth = localStorage.getItem('lanchas_show_auth') === 'true';
  if (!isAuth) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
