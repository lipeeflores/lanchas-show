import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAdminAuthenticated } from '../lib/adminApi';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  if (!isAdminAuthenticated()) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
