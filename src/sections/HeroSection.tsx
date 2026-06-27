import React from 'react';
import { motion } from 'motion/react';
import BookingEngine from '../components/BookingEngine';
import type { SearchParams, SelectOption } from '../types';

interface HeroSectionProps {
  searchParams: SearchParams;
  setSearchParams: (p: SearchParams) => void;
  embarkOptions: SelectOption[];
  destOptions: SelectOption[];
  onSearch: () => void;
}

export default function HeroSection({ searchParams, setSearchParams, embarkOptions, destOptions, onSearch }: HeroSectionProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 z-0">
        <img
          src="/galeria-de-fotos/caixa-d-aco.png"
          alt="Passeio de lancha no Caixa d'Aço - Lanchas Show"
          className="w-full h-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900"></div>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col items-center mt-10">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-yellow-500 font-medium tracking-[0.2em] uppercase text-sm mb-4 text-center"
        >
          Lanchas Show
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white text-center leading-tight mb-6 drop-shadow-lg"
        >
          Sua Experiência de Luxo <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-600">Começa no Mar</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-gray-300 text-lg md:text-xl text-center max-w-2xl mb-8 font-light"
        >
          O melhor passeio de lanchas de toda a região de Porto Belo e Balneário Camboriú. Passeios personalizados para até 21 pessoas.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="w-full"
        >
          <BookingEngine
            searchParams={searchParams}
            setSearchParams={setSearchParams}
            embarkOptions={embarkOptions}
            destOptions={destOptions}
            onSearch={onSearch}
          />
        </motion.div>
      </div>
    </div>
  );
}
