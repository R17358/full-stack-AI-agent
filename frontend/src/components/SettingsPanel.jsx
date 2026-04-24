import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getConfig, updateConfig } from '../utils/api.js';

const LLM_PROVIDERS = [
  { id:'google',    label:'Google Gemini',    models:['gemini-2.5-flash','gemini-1.5-pro','gemini-1.5-flash'], keyVar:'GOOGLE_API_KEY' },
  { id:'openai',    label:'OpenAI GPT',        models:['gpt-4o','gpt-4o-mini','gpt-3.5-turbo'],                keyVar:'OPENAI_API_KEY' },
  { id:'anthropic', label:'Anthropic Claude',  models:['claude-sonnet-4-5','claude-3-5-haiku-20241022'],       keyVar:'ANTHROPIC_API_KEY' },
  { id:'ollama',    label:'Ollama (Local)',     models:['llama3','mistral','phi3','gemma2','qwen2'],             keyVar:'none' },
];

const IMG_PROVIDERS = [
  { id:'',          label:'Disabled' },
  { id:'stability', label:'Stability AI (SDXL)' },
  { id:'openai',    label:'OpenAI DALL-E 3' },
  { id:'google',    label:'Google Imagen 3' },
];

export default function SettingsPanel({ appConfig, onSaved, theme, onThemeChange, themes }) {
  const [cfg, setCfg]           = useState(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState(null);
  const [llmProvider, setLlmProvider] = useState('google');
  const [llmModel, setLlmModel]       = useState('gemini-2.5-flash');
  const [imgProvider, setImgProvider] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [keys, setKeys] = useState({ google:'', openai:'', anthropic:'', tavily:'', stability:'' });

  useEffect(() => {
    getConfig().then(c => {
      if (!c) return;
      setCfg(c);
      setLlmProvider(c.llm_provider || 'google');
      setLlmModel(c.llm_model || 'gemini-2.5-flash');
      setImgProvider(c.image_provider || '');
    });
  }, []);

  const activeProv = LLM_PROVIDERS.find(p => p.id === llmProvider);

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const payload = { llm_provider: llmProvider, llm_model: llmModel, image_provider: imgProvider, temperature };
      if (keys.google)    payload.google_api_key    = keys.google;
      if (keys.openai)    payload.openai_api_key    = keys.openai;
      if (keys.anthropic) payload.anthropic_api_key = keys.anthropic;
      if (keys.tavily)    payload.tavily_api_key    = keys.tavily;
      if (keys.stability) payload.stability_api_key = keys.stability;
      await updateConfig(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-16}} transition={{duration:0.25}}
      style={{ flex:1, display:'flex', flexDirection:'column', padding:'0.875rem', gap:'0.75rem', overflow:'hidden' }}>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:10, color:'var(--accent)', letterSpacing:'0.14em' }}>SYSTEM CONFIG</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-dim)', marginTop:2 }}>Hot-update. Edit .env to persist.</div>
        </div>
        <motion.button whileTap={{scale:0.95}} className="btn btn-primary" onClick={save} disabled={saving}
          style={{ fontSize:'9px', padding:'6px 16px', background: saved ? 'var(--accent2)' : 'var(--accent)' }}>
          {saving ? '…SAVING' : saved ? '✅ SAVED' : '▶ APPLY'}
        </motion.button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="error-banner" style={{flexShrink:0}}>
            <span>⚠️</span><span style={{flex:1}}>{error}</span>
            <button onClick={()=>setError(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',fontSize:16}}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="panel scroll-area" style={{ flex:1, padding:'1.25rem', display:'flex', flexDirection:'column', gap:'1.5rem' }}>

        {/* ── Themes ── */}
        <Section title="THEME" icon="🎨">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
            {Object.values(themes).map(t => (
              <button key={t.id} className={`theme-btn${theme===t.id?' active':''}`} onClick={() => onThemeChange(t.id)}>
                <span style={{fontSize:20}}>{t.icon}</span>
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* ── LLM ── */}
        <Section title="LLM PROVIDER" icon="🤖">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <Label>Provider</Label>
              <select className="input-field" value={llmProvider}
                onChange={e=>{setLlmProvider(e.target.value);setLlmModel(LLM_PROVIDERS.find(p=>p.id===e.target.value)?.models[0]||'');}}>
                {LLM_PROVIDERS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Model</Label>
              <select className="input-field" value={llmModel} onChange={e=>setLlmModel(e.target.value)}>
                {(activeProv?.models||[]).map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Temperature: <strong style={{color:'var(--accent)'}}>{temperature.toFixed(2)}</strong></Label>
            <input type="range" min="0" max="1" step="0.05" value={temperature}
              onChange={e=>setTemperature(parseFloat(e.target.value))} />
            <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-mono)',fontSize:8,color:'var(--text-dim)',marginTop:2}}>
              <span>0 — precise</span><span>1 — creative</span>
            </div>
          </div>
          {llmProvider==='ollama'&&(
            <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'#ffd700',marginTop:4}}>
              ℹ️ Ollama runs locally. Ensure it's running: <code style={{color:'var(--accent2)'}}>ollama serve</code>
            </div>
          )}
        </Section>

        {/* ── API Keys ── */}
        <Section title="API KEYS" icon="🔐">
          <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text-dim)',marginBottom:6}}>
            Leave blank to keep existing keys. Never written to disk.
          </div>
          {[
            {id:'google',    label:'Google API Key',    ph:'AIza…',    url:'https://aistudio.google.com/apikey'},
            {id:'openai',    label:'OpenAI API Key',    ph:'sk-…',     url:'https://platform.openai.com/api-keys'},
            {id:'anthropic', label:'Anthropic API Key', ph:'sk-ant-…', url:'https://console.anthropic.com/'},
            {id:'tavily',    label:'Tavily (Web Search)',ph:'tvly-…',  url:'https://tavily.com/'},
            {id:'stability', label:'Stability AI Key',  ph:'sk-…',     url:'https://platform.stability.ai/'},
          ].map(k=>(
            <div key={k.id} style={{marginBottom:8}}>
              <Label>
                {k.label}
                {cfg?.[`has_${k.id}_key`]&&<span style={{marginLeft:6,background:'var(--accent-dim)',color:'var(--accent2)',border:'1px solid rgba(0,255,204,0.25)',borderRadius:2,padding:'1px 5px',fontSize:7,fontFamily:'var(--font-display)',letterSpacing:'0.07em'}}>SET</span>}
                <a href={k.url} target="_blank" rel="noopener noreferrer"
                  style={{marginLeft:8,color:'var(--accent)',fontSize:9,fontFamily:'var(--font-mono)',textDecoration:'none'}}>get key ↗</a>
              </Label>
              <input type="password" className="input-field"
                placeholder={cfg?.[`has_${k.id}_key`]?'••••••••••••':k.ph}
                value={keys[k.id]} onChange={e=>setKeys(p=>({...p,[k.id]:e.target.value}))}
                style={{fontFamily:'var(--font-mono)',fontSize:12}} />
            </div>
          ))}
        </Section>

        {/* ── Image Gen ── */}
        <Section title="IMAGE GENERATION" icon="🎨">
          <div>
            <Label>Provider</Label>
            <select className="input-field" value={imgProvider} onChange={e=>setImgProvider(e.target.value)}>
              {IMG_PROVIDERS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          {imgProvider===''&&(
            <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-dim)',marginTop:4,lineHeight:1.6}}>
              Image generation disabled. Select a provider above and set its API key.
            </div>
          )}
        </Section>

        {/* ── RAG Info ── */}
        <Section title="RAG ENGINE" icon="📚">
          <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-secondary)',lineHeight:1.7}}>
            Using <strong style={{color:'var(--accent)'}}>FAISS + sentence-transformers/all-mpnet-base-v2</strong>
            <br/>No API key required. ~420 MB model downloaded on first startup.
            <br/>Upload files directly in chat — ask questions inline.
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
            <div className="status-pulse" style={{width:6,height:6,borderRadius:'50%',background:appConfig?.initialized?'var(--accent2)':'var(--red)',boxShadow:appConfig?.initialized?'0 0 6px var(--accent2)':'0 0 6px var(--red)'}}/>
            <span style={{fontFamily:'var(--font-display)',fontSize:9,color:appConfig?.initialized?'var(--accent2)':'var(--red)',letterSpacing:'0.1em'}}>
              {appConfig?.initialized?'RAG ONLINE':'RAG OFFLINE'}
            </span>
          </div>
        </Section>

        {/* ── Warnings ── */}
        {cfg?.warnings?.length>0&&(
          <Section title="WARNINGS" icon="⚠️">
            {cfg.warnings.map((w,i)=>(
              <div key={i} style={{fontFamily:'var(--font-mono)',fontSize:11,color:'#ffd700',lineHeight:1.6,marginBottom:4}}>• {w}</div>
            ))}
          </Section>
        )}
      </div>
    </motion.div>
  );
}

function Section({title,icon,children}){
  return(
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:14}}>{icon}</span>
        <div style={{fontFamily:'var(--font-display)',fontSize:10,color:'var(--accent)',letterSpacing:'0.12em'}}>{title}</div>
        <div style={{flex:1,height:1,background:'var(--border-dim)'}}/>
      </div>
      {children}
    </div>
  );
}

function Label({children}){
  return(
    <div style={{fontFamily:'var(--font-display)',fontSize:8,color:'var(--text-dim)',letterSpacing:'0.1em',marginBottom:5,display:'flex',alignItems:'center'}}>
      {children}
    </div>
  );
}