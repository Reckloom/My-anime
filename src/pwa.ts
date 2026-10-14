export function registerFramePwa(){
 if(!import.meta.env.PROD||!('serviceWorker' in navigator))return;
 window.addEventListener('load',()=>{
  const base=new URL(import.meta.env.BASE_URL,window.location.origin);
  const swUrl=new URL('sw.js',base);
  void navigator.serviceWorker.register(swUrl.href,{scope:base.pathname}).catch(()=>{});
 });
}