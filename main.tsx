
import React from 'react';
import ReactDOM from 'react-dom/client';
// Fix: Importing from './src/App' instead of the empty root './App'
import App, { AppProvider } from './src/App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
