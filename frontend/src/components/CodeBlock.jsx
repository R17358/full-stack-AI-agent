import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

const theme = {
  'code[class*="language-"]': { color:'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:'12px', lineHeight:'1.6' },
  'pre[class*="language-"]': { background:'transparent', margin:0, padding:'1rem', overflow:'auto' },
  comment: { color:'var(--text-dim)', fontStyle:'italic' },
  punctuation: { color:'var(--text-secondary)' },
  keyword: { color:'var(--accent)', fontWeight:'600' },
  string: { color:'var(--accent2)' },
  number: { color:'var(--accent2)' },
  boolean: { color:'var(--accent2)' },
  function: { color:'var(--accent)' },
  'class-name': { color:'#ffd700' },
  operator: { color:'var(--text-secondary)' },
  property: { color:'var(--accent2)' },
  builtin: { color:'var(--accent)' },
  'attr-name': { color:'var(--accent2)' },
  'attr-value': { color:'var(--accent2)' },
  tag: { color:'var(--accent)' },
  selector: { color:'var(--accent)' },
  variable: { color:'var(--text-primary)' },
  regex: { color:'var(--accent2)' },
  important: { color:'#ffd700', fontWeight:'bold' },
};

function extractFilename(code) {
  const firstLine = (code || '').split('\n')[0];
  const m = firstLine.match(/^[#/\-*]+\s*(?:filename|file)?:?\s*(\S+\.\w+)/i);
  return m ? m[1] : null;
}

export default function CodeBlock({ language, code, filename: filenameProp }) {
  const [copied, setCopied] = useState(false);

  // Guard: code must be a non-empty string
  const safeCode = (code !== undefined && code !== null) ? String(code) : '';
  if (!safeCode.trim()) return null;

  const lang = language || 'text';
  const filename = filenameProp || extractFilename(safeCode);

  const copy = async () => {
    try { await navigator.clipboard.writeText(safeCode); } catch (_) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ margin:'0.8em 0', borderRadius:8, overflow:'hidden', border:'1px solid var(--border)', background:'rgba(0,0,0,0.5)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 12px', background:'var(--accent-dim)', borderBottom:'1px solid var(--border-dim)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', gap:4 }}>
            {['#ff5f57','#febc2e','#28c840'].map((c,i)=>(
              <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:c, opacity:0.7 }}/>
            ))}
          </div>
          {filename && <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-secondary)' }}>{filename}</span>}
          <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'1px 6px', borderRadius:2, fontSize:9, fontFamily:'var(--font-display)', letterSpacing:'0.07em', background:'var(--accent-dim)', color:'var(--accent)', border:'1px solid var(--border)' }}>{lang}</span>
        </div>
        <button onClick={copy}
          style={{ display:'flex', alignItems:'center', gap:5, background:'transparent', border:'1px solid var(--border)', borderRadius:4, padding:'3px 8px', cursor:'pointer', fontFamily:'var(--font-display)', fontSize:'9px', letterSpacing:'0.08em', color: copied ? 'var(--accent2)' : 'var(--text-dim)', transition:'all 0.2s' }}
          onMouseEnter={e=>{ if(!copied) e.currentTarget.style.color='var(--accent)'; }}
          onMouseLeave={e=>{ if(!copied) e.currentTarget.style.color='var(--text-dim)'; }}>
          {copied ? (
            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>COPIED</>
          ) : (
            <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>COPY</>
          )}
        </button>
      </div>
      {/* Code */}
      <SyntaxHighlighter
        language={lang}
        style={theme}
        customStyle={{ margin:0, padding:'0.875rem 1rem', background:'transparent', maxHeight:'420px', overflow:'auto', fontSize:'12px', lineHeight:'1.6' }}
        showLineNumbers={safeCode.split('\n').length > 5}
        lineNumberStyle={{ color:'var(--text-dim)', fontSize:'10px', minWidth:'2.5em', paddingRight:'1em', userSelect:'none', opacity:0.5 }}
        wrapLongLines={false}
        PreTag="div"
      >
        {safeCode}
      </SyntaxHighlighter>
    </div>
  );
}

// Named export for use in MessageRenderer inline code detection
export { extractFilename };