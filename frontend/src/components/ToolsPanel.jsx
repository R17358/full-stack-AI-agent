import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getTools } from '../utils/api.js';

const DETAIL = {
  search_web:              { color:'#00d4ff', api:'Tavily API',              desc:'Real-time internet search for news, facts, current events.' },
  query_knowledge_base:    { color:'#00ffcc', api:'ChromaDB + Embeddings',   desc:'Semantic search over your uploaded documents using RAG.' },
  calculator:              { color:'#ff6b35', api:'Python eval (sandboxed)',  desc:'Full math: arithmetic, trig, log, sqrt, factorial, pi, e.' },
  multiplication_table:    { color:'#ff6b35', api:'Built-in',                desc:'Generates a formatted 1–12 multiplication table.' },
  get_datetime:            { color:'#a855f7', api:'System Clock',             desc:'Current date, time, weekday, and week number.' },
  save_note:               { color:'#a855f7', api:'Filesystem',               desc:'Saves content to a timestamped .txt file on the server.' },
  capture_and_analyze_photo:{ color:'#ffd700', api:'OpenCV + Vision LLM',    desc:'Captures a webcam photo, analyzes it, and remembers it for the session.' },
  generate_image:          { color:'#a855f7', api:'Stability / DALL-E / Imagen', desc:'AI image generation from text. Requires IMAGE_PROVIDER in config.' },
  random_fact:             { color:'#00ffcc', api:'Built-in',                desc:'Random science, space, or tech facts.' },
  system_info:             { color:'#7ab8d4', api:'Config',                   desc:'Shows active LLM provider, model, embeddings, and image gen status.' },
};

export default function ToolsPanel() {
  const [tools, setTools] = useState([]);
  const [sel, setSel]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTools().then(d => { setTools(d.tools || []); setLoading(false); });
  }, []);

  const detail = sel ? DETAIL[sel] : null;
  const selTool = tools.find(t => t.id === sel);

  return (
    <motion.div initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-16}} transition={{duration:0.25}}
      style={{ flex:1, display:'flex', flexDirection:'column', padding:'0.875rem', gap:'0.75rem', overflow:'hidden' }}>

      <div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:10, color:'var(--accent)', letterSpacing:'0.14em' }}>TOOL REGISTRY</div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-dim)', marginTop:2 }}>{tools.length} tools active — click to inspect</div>
      </div>

      <div style={{ flex:1, overflow:'hidden', display:'flex', gap:'0.75rem' }}>
        <div className="panel scroll-area" style={{ flex:1, padding:'0.875rem' }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:80, gap:10, color:'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:12 }}>
              <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}}
                style={{ width:14,height:14,border:'2px solid var(--cyan)',borderTopColor:'transparent',borderRadius:'50%' }} />
              Loading…
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
              {tools.map((t, i) => {
                const d = DETAIL[t.id];
                const active = sel === t.id;
                return (
                  <motion.div key={t.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.03}}
                    onClick={()=>setSel(active?null:t.id)} whileHover={{scale:1.02}} whileTap={{scale:0.97}}
                    style={{ background: active ? `${d?.color||'var(--accent)'}14` : 'rgba(0,212,255,0.025)', border:`1px solid ${active?(d?.color||'var(--accent)')+'55':'var(--border-dim)'}`, borderRadius:7, padding:'12px', cursor:'pointer', transition:'all 0.18s', position:'relative', overflow:'hidden' }}>
                    {active && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:d?.color||'var(--accent)', boxShadow:`0 0 8px ${d?.color||'var(--accent)'}` }} />}
                    <div style={{ fontSize:22, marginBottom:7 }}>{t.icon}</div>
                    <div style={{ fontFamily:'var(--font-display)', fontSize:9, color:active?(d?.color||'var(--accent)'):'var(--text-secondary)', letterSpacing:'0.07em', marginBottom:4, transition:'color 0.18s' }}>{t.name}</div>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-dim)', lineHeight:1.5 }}>{t.description}</div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail drawer */}
        <AnimatePresence>
          {sel && selTool && detail && (
            <motion.div initial={{opacity:0,x:20,width:0}} animate={{opacity:1,x:0,width:260}} exit={{opacity:0,x:20,width:0}}
              className="panel" style={{ width:260, flexShrink:0, padding:'1.25rem', overflow:'hidden', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>{selTool.icon}</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:11, color:detail.color, letterSpacing:'0.1em' }}>{selTool.name}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-dim)', marginTop:3 }}>{selTool.id}</div>
              </div>
              <div style={{ height:1, background:'var(--border-dim)' }} />
              <Sec label="DESCRIPTION">{detail.desc}</Sec>
              <Sec label="POWERED BY"><span className="chip chip-cyan" style={{fontSize:'8px'}}>{detail.api}</span></Sec>
              <div style={{ height:1, background:'var(--border-dim)' }} />
              <div style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'var(--font-display)', fontSize:9, color:'var(--accent2)', letterSpacing:'0.1em' }}>
                <div className="status-pulse" style={{ width:5, height:5, borderRadius:'50%', background:'var(--accent2)', boxShadow:'0 0 6px var(--teal)' }} />
                ACTIVE
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Sec({ label, children }) {
  return (
    <div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:8, color:'var(--text-dim)', letterSpacing:'0.12em', marginBottom:5 }}>{label}</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-secondary)', lineHeight:1.6 }}>{children}</div>
    </div>
  );
}
