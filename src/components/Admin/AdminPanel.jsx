import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import Navigation from '../Common/Navigation';
import { ShieldCheck, Users, Key, Copy, Check, AlertCircle } from 'lucide-react';

function AdminPanel() {
  const { isAdmin, currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Invite code state
  const [inviteCodes, setInviteCodes] = useState([]);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  
  // User management state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [updatingUser, setUpdatingUser] = useState(null);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  // Load invite codes
  useEffect(() => {
    loadInviteCodes();
  }, []);

  // Load users
  useEffect(() => {
    loadUsers();
  }, []);

  const loadInviteCodes = async () => {
    try {
      const codesRef = collection(db, 'inviteCodes');
      const snapshot = await getDocs(codesRef);
      const codes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by creation date, newest first
      codes.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setInviteCodes(codes);
    } catch (err) {
      console.error('Error loading invite codes:', err);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by creation date, newest first
      usersList.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setUsers(usersList);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const generateInviteCode = async () => {
    try {
      setGeneratingCode(true);
      setError('');
      setSuccess('');

      // Generate random code
      const code = generateRandomCode();
      
      // Create invite code document
      const codeData = {
        code: code,
        createdBy: currentUser.uid,
        createdAt: new Date(),
        usedBy: null,
        usedAt: null,
        isActive: true
      };

      await addDoc(collection(db, 'inviteCodes'), codeData);
      
      setSuccess('Invite code generated successfully!');
      await loadInviteCodes();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error generating invite code:', err);
      setError('Failed to generate invite code: ' + err.message);
    } finally {
      setGeneratingCode(false);
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous characters
    let code = '';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      setUpdatingUser(userId);
      setError('');
      setSuccess('');

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole
      });

      setSuccess(`User role updated to ${newRole}`);
      await loadUsers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating user role:', err);
      setError('Failed to update user role: ' + err.message);
    } finally {
      setUpdatingUser(null);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAdmin()) {
    return null;
  }

  return (
    <div className="app">
      <Navigation />
      <main className="main-content">
        <div className="admin-panel">
          <div className="admin-header">
            <ShieldCheck size={32} />
            <h1>Admin Panel</h1>
            <p>Manage invite codes and user roles</p>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="success-message">
              <Check size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* Invite Codes Section */}
          <section className="admin-section">
            <div className="section-header">
              <Key size={24} />
              <h2>Invite Codes</h2>
            </div>
            
            <div className="section-content">
              <div className="invite-code-actions">
                <button
                  onClick={generateInviteCode}
                  disabled={generatingCode}
                  className="btn btn-primary"
                >
                  {generatingCode ? 'Generating...' : 'Generate New Invite Code'}
                </button>
              </div>

              <div className="invite-codes-list">
                {inviteCodes.length === 0 ? (
                  <p className="empty-message">No invite codes generated yet</p>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Used By</th>
                        <th>Used At</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inviteCodes.map((code) => (
                        <tr key={code.id}>
                          <td>
                            <code className="invite-code">{code.code}</code>
                          </td>
                          <td>
                            <span className={`status-badge ${code.usedBy ? 'used' : 'active'}`}>
                              {code.usedBy ? 'Used' : 'Active'}
                            </span>
                          </td>
                          <td>{formatDate(code.createdAt)}</td>
                          <td>{code.usedBy || '-'}</td>
                          <td>{code.usedAt ? formatDate(code.usedAt) : '-'}</td>
                          <td>
                            {!code.usedBy && (
                              <button
                                onClick={() => copyToClipboard(code.code)}
                                className="btn btn-small btn-secondary"
                                title="Copy to clipboard"
                              >
                                {copiedCode === code.code ? (
                                  <><Check size={14} /> Copied</>
                                ) : (
                                  <><Copy size={14} /> Copy</>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>

          {/* User Management Section */}
          <section className="admin-section">
            <div className="section-header">
              <Users size={24} />
              <h2>User Management</h2>
            </div>
            
            <div className="section-content">
              {loadingUsers ? (
                <p>Loading users...</p>
              ) : users.length === 0 ? (
                <p className="empty-message">No users found</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.email}</td>
                        <td>
                          <span className={`role-badge ${user.role}`}>
                            {user.role || 'user'}
                          </span>
                        </td>
                        <td>{formatDate(user.createdAt)}</td>
                        <td>
                          <div className="role-actions">
                            {user.role !== 'admin' ? (
                              <button
                                onClick={() => updateUserRole(user.id, 'admin')}
                                disabled={updatingUser === user.id}
                                className="btn btn-small btn-primary"
                              >
                                {updatingUser === user.id ? 'Updating...' : 'Make Admin'}
                              </button>
                            ) : (
                              <button
                                onClick={() => updateUserRole(user.id, 'user')}
                                disabled={updatingUser === user.id}
                                className="btn btn-small btn-secondary"
                              >
                                {updatingUser === user.id ? 'Updating...' : 'Make User'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default AdminPanel;
