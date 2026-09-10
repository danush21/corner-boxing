import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../services/api';

function formatDur(s) { const m = Math.floor(s/60); return m ? `${m}m ${s%60}s` : `${s}s`; }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#111', border:'1px solid var(--border)', padding:'10px 14px', fontFamily:'"Share Tech Mono"', fontSize:'0.7rem' }}>
      <div style={{ color:'var(--dim)', marginBottom:6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>{p.name}: {Math.round(p.value)}{p.unit||''}</div>
      ))}
    </div>
  );
};

export default function ProgressPage() {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.get('/sessions/stats/progress')
      .then(r => setSessions(r.data.sessions))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontFamily:'"Share Tech Mono"', fontSize:'0.75rem', color:'var(--dim)', letterSpacing:3 }}>LOADING...</div>
  );

  if (sessions.length < 2) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16 }}>
      <span style={{ fontSize:'3rem', opacity:0.3 }}>📈</span>
      <p style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.75rem', color:'var(--dim)', letterSpacing:3, textAlign:'center' }}>
        COMPLETE AT LEAST 2 SESSIONS<br/>TO SEE YOUR PROGRESS
      </p>
    </div>
  );

  const chartData = sessions.map(s => ({
    date:     new Date(s.createdAt).toLocaleDateString('en', { month:'short', day:'numeric' }),
    guard:    s.avgGuard,
    chin:     s.avgChin,
    rotation: s.avgRotation,
    balance:  s.avgBalance,
    total:    Object.values(s.punches || {}).reduce((a,b)=>a+b, 0),
    duration: Math.round(s.durationSec / 60 * 10) / 10,
  }));

  const allGuard = sessions.map(s => s.avgGuard);
  const trend    = allGuard[allGuard.length - 1] - allGuard[0];
  const bestGuard = Math.max(...allGuard);
  const totalPunches = sessions.reduce((a, s) => a + Object.values(s.punches || {}).reduce((x,y)=>x+y, 0), 0);

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:'28px 32px' }}>
      <div style={{ fontFamily:'"Bebas Neue"', fontSize:'1.6rem', letterSpacing:5, color:'#fff', marginBottom:24 }}>PROGRESS TRACKING</div>

      {/* Summary row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:32 }}>
        {[
          ['Sessions',   sessions.length,             'recorded'     ],
          ['Total Punches', totalPunches,              'all time'     ],
          ['Best Guard', `${bestGuard}%`,              'peak score'   ],
          ['Guard Trend',`${trend >= 0 ? '+' : ''}${trend}%`, 'first vs latest'],
        ].map(([label, val, sub]) => (
          <div key={label} style={{ background:'var(--panel)', border:'1px solid var(--border)', padding:'18px 16px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${label==='Guard Trend' && trend < 0 ? 'var(--red)' : 'var(--green)'}, transparent)` }} />
            <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.55rem', letterSpacing:2, color:'var(--dim)', marginBottom:8, textTransform:'uppercase' }}>{label}</div>
            <div style={{ fontFamily:'"Bebas Neue"', fontSize:'2rem', lineHeight:1, color: label==='Guard Trend' ? (trend>=0?'var(--green)':'var(--red)') : 'var(--gold)' }}>{val}</div>
            <div style={{ fontSize:'0.65rem', color:'var(--dim)', marginTop:4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Form scores chart */}
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', padding:'20px 24px', marginBottom:20, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,var(--red),transparent)' }} />
        <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:3, color:'var(--dim)', textTransform:'uppercase', marginBottom:20 }}>
          FORM SCORES <span style={{ color:'var(--gold)', marginLeft:8 }}>over {sessions.length} sessions</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top:5, right:20, left:0, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontFamily:'"Share Tech Mono"', fontSize:10, fill:'var(--dim)' }} />
            <YAxis domain={[0,100]} tick={{ fontFamily:'"Share Tech Mono"', fontSize:10, fill:'var(--dim)' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontFamily:'"Share Tech Mono"', fontSize:'0.65rem' }} />
            <Line type="monotone" dataKey="guard"    name="Guard"    stroke="#e01f1f" strokeWidth={2} dot={{ r:3 }} unit="%" />
            <Line type="monotone" dataKey="chin"     name="Chin"     stroke="#c9a84c" strokeWidth={2} dot={{ r:3 }} unit="%" />
            <Line type="monotone" dataKey="balance"  name="Balance"  stroke="#39ff14" strokeWidth={2} dot={{ r:3 }} unit="%" />
            <Line type="monotone" dataKey="rotation" name="Rotation" stroke="#44aaff" strokeWidth={2} dot={{ r:3 }} unit="%" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Punch volume chart */}
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', padding:'20px 24px', marginBottom:20, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,var(--gold),transparent)' }} />
        <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:3, color:'var(--dim)', textTransform:'uppercase', marginBottom:20 }}>
          PUNCH VOLUME <span style={{ color:'var(--gold)', marginLeft:8 }}>per session</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top:5, right:20, left:0, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontFamily:'"Share Tech Mono"', fontSize:10, fill:'var(--dim)' }} />
            <YAxis tick={{ fontFamily:'"Share Tech Mono"', fontSize:10, fill:'var(--dim)' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="total" name="Punches" fill="var(--red)" opacity={0.85} radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Session duration chart */}
      <div style={{ background:'var(--panel)', border:'1px solid var(--border)', padding:'20px 24px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,var(--green),transparent)' }} />
        <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:3, color:'var(--dim)', textTransform:'uppercase', marginBottom:20 }}>
          SESSION DURATION <span style={{ color:'var(--gold)', marginLeft:8 }}>minutes per session</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top:5, right:20, left:0, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontFamily:'"Share Tech Mono"', fontSize:10, fill:'var(--dim)' }} />
            <YAxis tick={{ fontFamily:'"Share Tech Mono"', fontSize:10, fill:'var(--dim)' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="duration" name="Minutes" fill="var(--green)" opacity={0.7} radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
