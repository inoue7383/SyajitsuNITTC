import React, { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function Signup() {
  const emailRef = useRef();
  const passwordRef = useRef();
  const { currentUser } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        emailRef.current.value,
        passwordRef.current.value
      );
      const user = userCredential.user;

      // 初期値として username を空文字で保存
      await setDoc(doc(db, 'accounts', user.uid), {
        email: user.email,
        username: '',
        createdAt: new Date()
      });

      setSuccess('登録が完了しました。ログインしてください。');
    } catch (err) {
      console.error(err);
      setError('登録に失敗しました: ' + err.message);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '360px',
        padding: '2rem',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#333', fontSize: '1.8rem' }}>新規登録</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="email"
            ref={emailRef}
            placeholder="メールアドレス"
            required
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
          <input
            type="password"
            ref={passwordRef}
            placeholder="パスワード"
            required
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '1rem',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: 'linear-gradient(135deg, #42a5f5, #1e88e5)',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(30,136,229,0.4)',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            登録
          </button>
        </form>
        {error && <p style={{ marginTop: '1rem', color: '#e53935' }}>{error}</p>}
        {success && <p style={{ marginTop: '1rem', color: '#4caf50' }}>{success}</p>}
      </div>
    </div>
  );
}
