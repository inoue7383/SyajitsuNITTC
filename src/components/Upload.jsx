import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  getDoc,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { Settings, Trash2, Upload as UploadIcon, Home } from 'lucide-react';

export default function Upload() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [fileList, setFileList] = useState([]);
  const fileInputRef = useRef();
  const [username, setUsername] = useState('');

  useEffect(() => {
    const fetchFiles = async () => {
      const uid = currentUser.uid;
      const filesSnap = await getDocs(collection(db, 'accounts', uid, 'files'));
      setFileList(filesSnap.docs.map(d => d.id));
    };
    fetchFiles();
  }, [currentUser]);

  const handleFileChange = e => setSelectedFiles(Array.from(e.target.files));
  useEffect(() => {
    const fetchUsername = async () => {
      const uid = currentUser.uid;
      const userDoc = await getDoc(doc(db, 'accounts', uid));
      if (userDoc.exists()) {
        setUsername(userDoc.data().username || '');
      }
    };
    if (currentUser) fetchUsername();
  }, [currentUser]);

  const uploadFiles = async files => {
    const uid = currentUser.uid;
    for (let file of files) {
      let data = [];
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'xlsx' || ext === 'xls') {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(ws);
      } else {
        const delim = ext === 'tsv' ? '\t' : ',';
        const text = await file.text();
        data = Papa.parse(text, { header: true, delimiter: delim }).data;
      }
      const fileDocRef = doc(db, 'accounts', uid, 'files', file.name);
      await setDoc(fileDocRef, { originalFileName: file.name, uploadedAt: serverTimestamp() });
      const dataCol = collection(fileDocRef, 'data');
      await addDoc(dataCol, { data, createdAt: serverTimestamp() });
    }
  };

  const handleUploadSelectedFile = async file => {
    const confirmed = window.confirm(`「${file.name}」をアップロードしますか？`);
    if (!confirmed) return;

    setMessage(`「${file.name}」をアップロード中…`);
    try {
      await uploadFiles([file]);
      setMessage(`「${file.name}」のアップロード完了！`);

      const uid = currentUser.uid;
      const filesSnap = await getDocs(collection(db, 'accounts', uid, 'files'));
      setFileList(filesSnap.docs.map(d => d.id));

      setSelectedFiles(prev => prev.filter(f => f.name !== file.name));
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
    fileInputRef.current.click();
    fileInputRef.current.onchange = async e => {
      const newFile = e.target.files[0];
      if (!newFile) return;

      const confirmed = window.confirm(
        `「${fileName}」を新しいファイル「${newFile.name}」で置き換えてよろしいですか？`
      );
      if (!confirmed) return;

      try {
        const uid = currentUser.uid;

        await deleteDoc(doc(db, 'accounts', uid, 'files', fileName));
        await uploadFiles([newFile]);

        const filesSnap = await getDocs(collection(db, 'accounts', uid, 'files'));
        setFileList(filesSnap.docs.map(d => d.id));

        setMessage(`「${fileName}」を「${newFile.name}」に置き換えました`);
      } catch (error) {
        console.error('置き換えエラー:', error);
        setMessage('置き換え中にエラーが発生しました');
      }
    };
  };

  return (
    <div style={{ padding: '2rem', position: 'relative', minHeight: '100vh', background: '#f9f9f9' }}>
      <div style={{
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap'
      }}>
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

        <input
          type="file"
          multiple
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {selectedFiles.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4>選択中のファイル</h4>
          {selectedFiles.map((file, index) => (
            <div key={index} style={{
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
              onMouseEnter={e => e.currentTarget.querySelector('.settings').style.visibility = 'visible'}
              onMouseLeave={e => e.currentTarget.querySelector('.settings').style.visibility = 'hidden'}
            >
              <span>{file.name}</span>
              <div className="settings" style={{ display: 'flex', gap: '0.5rem', visibility: 'hidden' }}>
                <button onClick={() => handleUploadSelectedFile(file)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Settings size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginTop: '2rem' }}>既存ファイル</h3>
      {fileList.map(fileName => (
        <div key={fileName} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 1rem',
          background: '#fff',
          marginBottom: '0.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          position: 'relative'
        }} onMouseEnter={e => e.currentTarget.querySelector('.settings').style.visibility = 'visible'} onMouseLeave={e => e.currentTarget.querySelector('.settings').style.visibility = 'hidden'}>
          <span>{fileName}</span>
          <div className="settings" style={{ display: 'flex', gap: '0.5rem', visibility: 'hidden' }}>
            <button onClick={() => handleReplace(fileName)} style={{ background:'none', border:'none', cursor:'pointer' }}><Settings size={16} /></button>
            <button onClick={() => handleDelete(fileName)} style={{ background:'none', border:'none', cursor:'pointer' }}><Trash2 size={16} /></button>
          </div>
        </div>
      ))}

      {/* 右下固定要素 */}
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
        {/* Username */}
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', textAlign: 'center', width: '100%' }}>
          {username || 'ユーザー'}
        </div>
        {/* Divider */}
        <hr style={{ width: '100%', border: 'none', borderTop: '1px solid #b2ebf2', margin: '0.5rem 0' }} />
        <button onClick={() => navigate('/')} style={{
          width: '100%',
          marginBottom: '0.5rem',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          backgroundColor: '#FCFCFF',
          color: '#000000',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.9rem'
        }}>
          ホーム画面
        </button>
        <button onClick={() => navigate('/account')} style={{
          width: '100%',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          backgroundColor: '#FCFCFF',
          color: '#000000',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.9rem'
        }}>
          アカウント編集
        </button>
      </div>
    </div>
  );
}
