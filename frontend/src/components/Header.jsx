import { motion } from 'framer-motion';

export default function Header({ health, appConfig, sessionId }) {
  const short = sessionId?.slice(0, 8).toUpperCase();
  const provider = appConfig
    ? `${(appConfig.llm_provider||'').toUpperCase()} / ${appConfig.llm_model||'—'}`
    : '—';

  return (
    <motion.header initial={{y:-40,opacity:0}} animate={{y:0,opacity:1}} transition={{duration:0.35,delay:0.1}}
      style={{ height:54, background:'var(--bg-panel)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1.25rem', position:'relative', zIndex:10, flexShrink:0 }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,var(--accent),var(--accent2),transparent)', opacity:0.65 }} />

      {/* Logo */}
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <svg width="30" height="30" viewBox="0 0 30 30">
          <polygon points="15,2 27,8.5 27,21.5 15,28 3,21.5 3,8.5" fill="none" stroke="var(--accent)" strokeWidth="1.5"/>
          <text x="15" y="20" textAnchor="middle" fill="var(--accent)" fontSize="11" fontFamily="Orbitron,monospace" fontWeight="800">N</text>
        </svg>
        <div>
          <div style={{fontFamily:'var(--font-display)',fontSize:13,fontWeight:700,color:'var(--accent)',letterSpacing:'0.14em',lineHeight:1}}>NEXUS</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:8,color:'var(--text-dim)',letterSpacing:'0.08em',marginTop:2}}>AI AGENT v3</div>
        </div>
      </div>

      {/* Center */}
      <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-dim)',letterSpacing:'0.08em',display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:32,height:1,background:'var(--border)'}}/>
        <span>SID:{short}</span>
        <div style={{width:32,height:1,background:'var(--border)'}}/>
      </div>

      {/* Right */}
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <Pill label="BACKEND" on={health?.online} />
        <Pill label="RAG" on={health?.rag_ready} />
        <div style={{width:1,height:22,background:'var(--border)'}}/>
        <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-dim)',letterSpacing:'0.06em'}}>{provider}</div>
        {appConfig?.image_generation_enabled&&(
          <span style={{background:'var(--accent-dim)',color:'var(--accent)',border:'1px solid var(--border)',borderRadius:2,padding:'1px 6px',fontFamily:'var(--font-display)',fontSize:8,letterSpacing:'0.07em'}}>🎨 IMG</span>
        )}
      </div>
    </motion.header>
  );
}

function Pill({label,on}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:5,fontFamily:'var(--font-display)',fontSize:9,letterSpacing:'0.1em',color:on?'var(--accent2)':'var(--red)',transition:'color 0.3s'}}>
      <div className={on?'status-pulse':''} style={{width:6,height:6,borderRadius:'50%',background:on?'var(--accent2)':'var(--red)',boxShadow:on?'0 0 6px var(--accent2)':'0 0 6px var(--red)',transition:'background 0.3s'}}/>
      {label}
    </div>
  );
}