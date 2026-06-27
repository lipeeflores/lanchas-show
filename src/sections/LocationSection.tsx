import React from 'react';
import { motion } from 'motion/react';
import { MapPin, Anchor } from 'lucide-react';

export default function LocationSection() {
  return (
    <section id="localizacao" className="py-24 bg-slate-950 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-yellow-500 font-medium tracking-[0.2em] uppercase text-sm mb-2 block">Onde Estamos</span>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-6">Localização & Embarque</h2>
            <p className="text-gray-400 font-light leading-relaxed mb-8 text-lg">
              Nossas embarcações ficam estrategicamente localizadas para oferecer o melhor acesso aos paraísos do litoral catarinense. O embarque principal ocorre em <strong>Porto Belo</strong>, a poucos minutos do famoso Caixa d'Aço.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <div className="bg-yellow-500/10 p-3 rounded-xl">
                  <MapPin className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Marina em Porto Belo</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Ponto de partida ideal para o Caixa d'Aço, Praia da Sepultura e Ilha de Porto Belo. Estrutura completa com estacionamento e segurança.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <div className="bg-yellow-500/10 p-3 rounded-xl">
                  <Anchor className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Balneário Camboriú</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Embarques sob demanda na Barra Sul. Perfeito para passeios pela orla de BC, Praia das Laranjeiras e Praia do Pinho.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="relative h-[500px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group"
          >
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d3548.877864883138!2d-48.53699822452296!3d-27.14742257650808!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMjfCsDA4JzUwLjciUyA0OMKwMzInMDMuOSJX!5e0!3m2!1spt-BR!2sbr!4v1712757300000!5m2!1spt-BR!2sbr"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 z-0"
              title="Localização Lanchas Show — Marina em Porto Belo"
            />
            <div className="absolute bottom-6 left-6 right-6 z-20 bg-slate-900/80 backdrop-blur-md border border-white/10 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-white font-bold">Marina em Porto Belo</p>
                <p className="text-yellow-500 text-sm">Ponto de Embarque Principal</p>
              </div>
              <a
                href="https://www.google.com/maps/place/27%C2%B008'50.7%22S+48%C2%B032'03.9%22W"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-yellow-500 text-slate-900 px-4 py-2 rounded-lg font-bold text-sm hover:bg-yellow-400 transition-colors inline-block"
              >
                Ver Rotas
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
