
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Category, TransactionType, Account, Asset, Subscription, Investment, InvestmentType, SuggestedSubscription } from '../types';

// Fix: Always use process.env.API_KEY directly for initialization as per guidelines
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
    4.  Offer 2-3 specific, actionable tips to improve their financial health. For example, suggest creating a budget for a high-spending category.
    5.  Keep the tone positive and motivating. Do not be judgmental.
    6.  Format your response in simple markdown. Use headings (#, ##), bullet points (*), and bold text (**) to make it easy to read.
  `;
  
  try {
    // Fix: Using gemini-3-flash-preview for basic text tasks
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Sorry, I couldn't generate insights at this moment.";
  } catch (error) {
    console.error("Error fetching financial insights:", error);
    return "Sorry, I couldn't fetch your financial insights at the moment. Please try again later.";
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
    // Fix: Using gemini-3-flash-preview for basic text tasks
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

    const jsonText = response.text;
    if (jsonText) {
        try {
            const result = JSON.parse(jsonText);
            return result.category || null;
        } catch(e) {
            console.error("Failed to parse category suggestion JSON:", e);
            return null;
        }
    }
    return null;
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
        // Fix: Using gemini-3-flash-preview for basic text tasks
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
        
        const jsonText = response.text;
        if(jsonText){
             try {
                const result = JSON.parse(jsonText);
                return {
                    name: result.name,
                    description: result.description,
                    purchasePrice: result.purchasePrice,
                    imageUrl: result.imageUrl,
                    productUrl: url,
                };
             } catch(e) {
                console.error("Failed to parse product details JSON:", e);
                return null;
             }
        }
        return null;

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

    const prompt = "Analyze this receipt image. Extract the merchant name, the final total amount, and the transaction date. Today is "+ new Date().toISOString().split('T')[0] +". If the year is not present on the receipt, assume the current year.";

    try {
        // Fix: Using gemini-3-flash-preview for image processing
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
        const jsonText = response.text;
        if (jsonText) {
             try {
                return JSON.parse(jsonText);
             } catch(e) {
                console.error("Failed to parse receipt JSON:", e);
                return null;
             }
        }
        return null;
    } catch (error) {
        console.error("Error processing receipt:", error);
        return null;
    }
};

export const findSubscriptions = async (transactions: Transaction[], categories: Category[]): Promise<SuggestedSubscription[]> => {
    if (transactions.length < 5) return [];

    const simplifiedTransactions = transactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .slice(0, 200) // limit to recent 200 expenses to manage token usage
        .map(t => ({
            date: t.date.split('T')[0],
            description: t.description,
            amount: t.amount,
        }));
    
    const expenseCategories = categories.filter(c => c.type === TransactionType.EXPENSE).map(c => c.name);

    const prompt = `
        Analyze the following list of financial transactions. Identify any recurring payments that are likely to be subscriptions (e.g., Netflix, Spotify, gym membership, insurance).
        For each identified subscription, provide its name, a common recurring amount, its frequency (weekly, monthly, or yearly), and the most recent payment date you can find in the data.
        Ignore one-off payments. Look for patterns in descriptions and amounts. Consolidate similar descriptions (e.g. 'AMZN PRIME' and 'Amazon Prime') into one subscription.
        
        Transaction Data:
        ${JSON.stringify(simplifiedTransactions)}
    `;

    try {
        // Fix: Using gemini-3-flash-preview for basic text tasks
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                systemInstruction: "You are an AI assistant specialized in finding recurring payments from transaction data. You must only output a valid JSON object matching the provided schema. If no subscriptions are found, return an empty array.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                       subscriptions: {
                            type: Type.ARRAY,
                            description: "A list of identified subscriptions.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING, description: "The name of the service (e.g., Netflix, Spotify)." },
                                    amount: { type: Type.NUMBER, description: "The most common recurring amount of the subscription." },
                                    frequency: { type: Type.STRING, enum: ['weekly', 'monthly', 'yearly'], description: "The payment frequency." },
                                    lastPaymentDate: { type: Type.STRING, description: "The date of the most recent payment in YYYY-MM-DD format." },
                                    categorySuggestion: { type: Type.STRING, description: `Suggest the most likely category from this list: ${expenseCategories.join(', ')}`}
                                },
                                required: ['name', 'amount', 'frequency', 'lastPaymentDate', 'categorySuggestion']
                            }
                       }
                    },
                    required: ['subscriptions']
                }
            },
        });

        const jsonText = response.text;
        if (jsonText) {
            try {
                const result = JSON.parse(jsonText);
                return result.subscriptions || [];
            } catch(e) {
                console.error("Failed to parse subscriptions JSON:", e);
                return [];
            }
        }
        return [];
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

  const MAX_TRANSACTIONS = 500;
  const isTruncated = transactions.length > MAX_TRANSACTIONS;
  const transactionsForPrompt = (isTruncated ? transactions.slice(0, MAX_TRANSACTIONS) : transactions)
    .map(t => ({
      date: t.date.split('T')[0],
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: categories.find(c => c.id === t.categoryId)?.name || 'Uncategorized',
    }));

  const prompt = `
    You are an expert financial analyst. Generate a professional financial report for the period from ${formatDate(startDate)} to ${formatDate(endDate)}.
    The report must be well-structured, insightful, and formatted in markdown.
    ${isTruncated ? `\n\n*Note: The analysis is based on the most recent ${MAX_TRANSACTIONS} transactions in this period due to data limits.*` : ''}

    Transaction Data:
    ${JSON.stringify(transactionsForPrompt)}

    Please structure the report with the following sections using markdown formatting. Do not use level 1 headers (#). Use level 2 (##) and level 3 (###) headers, bold text, and bullet points.
    - **Executive Summary**: A high-level overview of the user's financial activity during this period.
    - **Income vs. Expenses**: A clear breakdown of total income, total expenses, and the resulting net savings or deficit.
    - **Spending Deep-Dive**: An analysis of the top 5 spending categories. Include the total amount and percentage of total expenses for each.
    - **Actionable Recommendations**: Provide 3-5 specific, data-driven recommendations for financial improvement based *only* on the provided transaction data.
  `;

  try {
    // Fix: Using gemini-3-flash-preview for report generation
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful financial analyst AI. You will generate a clear, professional report in markdown format based on the user's data. Be encouraging and focus on actionable advice."
      }
    });
    return response.text || "Could not generate AI analysis.";
  } catch (error) {
    console.error("Error generating financial report:", error);
    return "An error occurred while generating the AI analysis. Please check your network connection.";
  }
};

export const analyzePortfolio = async (investments: Investment[]): Promise<string> => {
  if (investments.length === 0) return "You don't have any investments to analyze.";

  const portfolioSummary = {
    totalValue: investments.reduce((sum, i) => sum + i.units * i.currentPrice, 0),
    totalInvested: investments.reduce((sum, i) => sum + i.units * i.purchasePrice, 0),
    investmentCount: investments.length,
    types: {
      [InvestmentType.STOCK]: investments.filter(i => i.type === InvestmentType.STOCK).length,
      [InvestmentType.MUTUAL_FUND]: investments.filter(i => i.type === InvestmentType.MUTUAL_FUND).length,
    },
    simplifiedInvestments: investments.map(i => ({
      name: i.name,
      type: i.type,
      investedValue: i.units * i.purchasePrice,
      currentValue: i.units * i.currentPrice,
    }))
  };

  const prompt = `
    You are an expert financial advisor named FinanSage. Your tone is insightful, encouraging, and educational, not just generic advice. You are analyzing a user's investment portfolio.

    **User's Portfolio Summary:**
    ${JSON.stringify(portfolioSummary, null, 2)}

    **Your Task:**
    Provide a concise but insightful analysis of this portfolio. Structure your response in Markdown with the following sections:

    ### Portfolio Overview
    Start with a brief, positive summary of the portfolio (e.g., total value, overall gain/loss).

    ### Diversification Check
    Analyze the diversification between Stocks and Mutual Funds. Comment on the balance. Is it aggressive (heavy on stocks), conservative, or balanced? What are the implications?

    ### Concentration
    Identify if there's a heavy concentration in a single investment (e.g., if one asset makes up more than 30% of the portfolio). Explain the potential risk of this.

    ### Actionable Suggestions
    Provide 2-3 clear, actionable suggestions based ONLY on the data provided. Do NOT give specific stock recommendations. Suggestions should be general principles, like:
    - "Consider diversifying further if your risk tolerance allows."
    - "Review your high-concentration assets to ensure they align with your long-term goals."
    - "Keep monitoring your investments regularly."

    Keep the entire response under 250 words. Be direct and clear.
  `;

  try {
    // Fix: Using gemini-3-flash-preview for portfolio analysis
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Sorry, I couldn't analyze your portfolio at this moment.";
  } catch (error) {
    console.error("Error analyzing portfolio:", error);
    return "An error occurred during portfolio analysis. Please try again later.";
  }
};
