
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './App.css';

// Silenciar logs de requisições HTTP de recursos estáticos
const originalLog = console.log;
console.log = (...args) => {
  const message = args[0]?.toString?.() ?? '';
  // Ignorar logs de requisições HTTP de fontes, images, etc
  if (
    message.includes('GET') || 
    message.includes('HTTP') || 
    message.includes('fonts.gstatic.com') ||
    message.includes('localhost:8080') ||
    message.includes('[useFamilyTransfers]') ||
    message.includes('[ExpensesPage]')
  ) {
    return;
  }
  if (import.meta.env.PROD) return; // Silencia tudo em produção
  originalLog(...args);
};

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

createRoot(document.getElementById("root")!).render(
  <App />
);
