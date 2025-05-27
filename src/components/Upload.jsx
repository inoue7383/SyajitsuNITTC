import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { Trash2, Upload as UploadIcon, FileUp, FilePen } from 'lucide-react';

// フィールド単位で深い比較を行う
const deepEqual = (a, b) => {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(key => JSON.stringify(a[key]) === JSON.stringify(b[key]));
};

export default function Upload() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [fileList, setFileList] = useState([]);
  const fileInputRef = useRef();
  const [username, setUsername] = useState('');

  useEffect(() => {
    async function fetchFiles() {
      const uid = currentUser.uid;
      const filesSnap = await getDocs(collection(db, 'accounts', uid, 'files'));
      setFileList(filesSnap.docs.map(d => d.id));
    }
    if (currentUser) fetchFiles();
  }, [currentUser]);

  useEffect(() => {
    async function fetchUsername() {
      const uid = currentUser.uid;
      const userDoc = await getDoc(doc(db, 'accounts', uid));
      if (userDoc.exists()) {
        setUsername(userDoc.data().username || '');
      }
    }
    if (currentUser) fetchUsername();
  }, [currentUser]);

  const handleFileChange = e => {
    setSelectedFiles(Array.from(e.target.files));
  };

  const parseFile = async file => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(ws);
    } else {
      const delim = ext === 'tsv' ? '\t' : ',';
      const text = await file.text();
      return Papa.parse(text, { header: true, delimiter: delim }).data;
    }
  };

  const uploadFiles = async files => {
    const uid = currentUser.uid;
    for (let file of files) {
      const raw = await parseFile(file);
      const data = raw.map(row => ({ rowId: crypto.randomUUID(), ...row }));
      const fileDocRef = doc(db, 'accounts', uid, 'files', file.name);
      const dataDocRef = doc(db, 'accounts', uid, 'files', file.name, 'data', 'rows');

      await setDoc(fileDocRef, {
        originalFileName: file.name,
        uploadedAt: serverTimestamp(),
        updatedAtLogs: [],
        changeLogs: []
      });
      await updateDoc(fileDocRef, {
        updatedAtLogs: arrayUnion(new Date().toISOString())
      });

      await setDoc(dataDocRef, {
        data,
        createdAt: serverTimestamp()
      });
    }
  };

  const handleUploadSelectedFile = async file => {
    if (!window.confirm(`「${file.name}」をアップロードしますか？`)) return;
    setMessage(`「${file.name}」をアップロード中…`);
    try {
      await uploadFiles([file]);
      setMessage(`「${file.name}」のアップロード完了！`);
      const uid = currentUser.uid;
      const filesSnap = await getDocs(collection(db, 'accounts', uid, 'files'));
      setFileList(filesSnap.docs.map(d => d.id));
    } catch (err) {
      console.error(err);
      setMessage('アップロード中にエラーが発生しました');
    }
  };

  const handleDelete = async fileName => {
    if (!window.confirm(`「${fileName}」を削除しますか？`)) return;
    const uid = currentUser.uid;
    await deleteDoc(doc(db, 'accounts', uid, 'files', fileName));
    setFileList(prev => prev.filter(f => f !== fileName));
  };

  const handleReplace = fileName => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.xlsx,.xls';
    input.onchange = async e => {
      const newFile = e.target.files[0];
      if (!newFile) return;
      if (!window.confirm(`「${fileName}」を新しいファイル「${newFile.name}」で置き換えてよろしいですか？`)) return;
      try {
        setMessage(`「${fileName}」の置き換え中…`);
        const uid = currentUser.uid;
        const fileDocRef = doc(db, 'accounts', uid, 'files', fileName);
        const dataDocRef = doc(db, 'accounts', uid, 'files', fileName, 'data', 'rows');

        const oldSnap = await getDoc(dataDocRef);
        const oldData = oldSnap.exists() ? oldSnap.data().data : [];

        const rawNew = await parseFile(newFile);
        const newData = rawNew.map((row, idx) => ({
          rowId: oldData[idx]?.rowId || crypto.randomUUID(),
          ...row
        }));

        await setDoc(dataDocRef, { data: newData, createdAt: serverTimestamp() });

        const oldMap = new Map(oldData.map(r => [r.rowId, r]));
        const newMap = new Map(newData.map(r => [r.rowId, r]));

        const added = newData.filter(r => !oldMap.has(r.rowId));
        const removed = oldData.filter(r => !newMap.has(r.rowId));
        const modified = [];
        for (let [rowId, newRow] of newMap.entries()) {
          if (!oldMap.has(rowId)) continue;
          const oldRow = oldMap.get(rowId);
          // フィールド単位で比較
          if (!deepEqual(oldRow, newRow)) {
            modified.push({ before: oldRow, after: newRow });
          }
        }

        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, added, removed, modified };

        if (added.length > 0 || removed.length > 0 || modified.length > 0) {
          await updateDoc(fileDocRef, {
            updatedAtLogs: arrayUnion(timestamp),
            changeLogs:    arrayUnion(logEntry)
          });
        }

        const filesSnap = await getDocs(collection(db, 'accounts', uid, 'files'));
        setFileList(filesSnap.docs.map(d => d.id));
        setMessage(`「${fileName}」の置き換え完了。変更点を記録しました。`);
      } catch (error) {
        console.error('置き換えエラー:', error);
        setMessage('置き換え中にエラーが発生しました');
      }
    };
    input.click();
  };
  
  return (
    <div style={{ padding: '2rem', position: 'relative', minHeight: '100vh', background: '#f9f9f9' }}>
      {/* アップロードボタン */}
      <div style={{ gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => fileInputRef.current.click()}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #42a5f5, #1e88e5)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'transform 0.2s ease, box-shadow 0.3s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 172, 193, 0.6)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 172, 193, 0.4)';
          }}
        >
          <UploadIcon size={18} />
          アップロード
        </button>
        <p style={{ color: '#555', fontSize: '0.9rem' }}>
          対応している拡張子：Excel (.xlsx/.xls) ・ CSV ・ TSV
        </p>
      </div>

      <input
        type="file"
        multiple
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 選択中のファイル */}
      {selectedFiles.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h4>選択中のファイル</h4>
          {selectedFiles.map((file, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                background: '#fff',
                marginBottom: '0.5rem',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                position: 'relative'
              }}
              onMouseEnter={e => (e.currentTarget.querySelector('.settings').style.visibility = 'visible')}
              onMouseLeave={e => (e.currentTarget.querySelector('.settings').style.visibility = 'hidden')}
            >
              <span>{file.name}</span>
              <div className="settings" style={{ display: 'flex', gap: '0.5rem', visibility: 'hidden' }}>
                <button onClick={() => handleUploadSelectedFile(file)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <FileUp size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 既存ファイルリスト */}
      <h3 style={{ margin: '1rem 0' }}>既存ファイル</h3>
      {fileList.map(fileName => (
        <div
          key={fileName}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.5rem 1rem',
            background: '#fff',
            marginBottom: '0.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            position: 'relative'
          }}
          onMouseEnter={e => (e.currentTarget.querySelector('.settings').style.visibility = 'visible')}
          onMouseLeave={e => (e.currentTarget.querySelector('.settings').style.visibility = 'hidden')}
        >
          <span>{fileName}</span>
          <div className="settings" style={{ display: 'flex', gap: '0.5rem', visibility: 'hidden' }}>
            <button onClick={() => handleReplace(fileName)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <FilePen size={16} />
            </button>
            <button onClick={() => handleDelete(fileName)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}

      {/* メッセージ表示 */}
      {message && (
        <p style={{ marginTop: '1rem', color: '#333', fontSize: '0.9rem' }}>{message}</p>
      )}

      {/* 右下ナビゲーション */}
      <div style={{
        position: 'fixed',
        right: '1rem',
        bottom: '1rem',
        backgroundColor: '#FCFCFF',
        padding: '1rem',
        borderRadius: '20px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        minWidth: '160px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center', width: '100%' }}>
          {username || 'ユーザー'}
        </div>
        <hr style={{ width: '100%', border: 'none', borderTop: '1px solid #b2ebf2', margin: '0.5rem 0' }} />
        <button onClick={() => navigate('/')} style={{
          width: '100%',
          marginBottom: '0.5rem',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          backgroundColor: '#FCFCFF',
          color: '#000',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.9rem'
        }}>ホーム画面</button>
        <button onClick={() => navigate('/account')} style={{
          width: '100%',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          backgroundColor: '#FCFCFF',
          color: '#000',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.9rem'
        }}>アカウント編集</button>
      </div>
    </div>
  );
}
