import React, { useState, useEffect, useCallback, useMemo, createContext, useContext, useRef } from 'react';
import { Account, AccountType, Transaction, TransactionType, Category, Budget, View, Investment, InvestmentType, SavingsInstrument, SavingsType, Goal, Asset, AssetCategory, Subscription, NetWorthHistoryEntry, DashboardCard } from './types';
import { CURRENCIES, DEFAULT_CATEGORIES, ICONS, DEFAULT_ASSET_CATEGORIES, allNavItems, mainNavItems, moreNavItems, NavItemDef, dashboardCardDefs } from './constants';
import { getFinancialInsights, suggestCategory, fetchProductDetailsFromUrl, processReceiptImage, findSubscriptions, generateFinancialReport } from './services/geminiService';

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
const getMonthsBetween = (startDateStr: string, endDateStr: string): number => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    let months = (end.getFullYear() - start.getFullYear()) * 12;
    months -= start.getMonth();
    months += end.getMonth();
    return months <= 0 ? 0 : months + 1;
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

  const getCategoryById = useCallback((id: string) => categories.find(c => c.id === id), [categories]);
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
    addSubscription, updateSubscription, deleteSubscription
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
                        <img src={receiptImage} alt="Receipt preview" className="rounded-md w-24 h-24 object-cover" />
                        <button type="button" onClick={() => setReceiptImage(undefined)} className="absolute -top-2 -right-2 bg-accent-error text-white rounded-full p-0.5 w-6 h-6 flex items-center justify-center leading-none">&times;</button>
                    </div>
                </div>
            )}
            
            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                <Button type="submit">{existingTransaction ? 'Update' : 'Create'} Transaction</Button>
            </div>
        </form>
    );
};

const ReceiptScannerModal: React.FC<{
    onScanComplete: (data: Partial<Transaction>) => void;
}> = ({ onScanComplete }) => {
    const [image, setImage] = useState<{base64: string; file: File} | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileSelect = (base64: string, file: File) => {
        setImage({ base64, file });
        setError('');
    };

    const handleScan = async () => {
        if (!image) return;
        setIsLoading(true);
        setError('');
        try {
            const result = await processReceiptImage(image.base64.split(',')[1], image.file.type);
            if (result) {
                onScanComplete({
                    description: result.merchantName,
                    amount: result.totalAmount,
                    date: result.transactionDate,
                    type: TransactionType.EXPENSE,
                    receiptImage: image.base64,
                });
            } else {
                setError("Could not extract details from the receipt. Please try another image or enter manually.");
            }
        } catch (e) {
            setError("An error occurred during scanning. Please try again.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="space-y-4">
            {!image ? (
                <div className="space-y-3">
                    <p className="text-center text-content-200">Use your camera or upload an image of your receipt.</p>
                    <div className="flex justify-center gap-4">
                         <FileInputButton onFileSelect={handleFileSelect} capture="environment">
                             {ICONS.camera} Take Photo
                         </FileInputButton>
                         <FileInputButton onFileSelect={handleFileSelect}>
                             {ICONS.upload} Upload File
                         </FileInputButton>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <img src={image.base64} alt="Receipt preview" className="w-full max-h-64 object-contain rounded-md" />
                    {error && <p className="text-accent-error text-sm text-center">{error}</p>}
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setImage(null)} disabled={isLoading}>Change Image</Button>
                        <Button onClick={handleScan} disabled={isLoading}>
                            {isLoading ? <SkeletonLoader className="w-24 h-4" /> : ICONS.scan}
                            {isLoading ? 'Scanning...' : 'Scan Receipt'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

const TransactionCard: React.FC<{
  transaction: Transaction;
  onEdit: () => void;
  onDelete: () => void;
  style?: React.CSSProperties;
}> = ({ transaction, onEdit, onDelete, style }) => {
    const { getCategoryById, getAccountById, primaryCurrency } = useFinance();
    const category = getCategoryById(transaction.categoryId);
    const account = getAccountById(transaction.accountId);
    const toAccount = transaction.toAccountId ? getAccountById(transaction.toAccountId) : null;
    const isIncome = transaction.type === TransactionType.INCOME;
    const isTransfer = transaction.type === TransactionType.TRANSFER;

    const handleDelete = () => {
        if(window.confirm(`Delete transaction: ${transaction.description}?`)) {
            onDelete();
        }
    };

    return (
        <Card className="p-0 animate-list-item-in" style={style}>
            <div className="flex justify-between items-center p-4">
                <div className="flex items-center gap-4 min-w-0">
                    <span className="p-2.5 bg-base-100 rounded-full text-content-200 flex-shrink-0">
                        {ICONS[isTransfer ? 'transport' : category?.icon || 'misc']}
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate" title={transaction.description}>{transaction.description}</p>
                        <p className="text-xs text-content-200 truncate">{formatDate(transaction.date)} &bull; {isTransfer ? `${account?.name} → ${toAccount?.name}` : account?.name}</p>
                    </div>
                </div>
                <p className={classNames("font-bold text-lg whitespace-nowrap pl-2", isIncome ? 'text-accent-success' : isTransfer ? 'text-content-100' : 'text-accent-error')}>
                    {isIncome ? '+' : isTransfer ? '' : '-'} {formatCurrency(transaction.amount, account?.currency || primaryCurrency)}
                </p>
            </div>
            {transaction.notes && (
                <div className="px-4 pb-3 border-b border-base-300">
                    <p className="text-sm text-content-200 italic">"{transaction.notes}"</p>
                </div>
            )}
            <div className="flex justify-end gap-2 p-2 bg-base-300/20 rounded-b-2xl">
                <Button variant="secondary" className="px-3 py-1 text-sm" onClick={onEdit}>{ICONS.edit} Edit</Button>
                <Button variant="danger" className="px-3 py-1 text-sm" onClick={handleDelete}>{ICONS.trash} Delete</Button>
            </div>
        </Card>
    );
};

interface TransactionsViewProps {
  openAddEditModal: (transaction?: Transaction) => void;
}

const TransactionsView: React.FC<TransactionsViewProps> = ({ openAddEditModal }) => {
    const { transactions, accounts, categories, deleteTransaction, getCategoryById, getAccountById, primaryCurrency } = useFinance();
    const [isFilterVisible, setIsFilterVisible] = useState(false);
    
    const initialFilters = { description: '', type: '', categoryId: '', accountId: '', dateStart: '', dateEnd: '' };
    const [filters, setFilters] = useState(initialFilters);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const descMatch = filters.description ? t.description.toLowerCase().includes(filters.description.toLowerCase()) : true;
            const typeMatch = filters.type ? t.type === filters.type : true;
            const categoryMatch = filters.categoryId ? t.categoryId === filters.categoryId : true;
            const accountMatch = filters.accountId ? (t.accountId === filters.accountId || t.toAccountId === filters.accountId) : true;
            const date = new Date(t.date);
            const startDateMatch = filters.dateStart ? date >= new Date(filters.dateStart) : true;
            const endDateMatch = filters.dateEnd ? date <= new Date(filters.dateEnd + 'T23:59:59') : true;
            return descMatch && typeMatch && categoryMatch && accountMatch && startDateMatch && endDateMatch;
        });
    }, [transactions, filters]);

    const handleExportCSV = () => {
        if (filteredTransactions.length === 0) return alert("No transactions to export.");
        const headers = ['ID', 'Date', 'Description', 'Notes', 'Amount', 'Type', 'Category', 'Account', 'To Account', 'Tags'];
        const escapeCSV = (field: any) => {
            if (field === null || field === undefined) return '';
            const str = String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
            return str;
        };
        const rows = filteredTransactions.map(t => [
            escapeCSV(t.id), escapeCSV(t.date), escapeCSV(t.description), escapeCSV(t.notes), escapeCSV(t.amount),
            escapeCSV(t.type), escapeCSV(getCategoryById(t.categoryId)?.name || 'N/A'), escapeCSV(getAccountById(t.accountId)?.name || 'N/A'),
            escapeCSV(t.toAccountId ? getAccountById(t.toAccountId)?.name || '' : ''), escapeCSV(t.tags?.join('|') || '')
        ].join(','));
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `finansage_transactions_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };
    
    const inputClasses = "w-full bg-base-100 p-2 rounded-md text-white border-base-300 focus:ring-1 focus:ring-brand-primary text-sm";
    
    return (
        <div className="animate-fade-in">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                <h2 className="text-3xl font-bold text-white">Transactions</h2>
                <div className="flex gap-3">
                    <Button onClick={() => setIsFilterVisible(p => !p)} variant="secondary" className={isFilterVisible ? 'bg-base-300' : ''}>{ICONS.filter}<span className="hidden sm:inline">Filter</span></Button>
                    <Button onClick={handleExportCSV} variant="secondary">{ICONS.export}<span className="hidden sm:inline">Export</span></Button>
                </div>
            </div>

            {isFilterVisible && (
                 <Card className="mb-6 p-4 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
                        <div className="sm:col-span-2 lg:col-span-3 xl:col-span-1">
                            <label htmlFor="filter-desc" className="block text-xs font-medium text-content-200 mb-1">Description</label>
                            <input id="filter-desc" type="text" name="description" placeholder="e.g. Coffee" value={filters.description} onChange={handleFilterChange} className={inputClasses} />
                        </div>
                        <div>
                            <label htmlFor="filter-type" className="block text-xs font-medium text-content-200 mb-1">Type</label>
                            <select id="filter-type" name="type" value={filters.type} onChange={handleFilterChange} className={inputClasses}>
                                <option value="">All</option>
                                {Object.values(TransactionType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="filter-category" className="block text-xs font-medium text-content-200 mb-1">Category</label>
                            <select id="filter-category" name="categoryId" value={filters.categoryId} onChange={handleFilterChange} className={inputClasses} disabled={!!filters.type && filters.type === TransactionType.TRANSFER}>
                                <option value="">All</option>
                                {categories.filter(c => filters.type ? c.type === filters.type : true).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="filter-account" className="block text-xs font-medium text-content-200 mb-1">Account</label>
                            <select id="filter-account" name="accountId" value={filters.accountId} onChange={handleFilterChange} className={inputClasses}>
                                <option value="">All</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-full sm:col-span-2 flex gap-4">
                            <div className="w-full">
                                <label htmlFor="filter-dateStart" className="block text-xs font-medium text-content-200 mb-1">Date From</label>
                                <CustomDatePicker value={filters.dateStart} onChange={date => setFilters(p => ({...p, dateStart: date}))} />
                            </div>
                            <div className="w-full">
                                <label htmlFor="filter-dateEnd" className="block text-xs font-medium text-content-200 mb-1">Date To</label>
                                <CustomDatePicker value={filters.dateEnd} onChange={date => setFilters(p => ({...p, dateEnd: date}))} />
                            </div>
                        </div>
                        <div className="col-span-full sm:col-span-1 flex items-end">
                            <Button onClick={() => setFilters(initialFilters)} variant="secondary" className="w-full">Reset Filters</Button>
                        </div>
                    </div>
                </Card>
            )}
            <p className="text-xs text-content-200 mb-4">Showing {filteredTransactions.length} of {transactions.length} transactions.</p>
            
            <div className="hidden md:block"> {/* Desktop Table */}
                <Card>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-base-300 text-xs text-content-200 uppercase"><tr><th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Category</th><th className="p-3">Account</th><th className="p-3 text-right">Amount</th><th className="p-3"></th></tr></thead>
                            <tbody>
                                {filteredTransactions.map(t => {
                                    const category = getCategoryById(t.categoryId);
                                    const account = getAccountById(t.accountId);
                                    const isIncome = t.type === TransactionType.INCOME;
                                    const isTransfer = t.type === TransactionType.TRANSFER;
                                    return (
                                    <tr key={t.id} className="border-b border-base-300 hover:bg-base-300/20">
                                        <td className="p-3 whitespace-nowrap">{formatDate(t.date)}</td>
                                        <td className="p-3">
                                            <div className="font-semibold text-white flex items-center gap-2">{t.receiptImage && ICONS.scan} {t.description}</div>
                                            {t.notes && <div className="text-xs text-content-200 mt-1 truncate" title={t.notes}>{t.notes}</div>}
                                        </td>
                                        <td className="p-3">{isTransfer ? 'Transfer' : category?.name || 'N/A'}</td>
                                        <td className="p-3">{account?.name || 'N/A'}{isTransfer && t.toAccountId && ` -> ${getAccountById(t.toAccountId)?.name}`}</td>
                                        <td className={classNames("p-3 font-bold text-right", isIncome ? 'text-accent-success' : isTransfer ? 'text-content-100' : 'text-accent-error')}>{isIncome ? '+' : isTransfer ? '' : '-'} {formatCurrency(t.amount, account?.currency || primaryCurrency)}</td>
                                        <td className="p-3 text-right"><div className="flex justify-end gap-1.5"><Button variant="secondary" className="p-1.5" onClick={() => openAddEditModal(t)}>{ICONS.edit}</Button><Button variant="danger" className="p-1.5" onClick={() => window.confirm(`Delete transaction: ${t.description}?`) && deleteTransaction(t.id)}>{ICONS.trash}</Button></div></td>
                                    </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        {filteredTransactions.length === 0 && <p className="text-center p-8 text-content-200">{transactions.length > 0 ? "No transactions match filters." : "No transactions yet."}</p>}
                    </div>
                </Card>
            </div>
            <div className="md:hidden space-y-4"> {/* Mobile Cards */}
                 {filteredTransactions.map((t, index) => <TransactionCard key={t.id} transaction={t} onEdit={() => openAddEditModal(t)} onDelete={() => deleteTransaction(t.id)} style={{ animationDelay: `${index * 50}ms` }} />)}
                 {filteredTransactions.length === 0 && <p className="text-center p-8 text-content-200">{transactions.length > 0 ? "No transactions match filters." : "No transactions yet."}</p>}
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const { bottomNavViews } = useFinance();
  const [currentView, setCurrentView] = useState<View>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modal states
  const [isAddEditTransactionModalOpen, setAddEditTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [prefilledData, setPrefilledData] = useState<Partial<Transaction> | undefined>(undefined);
  const [isReceiptScannerModalOpen, setReceiptScannerModalOpen] = useState(false);

  const openAddEditModal = (transaction?: Transaction, prefill?: Partial<Transaction>) => {
    closeSidebar();
    setEditingTransaction(transaction);
    setPrefilledData(prefill);
    setAddEditTransactionModalOpen(true);
  };

  const closeAddEditModal = () => {
    setEditingTransaction(undefined);
    setPrefilledData(undefined);
    setAddEditTransactionModalOpen(false);
  };

  const openReceiptScanner = () => {
    closeSidebar();
    setReceiptScannerModalOpen(true);
  };
  
  const closeReceiptScanner = () => {
    setReceiptScannerModalOpen(false);
  }

  const handleScanComplete = (data: Partial<Transaction>) => {
    closeReceiptScanner();
    openAddEditModal(undefined, data);
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  const renderView = () => {
    const PlaceholderView: React.FC<{title: string}> = ({title}) => (
        <div className="flex items-center justify-center h-full">
            <Card className="text-center">
                <h2 className="text-2xl font-bold text-white">{title}</h2>
                <p className="text-content-200 mt-2">This feature is coming soon!</p>
            </Card>
        </div>
    );
    switch (currentView) {
      case 'DASHBOARD': return <DashboardView />;
      case 'ACCOUNTS': return <AccountsView />;
      case 'TRANSACTIONS': return <TransactionsView openAddEditModal={openAddEditModal} />;
      case 'INVESTMENTS': return <PlaceholderView title="Investments"/>;
      case 'SAVINGS': return <PlaceholderView title="Savings"/>;
      case 'ASSETS': return <PlaceholderView title="Assets"/>;
      case 'SUBSCRIPTIONS': return <PlaceholderView title="Subscriptions"/>;
      case 'BUDGETS': return <PlaceholderView title="Budgets"/>;
      case 'GOALS': return <PlaceholderView title="Goals"/>;
      case 'REPORTS': return <PlaceholderView title="Reports"/>;
      case 'INSIGHTS': return <PlaceholderView title="AI Insights"/>;
      case 'SETTINGS': return <PlaceholderView title="Settings"/>;
      default: return <DashboardView />;
    }
  };

  const NavItem: React.FC<{ item: NavItemDef; isBottomNav?: boolean }> = ({ item, isBottomNav }) => (
    <button
      onClick={() => { setCurrentView(item.view); closeSidebar(); }}
      className={classNames(
        "flex items-center gap-4 w-full text-left transition-colors duration-200 rounded-lg",
        isBottomNav ? "flex-col justify-center text-xs p-1 h-full" : "p-3 text-base",
        currentView === item.view
          ? (isBottomNav ? "text-brand-primary" : "bg-base-300 text-white font-semibold")
          : "text-content-200 hover:bg-base-200 hover:text-white"
      )}
    >
      <span className={isBottomNav ? "" : "w-6 h-6"}>{item.icon}</span>
      <span>{item.label}</span>
    </button>
  );

  const sidebarContent = (
    <div className="p-4 space-y-4 h-full flex flex-col">
      <div className="flex items-center gap-2 px-2 flex-shrink-0">
          {ICONS.logo}
          <h1 className="text-2xl font-bold text-white">FinanSage</h1>
      </div>
      <nav className="mt-8 space-y-1 flex-grow overflow-y-auto">
          {mainNavItems.map(item => <NavItem key={item.view} item={item} />)}
          <hr className="border-base-300 my-4" />
          <h3 className="px-3 text-xs font-semibold text-content-200 uppercase tracking-wider mb-2">More</h3>
          {moreNavItems.map(item => <NavItem key={item.view} item={item} />)}
      </nav>
      <div className="flex-shrink-0">
        <hr className="border-base-300 my-2" />
        <NavItem item={{ view: 'SETTINGS', label: 'Settings', icon: ICONS.settings }} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-base-100 text-content-100 font-sans flex">
      {/* Sidebar for desktop */}
      <aside className="hidden md:block w-64 bg-base-100/70 backdrop-blur-xl border-r border-base-300 flex-shrink-0">
          {sidebarContent}
      </aside>

      {/* Mobile sidebar (off-canvas) */}
      <div className={classNames(
          "fixed inset-0 z-50 md:hidden transition-transform duration-300",
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="absolute inset-0 bg-black/60" onClick={closeSidebar}></div>
        <aside className="relative w-64 bg-base-200 h-full">{sidebarContent}</aside>
      </div>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto h-screen pb-24 md:pb-8">
        {/* Mobile Header */}
        <header className="md:hidden flex justify-between items-center mb-6">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-2">
                {ICONS.logo}
                <h1 className="text-xl font-bold text-white">FinanSage</h1>
            </div>
            <div className="w-8"></div>
        </header>

        {renderView()}
      </main>

      <FloatingActionButton 
        onAddManually={() => openAddEditModal()}
        onScanReceipt={openReceiptScanner}
      />

      {/* Bottom Navigation for mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-base-200/80 backdrop-blur-lg border-t border-base-300 grid grid-cols-4 gap-1 h-20">
        {bottomNavViews.map(view => {
          const navItem = allNavItems.find(item => item.view === view);
          return navItem ? <NavItem key={view} item={navItem} isBottomNav /> : null;
        })}
      </nav>
      
      {/* Modals */}
      <Modal 
        isOpen={isAddEditTransactionModalOpen} 
        onClose={closeAddEditModal}
        title={editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
      >
        <TransactionForm 
          onClose={closeAddEditModal} 
          existingTransaction={editingTransaction} 
          prefilledData={prefilledData} 
        />
      </Modal>

      <BottomSheet
        isOpen={isReceiptScannerModalOpen}
        onClose={closeReceiptScanner}
        title="Scan Receipt"
      >
        <ReceiptScannerModal onScanComplete={handleScanComplete} />
      </BottomSheet>
    </div>
  );
};

export default App;
