import { useState, useEffect } from 'react';
import { sendSignInLink, isSignInLink, completeSignIn, isAllowedEmail } from '../firebase/auth.js';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | completing | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isSignInLink()) {
      setStatus('completing');
      completeSignIn(async () => {
        // Only hit if opened on a different device than requested from.
        return window.prompt('Enter the email you used to request this link:') || '';
      }).catch((err) => {
        setStatus('error');
        setErrorMsg(err.message);
      });
    }
  }, []);

  async function handleSend(e) {
    e.preventDefault();
    setErrorMsg('');
    if (!isAllowedEmail(email)) {
      setErrorMsg("This email isn't on the family list yet. Ask the host to add it.");
      return;
    }
    setStatus('sending');
    try {
      await sendSignInLink(email, window.location.href);
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  }

  if (status === 'completing') {
    return (
      <div className="screen">
        <p className="muted">Signing you in…</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="stack" style={{ marginTop: 48 }}>
        <div className="eyebrow">Family Rummy</div>
        <h1>Deal me in</h1>
        <p className="muted">
          Enter the email the host added you with. We'll send a sign-in link — no password needed.
        </p>

        {status === 'sent' ? (
          <div className="panel">
            <p>Link sent to <strong>{email}</strong>. Open it on this phone to finish signing in.</p>
          </div>
        ) : (
          <form className="stack" onSubmit={handleSend}>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            {errorMsg && <p className="error-text">{errorMsg}</p>}
            <button type="submit" className="primary" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
