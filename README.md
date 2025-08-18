# FinanSage - Your AI-Powered Personal Finance Hub

<div align="center">
  <img src="https://raw.githubusercontent.com/user-attachments/assets/b83526a0-bc6f-40c2-9e8c-f04f21d3f545" alt="FinanSage Logo" width="120">
</div>

<p align="center">
  <strong>A modern, responsive, and intelligent personal finance management PWA designed to give you a clear view of your financial landscape and empower you with AI-driven insights.</strong>
</p>

<p align="center">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/your-repo/finansage?style=for-the-badge&logo=github&color=C084FC">
  <img alt="License" src="https://img.shields.io/github/license/your-repo/finansage?style=for-the-badge&color=818CF8">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E">
  <img alt="React" src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white">
</p>

---

FinanSage is not just another expense tracker. It's a comprehensive financial companion built with a modern tech stack. It leverages the power of the Google Gemini API to provide intelligent features that go beyond simple data entry, helping you understand your spending, find savings opportunities, and stay on track with your financial goals. All your data is securely stored in your browser's local storage, ensuring complete privacy and offline accessibility.

## ✨ Key Features

FinanSage is packed with features designed to cover all aspects of personal finance management.

### 📊 Core Financial Tracking
- **Customizable Dashboard:** Get a bird's-eye view of your total net worth, monthly income vs. expenses, spending breakdowns, recent transactions, and budget statuses. Arrange the dashboard to see what matters most to you.
- **Multi-Account Management:** Track all your accounts in one place—Checking, Savings, Credit Cards, Investments, Loans, and Cash—with support for multiple currencies.
- **Comprehensive Transaction Logging:** Easily add expenses, income, and transfers. Enrich entries with categories, notes, tags, and even receipt images.
- **Advanced Filtering & Export:** Quickly search and filter transactions by any criteria, and export your data to CSV for record-keeping or further analysis.
- **Budget Management:** Set monthly budgets for different spending categories and visually track your progress with intuitive progress bars to prevent overspending.
- **Financial Goal Setting:** Create, track, and contribute to your financial goals, whether it's for a new car, a vacation, or a down payment on a house.

### 🤖 AI-Powered Intelligence (via Google Gemini)
- **AI Financial Insights:** Receive personalized analysis of your spending habits, potential savings, and actionable tips to improve your financial health.
- **AI-Generated Reports:** Generate detailed, well-structured financial reports for any date range with an executive summary, income/expense analysis, and data-driven recommendations.
- **AI Portfolio Analysis:** Get a concise, expert-level analysis of your investment portfolio's diversification, concentration, and potential risks.
- **📸 Receipt Scanning:** Simply take a photo of a receipt, and the AI will automatically extract the merchant name, total amount, and date, pre-filling a new transaction for you.
- **Subscription Scanner:** Let the AI analyze your transaction history to find recurring payments and potential subscriptions you might be overlooking.
- **Smart Category Suggestion:** Automatically suggests a transaction category based on its description, speeding up manual entry.
- **Asset Detail Fetcher:** Paste a product URL, and the AI will automatically fetch its name, price, and image to add to your asset catalog.

### 📈 Investment & Asset Portfolio
- **Investment Tracking:** Monitor the performance of your stocks and mutual funds. Track individual purchases, average buy price, current value, and overall profit/loss.
- **Savings Instruments:** Keep track of your Fixed Deposits (FDs) and Recurring Deposits (RDs), including interest rates and maturity dates.
- **Valuable Asset Management:** Catalog your physical assets like electronics, furniture, and vehicles to get a complete picture of your net worth.

### ⚙️ User Experience & Utilities
- **Mobile-First Responsive Design:** A seamless experience whether you're on a desktop, tablet, or mobile phone.
- **Offline First & Private:** All data is stored locally in your browser, making the app fast, accessible without an internet connection, and completely private.
- **Sleek Dark Mode UI:** A modern interface that's easy on the eyes.
- **Customizable Navigation:** Tailor the mobile bottom navigation bar to include the features you use most.
- **Global Currency Support:** Manage accounts in different currencies, with a primary currency for aggregated dashboard views.

## 🛠️ Technology Stack

- **Frontend:** [React](https://react.dev/) (with Hooks & Context API), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/)
- **AI/ML:** [Google Gemini API](https://ai.google.dev/) (`@google/genai`)
- **Charting:** [Recharts](https://recharts.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Deployment:** Ready for static hosting on platforms like Vercel, Netlify, or Firebase Hosting.

## 🚀 Getting Started

Follow these steps to get a local copy of FinanSage up and running on your machine.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation & Setup

1. **Clone the repository:**
   ```sh
   git clone https://github.com/your-repo/finansage.git
   cd finansage
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Set up environment variables:**
   - The AI-powered features in this application require a Google Gemini API key.
   - Create a `.env.local` file in the root of the project.
   - Add your API key to this file:
     ```
     VITE_API_KEY=YOUR_GEMINI_API_KEY
     ```

4. **Run the development server:**
   ```sh
   npm run dev
   ```
   The application should now be running on `http://localhost:5173` (or the next available port).

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- Icons provided by various open-source libraries.
- Font: [Inter](https://fonts.google.com/specimen/Inter) from Google Fonts.
- Built with the support of the incredible open-source community.

---
<p align="center">Made with ❤️ for better financial literacy.</p>