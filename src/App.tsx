import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import ReservationsMap from './pages/admin/ReservationsMap';
import FleetManagement from './pages/admin/FleetManagement';
import FinancialDashboard from './pages/admin/FinancialDashboard';
import CustomersDB from './pages/admin/CustomersDB';
import AICommandCenter from './pages/admin/AICommandCenter';
import CalendarSettings from './pages/admin/CalendarSettings';
import AdminGuard from './components/AdminGuard';
import BoatDetails from './pages/BoatDetails';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lancha/:id" element={<BoatDetails />} />
        <Route path="/admin" element={<Login />} />
        <Route path="/admin/dashboard" element={<AdminGuard><Dashboard /></AdminGuard>} />
        <Route path="/admin/reservas" element={<AdminGuard><ReservationsMap /></AdminGuard>} />
        <Route path="/admin/frota" element={<AdminGuard><FleetManagement /></AdminGuard>} />
        <Route path="/admin/financeiro" element={<AdminGuard><FinancialDashboard /></AdminGuard>} />
        <Route path="/admin/clientes" element={<AdminGuard><CustomersDB /></AdminGuard>} />
        <Route path="/admin/ia" element={<AdminGuard><AICommandCenter /></AdminGuard>} />
        <Route path="/admin/calendario" element={<AdminGuard><CalendarSettings /></AdminGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
