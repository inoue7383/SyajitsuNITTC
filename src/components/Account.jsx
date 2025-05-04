import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase';
import { updateProfile, updateEmail, updatePassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './Account.css';

export default function Account() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (username !== currentUser.displayName) {
        await updateProfile(currentUser, { displayName: username });
        await setDoc(doc(db, 'accounts', currentUser.uid), { username }, { merge: true });
      }

      if (email !== currentUser.email) {
        await updateEmail(currentUser, email);
      }

      if (password) {
        await updatePassword(currentUser, password);
      }

      setSuccess('アカウント情報が更新されました');
    } catch (err) {
      setError('更新に失敗しました: ' + err.message);
    }
  };

  return (
    <div className="account-container">
      <div className="account-card">
        
        {/* 戻るボタン */}
        <button
          type="button"
          className="back-button"
          onClick={() => navigate(-1)}
          style={{
            textAlign: 'start',
            marginBottom: '1rem',
            background: 'none',
            border: 'none',
            color: '#1e88e5',
            cursor: 'pointer',
            fontSize: '14px',
            height: '20px'
          }}
        >
          ← 戻る
        </button>
        <h2>アカウント情報の変更</h2>

        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}

        <form onSubmit={handleUpdate}>
          <div className="form-group">
            <label htmlFor="username">ユーザーネーム:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="新しいユーザーネーム"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">メールアドレス:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="新しいメールアドレス"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">パスワード:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="新しいパスワード"
            />
          </div>

          <button type="submit" className="submit-button">
            更新する
          </button>
        </form>
      </div>
    </div>
  );
}