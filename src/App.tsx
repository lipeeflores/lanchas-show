import React, { useState, useEffect } from 'react';
import { Anchor, Calendar, MapPin, Users, Ship, Search, Menu, X, Info, Check, ChevronDown, ChevronUp, Star, MessageCircle, Camera } from 'lucide-react';
import { motion } from 'motion/react';

const mockBoats = [
  {
    id: 1,
    name: "Phantom 300",
    capacity: 10,
    size: 30,
    price: 3500,
    originalPrice: null,
    image: "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: 2,
    name: "Azimut 60",
    capacity: 15,
    size: 60,
    price: 12000,
    originalPrice: 15000,
    image: "https://images.unsplash.com/photo-1605281317010-fe5ffe798166?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: 3,
    name: "Schaefer 510",
    capacity: 14,
    size: 51,
    price: 8500,
    originalPrice: null,
    image: "https://images.unsplash.com/photo-1540946485063-a40da27545f8?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: 4,
    name: "Focker 275",
    capacity: 8,
    size: 27,
    price: 2500,
    originalPrice: 2800,
    image: "https://images.unsplash.com/photo-1520255870062-bd79d3865de7?auto=format&fit=crop&q=80&w=800",
  }
];

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-slate-900/95 backdrop-blur-md shadow-lg py-4' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Anchor className="h-8 w-8 text-yellow-500" />
            <span className="text-2xl font-serif font-bold text-white tracking-wider">Lanchas Show</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#sobre" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium">Sobre Nós</a>
            <a href="#frota" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium">A Frota</a>
            <a href="#galeria" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium">Galeria</a>
            <a href="#localizacao" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium">Localização</a>
            <a href="#faq" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium">FAQ</a>
            <a href="#contato" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium">Contato</a>
            <a href="#admin" className="border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-slate-900 px-4 py-2 rounded-lg transition-colors text-sm uppercase tracking-widest font-medium">Portal ADM</a>
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white">
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-900/95 backdrop-blur-md absolute top-full left-0 w-full border-t border-slate-800">
          <div className="px-4 pt-2 pb-6 space-y-4 flex flex-col">
            <a href="#sobre" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium py-2">Sobre Nós</a>
            <a href="#frota" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium py-2">A Frota</a>
            <a href="#galeria" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium py-2">Galeria</a>
            <a href="#localizacao" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium py-2">Localização</a>
            <a href="#faq" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium py-2">FAQ</a>
            <a href="#contato" className="text-gray-300 hover:text-yellow-500 transition-colors text-sm uppercase tracking-widest font-medium py-2">Contato</a>
            <a href="#admin" className="border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-slate-900 px-4 py-2 rounded-lg transition-colors text-sm uppercase tracking-widest font-medium text-center mt-4">Portal ADM</a>
          </div>
        </div>
      )}
    </nav>
  );
};

const CustomSelect = ({ value, onChange, options, icon: Icon, placeholder }: any) => {
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

  const selectedOption = options.find((opt: any) => opt.value === value);

  return (
    <div className="relative" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
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
        <div className="absolute z-50 w-full mt-2 bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-lg shadow-2xl overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200">
          {options.map((option: any) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
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
};

const CustomDatePicker = ({ value, onChange }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const dateRef = React.useRef<HTMLDivElement>(null);
  const [currentDate, setCurrentDate] = useState(value || new Date());

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
  
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const dayNames = ["D", "S", "T", "Q", "Q", "S", "S"];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    onChange(newDate);
    setIsOpen(false);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Selecione uma data";
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
          <span className={`truncate ${!value ? 'text-gray-400' : ''}`}>
            {value ? formatDate(value) : "Selecione a data"}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-72 mt-2 bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-lg shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200 left-0 md:left-auto">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-slate-700 rounded-full text-gray-400 hover:text-white transition-colors">
              <ChevronDown className="h-5 w-5 rotate-90" />
            </button>
            <span className="text-white font-medium text-sm">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-slate-700 rounded-full text-gray-400 hover:text-white transition-colors">
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day, i) => (
              <div key={i} className="text-center text-xs font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = value?.getDate() === day && value?.getMonth() === currentDate.getMonth() && value?.getFullYear() === currentDate.getFullYear();
              const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
              
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm transition-colors mx-auto
                    ${isSelected ? 'bg-yellow-500 text-slate-900 font-bold' : 
                      isToday ? 'border border-yellow-500/50 text-yellow-500' : 
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
};

const BookingEngine = () => {
  const [local, setLocal] = useState('');
  const [destino, setDestino] = useState('');
  const [data, setData] = useState<Date | null>(null);

  const locais = [
    { value: 'portobelo', label: 'Porto Belo' },
    { value: 'bc', label: 'Balneário Camboriú' }
  ];

  const destinos = [
    { value: 'caixadaco', label: "Caixa d'Aço" },
    { value: 'campeche', label: 'Ilha do Campeche' },
    { value: 'sepultura', label: 'Praia da Sepultura' }
  ];

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl w-full max-w-4xl mx-auto mt-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Local de Embarque */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-medium">Local de Embarque</label>
          <CustomSelect 
            value={local} 
            onChange={setLocal} 
            options={locais} 
            icon={MapPin} 
            placeholder="Selecione o local" 
          />
        </div>

        {/* Destino */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-medium">Destino</label>
          <CustomSelect 
            value={destino} 
            onChange={setDestino} 
            options={destinos} 
            icon={Anchor} 
            placeholder="Selecione o destino" 
          />
        </div>

        {/* Data */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-medium">Data</label>
          <CustomDatePicker value={data} onChange={setData} />
        </div>

        {/* Quantidade de Pessoas */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-medium">Passageiros</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-yellow-500" />
            <input type="number" min="1" placeholder="Ex: 8" className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all hover:bg-slate-800/80" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        
        {/* Opções Extras */}
        <div className="md:col-span-5 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center justify-center w-5 h-5 mt-0.5">
              <input type="checkbox" className="peer appearance-none w-5 h-5 border border-slate-600 rounded bg-slate-800/50 checked:bg-yellow-500 checked:border-yellow-500 transition-all cursor-pointer" />
              <Check className="absolute w-3 h-3 text-slate-900 opacity-0 peer-checked:opacity-100 pointer-events-none" />
            </div>
            <div>
              <span className="text-sm text-gray-200 group-hover:text-white transition-colors">Busca Flexível (+/- 1 fim de semana)</span>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Info className="w-3 h-3" /> Priorizamos opções de Sexta a Domingo</p>
            </div>
          </label>
          <p className="text-xs text-gray-500 flex items-center gap-1"><Info className="w-3 h-3" /> Atenção: Crianças contam na capacidade total da embarcação.</p>
        </div>

        {/* Cupom */}
        <div className="md:col-span-3 space-y-2">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-medium">Cupom (Opcional)</label>
          <input type="text" placeholder="Código" className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all uppercase" />
        </div>

        {/* Submit */}
        <div className="md:col-span-4">
          <button className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-slate-900 font-bold text-lg py-3 px-6 rounded-lg shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] transition-all flex items-center justify-center gap-2">
            <Search className="w-5 h-5" />
            Buscar Lanchas
          </button>
        </div>

      </div>
    </div>
  );
};

const Hero = () => {
  return (
    <div className="relative min-h-screen flex items-center justify-center pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&q=80&w=2000" 
          alt="Luxury Yacht" 
          className="w-full h-full object-cover"
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
          Sua Experiência de Luxo <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-600">Começa no Mar</span>
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
          <BookingEngine />
        </motion.div>
      </div>
    </div>
  );
};

const About = () => {
  return (
    <section id="sobre" className="py-24 bg-slate-950 relative border-t border-slate-800 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="order-2 lg:order-1 relative h-[500px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group"
          >
            <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-transparent transition-colors z-10 pointer-events-none"></div>
            <img 
              src="https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&q=80&w=1000" 
              alt="Lancha de luxo em alto mar" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10"></div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="order-1 lg:order-2"
          >
            <span className="text-yellow-500 font-medium tracking-[0.2em] uppercase text-sm mb-2 block">Tradição & Excelência</span>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-8">Sobre Nós</h2>
            
            <div className="space-y-6 text-gray-300 font-light leading-relaxed text-lg">
              <p>
                <strong className="text-white font-medium">Mais de 10 anos levando você ao melhor do mar!</strong>
              </p>
              <p>
                Temos orgulho de oferecer uma das poucas lanchas modernas e de alto padrão disponíveis na região de Porto Belo e Caixa d'Aço. Nosso compromisso é com a qualidade impecável e a satisfação total dos nossos clientes.
              </p>
              <p>
                Proporcionamos passeios exclusivos onde cada detalhe é pensado para você: música ambiente de qualidade, conforto absoluto a bordo e rigorosos padrões de segurança para garantir um dia perfeito e inesquecível nas águas cristalinas do litoral catarinense.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-slate-800 pt-8">
              <div>
                <p className="text-3xl font-serif font-bold text-yellow-500 mb-1">10+</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Anos de Experiência</p>
              </div>
              <div>
                <p className="text-3xl font-serif font-bold text-yellow-500 mb-1">Alto</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Padrão</p>
              </div>
              <div>
                <p className="text-3xl font-serif font-bold text-yellow-500 mb-1">100%</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Segurança</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Fleet = () => {
  return (
    <section id="frota" className="py-24 bg-slate-900 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-yellow-500 font-medium tracking-[0.2em] uppercase text-sm mb-2 block">Nossa Coleção</span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-white">Embarcações Disponíveis</h2>
          <div className="w-24 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mt-6"></div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {mockBoats.map((boat, index) => (
            <motion.div 
              key={boat.id} 
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden hover:bg-slate-800/60 hover:border-yellow-500/30 transition-all duration-500 flex flex-col backdrop-blur-sm"
            >
              <div className="relative h-64 overflow-hidden">
                <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-transparent transition-colors z-10"></div>
                <img 
                  src={boat.image} 
                  alt={boat.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
                />
                {boat.originalPrice && (
                  <div className="absolute top-4 right-4 z-20 bg-yellow-500 text-slate-900 text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full shadow-lg">
                    Oferta
                  </div>
                )}
              </div>
              
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-2xl font-serif font-bold text-white mb-4 group-hover:text-yellow-400 transition-colors">{boat.name}</h3>
                
                <div className="flex items-center gap-4 mb-6 text-gray-400 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-yellow-500" />
                    <span>{boat.capacity} pessoas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Ship className="w-4 h-4 text-yellow-500" />
                    <span>{boat.size} pés</span>
                  </div>
                </div>
                
                <div className="mt-auto pt-6 border-t border-slate-700/50 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Diária a partir de</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-yellow-500">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(boat.price)}
                      </span>
                      {boat.originalPrice && (
                        <span className="text-sm text-gray-500 line-through">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(boat.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <button className="w-full mt-6 bg-transparent border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-slate-900 font-bold py-3 px-4 rounded-lg transition-all duration-300">
                  Detalhes e Reserva
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Location = () => {
  return (
    <section id="localizacao" className="py-24 bg-slate-950 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-yellow-500 font-medium tracking-[0.2em] uppercase text-sm mb-2 block">Onde Estamos</span>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-6">Localização & Embarque</h2>
            <p className="text-gray-400 font-light leading-relaxed mb-8 text-lg">
              Nossas embarcações ficam estrategicamente localizadas para oferecer o melhor acesso aos paraísos do litoral catarinense. O embarque principal ocorre em <strong>Porto Belo</strong>, a poucos minutos do famoso Caixa d'Aço.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <div className="bg-yellow-500/10 p-3 rounded-xl">
                  <MapPin className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Marina em Porto Belo</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Ponto de partida ideal para o Caixa d'Aço, Praia da Sepultura e Ilha de Porto Belo. Estrutura completa com estacionamento e segurança.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <div className="bg-yellow-500/10 p-3 rounded-xl">
                  <Anchor className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Balneário Camboriú</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Embarques sob demanda na Barra Sul. Perfeito para passeios pela orla de BC, Praia das Laranjeiras e Praia do Pinho.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="relative h-[500px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl group"
          >
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d3548.877864883138!2d-48.53699822452296!3d-27.14742257650808!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMjfCsDA4JzUwLjciUyA0OMKwMzInMDMuOSJX!5e0!3m2!1spt-BR!2sbr!4v1712757300000!5m2!1spt-BR!2sbr" 
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen={false} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 z-0"
              title="Localização Lanchas Show"
            ></iframe>
            <div className="absolute bottom-6 left-6 right-6 z-20 bg-slate-900/80 backdrop-blur-md border border-white/10 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-white font-bold">Marina em Porto Belo</p>
                <p className="text-yellow-500 text-sm">Ponto de Embarque Principal</p>
              </div>
              <a 
                href="https://www.google.com/maps/place/27%C2%B008'50.7%22S+48%C2%B032'03.9%22W/@-27.147423,-48.534428,15z/data=!4m4!3m3!8m2!3d-27.1474226!4d-48.5344283?hl=pt-BR&entry=ttu&g_ep=EgoyMDI2MDQwNy4wIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-yellow-500 text-slate-900 px-4 py-2 rounded-lg font-bold text-sm hover:bg-yellow-400 transition-colors inline-block"
              >
                Ver Rotas
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Gallery = () => {
  const images = [
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1590845947698-8924d7409b56?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1534008897995-27a23e859048?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1520255870062-bd79d3865de7?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1605281317010-fe5ffe798166?auto=format&fit=crop&q=80&w=800",
  ];

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
          {images.map((src, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative group overflow-hidden rounded-xl aspect-square cursor-pointer"
            >
              <img 
                src={src} 
                alt={`Galeria Lanchas Show ${index + 1}`} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
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
};

const Testimonials = () => {
  const reviews = [
    { name: "Katrini R.F", text: "Experiência incrível! A lancha estava impecável, o marinheiro foi super atencioso e o roteiro no Caixa d'Aço foi inesquecível. Recomendo de olhos fechados!" },
    { name: "Bruno B.", text: "Melhor passeio que já fiz na região. Atendimento premium desde a reserva até o desembarque. Com certeza voltaremos mais vezes." },
    { name: "Vinicius V.", text: "Estrutura fantástica. Comemoramos um aniversário a bordo e foi tudo perfeito. A churrasqueira e o som da lancha fizeram toda a diferença." },
    { name: "Anderson F.", text: "Profissionalismo nota 10. A equipe da Lanchas Show entregou exatamente o que prometeu: luxo, segurança e muita diversão." }
  ];

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
          {reviews.map((review, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="bg-slate-800/30 border border-slate-700/50 p-6 rounded-2xl hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                ))}
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
};

const FAQ = () => {
  const faqs = [
    {
      question: "Qual o local de embarque e quais os destinos?",
      answer: (
        <div className="space-y-3">
          <p><strong>Porto Belo:</strong> Ilha de Porto Belo, Praia do Caixa d'Aço, Praia do Pipoca, Praia da Sepultura, Orla de Porto Belo até o Hard Rock.</p>
          <p><strong>Balneário Camboriú (BC):</strong> Orla Barra Sul e Laranjeiras.</p>
        </div>
      )
    },
    {
      question: "Quais as formas de reserva e pagamento?",
      answer: (
        <div className="space-y-3">
          <p>Para reservar, precisamos dos seus dados pessoais + sinal de <strong>50%</strong>. O restante é pago até o embarque.</p>
          <p>Parcelamento:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Via PIX mensal (reservas antecipadas, quitando até o embarque).</li>
            <li>Cartão de crédito (com acréscimo da máquina).</li>
          </ul>
        </div>
      )
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
      answer: (
        <div className="space-y-3">
          <p>Das <strong>10h às 18h</strong>. É possível contratar horas extras com custo adicional.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Obs.: A lancha não navega o dia inteiro, apenas até o destino, onde ficará ancorada.</li>
          </ul>
        </div>
      )
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
      answer: (
        <div className="space-y-3">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Chuva forte ou mau tempo:</strong> passeio é reagendado.</li>
            <li><strong>Frio, nublado ou garoa passageira:</strong> passeio acontece normalmente.</li>
          </ul>
        </div>
      )
    }
  ];

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
          {faqs.map((faq, index) => (
            <motion.div 
              key={index} 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden transition-all duration-300"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
              >
                <span className="text-lg font-medium text-white">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              <div
                className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? "max-h-96 pb-5 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="text-gray-400 font-light leading-relaxed">{faq.answer}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer id="contato" className="bg-slate-950 pt-16 pb-8 border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12"
        >
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <Anchor className="h-8 w-8 text-yellow-500" />
              <span className="text-2xl font-serif font-bold text-white tracking-wider">Lanchas Show</span>
            </div>
            <p className="text-gray-400 max-w-md font-light leading-relaxed">
              A principal referência em aluguel de lanchas e iates de luxo no litoral catarinense. Experiências exclusivas no Caixa d'Aço, Porto Belo e Balneário Camboriú.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold uppercase tracking-wider mb-6 text-sm">Navegação</h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-gray-400 hover:text-yellow-500 transition-colors">Início</a></li>
              <li><a href="#sobre" className="text-gray-400 hover:text-yellow-500 transition-colors">Sobre Nós</a></li>
              <li><a href="#frota" className="text-gray-400 hover:text-yellow-500 transition-colors">A Frota</a></li>
              <li><a href="#localizacao" className="text-gray-400 hover:text-yellow-500 transition-colors">Localização</a></li>
              <li><a href="#faq" className="text-gray-400 hover:text-yellow-500 transition-colors">FAQ</a></li>
              <li><a href="#contato" className="text-gray-400 hover:text-yellow-500 transition-colors">Contato</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold uppercase tracking-wider mb-6 text-sm">Contato</h4>
            <ul className="space-y-3 text-gray-400">
              <li>Porto Belo - SC</li>
              <li>Caixa d'Aço</li>
              <li>contato@lanchasshow.com.br</li>
              <li>+55 (47) 99999-9999</li>
            </ul>
          </div>
        </motion.div>
        
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Lanchas Show. Todos os direitos reservados.
          </p>
          <div className="flex gap-4 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-white transition-colors">Política de Privacidade</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 font-sans selection:bg-yellow-500/30">
      <Navbar />
      <main>
        <Hero />
        <About />
        <Fleet />
        <Gallery />
        <Location />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
