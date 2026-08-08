import React from 'react';

export default function Header({ user, onLogout }) {
  return (
    <nav>
      <div className="wrap">
        <div className="brand">
          <span className="seal">V</span> Veritas
        </div>
        <div className="navlinks">
          <a href="#method" onClick={(e) => {
            e.preventDefault();
            document.getElementById('method')?.scrollIntoView({ behavior: 'smooth' });
          }}>Method</a>
          <a href="#verdicts" onClick={(e) => {
            e.preventDefault();
            document.getElementById('verdicts')?.scrollIntoView({ behavior: 'smooth' });
          }}>Verdicts</a>
          <a href="#input-section" onClick={(e) => {
            e.preventDefault();
            document.getElementById('input-section')?.scrollIntoView({ behavior: 'smooth' });
          }}>Scanner</a>
          {!user && (
            <a href="#signin" onClick={(e) => {
              e.preventDefault();
              document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth' });
            }}>Sign In</a>
          )}
        </div>
        <div className="navright">
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-zinc-400 text-xs font-light">{user.email}</span>
              <button 
                className="navlogin cursor-pointer bg-transparent border-none p-0 text-inherit hover:text-white transition-colors"
                onClick={onLogout}
              >
                Log out
              </button>
            </div>
          ) : (
            <a className="navlogin" href="#signin" onClick={(e) => {
              e.preventDefault();
              document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth' });
            }}>Log in</a>
          )}
          <a className="navcta" href="#input-section" onClick={(e) => {
            e.preventDefault();
            document.getElementById('input-section')?.scrollIntoView({ behavior: 'smooth' });
          }}>Run a scan</a>
        </div>
      </div>
    </nav>
  );
}
