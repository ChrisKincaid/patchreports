import React, { useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteUser } from 'firebase/auth';
import { db, functions, auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import Navigation from '../Common/Navigation';
import { 
  Bell, 
  Download, 
  Trash2, 
  AlertTriangle,
  Save,
  Shield
} from 'lucide-react';

function Settings() {
  const { currentUser, userProfile } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    userProfile?.notificationsEnabled || false
  );
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage('');

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        notificationsEnabled: notificationsEnabled
      });
      setMessage('Settings saved successfully');
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    setMessage('');

    try {
      const exportUserData = httpsCallable(functions, 'exportUserData');
      const result = await exportUserData();
      
      // Create downloadable JSON file
      const dataStr = JSON.stringify(result.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `cve-alert-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setMessage('Data exported successfully');
    } catch (err) {
      console.error('Error exporting data:', err);
      setMessage('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmText = 'DELETE MY ACCOUNT';
    const userInput = window.prompt(
      `WARNING: This will permanently delete your account and all data.\n\n` +
      `Type "${confirmText}" to confirm deletion:`
    );

    if (userInput !== confirmText) {
      return;
    }

    setDeleting(true);
    setMessage('');

    try {
      const deleteUserData = httpsCallable(functions, 'deleteUserData');
      await deleteUserData();
      
      // User will be signed out automatically after account deletion
      setMessage('Account deleted successfully');
    } catch (err) {
      console.error('Error deleting account:', err);
      setMessage('Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <div className="app-container">
      <Navigation />
      
      <main className="main-content">
        <div className="content-header">
          <div>
            <h1>Settings</h1>
            <p>Manage your account and preferences</p>
          </div>
        </div>

        {message && (
          <div className={`message ${message.includes('Failed') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <div className="settings-grid">
          <div className="card">
            <h2>
              <Bell size={20} />
              Notifications
            </h2>
            
            <div className="setting-item">
              <div className="setting-info">
                <strong>Email Alerts for Critical CVEs</strong>
                <p>
                  Receive email notifications when critical vulnerabilities (CVSS ≥ 9.0) 
                  are discovered that match your watch list
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <button 
              className="btn btn-primary"
              onClick={handleSaveSettings}
              disabled={saving}
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <div className="card">
            <h2>
              <Shield size={20} />
              Privacy & Data
            </h2>
            
            <div className="privacy-info">
              <h3>Data We Collect</h3>
              <ul>
                <li><strong>Email Address:</strong> Stored securely in Firebase Auth for login and optional alerts</li>
                <li><strong>Watch List:</strong> Vendor and product names you monitor</li>
                <li><strong>Last Checked:</strong> Timestamp of your last CVE dashboard view</li>
                <li><strong>Notification Preference:</strong> Whether you want email alerts</li>
              </ul>

              <h3>Data We Don't Collect</h3>
              <ul>
                <li>No personal information beyond email</li>
                <li>No usage tracking or analytics (beyond Firebase defaults)</li>
                <li>No third-party data sharing</li>
                <li>No cookies except Firebase essentials</li>
              </ul>

              <p className="text-muted">
                Your email is encrypted at rest in Firebase Auth. All data is user-scoped 
                with strict Firestore security rules.
              </p>
            </div>
          </div>

          <div className="card">
            <h2>
              <Download size={20} />
              Data Export (GDPR)
            </h2>
            
            <p>
              Download all your data in JSON format. This includes your profile, 
              watch list, and account settings.
            </p>

            <button 
              className="btn btn-secondary"
              onClick={handleExportData}
              disabled={exporting}
            >
              <Download size={18} />
              {exporting ? 'Exporting...' : 'Export My Data'}
            </button>
          </div>

          <div className="card danger-zone">
            <h2>
              <AlertTriangle size={20} />
              Danger Zone
            </h2>
            
            <div className="danger-content">
              <div>
                <strong>Delete Account</strong>
                <p>
                  Permanently delete your account and all associated data. 
                  This action cannot be undone.
                </p>
              </div>

              <button 
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                <Trash2 size={18} />
                {deleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>

          <div className="card">
            <h2>Account Information</h2>
            
            <div className="account-info">
              <div className="info-row">
                <span className="info-label">Email:</span>
                <span className="info-value">{currentUser?.email}</span>
              </div>
              <div className="info-row">
                <span className="info-label">User ID:</span>
                <span className="info-value code">{currentUser?.uid}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Created:</span>
                <span className="info-value">
                  {userProfile?.createdAt?.toDate().toLocaleDateString()}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Last Checked:</span>
                <span className="info-value">
                  {userProfile?.lastChecked 
                    ? userProfile.lastChecked.toDate().toLocaleString()
                    : 'Never'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Settings;
