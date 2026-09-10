import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [form,  setForm]  = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(form.email, form.password); }
    catch (err) { setError(err.response?.data?.message || 'Login failed'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--dark)',
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontFamily: '"Bebas Neue"', fontSize: '4rem', letterSpacing: 10, color: '#fff' }}>
            CORNER
          </h1>
          <p style={{ fontFamily: '"Share Tech Mono"', fontSize: '0.65rem', letterSpacing: 4, color: 'var(--dim)' }}>
            AI BOXING COACH
          </p>
        </div>

        <div className="card" style={{ padding: 32, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--red), var(--gold))' }} />

          <div className="section-label" style={{ marginBottom: 24 }}>SIGN IN</div>

          {error && (
            <div style={{ background: 'rgba(224,31,31,0.1)', border: '1px solid var(--red)', padding: '10px 14px', marginBottom: 20, fontFamily: '"Share Tech Mono"', fontSize: '0.7rem', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input className="input-field" name="email" type="email" placeholder="Email address"
              value={form.email} onChange={handle} required />
            <input className="input-field" name="password" type="password" placeholder="Password"
              value={form.password} onChange={handle} required />

            <button className="btn-primary" type="submit" disabled={busy}
              style={{ marginTop: 8, opacity: busy ? 0.6 : 1 }}>
              {busy ? 'SIGNING IN...' : 'STEP INTO THE RING'}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: 'center', fontFamily: '"Share Tech Mono"', fontSize: '0.65rem', color: 'var(--dim)' }}>
            No account?{' '}
            <Link to="/register" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
              REGISTER
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
