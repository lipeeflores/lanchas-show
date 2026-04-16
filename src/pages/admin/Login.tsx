import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Lock, User, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Check if already logged in
  useEffect(() => {
    if (localStorage.getItem('lanchas_show_auth') === 'true') {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'ADMIN' && password === 'ADMIN') {
      localStorage.setItem('lanchas_show_auth', 'true');
      navigate('/admin/dashboard');
    } else {
      setError('Credenciais inválidas. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl mb-4">
            <Anchor className="h-10 w-10 text-yellow-500" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-white tracking-wider">Centro de Comando</h1>
          <p className="text-gray-400 mt-2 text-sm uppercase tracking-[0.2em]">Acesso Restrito</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">Usuário</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                  placeholder="ADMIN"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center bg-red-400/10 py-2 rounded-lg border border-red-400/20">{error}</p>
            )}

            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-slate-900 font-bold text-lg py-3 px-6 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.2)] hover:shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-all flex items-center justify-center gap-2 mt-4"
            >
              Acessar Painel <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
