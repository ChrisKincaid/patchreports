import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { Shield, AlertCircle } from 'lucide-react';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateInviteCode = async (code) => {
    try {
      const codesRef = collection(db, 'inviteCodes');
      const q = query(
        codesRef,
        where('code', '==', code),
        where('isActive', '==', true),
        where('usedBy', '==', null)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return { valid: false, codeDoc: null };
      }
      
      return { valid: true, codeDoc: snapshot.docs[0] };
    } catch (err) {
      console.error('Error validating invite code:', err);
      return { valid: false, codeDoc: null };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!inviteCode || inviteCode.trim() === '') {
      return setError('Invite code is required');
    }

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (password.length < 8) {
      return setError('Password must be at least 8 characters');
    }

    setLoading(true);

    try {
      // Validate invite code
      const { valid, codeDoc } = await validateInviteCode(inviteCode.trim().toUpperCase());
      
      if (!valid) {
        setLoading(false);
        return setError('Invalid or already used invite code');
      }

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user profile in Firestore with 'user' role
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        createdAt: new Date(),
        lastChecked: null,
        notificationsEnabled: false,
        role: 'user'
      });

      // Mark invite code as used
      await updateDoc(codeDoc.ref, {
        usedBy: user.uid,
        usedAt: new Date()
      });

      navigate('/');
    } catch (err) {
      console.error('Registration error:', err);
      
      let errorMessage = 'Failed to create account';
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      }
      
      setError(errorMessage);
    }
    
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <Shield className="auth-icon" size={48} />
          <h1>Create Account</h1>
          <p>Join CVE Alert System</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="inviteCode">Invite Code</label>
            <input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              required
              placeholder="XXXX-XXXX-XXXX"
              maxLength={14}
              style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
            />
            <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
              You need an invite code to register
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="your.email@company.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Re-enter password"
            />
          </div>

          <div className="info-message">
            <p>
              <strong>Privacy Notice:</strong> We only collect your email address 
              and vendor watch list. No personal data or analytics beyond Firebase defaults.
            </p>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
