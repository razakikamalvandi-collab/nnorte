import { supabase } from './supabase';
import { Expense, ExpenseCategory } from '../types';

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  bahan_baku: 'Bahan Baku',
  gaji: 'Gaji & Tenaga Kerja',
  utilitas: 'Utilitas',
  sewa: 'Sewa',
  pemasaran: 'Pemasaran',
  perawatan: 'Perawatan',
  lainnya: 'Lainnya',
};

interface ExpenseDb {
  id: string;
  branch_id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: number | string;
}

const map = (r: ExpenseDb): Expense => ({
  id: r.id,
  branchId: r.branch_id,
  date: r.expense_date,
  category: r.category,
  description: r.description,
  amount: Number(r.amount),
});

export async function listExpenses(branchId: string, from: string, to: string): Promise<Expense[]> {
  let q = supabase
    .from('expenses')
    .select('id,branch_id,expense_date,category,description,amount')
    .gte('expense_date', from)
    .lte('expense_date', to)
    .order('expense_date', { ascending: false })
    .limit(500);
  if (branchId !== 'all') q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as ExpenseDb[]).map(map);
}

export async function createExpense(restaurantId: string, e: Omit<Expense, 'id'>): Promise<void> {
  const { error } = await supabase.from('expenses').insert({
    restaurant_id: restaurantId,
    branch_id: e.branchId,
    expense_date: e.date,
    category: e.category,
    description: e.description.trim(),
    amount: e.amount,
  });
  if (error) throw new Error(error.message);
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
