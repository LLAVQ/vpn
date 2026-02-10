import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, Trash2, Copy, Cpu, HardDrive, Activity, 
  Plus, CheckCircle2, AlertCircle, RefreshCw,
  Shield, Globe, ChevronRight, Settings, 
  LayoutDashboard, Server, BarChart3, ShieldCheck,
  ArrowUpRight, ArrowDownLeft, Network, Terminal,
  Clock, History, Timer, WifiOff, CloudOff, Cloud,
  QrCode, Eye, ExternalLink, Search, Filter, X,
  Waves, Radio, Layers, Smartphone, Rocket,
  TrendingUp, Gauge
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedNodeQr, setSelectedNodeQr] = useState(null);
  
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
    if (!document.getElementById('qr-lib')) {
      const script = document.createElement('script');
      script.id = 'qr-lib';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      document.head.appendChild(script);
    }
  }, []);

  const autoApiBase = (() => {
    const origin = window.location.origin;
    if (origin.includes(':5173')) return origin.replace(':5173', ':3000');
    if (origin.includes('-5173.app.github.dev')) return origin.replace('-5173.app.github.dev', '-3000.app.github.dev');
    return origin;
  })();

  const [apiBase] = useState(autoApiBase);
  const [data, setData] = useState({ 
    inbounds: [], 
    systemOnline: false, 
    logs: [], 
    sys: { cpu: 0, ram: 0, uptime: 'Live', connections: 0, total_traffic: '0.00 MB' } 
  });
  const [loading, setLoading] = useState(true);
  const [newPort, setNewPort] = useState('');
  const [newPath, setNewPath] = useState('');
  const [notif, setNotif] = useState(null);
  const [lastSeen, setLastSeen] = useState(Date.now());

  const notify = (msg, type = 'success') => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3000);
  };

  const loadData = async () => {
    try {
      const res = await fetch(`${apiBase}/api/data`);
      if (!res.ok) throw new Error('Offline');
      const json = await res.json();
      
      setLastSeen(Date.now());
      setData({ 
        inbounds: json.inbounds || [], 
        logs: json.logs || [],
        sys: json.sys || { cpu: 0, ram: 0, uptime: 'Live', connections: 0, total_traffic: '0.00 MB' },
        systemOnline: true 
      });
      setLoading(false);
    } catch (err) {
      setData(prev => ({ ...prev, systemOnline: false }));
    }
  };

  useEffect(() => {
    loadData();
    // Frequency matched to backend monitor_task (2s)
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [apiBase]);

  const generateVlessLink = (ib) => {
    const host = window.location.hostname;
    const isCodespace = host.includes('app.github.dev');
    const address = isCodespace ? host : host;
    const connectPort = isCodespace ? '443' : ib.port;
    const params = new URLSearchParams({ 
      encryption: 'none', 
      security: 'tls', 
      type: 'ws', 
      host: host, 
      sni: host, 
      path: ib.path 
    });
    return `vless://${ib.uuid}@${address}:${connectPort}?${params.toString()}#X-CORE-${ib.port}`;
  };

  const copyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    notify("LINK COPIED");
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    if (!newPort || !newPath) return;
    const fd = new FormData();
    fd.append('port', newPort);
    fd.append('path', newPath.startsWith('/') ? newPath : `/${newPath}`);
    
    try {
      const res = await fetch(`${apiBase}/api/inbound`, { method: 'POST', body: fd });
      if (res.ok) {
        setNewPort(''); setNewPath('');
        notify("NODE DEPLOYED");
        loadData();
      } else {
        const err = await res.json();
        notify(err.detail || "FAILED", 'error');
      }
    } catch (err) { notify("UNREACHABLE", 'error'); }
  };

  const handleDelete = async (port) => {
    try {
      const res = await fetch(`${apiBase}/api/inbound/${port}`, { method: 'DELETE' });
      if (res.ok) { 
          notify("TERMINATED"); 
          loadData(); 
      }
    } catch (err) { notify("ERROR", 'error'); }
  };

  const openQr = (ib) => {
    setSelectedNodeQr(ib);
    setTimeout(() => {
      const container = document.getElementById('qr-code-canvas');
      if (container) {
        container.innerHTML = "";
        new window.QRCode(container, {
          text: generateVlessLink(ib),
          width: 200, height: 200, colorDark : "#ffffff", colorLight : "#0a0f1e",
          correctLevel : window.QRCode.CorrectLevel.H
        });
      }
    }, 100);
  };

  const isSystemDown = !data.systemOnline || (Date.now() - lastSeen > 5000);

  return (
    <div className="min-h-screen bg-[#050810] flex text-slate-300 font-sans selection:bg-blue-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-900 blur-[100px] rounded-full" />
      </div>

      {/* QR Modal */}
      {selectedNodeQr && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/40">
          <div className="bg-[#0a0f1e] border border-white/10 rounded-[2.5rem] p-10 max-w-sm w-full text-center relative shadow-2xl">
            <button onClick={() => setSelectedNodeQr(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
            <h3 className="text-white font-black italic uppercase tracking-widest text-lg mb-6">Connection Node</h3>
            <div className="bg-[#050810] p-6 rounded-3xl inline-block border border-white/5 mb-8">
              <div id="qr-code-canvas" className="rounded-lg overflow-hidden mix-blend-screen" />
            </div>
            <button onClick={() => copyToClipboard(generateVlessLink(selectedNodeQr))} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-500 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
              <Copy size={16} /> Copy Link
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-24 lg:w-72 border-r border-white/5 bg-[#070b14]/80 backdrop-blur-xl flex flex-col sticky top-0 h-screen z-50">
        <div className="p-8 mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow-lg">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <div className="hidden lg:block">
              <h1 className="font-black text-white italic tracking-tighter text-2xl leading-none">X-CORE</h1>
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-[0.2em] mt-1">Unified API v2.5</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20}/>} label="Dashboard" />
          <NavItem active={activeTab === 'nodes'} onClick={() => setActiveTab('nodes')} icon={<Layers size={20}/>} label="Nodes" />
          <NavItem active={activeTab === 'traffic'} onClick={() => setActiveTab('traffic')} icon={<Activity size={20}/>} label="Intercepts" />
        </nav>

        <div className="p-6">
          <div className={`rounded-3xl p-5 border transition-all ${isSystemDown ? 'bg-rose-500/5 border-rose-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Core Status</span>
                <div className={`w-2 h-2 rounded-full ${isSystemDown ? 'bg-rose-500' : 'bg-blue-400'} animate-pulse`} />
            </div>
            <p className={`text-[11px] font-black uppercase italic tracking-wider ${isSystemDown ? 'text-rose-400' : 'text-blue-400'}`}>
              {isSystemDown ? 'SYSTEM DISCONNECTED' : 'API SYNCHRONIZED'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-24 border-b border-white/5 bg-[#050810]/50 backdrop-blur-md flex items-center justify-between px-10 sticky top-0 z-40">
          <div>
            <h2 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-1">Navigation /</h2>
            <p className="text-lg font-black text-white uppercase italic tracking-tight">{activeTab}</p>
          </div>
          {notif && (
            <div className="bg-blue-600 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest animate-bounce">
              {notif.msg}
            </div>
          )}
        </header>

        <main className="p-10 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && (
            <div className="space-y-10">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="CPU" value={data.sys.cpu} suffix="%" icon={<Cpu size={18}/>} color="blue" />
                <StatCard label="RAM" value={data.sys.ram} suffix="%" icon={<HardDrive size={18}/>} color="indigo" />
                <StatCard label="Live Bandwidth" value={data.sys.connections} icon={<Activity size={18}/>} color="emerald" />
                <StatCard label="Data Usage" value={data.sys.total_traffic} icon={<TrendingUp size={18}/>} color="purple" />
              </div>

              <div className="grid lg:grid-cols-12 gap-10">
                <div className="lg:col-span-7 space-y-10">
                  <div className="bg-[#0a0f1e]/60 border border-white/5 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                    <h3 className="font-black italic text-xl text-white uppercase tracking-tighter flex items-center gap-3 mb-8">
                      <Gauge className="text-blue-500" size={20}/> Active Inbounds
                    </h3>
                    <div className="space-y-4">
                      {data.inbounds.map(ib => {
                        const currentStats = ib.stats?.[ib.stats.length - 1] || { up: 0, down: 0, total_down: 0 };
                        return (
                          <div key={ib.port} className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5 hover:border-white/10 transition-all group">
                            <div className="flex items-center gap-5">
                              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center font-black text-blue-500 text-sm">:{ib.port}</div>
                              <div>
                                <p className="text-sm text-white font-black italic uppercase">{ib.path}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-black uppercase"><ArrowDownLeft size={10}/> {currentStats.down} kB/s</span>
                                  <span className="flex items-center gap-1 text-[9px] text-blue-400 font-black uppercase"><ArrowUpRight size={10}/> {currentStats.up} kB/s</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right mr-4 hidden md:block">
                              <p className="text-[10px] text-slate-500 font-black uppercase">Total Consumed</p>
                              <p className="text-xs text-white font-bold tracking-tight italic">{(currentStats.total_down / 1024).toFixed(2)} MB</p>
                            </div>
                            <button onClick={() => copyToClipboard(generateVlessLink(ib))} className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white p-3.5 rounded-2xl transition-all">
                              <Copy size={18} />
                            </button>
                          </div>
                        );
                      })}
                      {data.inbounds.length === 0 && <p className="text-center text-slate-600 py-10 uppercase font-black italic text-xs">No active configurations</p>}
                    </div>
                  </div>

                  <div className="bg-[#0a0f1e]/60 border border-white/5 rounded-[3rem] p-10 shadow-2xl">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="font-black italic text-xl text-white uppercase tracking-tighter flex items-center gap-3">
                        <Activity className="text-indigo-500" size={20}/> Usage Analytics (60s)
                        </h3>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">Real-time Delta</span>
                    </div>
                    <div className="h-48 flex items-end gap-[3px] px-2 relative">
                      {/* Grid Lines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-2 opacity-5">
                        <div className="border-t border-white w-full" />
                        <div className="border-t border-white w-full" />
                        <div className="border-t border-white w-full" />
                      </div>
                      
                      {data.inbounds.length > 0 ? (data.inbounds[0].stats || []).map((stat, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end gap-[2px] h-full group relative">
                          <div className="w-full bg-blue-500/40 rounded-t-[1px] hover:bg-blue-400 transition-colors" style={{ height: `${Math.min(stat.up / 10, 100)}%` }} />
                          <div className="w-full bg-indigo-500/40 rounded-b-[1px] hover:bg-indigo-400 transition-colors" style={{ height: `${Math.min(stat.down / 20, 100)}%` }} />
                        </div>
                      )) : <div className="w-full text-center text-slate-700 font-black italic text-xs">Awaiting data stream...</div>}
                    </div>
                    <div className="flex justify-between mt-4 px-2">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">-60s</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Now</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-8">
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-900 rounded-[3rem] p-10 shadow-2xl">
                    <h3 className="text-white font-black text-2xl uppercase italic mb-10 flex items-center gap-4">
                      <Plus size={24} /> New Node
                    </h3>
                    <form onSubmit={handleDeploy} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/50 uppercase tracking-widest ml-1">Listen Port</label>
                        <input type="number" placeholder="8080" value={newPort} onChange={e => setNewPort(e.target.value)} 
                          className="w-full bg-white/10 border border-white/10 rounded-2xl px-6 py-5 text-white outline-none focus:border-white/30" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/50 uppercase tracking-widest ml-1">VLESS Path</label>
                        <input type="text" placeholder="/stream" value={newPath} onChange={e => setNewPath(e.target.value)} 
                          className="w-full bg-white/10 border border-white/10 rounded-2xl px-6 py-5 text-white outline-none focus:border-white/30" />
                      </div>
                      <button className="w-full bg-white text-blue-900 font-black py-6 rounded-2xl hover:scale-[1.02] transition-all uppercase tracking-widest italic flex items-center justify-center gap-3">
                        <Rocket size={20} /> Initialize Inbound
                      </button>
                    </form>
                  </div>

                  <div className="bg-[#0a0f1e]/40 border border-white/5 rounded-[2.5rem] p-8">
                      <h4 className="text-white font-black uppercase italic text-xs mb-6 flex items-center gap-2">
                          <History size={14} className="text-blue-500" /> Recent Activity
                      </h4>
                      <div className="space-y-4">
                          {data.logs.slice(0, 3).map(log => (
                              <div key={log.id} className="flex items-center justify-between text-[10px]">
                                  <span className="text-slate-500 font-mono">{log.time}</span>
                                  <span className="text-white font-bold italic truncate ml-4 max-w-[120px]">{log.domain}</span>
                                  <span className="text-blue-400 font-black">{log.method}</span>
                              </div>
                          ))}
                      </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'nodes' && (
            <div className="grid md:grid-cols-2 gap-8">
              {data.inbounds.map(ib => (
                <div key={ib.port} className="bg-[#0a0f1e]/60 border border-white/5 rounded-[2.5rem] p-10 hover:border-blue-500/30 transition-all">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-blue-500/10 rounded-2xl">
                        <Terminal size={24} className="text-blue-500" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-black text-white italic tracking-tighter">:{ib.port}</h3>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{ib.path}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <NodeAction onClick={() => openQr(ib)} icon={<QrCode size={18} />} label="QR" />
                    <NodeAction onClick={() => copyToClipboard(generateVlessLink(ib))} icon={<Copy size={18} />} label="Link" primary />
                    <NodeAction onClick={() => handleDelete(ib.port)} icon={<Trash2 size={18} />} label="Kill" danger />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'traffic' && (
            <div className="bg-[#0a0f1e]/60 border border-white/5 rounded-[3rem] overflow-hidden">
                <div className="p-10 border-b border-white/5 flex justify-between items-center">
                  <h3 className="text-white font-black uppercase italic tracking-tighter text-xl flex items-center gap-3">
                    <Radio className="text-blue-500 animate-pulse" size={20}/> Capture Feed
                  </h3>
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500/20">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Intercepting...</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-bold uppercase tracking-tight">
                    <thead>
                      <tr className="bg-white/5 text-slate-500">
                        <th className="px-10 py-6">Time</th>
                        <th className="px-10 py-6">Method</th>
                        <th className="px-10 py-6">Target Domain</th>
                        <th className="px-10 py-6 text-right">Payload</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.logs.map(log => (
                        <tr key={log.id} className="hover:bg-blue-600/5 group transition-colors">
                          <td className="px-10 py-5 text-slate-500 font-mono text-[10px]">{log.time}</td>
                          <td className="px-10 py-5">
                            <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/10">{log.method}</span>
                          </td>
                          <td className="px-10 py-5 text-white italic text-sm group-hover:text-blue-400 transition-colors">{log.domain}</td>
                          <td className="px-10 py-5 text-slate-500 font-mono text-right">{log.size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          )}
        </main>
      </div>
    </div>
  );
};

const NavItem = ({ active, icon, label, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4.5 rounded-[1.5rem] transition-all group ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}>
    <div className={`${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>{icon}</div>
    <span className="hidden lg:block text-[11px] font-black uppercase tracking-widest italic">{label}</span>
  </button>
);

const StatCard = ({ label, value, suffix = '', icon, color }) => (
    <div className="bg-[#0a0f1e]/60 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group">
      <div className={`absolute top-0 right-0 p-6 opacity-20 text-${color}-400 group-hover:scale-110 transition-transform`}>{icon}</div>
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black tracking-tighter italic text-white">{value}</span>
        <span className="text-[10px] font-black text-slate-600 uppercase italic">{suffix}</span>
      </div>
    </div>
);

const NodeAction = ({ icon, label, onClick, primary, danger }) => (
  <button onClick={onClick} className={`flex-1 flex flex-col items-center gap-3 py-4 rounded-2xl transition-all font-black uppercase tracking-widest text-[9px] border ${
      primary ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20' : 
      danger ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500 hover:text-white' : 
      'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'
    }`}>
    {icon} {label}
  </button>
);

export default App;