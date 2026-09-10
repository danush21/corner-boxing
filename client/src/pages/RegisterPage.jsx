import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form,  setForm]  = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await register(form.name, form.email, form.password); }
    catch (err) { setError(err.response?.data?.message || 'Registration failed'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontFamily: '"Bebas Neue"', fontSize: '4rem', letterSpacing: 10, color: '#fff' }}>CORNER</h1>
          <p style={{ fontFamily: '"Share Tech Mono"', fontSize: '0.65rem', letterSpacing: 4, color: 'var(--dim)' }}>CREATE YOUR ACCOUNT</p>
        </div>

        <div className="card" style={{ padding: 32, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--red), var(--gold))' }} />
          <div className="section-label" style={{ marginBottom: 24 }}>REGISTER</div>

          {error && (
            <div style={{ background: 'rgba(224,31,31,0.1)', border: '1px solid var(--red)', padding: '10px 14px', marginBottom: 20, fontFamily: '"Share Tech Mono"', fontSize: '0.7rem', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input className="input-field" name="name" placeholder="Full name"
              value={form.name} onChange={handle} required />
            <input className="input-field" name="email" type="email" placeholder="Email address"
              value={form.email} onChange={handle} required />
            <input className="input-field" name="password" type="password" placeholder="Password (min 6 chars)"
              value={form.password} onChange={handle} required minLength={6} />
            <button className="btn-primary" type="submit" disabled={busy}
              style={{ marginTop: 8, opacity: busy ? 0.6 : 1 }}>
              {busy ? 'CREATING...' : 'JOIN THE GYM'}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: 'center', fontFamily: '"Share Tech Mono"', fontSize: '0.65rem', color: 'var(--dim)' }}>
            Already a member?{' '}
            <Link to="/login" style={{ color: 'var(--gold)', textDecoration: 'none' }}>SIGN IN</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
