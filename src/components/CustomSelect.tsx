import React, { useState, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { SelectOption } from '../types';

interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  icon: React.ElementType;
  placeholder: string;
}

export default function CustomSelect({ value, onChange, options, icon: Icon, placeholder }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full bg-slate-800/50 border ${isOpen ? 'border-yellow-500 ring-1 ring-yellow-500' : 'border-slate-700'} text-white rounded-lg pl-10 pr-4 py-3 flex items-center justify-between transition-all hover:bg-slate-800/80`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-yellow-500" />
          <span className={`truncate ${!selectedOption ? 'text-gray-400' : ''}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div role="listbox" className="absolute z-50 w-full mt-2 bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-lg shadow-2xl overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200">
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              onClick={() => { onChange(option.value); setIsOpen(false); }}
              className={`w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors flex items-center justify-between ${value === option.value ? 'text-yellow-500 bg-slate-700/30' : 'text-gray-200'}`}
            >
              <span className="truncate">{option.label}</span>
              {value === option.value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
