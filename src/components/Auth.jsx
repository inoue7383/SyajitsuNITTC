import React, { useState } from 'react';
import Login from './Login';
import Signup from './Signup';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f0f4f8',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        {isLogin ? <Login /> : <Signup />}

        <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#555' }}>
          {isLogin
            ? 'アカウントをお持ちでないですか？'
            : '既にアカウントをお持ちですか？'}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            style={{
              background: 'none',
              border: 'none',
              color: '#1e88e5',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isLogin ? '新規登録はこちら' : 'ログインはこちら'}
          </button>
        </p>
      </div>
    </div>
  );
}
