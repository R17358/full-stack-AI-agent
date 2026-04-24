import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LINES = [
  { t: 'NEXUS AGENT SYSTEM v2.0.0', d: 0,    c: 'var(--accent)', big: true },
  { t: '> Initializing multi-provider LLM engine...', d: 250  },
  { t: '> Loading RAG pipeline + ChromaDB...', d: 500  },
  { t: '> Mounting vision service...', d: 750  },
  { t: '> Activating image generation layer...', d: 950  },
  { t: '> Tool registry: 10 tools loaded', d: 1150 },
  { t: '> Memory subsystem: ONLINE', d: 1350, c: 'var(--accent2)' },
  { t: '> Streaming SSE bridge: READY', d: 1550 },
  { t: 'ALL SYSTEMS NOMINAL', d: 1850, c: 'var(--accent2)' },
];

export default function BootScreen() {
  const [vis, setVis]  = useState([]);
  const [pct, setPct]  = useState(0);

  useEffect(() => {
    LINES.forEach((l, i) => {
      setTimeout(() => {
        setVis(p => [...p, i]);
        setPct(Math.round(((i + 1) / LINES.length) * 100));
      }, l.d);
    });
  }, []);

  return (
    <motion.div exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 0.4 }}
      style={{ position:'fixed', inset:0, background:'var(--bg-void)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:1000, fontFamily:'var(--font-mono)' }}>

      <motion.div initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ duration:0.5 }}
        style={{ marginBottom:'2.5rem', position:'relative' }}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
          <motion.circle cx="48" cy="48" r="44" fill="none" stroke="var(--accent)" strokeWidth="2"
            strokeDasharray="276" initial={{ strokeDashoffset:276 }} animate={{ strokeDashoffset:0 }}
            transition={{ duration:1.4, ease:'easeInOut' }} />
          <polygon points="48,12 76,28 76,68 48,84 20,68 20,28" fill="rgba(0,212,255,0.06)" stroke="rgba(0,212,255,0.4)" strokeWidth="1.5" />
          <text x="48" y="57" textAnchor="middle" fill="var(--accent)" fontSize="26" fontFamily="var(--font-display)" fontWeight="800">N</text>
        </svg>
        <motion.div animate={{ rotate:360 }} transition={{ duration:10, repeat:Infinity, ease:'linear' }}
          style={{ position:'absolute', inset:-14, border:'1px dashed rgba(0,212,255,0.18)', borderRadius:'50%' }} />
        <motion.div animate={{ rotate:-360 }} transition={{ duration:16, repeat:Infinity, ease:'linear' }}
          style={{ position:'absolute', inset:-24, border:'1px dashed rgba(0,255,204,0.1)', borderRadius:'50%' }} />
      </motion.div>

      <div style={{ width:460, maxWidth:'90vw', background:'rgba(0,0,0,0.55)', border:'1px solid rgba(0,212,255,0.18)', borderRadius:8, padding:'1.25rem', marginBottom:'1.5rem', minHeight:200 }}>
        {LINES.map((l, i) => (
          <AnimatePresence key={i}>
            {vis.includes(i) && (
              <motion.div initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.18 }}
                style={{ color: l.c || 'rgba(0,212,255,0.65)', fontSize: l.big ? 14 : 11, fontWeight: l.big ? 700 : 400, marginBottom:3, letterSpacing: l.big ? '0.18em' : '0.05em' }}>
                {!l.big && <span style={{ color:'rgba(0,255,204,0.45)', marginRight:8 }}>{'>'}</span>}
                {l.t}
                {i === vis[vis.length - 1] && i < LINES.length - 1 && (
                  <motion.span animate={{ opacity:[1,0] }} transition={{ duration:0.55, repeat:Infinity }} style={{ marginLeft:4 }}>█</motion.span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>

      <div style={{ width:460, maxWidth:'90vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:9, color:'rgba(0,212,255,0.45)', fontFamily:'var(--font-display)', letterSpacing:'0.1em' }}>
          <span>BOOT SEQUENCE</span><span>{pct}%</span>
        </div>
        <div style={{ height:2, background:'rgba(0,212,255,0.08)', borderRadius:1, overflow:'hidden' }}>
          <motion.div style={{ height:'100%', background:'linear-gradient(90deg,var(--accent),var(--accent2))', boxShadow:'0 0 8px rgba(0,212,255,0.5)' }}
            animate={{ width:`${pct}%` }} transition={{ duration:0.25 }} />
        </div>
      </div>
    </motion.div>
  );
}
