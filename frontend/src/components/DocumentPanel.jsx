import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadDocument, listDocuments, deleteDocument } from '../utils/api.js';

const EXT_ICON = { '.pdf':'📄','.txt':'📝','.md':'📋','.markdown':'📋','.py':'🐍','.js':'🟨','.ts':'🔷','.jsx':'⚛️','.tsx':'⚛️','.java':'☕','.go':'🐹','.rs':'🦀','.cpp':'⚙️','.c':'⚙️','.csv':'📊' };

export default function DocumentPanel({ docs, setDocs, appConfig }) {
  const [loading, setLoading]   = useState(false);
  const [uploading, setUploading] = useState(null);
  const [error, setError]       = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try { const d = await listDocuments(); setDocs(d.documents || []); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [setDocs]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const upload = async (file) => {
    if (!file) return;
    setError(null);
    setUploading(file.name);
    try {
      const r = await uploadDocument(file);
      setUploading(`✅ ${r.chunks} chunks indexed`);
      await fetchDocs();
      setTimeout(() => setUploading(null), 3000);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('quota')||msg.includes('429')) setError('⚡ Embedding API quota exceeded. Set EMBEDDING_PROVIDER=local in .env');
      else setError(msg);
      setUploading(null);
    }
  };

  const remove = async (filename) => {
    try { await deleteDocument(filename); setDocs(p => p.filter(d=>d.filename!==filename)); }
    catch (e) { setError(e.message); }
  };

  return (
    <motion.div initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-16}} transition={{duration:0.25}}
      style={{ flex:1, display:'flex', flexDirection:'column', padding:'0.875rem', gap:'0.75rem', overflow:'hidden' }}>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:10, color:'var(--cyan)', letterSpacing:'0.14em' }}>KNOWLEDGE BASE</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-dim)', marginTop:2 }}>{docs.length} documents · {appConfig?.embedding_provider||'?'} embeddings</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <Pill on={appConfig?.initialized ?? false} label="RAG" />
          <button className="btn btn-ghost" onClick={fetchDocs} style={{fontSize:'9px',padding:'4px 10px'}}>↻ REFRESH</button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="error-banner" style={{flexShrink:0}}>
            <span>⚠️</span><span style={{flex:1}}>{error}</span>
            <button onClick={()=>setError(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',fontSize:16}}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {appConfig?.embedding_provider === 'local' && (
        <div style={{ background:'rgba(255,215,0,0.06)', border:'1px solid rgba(255,215,0,0.2)', borderRadius:6, padding:'8px 12px', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--yellow)', flexShrink:0 }}>
          ℹ️ Using local embeddings (sentence-transformers). First load may be slow while downloading model.
        </div>
      )}

      {/* Upload progress */}
      <AnimatePresence>
        {uploading && (
          <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            style={{ background:'var(--cyan-dim)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 14px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            {!uploading.startsWith('✅') && (
              <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}}
                style={{ width:13, height:13, border:'2px solid var(--cyan)', borderTopColor:'transparent', borderRadius:'50%' }} />
            )}
            <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--cyan)' }}>{uploading}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop zone */}
      <div className={`drop-zone ${dragging ? 'dragging' : ''}`} style={{ flexShrink:0 }}
        onClick={()=>fileRef.current?.click()}
        onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);upload(e.dataTransfer.files[0]);}}>
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.py,.js,.ts,.jsx,.tsx,.java,.go,.rs,.cpp,.c,.csv" style={{display:'none'}} onChange={e=>{ upload(e.target.files[0]); e.target.value=''; }} />
        <div style={{ fontSize:26, marginBottom:6 }}>{uploading&&!uploading.startsWith('✅')?'⏳':'📁'}</div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:10, color:'var(--cyan)', letterSpacing:'0.1em', marginBottom:3 }}>DROP FILE OR CLICK TO UPLOAD</div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-dim)' }}>PDF • TXT • MD • Code files — max 50MB</div>
      </div>

      {/* Tip: use in chat */}
      <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-dim)', flexShrink:0, padding:'0 2px' }}>
        💡 You can also attach files directly in the chat input bar to ask questions inline.
      </div>

      {/* Document list */}
      <div className="panel scroll-area" style={{ flex:1, padding:'0.875rem' }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:80, gap:10, color:'var(--text-dim)' }}>
            <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}}
              style={{ width:14, height:14, border:'2px solid var(--cyan)', borderTopColor:'transparent', borderRadius:'50%' }} />
            Loading…
          </div>
        ) : docs.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:11, padding:'2rem', lineHeight:2 }}>
            <div style={{ fontSize:28, marginBottom:8, opacity:0.4 }}>📂</div>
            No documents indexed.<br/>Upload files to enable document Q&A.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {docs.map((d, i) => <DocRow key={i} doc={d} onDelete={remove} />)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Pill({ on, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'var(--font-display)', fontSize:9, letterSpacing:'0.1em', color: on?'var(--teal)':'var(--red)' }}>
      <div className={on?'status-pulse':''} style={{ width:5, height:5, borderRadius:'50%', background:on?'var(--teal)':'var(--red)', boxShadow:on?'0 0 6px var(--teal)':'0 0 5px var(--red)' }} />{label}
    </div>
  );
}

function DocRow({ doc, onDelete }) {
  const [del, setDel] = useState(false);
  const ext = '.' + doc.filename.split('.').pop().toLowerCase();
  return (
    <motion.div initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}}
      style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'rgba(0,212,255,0.03)', border:'1px solid var(--border-dim)', borderRadius:6, transition:'border-color 0.18s' }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border-dim)'}>
      <span style={{ fontSize:16, flexShrink:0 }}>{EXT_ICON[ext]||'📄'}</span>
      <div style={{ flex:1, overflow:'hidden' }}>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{doc.filename}</div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-dim)', marginTop:2 }}>{ext.replace('.','').toUpperCase()}</div>
      </div>
      <span className="chip chip-teal">INDEXED</span>
      <button className="btn btn-danger" onClick={async()=>{setDel(true);await onDelete(doc.filename);}} disabled={del} style={{ fontSize:'9px', padding:'4px 9px', flexShrink:0 }}>
        {del?'…':'REMOVE'}
      </button>
    </motion.div>
  );
}
