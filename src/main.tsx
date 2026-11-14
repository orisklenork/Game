import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unexpected rendering error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-[#07090d] text-slate-100 p-6">
          <div className="max-w-md bg-[#0d1118] border border-slate-700/50 rounded-xl p-6 text-center space-y-4">
            <h1 className="font-display text-2xl font-bold text-red-500">NIGHTFALL</h1>
            <p className="text-sm text-slate-300">{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-semibold text-white cursor-pointer"
            >
              Reload Game
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
