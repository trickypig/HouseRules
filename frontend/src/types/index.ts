export interface User {
  id: number;
  email: string;
  display_name: string;
  is_admin: number;
  role: 'parent' | 'kid';
  parent_id: number | null;
  kid_id: number | null;
}

export interface Kid {
  id: number;
  user_id: number;
  name: string;
  color: string;
  avatar: string;
  sort_order: number;
  balance: number;
  recurring?: RecurringTransaction[];
  goals?: SavingsGoal[];
  pending_count?: number;
  created_at: string;
  updated_at: string;
}

export type TransactionStatus = 'future' | 'pending' | 'requested' | 'verified' | 'cancelled';

export interface Transaction {
  id: number;
  kid_id: number;
  type: 'credit' | 'debit';
  category: string;
  amount: number;
  description: string;
  transaction_date: string;
  status: TransactionStatus;
  recurring_transaction_id: number | null;
  created_at: string;
  kid_name?: string;
}

export interface RecurringTransaction {
  id: number;
  kid_id: number;
  type: 'credit' | 'debit';
  category: string;
  amount: number;
  description: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  day_of_week: number | null;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
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
  want_by_date: string | null;
  sort_order: number;
}

export interface GoalProjection {
  goal_id: number;
  name: string;
  target_amount: number | null;
  current_amount: number;
  remaining: number;
  want_by_date: string | null;
  expected_date: string | null;
  on_track: boolean;
  shortfall: number;
  sort_order: number;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface KidUser {
  id: number;
  email: string;
  display_name: string;
  kid_id: number;
  kid_name?: string;
}

export interface ChoreTemplate {
  id: number;
  user_id: number;
  title: string;
  description: string;
  amount: number | null;
  frequency: string | null;
  day_of_week: number | null;
  day_of_month: number | null;
  assigned_kid_id: number | null;
  assigned_kid_name?: string;
  start_date: string;
  end_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ChoreInstance {
  id: number;
  chore_template_id: number | null;
  kid_id: number | null;
  claimed_by_kid_id: number | null;
  title: string;
  description: string;
  amount: number | null;
  due_date: string;
  status: string;
  completed_at: string | null;
  verified_at: string | null;
  transaction_id: number | null;
  created_at: string;
  kid_name?: string;
  claimed_by_name?: string;
}

export interface ShoppingList {
  id: number;
  user_id: number;
  name: string;
  item_count?: number;
  unpurchased_count?: number;
  unpurchased_items?: string[];
  purchased_items?: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  id: number;
  list_id: number;
  description: string;
  is_purchased: number;
  added_by_user_id: number;
  added_by_name?: string;
  is_request: number;
  quantity: string;
  notes: string;
  purchased_at: string | null;
  created_at: string;
}
