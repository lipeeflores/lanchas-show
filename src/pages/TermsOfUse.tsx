import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-slate-950 text-gray-300">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-yellow-500 hover:text-yellow-400 transition-colors mb-10 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar ao início
        </Link>

        <h1 className="text-4xl font-serif font-bold text-white mb-2">Termos de Uso</h1>
        <p className="text-gray-500 text-sm mb-10">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Aceitação dos termos</h2>
            <p>Ao acessar este site ou contratar nossos serviços, você concorda com os presentes Termos de Uso. Caso não concorde com alguma disposição, não utilize nossos serviços.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Serviços oferecidos</h2>
            <p>A Lanchas Show oferece serviços de <strong className="text-white">locação privativa de embarcações</strong> para passeios no litoral de Santa Catarina, incluindo região de Porto Belo e Balneário Camboriú.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Reservas e pagamentos</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-400">
              <li>A reserva é confirmada mediante pagamento de <strong className="text-white">sinal de 50%</strong> do valor total.</li>
              <li>O valor restante deve ser quitado até o momento do embarque.</li>
              <li>Cancelamentos com menos de 48h de antecedência podem acarretar perda parcial ou total do sinal.</li>
              <li>Em caso de mau tempo, o passeio é reagendado sem custo adicional.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Capacidade e segurança</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-400">
              <li>A capacidade máxima de cada embarcação deve ser respeitada. Crianças contam como passageiros.</li>
              <li>O consumo de bebidas alcoólicas a bordo é de responsabilidade dos passageiros.</li>
              <li>O marinheiro responsável tem autoridade para interromper o passeio em caso de mau tempo ou conduta inadequada.</li>
              <li>O uso de coletes salva-vidas é obrigatório para crianças e durante a navegação em mar aberto.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Responsabilidade</h2>
            <p>A Lanchas Show não se responsabiliza por objetos pessoais perdidos ou danificados a bordo, nem por incidentes causados por descumprimento das normas de segurança pelos passageiros.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Contato</h2>
            <ul className="list-disc pl-6 space-y-1 text-gray-400">
              <li>E-mail: <a href="mailto:contato@lanchasshow.com.br" className="text-yellow-500 hover:text-yellow-400">contato@lanchasshow.com.br</a></li>
              <li>WhatsApp: +55 (47) 99682-7545</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
