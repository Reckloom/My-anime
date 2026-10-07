import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {AuthGate, AuthProvider} from './auth/Auth';
import './styles.css';
import {registerFramePwa} from './pwa';
import {Component, type ErrorInfo, type ReactNode} from 'react';

class FrameErrorBoundary extends Component<{children:ReactNode},{error:Error|null}>{
 state={error:null} as {error:Error|null};
 static getDerivedStateFromError(error:Error){return {error};}
 componentDidCatch(error:Error,info:ErrorInfo){console.error('[FRAME runtime error]',error,info);}
 render(){
  if(this.state.error)return <main className="frame-runtime-error"><div><img src="/frame-ultra-instinct.svg" alt="FRAME"/><small>FRAME RUNTIME</small><h1>Something went off track.</h1><p>Your library data is still stored. Reload FRAME to recover this session.</p><button className="primary" onClick={()=>window.location.reload()}>Reload FRAME</button><button className="secondary" onClick={()=>{Object.keys(localStorage).filter(key=>key==='frame-library'||key.startsWith('frame-library:')).forEach(key=>localStorage.removeItem(key));window.location.reload()}}>Reset local library cache</button></div></main>;
  return this.props.children;
 }
}

registerFramePwa();
createRoot(document.getElementById('root')!).render(<StrictMode><FrameErrorBoundary><AuthProvider><AuthGate><App /></AuthGate></AuthProvider></FrameErrorBoundary></StrictMode>);
