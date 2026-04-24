import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import BootScreen from './components/BootScreen.jsx';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import ToolsPanel from './components/ToolsPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import { checkHealth, getConfig } from './utils/api.js';
import { applyTheme, getSavedTheme, THEMES } from './utils/themes.js';

const WELCOME = {
  id: uuidv4(), role: 'assistant', timestamp: new Date(),
  content: [
    '**NEXUS v3 — ALL SYSTEMS ONLINE**',
    '',
    'Everything happens right here in chat:',
    '- 📎 **Attach files** (PDF, DOCX, TXT, code) → I\'ll index them and answer questions',
    '- 🖼️ **Drop images** → I\'ll analyze and remember them for the session',
    '- 🎨 **"Generate image of..."** → AI image generation *(set IMAGE_PROVIDER in Config)*',
    '- 📸 **"Capture a photo"** → Webcam capture + vision analysis',
    '- 🔍 **"Search..."** → Real-time web search',
    '- 💻 **"Write code..."** → Syntax-highlighted code with copy button',
    '',
    'Try a suggestion below or drag & drop a file to start.',
  ].join('\n'),
  tools_used: [],
};

export default function App() {
  const [booting, setBooting]       = useState(true);
  const [sessionId]                 = useState(() => uuidv4());
  const [panel, setPanel]           = useState('chat');
  const [health, setHealth]         = useState({ online: false, rag_ready: false });
  const [appConfig, setAppConfig]   = useState(null);
  const [messages, setMessages]     = useState([WELCOME]);
  const [theme, setTheme]           = useState(getSavedTheme());

  // Apply theme on mount and when changed
  useEffect(() => { applyTheme(theme); }, [theme]);

  const changeTheme = (id) => { setTheme(id); applyTheme(id); };

  const refreshStatus = useCallback(async () => {
    const [h, c] = await Promise.all([checkHealth(), getConfig()]);
    setHealth({ online: h.online, rag_ready: h.rag_ready ?? false });
    if (c) setAppConfig({ ...c, initialized: h.rag_ready ?? false });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setBooting(false); refreshStatus(); }, 2600);
    return () => clearTimeout(t);
  }, [refreshStatus]);

  useEffect(() => {
    if (booting) return;
    const iv = setInterval(refreshStatus, 30000);
    return () => clearInterval(iv);
  }, [booting, refreshStatus]);

  return (
    <AnimatePresence mode="wait">
      {booting ? (
        <BootScreen key="boot" />
      ) : (
        <motion.div key="app" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.4 }}
          style={{ display:'flex', flexDirection:'column', height:'100vh', width:'100vw', position:'relative', zIndex:1 }}>

          {/* Ambient glows */}
          <div style={{ position:'fixed', top:-80, left:'15%', width:500, height:500, background:`radial-gradient(circle,var(--glow1) 0%,transparent 70%)`, pointerEvents:'none', zIndex:0 }} />
          <div style={{ position:'fixed', bottom:-120, right:'10%', width:600, height:600, background:`radial-gradient(circle,var(--glow2) 0%,transparent 70%)`, pointerEvents:'none', zIndex:0 }} />

          <Header health={health} appConfig={appConfig} sessionId={sessionId} theme={theme} />

          <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative', zIndex:1 }}>
            <Sidebar panel={panel} setPanel={setPanel} />
            <main style={{ flex:1, overflow:'hidden', display:'flex' }}>
              <AnimatePresence mode="wait">
                {panel === 'chat' && (
                  <ChatPanel key="chat" messages={messages} setMessages={setMessages}
                    sessionId={sessionId} online={health.online} appConfig={appConfig} />
                )}
                {panel === 'tools' && <ToolsPanel key="tools" />}
                {panel === 'settings' && (
                  <SettingsPanel key="settings" appConfig={appConfig} onSaved={refreshStatus}
                    theme={theme} onThemeChange={changeTheme} themes={THEMES} />
                )}
              </AnimatePresence>
            </main>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}