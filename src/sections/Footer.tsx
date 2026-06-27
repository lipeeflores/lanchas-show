import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer id="contato" className="bg-slate-950 pt-16 pb-8 border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12"
        >
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center mb-6">
              <img src="/logo.png" alt="Lanchas Show" className="h-32 w-auto drop-shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
            </div>
            <p className="text-gray-400 max-w-md font-light leading-relaxed">
              A principal referência em aluguel de lanchas e iates de luxo no litoral catarinense. Experiências exclusivas no Caixa d'Aço, Porto Belo e Balneário Camboriú.
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold uppercase tracking-wider mb-6 text-sm">Navegação</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-gray-400 hover:text-yellow-500 transition-colors">Início</a></li>
              <li><a href="#sobre" className="text-gray-400 hover:text-yellow-500 transition-colors">Sobre Nós</a></li>
              <li><a href="#frota" className="text-gray-400 hover:text-yellow-500 transition-colors">A Frota</a></li>
              <li><a href="#localizacao" className="text-gray-400 hover:text-yellow-500 transition-colors">Localização</a></li>
              <li><a href="#faq" className="text-gray-400 hover:text-yellow-500 transition-colors">FAQ</a></li>
              <li><a href="#contato" className="text-gray-400 hover:text-yellow-500 transition-colors">Contato</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold uppercase tracking-wider mb-6 text-sm">Contato</h4>
            <ul className="space-y-3 text-gray-400">
              <li>Porto Belo - SC</li>
              <li>Caixa d'Aço</li>
              <li>contato@lanchasshow.com.br</li>
              <li>+55 (47) 99682-7545</li>
            </ul>
          </div>
        </motion.div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Lanchas Show. Todos os direitos reservados.
          </p>
          <div className="flex gap-4 text-sm text-gray-500">
            <Link to="/termos" className="hover:text-white transition-colors">Termos de Uso</Link>
            <Link to="/privacidade" className="hover:text-white transition-colors">Política de Privacidade</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
