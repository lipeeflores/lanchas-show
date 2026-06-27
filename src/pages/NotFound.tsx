import React from 'react';
import { Link } from 'react-router-dom';
import { Anchor } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center px-4">
      <Anchor className="w-16 h-16 text-yellow-500 mb-6 opacity-80" />
      <h1 className="text-6xl font-serif font-bold text-white mb-4">404</h1>
      <p className="text-gray-400 text-lg mb-8 text-center">Esta página navegou para águas desconhecidas.</p>
      <Link
        to="/"
        className="bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-slate-900 font-bold py-3 px-8 rounded-lg transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)]"
      >
        Voltar ao Início
      </Link>
    </div>
  );
}
