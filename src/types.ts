export enum AccountType {
  CHECKING = 'Checking',
  SAVINGS = 'Savings',
  CREDIT_CARD = 'Credit Card',
  INVESTMENT = 'Investment',
  LOAN = 'Loan',
  CASH = 'Cash',
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  // Bank account specific fields
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  // Credit Card specific fields
  statementBalance?: number;
  minPayment?: number;
  dueDate?: string; // ISO String
}

export enum TransactionType {
  INCOME = 'Income',
  EXPENSE = 'Expense',
  TRANSFER = 'Transfer',
}

export interface Transaction {
  id: string;
  date: string; // ISO string
  description: string;
  notes?: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  toAccountId?: string; // For transfers
  tags?: string[];
  receiptImage?: string; // base64 encoded image
}

export interface Category {
  id:string;
  name: string;
  type: TransactionType.INCOME | TransactionType.EXPENSE;
  icon: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  period: 'monthly'; // Could be extended later
}

export interface Currency {
    code: string;
    name: "US Dollar" | "Euro" | "Japanese Yen" | "British Pound" | "Swiss Franc" | "Canadian Dollar" | "Australian Dollar" | "Indian Rupee";
    symbol: string;
}

export enum InvestmentType {
    STOCK = 'Stock',
    MUTUAL_FUND = 'Mutual Fund',
}

export interface Investment {
    id: string;
    name: string;
    type: InvestmentType;
    units: number;
    purchasePrice: number;
    currentPrice: number;
    purchaseDate: string; // ISO string
}

export enum SavingsType {
    FD = 'Fixed Deposit',
    RD = 'Recurring Deposit',
}

export interface SavingsInstrument {
    id: string;
    type: SavingsType;
    bankName: string;
    accountNumber: string;
    principal: number; // For RD, this is the monthly installment
    interestRate: number;
    depositDate: string; // ISO string
    maturityDate: string; // ISO string;
    maturityAmount?: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // ISO string
}

export interface AssetCategory {
  id: string;
  name: string;
  icon: string;
}

export interface Asset {
    id: string;
    name: string;
    description?: string;
    purchasePrice: number;
    purchaseDate: string; // ISO string
    categoryId: string;
    imageUrl?: string; // base64 or external url
    productUrl?: string;
    purchaseLocation?: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'yearly';
  nextPaymentDate: string; // ISO string
  categoryId: string;
}

export interface NetWorthHistoryEntry {
    date: string; // YYYY-MM-DD
    value: number;
}

export type View = 'DASHBOARD' | 'ACCOUNTS' | 'TRANSACTIONS' | 'BUDGETS' | 'INSIGHTS' | 'SETTINGS' | 'INVESTMENTS' | 'SAVINGS' | 'GOALS' | 'ASSETS' | 'SUBSCRIPTIONS' | 'REPORTS';

export type DashboardCard = 'NET_WORTH' | 'MONTHLY_SUMMARY' | 'SPENDING_CATEGORY' | 'RECENT_TRANSACTIONS' | 'BUDGET_STATUS';