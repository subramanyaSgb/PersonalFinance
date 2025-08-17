
import React, { useState, useEffect, useCallback, useMemo, createContext, useContext, useRef } from 'react';
import { Account, AccountType, Transaction, TransactionType, Category, Budget, View, Investment, InvestmentType, SavingsInstrument, SavingsType, Goal, Asset, AssetCategory, Subscription, NetWorthHistoryEntry } from './types';
import { CURRENCIES, DEFAULT_CATEGORIES, ICONS, DEFAULT_ASSET_CATEGORIES } from './constants';
import { getFinancialInsights, suggestCategory, fetchProductDetailsFromUrl, processReceiptImage, findSubscriptions } from './services/geminiService';

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
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.code, maximumFractionDigits: 0 }).format(amount);
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

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
    
    const selectedDate = new Date(value);
    
    const changeMonth = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };

    const handleDayClick = (day: number) => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        onChange(formatInputDate(newDate));
        setIsOpen(false);
    };

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const days = daysInMonth(year, month);
        const firstDay = firstDayOfMonth(year, month);
        const blanks = Array(firstDay).fill(null);
        const dayCells = Array.from({ length: days }, (_, i) => i + 1);

        return (
            <div className="absolute top-full mt-2 w-72 bg-base-200/90 backdrop-blur-md border border-base-300 rounded-xl shadow-2xl p-4 z-50 animate-slide-up">
                <div className="flex justify-between items-center mb-4">
                    <button type="button" onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-base-300">{ICONS['chevron-left']}</button>
                    <div className="font-bold text-white">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
                    <button type="button" onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-base-300">{ICONS['chevron-right']}</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-content-200">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 mt-2">
                    {blanks.map((_, i) => <div key={`blank-${i}`}></div>)}
                    {dayCells.map(day => {
                        const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
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
            </div>
        );
    };
    
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
            {isOpen && renderCalendar()}
        </div>
    );
};


const FloatingActionButton: React.FC<{
  onAddManually: () => void;
  onScanReceipt: () => void;
}> = ({ onAddManually, onScanReceipt }) => {
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
    <div ref={fabRef} className="fixed bottom-24 right-6 md:bottom-8 z-40">
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
  const { transactions, accounts, budgets, primaryCurrency, getCategoryById, getAccountById, netWorthHistory } = useFinance();
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        <Card className="lg:col-span-2">
          <h4 className="font-semibold text-content-200 text-sm">Income this month</h4>
          <p className="text-3xl font-bold text-accent-success mt-1">{formatCurrency(monthlyIncome, primaryCurrency)}</p>
        </Card>
        <Card className="lg:col-span-2">
          <h4 className="font-semibold text-content-200 text-sm">Expenses this month</h4>
          <p className="text-3xl font-bold text-accent-error mt-1">{formatCurrency(monthlyExpenses, primaryCurrency)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
        <Card className="lg:col-span-2">
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
      </div>

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

const TransactionCard: React.FC<{transaction: Transaction, onEdit: () => void, onDelete: () => void, style?: React.CSSProperties}> = ({transaction: t, onEdit, onDelete, style}) => {
    const { getCategoryById, getAccountById, primaryCurrency } = useFinance();
    const category = getCategoryById(t.categoryId);
    const account = getAccountById(t.accountId);
    const isIncome = t.type === TransactionType.INCOME;
    const isTransfer = t.type === TransactionType.TRANSFER;

    return (
        <Card key={t.id} className="p-4 animate-list-item-in" style={style}>
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 pr-2">
                    <p className="font-bold text-white break-words flex items-center gap-2">{t.receiptImage && ICONS.scan} {t.description}</p>
                    <p className={classNames("font-bold text-xl mt-1", isIncome ? 'text-accent-success' : isTransfer ? 'text-content-100' : 'text-accent-error')}>
                        {isIncome ? '+' : isTransfer ? '' : '-'} {formatCurrency(t.amount, account?.currency || primaryCurrency)}
                    </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <button className="p-2 rounded-full hover:bg-base-300" onClick={onEdit}>{ICONS.edit}</button>
                    <button className="p-2 rounded-full hover:bg-base-300" onClick={() => window.confirm(`Delete transaction: ${t.description}?`) && onDelete()}>{ICONS.trash}</button>
                </div>
            </div>
            {t.notes && <p className="text-sm text-content-200 mt-2 pt-2 border-t border-base-300">{t.notes}</p>}
            <div className="mt-3 border-t border-base-300 pt-3 text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                <div><span className="text-content-200">Category</span></div><div className="font-medium text-white text-right">{isTransfer ? 'Transfer' : category?.name || 'N/A'}</div>
                <div><span className="text-content-200">Account</span></div><div className="font-medium text-white text-right">{account?.name || 'N/A'}{isTransfer && t.toAccountId && ` -> ${getAccountById(t.toAccountId)?.name}`}</div>
                <div><span className="text-content-200">Date</span></div><div className="font-medium text-white text-right">{formatDate(t.date)}</div>
                {Array.isArray(t.tags) && t.tags.length > 0 && (
                    <React.Fragment>
                        <div className="mt-1"><span className="text-content-200">Tags</span></div>
                        <div className="flex flex-wrap gap-1 justify-end max-w-full mt-1">
                            {t.tags.map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 text-xs rounded-full bg-base-100 text-content-100 font-medium">{tag}</span>
                            ))}
                        </div>
                    </React.Fragment>
                )}
            </div>
        </Card>
    );
}

const BudgetsView: React.FC = () => {
    const { budgets, setBudgets, categories, transactions, getCategoryById, primaryCurrency } = useFinance();
    const [newBudget, setNewBudget] = useState<{ categoryId: string; amount: string }>({ categoryId: '', amount: '' });
    
    const handleAddBudget = (e: React.FormEvent) => {
        e.preventDefault();
        if (newBudget.categoryId && newBudget.amount) {
            if (budgets.some(b => b.categoryId === newBudget.categoryId)) return alert("A budget for this category already exists.");
            setBudgets(prev => [...prev, { id: generateId(), categoryId: newBudget.categoryId, amount: parseFloat(newBudget.amount), period: 'monthly' }]);
            setNewBudget({ categoryId: '', amount: '' });
        }
    };
    
    const budgetStatus = useMemo(() => {
        const monthlyExpenses = transactions.filter(t => t.type === TransactionType.EXPENSE && new Date(t.date).getMonth() === new Date().getMonth()).reduce((acc, t) => {
            acc[t.categoryId] = (acc[t.categoryId] || 0) + t.amount;
            return acc;
        }, {} as { [key: string]: number });
        return budgets.map(b => {
          const spent = monthlyExpenses[b.categoryId] || 0;
          return { ...b, categoryName: getCategoryById(b.categoryId)?.name || 'Unknown', spent, remaining: b.amount - spent, progress: Math.min((spent / b.amount) * 100, 100) };
        }).sort((a,b) => b.progress - a.progress);
      }, [transactions, budgets, getCategoryById]);

    return (
        <div className="animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-8">Budgets</h2>
            <Card className="mb-8"><h3 className="text-lg font-bold text-white mb-4">Add New Budget</h3>
                <form onSubmit={handleAddBudget} className="flex flex-col sm:flex-row gap-3">
                    <select value={newBudget.categoryId} onChange={e => setNewBudget({...newBudget, categoryId: e.target.value})} className="flex-grow bg-base-100 p-3 rounded-lg text-white border border-base-300"><option value="">Select Category</option>{categories.filter(c => c.type === TransactionType.EXPENSE && c.name !== 'Goal Contributions').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <input type="number" placeholder="Monthly Amount" value={newBudget.amount} onChange={e => setNewBudget({...newBudget, amount: e.target.value})} className="bg-base-100 p-3 rounded-lg text-white border border-base-300" />
                    <Button type="submit">{ICONS.plus}Add Budget</Button>
                </form>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {budgetStatus.map(b => (
                    <Card key={b.id}>
                        <div className="flex justify-between items-center"><h4 className="text-lg font-bold text-white">{b.categoryName}</h4><Button variant="danger" className="p-1.5" onClick={() => window.confirm(`Are you sure you want to delete the budget for ${b.categoryName}?`) && setBudgets(p => p.filter(budget => budget.id !== b.id))}>{ICONS.trash}</Button></div>
                        <div className="mt-4">
                            <div className="w-full bg-base-300 rounded-full h-3"><div className={classNames("h-3 rounded-full text-[10px] text-white text-center flex items-center justify-center", b.progress > 85 ? 'bg-accent-error' : b.progress > 60 ? 'bg-accent-warning' : 'bg-gradient-to-r from-brand-gradient-from to-brand-gradient-to')} style={{ width: `${b.progress}%` }}></div></div>
                            <div className="mt-2 text-sm text-content-200"><span>Spent: {formatCurrency(b.spent, primaryCurrency)}</span><span className="mx-2">|</span><span>Remaining: <span className={b.remaining < 0 ? 'text-accent-error' : 'text-accent-success'}>{formatCurrency(b.remaining, primaryCurrency)}</span></span></div>
                        </div>
                    </Card>
                ))}
                {budgetStatus.length === 0 && <p className="text-center p-8 text-content-200">No budgets created yet.</p>}
            </div>
        </div>
    );
};

const GoalForm: React.FC<{onClose: () => void; existingGoal?: Goal}> = ({onClose, existingGoal}) => {
    const { addGoal, updateGoal } = useFinance();
    const [goal, setGoal] = useState<Partial<Goal>>(existingGoal || { name: '', targetAmount: 0 });
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setGoal(p => ({...p, [e.target.name]: e.target.name === 'targetAmount' ? parseFloat(e.target.value) : e.target.value }));
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { name, targetAmount, targetDate } = goal;
        if (!name || !targetAmount || !targetDate) return alert("Please fill all fields.");
        if (existingGoal) updateGoal({ ...existingGoal, name, targetAmount, targetDate });
        else addGoal({ name, targetAmount, targetDate });
        onClose();
    };
    const inputClasses = "w-full bg-base-100/50 p-3 rounded-lg text-white border border-base-300 focus:ring-2 focus:ring-brand-gradient-to focus:border-transparent";
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" name="name" placeholder="Goal Name (e.g., New Car)" value={goal.name || ''} onChange={handleChange} required className={inputClasses} />
            <input type="number" step="0.01" name="targetAmount" placeholder="Target Amount" value={goal.targetAmount || ''} onChange={handleChange} required className={inputClasses} />
            <div>
                <label className="text-sm text-content-200">Target Date</label>
                <CustomDatePicker value={goal.targetDate || ''} onChange={(date) => setGoal(p => ({...p, targetDate: date}))} />
            </div>
            <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">{existingGoal ? 'Update' : 'Create'} Goal</Button></div>
        </form>
    );
};

const ContributeForm: React.FC<{onClose: () => void; goal: Goal}> = ({onClose, goal}) => {
    const { accounts, makeGoalContribution, primaryCurrency } = useFinance();
    const [amount, setAmount] = useState(0);
    const [fromAccountId, setFromAccountId] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0 || !fromAccountId) return alert("Please enter a valid amount and select an account.");
        const account = accounts.find(a => a.id === fromAccountId);
        if (account && account.balance < amount && !window.confirm("This contribution exceeds the account balance. Proceed anyway?")) return;
        makeGoalContribution(goal.id, amount, fromAccountId);
        onClose();
    };
    const inputClasses = "w-full bg-base-100/50 p-3 rounded-lg text-white border border-base-300 focus:ring-2 focus:ring-brand-gradient-to focus:border-transparent";
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div><h4 className="text-lg font-bold text-white">{goal.name}</h4><p className="text-sm text-content-200">Progress: {formatCurrency(goal.currentAmount, primaryCurrency)} / {formatCurrency(goal.targetAmount, primaryCurrency)}</p></div>
            <input type="number" step="0.01" placeholder="Contribution Amount" value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value))} required className={inputClasses} />
            <select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)} required className={inputClasses}><option value="">From Account</option>{accounts.filter(acc => acc.type !== AccountType.LOAN).map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, a.currency)})</option>)}</select>
            <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Contribute</Button></div>
        </form>
    );
};

const GoalsView: React.FC = () => {
    const { goals, deleteGoal, primaryCurrency } = useFinance();
    const [isAddEditModalOpen, setAddEditModalOpen] = useState(false);
    const [isContributeModalOpen, setContributeModalOpen] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState<Goal | undefined>(undefined);

    const openAddEditModal = (goal?: Goal) => { setSelectedGoal(goal); setAddEditModalOpen(true); };
    const openContributeModal = (goal: Goal) => { setSelectedGoal(goal); setContributeModalOpen(true); };
    const closeModal = () => { setSelectedGoal(undefined); setAddEditModalOpen(false); setContributeModalOpen(false); };

    const getMonthsRemaining = (targetDate: string) => {
        const today = new Date(); today.setHours(0,0,0,0);
        const target = new Date(targetDate); target.setHours(0,0,0,0);
        if (target <= today) return 0;
        let months = (target.getFullYear() - today.getFullYear()) * 12 - today.getMonth() + target.getMonth();
        return months <= 0 ? 1 : months + 1;
    };

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white">Financial Goals</h2><Button onClick={() => openAddEditModal()}>{ICONS.plus}<span className="hidden sm:inline">Add New Goal</span></Button>
            </div>
            <Card className="mb-8"><h4 className="font-semibold text-content-200 text-sm">Total Saved Towards Goals</h4><p className="text-3xl font-bold text-accent-success mt-1">{formatCurrency(goals.reduce((sum, g) => sum + g.currentAmount, 0), primaryCurrency)}</p></Card>
            {goals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {goals.map(goal => {
                        const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 100;
                        const monthsRemaining = getMonthsRemaining(goal.targetDate);
                        const requiredMonthly = monthsRemaining > 0 && goal.currentAmount < goal.targetAmount ? (goal.targetAmount - goal.currentAmount) / monthsRemaining : 0;
                        return (
                            <Card key={goal.id} className="flex flex-col">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1"><h3 className="text-lg font-bold text-white truncate pr-2" title={goal.name}>{goal.name}</h3><p className="text-xs text-content-200">Target: {formatDate(goal.targetDate)}</p></div>
                                    <div className="flex gap-1.5 flex-shrink-0"><Button variant="secondary" className="p-1.5" onClick={() => openAddEditModal(goal)}>{ICONS.edit}</Button><Button variant="danger" className="p-1.5" onClick={() => window.confirm(`Delete goal: ${goal.name}?`) && deleteGoal(goal.id)}>{ICONS.trash}</Button></div>
                                </div>
                                <div className="mt-4 flex-grow">
                                    <div className="w-full bg-base-300 rounded-full h-3"><div className="bg-brand-gradient from-brand-gradient-from to-brand-gradient-to h-3 rounded-full text-[10px] text-white flex items-center justify-center" style={{ width: `${progress}%` }}></div></div>
                                    <div className="flex justify-between text-sm mt-2"><span className="text-white font-semibold">{formatCurrency(goal.currentAmount, primaryCurrency)}</span><span className="text-content-200">{formatCurrency(goal.targetAmount, primaryCurrency)}</span></div>
                                    {requiredMonthly > 0 && <div className="text-xs text-center mt-3 bg-base-100 p-1.5 rounded-md">Save <span className="font-bold text-accent-warning">{formatCurrency(requiredMonthly, primaryCurrency)}</span>/month to stay on track</div>}
                                </div>
                                <div className="mt-4 pt-4 border-t border-base-300"><Button onClick={() => openContributeModal(goal)} className="w-full">Contribute</Button></div>
                            </Card>
                        )
                    })}
                </div>
            ) : <div className="text-center py-16"><p className="text-content-200">No goals set yet. Create your first goal to start saving for your dreams!</p></div>}
            <Modal isOpen={isAddEditModalOpen} onClose={closeModal} title={selectedGoal ? 'Edit Goal' : 'Add New Goal'}><GoalForm onClose={closeModal} existingGoal={selectedGoal}/></Modal>
            {selectedGoal && <Modal isOpen={isContributeModalOpen} onClose={closeModal} title={`Contribute to ${selectedGoal.name}`}><ContributeForm onClose={closeModal} goal={selectedGoal}/></Modal>}
        </div>
    );
};


const InsightsView: React.FC = () => {
    const { transactions, accounts, categories } = useFinance();
    const [insights, setInsights] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fetchInsights = useCallback(async () => {
        setIsLoading(true);
        setInsights('');
        const result = await getFinancialInsights(transactions, accounts, categories);
        setInsights(result);
        setIsLoading(false);
    }, [transactions, accounts, categories]);

    useEffect(() => {
        if (import.meta.env.VITE_API_KEY) fetchInsights();
        else setInsights("This feature requires an API key. Please set the `VITE_API_KEY` environment variable to use AI insights.");
    }, [fetchInsights]);

    const InsightSkeleton = () => (
        <div className="space-y-6">
            <SkeletonLoader className="h-8 w-3/4" />
            <div className="space-y-3">
                <SkeletonLoader className="h-4 w-full" />
                <SkeletonLoader className="h-4 w-5/6" />
            </div>
            <SkeletonLoader className="h-6 w-1/2 mt-6" />
            <div className="space-y-3">
                <SkeletonLoader className="h-4 w-full" />
                <SkeletonLoader className="h-4 w-full" />
                <SkeletonLoader className="h-4 w-4/6" />
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-8"><h2 className="text-3xl font-bold text-white">AI Financial Insights</h2><Button onClick={fetchInsights} disabled={isLoading}>{isLoading ? 'Analyzing...' : 'Refresh Insights'}</Button></div>
            <Card hasGlow>
                {isLoading ? <InsightSkeleton /> : <div className="prose prose-invert max-w-none text-content-100 leading-relaxed space-y-2" dangerouslySetInnerHTML={{ __html: insights.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>').replace(/## (.*)/g, '<h2 class="text-xl font-bold mt-6 mb-2 text-white">$1</h2>').replace(/# (.*)/g, '<h1 class="text-2xl font-bold mt-8 mb-3 text-white">$1</h1>').replace(/\* (.*)/g, '<li class="ml-5 list-disc">$1</li>').replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>').replace(/\n/g, '<br />') }}></div>}
            </Card>
        </div>
    );
};

const InvestmentForm: React.FC<{onClose: () => void; existingInvestment?: Investment}> = ({onClose, existingInvestment}) => {
    const { addInvestment, updateInvestment } = useFinance();
    const [investment, setInvestment] = useState<Partial<Investment>>(existingInvestment || { type: InvestmentType.STOCK, units: 0, purchasePrice: 0, currentPrice: 0 });
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setInvestment(p => ({ ...p, [e.target.name]: ['units', 'purchasePrice', 'currentPrice'].includes(e.target.name) ? parseFloat(e.target.value) : e.target.value }));
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = { ...investment, purchaseDate: investment.purchaseDate ? new Date(investment.purchaseDate).toISOString() : new Date().toISOString() };
        if (existingInvestment) updateInvestment(data as Investment); else addInvestment(data as Omit<Investment, 'id'>);
        onClose();
    };
    const inputClasses = "w-full bg-base-100/50 p-3 rounded-lg text-white border border-base-300 focus:ring-2 focus:ring-brand-gradient-to focus:border-transparent";
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" name="name" placeholder="Investment Name (e.g. Apple Inc.)" value={investment.name || ''} onChange={handleChange} required className={inputClasses} />
            <select name="type" value={investment.type} onChange={handleChange} className={inputClasses}>{Object.values(InvestmentType).map(t => <option key={t} value={t}>{t}</option>)}</select>
            <input type="number" step="any" name="units" placeholder="Units / Shares" value={investment.units || ''} onChange={handleChange} required className={inputClasses} />
            <input type="number" step="any" name="purchasePrice" placeholder="Purchase Price / NAV" value={investment.purchasePrice || ''} onChange={handleChange} required className={inputClasses} />
            <input type="number" step="any" name="currentPrice" placeholder="Current Price / NAV" value={investment.currentPrice || ''} onChange={handleChange} required className={inputClasses} />
            <CustomDatePicker value={investment.purchaseDate || ''} onChange={date => setInvestment(p => ({ ...p, purchaseDate: date}))} />
            <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">{existingInvestment ? 'Update' : 'Add'} Investment</Button></div>
        </form>
    );
};

const InvestmentsView: React.FC = () => {
    const { investments, deleteInvestment, primaryCurrency } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingInvestment, setEditingInvestment] = useState<Investment | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const openModal = (investment?: Investment) => { setEditingInvestment(investment); setIsModalOpen(true); };
    const closeModal = () => { setEditingInvestment(undefined); setIsModalOpen(false); };
    const filteredInvestments = useMemo(() => investments.filter(inv => inv.name.toLowerCase().includes(searchTerm.toLowerCase())), [investments, searchTerm]);
    const totalInvested = useMemo(() => investments.reduce((sum, i) => sum + i.purchasePrice * i.units, 0), [investments]);
    const totalCurrentValue = useMemo(() => investments.reduce((sum, i) => sum + i.currentPrice * i.units, 0), [investments]);
    const totalPL = totalCurrentValue - totalInvested;
    return (
        <div className="animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white self-start md:self-center">Investments</h2>
                 <div className="flex items-center gap-3 w-full md:w-auto"><div className="relative flex-grow"><input type="text" placeholder="Search investments..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-base-200/80 p-3 pl-10 rounded-xl text-white border border-base-300" /><div className="absolute left-3 top-1/2 -translate-y-1/2 text-content-200">{ICONS.search}</div></div><Button onClick={() => openModal()} className="flex-shrink-0">{ICONS.plus}<span className="hidden sm:inline">Add Investment</span></Button></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"><Card><h4 className="font-semibold text-content-200 text-sm">Total Invested</h4><p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalInvested, primaryCurrency)}</p></Card><Card><h4 className="font-semibold text-content-200 text-sm">Current Value</h4><p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalCurrentValue, primaryCurrency)}</p></Card><Card hasGlow={totalPL !== 0}><h4 className="font-semibold text-content-200 text-sm">Overall P/L</h4><p className={classNames("text-2xl font-bold mt-1", totalPL >= 0 ? 'text-accent-success':'text-accent-error')}>{totalPL >= 0 ? '+' : ''}{formatCurrency(totalPL, primaryCurrency)}</p></Card></div>
            {filteredInvestments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredInvestments.map(inv => { const invested = inv.purchasePrice * inv.units; const currentValue = inv.currentPrice * inv.units; const pAndL = currentValue - invested; return (
                    <Card key={inv.id}><div className="flex flex-col h-full"><div className="flex justify-between items-start gap-2"><div className="flex-1"><h3 className="text-lg font-bold text-white truncate pr-2" title={inv.name}>{inv.name}</h3><span className="text-xs bg-base-300 text-content-100 px-1.5 py-0.5 rounded">{inv.type}</span></div><div className="flex gap-1.5 flex-shrink-0"><Button variant="secondary" className="p-1.5" onClick={() => openModal(inv)}>{ICONS.edit}</Button><Button variant="danger" className="p-1.5" onClick={() => window.confirm(`Are you sure you want to delete ${inv.name}?`) && deleteInvestment(inv.id)}>{ICONS.trash}</Button></div></div><div className="flex-grow mt-3 pt-3 border-t border-base-300 grid grid-cols-2 gap-y-2 gap-x-4 text-sm"><div><span className="text-content-200 block">Invested</span> <span className="font-semibold text-white text-base">{formatCurrency(invested, primaryCurrency)}</span></div><div><span className="text-content-200 block">Current Value</span> <span className="font-semibold text-white text-base">{formatCurrency(currentValue, primaryCurrency)}</span></div><div><span className="text-content-200 block">P/L</span> <span className={classNames("font-semibold text-base", pAndL >= 0 ? 'text-accent-success':'text-accent-error')}>{pAndL >= 0 ? '+' : ''}{formatCurrency(pAndL, primaryCurrency)}</span></div><div><span className="text-content-200 block">Units</span> <span className="font-semibold text-white text-base">{inv.units}</span></div></div></div></Card>
                )})}</div>
            ) : <div className="text-center py-16"><p className="text-content-200">{investments.length > 0 ? "No investments match search." : "No investments found."}</p></div>}
            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingInvestment ? 'Edit Investment' : 'Add Investment'}><InvestmentForm onClose={closeModal} existingInvestment={editingInvestment}/></Modal>
        </div>
    );
};

const SavingsForm: React.FC<{onClose: () => void; existingSaving?: SavingsInstrument}> = ({onClose, existingSaving}) => {
    const { addSaving, updateSaving } = useFinance();
    const [saving, setSaving] = useState<Partial<SavingsInstrument>>(existingSaving || { type: SavingsType.FD, principal: 0, interestRate: 0 });
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSaving(p => ({ ...p, [e.target.name]: ['principal', 'interestRate', 'maturityAmount'].includes(e.target.name) ? parseFloat(e.target.value) : e.target.value }));
    
    const handleCalculateMaturity = () => {
        const { type, principal, interestRate, depositDate, maturityDate } = saving;
        if (!type || !principal || !interestRate || !depositDate || !maturityDate) {
            alert("Please fill in Principal, Interest Rate, and both dates to calculate.");
            return;
        }

        const tenureMonths = getMonthsBetween(depositDate, maturityDate);
        if (tenureMonths <= 0) {
            alert("Maturity Date must be after Deposit Date.");
            return;
        }

        let calculatedAmount = 0;
        const rate = interestRate / 100;

        if (type === SavingsType.FD) {
            const tenureYears = tenureMonths / 12;
            calculatedAmount = principal * Math.pow(1 + rate / 4, 4 * tenureYears);
        } else { // SavingsType.RD
            const monthlyRate = rate / 12;
            const n = tenureMonths;
            calculatedAmount = principal * ((Math.pow(1 + monthlyRate, n) - 1) / monthlyRate) * (1 + monthlyRate);
        }
        
        setSaving(p => ({ ...p, maturityAmount: parseFloat(calculatedAmount.toFixed(2)) }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = { ...saving, depositDate: saving.depositDate ? new Date(saving.depositDate).toISOString() : new Date().toISOString(), maturityDate: saving.maturityDate ? new Date(saving.maturityDate).toISOString() : new Date().toISOString() };
        if (existingSaving) updateSaving(data as SavingsInstrument); else addSaving(data as Omit<SavingsInstrument, 'id'>);
        onClose();
    };
    const inputClasses = "w-full bg-base-100/50 p-3 rounded-lg text-white border border-base-300 focus:ring-2 focus:ring-brand-gradient-to focus:border-transparent";
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <select name="type" value={saving.type} onChange={handleChange} className={inputClasses}>{Object.values(SavingsType).map(t => <option key={t} value={t}>{t}</option>)}</select>
            <input type="text" name="bankName" placeholder="Bank Name" value={saving.bankName || ''} onChange={handleChange} required className={inputClasses} />
            <input type="text" name="accountNumber" placeholder="Account Number" value={saving.accountNumber || ''} onChange={handleChange} required className={inputClasses} />
            <input type="number" step="any" name="principal" placeholder={saving.type === SavingsType.RD ? "Monthly Installment" : "Principal Amount"} value={saving.principal || ''} onChange={handleChange} required className={inputClasses} />
            <input type="number" step="any" name="interestRate" placeholder="Interest Rate (%)" value={saving.interestRate || ''} onChange={handleChange} required className={inputClasses} />
            
            <div className="flex items-end gap-2">
                <div className="flex-grow">
                    <label className="text-sm text-content-200">Maturity Amount (Optional)</label>
                    <input type="number" step="any" name="maturityAmount" placeholder="Expected return" value={saving.maturityAmount || ''} onChange={handleChange} className={inputClasses} />
                </div>
                <Button type="button" variant="secondary" onClick={handleCalculateMaturity} className="h-[52px] whitespace-nowrap !px-3">Calculate</Button>
            </div>
            
            <div><label className="text-sm text-content-200">Deposit Date</label><CustomDatePicker value={saving.depositDate || ''} onChange={date => setSaving(p => ({...p, depositDate: date}))}/></div>
            <div><label className="text-sm text-content-200">Maturity Date</label><CustomDatePicker value={saving.maturityDate || ''} onChange={date => setSaving(p => ({...p, maturityDate: date}))}/></div>
            <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">{existingSaving ? 'Update' : 'Add'} Savings</Button></div>
        </form>
    );
};

const SavingsView: React.FC = () => {
    const { savings, deleteSaving, primaryCurrency } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSaving, setEditingSaving] = useState<SavingsInstrument | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const openModal = (saving?: SavingsInstrument) => { setEditingSaving(saving); setIsModalOpen(true); };
    const closeModal = () => { setEditingSaving(undefined); setIsModalOpen(false); };
    const filteredSavings = useMemo(() => savings.filter(s => s.bankName.toLowerCase().includes(searchTerm.toLowerCase())), [savings, searchTerm]);

    const totalPrincipal = useMemo(() => {
        return savings.reduce((sum, s) => {
            if (s.type === SavingsType.FD) {
                return sum + s.principal;
            } else { // RD
                const tenureMonths = getMonthsBetween(s.depositDate, s.maturityDate);
                return sum + (s.principal * tenureMonths);
            }
        }, 0);
    }, [savings]);

    const totalMaturityValue = useMemo(() => {
        return savings.reduce((sum, s) => sum + (s.maturityAmount || 0), 0);
    }, [savings]);

    return (
        <div className="animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white self-start md:self-center">Savings (FD/RD)</h2>
                 <div className="flex items-center gap-3 w-full md:w-auto"><div className="relative flex-grow"><input type="text" placeholder="Search by bank name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-base-200/80 p-3 pl-10 rounded-xl text-white border border-base-300" /><div className="absolute left-3 top-1/2 -translate-y-1/2 text-content-200">{ICONS.search}</div></div><Button onClick={() => openModal()} className="flex-shrink-0">{ICONS.plus}<span className="hidden sm:inline">Add Savings</span></Button></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card>
                    <h4 className="font-semibold text-content-200 text-sm">Total Principal Invested</h4>
                    <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalPrincipal, primaryCurrency)}</p>
                </Card>
                <Card hasGlow={totalMaturityValue > totalPrincipal}>
                    <h4 className="font-semibold text-content-200 text-sm">Total Expected Return</h4>
                    <p className={classNames("text-2xl font-bold mt-1", totalMaturityValue > totalPrincipal ? 'text-accent-success' : 'text-content-100')}>{formatCurrency(totalMaturityValue, primaryCurrency)}</p>
                </Card>
            </div>

            {filteredSavings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredSavings.map(s => {
                    const tenureMonths = getMonthsBetween(s.depositDate, s.maturityDate);
                    const totalInvested = s.type === SavingsType.FD ? s.principal : s.principal * tenureMonths;
                    const interestEarned = s.maturityAmount ? s.maturityAmount - totalInvested : 0;
                    return (
                    <Card key={s.id}><div className="flex flex-col h-full"><div className="flex justify-between items-start gap-2"><div className="flex-1"><h3 className="text-lg font-bold text-white truncate pr-2" title={s.bankName}>{s.bankName}</h3><p className="text-sm text-content-200 truncate pr-2">{s.accountNumber}</p></div><div className="flex gap-1.5 flex-shrink-0"><Button variant="secondary" className="p-1.5" onClick={() => openModal(s)}>{ICONS.edit}</Button><Button variant="danger" className="p-1.5" onClick={() => window.confirm(`Are you sure you want to delete this saving instrument?`) && deleteSaving(s.id)}>{ICONS.trash}</Button></div></div>
                    <div className="flex-grow mt-3 pt-3 border-t border-base-300 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                        <div><span className="text-content-200 block">{s.type === SavingsType.RD ? "Installment" : "Principal"}</span> <span className="font-semibold text-white text-base">{formatCurrency(s.principal, primaryCurrency)}</span></div>
                        <div><span className="text-content-200 block">Interest Rate</span> <span className="font-semibold text-white text-base">{s.interestRate}%</span></div>
                        <div><span className="text-content-200 block">Deposit Date</span> <span className="font-semibold text-white">{formatDate(s.depositDate)}</span></div>
                        <div><span className="text-content-200 block">Maturity Date</span> <span className="font-semibold text-white">{formatDate(s.maturityDate)}</span></div>
                        {s.maturityAmount && s.maturityAmount > 0 && (
                            <>
                                <div className="col-span-2 my-2 border-t border-base-300"></div>
                                <div><span className="text-content-200 block">Maturity Value</span><span className="font-semibold text-accent-success text-base">{formatCurrency(s.maturityAmount, primaryCurrency)}</span></div>
                                <div><span className="text-content-200 block">Interest Earned</span><span className="font-semibold text-accent-success text-base">{formatCurrency(interestEarned, primaryCurrency)}</span></div>
                            </>
                        )}
                    </div></div></Card>
                )})}</div>
            ) : <div className="text-center py-16"><p className="text-content-200">{savings.length > 0 ? "No savings match search." : "No FDs or RDs found."}</p></div>}
            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingSaving ? 'Edit Savings' : 'Add Savings'}><SavingsForm onClose={closeModal} existingSaving={editingSaving}/></Modal>
        </div>
    );
};

const AssetForm: React.FC<{onClose: () => void; existingAsset?: Asset}> = ({onClose, existingAsset}) => {
    const { assetCategories, addAsset, updateAsset } = useFinance();
    const [entryMode, setEntryMode] = useState<'url' | 'manual'>(existingAsset ? 'manual' : 'url');
    const [assetData, setAssetData] = useState<Partial<Asset>>(existingAsset || { purchaseDate: new Date().toISOString() });
    const [isFetching, setIsFetching] = useState(false);
    const [url, setUrl] = useState('');
    const inputClasses = "w-full bg-base-100/50 p-3 rounded-lg text-white border border-base-300 focus:ring-2 focus:ring-brand-gradient-to focus:border-transparent";

    const handleFetchDetails = async () => {
        if (!url) return alert("Please enter a URL.");
        setIsFetching(true);
        try {
            const details = await fetchProductDetailsFromUrl(url);
            if (details) {
                setAssetData(prev => ({...prev, ...details}));
                setEntryMode('manual');
            } else {
                alert("Could not fetch details from URL. Please enter them manually.");
                setEntryMode('manual');
            }
        } catch (error) {
            console.error(error);
            alert("An error occurred. Please enter details manually.");
            setEntryMode('manual');
        } finally {
            setIsFetching(false);
        }
    };
    
    const handleFileSelect = (base64: string) => {
        setAssetData(prev => ({ ...prev, imageUrl: base64 }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setAssetData(p => ({ ...p, [name]: name === 'purchasePrice' ? parseFloat(value) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { name, purchasePrice, categoryId, purchaseDate } = assetData;
        if (!name || !purchasePrice || !categoryId || !purchaseDate) return alert("Please fill all required fields.");
        if(existingAsset) {
            updateAsset(assetData as Asset);
        } else {
            addAsset(assetData as Omit<Asset, 'id'>);
        }
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2 p-1 bg-base-100 rounded-lg">
                <button type="button" onClick={() => setEntryMode('url')} className={classNames('w-full p-2 rounded-md', entryMode === 'url' ? 'bg-base-300 text-white' : 'text-content-200')}>Fetch from URL</button>
                <button type="button" onClick={() => setEntryMode('manual')} className={classNames('w-full p-2 rounded-md', entryMode === 'manual' ? 'bg-base-300 text-white' : 'text-content-200')}>Manual Entry</button>
            </div>
            
            {entryMode === 'url' ? (
                <div className="space-y-4 pt-4">
                    <input type="url" placeholder="https://www.amazon.in/dp/B0CQ32S54D" value={url} onChange={e => setUrl(e.target.value)} className={inputClasses} />
                    <Button type="button" onClick={handleFetchDetails} disabled={isFetching} className="w-full">
                        {isFetching ? <SkeletonLoader className="h-4 w-20" /> : ICONS.link}
                        {isFetching ? "Fetching..." : "Fetch Details"}
                    </Button>
                </div>
            ) : (
                <div className="space-y-4 animate-fade-in">
                    {assetData.imageUrl && <img src={assetData.imageUrl} alt="Asset preview" className="w-full h-48 object-contain rounded-md bg-base-100"/>}
                    <input type="text" name="name" placeholder="Asset Name" value={assetData.name || ''} onChange={handleChange} required className={inputClasses} />
                    <textarea name="description" placeholder="Description (optional)" value={assetData.description || ''} onChange={handleChange} className={classNames(inputClasses, "h-20 resize-y")} />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="number" step="0.01" name="purchasePrice" placeholder="Price" value={assetData.purchasePrice || ''} onChange={handleChange} required className={inputClasses} />
                        <CustomDatePicker value={assetData.purchaseDate || ''} onChange={date => setAssetData(p => ({...p, purchaseDate: date}))} />
                    </div>
                    <select name="categoryId" value={assetData.categoryId || ''} onChange={handleChange} required className={inputClasses}><option value="">Select Category</option>{assetCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <input type="text" name="purchaseLocation" placeholder="Purchase Location (e.g., Amazon, Local Store)" value={assetData.purchaseLocation || ''} onChange={handleChange} className={inputClasses} />
                    <input type="text" name="productUrl" placeholder="Product URL (optional)" value={assetData.productUrl || ''} onChange={handleChange} className={inputClasses} />
                    
                    <div className="flex justify-center gap-4">
                        <FileInputButton onFileSelect={handleFileSelect} capture="environment">{ICONS.camera}Take Photo</FileInputButton>
                        <FileInputButton onFileSelect={handleFileSelect}>{ICONS.upload}Upload</FileInputButton>
                    </div>

                    <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">{existingAsset ? 'Update' : 'Add'} Asset</Button></div>
                </div>
            )}
        </form>
    );
};

const AssetsView: React.FC = () => {
    const { assets, getAssetCategoryById, deleteAsset, primaryCurrency } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | undefined>(undefined);
    
    const openModal = (asset?: Asset) => { setEditingAsset(asset); setIsModalOpen(true); };
    const closeModal = () => { setEditingAsset(undefined); setIsModalOpen(false); };

    const assetsByCategory = useMemo(() => {
        const grouped: {[key: string]: Asset[]} = {};
        assets.forEach(asset => {
            const category = getAssetCategoryById(asset.categoryId);
            const categoryName = category?.name || 'Uncategorized';
            if(!grouped[categoryName]) grouped[categoryName] = [];
            grouped[categoryName].push(asset);
        });
        return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
    }, [assets, getAssetCategoryById]);
    
    const totalAssetValue = useMemo(() => assets.reduce((sum, asset) => sum + asset.purchasePrice, 0), [assets]);

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white">Assets</h2><Button onClick={() => openModal()}>{ICONS.plus}Add New Asset</Button>
            </div>
            <Card className="mb-8"><h4 className="font-semibold text-content-200 text-sm">Total Asset Value (at purchase)</h4><p className="text-3xl font-bold text-white mt-1">{formatCurrency(totalAssetValue, primaryCurrency)}</p></Card>

            {assets.length > 0 ? (
                <div className="space-y-8">
                    {assetsByCategory.map(([categoryName, categoryAssets]) => (
                        <div key={categoryName}>
                            <h3 className="text-2xl font-bold text-white mb-4 border-b border-base-300 pb-2">{categoryName}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {categoryAssets.map(asset => (
                                    <Card key={asset.id} className="p-0 flex flex-col group">
                                        <img src={asset.imageUrl || `https://via.placeholder.com/300x200/1A1A1A/A1A1A1?text=${encodeURIComponent(asset.name)}`} alt={asset.name} className="w-full h-40 object-cover rounded-t-2xl"/>
                                        <div className="p-4 flex flex-col flex-grow">
                                            <div className="flex justify-between items-start gap-2">
                                                <h4 className="font-bold text-white flex-1 truncate" title={asset.name}>{asset.name}</h4>
                                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="secondary" className="p-1.5" onClick={() => openModal(asset)}>{ICONS.edit}</Button><Button variant="danger" className="p-1.5" onClick={() => window.confirm(`Are you sure you want to delete asset: ${asset.name}?`) && deleteAsset(asset.id)}>{ICONS.trash}</Button></div>
                                            </div>
                                            <p className="text-xl font-light text-white mt-2">{formatCurrency(asset.purchasePrice, primaryCurrency)}</p>
                                            <div className="text-sm text-content-200 mt-2 flex-grow">
                                                Purchased: {formatDate(asset.purchaseDate)}
                                                {asset.purchaseLocation && ` from ${asset.purchaseLocation}`}
                                            </div>
                                            {asset.productUrl && <a href={asset.productUrl} target="_blank" rel="noopener noreferrer" className="text-brand-gradient-to text-sm mt-3 hover:underline">View Product &rarr;</a>}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : <div className="text-center py-16"><p className="text-content-200">No assets tracked yet. Add your valuable items to see them here.</p></div>}
            
            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingAsset ? 'Edit Asset' : 'Add New Asset'}>
                <AssetForm onClose={closeModal} existingAsset={editingAsset}/>
            </Modal>
        </div>
    );
};

const SubscriptionsView: React.FC = () => {
    const { subscriptions, transactions, categories, getCategoryById, deleteSubscription, primaryCurrency, addSubscription } = useFinance();
    const [isLoading, setIsLoading] = useState(false);
    const [potentialSubscriptions, setPotentialSubscriptions] = useState<any[]>([]);
    const [scanPerformed, setScanPerformed] = useState(false);

    const handleScan = async () => {
        setIsLoading(true);
        setPotentialSubscriptions([]);
        setScanPerformed(true);
        const result = await findSubscriptions(transactions, categories);
        // Filter out subscriptions that are already tracked by name
        const trackedNames = new Set(subscriptions.map(s => s.name.toLowerCase()));
        const newPotential = result.filter(p => p.name && !trackedNames.has(p.name.toLowerCase()));
        setPotentialSubscriptions(newPotential);
        setIsLoading(false);
    };
    
    const handleAddSubscription = (potentialSub: any) => {
        const category = categories.find(c => c.name === potentialSub.categorySuggestion) || categories.find(c => c.name === 'Subscriptions');
        
        let lastPaymentDate;
        try {
            // Fix for dates that might not have hyphens
            const dateStr = potentialSub.lastPaymentDate.replace(/\s/g, '-');
            lastPaymentDate = new Date(dateStr);
            if (isNaN(lastPaymentDate.getTime())) throw new Error("Invalid date");
        } catch(e) {
            console.error("Invalid last payment date from Gemini:", potentialSub.lastPaymentDate);
            alert("Could not add subscription due to an invalid date received from the AI. Please add it manually.");
            return;
        }

        const nextPaymentDate = new Date(lastPaymentDate);
        
        if (potentialSub.frequency === 'monthly') {
            const originalDay = nextPaymentDate.getDate();
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
            // If the day changed, it means we rolled over, so go to the last day of the correct month
            if (nextPaymentDate.getDate() !== originalDay) {
                nextPaymentDate.setDate(0);
            }
        } else if (potentialSub.frequency === 'yearly') {
            nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
        } else { // weekly
            nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);
        }

        const newSub: Omit<Subscription, 'id'> = {
            name: potentialSub.name,
            amount: potentialSub.amount,
            frequency: potentialSub.frequency,
            categoryId: category?.id || categories.find(c => c.type === TransactionType.EXPENSE)!.id,
            nextPaymentDate: nextPaymentDate.toISOString(),
        };
        addSubscription(newSub);
        setPotentialSubscriptions(prev => prev.filter(p => p.name !== potentialSub.name));
    }
    
    const totalMonthlyCost = useMemo(() => {
        return subscriptions.reduce((total, sub) => {
            if (sub.frequency === 'monthly') return total + sub.amount;
            if (sub.frequency === 'yearly') return total + sub.amount / 12;
            if (sub.frequency === 'weekly') return total + sub.amount * 4.33; // Approximation
            return total;
        }, 0);
    }, [subscriptions]);
    
    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-bold text-white">Subscriptions</h2>
                <Button onClick={handleScan} disabled={isLoading}>
                    {isLoading ? <SkeletonLoader className="h-4 w-40" /> : ICONS.scan}
                    <span className="hidden sm:inline">{isLoading ? "Scanning..." : "Scan for Subscriptions"}</span>
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card><h4 className="font-semibold text-content-200 text-sm">Active Subscriptions</h4><p className="text-3xl font-bold text-white mt-1">{subscriptions.length}</p></Card>
                <Card><h4 className="font-semibold text-content-200 text-sm">Estimated Monthly Cost</h4><p className="text-3xl font-bold text-white mt-1">{formatCurrency(totalMonthlyCost, primaryCurrency)}</p></Card>
            </div>
            
            {isLoading && (
                <Card className="text-center p-8">
                    <div className="flex justify-center items-center gap-2"><SkeletonLoader className="h-5 w-5 rounded-full" /><p>Scanning transactions for recurring payments...</p></div>
                </Card>
            )}

            {!isLoading && scanPerformed && potentialSubscriptions.length === 0 && (
                <Card className="text-center p-8 text-content-200">
                    Scan complete. No new potential subscriptions found.
                </Card>
            )}

            {potentialSubscriptions.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4">Potential Subscriptions Found</h3>
                    <div className="space-y-4">
                        {potentialSubscriptions.map((sub, index) => (
                            <Card key={index} className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="flex-1">
                                    <p className="font-bold text-white">{sub.name}</p>
                                    <p className="text-lg text-content-100">{formatCurrency(sub.amount, primaryCurrency)} <span className="text-sm text-content-200">/ {sub.frequency}</span></p>
                                    <p className="text-xs text-content-200">Suggested Category: {sub.categorySuggestion}</p>
                                </div>
                                <Button onClick={() => handleAddSubscription(sub)}>
                                    {ICONS.plus} Add
                                </Button>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
            
            <div>
                <h3 className="text-2xl font-bold text-white mb-4">Tracked Subscriptions</h3>
                {subscriptions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {subscriptions.map(sub => (
                            <Card key={sub.id}>
                                <div className="flex justify-between items-start">
                                    <h4 className="text-lg font-bold text-white">{sub.name}</h4>
                                    <Button variant="danger" className="p-1.5" onClick={() => window.confirm(`Stop tracking ${sub.name}?`) && deleteSubscription(sub.id)}>{ICONS.trash}</Button>
                                </div>
                                <p className="text-2xl font-light text-white mt-2">{formatCurrency(sub.amount, primaryCurrency)} <span className="text-sm text-content-200">/ {sub.frequency}</span></p>
                                <div className="text-sm text-content-200 mt-3 pt-3 border-t border-base-300">
                                    <p>Next Payment: <span className="text-white font-semibold">{formatDate(sub.nextPaymentDate)}</span></p>
                                    <p>Category: <span className="text-white font-semibold">{getCategoryById(sub.categoryId)?.name || 'N/A'}</span></p>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    !isLoading && !scanPerformed && <div className="text-center py-16"><p className="text-content-200">No subscriptions tracked. Use the scan feature to find them!</p></div>
                )}
            </div>
        </div>
    )
};

const CategoryManager: React.FC = () => {
    const { categories, addCategory, updateCategory, deleteCategory } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);

    const openModal = (category?: Category) => {
        setEditingCategory(category);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setEditingCategory(undefined);
        setIsModalOpen(false);
    };

    const CategoryForm: React.FC<{onClose: () => void, existingCategory?: Category}> = ({ onClose, existingCategory }) => {
        const [category, setCategory] = useState<Partial<Category>>(existingCategory || { name: '', type: TransactionType.EXPENSE, icon: 'misc' });
        const inputClasses = "w-full bg-base-100/50 p-3 rounded-lg text-white border border-base-300 focus:ring-2 focus:ring-brand-gradient-to focus:border-transparent";

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            const { name, type, icon } = category;
            if (!name || !type || !icon) return alert("Please fill all fields.");

            if (existingCategory) {
                updateCategory({ ...existingCategory, name, type, icon });
            } else {
                addCategory({ name, type, icon });
            }
            onClose();
        };

        const availableIcons = Object.keys(ICONS).filter(key => !['dashboard', 'accounts', 'transactions', 'budgets', 'insights', 'settings', 'investments', 'savings', 'goals', 'assets', 'subscriptions', 'logo', 'plus', 'edit', 'trash', 'export', 'search', 'filter', 'scan', 'camera', 'upload', 'link', 'chart-bar', 'list-details', 'eye', 'eye-slash', 'chevron-left', 'chevron-right'].includes(key));
        
        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" placeholder="Category Name" value={category.name || ''} onChange={(e) => setCategory(p => ({...p, name: e.target.value}))} required className={inputClasses}/>
                <select value={category.type} onChange={(e) => setCategory(p => ({...p, type: e.target.value as (TransactionType.EXPENSE | TransactionType.INCOME)}))} className={inputClasses}>
                    <option value={TransactionType.EXPENSE}>Expense</option>
                    <option value={TransactionType.INCOME}>Income</option>
                </select>
                <div>
                    <label className="text-sm text-content-200">Icon</label>
                    <div className="grid grid-cols-6 gap-2 p-2 bg-base-100 rounded-lg mt-1 h-32 overflow-y-auto">
                        {availableIcons.map(iconKey => (
                            <button key={iconKey} type="button" onClick={() => setCategory(p => ({...p, icon: iconKey}))} className={classNames("flex items-center justify-center p-2 rounded-lg aspect-square transition-colors", category.icon === iconKey ? 'bg-brand-primary text-black' : 'bg-base-200 text-content-200 hover:bg-base-300')}>
                                {ICONS[iconKey]}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">{existingCategory ? 'Update' : 'Create'}</Button></div>
            </form>
        )
    }

    return (
        <Card>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Manage Categories</h3>
                <Button onClick={() => openModal()} className="text-sm py-1.5">{ICONS.plus}Add New</Button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-base-100 rounded-lg">
                        <div className="flex items-center gap-3">
                            <span className="text-content-200">{ICONS[cat.icon] || ICONS.misc}</span>
                            <div>
                                <p className="font-semibold text-white">{cat.name}</p>
                                <p className={classNames("text-xs", cat.type === TransactionType.INCOME ? 'text-accent-success' : 'text-accent-error')}>{cat.type}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" className="p-1.5" onClick={() => openModal(cat)}>{ICONS.edit}</Button>
                            <Button variant="danger" className="p-1.5" onClick={() => deleteCategory(cat.id)}>{ICONS.trash}</Button>
                        </div>
                    </div>
                ))}
            </div>
            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingCategory ? 'Edit Category' : 'Add Category'}>
                <CategoryForm onClose={closeModal} existingCategory={editingCategory} />
            </Modal>
        </Card>
    )
}

const SettingsView: React.FC = () => {
  const { primaryCurrency, setPrimaryCurrency } = useFinance();
  return (
    <div className="space-y-8 animate-fade-in">
        <h2 className="text-3xl font-bold text-white">Settings</h2>
        <Card>
            <h3 className="text-lg font-bold text-white mb-4">General Settings</h3>
            <div className="space-y-4">
                <div>
                    <label htmlFor="primaryCurrency" className="block text-sm font-medium text-content-100 mb-1">Primary Currency</label>
                    <p className="text-xs text-content-200 mb-2">This currency is used for aggregated values like Net Worth.</p>
                    <select id="primaryCurrency" value={primaryCurrency} onChange={e => setPrimaryCurrency(e.target.value)} className="w-full max-w-xs bg-base-100 p-3 rounded-lg text-white border border-base-300">
                        {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>)}
                    </select>
                </div>
            </div>
        </Card>
        <CategoryManager />
    </div>
  );
};

const VIEW_TITLES: { [key in View]: string } = {
  DASHBOARD: 'Dashboard', ACCOUNTS: 'Accounts', TRANSACTIONS: 'Transactions', BUDGETS: 'Budgets', GOALS: 'Financial Goals',
  ASSETS: 'Assets', INVESTMENTS: 'Investments', SAVINGS: 'Savings', INSIGHTS: 'AI Insights', SETTINGS: 'Settings', SUBSCRIPTIONS: 'Subscriptions'
};

const BottomNavBar: React.FC<{
    activeView: View;
    setActiveView: (view: View) => void;
    onMoreClick: () => void;
}> = ({ activeView, setActiveView, onMoreClick }) => {
    const navItems = [
        { view: 'DASHBOARD', label: 'Dashboard', icon: ICONS.dashboard },
        { view: 'TRANSACTIONS', label: 'Transactions', icon: ICONS.transactions },
        { view: 'ACCOUNTS', label: 'Accounts', icon: ICONS.accounts },
        { view: 'ASSETS', label: 'Assets', icon: ICONS.assets },
    ];
    
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-base-200/50 backdrop-blur-lg border-t border-base-300 flex justify-around items-center z-40 h-20">
            {navItems.map(item => (
                <button
                    key={item.view}
                    onClick={() => setActiveView(item.view as View)}
                    className={classNames(
                        "flex flex-col items-center justify-center w-full h-full text-xs transition-colors pt-1",
                        activeView === item.view ? 'text-white' : 'text-content-200 hover:text-white'
                    )}
                >
                    <div className="w-6 h-6 mb-1">{item.icon}</div>
                    <span className="mt-1">{item.label}</span>
                </button>
            ))}
            <button
                 onClick={onMoreClick}
                 className="flex flex-col items-center justify-center w-full h-full text-xs text-content-200 hover:text-white transition-colors pt-1"
            >
                <div className="w-6 h-6 mb-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg></div>
                <span className="mt-1">More</span>
            </button>
        </nav>
    );
};

// APP COMPONENT
export default function App() {
  const [activeView, setActiveView] = useState<View>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Global modals state
  const [isAddEditTxModalOpen, setIsAddEditTxModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [prefilledTxData, setPrefilledTxData] = useState<Partial<Transaction> | undefined>(undefined);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  const openAddEditTxModal = (transaction?: Transaction) => {
      setPrefilledTxData(undefined);
      setEditingTransaction(transaction);
      setIsAddEditTxModalOpen(true);
  };
  
  const openScannerModal = () => setIsScannerModalOpen(true);
  
  const closeTxModal = () => {
      setPrefilledTxData(undefined);
      setEditingTransaction(undefined);
      setIsAddEditTxModalOpen(false);
      setIsScannerModalOpen(false);
  };

  const handleScanComplete = (data: Partial<Transaction>) => {
      setIsScannerModalOpen(false);
      setPrefilledTxData(data);
      setEditingTransaction(undefined);
      setIsAddEditTxModalOpen(true);
  };

  const renderView = () => {
    switch (activeView) {
      case 'DASHBOARD': return <DashboardView />;
      case 'ACCOUNTS': return <AccountsView />;
      case 'TRANSACTIONS': return <TransactionsView openAddEditModal={openAddEditTxModal} />;
      case 'BUDGETS': return <BudgetsView />;
      case 'GOALS': return <GoalsView />;
      case 'ASSETS': return <AssetsView />;
      case 'SUBSCRIPTIONS': return <SubscriptionsView />;
      case 'INSIGHTS': return <InsightsView />;
      case 'SETTINGS': return <SettingsView />;
      case 'INVESTMENTS': return <InvestmentsView />;
      case 'SAVINGS': return <SavingsView />;
      default: return <DashboardView />;
    }
  };

  const NavItem: React.FC<{ view: View; label: string; icon: React.ReactNode }> = ({ view, label, icon }) => (
    <button onClick={() => { setActiveView(view); setIsSidebarOpen(false); setIsMoreSheetOpen(false); }}
      className={classNames('flex items-center space-x-4 px-4 py-3 rounded-xl w-full text-left transition-colors', activeView === view ? 'bg-base-300 text-white font-semibold' : 'text-content-200 hover:bg-base-300/50 hover:text-white')}>
      {icon}<span>{label}</span>
    </button>
  );

  const MobileHeader: React.FC<{ onMenuClick: () => void; title: string; }> = ({ onMenuClick, title }) => (
      <header className="md:hidden bg-base-100/50 backdrop-blur-sm p-4 flex items-center gap-4 sticky top-0 z-30 border-b border-base-300">
        <button onClick={onMenuClick} className="text-content-100 hover:text-white" aria-label="Open menu"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
        <h1 className="text-xl font-bold text-white">{title}</h1>
      </header>
  );
  
  const DesktopHeader: React.FC<{ title: string }> = ({ title }) => (
      <header className="hidden md:block p-6">
        <h1 className="text-3xl font-bold text-white">{title}</h1>
      </header>
  );
  
  interface NavItemDef {
    view: View;
    label: string;
    icon: React.ReactNode;
  }

  const mainNavItems: NavItemDef[] = [
      { view: 'DASHBOARD', label: 'Dashboard', icon: ICONS.dashboard },
      { view: 'ACCOUNTS', label: 'Accounts', icon: ICONS.accounts },
      { view: 'TRANSACTIONS', label: 'Transactions', icon: ICONS.transactions },
      { view: 'INVESTMENTS', label: 'Investments', icon: ICONS.investments },
      { view: 'SAVINGS', label: 'Savings', icon: ICONS.savings },
      { view: 'ASSETS', label: 'Assets', icon: ICONS.assets },
      { view: 'SUBSCRIPTIONS', label: 'Subscriptions', icon: ICONS.subscriptions },
  ];
  
  const moreNavItems: NavItemDef[] = [
      { view: 'BUDGETS', label: 'Budgets', icon: ICONS.budgets },
      { view: 'GOALS', label: 'Goals', icon: ICONS.goals },
      { view: 'INSIGHTS', label: 'AI Insights', icon: ICONS.insights },
  ];
  
  const allNavItems = [...mainNavItems, ...moreNavItems];

  return (
    <div className="flex h-screen bg-base-100">
      {isSidebarOpen && <div className="md:hidden fixed inset-0 bg-black bg-opacity-60 z-40" onClick={() => setIsSidebarOpen(false)}></div>}
      <aside className={classNames("fixed inset-y-0 left-0 w-72 bg-base-200 p-6 flex flex-col z-50 transform transition-transform duration-300 ease-in-out", "md:relative md:translate-x-0", isSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center space-x-3 mb-10 px-2">{ICONS.logo}<span className="text-2xl font-bold text-white">FinanSage</span></div>
        <nav className="space-y-2 flex-grow overflow-y-auto">
            {mainNavItems.map(item => <NavItem key={item.view} {...item} />)}
            <div className="pt-4 mt-2 border-t border-base-300">
                {moreNavItems.map(item => <NavItem key={item.view} {...item} />)}
            </div>
        </nav>
        <div className="mt-auto"><NavItem view="SETTINGS" label="Settings" icon={ICONS.settings} /></div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader onMenuClick={() => setIsSidebarOpen(true)} title={VIEW_TITLES[activeView]} />
        <DesktopHeader title={VIEW_TITLES[activeView]} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">{renderView()}</main>
      </div>
      
      <BottomNavBar activeView={activeView} setActiveView={setActiveView} onMoreClick={() => setIsMoreSheetOpen(true)} />
      <FloatingActionButton onAddManually={() => openAddEditTxModal()} onScanReceipt={openScannerModal} />
      
      {/* Global Modals */}
      <Modal isOpen={isAddEditTxModalOpen} onClose={closeTxModal} title={editingTransaction ? "Edit Transaction" : prefilledTxData?.description ? "Confirm Scanned Transaction" : "Add Transaction"}>
        <TransactionForm onClose={closeTxModal} existingTransaction={editingTransaction} prefilledData={prefilledTxData} />
      </Modal>
      <Modal isOpen={isScannerModalOpen} onClose={closeTxModal} title="Scan Receipt">
        <ReceiptScannerModal onScanComplete={handleScanComplete} />
      </Modal>
      <BottomSheet isOpen={isMoreSheetOpen} onClose={() => setIsMoreSheetOpen(false)} title="More Sections">
          <div className="space-y-2">
            {allNavItems.map(item => <NavItem key={item.view} {...item} />)}
             <div className="pt-2 mt-2 border-t border-base-300">
                <NavItem view="SETTINGS" label="Settings" icon={ICONS.settings} />
            </div>
          </div>
      </BottomSheet>
    </div>
  );
}
