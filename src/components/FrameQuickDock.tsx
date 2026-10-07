import {MessageCircle,Phone,Search} from 'lucide-react';

export function FrameQuickDock({onChat,onCall,onSearch}:{onChat:()=>void;onCall:()=>void;onSearch:()=>void}){
 return <div className="frame-quick-dock" aria-label="Quick actions" role="toolbar">
  <button type="button" aria-label="Open global chat" title="Open global chat" onClick={onChat}><MessageCircle size={18}/><span>Chat</span></button>
  <button type="button" aria-label="Open calls" title="Open calls" onClick={onCall}><Phone size={18}/><span>Call</span></button>
  <button type="button" aria-label="Open universal finder" title="Open universal finder" onClick={onSearch}><Search size={18}/><span>Find</span></button>
 </div>;
}
