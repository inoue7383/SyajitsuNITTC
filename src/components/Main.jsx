import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import noImage from '../assets/noImage.png';
import { Ellipsis, CircleChevronUp } from 'lucide-react';

const imageRegex = /(https?:\/\/.+\.(?:png|jpg|jpeg|gif|webp))(\?.*)?$/i;

// モーダルコンポーネント
function RecordModal({ record, onClose }) {
  if (!record) return null;
  return (
    <>
      <div style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 2000
      }}>
        <div style={{
          position: 'absolute', width: '80%', maxWidth: '600px',
          maxHeight: '85vh', overflowY: 'auto',
          background: '#ffffff', padding: '2.5rem', borderRadius: '16px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
          transform: 'scale(0.8)', opacity: 0,
          animation: 'scaleIn 0.3s ease-out forwards'
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'none', border: 'none', fontSize: '1.5rem',
              color: '#888', cursor: 'pointer'
            }}
          >
            ✕
          </button>
          <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.75rem', color: '#222' }}>
            レコード詳細
          </h3>
          <div style={{ display: 'grid', rowGap: '1rem' }}>
            {Object.entries(record).map(([key, value]) => {
              if (value && typeof value.toDate === 'function') {
                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '600', color: '#444' }}>{key}</span>
                    <span style={{ color: '#000' }}>{value.toDate().toLocaleString()}</span>
                  </div>
                );
              }
              if (typeof value === 'string' && imageRegex.test(value)) {
                return (
                  <div key={key} style={{ textAlign: 'center' }}>
                    <span style={{ display: 'block', fontWeight: '600', color: '#444', marginBottom: '0.5rem' }}>{key}</span>
                    <img
                      src={value}
                      alt={key}
                      style={{ maxWidth: '100%', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                    />
                  </div>
                );
              }
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '600', color: '#444' }}>{key}</span>
                  <span style={{ color: '#000' }}>{String(value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <style>{`@keyframes scaleIn {0%{transform:scale(0.8);opacity:0;}100%{transform:scale(1);opacity:1;}}`}</style>
    </>
  );
}

export default function Main() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Responsive
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Show all toggle per file
  const [showAllByFile, setShowAllByFile] = useState({});
  const toggleShow = (fileName) => {
    setShowAllByFile(prev => ({ ...prev, [fileName]: !prev[fileName] }));
  };

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Data states
  const [username, setUsername] = useState('');
  const [groups, setGroups] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch username
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const uid = currentUser.uid;
        const accountRef = doc(db, 'accounts', uid);
        const accountSnap = await getDoc(accountRef);
        if (accountSnap.exists()) {
          const data = accountSnap.data();
          setUsername(data.username || data.displayName || 'ユーザー');
        }
      } catch (e) {
        console.error('Failed to fetch username:', e);
      }
    })();
  }, [currentUser]);

  // Fetch groups
  useEffect(() => {
    if (!currentUser) {
      setError('ログインしてください');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const uid = currentUser.uid;
        const filesSnap = await getDocs(collection(db, 'accounts', uid, 'files'));
        if (filesSnap.empty) {
          setGroups([]);
          setFiltered([]);
          return;
        }
        const result = await Promise.all(
          filesSnap.docs.map(async fileDoc => {
            const fileName = fileDoc.id;
            const dataSnap = await getDocs(
              collection(db, 'accounts', uid, 'files', fileName, 'data')
            );
            const records = dataSnap.docs.flatMap(d => {
              const v = d.data();
              if (!v.createdAt || v.data == null) return [];
              return Array.isArray(v.data)
                ? v.data.map(item => ({ createdAt: v.createdAt, ...item }))
                : [v];
            });
            return { fileName, records };
          })
        );
        setGroups(result);
        setFiltered(result);
      } catch (e) {
        console.error(e);
        setError('データ取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser]);

  const handleSearch = e => {
    if (e.key === 'Enter') {
      const q = searchQuery.trim().toLowerCase();
      if (!q) {
        setFiltered(groups);
        return;
      }
      const hitGroups = groups
        .map(({ fileName, records }) => {
          const hitRecords = records.filter(rec =>
            Object.values(rec).some(val =>
              String(val).toLowerCase().includes(q)
            )
          );
          return { fileName, records: hitRecords };
        })
        .filter(g => g.records.length > 0);
      setFiltered(hitGroups);
    }
  };

  const renderValue = (key, val) => {
    if (typeof val === 'string' && val.length > 50) return null;
    if (val && typeof val.toDate === 'function') {
      return <span>{val.toDate().toLocaleString()}</span>;
    }
    if (typeof val === 'string' && imageRegex.test(val)) return null;
    if (typeof val === 'string' && val.startsWith('http')) {
      if (val.length > 50) return null;
      return (
        <a href={val} target="_blank" rel="noopener noreferrer">
          {val}
        </a>
      );
    }
    if (Array.isArray(val)) {
      return val.map((item, idx) => (
        <div key={idx} style={{ margin: '0.5rem 0' }}>
          {Object.entries(item).map(([k, v]) => (
            <div key={k}><strong>{k}:</strong> {renderValue(k, v)}</div>
          ))}
        </div>
      ));
    }
    if (val && typeof val === 'object') {
      const str = JSON.stringify(val);
      return str.length <= 50 ? <pre style={{ whiteSpace: 'pre-wrap' }}>{str}</pre> : null;
    }
    const text = String(val);
    return text.length <= 50 ? <span>{text}</span> : null;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{
          border: '4px solid #ddd',
          borderTop: '4px solid #1e88e5',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div style={{ padding: '1rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* 検索バー */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="検索..."
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            border: '1px solid #ccc',
            width: '80%',
            fontSize: '1rem',
            outline: 'none',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
          }}
        />
      </div>

      {filtered.length === 0 && <p>データが存在しません。</p>}

      {filtered.map(({ fileName, records }) => {
        const initialCount = isMobile ? 1 : 4;
        const showAll = !!showAllByFile[fileName];
        const displayRecords = showAll ? records : records.slice(0, initialCount);
        return (
          <section key={fileName} style={{ marginBottom: '2rem' }}>
            <h2>{fileName}</h2>
            {records.length === 0 ? (
              <p>データがありません。</p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '1rem' }}>
                  <button
                    onClick={() => toggleShow(fileName)}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                    }}
                  >
                    {showAll ? <CircleChevronUp size={20} color='#000000' /> : <Ellipsis size={20} />}
                  </button>
                  {displayRecords.map((rec, idx) => (
                    <div
                      key={idx}
                      onClick={() => { setSelectedRecord(rec); setModalOpen(true); }}
                      style={{ cursor: 'pointer', border: '1px solid #ccc', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', backgroundColor: '#fff' }}
                    >
                      <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', marginBottom: '0.75rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <img
                          src={noImage}
                          alt="No Thumbnail"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      {Object.entries(rec).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: '0.5rem' }}>
                          <strong>{k}:</strong> {renderValue(k, v)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {records.length > initialCount && (
                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button
                      onClick={() => toggleShow(fileName)}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                      }}
                    >
                      {showAll ? <CircleChevronUp size={20} color='#000000' /> : <Ellipsis size={20} />}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}

      {/* モーダル */}
      {modalOpen && (
        <RecordModal record={selectedRecord} onClose={() => setModalOpen(false)} />
      )}

      {/* 右下固定要素 */}
      <div style={{
        position: 'fixed', right: '1rem', bottom: '1rem', backgroundColor: '#FCFCFF', padding: '1rem',
        borderRadius: '20px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', zIndex: 1000, display: 'flex',
        flexDirection: 'column', alignItems: 'flex-start', minWidth: '160px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center', width: '100%' }}>
          {username}
        </div>
        <hr style={{ width: '100%', border: 'none', borderTop: '1px solid #b2ebf2', margin: '0.5rem 0' }} />
        <button onClick={() => navigate('/upload')} style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', backgroundColor: '#FCFCFF', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
          データベース編集
        </button>
        <button onClick={() => navigate('/account')} style={{ width: '100%', padding: '0.5rem 1rem', borderRadius: '8px', backgroundColor: '#FCFCFF', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
          アカウント編集
        </button>
      </div>
    </div>
  );
}
