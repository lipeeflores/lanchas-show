import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQS = [
  {
    question: "Qual o local de embarque e quais os destinos?",
    answer: (<div className="space-y-3"><p><strong>Porto Belo:</strong> Ilha de Porto Belo, Praia do Caixa d'Aço, Praia do Pipoca, Praia da Sepultura, Orla de Porto Belo até o Hard Rock.</p><p><strong>Balneário Camboriú (BC):</strong> Orla Barra Sul e Laranjeiras.</p></div>)
  },
  {
    question: "Quais as formas de reserva e pagamento?",
    answer: (<div className="space-y-3"><p>Para reservar, precisamos dos seus dados pessoais + sinal de <strong>50%</strong>. O restante é pago até o embarque.</p><p>Parcelamento:</p><ul className="list-disc pl-5 space-y-1"><li>Via PIX mensal (reservas antecipadas, quitando até o embarque).</li><li>Cartão de crédito (com acréscimo da máquina).</li></ul></div>)
  },
  {
    question: "A lancha é compartilhada ou privativa?",
    answer: <p>A diária é <strong>privativa</strong>, somente para você e seus convidados.</p>
  },
  {
    question: "Crianças contam na capacidade?",
    answer: <p>Sim, contam como adulto, da mesma forma que em veículos.</p>
  },
  {
    question: "Qual o horário do passeio?",
    answer: (<div className="space-y-3"><p>Das <strong>10h às 18h</strong>. É possível contratar horas extras com custo adicional.</p><ul className="list-disc pl-5 space-y-1"><li>Obs.: A lancha não navega o dia inteiro, apenas até o destino, onde ficará ancorada.</li></ul></div>)
  },
  {
    question: "É permitido levar pets?",
    answer: <p>Não recomendamos. Como o passeio dura cerca de 8h, o pet pode enjoar com o balanço e não há local adequado para necessidades. Prezamos pelo bem-estar e segurança a bordo.</p>
  },
  {
    question: "O que está incluso?",
    answer: <p>Marinheiro e combustível. Você leva comidas e bebidas, e o marinheiro pode preparar churrasco para vocês.</p>
  },
  {
    question: "E se chover?",
    answer: (<div className="space-y-3"><ul className="list-disc pl-5 space-y-1"><li><strong>Chuva forte ou mau tempo:</strong> passeio é reagendado.</li><li><strong>Frio, nublado ou garoa passageira:</strong> passeio acontece normalmente.</li></ul></div>)
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-slate-950 relative border-t border-slate-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-yellow-500 font-medium tracking-[0.2em] uppercase text-sm mb-2 block">Tire suas dúvidas</span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-white">Perguntas Frequentes</h2>
          <div className="w-24 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mt-6"></div>
        </motion.div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.07 }}
              className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden transition-all duration-300"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                aria-expanded={openIndex === index}
                className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-inset"
              >
                <span className="text-lg font-medium text-white">{faq.question}</span>
                {openIndex === index
                  ? <ChevronUp className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                }
              </button>
              <div className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${openIndex === index ? "max-h-96 pb-5 opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="text-gray-400 font-light leading-relaxed">{faq.answer}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
