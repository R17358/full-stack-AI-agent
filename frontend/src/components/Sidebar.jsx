import { motion } from 'framer-motion';

const NAV = [
  { id:'chat', label:'CHAT',
    icon:<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/> },
  { id:'tools', label:'TOOLS',
    icon:<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/> },
  { id:'settings', label:'CONFIG',
    icon:<><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></> },
];

export default function Sidebar({ panel, setPanel }) {
  return (
    <motion.nav initial={{ x:-40, opacity:0 }} animate={{ x:0, opacity:1 }} transition={{ duration:0.35, delay:0.15 }}
      style={{ width:60, background:'var(--bg-panel)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', alignItems:'center', padding:'0.75rem 0', gap:4, flexShrink:0, position:'relative', zIndex:5 }}>
      {NAV.map(item => {
        const active = panel === item.id;
        return (
          <button key={item.id} onClick={() => setPanel(item.id)} data-tip={item.label}
            style={{ width:42, height:42, background: active ? 'var(--accent-dim)' : 'transparent', border: active ? '1px solid var(--border-bright)' : '1px solid transparent', borderRadius:7, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, color: active ? 'var(--accent)' : 'var(--text-dim)', transition:'all 0.18s', position:'relative' }}
            onMouseEnter={e=>{ if(!active){ e.currentTarget.style.color='var(--text-secondary)'; e.currentTarget.style.background='var(--accent-dim)'; }}}
            onMouseLeave={e=>{ if(!active){ e.currentTarget.style.color='var(--text-dim)'; e.currentTarget.style.background='transparent'; }}}>
            {active && (
              <motion.div layoutId="nav-active"
                style={{ position:'absolute', left:0, top:'25%', width:2, height:'50%', background:'var(--accent)', borderRadius:'0 2px 2px 0', boxShadow:'0 0 8px var(--accent)' }}
                transition={{ type:'spring', stiffness:300, damping:30 }} />
            )}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{item.icon}</svg>
            <span style={{ fontFamily:'var(--font-display)', fontSize:7, letterSpacing:'0.07em' }}>{item.label}</span>
          </button>
        );
      })}
      <div style={{ marginTop:'auto', width:20, height:20, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:5, height:5, border:'1px solid var(--border)', transform:'rotate(45deg)' }} />
      </div>
    </motion.nav>
  );
}