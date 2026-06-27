export interface Boat {
  id: string;
  name: string;
  capacity: number;
  size: number;
  image?: string;
  image_urls?: string[];
  boarding_points: string[];
  allowed_destinations: string[];
  has_floating_mat: boolean;
  include_captain: boolean;
  include_fuel: boolean;
  owner_type: 'OWN' | 'PARTNER';
  created_at?: string;
}

export interface BoatRoute {
  id?: string;
  boat_id: string;
  embarkation_point: string;
  destination_point: string;
  price?: number;
}

export interface Reservation {
  id: string;
  boat_id: string;
  customer_id?: string;
  start_date: string;
  end_date: string;
  status: string;
  total_price: number;
  down_payment?: number;
  boats?: { name: string; partners?: { name: string } };
  customers?: Customer;
}

export interface Customer {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  document_cpf?: string;
  document_rg?: string;
  address?: string;
}

export interface SystemAlert {
  id: string;
  type: string;
  message: string;
  amount?: number;
  created_at: string;
}

export interface BoatExpense {
  id: string;
  description: string;
  amount: number;
  type: 'FIXED' | 'VARIABLE';
  date: string;
  boats?: { name: string };
}

export interface SearchParams {
  local: string;
  destino: string;
  data: Date | null;
  passageiros: number;
  hasSearched: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}
