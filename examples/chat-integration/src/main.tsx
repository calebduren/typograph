import { createRoot } from 'react-dom/client';
import { App } from './app';
import './style.css';
import 'katex/dist/katex.min.css';

createRoot(document.getElementById('root')!).render(<App />);
