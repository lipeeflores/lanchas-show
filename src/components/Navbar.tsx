import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const NAV_LINKS = [
  { href: '#sobre', label: 'Sobre Nós' },
  { href: '#frota', label: 'A Frota' },
  { href: '#galeria', label: 'Galeria' },
  { href: '#localizacao', label: 'Localização' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contato', label: 'Contato' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-slate-900/95 backdrop-blur-md shadow-lg py-4' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <img src="/logo.png" alt="Lanchas Show" className="h-20 w-auto drop-shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-transform hover:scale-105 duration-300" />
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href} className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium">
                {link.label}
              </a>
            ))}
            <Link to="/admin" className="border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-slate-900 px-4 py-2 rounded-lg transition-colors text-sm uppercase tracking-widest font-medium">
              Portal ADM
            </Link>
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Abrir menu" className="text-white">
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-900/95 backdrop-blur-md absolute top-full left-0 w-full border-t border-slate-800">
          <div className="px-4 pt-2 pb-6 space-y-4 flex flex-col">
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href} onClick={closeMenu} className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium py-2">
                {link.label}
              </a>
            ))}
            <Link to="/admin" onClick={closeMenu} className="border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-slate-900 px-4 py-2 rounded-lg transition-colors text-sm uppercase tracking-widest font-medium text-center mt-4">
              Portal ADM
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
