
import React, { useState, useEffect, useCallback, useMemo, createContext, useContext, useRef } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Account, AccountType, Transaction, TransactionType, Category, Budget, View, Investment, SavingsInstrument, Goal, Asset, AssetCategory, Subscription, NetWorthHistoryEntry, DashboardCard, InvestmentType, SavingsType } from './types';
import { CURRENCIES, DEFAULT_CATEGORIES, ICONS, DEFAULT_ASSET_CATEGORIES, allNavItems, mainNavItems, moreNavItems, NavItemDef, dashboardCardDefs } from './constants';
import { suggestCategory, processReceiptImage, getFinancialInsights, generateFinancialReport, findSubscriptions, fetchProductDetailsFromUrl, analyzePortfolio } from './services/geminiService';

// UTILITY FUNCTIONS
const classNames = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');
const generateId = () => Math.random().toString(36).substring(2, 9);
const formatDate = (isoString?: string | Date) => {
    if (!isoString) return 'N/A';
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const formatInputDate = (date?: string | Date) => {
    if (!date) return new Date().toISOString().split('T')[0];
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    return d.toISOString().split('T')[0];
};
const formatCurrency = (amount: number, currencyCode: string) => {
  const currency = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[7]; // Default to INR
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};
const formatGroupDate = (dateString: string) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const date = new Date(dateString);
    date.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone shifts from date string
    
    today.setUTCHours(0, 0, 0, 0);
    yesterday.setUTCHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
        return 'Today';
    }
    if (date.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

// LOCAL STORAGE HOOK
function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

// APP CONTEXT
interface AppContextType {
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  budgets: Budget[];
  setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>;
  investments: Investment[];
  setInvestments: React.Dispatch<React.SetStateAction<Investment[]>>;
  savings: SavingsInstrument[];
  setSavings: React.Dispatch<React.SetStateAction<SavingsInstrument[]>>;
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  assetCategories: AssetCategory[];
  setAssetCategories: React.Dispatch<React.SetStateAction<AssetCategory[]>>;
  subscriptions: Subscription[];
  setSubscriptions: React.Dispatch<React.SetStateAction<Subscription[]>>;
  netWorthHistory: NetWorthHistoryEntry[];
  primaryCurrency: string;
  setPrimaryCurrency: React.Dispatch<React.SetStateAction<string>>;
  bottomNavViews: View[];
  setBottomNavViews: React.Dispatch<React.SetStateAction<View[]>>;
  dashboardCards: { [key in DashboardCard]?: boolean };
  setDashboardCards: React.Dispatch<React.SetStateAction<{ [key in DashboardCard]?: boolean }>>;
  getCategoryById: (id: string) => Category | undefined;
  getAccountById: (id: string) => Account | undefined;
  getAssetCategoryById: (id: string) => AssetCategory | undefined;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
  addInvestment: (investment: Omit<Investment, 'id'>) => void;
  updateInvestment: (investment: Investment) => void;
  deleteInvestment: (id: string) => void;
  addSaving: (saving: Omit<SavingsInstrument, 'id'>) => void;
  updateSaving: (saving: SavingsInstrument) => void;
  deleteSaving: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'currentAmount'>) => void;
  updateGoal: (goal: Goal) => void;
  deleteGoal: (id: string) => void;
  makeGoalContribution: (goalId: string, amount: number, fromAccountId: string) => void;
  addAsset: (asset: Omit<Asset, 'id'>) => void;
  updateAsset: (asset: Asset) => void;
  deleteAsset: (id: string) => void;
  addSubscription: (subscription: Omit<Subscription, 'id'>) => void;
  updateSubscription: (subscription: Subscription) => void;
  deleteSubscription: (id: string) => void;
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (budget: Budget) => void;
  deleteBudget: (id: string) => void;
  addAssetCategory: (category: Omit<AssetCategory, 'id'>) => void;
  updateAssetCategory: (category: AssetCategory) => void;
  deleteAssetCategory: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useLocalStorage<Account[]>('finansage_accounts', []);
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('finansage_transactions', []);
  const [categories, setCategories] = useLocalStorage<Category[]>('finansage_categories', []);
  const [budgets, setBudgets] = useLocalStorage<Budget[]>('finansage_budgets', []);
  const [investments, setInvestments] = useLocalStorage<Investment[]>('finansage_investments', []);
  const [savings, setSavings] = useLocalStorage<SavingsInstrument[]>('finansage_savings', []);
  const [goals, setGoals] = useLocalStorage<Goal[]>('finansage_goals', []);
  const [assets, setAssets] = useLocalStorage<Asset[]>('finansage_assets', []);
  const [assetCategories, setAssetCategories] = useLocalStorage<AssetCategory[]>('finansage_asset_categories', []);
  const [subscriptions, setSubscriptions] = useLocalStorage<Subscription[]>('finansage_subscriptions', []);
  const [netWorthHistory, setNetWorthHistory] = useLocalStorage<NetWorthHistoryEntry[]>('finansage_netWorthHistory', []);
  const [primaryCurrency, setPrimaryCurrency] = useLocalStorage<string>('finansage_primaryCurrency', 'INR');
  const [bottomNavViews, setBottomNavViews] = useLocalStorage<View[]>('finansage_bottomNavViews', ['DASHBOARD', 'TRANSACTIONS', 'ACCOUNTS', 'ASSETS']);

  const initialDashboardCards: { [key in DashboardCard]: boolean } = {
      NET_WORTH: true,
      MONTHLY_SUMMARY: true,
      SPENDING_CATEGORY: true,
      RECENT_TRANSACTIONS: true,
      BUDGET_STATUS: true,
  };
  const [dashboardCards, setDashboardCards] = useLocalStorage<{ [key in DashboardCard]?: boolean }>('finansage_dashboardCards', initialDashboardCards);

  const getCategoryById = useCallback((id: string) => categories.find(c => c.id === id), [categories]);

  useEffect(() => {
    if (categories.length === 0) {
      setCategories(DEFAULT_CATEGORIES.map(c => ({ ...c, id: generateId() })));
    } else {
      const neededCategories: Omit<Category, 'id'>[] = [
        { name: 'Goal Contributions', type: TransactionType.EXPENSE, icon: 'goal' },
        { name: 'Subscriptions', type: TransactionType.EXPENSE, icon: 'subscriptions' },
      ];
      neededCategories.forEach(neededCat => {
        if (!categories.some(c => c.name === neededCat.name)) {
            setCategories(prev => [...prev, { id: generateId(), ...neededCat }]);
        }
      });
    }
    if (assetCategories.length === 0) {
        setAssetCategories(DEFAULT_ASSET_CATEGORIES.map(ac => ({...ac, id: generateId()})))
    }
  }, [categories, setCategories, assetCategories, setAssetCategories]);
  
  // Effect for Net Worth History
  useEffect(() => {
      const today = new Date().toISOString().split('T')[0];
      const newNetWorth = accounts.reduce((sum, acc) => {
          const multiplier = acc.type === AccountType.LOAN || acc.type === AccountType.CREDIT_CARD ? -1 : 1;
          const balance = Number(acc.balance) || 0; // Sanitize balance
          return sum + (balance * multiplier);
      }, 0);

      setNetWorthHistory(prevHistory => {
          const todayEntryIndex = prevHistory.findIndex(entry => entry.date === today);
          let updatedHistory = [...prevHistory];

          if (todayEntryIndex > -1) {
              updatedHistory[todayEntryIndex] = { date: today, value: newNetWorth };
          } else {
              updatedHistory.push({ date: today, value: newNetWorth });
          }
          
          updatedHistory.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          if (updatedHistory.length > 90) {
              updatedHistory = updatedHistory.slice(updatedHistory.length - 90);
          }
          
          return updatedHistory;
      });
  }, [accounts, setNetWorthHistory]);

  const getAccountById = useCallback((id: string) => accounts.find(a => a.id === id), [accounts]);
  const getAssetCategoryById = useCallback((id: string) => assetCategories.find(c => c.id === id), [assetCategories]);

  const addTransaction = (transactionData: Omit<Transaction, 'id'>) => {
      const newTransaction = { ...transactionData, id: generateId() };
      setTransactions(prev => [newTransaction, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setAccounts(prevAccounts => prevAccounts.map(acc => {
          if (acc.id === newTransaction.accountId) {
              const newBalance = newTransaction.type === TransactionType.INCOME ? acc.balance + newTransaction.amount : acc.balance - newTransaction.amount;
              return { ...acc, balance: newBalance };
          }
          if (newTransaction.type === TransactionType.TRANSFER && acc.id === newTransaction.toAccountId) {
              return { ...acc, balance: acc.balance + newTransaction.amount };
          }
          return acc;
      }));
  };

  const updateTransaction = (updatedTransaction: Transaction) => {
    const originalTransaction = transactions.find(t => t.id === updatedTransaction.id);
    if (!originalTransaction) return;

    setTransactions(prev => prev.map(t => t.id === updatedTransaction.id ? updatedTransaction : t).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    setAccounts(prevAccounts => {
        let newAccounts = [...prevAccounts];
        // Revert original transaction effect
        const fromAccountOld = newAccounts.find(a => a.id === originalTransaction.accountId);
        if (fromAccountOld) {
            fromAccountOld.balance += originalTransaction.type === TransactionType.INCOME ? -originalTransaction.amount : originalTransaction.amount;
        }
        if(originalTransaction.type === TransactionType.TRANSFER && originalTransaction.toAccountId) {
            const toAccountOld = newAccounts.find(a => a.id === originalTransaction.toAccountId);
            if(toAccountOld) toAccountOld.balance -= originalTransaction.amount;
        }

        // Apply new transaction effect
        const fromAccountNew = newAccounts.find(a => a.id === updatedTransaction.accountId);
        if (fromAccountNew) {
            fromAccountNew.balance += updatedTransaction.type === TransactionType.INCOME ? updatedTransaction.amount : -updatedTransaction.amount;
        }
        if(updatedTransaction.type === TransactionType.TRANSFER && updatedTransaction.toAccountId) {
            const toAccountNew = newAccounts.find(a => a.id === updatedTransaction.toAccountId);
            if(toAccountNew) toAccountNew.balance += updatedTransaction.amount;
        }

        return newAccounts;
    });
  };

  const deleteTransaction = (id: string) => {
      const transactionToDelete = transactions.find(t => t.id === id);
      if (!transactionToDelete) return;
      setTransactions(prev => prev.filter(t => t.id !== id));
      setAccounts(prevAccounts => prevAccounts.map(acc => {
          if (acc.id === transactionToDelete.accountId) {
              const newBalance = transactionToDelete.type === TransactionType.INCOME ? acc.balance - transactionToDelete.amount : acc.balance + transactionToDelete.amount;
              return { ...acc, balance: newBalance };
          }
           if (transactionToDelete.type === TransactionType.TRANSFER && acc.id === transactionToDelete.toAccountId) {
              return { ...acc, balance: acc.balance - transactionToDelete.amount };
          }
          return acc;
      }));
  };
  
  const addAccount = (accountData: Omit<Account, 'id'>) => setAccounts(prev => [...prev, { ...accountData, id: generateId() }].sort((a,b) => a.name.localeCompare(b.name)));
  const updateAccount = (updatedAccount: Account) => setAccounts(prev => prev.map(a => a.id === updatedAccount.id ? updatedAccount : a).sort((a,b) => a.name.localeCompare(b.name)));
  const deleteAccount = (id: string) => {
      if (transactions.some(t => t.accountId === id || t.toAccountId === id)) {
          alert("Cannot delete account with existing transactions. Please delete or re-assign transactions first.");
          return;
      }
      setAccounts(prev => prev.filter(a => a.id !== id));
  };
  
  const addCategory = (categoryData: Omit<Category, 'id'>) => setCategories(prev => [...prev, {...categoryData, id: generateId()}].sort((a,b) => a.name.localeCompare(b.name)));
  const updateCategory = (updatedCategory: Category) => setCategories(prev => prev.map(c => c.id === updatedCategory.id ? updatedCategory : c).sort((a,b) => a.name.localeCompare(b.name)));
  const deleteCategory = (id: string) => {
      if(transactions.some(t => t.categoryId === id)){
          alert("Cannot delete category with existing transactions. Please delete or re-assign transactions first.");
          return;
      }
      if(budgets.some(b => b.categoryId === id)){
          alert("Cannot delete category with an associated budget. Please remove the budget first.");
          return;
      }
      setCategories(prev => prev.filter(c => c.id !== id));
  }

  const addInvestment = (data: Omit<Investment, 'id'>) => setInvestments(prev => [...prev, { ...data, id: generateId() }]);
  const updateInvestment = (data: Investment) => setInvestments(prev => prev.map(i => i.id === data.id ? data : i));
  const deleteInvestment = (id: string) => setInvestments(prev => prev.filter(i => i.id !== id));

  const addSaving = (data: Omit<SavingsInstrument, 'id'>) => setSavings(prev => [...prev, { ...data, id: generateId() }]);
  const updateSaving = (data: SavingsInstrument) => setSavings(prev => prev.map(s => s.id === data.id ? data : s));
  const deleteSaving = (id: string) => setSavings(prev => prev.filter(s => s.id !== id));

  const addGoal = (goalData: Omit<Goal, 'id' | 'currentAmount'>) => setGoals(prev => [...prev, { ...goalData, id: generateId(), currentAmount: 0 }]);
  const updateGoal = (updatedGoal: Goal) => setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
  const deleteGoal = (id: string) => setGoals(prev => prev.filter(g => g.id !== id));
  
  const makeGoalContribution = (goalId: string, amount: number, fromAccountId: string) => {
    const goal = goals.find(g => g.id === goalId);
    const goalCategory = categories.find(c => c.name === 'Goal Contributions');
    if (!goal || !goalCategory) {
      alert("Error: Goal or goal category not found.");
      return;
    }
    addTransaction({
        date: new Date().toISOString(),
        description: `Contribution to goal: ${goal.name}`,
        notes: '',
        amount,
        type: TransactionType.EXPENSE,
        accountId: fromAccountId,
        categoryId: goalCategory.id,
    });
    setGoals(prevGoals => prevGoals.map(g => g.id === goalId ? { ...g, currentAmount: g.currentAmount + amount } : g));
  };

  const addAsset = (data: Omit<Asset, 'id'>) => setAssets(prev => [{...data, id: generateId()}, ...prev]);
  const updateAsset = (data: Asset) => setAssets(prev => prev.map(a => a.id === data.id ? data : a));
  const deleteAsset = (id: string) => setAssets(prev => prev.filter(a => a.id !== id));

  const addSubscription = (data: Omit<Subscription, 'id'>) => setSubscriptions(prev => [...prev, { ...data, id: generateId() }]);
  const updateSubscription = (data: Subscription) => setSubscriptions(prev => prev.map(s => s.id === data.id ? data : s));
  const deleteSubscription = (id: string) => setSubscriptions(prev => prev.filter(s => s.id !== id));

  const addBudget = (data: Omit<Budget, 'id'>) => setBudgets(prev => [...prev, { ...data, id: generateId() }].sort((a,b) => (getCategoryById(a.categoryId)?.name || '').localeCompare(getCategoryById(b.categoryId)?.name || '')));
  const updateBudget = (data: Budget) => setBudgets(prev => prev.map(b => b.id === data.id ? data : b).sort((a,b) => (getCategoryById(a.categoryId)?.name || '').localeCompare(getCategoryById(b.categoryId)?.name || '')));
  const deleteBudget = (id: string) => setBudgets(prev => prev.filter(b => b.id !== id));
  
  const addAssetCategory = (data: Omit<AssetCategory, 'id'>) => setAssetCategories(prev => [...prev, { ...data, id: generateId() }].sort((a,b) => a.name.localeCompare(b.name)));
  const updateAssetCategory = (data: AssetCategory) => setAssetCategories(prev => prev.map(c => c.id === data.id ? data : c).sort((a,b) => a.name.localeCompare(b.name)));
  const deleteAssetCategory = (id: string) => {
      if (assets.some(a => a.categoryId === id)) {
          alert("Cannot delete category with associated assets.");
          return;
      }
      setAssetCategories(prev => prev.filter(c => c.id !== id));
  };

  const value = {
    accounts, setAccounts,
    transactions, setTransactions,
    categories, setCategories,
    budgets, setBudgets,
    investments, setInvestments,
    savings, setSavings,
    goals, setGoals,
    assets, setAssets,
    assetCategories, setAssetCategories,
    subscriptions, setSubscriptions,
    netWorthHistory,
    primaryCurrency, setPrimaryCurrency,
    bottomNavViews, setBottomNavViews,
    dashboardCards, setDashboardCards,
    getCategoryById, getAccountById, getAssetCategoryById,
    addTransaction, updateTransaction, deleteTransaction,
    addAccount, updateAccount, deleteAccount,
    addCategory, updateCategory, deleteCategory,
    addInvestment, updateInvestment, deleteInvestment,
    addSaving, updateSaving, deleteSaving,
    addGoal, updateGoal, deleteGoal, makeGoalContribution,
    addAsset, updateAsset, deleteAsset,
    addSubscription, updateSubscription, deleteSubscription,
    addBudget, updateBudget, deleteBudget,
    addAssetCategory, updateAssetCategory, deleteAssetCategory
  };
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useFinance = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useFinance must be used within an AppProvider");
    return context;
};

// UI COMPONENTS
const Card: React.FC<{ children: React.ReactNode, className?: string, hasGlow?: boolean, animate?: boolean, style?: React.CSSProperties }> = ({ children, className, hasGlow, animate=false, style }) => (
    <div style={style} className={classNames(
        "relative bg-base-200/50 backdrop-blur-sm border border-base-300 rounded-2xl shadow-lg overflow-hidden",
        animate && 'animate-list-item-in',
        className
    )}>
        {hasGlow && <div aria-hidden="true" className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-[150%] bg-gradient-radial from-glow-start to-glow-end animate-pulse duration-[5000ms]"></div>}
        <div className="relative z-10 p-5 h-full">
            {children}
        </div>
    </div>
);

const Button: React.FC<{
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}> = ({ children, onClick, className, variant = 'primary', type = 'button', disabled = false }) => {
  const baseClasses = "relative px-4 py-2 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-100 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.03] overflow-hidden";
  const variantClasses = {
    primary: 'bg-brand-primary text-black hover:bg-brand-secondary focus:ring-brand-primary font-bold',
    secondary: 'bg-base-200/70 text-content-100 hover:bg-base-200 focus:ring-content-200',
    danger: 'bg-accent-error/80 text-white hover:bg-accent-error focus:ring-red-500',
  };
  const shimmerClass = "after:content-[''] after:absolute after:inset-0 after:bg-white/20 after:transition-transform after:duration-500 after:ease-in-out after:transform after:-translate-x-[150%] hover:after:translate-x-[150%]";

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classNames(baseClasses, variantClasses[variant], variant === 'primary' && shimmerClass, className)}>
      {children}
    </button>
  );
};

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-base-200/80 border border-base-300 backdrop-blur-lg rounded-2xl shadow-2xl w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-base-300">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-content-200 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const BottomSheet: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end animate-fade-in md:hidden" onClick={onClose}>
      <div 
        className="bg-base-200 w-full rounded-t-2xl shadow-2xl animate-slide-up-sheet" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-base-300 rounded-full"></div>
        </div>
        <div className="flex justify-between items-center px-4 pb-2 border-b border-base-300">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-content-200 hover:text-white text-3xl leading-none w-8 h-8 flex items-center justify-center">&times;</button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const SkeletonLoader: React.FC<{ className?: string }> = ({ className }) => {
    return <div className={classNames('animate-skeleton-loading rounded-md', className)} />;
};

const FileInputButton: React.FC<{ onFileSelect: (base64: string, file: File) => void; children: React.ReactNode; capture?: 'user' | 'environment'; }> = ({ onFileSelect, children, capture }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const base64 = await fileToBase64(file);
                onFileSelect(base64, file);
            } catch (error) {
                console.error("Error converting file to base64", error);
                alert("Could not read file. Please try another one.");
            }
        }
        // Reset input value to allow selecting the same file again
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };
    return (
        <>
            <input 
                type="file" 
                accept="image/*" 
                capture={capture} 
                ref={inputRef} 
                onChange={handleFileChange} 
                className="hidden" 
            />
            <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                {children}
            </Button>
        </>
    );
};

const CustomDatePicker: React.FC<{
    value: string;
    onChange: (date: string) => void;
}> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'days' | 'years'>('days');
    const [currentDate, setCurrentDate] = useState(value ? new Date(value) : new Date());
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedDate = value ? new Date(value) : null;
    
    const changeMonth = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };
    
    const changeYear = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setFullYear(newDate.getFullYear() + offset);
            return newDate;
        });
    }

    const handleDayClick = (day: number) => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        onChange(formatInputDate(newDate));
        setIsOpen(false);
    };
    
    const handleYearClick = (year: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setFullYear(year);
            return newDate;
        });
        setView('days');
    };

    const renderDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const blanks = Array(firstDayOfMonth).fill(null);
        const dayCells = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        return (
            <>
                <div className="flex justify-between items-center mb-4">
                    <button type="button" onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-base-300">{ICONS['chevron-left']}</button>
                    <div onClick={() => setView('years')} className="font-bold text-white cursor-pointer hover:text-brand-gradient-to">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </div>
                    <button type="button" onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-base-300">{ICONS['chevron-right']}</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-content-200">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="w-8">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 mt-2">
                    {blanks.map((_, i) => <div key={`blank-${i}`}></div>)}
                    {dayCells.map(day => {
                        const isSelected = selectedDate && selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
                        return (
                            <button
                                type="button"
                                key={day}
                                onClick={() => handleDayClick(day)}
                                className={classNames(
                                    "h-8 w-8 rounded-full transition-colors duration-200 flex items-center justify-center",
                                    isSelected ? "bg-brand-primary text-black font-bold" : "text-white hover:bg-base-300"
                                )}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
            </>
        )
    };
    
    const renderYears = () => {
        const currentYear = currentDate.getFullYear();
        const startYear = Math.floor(currentYear / 10) * 10 - 1;

        return (
             <>
                <div className="flex justify-between items-center mb-4">
                    <button type="button" onClick={() => changeYear(-10)} className="p-1 rounded-full hover:bg-base-300">{ICONS['chevron-left']}</button>
                    <div className="font-bold text-white">
                        {startYear + 1} - {startYear + 10}
                    </div>
                    <button type="button" onClick={() => changeYear(10)} className="p-1 rounded-full hover:bg-base-300">{ICONS['chevron-right']}</button>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                    {Array.from({length: 12}, (_, i) => startYear + i).map(year => (
                         <button
                            type="button"
                            key={year}
                            onClick={() => handleYearClick(year)}
                            className={classNames(
                                "p-2 rounded-lg transition-colors duration-200",
                                year === currentYear ? "bg-brand-primary text-black font-bold" : "text-white hover:bg-base-300"
                            )}
                        >
                            {year}
                        </button>
                    ))}
                </div>
            </>
        )
    }

    const inputClasses = "w-full bg-base-100/50 p-3 rounded-lg text-white border border-base-300 focus:ring-2 focus:ring-brand-gradient-to focus:border-transparent";

    return (
        <div className="relative" ref={pickerRef}>
            <input
                type="text"
                readOnly
                value={formatDate(value)}
                onClick={() => setIsOpen(p => !p)}
                className={classNames(inputClasses, "cursor-pointer")}
            />
            {isOpen && (
                 <div className="absolute top-full mt-2 w-72 bg-base-200/90 backdrop-blur-md border border-base-300 rounded-xl shadow-2xl p-4 z-50 animate-slide-up">
                    {view === 'days' ? renderDays() : renderYears()}
                 </div>
            )}
        </div>
    );
};


const FloatingActionButton: React.FC<{
  onAddManually: () => void;
  onScanReceipt: () => void;
  className?: string;
}> = ({ onAddManually, onScanReceipt, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={fabRef} className={classNames("fixed bottom-24 right-6 md:bottom-8 z-40", className)}>
      {isOpen && (
        <div className="flex flex-col items-center mb-4 space-y-3">
          <button
            onClick={() => { onScanReceipt(); setIsOpen(false); }}
            className="w-14 h-14 bg-base-200/80 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-white hover:bg-base-300 transition-all transform hover:scale-110"
            title="Scan Receipt"
          >
            {ICONS.scan}
          </button>
          <button
            onClick={() => { onAddManually(); setIsOpen(false); }}
            className="w-14 h-14 bg-base-200/80 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-white hover:bg-base-300 transition-all transform hover:scale-110"
            title="Add Manually"
          >
            {ICONS.edit}
          </button>
        </div>
      )}
      <button
        onClick={() => setIsOpen(p => !p)}
        className="w-16 h-16 bg-brand-gradient from-brand-gradient-from to-brand-gradient-to rounded-full shadow-lg flex items-center justify-center text-white text-3xl hover:bg-brand-secondary transition-all transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-100 focus:ring-brand-primary"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className={classNames("transition-transform duration-300 w-6 h-6 flex items-center justify-center", isOpen ? "rotate-45" : "rotate-0")}>{ICONS.plus}</span>
      </button>
    </div>
  );
};

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const renderSegment = (segment: string, key: number) => {
        if (segment.startsWith('**') && segment.endsWith('**')) {
            return <strong key={key}>{segment.slice(2, -2)}</strong>;
        }
        return <span key={key}>{segment}</span>;
    };

    const renderLine = (line: string, index: number) => {
        if (line.startsWith('## ')) return <h3 key={index} className="text-xl font-bold mt-4 mb-2">{line.substring(3)}</h3>;
        if (line.startsWith('### ')) return <h4 key={index} className="text-lg font-semibold mt-3 mb-1">{line.substring(4)}</h4>;
        if (line.startsWith('* ')) return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>;
        if (line.trim() === '') return <br key={index} />;
        
        const segments = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);

        return <p key={index}>{segments.map((segment, i) => renderSegment(segment, i))}</p>;
    };

    return (
        <div className="prose prose-invert max-w-none text-content-100 space-y-2">
            {content.split('\n').map((line, i) => renderLine(line, i))}
        </div>
    );
};

// VIEW COMPONENTS

const DashboardView: React.FC = () => {
  const { transactions, accounts, budgets, primaryCurrency, getCategoryById, getAccountById, netWorthHistory, dashboardCards } = useFinance();
  const [isNetWorthVisible, setIsNetWorthVisible] = useState(true);
  
  const netWorth = useMemo(() => netWorthHistory.length > 0 ? netWorthHistory[netWorthHistory.length - 1].value : 0, [netWorthHistory]);
  
  const recentTransactions = useMemo(() => [...transactions].slice(0, 5), [transactions]);

  const spendingData = useMemo(() => {
    const spendingByCategory: { [key: string]: { id: string; name: string; value: number } } = {};
    
    transactions
      .filter(t => t.type === TransactionType.EXPENSE && t.categoryId)
      .forEach(t => {
        const category = getCategoryById(t.categoryId);
        if (category) {
            if (!spendingByCategory[category.id]) {
                spendingByCategory[category.id] = { id: category.id, name: category.name, value: 0 };
            }
            spendingByCategory[category.id].value += Number(t.amount) || 0; // Sanitize amount
        }
      });
      
    return Object.values(spendingByCategory).sort((a, b) => b.value - a.value);
  }, [transactions, getCategoryById]);
  
  const budgetStatus = useMemo(() => {
    const monthlyExpenses = transactions
      .filter(t => t.type === TransactionType.EXPENSE && new Date(t.date).getMonth() === new Date().getMonth())
      .reduce((acc, t) => {
        acc[t.categoryId] = (acc[t.categoryId] || 0) + (Number(t.amount) || 0); // Sanitize amount
        return acc;
      }, {} as { [key: string]: number });

    return budgets.map(b => {
      const category = getCategoryById(b.categoryId);
      const spent = monthlyExpenses[b.categoryId] || 0;
      const progress = b.amount > 0 ? Math.min((spent / b.amount) * 100, 100) : 0;
      return {
        ...b,
        categoryName: category?.name || 'Unknown',
        spent,
        progress
      };
    }).sort((a,b) => b.progress - a.progress);
  }, [transactions, budgets, getCategoryById]);

  const PIE_COLORS = ['#C084FC', '#818CF8', '#F59E0B', '#F87171', '#6366F1', '#34D399'];
  
  const monthlyIncome = useMemo(() => transactions
    .filter(t => t.type === TransactionType.INCOME && new Date(t.date).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0), [transactions]);
    
  const monthlyExpenses = useMemo(() => transactions
    .filter(t => t.type === TransactionType.EXPENSE && new Date(t.date).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0), [transactions]);

  const isDashboardEmpty = Object.values(dashboardCards || {}).every(v => !v);

  if (isDashboardEmpty) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <p className="text-content-200">Your dashboard is empty.</p>
        <p className="text-content-200 mt-2">You can enable cards in the Settings page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {dashboardCards?.NET_WORTH && (
            <Card className="md:col-span-2 lg:col-span-4" hasGlow>
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                             <h4 className="font-semibold text-content-200 text-sm">Total Net Worth</h4>
                             <button onClick={() => setIsNetWorthVisible(p => !p)} className="text-content-200 hover:text-white">
                                {isNetWorthVisible ? ICONS['eye-slash'] : ICONS.eye}
                             </button>
                        </div>
                        <p className="text-5xl font-extrabold text-white mt-2">
                            {isNetWorthVisible ? formatCurrency(netWorth, primaryCurrency) : '••••••••'}
                        </p>
                    </div>
                </div>
              
              <div className="mt-4 max-h-48 overflow-y-auto pr-2">
                <div className="space-y-1 animate-fade-in">
                    {accounts.length > 0 ? accounts
                        .sort((a, b) => b.balance - a.balance)
                        .map(acc => (
                        <div key={acc.id} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-base-300/50 transition-colors">
                            <div>
                                <p className="font-semibold text-white">{acc.name}</p>
                                <p className="text-xs text-content-200">{acc.type}</p>
                            </div>
                            <p className={classNames("font-medium", acc.balance >= 0 ? 'text-white' : 'text-accent-error')}>
                                {isNetWorthVisible ? formatCurrency(acc.balance, acc.currency) : '••••'}
                            </p>
                        </div>
                    )) : <p className="text-content-200 text-center py-10">No accounts to display.</p>}
                </div>
            </div>
            </Card>
         )}
         {dashboardCards?.MONTHLY_SUMMARY && (
            <>
                <Card className="lg:col-span-2">
                  <h4 className="font-semibold text-content-200 text-sm">Income this month</h4>
                  <p className="text-3xl font-bold text-accent-success mt-1">{formatCurrency(monthlyIncome, primaryCurrency)}</p>
                </Card>
                <Card className="lg:col-span-2">
                  <h4 className="font-semibold text-content-200 text-sm">Expenses this month</h4>
                  <p className="text-3xl font-bold text-accent-error mt-1">{formatCurrency(monthlyExpenses, primaryCurrency)}</p>
                </Card>
            </>
         )}
      </div>

      {(dashboardCards?.SPENDING_CATEGORY || dashboardCards?.RECENT_TRANSACTIONS) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {dashboardCards?.SPENDING_CATEGORY && (
                <Card className="lg:col-span-1">
                  <h4 className="text-lg font-bold text-white mb-4">Spending by Category</h4>
                  {spendingData.length > 0 ? (
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                      {spendingData.slice(0, 5).map((category, index) => (
                          <div key={category.id} className="animate-list-item-in" style={{ animationDelay: `${index * 30}ms` }}>
                              <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium text-content-100 truncate pr-2">{category.name}</span>
                                  <span className="font-semibold text-white flex-shrink-0">{formatCurrency(category.value, primaryCurrency)}</span>
                              </div>
                              <div className="w-full bg-base-300 rounded-full h-1.5">
                                  <div
                                      className="h-1.5 rounded-full"
                                      style={{ 
                                          width: `${(category.value / spendingData[0].value) * 100}%`,
                                          backgroundColor: PIE_COLORS[index % PIE_COLORS.length]
                                      }}
                                  ></div>
                              </div>
                          </div>
                      ))}
                    </div>
                  ) : <p className="text-content-200 text-center py-10">No expense data available.</p>}
                </Card>
            )}
            {dashboardCards?.RECENT_TRANSACTIONS && (
                <Card className={classNames(
                    "lg:col-span-2",
                    !dashboardCards?.SPENDING_CATEGORY && 'lg:col-span-3'
                )}>
                    <h4 className="text-lg font-bold text-white mb-4">Recent Transactions</h4>
                    <div className="space-y-3">
                      {recentTransactions.length > 0 ? recentTransactions.map((t, index) => {
                          const category = getCategoryById(t.categoryId);
                          const isIncome = t.type === TransactionType.INCOME;
                          const isTransfer = t.type === TransactionType.TRANSFER;
                          const account = getAccountById(t.accountId);
                          const toAccount = isTransfer && t.toAccountId ? getAccountById(t.toAccountId) : undefined;
                          return (
                              <div key={t.id} className="flex justify-between items-center p-3 rounded-xl hover:bg-base-300/30 animate-list-item-in" style={{ animationDelay: `${index * 50}ms` }}>
                                  <div className="flex items-center gap-4">
                                      <span className="p-2 bg-base-100 rounded-full text-content-200">{ICONS[isTransfer ? 'transport' : category?.icon || 'misc']}</span>
                                      <div>
                                          <p className="font-semibold text-white">{t.description}</p>
                                          <p className="text-xs text-content-200">{formatDate(t.date)} &bull; {isTransfer ? `${account?.name || 'N/A'} → ${toAccount?.name || 'N/A'}` : category?.name}</p>
                                      </div>
                                  </div>
                                  <p className={classNames("font-bold text-base", 
                                      isIncome ? 'text-accent-success' : 
                                      isTransfer ? 'text-content-100' : 'text-accent-error'
                                  )}>
                                      {isIncome ? '+' : isTransfer ? '' : '-'} {formatCurrency(t.amount, account?.currency || primaryCurrency)}
                                  </p>
                              </div>
                          )
                      }) : <p className="text-content-200 text-center py-10">No transactions yet.</p>}
                    </div>
                </Card>
            )}
        </div>
      )}

       {dashboardCards?.BUDGET_STATUS && (
          <Card>
              <h4 className="text-lg font-bold text-white mb-4">Budget Status</h4>
              <div className="space-y-4">
                {budgetStatus.length > 0 ? (
                  budgetStatus.map(b => (
                      <div key={b.id}>
                          <div className="flex justify-between mb-1 text-sm">
                              <span className="font-semibold text-white">{b.categoryName}</span>
                              <span className="text-content-200">{formatCurrency(b.spent, primaryCurrency)} / {formatCurrency(b.amount, primaryCurrency)}</span>
                          </div>
                          <div className="w-full bg-base-300 rounded-full h-2.5">
                              <div
                                className={classNames("h-2.5 rounded-full transition-all duration-500", b.progress > 85 ? 'bg-accent-error' : b.progress > 60 ? 'bg-accent-warning' : 'bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to')}
                                style={{ width: `${b.progress}%` }}
                              ></div>
                          </div>
                      </div>
                  ))
                ) : (
                  <p className="text-content-200 text-center py-10">No budgets set. Go to the Budgets page to create one.</p>
                )}
              </div>
          </Card>
       )}
    </div>
  );
};

const AccountForm: React.FC<{onClose: () => void; existingAccount?: Account}> = ({onClose, existingAccount}) => {
    const { addAccount, updateAccount, primaryCurrency } = useFinance();
    const [account, setAccount] = useState<Partial<Account>>(
        existingAccount || { type: AccountType.CHECKING, balance: 0, currency: primaryCurrency }
    );
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumber = ['balance', 'statementBalance', 'minPayment'].includes(name);
        setAccount(prev => ({...prev, [name]: isNumber ? parseFloat(value) : value }));
    };
    
    const handleDateChange = (date: string) => {
        setAccount(prev => ({...prev, dueDate: date}));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { name, type, balance, currency } = account;
        if (!name || !type || typeof balance !== 'number' || isNaN(balance) || !currency) {
            alert("Please fill all required fields with valid values.");
            return;
        }

        const accountData: Omit<Account, 'id'> = {
            name, type, balance, currency,
            bankName: account.bankName,
            accountNumber: account.accountNumber,
            ifscCode: account.ifscCode,
            branchName: account.branchName,
            statementBalance: account.statementBalance,
            minPayment: account.minPayment,
            dueDate: account.dueDate,
        };
        
        if (existingAccount) {
            updateAccount({ ...accountData, id: existingAccount.id });
        } else {
            addAccount(accountData);
        }
        onClose();
    };
    
    const inputClasses = "w-full bg-base-100/50 p-3 rounded-lg text-white border border-base-300 focus:ring-2 focus:ring-brand-gradient-to focus:border-transparent transition-colors";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" name="name" placeholder="Account Nickname (e.g. Salary Account)" value={account.name || ''} onChange={handleChange} required className={inputClasses} />
            <select name="type" value={account.type} onChange={handleChange} className={inputClasses}>
                {Object.values(AccountType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" step="0.01" name="balance" placeholder="Current Balance" value={account.balance ?? ''} onChange={handleChange} required className={inputClasses} />
            <select name="currency" value={account.currency} onChange={handleChange} className={inputClasses}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>)}
            </select>

            {[AccountType.CHECKING, AccountType.SAVINGS].includes(account.type!) && (
                 <div className="space-y-4 p-4 border border-base-300 rounded-lg animate-fade-in">
                     <h4 className="font-semibold text-white">Bank Details (Optional)</h4>
                     <input type="text" name="bankName" placeholder="Bank Name" value={account.bankName || ''} onChange={handleChange} className={inputClasses} />
                     <input type="text" name="accountNumber" placeholder="Account Number" value={account.accountNumber || ''} onChange={handleChange} className={inputClasses} />
                     <div className="flex gap-4">
                        <input type="text" name="ifscCode" placeholder="IFSC Code" value={account.ifscCode || ''} onChange={handleChange} className={inputClasses} />
                        <input type="text" name="branchName" placeholder="Branch Name" value={account.branchName || ''} onChange={handleChange} className={inputClasses} />
                     </div>
                 </div>
            )}

            {account.type === AccountType.CREDIT_CARD && (
                <div className="space-y-4 p-4 border border-base-300 rounded-lg animate-fade-in">
                     <h4 className="font-semibold text-white">Credit Card Details</h4>
                     <input type="number" step="0.01" name="statementBalance" placeholder="Statement Balance" value={account.statementBalance ?? ''} onChange={handleChange} className={inputClasses} />
                     <input type="number" step="0.01" name="minPayment" placeholder="Minimum Payment Due" value={account.minPayment ?? ''} onChange={handleChange} className={inputClasses} />
                     <div>
                        <label className="text-sm text-content-200">Payment Due Date</label>
                        <CustomDatePicker value={account.dueDate || ''} onChange={handleDateChange} />
                     </div>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                <Button type="submit">{existingAccount ? 'Update' : 'Create'} Account</Button>
            </div>
        </form>
    );
};

const AccountsView: React.FC = () => {
    const { accounts, deleteAccount } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');

    const openModal = (account?: Account) => {
        setEditingAccount(account);
        setIsModalOpen(true);
    };
    
    const closeModal = () => {
        setEditingAccount(undefined);
        setIsModalOpen(false);
    };

    const filteredAccounts = useMemo(() => {
        return accounts.filter(acc => 
            acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.bankName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [accounts, searchTerm]);

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white self-start md:self-center">Accounts</h2>
                 <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-grow">
                        <input 
                            type="text"
                            placeholder="Search accounts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-base-200/80 p-3 pl-10 rounded-xl text-white border border-base-300 focus:ring-2 focus:ring-brand-gradient-to"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-content-200">
                            {ICONS.search}
                        </div>
                    </div>
                    <Button onClick={() => openModal()} className="flex-shrink-0">
                        {ICONS.plus}
                        <span className="hidden sm:inline">Add Account</span>
                    </Button>
                </div>
            </div>
            {filteredAccounts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAccounts.map((acc, index) => (
                        <Card key={acc.id} className="p-0" animate style={{ animationDelay: `${index * 50}ms`}}>
                           <div className="flex flex-col h-full p-5">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-white truncate pr-2" title={acc.name}>{acc.name}</h3>
                                        <p className="text-sm text-content-200">{acc.bankName || acc.type}</p>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button className="p-2 rounded-full hover:bg-base-300" onClick={() => openModal(acc)}>{ICONS.edit}</button>
                                        <button className="p-2 rounded-full hover:bg-base-300" onClick={() => window.confirm(`Are you sure you want to delete ${acc.name}?`) && deleteAccount(acc.id)}>{ICONS.trash}</button>
                                    </div>
                                </div>
                                <div className="flex-grow mt-4">
                                    <p className={classNames("text-3xl font-light", acc.balance >= 0 ? 'text-white' : 'text-accent-error')}>{formatCurrency(acc.balance, acc.currency)}</p>
                                    
                                    {acc.type === AccountType.CREDIT_CARD && (
                                        <div className="mt-4 pt-3 border-t border-base-300 space-y-1 text-sm">
                                            <div className="flex justify-between"><span className="text-content-200">Statement:</span> <span className="font-semibold text-white">{formatCurrency(acc.statementBalance || 0, acc.currency)}</span></div>
                                            <div className="flex justify-between"><span className="text-content-200">Min. Due:</span> <span className="font-semibold text-white">{formatCurrency(acc.minPayment || 0, acc.currency)}</span></div>
                                            <div className="flex justify-between"><span className="text-content-200">Due Date:</span> <span className="font-semibold text-white">{formatDate(acc.dueDate)}</span></div>
                                        </div>
                                    )}
                                    {[AccountType.CHECKING, AccountType.SAVINGS].includes(acc.type) && acc.accountNumber && (
                                        <div className="mt-4 pt-3 border-t border-base-300 space-y-1 text-sm">
                                            <div className="flex justify-between"><span className="text-content-200">Account No:</span> <span className="font-semibold text-white">{acc.accountNumber}</span></div>
                                            <div className="flex justify-between"><span className="text-content-200">IFSC:</span> <span className="font-semibold text-white">{acc.ifscCode}</span></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20">
                    <p className="text-content-200">{accounts.length > 0 ? "No accounts match your search." : "No accounts found. Add your first one!"}</p>
                </div>
            )}
            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingAccount ? 'Edit Account' : 'Add Account'}>
                <AccountForm onClose={closeModal} existingAccount={editingAccount}/>
            </Modal>
        </div>
    );
};

const TransactionForm: React.FC<{onClose: () => void; existingTransaction?: Transaction; prefilledData?: Partial<Transaction>}> = ({onClose, existingTransaction, prefilledData}) => {
    const { addTransaction, updateTransaction, accounts, categories } = useFinance();
    const [type, setType] = useState(prefilledData?.type || existingTransaction?.type || TransactionType.EXPENSE);
    const [description, setDescription] = useState(prefilledData?.description || existingTransaction?.description || '');
    const [amount, setAmount] = useState<number | undefined>(prefilledData?.amount || existingTransaction?.amount || undefined);
    const [date, setDate] = useState(formatInputDate(prefilledData?.date || existingTransaction?.date));
    const [accountId, setAccountId] = useState(prefilledData?.accountId || existingTransaction?.accountId || '');
    const [toAccountId, setToAccountId] = useState(existingTransaction?.toAccountId || '');
    const [categoryId, setCategoryId] = useState(prefilledData?.categoryId || existingTransaction?.categoryId || '');
    const [notes, setNotes] = useState(existingTransaction?.notes || '');
    const [tags, setTags] = useState(existingTransaction?.tags?.join(', ') || '');
    const [receiptImage, setReceiptImage] = useState(prefilledData?.receiptImage || existingTransaction?.receiptImage || undefined)
    const [isSuggesting, setIsSuggesting] = useState(false);
    
    const inputClasses = "w-full bg-base-100/50 p-3 rounded-lg text-white border border-base-300 focus:ring-2 focus:ring-brand-gradient-to focus:border-transparent transition-colors";
    
    const handleSuggestCategory = async () => {
        if (!description) {
            alert("Please enter a description first.");
            return;
        }
        setIsSuggesting(true);
        const suggestedCategoryName = await suggestCategory(description, categories);
        if (suggestedCategoryName) {
            const category = categories.find(c => c.name === suggestedCategoryName);
            if (category) setCategoryId(category.id);
        } else {
            alert("Could not suggest a category.");
        }
        setIsSuggesting(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
            alert("Please enter a valid positive amount.");
            return;
        }
        const transactionData: Omit<Transaction, 'id'> = {
            date: new Date(date).toISOString(),
            description,
            notes,
            amount: Math.abs(amount),
            type,
            accountId,
            categoryId: type === TransactionType.TRANSFER ? 'transfer' : categoryId,
            tags: parsedTags,
            receiptImage,
            ...(type === TransactionType.TRANSFER && { toAccountId }),
        };
        if(existingTransaction){
            updateTransaction({...transactionData, id: existingTransaction.id});
        } else {
            addTransaction(transactionData);
        }
        onClose();
    };

    const relevantCategories = useMemo(() => categories.filter(c => c.type === type), [categories, type]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2 p-1 bg-base-100 rounded-lg">
                {Object.values(TransactionType).map(t => (
                    <button type="button" key={t} onClick={() => setType(t)} className={classNames('w-full p-2 rounded-md transition-colors font-semibold', type === t ? 'bg-base-300 text-white' : 'text-content-200 hover:bg-base-200')}>{t}</button>
                ))}
            </div>
            <input type="text" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} required className={inputClasses} />
            <input type="number" step="0.01" placeholder="Amount" value={amount ?? ''} onChange={e => setAmount(parseFloat(e.target.value))} required className={inputClasses} />
            <CustomDatePicker value={date} onChange={setDate} />
            
            {type === TransactionType.TRANSFER ? (
                 <div className="flex gap-2 animate-fade-in">
                    <select value={accountId} onChange={e => setAccountId(e.target.value)} required className={inputClasses}><option value="">From Account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                    <select value={toAccountId} onChange={e => setToAccountId(e.target.value)} required className={inputClasses}><option value="">To Account</option>{accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                 </div>
            ) : (
                <div className="space-y-4 animate-fade-in">
                 <select value={accountId} onChange={e => setAccountId(e.target.value)} required className={inputClasses}><option value="">Select Account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                 <div className="flex gap-2 items-center">
                    <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required className={inputClasses}>
                        <option value="">Select Category</option>
                        {relevantCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Button type="button" variant="secondary" onClick={handleSuggestCategory} disabled={isSuggesting || type !== TransactionType.EXPENSE} className="whitespace-nowrap h-full">
                        {isSuggesting ? <SkeletonLoader className="w-16 h-4"/> : "Suggest"}
                    </Button>
                 </div>
                </div>
            )}
            
            <textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} className={classNames(inputClasses, "h-20 resize-y")} />
            <input type="text" placeholder="Tags (comma-separated)" value={tags} onChange={e => setTags(e.target.value)} className={inputClasses} />

            {receiptImage && (
                <div>
                    <label className="text-sm text-content-200">Receipt</label>
                    <div className="mt-1 relative w-24 h-24">
                        <img src={receiptImage.startsWith('data:') ? receiptImage : `data:image/jpeg;base64,${receiptImage}`} alt="Receipt" className="rounded-lg object-cover w-full h-full" />
                        <button 
                          type="button" 
                          onClick={() => setReceiptImage(undefined)} 
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 leading-none w-6 h-6 flex items-center justify-center text-lg"
                        >
                            &times;
                        </button>
                    </div>
                </div>
            )}
            
            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                <Button type="submit">{existingTransaction ? 'Update' : 'Save'} Transaction</Button>
            </div>
        </form>
    );
};

const TransactionsView: React.FC<{ openTransactionModal: (data?: Partial<Transaction>) => void }> = ({ openTransactionModal }) => {
    const { transactions, deleteTransaction, getCategoryById, getAccountById, primaryCurrency, accounts, categories } = useFinance();
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<{ accountId?: string; categoryId?: string; type?: TransactionType }>({});
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setActionMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const descriptionMatch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
            const accountMatch = !filters.accountId || t.accountId === filters.accountId;
            const categoryMatch = !filters.categoryId || t.categoryId === filters.categoryId;
            const typeMatch = !filters.type || t.type === filters.type;
            return descriptionMatch && accountMatch && categoryMatch && typeMatch;
        });
    }, [transactions, searchTerm, filters]);

    const groupedTransactions = useMemo(() => {
        return filteredTransactions.reduce((acc, t) => {
            const dateKey = t.date.split('T')[0];
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(t);
            return acc;
        }, {} as { [key: string]: Transaction[] });
    }, [filteredTransactions]);
    
    const FilterPanel = () => (
      <div className="bg-base-200/80 p-4 rounded-xl border border-base-300 mb-6 space-y-4 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select value={filters.accountId || ''} onChange={e => setFilters(f => ({...f, accountId: e.target.value || undefined}))} className="w-full bg-base-100/50 p-3 rounded-lg text-white border border-base-300">
                <option value="">All Accounts</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={filters.categoryId || ''} onChange={e => setFilters(f => ({...f, categoryId: e.target.value || undefined}))} className="w-full bg-base-100/50 p-3 rounded-lg text-white border border-base-300">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filters.type || ''} onChange={e => setFilters(f => ({...f, type: e.target.value as TransactionType || undefined}))} className="w-full bg-base-100/50 p-3 rounded-lg text-white border border-base-300">
                <option value="">All Types</option>
                {Object.values(TransactionType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
        </div>
        <div className="flex justify-end">
            <Button variant="secondary" onClick={() => { setFilters({}); setIsFilterOpen(false); }}>Reset Filters</Button>
        </div>
      </div>
    );

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white self-start md:self-center">Transactions</h2>
                 <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-grow">
                        <input 
                            type="text"
                            placeholder="Search transactions..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-base-200/80 p-3 pl-10 rounded-xl text-white border border-base-300 focus:ring-2 focus:ring-brand-gradient-to"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-content-200">
                            {ICONS.search}
                        </div>
                    </div>
                     <Button variant="secondary" onClick={() => setIsFilterOpen(p => !p)}>{ICONS.filter} <span className="hidden sm:inline">Filter</span></Button>
                </div>
            </div>
            
            {isFilterOpen && <FilterPanel />}

            {Object.keys(groupedTransactions).length > 0 ? (
                <Card className="p-0 overflow-hidden">
                    {Object.entries(groupedTransactions).map(([date, txsOnDate]) => (
                        <div key={date}>
                            <h3 className="bg-base-200/50 px-4 py-2 text-sm font-semibold text-content-100 sticky top-[65px] md:top-[73px] backdrop-blur-sm z-10">{formatGroupDate(date)}</h3>
                            <div className="px-4">
                                {txsOnDate.map(t => {
                                    const category = getCategoryById(t.categoryId);
                                    const isIncome = t.type === TransactionType.INCOME;
                                    const isTransfer = t.type === TransactionType.TRANSFER;
                                    const account = getAccountById(t.accountId);
                                    const toAccount = isTransfer && t.toAccountId ? getAccountById(t.toAccountId) : undefined;
                                    
                                    return (
                                        <div key={t.id} className="flex items-center py-4 border-b border-base-300 last:border-b-0">
                                            <div className="p-3 bg-base-100 rounded-full mr-4 text-content-200">
                                                {ICONS[isTransfer ? 'transport' : category?.icon || 'misc']}
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <p className="font-semibold text-white truncate">{t.description}</p>
                                                <p className="text-sm text-content-200 truncate">
                                                    {isTransfer ? `${account?.name || 'N/A'} → ${toAccount?.name || 'N/A'}` : `${category?.name || 'N/A'} • ${account?.name || 'N/A'}`}
                                                </p>
                                            </div>
                                            <div className="flex items-center flex-shrink-0 ml-4">
                                                <p className={classNames("font-bold text-base text-right mr-2",
                                                    isIncome ? 'text-accent-success' :
                                                    isTransfer ? 'text-content-100' : 'text-accent-error'
                                                )}>
                                                    {isIncome ? '+' : isTransfer ? '' : '-'} {formatCurrency(t.amount, account?.currency || primaryCurrency)}
                                                </p>
                                                <div className="relative">
                                                    <button onClick={() => setActionMenuId(actionMenuId === t.id ? null : t.id)} className="p-2 rounded-full text-content-200 hover:bg-base-300 hover:text-white transition-colors">
                                                        {ICONS['dots-vertical']}
                                                    </button>
                                                    {actionMenuId === t.id && (
                                                        <div ref={actionMenuRef} className="absolute top-full right-0 mt-1 bg-base-300/90 backdrop-blur-md rounded-lg shadow-2xl w-32 z-20 animate-fade-in origin-top-right">
                                                            <button 
                                                                onClick={() => { openTransactionModal(t); setActionMenuId(null); }} 
                                                                className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-white hover:bg-base-100/50 rounded-t-lg"
                                                            >
                                                                {ICONS.edit} Edit
                                                            </button>
                                                            <button 
                                                                onClick={() => { window.confirm('Are you sure you want to delete this transaction?') && deleteTransaction(t.id); setActionMenuId(null); }} 
                                                                className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-accent-error hover:bg-base-100/50 rounded-b-lg"
                                                            >
                                                                {ICONS.trash} Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </Card>
            ) : <div className="text-center py-20"><p className="text-content-200">No transactions found.</p></div>}
        </div>
    );
};

const PlaceholderView: React.FC<{title: string}> = ({ title }) => (
    <div className="flex justify-center items-center h-96 animate-fade-in">
        <Card className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
            <p className="text-content-200">This feature is under construction. Check back soon!</p>
        </Card>
    </div>
);
const BudgetsView: React.FC = () => <PlaceholderView title="Budgets" />;
const InsightsView: React.FC = () => <PlaceholderView title="AI Insights" />;
const SettingsView: React.FC = () => <PlaceholderView title="Settings" />;
const InvestmentsView: React.FC = () => <PlaceholderView title="Investments" />;
const SavingsView: React.FC = () => <PlaceholderView title="Savings" />;
const GoalsView: React.FC = () => <PlaceholderView title="Goals" />;
const AssetsView: React.FC = () => <PlaceholderView title="Assets" />;
const SubscriptionsView: React.FC = () => <PlaceholderView title="Subscriptions" />;
const ReportsView: React.FC = () => <PlaceholderView title="Reports" />;

const ReceiptScanner: React.FC<{
  onReceiptProcessed: (data: { merchantName: string, totalAmount: number, transactionDate: string }) => void;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
}> = ({ onReceiptProcessed, isProcessing, setIsProcessing }) => {

    const handleFileSelect = async (base64: string, file: File) => {
        setIsProcessing(true);
        try {
            const result = await processReceiptImage(base64.split(',')[1], file.type);
            if (result) {
                onReceiptProcessed(result);
            } else {
                alert("Could not extract details from the receipt. Please enter them manually.");
            }
        } catch (error) {
            console.error(error);
            alert("An error occurred while processing the receipt.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="text-center">
            {isProcessing ? (
                <div className="flex flex-col items-center justify-center p-8 space-y-3">
                    <div className="w-12 h-12 border-4 border-base-300 border-t-brand-primary rounded-full animate-spin"></div>
                    <p className="text-content-100 font-semibold">Analyzing your receipt...</p>
                    <p className="text-sm text-content-200">This may take a few moments.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-content-200">
                        Use your camera to scan a receipt or upload an image from your device.
                    </p>
                    <div className="flex justify-center gap-4 pt-2">
                        <FileInputButton onFileSelect={handleFileSelect} capture="environment">
                            {ICONS.camera} Take Photo
                        </FileInputButton>
                        <FileInputButton onFileSelect={handleFileSelect}>
                            {ICONS.upload} Upload File
                        </FileInputButton>
                    </div>
                </div>
            )}
        </div>
    );
};


function App() {
  const { bottomNavViews } = useFinance();
  const [activeView, setActiveView] = useState<View>(bottomNavViews[0] || 'DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [prefilledTransaction, setPrefilledTransaction] = useState<Partial<Transaction> | undefined>();
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);

  const openTransactionModal = (data?: Partial<Transaction>) => {
    setPrefilledTransaction(data);
    setIsModalOpen(true);
  };

  const closeTransactionModal = () => {
    setPrefilledTransaction(undefined);
    setIsModalOpen(false);
  };
  
  const handleScanReceipt = () => {
    setIsScanModalOpen(true);
  };
  
  const handleReceiptProcessed = (data: { merchantName: string, totalAmount: number, transactionDate: string }) => {
    setIsScanModalOpen(false);
    openTransactionModal({
        description: data.merchantName,
        amount: data.totalAmount,
        date: data.transactionDate,
        type: TransactionType.EXPENSE,
    });
  };

  const renderView = () => {
    switch (activeView) {
      case 'DASHBOARD': return <DashboardView />;
      case 'ACCOUNTS': return <AccountsView />;
      case 'TRANSACTIONS': return <TransactionsView openTransactionModal={openTransactionModal} />;
      case 'BUDGETS': return <BudgetsView />;
      case 'INSIGHTS': return <InsightsView />;
      case 'SETTINGS': return <SettingsView />;
      case 'INVESTMENTS': return <InvestmentsView />;
      case 'SAVINGS': return <SavingsView />;
      case 'GOALS': return <GoalsView />;
      case 'ASSETS': return <AssetsView />;
      case 'SUBSCRIPTIONS': return <SubscriptionsView />;
      case 'REPORTS': return <ReportsView />;
      default: return <DashboardView />;
    }
  };
  
  const currentNavItem = allNavItems.find(item => item.view === activeView);
  
  const MoreMenu: React.FC<{onClose: () => void}> = ({onClose}) => (
    <div className="absolute bottom-full mb-2 right-0 bg-base-200/90 backdrop-blur-md rounded-xl shadow-lg border border-base-300 w-56 overflow-hidden animate-slide-up-fast">
      {moreNavItems.map(item => (
        <button key={item.view} onClick={() => { setActiveView(item.view); onClose(); }} className="flex items-center gap-4 w-full text-left px-4 py-3 text-white hover:bg-base-300 transition-colors">
          <span className="text-brand-primary">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  const BottomNavBar: React.FC = () => {
    const { bottomNavViews } = useFinance();
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

    const mainViewsToShow = allNavItems.filter(navItem => bottomNavViews.includes(navItem.view));
    const navItems = mainViewsToShow.length >= 4 ? mainViewsToShow.slice(0, 4) : mainNavItems.slice(0, 4);
    
    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-base-200/80 backdrop-blur-lg border-t border-base-300 md:hidden z-30">
            <div className="flex justify-around items-center h-20">
                {navItems.map(item => (
                    <button key={item.view} onClick={() => setActiveView(item.view)} className={classNames("flex flex-col items-center justify-center gap-1 transition-colors w-full h-full", activeView === item.view ? 'text-brand-primary' : 'text-content-200 hover:text-white')}>
                        {item.icon}
                        <span className="text-xs">{item.label}</span>
                    </button>
                ))}
                 <div className="relative">
                    <button onClick={() => setIsMoreMenuOpen(p => !p)} className={classNames("flex flex-col items-center justify-center gap-1 transition-colors w-full h-full px-4", moreNavItems.some(i => i.view === activeView) ? 'text-brand-primary' : 'text-content-200 hover:text-white')}>
                        {ICONS['dots-horizontal'] || <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>}
                        <span className="text-xs">More</span>
                    </button>
                    {isMoreMenuOpen && <MoreMenu onClose={() => setIsMoreMenuOpen(false)}/>}
                </div>
            </div>
        </nav>
    );
  };
  
  const Sidebar: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const sidebarRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const allItems = [...mainNavItems, ...moreNavItems, { view: 'SETTINGS' as View, label: 'Settings', icon: ICONS.settings }];

    return (
        <>
            <div className={classNames("fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity", isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')} onClick={onClose}></div>
            <div ref={sidebarRef} className={classNames("fixed top-0 left-0 h-full bg-base-200 border-r border-base-300 w-64 p-5 z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0", isOpen ? 'translate-x-0' : '-translate-x-full')}>
                 <div className="flex items-center gap-2 mb-8">
                     {ICONS.logo}
                     <h1 className="text-2xl font-bold bg-brand-gradient text-transparent bg-clip-text">FinanSage</h1>
                 </div>
                 <nav className="space-y-2">
                    {allItems.map(item => (
                        <button key={item.view} onClick={() => { setActiveView(item.view); onClose(); }} className={classNames(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-lg",
                            activeView === item.view ? 'bg-base-300 text-white font-semibold' : 'text-content-200 hover:bg-base-300/50'
                        )}>
                            {item.icon} {item.label}
                        </button>
                    ))}
                 </nav>
            </div>
        </>
    )
  }

  return (
    <div className="min-h-screen bg-base-100 text-content-100 font-sans">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="md:ml-64 pb-24 md:pb-8">
            <header className="sticky top-0 bg-base-100/80 backdrop-blur-lg z-30 border-b border-base-300 flex items-center justify-between h-[65px] md:h-[73px]">
                <div className="flex items-center gap-3 md:hidden p-4">
                    <button onClick={() => setIsSidebarOpen(true)} className="text-white p-2">
                       {ICONS['menu']}
                    </button>
                     <div className="flex items-center gap-2">
                         {ICONS.logo}
                         <h1 className="text-xl font-bold bg-brand-gradient text-transparent bg-clip-text">FinanSage</h1>
                     </div>
                </div>
                <div className="hidden md:flex flex-col w-full px-6">
                    <h2 className="text-xl font-bold text-white">{currentNavItem?.label || 'Dashboard'}</h2>
                    <p className="text-sm text-content-200">Welcome back!</p>
                </div>
            </header>
            <div className="p-4 md:p-6">
                {renderView()}
            </div>
        </main>
        <BottomNavBar />
        <FloatingActionButton 
            onAddManually={() => openTransactionModal()} 
            onScanReceipt={handleScanReceipt}
        />
        <Modal isOpen={isModalOpen} onClose={closeTransactionModal} title={prefilledTransaction?.id ? 'Edit Transaction' : 'Add Transaction'}>
            <TransactionForm onClose={closeTransactionModal} existingTransaction={prefilledTransaction as Transaction} prefilledData={prefilledTransaction}/>
        </Modal>
        <Modal isOpen={isScanModalOpen} onClose={() => setIsScanModalOpen(false)} title="Scan Receipt">
             <ReceiptScanner onReceiptProcessed={handleReceiptProcessed} isProcessing={isProcessingReceipt} setIsProcessing={setIsProcessingReceipt} />
        </Modal>
    </div>
  );
}

export default App;
