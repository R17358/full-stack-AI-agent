import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import MessageRenderer from './MessageRenderer.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import { streamChat, uploadAndChat, clearMemory } from '../utils/api.js';

const TOOL_ICONS = {
  search_web:'🔍', query_knowledge_base:'📚', calculator:'🧮',
  multiplication_table:'✖️', get_datetime:'🕐', save_note:'📝',
  capture_and_analyze_photo:'📸', generate_image:'🎨',
  random_fact:'💡', system_info:'⚙️',
};

const SUGGESTIONS = [
  { icon:'🔍', text:'Search latest AI news today' },
  { icon:'🎨', text:'Generate image of a cyberpunk city at night' },
  { icon:'📸', text:'Capture and analyze a photo' },
  { icon:'💻', text:'Write a Python async web scraper' },
  { icon:'🧮', text:'Calculate sin(π/4) + factorial(10)' },
  { icon:'📚', text:'What documents have I uploaded?' },
];

const IMG_EXTS = /\.(png|jpg|jpeg|gif|webp|avif|bmp|tiff?)$/i;

export default function ChatPanel({ messages, setMessages, sessionId, online, appConfig }) {
  const [input, setInput]             = useState('');
  const [streaming, setStreaming]     = useState(false);
  const [phase, setPhase]             = useState(null);           // thinking|tool_use|streaming|done
  const [showFeed, setShowFeed]         = useState(false);
  const feedTimerRef                    = useRef(null);
  const [activityEvents, setActivity] = useState([]);             // live feed events
  const [streamText, setStreamText]   = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [error, setError]             = useState(null);
  const [dragOver, setDragOver]       = useState(false);
  const endRef   = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, streamText]);

  const addEvent = useCallback((ev) => {
    setActivity(p => [...p, { ...ev, timestamp: Date.now() }]);
  }, []);

  const addFile = useCallback((file) => {
    if (!file) return;
    const isImg = IMG_EXTS.test(file.name);
    const entry = { id: uuidv4(), file, type: isImg ? 'image' : 'doc', preview: null };
    if (isImg) {
      const reader = new FileReader();
      reader.onload = e =>
        setPendingFiles(p => p.map(f => f.id === entry.id ? { ...f, preview: e.target.result } : f));
      reader.readAsDataURL(file);
    }
    setPendingFiles(p => [...p, entry]);
  }, []);

  const removeFile = (id) => setPendingFiles(p => p.filter(f => f.id !== id));

  const pushAssistant = useCallback((content, tools_used = [], special = null) => {
    setMessages(p => [...p, {
      id: uuidv4(), role:'assistant',
      content: content || '',
      timestamp: new Date(),
      tools_used,
      special,
    }]);
  }, [setMessages]);

  const resetActivity = () => { if (feedTimerRef.current) clearTimeout(feedTimerRef.current); setActivity([]); setPhase(null); setShowFeed(false); };

  const send = useCallback(async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if ((!text && pendingFiles.length === 0) || streaming) return;

    setInput('');
    setError(null);
    setStreamText('');
    resetActivity();

    const fileNames = pendingFiles.map(f => f.file.name);
    const userContent = text + (fileNames.length ? '\n' + fileNames.map(n=>`📎 ${n}`).join('\n') : '');
    const userImgPreviews = pendingFiles.filter(f=>f.type==='image').map(f=>f.preview);

    setMessages(p => [...p, {
      id:uuidv4(), role:'user', content:userContent,
      timestamp:new Date(), imagePreviews:userImgPreviews,
    }]);

    const filesToSend = [...pendingFiles];
    setPendingFiles([]);
    setStreaming(true);
    setPhase('thinking');
    setShowFeed(true);
    if (feedTimerRef.current) clearTimeout(feedTimerRef.current);
    addEvent({ type:'thinking' });

    if (filesToSend.length > 0) {
      try {
        for (const { file } of filesToSend) {
          addEvent({ type:'tool_use', tool: IMG_EXTS.test(file.name) ? 'capture_and_analyze_photo' : 'query_knowledge_base', input: file.name });
        }
        const lastFile = filesToSend[filesToSend.length - 1];
        const res = await uploadAndChat(
          text || `Analyze this file: ${lastFile.file.name}`,
          sessionId,
          lastFile.file
        );
        addEvent({ type:'done' });
        pushAssistant(res.response || '', res.tools_used || [], res.special || null);
        if (!res.success && res.error === 'rate_limit')
          setError({ type:'rate_limit', msg:'API quota exceeded. Wait and retry.' });
      } catch (e) {
        setError({ type:'network', msg: e.message });
      } finally {
        setStreaming(false);
        setPhase('done');
        feedTimerRef.current = setTimeout(() => { setShowFeed(false); setActivity([]); setPhase(null); }, 3000);
      }
      return;
    }

    // Text streaming
    let full = '';
    let finalTools = [];
    let finalSpecial = null;
    let chunkStarted = false;

    await streamChat(text, sessionId, {
      onThinking: () => { setPhase('thinking'); },
      onToolUse: (d) => {
        setPhase('tool_use');
        addEvent({ type:'tool_use', tool: d.tool, input: d.input });
      },
      onChunk: (c) => {
        if (!chunkStarted) {
          chunkStarted = true;
          setPhase('streaming');
          addEvent({ type:'chunk_start' });
        }
        full += c;
        setStreamText(full);
      },
      onSpecial: (d) => {
        finalSpecial = d;
        const label = d.type === 'captured_image' ? '📸 Photo captured & analyzed'
          : d.type === 'generated_image' ? `🎨 Image generated by ${d.provider}`
          : '✨ Special result';
        addEvent({ type:'special', text: label });
      },
      onDone: (d) => {
        finalTools = d.tools_used || [];
        pushAssistant(full, finalTools, finalSpecial);
        setStreamText('');
        setPhase('done');
        addEvent({ type:'done' });
        setStreaming(false);
        feedTimerRef.current = setTimeout(() => { setShowFeed(false); setActivity([]); setPhase(null); }, 3000);
        if (!d.success) {
          if (d.error === 'rate_limit') setError({ type:'rate_limit', msg:'API quota exceeded. Wait and retry.' });
          else if (d.error === 'auth_error') setError({ type:'auth', msg:'Invalid API key — check the CONFIG panel.' });
          else if (d.error) setError({ type:'general', msg:'Agent error — check backend console.' });
        }
      },
      onError: (m) => {
        setError({ type:'network', msg: m });
        setStreamText('');
        setStreaming(false);
        setPhase(null);
        setShowFeed(false);
        setActivity([]);
      },
    });
    inputRef.current?.focus();
  }, [input, streaming, pendingFiles, sessionId, pushAssistant, setMessages, addEvent]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(addFile);
  };

  const handleClear = async () => {
    await clearMemory(sessionId);
    resetActivity();
    setMessages([{ id:uuidv4(), role:'assistant', content:'**Memory cleared.** Fresh session started.', timestamp:new Date(), tools_used:[] }]);
  };

  return (
    <motion.div
      initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }}
      transition={{ duration:0.25 }}
      style={{ flex:1, display:'flex', flexDirection:'column', padding:'0.875rem', gap:'0.75rem', overflow:'hidden', position:'relative' }}
      onDragOver={e=>{e.preventDefault();setDragOver(true);}}
      onDragLeave={()=>setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontFamily:'var(--font-display)', fontSize:10, color:'var(--accent)', letterSpacing:'0.14em' }}>CHAT TERMINAL</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-dim)' }}>{messages.length - 1} messages</span>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <label style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'var(--font-display)', fontSize:9, color:'var(--text-secondary)', cursor:'pointer', background:'transparent', border:'1px solid var(--border)', borderRadius:4, padding:'4px 10px', letterSpacing:'0.08em', transition:'all 0.18s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)';}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            ATTACH
            <input type="file" multiple accept=".pdf,.docx,.doc,.txt,.md,.py,.js,.ts,.jsx,.tsx,.csv,.jpg,.jpeg,.png,.webp,.avif,.bmp,.tiff" style={{display:'none'}}
              onChange={e=>{Array.from(e.target.files).forEach(addFile);e.target.value='';}}/>
          </label>
          <button className="btn btn-ghost" onClick={handleClear} style={{ fontSize:'9px', padding:'4px 10px' }}>↻ CLEAR</button>
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            className="error-banner" style={{flexShrink:0}}>
            <span>{error.type==='rate_limit'?'⚡':error.type==='auth'?'🔐':'⚠️'}</span>
            <div style={{flex:1}}>
              <div style={{fontFamily:'var(--font-display)',fontSize:10,letterSpacing:'0.1em',color:'var(--red)',marginBottom:2}}>
                {error.type==='rate_limit'?'RATE LIMIT':error.type==='auth'?'AUTH ERROR':'ERROR'}
              </div>
              {error.msg}
            </div>
            <button onClick={()=>setError(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-dim)',fontSize:16}}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag overlay */}
      <AnimatePresence>
        {dragOver && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:'absolute', inset:'0.875rem', background:'rgba(0,0,0,0.4)', border:`2px dashed var(--accent)`, borderRadius:10, zIndex:20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, pointerEvents:'none' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <div style={{ fontFamily:'var(--font-display)', fontSize:14, color:'var(--accent)', letterSpacing:'0.15em' }}>DROP FILES TO ATTACH</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-secondary)' }}>Images · PDFs · Docs · Code</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="panel scroll-area" style={{ flex:1, padding:'1.25rem', display:'flex', flexDirection:'column', gap:'1.25rem' }}>
        {messages.length === 1 && !streaming && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {SUGGESTIONS.map((s, i) => (
              <motion.button key={i}
                initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
                onClick={() => send(s.text)}
                style={{ background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:7, padding:'8px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:8, textAlign:'left', transition:'all 0.18s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.background='var(--accent-dim)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg-panel)';}}>
                <span style={{fontSize:16,flexShrink:0}}>{s.icon}</span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-secondary)',lineHeight:1.4}}>{s.text}</span>
              </motion.button>
            ))}
          </div>
        )}

        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

        {/* Streaming bubble */}
        <AnimatePresence>
          {streaming && streamText && (
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}
              style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <AgentAvatar pulse />
              <div style={{ flex:1, background:'var(--accent-dim)', border:'1px solid var(--border-dim)', borderRadius:'4px 10px 10px 10px', padding:'10px 14px' }}>
                <div className="msg-md" style={{ fontSize:14, lineHeight:1.75 }}>
                  <span>{streamText}</span>
                  <motion.span animate={{opacity:[1,0]}} transition={{duration:0.5,repeat:Infinity}}
                    style={{color:'var(--accent)',fontFamily:'var(--font-mono)'}}>▋</motion.span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* ── LIVE ACTIVITY FEED ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFeed && (
          <ActivityFeed
            streaming={streaming}
            phase={phase}
            events={activityEvents}
          />
        )}
      </AnimatePresence>

      {/* Pending file previews */}
      <AnimatePresence>
        {pendingFiles.length > 0 && (
          <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            style={{ display:'flex', flexWrap:'wrap', gap:8, flexShrink:0 }}>
            {pendingFiles.map(pf => (
              <motion.div key={pf.id}
                initial={{opacity:0,scale:0.88}} animate={{opacity:1,scale:1}}
                style={{ position:'relative', borderRadius:7, overflow:'hidden', border:'1px solid var(--border)' }}>
                {pf.type === 'image' && pf.preview ? (
                  <div>
                    <img src={pf.preview} alt={pf.file.name}
                      style={{ width:80, height:80, objectFit:'cover', display:'block' }} />
                    <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.75)', padding:'2px 5px', fontSize:8, fontFamily:'var(--font-mono)', color:'#fff', textOverflow:'ellipsis', whiteSpace:'nowrap', overflow:'hidden' }}>
                      {pf.file.name}
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px', background:'var(--accent-dim)', minWidth:130, maxWidth:200 }}>
                    <span style={{fontSize:18}}>{pf.file.name.match(/\.pdf$/i)?'📄':pf.file.name.match(/\.docx?$/i)?'📝':'💾'}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--accent)', textOverflow:'ellipsis', whiteSpace:'nowrap', overflow:'hidden' }}>{pf.file.name}</span>
                  </div>
                )}
                <button onClick={() => removeFile(pf.id)}
                  style={{ position:'absolute', top:3, right:3, width:18, height:18, background:'rgba(0,0,0,0.8)', border:'none', borderRadius:'50%', cursor:'pointer', color:'#fff', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>×</button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="panel" style={{ padding:'10px', flexShrink:0 }}>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
          <label style={{ flexShrink:0, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', color:'var(--text-dim)', transition:'all 0.18s', background:'transparent' }}
            onMouseEnter={e=>{e.currentTarget.style.color='var(--accent)';e.currentTarget.style.borderColor='var(--accent)';}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--text-dim)';e.currentTarget.style.borderColor='var(--border)';}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
            <input type="file" multiple
              accept=".pdf,.docx,.doc,.txt,.md,.py,.js,.ts,.jsx,.tsx,.csv,.jpg,.jpeg,.png,.webp,.avif,.bmp,.tiff"
              style={{display:'none'}}
              onChange={e=>{Array.from(e.target.files).forEach(addFile);e.target.value='';}}/>
          </label>

          <textarea ref={inputRef} className="input-field" value={input}
            onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
            placeholder={
              !online ? "⚠️ Backend offline — start FastAPI on port 8000"
              : pendingFiles.length > 0 ? `Ask about ${pendingFiles.map(f=>f.file.name).join(', ')} — or send to analyze…`
              : "Message NEXUS… drag & drop files, attach images, or type a command"
            }
            disabled={streaming || !online} rows={1}
            style={{ resize:'none', flex:1, fontFamily:'var(--font-mono)', fontSize:13, minHeight:38, maxHeight:110, overflowY:'auto', lineHeight:1.5, padding:'9px 12px' }}
            onInput={e => { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,110)+'px'; }} />

          <motion.button whileTap={{ scale:0.93 }} className="btn btn-primary"
            onClick={() => send()}
            disabled={streaming || (!input.trim() && pendingFiles.length === 0) || !online}
            style={{ height:38, padding:'0 18px', flexShrink:0 }}>
            {streaming
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            }
            {streaming ? 'PROC' : 'SEND'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function AgentAvatar({ pulse }) {
  return (
    <div style={{ width:32, height:32, flexShrink:0, background:'var(--accent-dim)', border:'1px solid var(--border-bright)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', boxShadow: pulse?'0 0 12px var(--accent-glow)':undefined }}>
      <svg width="15" height="15" viewBox="0 0 30 30">
        <polygon points="15,2 27,8.5 27,21.5 15,28 3,21.5 3,8.5" fill="none" stroke="var(--accent)" strokeWidth="2"/>
        <text x="15" y="20" textAnchor="middle" fill="var(--accent)" fontSize="10" fontFamily="Orbitron,monospace" fontWeight="800">N</text>
      </svg>
    </div>
  );
}

function UserAvatar() {
  return (
    <div style={{ width:32, height:32, flexShrink:0, background:'var(--user-avatar-bg)', border:'1px solid var(--user-avatar-border)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--user-avatar-color)" strokeWidth="1.5">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.22}}
      style={{ display:'flex', gap:10, alignItems:'flex-start', flexDirection: isUser?'row-reverse':'row' }}>
      {isUser ? <UserAvatar /> : <AgentAvatar />}
      <div style={{ flex:1, maxWidth:'86%' }}>
        {/* Tool chips */}
        {!isUser && msg.tools_used?.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
            {msg.tools_used.map((t,i) => (
              <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:2, fontSize:9, fontFamily:'var(--font-display)', letterSpacing:'0.07em', background:'var(--accent-dim)', color:'var(--accent2)', border:'1px solid var(--border)', textTransform:'uppercase' }}>
                {TOOL_ICONS[t.tool]||'⚙️'} {t.tool.replace(/_/g,' ')}
              </span>
            ))}
          </div>
        )}
        {/* Image previews (user messages) */}
        {isUser && msg.imagePreviews?.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6, justifyContent:'flex-end' }}>
            {msg.imagePreviews.map((src,i) => (
              <img key={i} src={src} alt="attached"
                style={{ width:80, height:80, objectFit:'cover', borderRadius:6, border:'1px solid var(--border)' }} />
            ))}
          </div>
        )}
        <div style={{ background: isUser?'var(--user-bubble)':'var(--agent-bubble)', border:`1px solid ${isUser?'var(--user-bubble-border)':'var(--border-dim)'}`, borderRadius: isUser?'10px 4px 10px 10px':'4px 10px 10px 10px', padding:'10px 14px' }}>
          {isUser
            ? <p style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'var(--text-primary)', margin:0, whiteSpace:'pre-wrap' }}>{msg.content}</p>
            : <MessageRenderer content={msg.content} special={msg.special} />
          }
        </div>
        <div style={{ marginTop:3, fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-dim)', textAlign:isUser?'right':'left' }}>
          {msg.timestamp?.toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
}