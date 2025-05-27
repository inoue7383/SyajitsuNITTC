import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function LogsPage() {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    async function fetchLogs() {
      if (!currentUser) return;
      const uid = currentUser.uid;
      const filesRef = collection(db, 'accounts', uid, 'files');
      const snapshot = await getDocs(filesRef);
      const data = snapshot.docs.map(doc => ({
        fileName: doc.id,
        ...doc.data()
      }));
      setLogs(data);
    }
    fetchLogs();
  }, [currentUser]);

  const toggle = fileName => {
    setExpanded(prev => ({ ...prev, [fileName]: !prev[fileName] }));
  };

  // ヘルパー: before/after オブジェクトの差分フィールドのみ抽出
  const getDiffs = ({ before, after }) => {
    return Object.keys(before).reduce((acc, key) => {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        acc.push({ key, before: before[key], after: after[key] });
      }
      return acc;
    }, []);
  };

  return (
    <div style={{ padding: '2rem', background: '#f5f5f5', minHeight: '100vh' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>ファイル更新ログ</h2>
      {logs.length === 0 && <p>ログがありません。</p>}
      {logs.map(log => (
        <div key={log.fileName} style={{ marginBottom: '1rem', background: '#fff', borderRadius: '8px', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => toggle(log.fileName)}
          >
            {expanded[log.fileName] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <h3 style={{ margin: '0 0 0 0.5rem' }}>{log.fileName}</h3>
          </div>

          {expanded[log.fileName] && (
            <div style={{ marginTop: '1rem', paddingLeft: '1.5rem' }}>
              {/* 更新日時 */}
              <section style={{ marginBottom: '1rem' }}>
                <h4>更新日時</h4>
                <ul>
                  {log.updatedAtLogs?.map((ts, idx) => (
                    <li key={idx}>{new Date(ts).toLocaleString()}</li>
                  ))}
                </ul>
              </section>

              {/* 変更内容 */}
              <section>
                <h4>変更内容</h4>
                {log.changeLogs?.length > 0 ? (
                  log.changeLogs.map((entry, idx) => (
                    <div key={idx} style={{ marginBottom: '1rem' }}>
                      <strong>{new Date(entry.timestamp).toLocaleString()}</strong>

                      {/* 追加された行 */}
                      {entry.added?.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <em>追加された行:</em>
                          <ul>
                            {entry.added.map(row => (
                              <li key={row.rowId}>{JSON.stringify(row)}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 削除された行 */}
                      {entry.removed?.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <em>削除された行:</em>
                          <ul>
                            {entry.removed.map(row => (
                              <li key={row.rowId}>{JSON.stringify(row)}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 変更された行のみ差分表示 */}
                      {entry.modified?.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <em>変更された行:</em>
                          <ul>
                            {entry.modified.map(({ before, after }) => {
                              const diffs = getDiffs({ before, after });
                              return (
                                <li key={before.rowId}>
                                  Row ID: {before.rowId}
                                  <ul>
                                    {diffs.map(({ key, before, after }) => (
                                      <li key={key}>
                                        {key}: {before} → {after}
                                      </li>
                                    ))}
                                  </ul>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p>変更ログがありません。</p>
                )}
              </section>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
