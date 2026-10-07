import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {AuthGate, AuthProvider} from './auth/Auth';
import './styles.css';
import {registerFramePwa} from './pwa';

createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><AuthGate><App /></AuthGate></AuthProvider></StrictMode>);
