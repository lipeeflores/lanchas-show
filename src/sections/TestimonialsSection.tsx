import React from 'react';
import { motion } from 'motion/react';
import { Star } from 'lucide-react';

const REVIEWS = [
  { name: "Katrini R.F", text: "Experiência incrível! A lancha estava impecável, o marinheiro foi super atencioso e o roteiro no Caixa d'Aço foi inesquecível. Recomendo de olhos fechados!" },
  { name: "Bruno B.", text: "Melhor passeio que já fiz na região. Atendimento premium desde a reserva até o desembarque. Com certeza voltaremos mais vezes." },
  { name: "Vinicius V.", text: "Estrutura fantástica. Comemoramos um aniversário a bordo e foi tudo perfeito. A churrasqueira e o som da lancha fizeram toda a diferença." },
  { name: "Anderson F.", text: "Profissionalismo nota 10. A equipe da Lanchas Show entregou exatamente o que prometeu: luxo, segurança e muita diversão." },
];

export default function TestimonialsSection() {
  return (
    <section className="py-24 bg-slate-900 relative border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-yellow-500 font-medium tracking-[0.2em] uppercase text-sm mb-2 block">Avaliações de Clientes</span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-white">A Experiência é Inesquecível</h2>
          <div className="w-24 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mt-6"></div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {REVIEWS.map((review, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="bg-slate-800/30 border border-slate-700/50 p-6 rounded-2xl hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />)}
              </div>
              <p className="text-gray-300 font-light text-sm leading-relaxed mb-6 italic">"{review.text}"</p>
              <div className="flex items-center gap-3 mt-auto">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-yellow-500 font-bold font-serif">
                  {review.name.charAt(0)}
                </div>
                <span className="text-white font-medium text-sm">{review.name}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
