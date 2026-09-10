import { useEffect, useState } from 'react';
import api from '../services/api';

function formatDur(s) { const m = Math.floor(s/60); return m ? `${m}m ${s%60}s` : `${s}s`; }

function FormBar({ label, val }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
      <span style={{ fontSize:'0.78rem', fontWeight:600, textTransform:'uppercase', letterSpacing:1, width:130, flexShrink:0 }}>{label}</span>
      <div style={{ flex:1, height:5, background:'var(--border)' }}>
        <div style={{ height:'100%', width:`${val}%`, background:'linear-gradient(90deg,var(--red),var(--gold))' }} />
      </div>
      <span style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.7rem', color:'var(--gold)', width:36, textAlign:'right' }}>{val}%</span>
    </div>
  );
}

export default function HistoryPage() {
  const [sessions,  setSessions]  = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [detail,    setDetail]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [detLoading,setDetLoading]= useState(false);

  const refreshSessions = async () => {
    try {
      const r = await api.get('/sessions');
      setSessions(r.data.sessions);
      if (r.data.sessions[0]) pickSession(r.data.sessions[0]._id, r.data.sessions);
    } catch (err) {
      console.error('Failed to refresh sessions:', err);
    }
  };

  useEffect(() => {
    refreshSessions().finally(() => setLoading(false));
    
    // Listen for session saved event from CoachPage
    const handleSessionSaved = () => {
      refreshSessions();
    };
    
    window.addEventListener('sessionSaved', handleSessionSaved);
    return () => window.removeEventListener('sessionSaved', handleSessionSaved);
  }, []);

  const pickSession = async (id, list) => {
    const s = (list || sessions).find(s => s._id === id);
    setSelected(id);
    setDetLoading(true);
    try {
      const r = await api.get(`/sessions/${id}`);
      setDetail(r.data.session);
    } catch { setDetail(s); }
    setDetLoading(false);
  };

  const deleteSession = async (id) => {
    if (!confirm('Delete this session?')) return;
    await api.delete(`/sessions/${id}`);
    const updated = sessions.filter(s => s._id !== id);
    setSessions(updated);
    if (selected === id) { setSelected(null); setDetail(null); if (updated[0]) pickSession(updated[0]._id, updated); }
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontFamily:'"Share Tech Mono"', fontSize:'0.75rem', color:'var(--dim)', letterSpacing:3 }}>LOADING...</div>
  );

  return (
    <div className="history-layout" style={{ overflow:'hidden' }}>
      {/* Session list */}
      <div className="history-sidebar">
        <div style={{ padding:'14px 16px', fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:3, color:'var(--dim)', borderBottom:'1px solid var(--border)', textTransform:'uppercase' }}>
          Past Sessions ({sessions.length})
        </div>

        {sessions.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--dim)', fontFamily:'"Share Tech Mono"', fontSize:'0.7rem', lineHeight:1.8 }}>
            NO SESSIONS YET.<br/>COMPLETE A TRAINING SESSION<br/>TO SEE IT HERE.
          </div>
        ) : sessions.map(s => {
          const total = Object.values(s.punches || {}).reduce((a,b)=>a+b,0);
          return (
            <div key={s._id} onClick={() => pickSession(s._id)}
              style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', position:'relative', transition:'background 0.15s',
                background: selected===s._id ? 'rgba(224,31,31,0.08)' : 'transparent' }}>
              {selected===s._id && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:2, background:'var(--red)' }} />}
              <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.62rem', color:'var(--gold)', marginBottom:3 }}>
                {new Date(s.createdAt).toLocaleString()}
              </div>
              <div style={{ fontSize:'0.8rem', fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>
                {total} PUNCHES
              </div>
              <div style={{ fontSize:'0.7rem', color:'var(--dim)', marginTop:2 }}>
                {formatDur(s.durationSec)} · Guard {s.avgGuard}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail */}
      <div className="history-detail">
        {!detail ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--dim)', fontFamily:'"Share Tech Mono"', fontSize:'0.75rem', letterSpacing:2, gap:12 }}>
            <span style={{ fontSize:'2.5rem', opacity:0.3 }}>🥊</span>
            SELECT A SESSION TO REVIEW
          </div>
        ) : detLoading ? (
          <div style={{ color:'var(--dim)', fontFamily:'"Share Tech Mono"', fontSize:'0.75rem', letterSpacing:3 }}>LOADING...</div>
        ) : (
          <>
            <div style={{ fontFamily:'"Bebas Neue"', fontSize:'1.6rem', letterSpacing:5, color:'#fff', marginBottom:4 }}>SESSION REPORT</div>
            <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.65rem', color:'var(--dim)', letterSpacing:2, marginBottom:24 }}>
              {new Date(detail.createdAt).toLocaleString()} · {formatDur(detail.durationSec)}
            </div>

            {/* Summary stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24 }}>
              {[
                ['Overall', `${Math.round((detail.avgGuard+detail.avgChin+detail.avgRotation+detail.avgBalance)/4)}%`],
                ['Punches', Object.values(detail.punches||{}).reduce((a,b)=>a+b,0)],
                ['Duration', formatDur(detail.durationSec)],
                ['Guard', `${detail.avgGuard}%`],
              ].map(([label, val]) => (
                <div key={label} style={{ background:'#0d0d0d', border:'1px solid var(--border)', padding:'14px 12px', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,var(--red),transparent)' }} />
                  <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.55rem', letterSpacing:2, color:'var(--dim)', marginBottom:6 }}>{label}</div>
                  <div style={{ fontFamily:'"Bebas Neue"', fontSize:'1.7rem', color:'var(--gold)', lineHeight:1 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Punch breakdown */}
            <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:4, color:'var(--dim)', textTransform:'uppercase', marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
              Punch Breakdown <div style={{ flex:1, height:1, background:'var(--border)' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24 }}>
              {['jab','cross','hook','uppercut'].map(type => (
                <div key={type} style={{ background:'#0d0d0d', border:'1px solid var(--border)', padding:'14px 10px', textAlign:'center' }}>
                  <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:2, color:'var(--dim)', marginBottom:6, textTransform:'uppercase' }}>{type}</div>
                  <div style={{ fontFamily:'"Bebas Neue"', fontSize:'2.2rem', color:'var(--red)', lineHeight:1 }}>{detail.punches?.[type] || 0}</div>
                </div>
              ))}
            </div>

            {/* Form scores */}
            <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:4, color:'var(--dim)', textTransform:'uppercase', marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
              Form Scores <div style={{ flex:1, height:1, background:'var(--border)' }} />
            </div>
            <FormBar label="Guard Position"    val={detail.avgGuard} />
            <FormBar label="Chin Protection"   val={detail.avgChin} />
            <FormBar label="Shoulder Rotation" val={detail.avgRotation} />
            <FormBar label="Balance"           val={detail.avgBalance} />

            {/* Combos */}
            {detail.combos && Object.keys(detail.combos).length > 0 && (
              <>
                <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:4, color:'var(--dim)', textTransform:'uppercase', marginBottom:12, marginTop:20, display:'flex', alignItems:'center', gap:10 }}>
                  Combos Landed <div style={{ flex:1, height:1, background:'var(--border)' }} />
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:20 }}>
                  {Object.entries(detail.combos).sort((a,b)=>b[1]-a[1]).map(([name, count]) => (
                    <span key={name} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(201,168,76,0.1)', border:'1px solid rgba(201,168,76,0.25)', padding:'4px 10px', fontFamily:'"Share Tech Mono"', fontSize:'0.62rem', color:'var(--gold)' }}>
                      <span style={{ background:'var(--gold)', color:'#000', fontSize:'0.55rem', padding:'1px 5px', fontWeight:700 }}>{count}</span>
                      {name}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* AI feedback */}
            {detail.messages?.filter(m => m.tag === 'AI COACH').length > 0 && (
              <>
                <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:4, color:'var(--dim)', textTransform:'uppercase', marginBottom:12, marginTop:20, display:'flex', alignItems:'center', gap:10 }}>
                  AI Coach Feedback <div style={{ flex:1, height:1, background:'var(--border)' }} />
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                  {detail.messages.filter(m => m.tag === 'AI COACH').map((m, i) => (
                    <div key={i} style={{ background:'#0d0d0d', border:'1px solid var(--border)', borderLeft:'2px solid var(--red)', padding:'10px 12px' }}>
                      <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.58rem', letterSpacing:2, color:'var(--red)', marginBottom:4 }}>AI COACH</div>
                      <div style={{ fontSize:'0.82rem', lineHeight:1.5 }}>{m.text}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button onClick={() => deleteSession(detail._id)}
              style={{ background:'transparent', border:'1px solid #333', color:'#444', fontFamily:'"Share Tech Mono"', fontSize:'0.65rem', letterSpacing:2, padding:'8px 16px', cursor:'pointer', marginTop:12, transition:'all 0.2s' }}
              onMouseOver={e => { e.target.style.borderColor='var(--red)'; e.target.style.color='var(--red)'; }}
              onMouseOut={e => { e.target.style.borderColor='#333'; e.target.style.color='#444'; }}>
              🗑 DELETE SESSION
            </button>
          </>
        )}
      </div>
    </div>
  );
}
