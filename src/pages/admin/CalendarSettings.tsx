import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getPricingTier, PricingTier } from '../../lib/pricingEngine';
import { Anchor, Ship, CalendarCheck, Sun, Snowflake, PartyPopper, Landmark, Wallet, Users, Bot, Save, X, Plus, Trash2, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CalendarSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Settings state
  const [highSeasonStart, setHighSeasonStart] = useState('12-15');
  const [highSeasonEnd, setHighSeasonEnd] = useState('02-28');
  const [customHolidays, setCustomHolidays] = useState<{ date: string; label: string }[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');

  // Test pricing
  const [testDate, setTestDate] = useState('');
  const [testResult, setTestResult] = useState<{ tier: PricingTier; reason: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      const { data } = await supabase.from('global_settings').select('key, value');
      if (data) {
        const map: Record<string, any> = {};
        data.forEach(d => { map[d.key] = d.value; });
        if (map['high_season_start']) setHighSeasonStart(map['high_season_start']);
        if (map['high_season_end']) setHighSeasonEnd(map['high_season_end']);
        if (map['custom_holidays']) {
          // Support both old format (string[]) and new format ({date, label}[])
          const raw = map['custom_holidays'];
          if (Array.isArray(raw)) {
            setCustomHolidays(raw.map((item: any) =>
              typeof item === 'string' ? { date: item, label: '' } : item
            ));
          }
        }
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const upserts = [
      { key: 'high_season_start', value: JSON.stringify(highSeasonStart), updated_at: new Date().toISOString() },
      { key: 'high_season_end', value: JSON.stringify(highSeasonEnd), updated_at: new Date().toISOString() },
      { key: 'custom_holidays', value: JSON.stringify(customHolidays.map(h => h.date)), updated_at: new Date().toISOString() },
    ];

    try {
      for (const u of upserts) {
        const { error } = await supabase.from('global_settings').upsert(
          { key: u.key, value: JSON.parse(u.value), updated_at: u.updated_at },
          { onConflict: 'key' }
        );
        if (error) throw error;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert('Erro ao salvar configurações: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const addHoliday = () => {
    if (!newHolidayDate) return;
    if (customHolidays.find(h => h.date === newHolidayDate)) return;
    setCustomHolidays([...customHolidays, { date: newHolidayDate, label: newHolidayLabel || 'Data Especial' }]);
    setNewHolidayDate('');
    setNewHolidayLabel('');
  };

  const removeHoliday = (idx: number) => {
    setCustomHolidays(customHolidays.filter((_, i) => i !== idx));
  };

  const handleTestDate = async () => {
    if (!testDate) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await getPricingTier(testDate);
      setTestResult({ tier: result.tier, reason: result.reason });
    } catch (err) {
      console.error(err);
    }
    setTestLoading(false);
  };

  const tierLabel: Record<PricingTier, string> = {
    low_season: 'Baixa Temporada',
    high_season: 'Alta Temporada',
    weekend_holiday: 'Fim de Semana / Feriado',
  };
  const tierColor: Record<PricingTier, string> = {
    low_season: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    high_season: 'text-red-400 bg-red-500/10 border-red-500/30',
    weekend_holiday: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  };
  const tierIcon: Record<PricingTier, React.ReactNode> = {
    low_season: <Snowflake className="w-5 h-5" />,
    high_season: <Sun className="w-5 h-5" />,
    weekend_holiday: <PartyPopper className="w-5 h-5" />,
  };

  // Helper: format MM-DD to display
  const formatMMDD = (mmdd: string) => {
    const [m, d] = mmdd.split('-');
    const months = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${d} de ${months[parseInt(m)]}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-50 font-sans selection:bg-yellow-500/30">

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center justify-center border-b border-slate-800">
          <img src="/logo.png" alt="Lanchas Show" className="h-16 w-auto drop-shadow-[0_0_8px_rgba(234,179,8,0.2)]" />
        </div>
        <div className="p-4 flex-grow">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-4 px-4">Menu ADM</p>
          <nav className="space-y-2">
            <Link to="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Ship className="w-5 h-5" />
              <span className="font-medium text-sm">Visão 360º</span>
            </Link>
            <Link to="/admin/reservas" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <CalendarCheck className="w-5 h-5" />
              <span className="font-medium text-sm">Reservas</span>
            </Link>
            <Link to="/admin/frota" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Landmark className="w-5 h-5" />
              <span className="font-medium text-sm">Gestão de Frotas</span>
            </Link>
            <Link to="/admin/financeiro" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Wallet className="w-5 h-5" />
              <span className="font-medium text-sm">DRE & Caixa</span>
            </Link>
            <Link to="/admin/clientes" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Users className="w-5 h-5" />
              <span className="font-medium text-sm">Clientes CRM</span>
            </Link>
            <Link to="/admin/ia" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors">
              <Bot className="w-5 h-5" />
              <span className="font-medium text-sm">Central IA</span>
            </Link>
            <Link to="/admin/calendario" className="flex items-center gap-3 px-4 py-3 bg-slate-800 text-yellow-500 rounded-lg border border-slate-700">
              <Settings className="w-5 h-5" />
              <span className="font-medium text-sm">Temporada & Preços</span>
            </Link>
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <Link to="/" className="text-gray-500 hover:text-gray-300 text-sm flex items-center justify-center transition-colors">
            Sair e voltar ao site
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Settings className="w-7 h-7 text-yellow-500" />
              Configurações de Temporada
            </h1>
            <p className="text-sm text-gray-500 mt-1">O cérebro do calendário. Defina Alta/Baixa Temporada e Feriados Customizados.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(234,179,8,0.2)] disabled:opacity-50"
          >
            {saving ? (
              <span className="animate-pulse">Salvando...</span>
            ) : saved ? (
              <><CheckCircle className="w-5 h-5" /> Salvo!</>
            ) : (
              <><Save className="w-5 h-5" /> Salvar Configurações</>
            )}
          </button>
        </header>

        <div className="p-6 flex-1 overflow-auto bg-slate-950">
          {loading ? (
            <div className="p-10 text-center text-yellow-500 animate-pulse">Carregando configurações...</div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-8">

              {/* SECTION 1: High Season */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-800 bg-slate-900/80">
                  <h2 className="text-lg font-bold text-white flex items-center gap-3">
                    <Sun className="w-5 h-5 text-red-400" />
                    Período de Alta Temporada
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">Qualquer data dentro desse intervalo será automaticamente cobrada pelo preço de <span className="text-red-400 font-bold">Alta Temporada</span>.</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs text-gray-500 uppercase font-bold">Início (Dia-Mês)</label>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="text-[10px] text-gray-600">Dia</label>
                          <input
                            type="number" min="1" max="31"
                            value={parseInt(highSeasonStart.split('-')[1]) || 15}
                            onChange={e => {
                              const d = String(e.target.value).padStart(2, '0');
                              setHighSeasonStart(highSeasonStart.split('-')[0] + '-' + d);
                            }}
                            className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-600">Mês</label>
                          <select
                            value={parseInt(highSeasonStart.split('-')[0])}
                            onChange={e => {
                              const m = String(e.target.value).padStart(2, '0');
                              setHighSeasonStart(m + '-' + highSeasonStart.split('-')[1]);
                            }}
                            className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                          >
                            {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
                              <option key={i} value={i+1}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase font-bold">Fim (Dia-Mês)</label>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="text-[10px] text-gray-600">Dia</label>
                          <input
                            type="number" min="1" max="31"
                            value={parseInt(highSeasonEnd.split('-')[1]) || 28}
                            onChange={e => {
                              const d = String(e.target.value).padStart(2, '0');
                              setHighSeasonEnd(highSeasonEnd.split('-')[0] + '-' + d);
                            }}
                            className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-600">Mês</label>
                          <select
                            value={parseInt(highSeasonEnd.split('-')[0])}
                            onChange={e => {
                              const m = String(e.target.value).padStart(2, '0');
                              setHighSeasonEnd(m + '-' + highSeasonEnd.split('-')[1]);
                            }}
                            className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                          >
                            {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
                              <option key={i} value={i+1}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                    <Sun className="w-5 h-5 text-red-400 shrink-0" />
                    <p className="text-sm text-gray-300">
                      Temporada configurada: <span className="text-red-400 font-bold">{formatMMDD(highSeasonStart)}</span> → <span className="text-red-400 font-bold">{formatMMDD(highSeasonEnd)}</span>
                      {highSeasonStart > highSeasonEnd && <span className="text-gray-500 ml-2">(Cruza virada de ano)</span>}
                    </p>
                  </div>
                </div>
              </div>


              {/* SECTION 2: Custom Holidays */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-800 bg-slate-900/80">
                  <h2 className="text-lg font-bold text-white flex items-center gap-3">
                    <PartyPopper className="w-5 h-5 text-yellow-400" />
                    Feriados Locais e Datas Especiais
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">Datas extras onde o preço deve ser <span className="text-yellow-400 font-bold">Fim de Semana / Feriado</span>, mesmo se cair num dia de semana. Feriados nacionais já são detectados automaticamente via BrasilAPI.</p>
                </div>
                <div className="p-6">
                  {/* Add new holiday */}
                  <div className="flex gap-3 items-end mb-6">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 uppercase font-bold">Data</label>
                      <input
                        type="date"
                        value={newHolidayDate}
                        onChange={e => setNewHolidayDate(e.target.value)}
                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 uppercase font-bold">Descrição (Opcional)</label>
                      <input
                        type="text"
                        value={newHolidayLabel}
                        onChange={e => setNewHolidayLabel(e.target.value)}
                        placeholder="Ex: Aniversário de Porto Belo"
                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={addHoliday}
                      className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 shrink-0"
                    >
                      <Plus className="w-4 h-4" /> Adicionar
                    </button>
                  </div>

                  {/* List */}
                  {customHolidays.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 italic border border-dashed border-slate-800 rounded-xl">
                      Nenhuma data especial cadastrada. Feriados nacionais são detectados automaticamente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customHolidays.map((h, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 group hover:border-yellow-500/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <PartyPopper className="w-4 h-4 text-yellow-500" />
                            <span className="text-white font-medium text-sm">
                              {new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </span>
                            {h.label && <span className="text-gray-500 text-xs">— {h.label}</span>}
                          </div>
                          <button
                            onClick={() => removeHoliday(idx)}
                            className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>


              {/* SECTION 3: Pricing Test */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-800 bg-slate-900/80">
                  <h2 className="text-lg font-bold text-white flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-cyan-400" />
                    Simulador de Precificação
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">Teste antes de publicar. Selecione uma data e veja qual cenário de preço o sistema aplicará.</p>
                </div>
                <div className="p-6">
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 uppercase font-bold">Data para Simular</label>
                      <input
                        type="date"
                        value={testDate}
                        onChange={e => setTestDate(e.target.value)}
                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleTestDate}
                      disabled={testLoading || !testDate}
                      className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50"
                    >
                      {testLoading ? 'Consultando...' : '⚡ Simular'}
                    </button>
                  </div>

                  {testResult && (
                    <div className={`mt-6 border rounded-xl p-5 flex items-center gap-4 ${tierColor[testResult.tier]}`}>
                      {tierIcon[testResult.tier]}
                      <div>
                        <p className="font-bold text-lg">{tierLabel[testResult.tier]}</p>
                        <p className="text-sm opacity-80">{testResult.reason}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}
