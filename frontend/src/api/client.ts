import type { User, Kid, Transaction, RecurringTransaction, SavingsGoal, GoalProjection, Pagination, KidUser, ChoreTemplate, ChoreInstance, ShoppingList, ShoppingListItem } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || err.error || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// Auth
export function login(email: string, password: string) {
  return apiClient.post<{ token: string; user: User }>('/auth/login', { email, password });
}

export function register(email: string, password: string, display_name: string) {
  return apiClient.post<{ token: string; user: User }>('/auth/register', { email, password, display_name });
}

export function getMe() {
  return apiClient.get<{ user: User }>('/auth/me');
}

// Kid Logins
export function createKidLogin(data: { kid_id: number; email: string; password: string; display_name?: string }) {
  return apiClient.post<{ kid_user: KidUser }>('/auth/kid-login', data);
}

export function getKidUsers() {
  return apiClient.get<{ kid_users: KidUser[] }>('/auth/kid-users');
}

export function updateKidLogin(id: number, data: { password?: string; display_name?: string }) {
  return apiClient.put<{ kid_user: KidUser }>(`/auth/kid-login/${id}`, data);
}

export function deleteKidLogin(id: number) {
  return apiClient.delete<void>(`/auth/kid-login/${id}`);
}

// Kids
export function getKids() {
  return apiClient.get<{ kids: Kid[] }>('/kids');
}

export function createKid(data: { name: string; color?: string; avatar?: string }) {
  return apiClient.post<{ kid: Kid }>('/kids', data);
}

export function getKid(id: number) {
  return apiClient.get<{ kid: Kid }>(`/kids/${id}`);
}

export function updateKid(id: number, data: { name?: string; color?: string; avatar?: string }) {
  return apiClient.put<{ kid: Kid }>(`/kids/${id}`, data);
}

export function deleteKid(id: number) {
  return apiClient.delete<void>(`/kids/${id}`);
}

// Transactions
export function getTransactions(kidId: number, params?: { type?: string; category?: string; status?: string; from?: string; to?: string; page?: number; per_page?: number }) {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.category) query.set('category', params.category);
  if (params?.status) query.set('status', params.status);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.page) query.set('page', String(params.page));
  if (params?.per_page) query.set('per_page', String(params.per_page));
  const qs = query.toString();
  return apiClient.get<{ transactions: Transaction[]; date_balances: Record<string, number>; pagination: Pagination }>(`/kids/${kidId}/transactions${qs ? '?' + qs : ''}`);
}

export function createTransaction(kidId: number, data: { type: string; category?: string; amount: number; description?: string; transaction_date?: string; status?: string }) {
  return apiClient.post<{ transaction: Transaction }>(`/kids/${kidId}/transactions`, data);
}

export function updateTransaction(id: number, data: { type?: string; category?: string; amount?: number; description?: string; transaction_date?: string; status?: string }) {
  return apiClient.put<{ transaction: Transaction }>(`/transactions/${id}`, data);
}

export function deleteTransaction(id: number) {
  return apiClient.delete<void>(`/transactions/${id}`);
}

export function verifyTransaction(id: number) {
  return apiClient.post<{ transaction: Transaction }>(`/transactions/${id}/verify`);
}

export function cancelTransaction(id: number) {
  return apiClient.post<{ transaction: Transaction }>(`/transactions/${id}/cancel`);
}

export function verifyAllPending(kidId: number) {
  return apiClient.post<{ verified: number }>(`/kids/${kidId}/transactions/verify-all`);
}

// Recurring Transactions
export function getRecurring(kidId: number) {
  return apiClient.get<{ recurring: RecurringTransaction[] }>(`/kids/${kidId}/recurring`);
}

export function createRecurring(kidId: number, data: {
  type: string; category?: string; amount: number; description?: string;
  frequency: string; day_of_week?: number; day_of_month?: number;
  start_date?: string; end_date?: string;
}) {
  return apiClient.post<{ recurring: RecurringTransaction }>(`/kids/${kidId}/recurring`, data);
}

export function updateRecurring(id: number, data: {
  type?: string; category?: string; amount?: number; description?: string;
  frequency?: string; day_of_week?: number | null; day_of_month?: number | null;
  end_date?: string | null; is_active?: boolean;
}) {
  return apiClient.put<{ recurring: RecurringTransaction }>(`/recurring/${id}`, data);
}

export function deleteRecurring(id: number) {
  return apiClient.delete<void>(`/recurring/${id}`);
}

// Goals
export function getGoals(kidId: number) {
  return apiClient.get<{ goals: SavingsGoal[] }>(`/kids/${kidId}/goals`);
}

export function createGoal(kidId: number, data: { name: string; target_amount?: number | null; want_by_date?: string | null }) {
  return apiClient.post<{ goal: SavingsGoal }>(`/kids/${kidId}/goals`, data);
}

export function updateGoal(id: number, data: { name?: string; target_amount?: number | null; want_by_date?: string | null }) {
  return apiClient.put<{ goal: SavingsGoal }>(`/goals/${id}`, data);
}

export function deleteGoal(id: number) {
  return apiClient.delete<void>(`/goals/${id}`);
}

export function reorderGoals(kidId: number, goalIds: number[]) {
  return apiClient.put<{ goals: SavingsGoal[] }>(`/kids/${kidId}/goals/reorder`, { goal_ids: goalIds });
}

export function getGoalProjections(kidId: number) {
  return apiClient.get<{ projections: GoalProjection[] }>(`/kids/${kidId}/goals/projections`);
}


// Dashboard (parent)
export function getDashboard() {
  return apiClient.get<{
    kids: Kid[];
    recent_transactions: Transaction[];
    pending_transactions: Transaction[];
    overdue_chores: ChoreInstance[];
    completed_chores: ChoreInstance[];
    shopping_lists: ShoppingList[];
  }>('/dashboard');
}

// Kid Portal
export function getMyDashboard() {
  return apiClient.get<{
    kid: Kid;
    recurring: RecurringTransaction[];
    goals: SavingsGoal[];
    transactions: Transaction[];
    date_balances: Record<string, number>;
    pagination: Pagination;
  }>('/my/dashboard');
}

export function getMyTransactions(params?: { type?: string; category?: string; status?: string; from?: string; to?: string; page?: number; per_page?: number }) {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.category) query.set('category', params.category);
  if (params?.status) query.set('status', params.status);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.page) query.set('page', String(params.page));
  if (params?.per_page) query.set('per_page', String(params.per_page));
  const qs = query.toString();
  return apiClient.get<{ transactions: Transaction[]; date_balances: Record<string, number>; pagination: Pagination }>(`/my/transactions${qs ? '?' + qs : ''}`);
}

export function requestMoney(data: { amount: number; description: string; type?: string; category?: string }) {
  return apiClient.post<{ transaction: Transaction }>('/my/request', data);
}

// Chores (parent)
export function getChoreBoard() {
  return apiClient.get<{ templates: ChoreTemplate[]; instances: ChoreInstance[] }>('/chores');
}

export function createChore(data: {
  title: string; description?: string; amount?: number | null;
  frequency?: string | null; day_of_week?: number | null; day_of_month?: number | null;
  assigned_kid_id?: number | null; start_date?: string; end_date?: string | null;
}) {
  return apiClient.post<{ template: ChoreTemplate }>('/chores', data);
}

export function updateChore(id: number, data: Partial<{
  title: string; description: string; amount: number | null;
  frequency: string | null; day_of_week: number | null; day_of_month: number | null;
  assigned_kid_id: number | null; start_date: string; end_date: string | null; is_active: number;
}>) {
  return apiClient.put<{ template: ChoreTemplate }>(`/chores/${id}`, data);
}

export function deleteChore(id: number) {
  return apiClient.delete<void>(`/chores/${id}`);
}

export function getChoreInstances(params?: { status?: string; kid_id?: number; from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.kid_id) query.set('kid_id', String(params.kid_id));
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();
  return apiClient.get<{ instances: ChoreInstance[] }>(`/chores/instances${qs ? '?' + qs : ''}`);
}

export function verifyChore(id: number) {
  return apiClient.post<{ instance: ChoreInstance; transaction_id: number | null }>(`/chores/instances/${id}/verify`);
}

export function rejectChore(id: number) {
  return apiClient.post<{ instance: ChoreInstance }>(`/chores/instances/${id}/reject`);
}

// Chores (kid)
export function getMyChores() {
  return apiClient.get<{ my_chores: ChoreInstance[]; open_chores: ChoreInstance[] }>('/my/chores');
}

export function claimChore(id: number) {
  return apiClient.post<{ instance: ChoreInstance }>(`/my/chores/${id}/claim`);
}

export function completeChore(id: number) {
  return apiClient.post<{ instance: ChoreInstance }>(`/my/chores/${id}/complete`);
}

// Shopping
export function getShoppingLists() {
  return apiClient.get<{ lists: ShoppingList[] }>('/shopping/lists');
}

export function createShoppingList(data: { name: string }) {
  return apiClient.post<{ list: ShoppingList }>('/shopping/lists', data);
}

export function updateShoppingList(id: number, data: { name: string }) {
  return apiClient.put<{ list: ShoppingList }>(`/shopping/lists/${id}`, data);
}

export function deleteShoppingList(id: number) {
  return apiClient.delete<void>(`/shopping/lists/${id}`);
}

export function getShoppingItems(listId: number) {
  return apiClient.get<{ items: ShoppingListItem[]; list: ShoppingList }>(`/shopping/lists/${listId}/items`);
}

export function addShoppingItem(listId: number, data: { description: string; quantity?: string; notes?: string }) {
  return apiClient.post<{ item: ShoppingListItem }>(`/shopping/lists/${listId}/items`, data);
}

export function updateShoppingItem(id: number, data: { description?: string; quantity?: string; notes?: string }) {
  return apiClient.put<{ item: ShoppingListItem }>(`/shopping/items/${id}`, data);
}

export function toggleShoppingItem(id: number) {
  return apiClient.post<{ item: ShoppingListItem }>(`/shopping/items/${id}/toggle`);
}

export function deleteShoppingItem(id: number) {
  return apiClient.delete<void>(`/shopping/items/${id}`);
}

export function autocompleteShoppingItem(query: string) {
  return apiClient.get<{ suggestions: string[] }>(`/shopping/autocomplete?q=${encodeURIComponent(query)}`);
}
