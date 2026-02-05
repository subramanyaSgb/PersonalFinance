
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category, TransactionType, Account, Asset, Subscription, Investment, InvestmentType, SuggestedSubscription } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const formatDate = (isoString: string | Date): string => {
    if (!isoString) return 'N/A';
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export const getFinancialInsights = async (
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[]
): Promise<string> => {
  if (transactions.length === 0) return "No transaction data available to analyze.";

  const simplifiedTransactions = transactions.map(t => ({
    date: t.date,
    description: t.description,
    amount: t.amount,
    type: t.type,
    category: categories.find(c => c.id === t.categoryId)?.name || 'Uncategorized',
    account: accounts.find(a => a.id === t.accountId)?.name || 'Unknown Account'
  }));

  const prompt = `
    You are an expert financial advisor called FinanSage.
    Analyze the following JSON data of a user's recent financial transactions and accounts.
    Provide actionable, personalized, and encouraging insights.

    Here is the user's data:
    Accounts: ${JSON.stringify(accounts)}
    Transactions: ${JSON.stringify(simplifiedTransactions.slice(-50))}

    Based on this data, please do the following:
    1.  Start with a brief, friendly overview of their financial situation.
    2.  Identify the top 3-5 spending categories.
    3.  Point out any potential areas for savings or positive spending habits.
    4.  Offer 2-3 specific, actionable tips to improve their financial health.
    5.  Keep the tone positive and motivating. Do not be judgmental.
    6.  Format your response in markdown. Use headings (##, ###), bullet points, and bold text.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Sorry, I couldn't generate insights at this moment.";
  } catch (error) {
    console.error("Error fetching financial insights:", error);
    return "Sorry, I couldn't fetch your financial insights at the moment.";
  }
};

export const suggestCategory = async (
  description: string,
  categories: Category[]
): Promise<string | null> => {
  const expenseCategories = categories
    .filter(c => c.type === TransactionType.EXPENSE)
    .map(c => c.name);

  const prompt = `
    Based on the transaction description, which of the following categories is the best fit?
    Description: "${description}"
    Available Expense Categories: ${expenseCategories.join(', ')}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: "The most appropriate category from the list.",
              enum: expenseCategories,
            },
          },
          required: ["category"],
        },
      },
    });

    const result = JSON.parse(response.text);
    return result.category || null;
  } catch (error) {
    console.error("Error suggesting category:", error);
    return null;
  }
};

export const fetchProductDetailsFromUrl = async (url: string): Promise<Partial<Asset> | null> => {
    const prompt = `
        Given the URL of a product page, extract the following details.
        URL: "${url}"
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "The name of the product." },
                        description: { type: Type.STRING, description: "A brief description of the product." },
                        purchasePrice: { type: Type.NUMBER, description: "The price of the product. Extract only the number." },
                        imageUrl: { type: Type.STRING, description: "The direct URL to the main product image." },
                    },
                    required: ["name", "purchasePrice", "imageUrl"],
                },
            },
        });
        
        const result = JSON.parse(response.text);
        return {
            name: result.name,
            description: result.description,
            purchasePrice: result.purchasePrice,
            imageUrl: result.imageUrl,
            productUrl: url,
        };
    } catch (error) {
        console.error("Error fetching product details:", error);
        return null;
    }
};

export const processReceiptImage = async (
    base64Image: string,
    mimeType: string
): Promise<{ merchantName: string, totalAmount: number, transactionDate: string } | null> => {
    const imagePart = {
        inlineData: {
            data: base64Image,
            mimeType,
        },
    };

    const prompt = `Analyze this receipt image. Extract the merchant name, the final total amount, and the transaction date. Today is ${new Date().toISOString().split('T')[0]}. If the year is not present on the receipt, assume the current year.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [imagePart, {text: prompt}] },
            config: {
                 responseMimeType: "application/json",
                 responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        merchantName: { type: Type.STRING, description: "The name of the store or merchant." },
                        totalAmount: { type: Type.NUMBER, description: "The final total amount paid." },
                        transactionDate: { type: Type.STRING, description: "The date of the transaction in YYYY-MM-DD format." },
                    },
                    required: ["merchantName", "totalAmount", "transactionDate"],
                 },
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error processing receipt:", error);
        return null;
    }
};

export const findSubscriptions = async (transactions: Transaction[], categories: Category[]): Promise<SuggestedSubscription[]> => {
    if (transactions.length < 5) return [];

    const simplifiedTransactions = transactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .slice(0, 200)
        .map(t => ({
            date: t.date.split('T')[0],
            description: t.description,
            amount: t.amount,
        }));
    
    const expenseCategories = categories.filter(c => c.type === TransactionType.EXPENSE).map(c => c.name);

    const prompt = `
        Analyze the following list of financial transactions. Identify any recurring payments that are likely to be subscriptions.
        For each identified subscription, provide its name, a common recurring amount, its frequency (weekly, monthly, or yearly), and the most recent payment date.
        Consolidate similar descriptions.
        
        Transaction Data:
        ${JSON.stringify(simplifiedTransactions)}
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                systemInstruction: "You are an AI assistant specialized in finding recurring payments from transaction data. Output only valid JSON matching the schema.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                       subscriptions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    amount: { type: Type.NUMBER },
                                    frequency: { type: Type.STRING, enum: ['weekly', 'monthly', 'yearly'] },
                                    lastPaymentDate: { type: Type.STRING },
                                    categorySuggestion: { type: Type.STRING }
                                },
                                required: ['name', 'amount', 'frequency', 'lastPaymentDate', 'categorySuggestion']
                            }
                       }
                    },
                    required: ['subscriptions']
                }
            },
        });

        const result = JSON.parse(response.text);
        return result.subscriptions || [];
    } catch (error) {
        console.error("Error finding subscriptions:", error);
        return [];
    }
};

export const generateFinancialReport = async (
  transactions: Transaction[],
  categories: Category[],
  startDate: string,
  endDate: string
): Promise<string> => {
  if (transactions.length === 0) return "### No transactions in the selected period to analyze.";

  const transactionsForPrompt = transactions.slice(0, 500)
    .map(t => ({
      date: t.date.split('T')[0],
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: categories.find(c => c.id === t.categoryId)?.name || 'Uncategorized',
    }));

  const prompt = `
    Generate a professional financial report for the period ${formatDate(startDate)} to ${formatDate(endDate)}.
    Structure:
    - **Executive Summary**
    - **Income vs. Expenses**
    - **Spending Deep-Dive**
    - **Actionable Recommendations**

    Transaction Data:
    ${JSON.stringify(transactionsForPrompt)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a professional financial analyst AI. Generate a clear report in markdown format."
      }
    });
    return response.text || "Could not generate report.";
  } catch (error) {
    console.error("Error generating financial report:", error);
    return "An error occurred while generating the AI analysis.";
  }
};

export const analyzePortfolio = async (investments: Investment[]): Promise<string> => {
  if (investments.length === 0) return "You don't have any investments to analyze.";

  const portfolioSummary = {
    totalValue: investments.reduce((sum, i) => sum + i.units * i.currentPrice, 0),
    totalInvested: investments.reduce((sum, i) => sum + i.units * i.purchasePrice, 0),
    simplifiedInvestments: investments.map(i => ({
      name: i.name,
      type: i.type,
      investedValue: i.units * i.purchasePrice,
      currentValue: i.units * i.currentPrice,
    }))
  };

  const prompt = `
    Analyze this investment portfolio. Provide insights on diversification and risk.
    Portfolio: ${JSON.stringify(portfolioSummary)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Sorry, I couldn't analyze your portfolio.";
  } catch (error) {
    console.error("Error analyzing portfolio:", error);
    return "An error occurred during portfolio analysis.";
  }
};
