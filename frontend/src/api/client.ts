import type { User, Kid, Transaction, AllowanceRule, SavingsGoal, Pagination } from '../types';

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
export function getTransactions(kidId: number, params?: { type?: string; category?: string; from?: string; to?: string; page?: number; per_page?: number }) {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.category) query.set('category', params.category);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.page) query.set('page', String(params.page));
  if (params?.per_page) query.set('per_page', String(params.per_page));
  const qs = query.toString();
  return apiClient.get<{ transactions: Transaction[]; pagination: Pagination }>(`/kids/${kidId}/transactions${qs ? '?' + qs : ''}`);
}

export function createTransaction(kidId: number, data: { type: string; category?: string; amount: number; description?: string; transaction_date?: string }) {
  return apiClient.post<{ transaction: Transaction }>(`/kids/${kidId}/transactions`, data);
}

export function updateTransaction(id: number, data: { type?: string; category?: string; amount?: number; description?: string; transaction_date?: string }) {
  return apiClient.put<{ transaction: Transaction }>(`/transactions/${id}`, data);
}

export function deleteTransaction(id: number) {
  return apiClient.delete<void>(`/transactions/${id}`);
}

// Allowances
export function getAllowance(kidId: number) {
  return apiClient.get<{ allowance: AllowanceRule | null }>(`/kids/${kidId}/allowance`);
}

export function setAllowance(kidId: number, data: { amount: number; frequency: string; day_of_week?: number; day_of_month?: number }) {
  return apiClient.post<{ allowance: AllowanceRule }>(`/kids/${kidId}/allowance`, data);
}

export function removeAllowance(kidId: number) {
  return apiClient.delete<void>(`/kids/${kidId}/allowance`);
}

export function processAllowances() {
  return apiClient.post<{ processed: { kid_name: string; amount: number }[]; count: number }>('/allowances/process');
}

// Goals
export function getGoals(kidId: number) {
  return apiClient.get<{ goals: SavingsGoal[] }>(`/kids/${kidId}/goals`);
}

export function createGoal(kidId: number, data: { name: string; target_amount?: number | null }) {
  return apiClient.post<{ goal: SavingsGoal }>(`/kids/${kidId}/goals`, data);
}

export function updateGoal(id: number, data: { name?: string; target_amount?: number | null }) {
  return apiClient.put<{ goal: SavingsGoal }>(`/goals/${id}`, data);
}

export function deleteGoal(id: number) {
  return apiClient.delete<void>(`/goals/${id}`);
}

export function depositToGoal(id: number, amount: number) {
  return apiClient.post<{ goal: SavingsGoal }>(`/goals/${id}/deposit`, { amount });
}

export function withdrawFromGoal(id: number, amount: number) {
  return apiClient.post<{ goal: SavingsGoal }>(`/goals/${id}/withdraw`, { amount });
}

// Dashboard
export function getDashboard() {
  return apiClient.get<{ kids: Kid[]; recent_transactions: Transaction[] }>('/dashboard');
}
