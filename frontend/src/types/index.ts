export interface User {
  id: number;
  email: string;
  display_name: string;
  is_admin: number;
}

export interface Kid {
  id: number;
  user_id: number;
  name: string;
  color: string;
  avatar: string;
  sort_order: number;
  balance: number;
  allowance?: AllowanceRule | null;
  goals?: SavingsGoal[];
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  kid_id: number;
  type: 'credit' | 'debit';
  category: string;
  amount: number;
  description: string;
  transaction_date: string;
  created_at: string;
  kid_name?: string;
}

export interface AllowanceRule {
  id: number;
  kid_id: number;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  day_of_week: number | null;
  day_of_month: number | null;
  next_due: string;
  is_active: number;
}

export interface SavingsGoal {
  id: number;
  kid_id: number;
  name: string;
  target_amount: number | null;
  current_amount: number;
  is_completed: number;
  completed_at: string | null;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}
