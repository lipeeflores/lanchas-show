import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface CustomDatePickerProps {
  value: Date | null;
  onChange: (d: Date) => void;
}

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DAY_NAMES = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function CustomDatePicker({ value, onChange }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dateRef = React.useRef<HTMLDivElement>(null);
  const [currentDate, setCurrentDate] = useState(value || new Date());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    if (newDate < today) return;
    onChange(newDate);
    setIsOpen(false);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Selecione a data";
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="relative" ref={dateRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-800/50 border ${isOpen ? 'border-yellow-500 ring-1 ring-yellow-500' : 'border-slate-700'} text-white rounded-lg pl-10 pr-4 py-3 flex items-center justify-between transition-all hover:bg-slate-800/80`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-yellow-500" />
          <span className={`truncate ${!value ? 'text-gray-400' : ''}`}>{formatDate(value)}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-72 mt-2 bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-lg shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200 left-0 md:left-auto">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-slate-700 rounded-full text-gray-400 hover:text-white transition-colors">
              <ChevronDown className="h-5 w-5 rotate-90" />
            </button>
            <span className="text-white font-medium text-sm">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button type="button" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-slate-700 rounded-full text-gray-400 hover:text-white transition-colors">
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_NAMES.map((day, i) => (
              <div key={i} className="text-center text-xs font-medium text-gray-500 py-1">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="h-8" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const thisDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
              const isPast = thisDay < today;
              const isSelected = value?.getDate() === day && value?.getMonth() === currentDate.getMonth() && value?.getFullYear() === currentDate.getFullYear();
              const isToday = today.getDate() === day && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isPast}
                  onClick={() => handleDateSelect(day)}
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm transition-colors mx-auto
                    ${isPast ? 'text-gray-600 cursor-not-allowed opacity-40' :
                      isSelected ? 'bg-yellow-500 text-slate-900 font-bold' :
                      isToday ? 'border border-yellow-500/50 text-yellow-500 hover:bg-slate-700' :
                      'text-gray-300 hover:bg-slate-700'}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
