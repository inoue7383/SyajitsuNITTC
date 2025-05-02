// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Signup from './components/Signup';
import Login  from './components/Login';
import Upload from './components/Upload';
import Main   from './components/Main';
import Account   from './components/Account';
import Auth from './components/Auth';

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/auth" />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/signup" element={<Signup />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/account"  element={<Account />} />
          <Route path="/auth"   element={<Auth  />} />
          <Route path="/upload" element={
          <PrivateRoute><Upload /></PrivateRoute>
          } />
          <Route path="/"       element={
            <PrivateRoute><Main /></PrivateRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
