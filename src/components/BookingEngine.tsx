import React from 'react';
import { MapPin, Anchor, Users, Search, Info } from 'lucide-react';
import CustomSelect from './CustomSelect';
import CustomDatePicker from './CustomDatePicker';
import type { SearchParams, SelectOption } from '../types';

interface BookingEngineProps {
  searchParams: SearchParams;
  setSearchParams: (p: SearchParams) => void;
  embarkOptions: SelectOption[];
  destOptions: SelectOption[];
  onSearch: () => void;
}

export default function BookingEngine({ searchParams, setSearchParams, embarkOptions, destOptions, onSearch }: BookingEngineProps) {
  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl w-full max-w-4xl mx-auto mt-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-medium">Local de Embarque</label>
          <CustomSelect
            value={searchParams.local}
            onChange={v => setSearchParams({ ...searchParams, local: v })}
            options={embarkOptions}
            icon={MapPin}
            placeholder="Selecione o local"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-medium">Destino</label>
          <CustomSelect
            value={searchParams.destino}
            onChange={v => setSearchParams({ ...searchParams, destino: v })}
            options={destOptions}
            icon={Anchor}
            placeholder="Selecione o destino"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-medium">Data</label>
          <CustomDatePicker value={searchParams.data} onChange={d => setSearchParams({ ...searchParams, data: d })} />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-medium">Passageiros</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-yellow-500" />
            <input
              type="number" min="1" placeholder="Ex: 8"
              value={searchParams.passageiros || ''}
              onChange={e => setSearchParams({ ...searchParams, passageiros: Number(e.target.value) })}
              className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all hover:bg-slate-800/80"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-end gap-4">
        <p className="text-xs text-gray-500 flex items-center gap-1 flex-1">
          <Info className="w-3 h-3" /> Atenção: Crianças contam na capacidade total da embarcação.
        </p>
        <button
          onClick={onSearch}
          className="w-full sm:w-auto bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-slate-900 font-bold text-lg py-3 px-8 rounded-lg shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] transition-all flex items-center justify-center gap-2"
        >
          <Search className="w-5 h-5" />
          Buscar Lanchas
        </button>
      </div>
    </div>
  );
}
