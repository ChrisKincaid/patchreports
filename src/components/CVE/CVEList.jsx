import React, { useState } from 'react';
import { 
  AlertTriangle, 
  ExternalLink, 
  ChevronDown, 
  ChevronRight,
  Calendar,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';

function CVEList({ cves, watchList }) {
  const [expandedCVE, setExpandedCVE] = useState(null);

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'severity-critical';
      case 'HIGH': return 'severity-high';
      case 'MEDIUM': return 'severity-medium';
      case 'LOW': return 'severity-low';
      default: return 'severity-unknown';
    }
  };

  const getSeverityIcon = (severity) => {
    const iconSize = 20;
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return <AlertTriangle size={iconSize} />;
      default:
        return <Shield size={iconSize} />;
    }
  };

  const getMatchingWatchItems = (cve) => {
    return watchList.filter(item => {
      const vendorMatch = item.vendor.toLowerCase();
      const productMatch = item.product.toLowerCase();
      
      const hasVendor = cve.vendors?.some(v => 
        v.includes(vendorMatch) || vendorMatch.includes(v)
      );
      const hasProduct = cve.products?.some(p => 
        p.includes(productMatch) || productMatch.includes(p)
      );
      
      return hasVendor && hasProduct;
    });
  };

  const toggleExpand = (cveId) => {
    setExpandedCVE(expandedCVE === cveId ? null : cveId);
  };

  if (cves.length === 0) {
    return (
      <div className="card empty-state">
        <Shield size={48} />
        <h3>No CVEs Found</h3>
        <p>No vulnerabilities match your current filters and watch list</p>
      </div>
    );
  }

  return (
    <div className="cve-list">
      {cves.map(cve => {
        const isExpanded = expandedCVE === cve.id;
        const matchingItems = getMatchingWatchItems(cve);
        const publishDate = cve.publishedDate?.toDate();

        return (
          <div key={cve.id} className="cve-item card">
            <div className="cve-header" onClick={() => toggleExpand(cve.id)}>
              <div className="cve-title-section">
                <div className={`severity-badge ${getSeverityClass(cve.severity)}`}>
                  {getSeverityIcon(cve.severity)}
                  <span>{cve.severity}</span>
                  <span className="cvss-score">{cve.cvssScore.toFixed(1)}</span>
                </div>
                {cve.matchQuality && (
                  <div className={`match-quality-badge match-${cve.matchQuality.toLowerCase()}`}>
                    {cve.matchQuality === 'EXACT' && '🎯 Exact'}
                    {cve.matchQuality === 'CLOSE' && '🔍 Close'}
                    {cve.matchQuality === 'POSSIBLE' && '💡 Possible'}
                  </div>
                )}
                <div className="cve-title">
                  <h3>{cve.cveId}</h3>
                  <div className="cve-meta">
                    <span className="meta-item">
                      <Calendar size={14} />
                      {publishDate ? format(publishDate, 'MMM d, yyyy') : 'Unknown'}
                    </span>
                    {cve.matchedItem && (
                      <span className="meta-item watch-matches">
                        Matches: {cve.matchedItem.vendor}/{cve.matchedItem.product}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button className="expand-btn">
                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>
            </div>

            {isExpanded && (
              <div className="cve-details">
                <div className="detail-section">
                  <h4>Description</h4>
                  <p>{cve.description}</p>
                </div>

                {cve.vendors && cve.vendors.length > 0 && (
                  <div className="detail-section">
                    <h4>Affected Vendors</h4>
                    <div className="tag-list">
                      {cve.vendors.map((vendor, idx) => (
                        <span key={idx} className="tag">{vendor}</span>
                      ))}
                    </div>
                  </div>
                )}

                {cve.products && cve.products.length > 0 && (
                  <div className="detail-section">
                    <h4>Affected Products</h4>
                    <div className="tag-list">
                      {cve.products.map((product, idx) => (
                        <span key={idx} className="tag">{product}</span>
                      ))}
                    </div>
                  </div>
                )}

                {cve.cvssVector && (
                  <div className="detail-section">
                    <h4>CVSS Vector</h4>
                    <code>{cve.cvssVector}</code>
                  </div>
                )}

                {cve.references && cve.references.length > 0 && (
                  <div className="detail-section">
                    <h4>References</h4>
                    <ul className="references-list">
                      {cve.references.slice(0, 5).map((ref, idx) => (
                        <li key={idx}>
                          <a 
                            href={ref.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="reference-link"
                          >
                            {ref.source || ref.url}
                            <ExternalLink size={14} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="cve-actions">
                  <a
                    href={`https://nvd.nist.gov/vuln/detail/${cve.cveId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    View on NVD
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default CVEList;
