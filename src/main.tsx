import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { getErrorMessage, logError } from './lib/errors';

const root = document.getElementById('root');

const renderFatalError = (error: unknown) => {
  if (!root) return;
  const container = document.createElement('div');
  container.className = 'min-h-screen bg-dark-bg text-white flex items-center justify-center p-6';

  const content = document.createElement('div');
  content.className = 'max-w-lg text-center space-y-5';

  const heading = document.createElement('h1');
  heading.className = 'serif-title text-3xl text-netflix-red';
  heading.textContent = 'Unable to start Our K-List';

  const message = document.createElement('p');
  message.className = 'text-zinc-300';
  message.textContent = getErrorMessage(error);

  const hint = document.createElement('p');
  hint.className = 'text-zinc-500 text-sm';
  hint.textContent = 'Check your Supabase environment variables and reload the page.';

  content.append(heading, message, hint);
  container.append(content);
  root.replaceChildren(container);
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
