import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { getErrorMessage, logError } from './lib/errors';

const root = document.getElementById('root');

const renderFatalError = (error: unknown) => {
  if (!root) return;
  root.innerHTML = `
    <div class="min-h-screen bg-dark-bg text-white flex items-center justify-center p-6">
      <div class="max-w-lg text-center space-y-5">
        <h1 class="serif-title text-3xl text-netflix-red">Unable to start Our K-List</h1>
        <p class="text-zinc-300">${getErrorMessage(error)}</p>
        <p class="text-zinc-500 text-sm">Check your Supabase environment variables and reload the page.</p>
      </div>
    </div>
  `;
};

const bootstrap = async () => {
  window.addEventListener('error', event => {
    logError('Unhandled window error', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', event => {
    logError('Unhandled promise rejection', event.reason);
  });

  try {
    const { default: App } = await import('./App.tsx');
    if (!root) throw new Error('App root element was not found.');
    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (error) {
    logError('Application bootstrap', error);
    renderFatalError(error);
  }
};

bootstrap();
