import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/',         label: 'TRAIN'    },
  { to: '/history',  label: 'HISTORY'  },
  { to: '/progress', label: 'PROGRESS' },
  { to: '/settings', label: 'SETTINGS' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* NAVBAR */}
      <header className="app-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: 56,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
      }}>
        <div className="app-header-inner">
          <div className="app-brand">
            <span className="app-brand-mark" style={{ fontFamily: '"Bebas Neue"', fontSize: '1.8rem', letterSpacing: 6, color: '#fff' }}>
              CORNER
              <span className="app-brand-pill" style={{
                background: 'var(--red)', color: '#fff', fontSize: '0.5rem',
                fontFamily: '"Share Tech Mono"', padding: '2px 6px',
                letterSpacing: 3, borderRadius: 2, marginLeft: 10, verticalAlign: 'middle',
              }}>AI COACH</span>
            </span>

            <nav className="app-nav">
              {navItems.map(({ to, label }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  className="app-nav-link"
                  style={({ isActive }) => ({
                    fontFamily: '"Bebas Neue"', letterSpacing: 4, fontSize: '0.9rem',
                    padding: '4px 14px', textDecoration: 'none', transition: 'all 0.2s',
                    color: isActive ? '#fff' : 'var(--dim)',
                    borderBottom: isActive ? '2px solid var(--red)' : '2px solid transparent',
                  })}
                >{label}</NavLink>
              ))}
            </nav>
          </div>

          <div className="app-user-row">
            <span className="app-user-name" style={{ fontFamily: '"Share Tech Mono"', fontSize: '0.65rem', color: 'var(--dim)' }}>
              {user?.name?.toUpperCase()}
            </span>
            <button className="btn-ghost" onClick={handleLogout}>LOGOUT</button>
          </div>
        </div>
      </header>

      {/* PAGE CONTENT */}
      <main className="app-main" style={{ flex: 1, minHeight: 0, width: '100%' }}>
        <Outlet />
      </main>
    </div>
  );
}
