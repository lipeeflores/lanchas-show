import React from 'react';
import { motion } from 'motion/react';

export default function AboutSection() {
  return (
    <section id="sobre" className="py-24 bg-slate-950 relative border-t border-slate-800 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="order-2 lg:order-1 relative h-[500px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group"
          >
            <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-transparent transition-colors z-10 pointer-events-none"></div>
            <video
              src="/video-hero.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10"></div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="order-1 lg:order-2"
          >
            <span className="text-yellow-500 font-medium tracking-[0.2em] uppercase text-sm mb-2 block">Tradição & Excelência</span>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-8">Sobre Nós</h2>

            <div className="space-y-6 text-gray-300 font-light leading-relaxed text-lg">
              <p>
                <strong className="text-white font-medium">Mais de 10 anos levando você ao melhor do mar!</strong>
              </p>
              <p>
                Temos orgulho de oferecer uma das poucas lanchas modernas e de alto padrão disponíveis na região de Porto Belo e Caixa d'Aço. Nosso compromisso é com a qualidade impecável e a satisfação total dos nossos clientes.
              </p>
              <p>
                Proporcionamos passeios exclusivos onde cada detalhe é pensado para você: música ambiente de qualidade, conforto absoluto a bordo e rigorosos padrões de segurança para garantir um dia perfeito e inesquecível nas águas cristalinas do litoral catarinense.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-slate-800 pt-8">
              <div>
                <p className="text-3xl font-serif font-bold text-yellow-500 mb-1">10+</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Anos de Experiência</p>
              </div>
              <div>
                <p className="text-3xl font-serif font-bold text-yellow-500 mb-1">Alto</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Padrão</p>
              </div>
              <div>
                <p className="text-3xl font-serif font-bold text-yellow-500 mb-1">100%</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Segurança</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
