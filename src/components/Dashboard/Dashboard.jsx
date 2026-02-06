import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  updateDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import Navigation from '../Common/Navigation';
import CVEList from '../CVE/CVEList';
import { 
  RefreshCw, 
  AlertTriangle, 
  Eye, 
  Calendar,
  Filter,
  HelpCircle,
  Database,
  Users,
  Building2
} from 'lucide-react';
import { subDays, format } from 'date-fns';

function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const [cves, setCves] = useState([]);
  const [watchList, setWatchList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCVEs, setLoadingCVEs] = useState(false);
  const [loadingTimeRange, setLoadingTimeRange] = useState(null);
  const [activeSeverityFilter, setActiveSeverityFilter] = useState('ALL');
  const [matchQualityFilter, setMatchQualityFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState(1); // days to show
  const [vendorFilter, setVendorFilter] = useState('ALL'); // vendor filter
  const [viewMode, setViewMode] = useState('my'); // 'my' or 'org'
  const [myStats, setMyStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    newToday: 0,
    exactMatches: 0,
    closeMatches: 0,
    possibleMatches: 0
  });
  const [orgStats, setOrgStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    newToday: 0,
    exactMatches: 0,
    closeMatches: 0,
    possibleMatches: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    
    try {
      // Load watch list
      const watchListSnapshot = await getDocs(
        collection(db, 'users', currentUser.uid, 'watchList')
      );
      
      const watchItems = watchListSnapshot.docs.map(doc => doc.data());
      setWatchList(watchItems);

      if (watchItems.length === 0) {
        setCves([]);
        setLoading(false);
        return;
      }

      // Load CVEs from database with limit to prevent timeout
      const cvesQuery = query(
        collection(db, 'cves'),
        limit(200)
      );

      const cvesSnapshot = await getDocs(cvesQuery);
      const allCVEs = cvesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`[DEBUG] Loaded ${allCVEs.length} CVEs from database`);
      console.log(`[DEBUG] Watch list items:`, watchItems);
      if (allCVEs.length > 0) {
        console.log(`[DEBUG] Sample CVE vendors/products:`, {
          cveId: allCVEs[0].cveId,
          vendors: allCVEs[0].vendors,
          products: allCVEs[0].products
        });
      }

      // Calculate match quality for all CVEs, but don't filter them out
      const cvesWithMatches = allCVEs.map(cve => {
        const matchResult = getMatchQuality(cve, watchItems);
        if (matchResult) {
          return { ...cve, matchQuality: matchResult.quality, matchedItem: matchResult.item };
        }
        return cve; // Keep CVE even if it doesn't match watch list
      });
      
      const matchedCount = cvesWithMatches.filter(cve => cve.matchQuality).length;
      console.log(`[DEBUG] ${matchedCount} CVEs match watch list out of ${allCVEs.length} total`);
      if (matchedCount > 0) {
        const firstMatch = cvesWithMatches.find(cve => cve.matchQuality);
        console.log(`[DEBUG] Sample match:`, {
          cveId: firstMatch.cveId,
          quality: firstMatch.matchQuality,
          matchedItem: firstMatch.matchedItem
        });
      } else if (allCVEs.length > 0) {
        console.log(`[DEBUG] No matches found. First CVE:`, {
          vendors: allCVEs[0].vendors,
          products: allCVEs[0].products
        });
        console.log(`[DEBUG] First watch item:`, watchItems[0]);
      }

      // Calculate statistics - both for matched CVEs and all CVEs
      const myCVEs = cvesWithMatches.filter(c => c.matchQuality); // Only CVEs matching user's watch list
      const allCVEsData = cvesWithMatches; // All CVEs in organization
      
      // My CVEs stats (only matching user's watch list)
      const newMyStats = {
        total: myCVEs.length,
        critical: myCVEs.filter(c => c.severity === 'CRITICAL').length,
        high: myCVEs.filter(c => c.severity === 'HIGH').length,
        medium: myCVEs.filter(c => c.severity === 'MEDIUM').length,
        low: myCVEs.filter(c => c.severity === 'LOW').length,
        newToday: myCVEs.filter(c => {
          const pubDate = c.publishedDate.toDate();
          const today = new Date();
          return pubDate.toDateString() === today.toDateString();
        }).length,
        exactMatches: myCVEs.filter(c => c.matchQuality === 'EXACT').length,
        closeMatches: myCVEs.filter(c => c.matchQuality === 'CLOSE').length,
        possibleMatches: myCVEs.filter(c => c.matchQuality === 'POSSIBLE').length
      };
      
      // Organization stats (all CVEs)
      const newOrgStats = {
        total: allCVEsData.length,
        critical: allCVEsData.filter(c => c.severity === 'CRITICAL').length,
        high: allCVEsData.filter(c => c.severity === 'HIGH').length,
        medium: allCVEsData.filter(c => c.severity === 'MEDIUM').length,
        low: allCVEsData.filter(c => c.severity === 'LOW').length,
        newToday: allCVEsData.filter(c => {
          const pubDate = c.publishedDate.toDate();
          const today = new Date();
          return pubDate.toDateString() === today.toDateString();
        }).length,
        exactMatches: allCVEsData.filter(c => c.matchQuality === 'EXACT').length,
        closeMatches: allCVEsData.filter(c => c.matchQuality === 'CLOSE').length,
        possibleMatches: allCVEsData.filter(c => c.matchQuality === 'POSSIBLE').length
      };

      setMyStats(newMyStats);
      setOrgStats(newOrgStats);
      setCves(cvesWithMatches);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMatchQuality = (cve, watchItems) => {
    let bestMatch = null;
    let bestQuality = null;
    
    for (const item of watchItems) {
      const vendorMatch = item.vendor.toLowerCase().trim();
      const productMatch = item.product.toLowerCase().trim();
      const isWildcard = !productMatch || productMatch === '*';
      
      // Find matching vendor
      const matchingVendor = cve.vendors?.find(v => {
        const vendor = v.toLowerCase();
        return vendor === vendorMatch || 
               vendor.includes(vendorMatch) || 
               vendorMatch.includes(vendor) ||
               vendor.replace(/_/g, ' ') === vendorMatch ||
               vendor.replace(/_/g, '') === vendorMatch.replace(/_/g, '');
      });
      
      if (!matchingVendor) continue;
      
      // Determine vendor match exactness
      const vendorExact = matchingVendor.toLowerCase() === vendorMatch;
      
      // If wildcard product, vendor exact = EXACT match, vendor partial = POSSIBLE match
      if (isWildcard) {
        const quality = vendorExact ? 'EXACT' : 'POSSIBLE';
        if (!bestQuality || (quality === 'EXACT') || (quality === 'CLOSE' && bestQuality === 'POSSIBLE')) {
          bestMatch = item;
          bestQuality = quality;
        }
        continue;
      }
      
      // Find matching product
      const matchingProduct = cve.products?.find(p => {
        const product = p.toLowerCase();
        return product === productMatch || 
               product.includes(productMatch) || 
               productMatch.includes(product) ||
               product.replace(/_/g, ' ') === productMatch ||
               product.replace(/_/g, '') === productMatch.replace(/_/g, '');
      });
      
      if (!matchingProduct) continue;
      
      // Determine product match exactness
      const productExact = matchingProduct.toLowerCase() === productMatch;
      
      // Determine match quality
      let quality;
      if (vendorExact && productExact) {
        quality = 'EXACT';
      } else if (vendorExact || productExact) {
        quality = 'CLOSE';
      } else {
        quality = 'POSSIBLE';
      }
      
      // Keep track of best match (EXACT > CLOSE > POSSIBLE)
      if (!bestQuality || 
          (quality === 'EXACT') || 
          (quality === 'CLOSE' && bestQuality === 'POSSIBLE')) {
        bestMatch = item;
        bestQuality = quality;
      }
      
      // If we found an exact match, we can stop
      if (quality === 'EXACT') break;
    }
    
    return bestMatch ? { quality: bestQuality, item: bestMatch } : null;
  };

  const handleLoadCVEs = async (timeRange, label) => {
    setLoadingCVEs(true);
    setLoadingTimeRange(label);
    
    console.log(`[FRONTEND] handleLoadCVEs called with timeRange: ${timeRange}, label: ${label}`);
    
    try {
      let result;
      
      if (timeRange <= 120) {
        // Use regular collection for 120 days or less
        console.log(`[FRONTEND] Calling collectCVEsManual with { daysBack: ${timeRange}, userId: ${currentUser.uid} }`);
        const collectCVEs = httpsCallable(functions, 'collectCVEsManual');
        result = await collectCVEs({ daysBack: timeRange, userId: currentUser.uid });
      } else {
        // Use historical load for longer periods
        const months = Math.ceil(timeRange / 30);
        const loadHistorical = httpsCallable(functions, 'loadHistoricalData');
        result = await loadHistorical({ months });
      }
      
      console.log('CVE collection result:', result.data);
      
      const newCount = result.data.newCVEs || result.data.totalNewCVEs || 0;
      
      if (newCount > 0) {
        alert(`✅ Successfully loaded ${newCount} CVEs from ${label}!`);
      } else {
        alert(`✅ Database is up to date. No new CVEs found for ${label}.`);
      }
      
      // Update last checked timestamp
      const updateLastChecked = httpsCallable(functions, 'updateLastChecked');
      await updateLastChecked();
      
      // Reload data
      await loadData();
    } catch (err) {
      console.error('Error loading CVEs:', err);
      alert(`❌ Failed to load CVEs for ${label}. Error: ${err.message}`);
    } finally {
      setLoadingCVEs(false);
      setLoadingTimeRange(null);
    }
  };

  // Use appropriate stats based on view mode
  const activeStats = viewMode === 'my' ? myStats : orgStats;

  const filteredCVEs = cves.filter(cve => {
    // Filter by view mode
    if (viewMode === 'my') {
      // My CVEs: only show CVEs matching user's watch list
      if (!cve.matchQuality) {
        return false;
      }
    }
    // Organization view: show all CVEs (no watch list filter)
    
    // Apply vendor filter
    if (vendorFilter !== 'ALL') {
      const hasVendor = cve.vendors?.some(v => 
        v.toLowerCase().includes(vendorFilter.toLowerCase()) ||
        vendorFilter.toLowerCase().includes(v.toLowerCase())
      );
      if (!hasVendor) {
        return false;
      }
    }
    
    // Apply severity filter
    if (activeSeverityFilter !== 'ALL' && cve.severity !== activeSeverityFilter) {
      return false;
    }
    
    // Apply match quality filter
    if (matchQualityFilter !== 'ALL') {
      // If user selected a specific match quality, only show CVEs with that quality
      if (cve.matchQuality !== matchQualityFilter) {
        return false;
      }
    }
    
    // Date range filter
    if (dateRangeFilter && cve.publishedDate) {
      const publishedDate = cve.publishedDate.toDate ? cve.publishedDate.toDate() : new Date(cve.publishedDate);
      const cutoffDate = subDays(new Date(), dateRangeFilter);
      if (publishedDate < cutoffDate) {
        return false;
      }
    }
    
    return true;
  });

  return (
    <div className="app-container">
      <Navigation />
      
      <main className="main-content">
        <div className="content-header">
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
            <div>
              <h1>CVE Dashboard</h1>
              <p>
                {userProfile?.lastChecked 
                  ? `Last updated: ${new Date(userProfile.lastChecked.toDate()).toLocaleString()}`
                  : 'Never updated'
                }
              </p>
            </div>
            
            {/* View Mode Toggle */}
            <div style={{display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)'}}>
              <button
                onClick={() => setViewMode('my')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'calc(var(--radius) - 2px)',
                  border: 'none',
                  background: viewMode === 'my' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'my' ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: viewMode === 'my' ? '600' : '400',
                  transition: 'all 0.2s'
                }}
              >
                <Users size={18} />
                My CVEs
              </button>
              <button
                onClick={() => setViewMode('org')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'calc(var(--radius) - 2px)',
                  border: 'none',
                  background: viewMode === 'org' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'org' ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: viewMode === 'org' ? '600' : '400',
                  transition: 'all 0.2s'
                }}
              >
                <Building2 size={18} />
                Organization
              </button>
            </div>
          </div>
        </div>

        {watchList.length === 0 ? (
          <div className="empty-state card">
            <Eye size={64} />
            <h2>No Watch List Items</h2>
            <p>Add vendors and products to your watch list to start monitoring CVEs</p>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/watchlist')}
            >
              Set Up Watch List
            </button>
          </div>
        ) : (
          <>
            {/* SECTION 1: RELOAD CVE DATA */}
            <div className="card" style={{marginBottom: '2rem'}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem'}}>
                <div>
                  <h3 style={{margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)'}}>
                    <Database size={20} />
                    CVE Data
                    {loadingCVEs && <RefreshCw size={18} className="spinning" />}
                  </h3>
                  <p style={{color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem'}}>
                    Fetches the last 90 days of CVEs from NVD for your watch list vendors.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => handleLoadCVEs(90, 'Last 90 Days')}
                  disabled={loadingCVEs}
                  style={{
                    minWidth: '140px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    justifyContent: 'center'
                  }}
                >
                  <RefreshCw size={18} />
                  {loadingCVEs ? 'Loading...' : 'Refresh Data'}
                </button>
              </div>
              
              {loadingCVEs && (
                <div className="loading-message">
                  <div className="spinner-large"></div>
                  <p style={{marginTop: '1rem', fontSize: '1.1rem', color: 'var(--primary)'}}>
                    Loading CVEs from NVD...
                  </p>
                  <p style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>
                    This may take a minute or two.
                  </p>
                </div>
              )}
            </div>

            {/* SECTION 2: VIEW & FILTER LOADED DATA */}
            <div style={{marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)'}}>
              <h3 style={{margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <Filter size={20} />
                🔍 FILTER & VIEW LOADED DATA
              </h3>
              <p style={{color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0}}>
                These filters control what's displayed from CVEs already in your database (does not fetch new data)
              </p>
            </div>

            <div className="stats-grid">
              <div 
                className={`stat-card ${activeSeverityFilter === 'ALL' ? 'stat-card-active' : ''}`}
                onClick={() => setActiveSeverityFilter('ALL')}
                style={{cursor: 'pointer'}}
              >
                <div className="stat-value">{activeStats.total}</div>
                <div className="stat-label">All CVEs</div>
              </div>
              <div 
                className={`stat-card stat-critical ${activeSeverityFilter === 'CRITICAL' ? 'stat-card-active' : ''}`}
                onClick={() => setActiveSeverityFilter('CRITICAL')}
                style={{cursor: 'pointer'}}
              >
                <div className="stat-value">{activeStats.critical}</div>
                <div className="stat-label">Critical</div>
              </div>
              <div 
                className={`stat-card stat-high ${activeSeverityFilter === 'HIGH' ? 'stat-card-active' : ''}`}
                onClick={() => setActiveSeverityFilter('HIGH')}
                style={{cursor: 'pointer'}}
              >
                <div className="stat-value">{activeStats.high}</div>
                <div className="stat-label">High</div>
              </div>
              <div 
                className={`stat-card stat-medium ${activeSeverityFilter === 'MEDIUM' ? 'stat-card-active' : ''}`}
                onClick={() => setActiveSeverityFilter('MEDIUM')}
                style={{cursor: 'pointer'}}
              >
                <div className="stat-value">{activeStats.medium}</div>
                <div className="stat-label">Medium</div>
              </div>
              <div 
                className={`stat-card stat-low ${activeSeverityFilter === 'LOW' ? 'stat-card-active' : ''}`}
                onClick={() => setActiveSeverityFilter('LOW')}
                style={{cursor: 'pointer'}}
              >
                <div className="stat-value">{activeStats.low}</div>
                <div className="stat-label">Low</div>
              </div>
              <div className="stat-card stat-new">
                <div className="stat-value">{activeStats.newToday}</div>
                <div className="stat-label">New Today</div>
              </div>
            </div>

            <div className="stats-grid match-quality-stats">
              <div className="stat-card stat-exact">
                <div className="stat-value">{activeStats.exactMatches}</div>
                <div className="stat-label">🎯 Exact Match</div>
              </div>
              <div className="stat-card stat-close">
                <div className="stat-value">{activeStats.closeMatches}</div>
                <div className="stat-label">🔍 Close Match</div>
              </div>
              <div className="stat-card stat-possible">
                <div className="stat-value">{activeStats.possibleMatches}</div>
                <div className="stat-label">💡 Possible Match</div>
              </div>
            </div>

            {/* Date Range Filter */}
            <div style={{marginBottom: '1rem'}}>
              <h4 style={{margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-muted)'}}>
                📅 Filter by Publication Date
              </h4>
              <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                <button
                  className={`filter-button ${dateRangeFilter === 1 ? 'filter-button-active' : ''}`}
                  onClick={() => setDateRangeFilter(1)}
                  style={{cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: dateRangeFilter === 1 ? 'var(--primary)' : 'var(--bg-secondary)', color: dateRangeFilter === 1 ? 'white' : 'var(--text-primary)'}}
                >
                  📰 Past 24 Hours
                </button>
                <button
                  className={`filter-button ${dateRangeFilter === 7 ? 'filter-button-active' : ''}`}
                  onClick={() => setDateRangeFilter(7)}
                  style={{cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: dateRangeFilter === 7 ? 'var(--primary)' : 'var(--bg-secondary)', color: dateRangeFilter === 7 ? 'white' : 'var(--text-primary)'}}
                >
                  📅 Past 7 Days
                </button>
                <button
                  className={`filter-button ${dateRangeFilter === 30 ? 'filter-button-active' : ''}`}
                  onClick={() => setDateRangeFilter(30)}
                  style={{cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: dateRangeFilter === 30 ? 'var(--primary)' : 'var(--bg-secondary)', color: dateRangeFilter === 30 ? 'white' : 'var(--text-primary)'}}
                >
                  🗓️ Past 30 Days
                </button>
                <button
                  className={`filter-button ${dateRangeFilter === 90 ? 'filter-button-active' : ''}`}
                  onClick={() => setDateRangeFilter(90)}
                  style={{cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: dateRangeFilter === 90 ? 'var(--primary)' : 'var(--bg-secondary)', color: dateRangeFilter === 90 ? 'white' : 'var(--text-primary)'}}
                >
                  📊 All 90 Days
                </button>
              </div>
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)'}}>
              <div style={{fontSize: '1rem', color: 'var(--text-primary)'}}>
                {viewMode === 'my' ? (
                  <>
                    <Users size={16} style={{display: 'inline', marginRight: '0.25rem', verticalAlign: 'text-bottom'}} />
                    Showing <strong>{filteredCVEs.length}</strong> of <strong>{activeStats.total}</strong> CVEs matching your watch list
                  </>
                ) : (
                  <>
                    <Building2 size={16} style={{display: 'inline', marginRight: '0.25rem', verticalAlign: 'text-bottom'}} />
                    Showing <strong>{filteredCVEs.length}</strong> of <strong>{activeStats.total}</strong> organization CVEs
                  </>
                )}
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  <label style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>Vendor:</label>
                  <select 
                    value={vendorFilter} 
                    onChange={(e) => setVendorFilter(e.target.value)}
                    style={{padding: '0.4rem 0.6rem', borderRadius: 'var(--radius)', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)'}}
                  >
                    <option value="ALL">All Vendors</option>
                    {[...new Set(watchList.map(item => item.vendor).filter(v => v && v !== '*'))].sort().map(vendor => (
                      <option key={vendor} value={vendor}>{vendor.charAt(0).toUpperCase() + vendor.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  <label style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>Match Quality:</label>
                  <select 
                    value={matchQualityFilter} 
                    onChange={(e) => setMatchQualityFilter(e.target.value)}
                    style={{padding: '0.4rem 0.6rem', borderRadius: 'var(--radius)', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)'}}
                  >
                    <option value="ALL">All Results</option>
                    <option value="EXACT">🎯 Exact Match</option>
                    <option value="CLOSE">🔍 Close Match</option>
                    <option value="POSSIBLE">💡 Possible Match</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="card">
                <p>Loading CVEs...</p>
              </div>
            ) : (
              <>
                {viewMode === 'org' && (
                  <div style={{
                    marginBottom: '1rem', 
                    padding: '1rem', 
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
                    borderRadius: 'var(--radius)', 
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <Building2 size={24} style={{color: 'var(--primary)', flexShrink: 0}} />
                    <div>
                      <div style={{fontWeight: '600', marginBottom: '0.25rem', color: 'var(--text-primary)'}}>
                        Organization View
                      </div>
                      <div style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>
                        Viewing all CVEs loaded by any user in the organization. CVEs may not match your personal watch list.
                      </div>
                    </div>
                  </div>
                )}
                <CVEList cves={filteredCVEs} watchList={watchList} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
