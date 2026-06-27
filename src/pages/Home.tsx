import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Boat, BoatRoute, Reservation, SearchParams } from '../types';

import Navbar from '../components/Navbar';
import HeroSection from '../sections/HeroSection';
import AboutSection from '../sections/AboutSection';
import FleetSection from '../sections/FleetSection';
import GallerySection from '../sections/GallerySection';
import LocationSection from '../sections/LocationSection';
import TestimonialsSection from '../sections/TestimonialsSection';
import FAQSection from '../sections/FAQSection';
import Footer from '../sections/Footer';

const LOCATION_LABELS: Record<string, string> = {
  caixadaco: "Caixa d'Aço",
  orladebalneario: "Orla de Balneário",
  balneariocamboriu: "Balneário Camboriú",
  portobelo: "Porto Belo",
  itapema: "Itapema",
  laranjeiras: "Laranjeiras",
  sepultura: "Sepultura",
};

function normalizeStr(str: string): string {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '').trim();
}

function formatDisplayLabel(label: string): string {
  return LOCATION_LABELS[normalizeStr(label)] ?? label;
}

function getUniqueOptions(items: string[]) {
  const map = new Map<string, string>();
  items.forEach(item => {
    if (!item) return;
    const normalized = normalizeStr(item);
    if (!map.has(normalized)) {
      map.set(normalized, item);
    } else {
      const existing = map.get(normalized)!;
      if (item.includes("'") && !existing.includes("'")) map.set(normalized, item);
      else if (item.length > existing.length) map.set(normalized, item);
    }
  });
  return Array.from(map.values()).map(original => ({ value: original, label: formatDisplayLabel(original) }));
}

const MOCK_BOATS: Boat[] = [
  {
    id: 'mock-1', name: 'Tecnomarine 50', capacity: 15, size: 50,
    image: '/galeria-de-fotos/caixa-d-aco.png',
    image_urls: ['/galeria-de-fotos/caixa-d-aco.png', '/galeria-de-fotos/caixa-d-aco-2.png'],
    boarding_points: ['Porto Belo', 'Balneário Camboriú'],
    allowed_destinations: ["Caixa d'Aço", 'Praia da Sepultura'],
    has_floating_mat: true, include_captain: true, include_fuel: true, owner_type: 'OWN',
  },
  {
    id: 'mock-2', name: 'Schaefer 365', capacity: 12, size: 36,
    image: '/galeria-de-fotos/caixa-d-aco-festa.png',
    image_urls: ['/galeria-de-fotos/caixa-d-aco-festa.png'],
    boarding_points: ['Porto Belo'],
    allowed_destinations: ["Caixa d'Aço"],
    has_floating_mat: false, include_captain: true, include_fuel: true, owner_type: 'PARTNER',
  },
];

const MOCK_ROUTES: BoatRoute[] = [
  { boat_id: 'mock-1', embarkation_point: 'Porto Belo', destination_point: "Caixa d'Aço" },
  { boat_id: 'mock-1', embarkation_point: 'Balneário Camboriú', destination_point: "Caixa d'Aço" },
  { boat_id: 'mock-2', embarkation_point: 'Porto Belo', destination_point: "Caixa d'Aço" },
];

export default function Home() {
  const [allBoats, setAllBoats] = useState<Boat[]>([]);
  const [filteredBoats, setFilteredBoats] = useState<Boat[]>([]);
  const [routes, setRoutes] = useState<BoatRoute[]>([]);
  const [reservations, setReservations] = useState<Pick<Reservation, 'boat_id' | 'start_date' | 'end_date' | 'status'>[]>([]);
  const [searchParams, setSearchParams] = useState<SearchParams>({
    local: '', destino: '', data: null, passageiros: 0, hasSearched: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: boatsData } = await supabase.from('boats').select('*').order('created_at');
      const { data: routesData } = await supabase.from('boat_routes_pricing').select('*');

      const finalBoats: Boat[] = (boatsData && boatsData.length > 0) ? boatsData : MOCK_BOATS;
      const finalRoutes: BoatRoute[] = (routesData && routesData.length > 0) ? routesData : MOCK_ROUTES;

      setAllBoats(finalBoats);
      setFilteredBoats(finalBoats);
      setRoutes(finalRoutes);

      const { data: resData } = await supabase
        .from('reservations')
        .select('boat_id, start_date, end_date, status')
        .not('status', 'in', '("CANCELLED","NO_SHOW")');
      if (resData) setReservations(resData);
    };
    fetchData();
  }, []);

  const rawEmbarks = routes.length > 0
    ? routes.map(r => r.embarkation_point)
    : allBoats.flatMap(b => b.boarding_points || []);

  const rawDests = routes.length > 0
    ? routes.map(r => r.destination_point)
    : allBoats.flatMap(b => b.allowed_destinations || []);

  const embarkOptions = getUniqueOptions(rawEmbarks);
  const destOptions = getUniqueOptions(rawDests);

  const handleSearch = () => {
    const searchLocalNorm = normalizeStr(searchParams.local);
    const searchDestNorm = normalizeStr(searchParams.destino);

    let results = [...allBoats];

    if (searchLocalNorm || searchDestNorm) {
      results = results.filter(b => {
        const hasRoutePricing = routes.some(r => r.boat_id === b.id);
        if (hasRoutePricing) {
          return routes.some(r =>
            r.boat_id === b.id &&
            (!searchLocalNorm || normalizeStr(r.embarkation_point) === searchLocalNorm) &&
            (!searchDestNorm || normalizeStr(r.destination_point) === searchDestNorm)
          );
        }
        const matchEmb = !searchLocalNorm || (b.boarding_points || []).some(p => normalizeStr(p) === searchLocalNorm);
        const matchDest = !searchDestNorm || (b.allowed_destinations || []).some(p => normalizeStr(p) === searchDestNorm);
        return matchEmb && matchDest;
      });
    }

    if (searchParams.passageiros > 0) {
      results = results.filter(b => b.capacity >= searchParams.passageiros);
    }

    if (searchParams.data) {
      const d = searchParams.data;
      const searchDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const bookedIds = reservations
        .filter(res => searchDateStr >= (res.start_date?.substring(0, 10) ?? '') && searchDateStr <= (res.end_date?.substring(0, 10) ?? ''))
        .map(res => res.boat_id);
      results = results.filter(b => !bookedIds.includes(b.id));
    }

    setFilteredBoats(results);
    setSearchParams({ ...searchParams, hasSearched: true });
    document.getElementById('frota')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 font-sans selection:bg-yellow-500/30">
      <Navbar />
      <main>
        <HeroSection
          searchParams={searchParams}
          setSearchParams={setSearchParams}
          embarkOptions={embarkOptions}
          destOptions={destOptions}
          onSearch={handleSearch}
        />
        <AboutSection />
        <FleetSection boats={filteredBoats} searchParams={searchParams} />
        <GallerySection />
        <LocationSection />
        <TestimonialsSection />
        <FAQSection />
      </main>
      <Footer />
    </div>
  );
}
