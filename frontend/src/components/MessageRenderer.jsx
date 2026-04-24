import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock.jsx';
import { imageUrl } from '../utils/api.js';

export default function MessageRenderer({ content, special }) {
  // Guard: content must be a string
  const safeContent = (content !== undefined && content !== null) ? String(content) : '';

  return (
    <div className="msg-md" style={{ fontSize:14, lineHeight:1.75 }}>
      {/* Special: captured image */}
      {special?.type === 'captured_image' && (
        <CapturedImageCard filename={special.filename} description={special.description} />
      )}
      {/* Special: generated image */}
      {special?.type === 'generated_image' && (
        <GeneratedImageCard filename={special.filename} provider={special.provider} prompt={special.prompt} />
      )}

      {safeContent && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              // Guard children
              const raw = children !== undefined && children !== null
                ? String(Array.isArray(children) ? children.join('') : children).replace(/\n$/, '')
                : '';
              if (inline || !raw.includes('\n') && raw.length < 80) {
                return <code {...props}>{raw || ''}</code>;
              }
              const lang = (className || '').replace('language-', '') || 'text';
              return <CodeBlock language={lang} code={raw} />;
            },
            a({ href, children }) {
              return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
            },
          }}
        >
          {safeContent}
        </ReactMarkdown>
      )}
    </div>
  );
}

function CapturedImageCard({ filename, description }) {
  return (
    <div style={{ background:'var(--accent-dim)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:'0.8em' }}>
      <img src={imageUrl(filename)} alt="Captured"
        style={{ width:'100%', maxHeight:300, objectFit:'cover', display:'block' }}
        onError={e => e.target.style.display='none'} />
      <div style={{ padding:'10px 12px' }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:9, color:'var(--accent)', letterSpacing:'0.12em', marginBottom:6 }}>📸 CAPTURED + ANALYZED</div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-secondary)', lineHeight:1.6, maxHeight:120, overflow:'auto' }}>
          {description?.slice(0, 300)}{description?.length > 300 ? '…' : ''}
        </div>
      </div>
    </div>
  );
}

function GeneratedImageCard({ filename, provider, prompt }) {
  const download = () => {
    const a = document.createElement('a');
    a.href = imageUrl(filename);
    a.download = filename;
    a.click();
  };
  return (
    <div style={{ background:'var(--accent-dim)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:'0.8em' }}>
      <img src={imageUrl(filename)} alt={prompt}
        style={{ width:'100%', maxHeight:340, objectFit:'cover', display:'block' }}
        onError={e => e.target.style.display='none'} />
      <div style={{ padding:'10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:9, color:'var(--accent)', letterSpacing:'0.12em', marginBottom:3 }}>🎨 GENERATED · {provider?.toUpperCase()}</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-dim)' }}>"{prompt?.slice(0, 80)}{prompt?.length > 80 ? '…' : ''}"</div>
        </div>
        <button onClick={download} className="btn btn-ghost" style={{ fontSize:'9px', padding:'5px 10px', flexShrink:0 }}>↓ SAVE</button>
      </div>
    </div>
  );
}