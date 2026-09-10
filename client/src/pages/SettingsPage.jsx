import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

function Section({ title, children }) {
  return (
    <div className="settings-section" style={{}}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,var(--red),transparent)' }} />
      <div style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:4, color:'var(--dim)', textTransform:'uppercase', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
        {title} <div style={{ flex:1, height:1, background:'var(--border)' }} />
      </div>
      {children}
    </div>
  );
}

function Toast({ msg, ok }) {
  return msg ? (
    <div style={{ padding:'10px 14px', marginTop:14, fontFamily:'"Share Tech Mono"', fontSize:'0.7rem', letterSpacing:1, border:`1px solid ${ok ? 'var(--green)' : 'var(--red)'}`, background: ok ? 'rgba(57,255,20,0.06)' : 'rgba(224,31,31,0.08)', color: ok ? 'var(--green)' : 'var(--red)' }}>
      {msg}
    </div>
  ) : null;
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();

  const [profile, setProfile] = useState({ name: user?.name || '', stance: user?.stance || 'orthodox' });
  const [profMsg,  setProfMsg]  = useState({ text:'', ok:true });
  const [profBusy, setProfBusy] = useState(false);

  const [apiKey,   setApiKey]   = useState('');
  const [apiMsg,   setApiMsg]   = useState({ text:'', ok:true });
  const [apiBusy,  setApiBusy]  = useState(false);

  const [pwForm,   setPwForm]   = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [pwMsg,    setPwMsg]    = useState({ text:'', ok:true });
  const [pwBusy,   setPwBusy]   = useState(false);

  const saveProfile = async e => {
    e.preventDefault(); setProfBusy(true); setProfMsg({ text:'', ok:true });
    try {
      await api.patch('/users/profile', profile);
      await refreshUser();
      setProfMsg({ text:'Profile updated.', ok:true });
    } catch (err) { setProfMsg({ text: err.response?.data?.message || 'Failed.', ok:false }); }
    setProfBusy(false);
  };

  const saveApiKey = async e => {
    e.preventDefault(); setApiBusy(true); setApiMsg({ text:'', ok:true });
    try {
      await api.patch('/users/api-key', { apiKey });
      await refreshUser();
      setApiMsg({ text: apiKey ? 'API key saved securely.' : 'API key removed.', ok:true });
      setApiKey('');
    } catch (err) { setApiMsg({ text: err.response?.data?.message || 'Failed.', ok:false }); }
    setApiBusy(false);
  };

  const savePassword = async e => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwMsg({ text:'Passwords do not match.', ok:false }); return; }
    setPwBusy(true); setPwMsg({ text:'', ok:true });
    try {
      await api.patch('/users/password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMsg({ text:'Password updated.', ok:true });
      setPwForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
    } catch (err) { setPwMsg({ text: err.response?.data?.message || 'Failed.', ok:false }); }
    setPwBusy(false);
  };

  return (
    <div className="settings-page">
      <div style={{ fontFamily:'"Bebas Neue"', fontSize:'1.6rem', letterSpacing:5, color:'#fff', marginBottom:24 }}>SETTINGS</div>

      {/* Profile */}
      <Section title="Profile">
        <form onSubmit={saveProfile} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:2, color:'var(--dim)', display:'block', marginBottom:6 }}>DISPLAY NAME</label>
            <input className="input-field" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:2, color:'var(--dim)', display:'block', marginBottom:6 }}>EMAIL</label>
            <input className="input-field" value={user?.email || ''} disabled style={{ opacity:0.5, cursor:'not-allowed' }} />
          </div>
          <div>
            <label style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:2, color:'var(--dim)', display:'block', marginBottom:8 }}>BOXING STANCE</label>
            <div style={{ display:'flex', gap:10 }}>
              {['orthodox','southpaw'].map(s => (
                <button type="button" key={s} onClick={() => setProfile(p => ({ ...p, stance: s }))}
                  style={{ flex:1, padding:'10px', fontFamily:'"Bebas Neue"', fontSize:'1rem', letterSpacing:4, cursor:'pointer', border:'1px solid', transition:'all 0.2s',
                    borderColor: profile.stance === s ? 'var(--red)' : 'var(--border)',
                    background:  profile.stance === s ? 'rgba(224,31,31,0.12)' : 'transparent',
                    color:       profile.stance === s ? '#fff' : 'var(--dim)',
                  }}>
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={profBusy} style={{ alignSelf:'flex-start', fontSize:'0.9rem', padding:'10px 28px', opacity: profBusy ? 0.6 : 1 }}>
            {profBusy ? 'SAVING...' : 'SAVE PROFILE'}
          </button>
          <Toast msg={profMsg.text} ok={profMsg.ok} />
        </form>
      </Section>

      {/* Claude API key */}
      <Section title="Claude API Key">
        <p style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.65rem', color:'var(--dim)', lineHeight:1.8, marginBottom:16 }}>
          Your API key is stored securely on the server and never exposed to the browser after saving. It is used to provide personalized AI coaching during sessions.
          {user?.hasApiKey && <span style={{ color:'var(--green)', marginLeft:8 }}>✓ KEY ON FILE</span>}
        </p>
        <form onSubmit={saveApiKey} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <input className="input-field" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={user?.hasApiKey ? 'Enter new key to replace existing...' : 'sk-ant-...'} />
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn-primary" type="submit" disabled={apiBusy} style={{ fontSize:'0.9rem', padding:'10px 28px', opacity: apiBusy ? 0.6 : 1 }}>
              {apiBusy ? 'SAVING...' : 'SAVE KEY'}
            </button>
            {user?.hasApiKey && (
              <button type="button" className="btn-ghost" onClick={() => { setApiKey(''); saveApiKey({ preventDefault:()=>{} }); }}
                style={{ padding:'10px 20px' }}>
                REMOVE KEY
              </button>
            )}
          </div>
          <Toast msg={apiMsg.text} ok={apiMsg.ok} />
        </form>
      </Section>

      {/* Password */}
      <Section title="Change Password">
        <form onSubmit={savePassword} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[
            ['CURRENT PASSWORD', 'currentPassword', 'Current password'],
            ['NEW PASSWORD',     'newPassword',     'New password (min 6 chars)'],
            ['CONFIRM PASSWORD', 'confirmPassword', 'Confirm new password'],
          ].map(([label, key, placeholder]) => (
            <div key={key}>
              <label style={{ fontFamily:'"Share Tech Mono"', fontSize:'0.6rem', letterSpacing:2, color:'var(--dim)', display:'block', marginBottom:6 }}>{label}</label>
              <input className="input-field" type="password" value={pwForm[key]}
                placeholder={placeholder} minLength={key !== 'currentPassword' ? 6 : undefined}
                onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))} required />
            </div>
          ))}
          <button className="btn-primary" type="submit" disabled={pwBusy} style={{ alignSelf:'flex-start', fontSize:'0.9rem', padding:'10px 28px', opacity: pwBusy ? 0.6 : 1 }}>
            {pwBusy ? 'UPDATING...' : 'UPDATE PASSWORD'}
          </button>
          <Toast msg={pwMsg.text} ok={pwMsg.ok} />
        </form>
      </Section>
    </div>
  );
}
