import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TOOL_META = {
  search_web:                { icon:'🔍', label:'Searching web',        color:'var(--accent)' },
  query_knowledge_base:      { icon:'📚', label:'Querying documents',   color:'var(--accent2)' },
  calculator:                { icon:'🧮', label:'Calculating',          color:'var(--accent)' },
  multiplication_table:      { icon:'✖️', label:'Building table',       color:'var(--accent)' },
  get_datetime:              { icon:'🕐', label:'Getting date/time',    color:'var(--accent)' },
  save_note:                 { icon:'📝', label:'Saving note',          color:'var(--accent)' },
  capture_and_analyze_photo: { icon:'📸', label:'Capturing photo',      color:'var(--accent2)' },
  generate_image:            { icon:'🎨', label:'Generating image',     color:'var(--accent)' },
  random_fact:               { icon:'💡', label:'Fetching fact',        color:'var(--accent2)' },
  system_info:               { icon:'⚙️', label:'Reading config',       color:'var(--text-secondary)' },
};

const PHASE_LABELS = {
  thinking:  { icon:'🧠', label:'Thinking…',        color:'var(--text-secondary)' },
  tool_use:  { icon:'⚡', label:'Using tool',        color:'var(--accent)' },
  streaming: { icon:'✍️', label:'Writing response', color:'var(--accent2)' },
  done:      { icon:'✅', label:'Complete',          color:'var(--accent2)' },
};

/**
 * ActivityFeed — live panel showing what the agent is doing right now.
 *
 * Props:
 *   streaming   — bool: agent is currently running
 *   phase       — 'thinking' | 'tool_use' | 'streaming' | 'done' | null
 *   events      — array of {type, tool?, input?, text?, timestamp}
 */
export default function ActivityFeed({ streaming, phase, events }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  if (!streaming && events.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity:0, height:0 }}
      animate={{ opacity:1, height:'auto' }}
      exit={{ opacity:0, height:0 }}
      transition={{ duration:0.25 }}
      style={{
        background:'var(--bg-panel)',
        border:'1px solid var(--border)',
        borderRadius:8,
        overflow:'hidden',
        flexShrink:0,
        position:'relative',
      }}
    >
      {/* Top bar */}
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        padding:'7px 12px',
        borderBottom:'1px solid var(--border-dim)',
        background:'var(--accent-dim)',
      }}>
        {streaming && (
          <motion.div
            animate={{ rotate:360 }}
            transition={{ duration:1.2, repeat:Infinity, ease:'linear' }}
            style={{ width:12, height:12, border:`2px solid var(--accent)`, borderTopColor:'transparent', borderRadius:'50%', flexShrink:0 }}
          />
        )}
        {!streaming && <span style={{fontSize:12}}>✅</span>}
        <span style={{ fontFamily:'var(--font-display)', fontSize:9, color:'var(--accent)', letterSpacing:'0.14em' }}>
          {streaming ? 'AGENT ACTIVITY' : 'COMPLETED'}
        </span>
        {phase && PHASE_LABELS[phase] && (
          <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:PHASE_LABELS[phase].color, marginLeft:4 }}>
            {PHASE_LABELS[phase].icon} {PHASE_LABELS[phase].label}
          </span>
        )}
      </div>

      {/* Event log */}
      <div ref={scrollRef} style={{ maxHeight:140, overflowY:'auto', padding:'8px 12px', display:'flex', flexDirection:'column', gap:5 }}>
        <AnimatePresence initial={false}>
          {events.map((ev, i) => (
            <EventRow key={i} ev={ev} isLast={i === events.length - 1 && streaming} />
          ))}
        </AnimatePresence>
        {streaming && phase === 'thinking' && events.length === 0 && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}}
            style={{ display:'flex', alignItems:'center', gap:8, fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-dim)' }}>
            <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
            <span style={{marginLeft:4}}>Agent is thinking…</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function EventRow({ ev, isLast }) {
  const meta = ev.tool ? (TOOL_META[ev.tool] || { icon:'⚙️', label: ev.tool.replace(/_/g,' '), color:'var(--accent)' }) : null;

  return (
    <motion.div
      initial={{ opacity:0, x:-8 }}
      animate={{ opacity:1, x:0 }}
      transition={{ duration:0.2 }}
      style={{ display:'flex', alignItems:'flex-start', gap:8 }}
    >
      {/* Timeline dot */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, paddingTop:3 }}>
        <div style={{
          width:8, height:8, borderRadius:'50%',
          background: meta ? (meta.color || 'var(--accent)') : 'var(--text-dim)',
          boxShadow: isLast ? `0 0 8px ${meta?.color || 'var(--accent)'}` : 'none',
          transition:'box-shadow 0.3s',
        }}/>
      </div>

      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        {ev.type === 'thinking' && (
          <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-secondary)' }}>
            🧠 Reasoning about your request…
          </span>
        )}
        {ev.type === 'tool_use' && meta && (
          <div>
            <span style={{ fontFamily:'var(--font-display)', fontSize:9, color: meta.color, letterSpacing:'0.08em' }}>
              {meta.icon} {meta.label.toUpperCase()}
            </span>
            {ev.input && (
              <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-dim)', marginLeft:8 }}>
                "{String(ev.input).slice(0, 60)}{String(ev.input).length > 60 ? '…' : ''}"
              </span>
            )}
          </div>
        )}
        {ev.type === 'chunk_start' && (
          <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-secondary)' }}>
            ✍️ Writing response…
          </span>
        )}
        {ev.type === 'special' && (
          <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--accent2)' }}>
            {ev.text}
          </span>
        )}
        {ev.type === 'done' && (
          <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--accent2)' }}>
            ✅ Done
          </span>
        )}
      </div>

      {/* Timestamp */}
      <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-dim)', flexShrink:0, paddingTop:2 }}>
        {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}) : ''}
      </span>
    </motion.div>
  );
}