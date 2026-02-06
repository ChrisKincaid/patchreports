import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  orderBy,
  query 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import Navigation from '../Common/Navigation';
import { Plus, Trash2, Eye, AlertCircle } from 'lucide-react';

function WatchListManager() {
  const { currentUser } = useAuth();
  const [watchList, setWatchList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [vendor, setVendor] = useState('');
  const [product, setProduct] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadWatchList();
  }, [currentUser]);

  const loadWatchList = async () => {
    if (!currentUser) return;
    
    try {
      const q = query(
        collection(db, 'users', currentUser.uid, 'watchList'),
        orderBy('addedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setWatchList(items);
    } catch (err) {
      console.error('Error loading watch list:', err);
      setError('Failed to load watch list');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!vendor.trim()) {
      setError('Vendor is required');
      return;
    }

    setAdding(true);

    try {
      const newItem = {
        vendor: vendor.trim().toLowerCase(),
        product: (product.trim() || '*').toLowerCase(),
        addedAt: new Date()
      };

      await addDoc(
        collection(db, 'users', currentUser.uid, 'watchList'),
        newItem
      );

      setVendor('');
      setProduct('');
      loadWatchList();
    } catch (err) {
      console.error('Error adding to watch list:', err);
      setError('Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Remove this item from your watch list?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'watchList', itemId));
      loadWatchList();
    } catch (err) {
      console.error('Error deleting item:', err);
      setError('Failed to remove item');
    }
  };

  // Common vendors and products for quick access
  const commonVendors = [
    'Microsoft', 'Cisco', 'Apache', 'Oracle', 'Adobe', 'Google',
    'Apple', 'IBM', 'VMware', 'Dell', 'HP', 'Linux', 'Red Hat'
  ];

  return (
    <div className="app-container">
      <Navigation />
      
      <main className="main-content">
        <div className="content-header">
          <div>
            <h1>Watch List Manager</h1>
            <p>Monitor specific vendors and products for CVE alerts</p>
          </div>
          <button 
            className="btn btn-secondary"
            onClick={() => navigate('/')}
          >
            <Eye size={18} />
            View Dashboard
          </button>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="card">
          <h2>Add to Watch List</h2>
          
          <form onSubmit={handleAdd} className="watch-list-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="vendor">Vendor / Organization</label>
                <input
                  id="vendor"
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="e.g., microsoft, cisco, apache (not case sensitive)"
                  maxLength={100}
                  style={{textTransform: 'none'}}
                />
                <small>✓ Not case sensitive - "LINUX", "Linux" and "linux" are all the same</small>
              </div>

              <div className="form-group">
                <label htmlFor="product">Product / Software (optional)</label>
                <input
                  id="product"
                  type="text"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="e.g., linux_kernel, windows, ios (or leave empty for all)"
                  maxLength={100}
                  style={{textTransform: 'none'}}
                />
                <small>Leave empty to match ALL products. Not case sensitive. For Linux kernel: "linux_kernel" or just "kernel"</small>
              </div>
            </div>

            {(vendor.trim() || product.trim()) && (
              <div style={{
                padding: '0.75rem',
                background: 'rgba(37, 99, 235, 0.1)',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                marginBottom: '1rem'
              }}>
                <strong>Will be saved as:</strong> {vendor.trim().toLowerCase() || '(empty)'} / {product.trim().toLowerCase() || '*'}
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={adding}
            >
              <Plus size={18} />
              {adding ? 'Adding...' : 'Add to Watch List'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Your Watch List ({watchList.length})</h2>
          
          {loading ? (
            <p>Loading watch list...</p>
          ) : watchList.length === 0 ? (
            <div className="empty-state">
              <Eye size={48} />
              <p>No items in your watch list yet</p>
              <p className="text-muted">Add vendors and products above to start monitoring CVEs</p>
            </div>
          ) : (
            <div className="watch-list-grid">
              {watchList.map(item => (
                <div key={item.id} className="watch-list-item">
                  <div className="watch-list-info">
                    <h3>{item.vendor}</h3>
                    <p>{item.product}</p>
                    <small>Added {item.addedAt?.toDate().toLocaleDateString()}</small>
                  </div>
                  <button
                    className="btn btn-danger btn-icon"
                    onClick={() => handleDelete(item.id)}
                    title="Remove from watch list"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="info-panel">
          <h3>Watch List Tips</h3>
          <ul>
            <li>Be specific with product names (e.g., "Windows Server" vs "Windows")</li>
            <li>Add both vendor-specific and open-source products you use</li>
            <li>CVEs are matched against your watch list automatically</li>
            <li>You'll only see CVEs that affect your watched technologies</li>
            <li>Update your watch list as your infrastructure changes</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default WatchListManager;
