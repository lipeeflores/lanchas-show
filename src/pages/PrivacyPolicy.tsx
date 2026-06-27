import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-950 text-gray-300">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-yellow-500 hover:text-yellow-400 transition-colors mb-10 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar ao início
        </Link>

        <h1 className="text-4xl font-serif font-bold text-white mb-2">Política de Privacidade</h1>
        <p className="text-gray-500 text-sm mb-10">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Quem somos</h2>
            <p>A <strong className="text-white">Lanchas Show</strong>, com sede em Porto Belo - SC, é responsável pelo tratamento dos dados pessoais coletados por meio deste site e do nosso canal de atendimento via WhatsApp.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Dados que coletamos</h2>
            <p>Coletamos os seguintes dados quando você realiza uma reserva ou entra em contato conosco:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1 text-gray-400">
              <li>Nome completo</li>
              <li>Número de telefone (WhatsApp)</li>
              <li>Endereço de e-mail</li>
              <li>CPF e RG (somente para formalização de contrato)</li>
              <li>Endereço (somente para formalização de contrato)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Como usamos seus dados</h2>
            <p>Seus dados são utilizados exclusivamente para:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1 text-gray-400">
              <li>Processar e gerenciar sua reserva de passeio</li>
              <li>Comunicação sobre o passeio via WhatsApp</li>
              <li>Emissão de contrato de locação de embarcação</li>
              <li>Envio de avaliação pós-passeio</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Compartilhamento de dados</h2>
            <p>Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros, exceto quando necessário para a execução do serviço (ex: operadoras de pagamento para processamento de cobranças).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Seus direitos (LGPD)</h2>
            <p>Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1 text-gray-400">
              <li>Confirmar a existência de tratamento dos seus dados</li>
              <li>Acessar os dados que temos sobre você</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar a exclusão dos seus dados</li>
              <li>Revogar o consentimento a qualquer momento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Contato</h2>
            <p>Para exercer seus direitos ou tirar dúvidas sobre o tratamento dos seus dados:</p>
            <ul className="list-disc pl-6 mt-3 space-y-1 text-gray-400">
              <li>E-mail: <a href="mailto:contato@lanchasshow.com.br" className="text-yellow-500 hover:text-yellow-400">contato@lanchasshow.com.br</a></li>
              <li>WhatsApp: +55 (47) 99682-7545</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
