import React from 'react';
import { motion } from 'motion/react';
import { Camera } from 'lucide-react';

const GALLERY_IMAGES = [
  { src: "/galeria-de-fotos/caixa-d-aco-festa.png", alt: "Festa na lancha no Caixa d'Aço" },
  { src: "/galeria-de-fotos/caixa-d-aco.png", alt: "Praia do Caixa d'Aço vista da lancha" },
  { src: "/galeria-de-fotos/caixa-d-aco-2.png", alt: "Lancha ancorada no Caixa d'Aço" },
  { src: "/galeria-de-fotos/gemini.png", alt: "Lancha Gemini em Porto Belo" },
  { src: "/galeria-de-fotos/whatsapp-1.jpeg", alt: "Passeio de lancha no litoral catarinense" },
  { src: "/galeria-de-fotos/whatsapp-2.jpeg", alt: "Grupo de amigos na lancha" },
  { src: "/galeria-de-fotos/whatsapp-3.jpeg", alt: "Lancha em alto mar" },
  { src: "/galeria-de-fotos/helicoptero.jpeg", alt: "Vista aérea da lancha" },
];

export default function GallerySection() {
  return (
    <section id="galeria" className="py-24 bg-slate-900 relative border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-yellow-500 font-medium tracking-[0.2em] uppercase text-sm mb-2 block">Momentos Inesquecíveis</span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-white">Galeria de Fotos</h2>
          <div className="w-24 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mt-6"></div>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {GALLERY_IMAGES.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.07 }}
              className="relative group overflow-hidden rounded-xl aspect-square"
            >
              <img
                src={item.src}
                alt={item.alt}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 object-center"
              />
              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <Camera className="w-8 h-8 text-white opacity-70" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
