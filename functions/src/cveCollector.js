const admin = require('firebase-admin');
const fetch = require('node-fetch');

/**
 * Fetch CVEs from NVD API for the last 24 hours
 * NVD API Docs: https://nvd.nist.gov/developers/vulnerabilities
 */
async function fetchRecentCVEs(daysBack = 1, startOffset = 0) {
  console.log('========================================');
  console.log('FUNCTION fetchRecentCVEs CALLED');
  console.log(`INPUT daysBack: ${daysBack}`);
  console.log(`INPUT startOffset: ${startOffset}`);
  
  const now = new Date();
  console.log(`Current time: ${now.toISOString()}`);
  
  const endDate = new Date(now.getTime() - startOffset * 24 * 60 * 60 * 1000);
  console.log(`End date calculated: ${endDate.toISOString()}`);
  
  const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
  console.log(`Start date calculated: ${startDate.toISOString()}`);
  
  // Format dates for NVD API (ISO 8601)
  const pubStartDate = startDate.toISOString().split('.')[0] + 'Z';
  const pubEndDate = endDate.toISOString().split('.')[0] + 'Z';
  
  const resultsPerPage = 2000; // NVD API max
  let startIndex = 0;
  let allVulnerabilities = [];
  
  try {
    // Fetch first page to get totalResults
    const firstUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0' +
      `?pubStartDate=${pubStartDate}&pubEndDate=${pubEndDate}` +
      `&resultsPerPage=${resultsPerPage}&startIndex=${startIndex}`;
    
    console.log('EXACT NVD API URL (first page):');
    console.log(firstUrl);
    
    const firstResponse = await fetch(firstUrl, {
      headers: {
        'User-Agent': 'CVE-Alert-System/1.0'
      }
    });
    
    if (!firstResponse.ok) {
      throw new Error(`NVD API returned ${firstResponse.status}: ${firstResponse.statusText}`);
    }
    
    const firstData = await firstResponse.json();
    const totalResults = firstData.totalResults || 0;
    
    console.log(`Total CVEs found: ${totalResults}`);
    console.log(`First page returned: ${firstData.vulnerabilities?.length || 0} CVEs`);
    
    allVulnerabilities = firstData.vulnerabilities || [];
    
    // Fetch remaining pages if needed
    if (totalResults > resultsPerPage) {
      const totalPages = Math.ceil(totalResults / resultsPerPage);
      console.log(`Fetching ${totalPages - 1} additional pages...`);
      
      for (let page = 1; page < totalPages; page++) {
        startIndex = page * resultsPerPage;
        
        const pageUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0' +
          `?pubStartDate=${pubStartDate}&pubEndDate=${pubEndDate}` +
          `&resultsPerPage=${resultsPerPage}&startIndex=${startIndex}`;
        
        console.log(`Fetching page ${page + 1}/${totalPages} (startIndex=${startIndex})...`);
        
        // Delay to respect NVD rate limits (6 seconds for no API key)
        await new Promise(resolve => setTimeout(resolve, 6000));
        
        const pageResponse = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'CVE-Alert-System/1.0'
          }
        });
        
        if (!pageResponse.ok) {
          console.error(`Failed to fetch page ${page + 1}: ${pageResponse.status}`);
          continue; // Skip failed pages but continue with others
        }
        
        const pageData = await pageResponse.json();
        allVulnerabilities = allVulnerabilities.concat(pageData.vulnerabilities || []);
        console.log(`Total CVEs collected so far: ${allVulnerabilities.length}`);
      }
    }
    
    console.log(`Final CVE count: ${allVulnerabilities.length}`);
    console.log('========================================');
    
    // Debug: Log structure of first CVE
    if (allVulnerabilities.length > 0) {
      const firstVuln = allVulnerabilities[0];
      console.log('API Response Structure Sample:', JSON.stringify({
        hasConfigurations: !!firstVuln.configurations,
        hasCveConfigurations: !!firstVuln.cve?.configurations,
        topLevelKeys: Object.keys(firstVuln),
        cveKeys: firstVuln.cve ? Object.keys(firstVuln.cve) : []
      }));
    }
    
    return allVulnerabilities;
  } catch (error) {
    console.error('Error fetching CVEs from NVD:', error);
    throw error;
  }
}

/**
 * Fetch CVEs for a specific vendor using NVD keywordSearch
 */
async function fetchRecentCVEsByVendor(daysBack = 1, vendor) {
  const now = new Date();
  const endDate = now;
  const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
  
  const pubStartDate = startDate.toISOString().split('.')[0] + 'Z';
  const pubEndDate = endDate.toISOString().split('.')[0] + 'Z';
  
  const resultsPerPage = 2000;
  const apiUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0' +
    `?pubStartDate=${pubStartDate}&pubEndDate=${pubEndDate}` +
    `&keywordSearch=${encodeURIComponent(vendor)}` +
    `&resultsPerPage=${resultsPerPage}`;
  
  console.log(`NVD API URL for ${vendor}: ${apiUrl}`);
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'CVE-Alert-System/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`NVD API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`  ${vendor}: ${data.totalResults} total, returning ${data.vulnerabilities?.length || 0}`);
    
    return data.vulnerabilities || [];
  } catch (error) {
    console.error(`Error fetching CVEs for ${vendor}:`, error);
    return [];
  }
}

/**
 * Extract vendor and product information from CVE data
 */
function extractVendorsAndProducts(vulnerability) {
  const vendors = new Set();
  const products = new Set();
  
  try {
    const cveId = vulnerability.cve?.id || 'unknown';
    
    // DEBUG: Log what keys exist in vulnerability object
    console.log(`[${cveId}] DEBUG - vulnerability keys: ${Object.keys(vulnerability).join(', ')}`);
    console.log(`[${cveId}] DEBUG - Has .configurations: ${!!vulnerability.configurations}`);
    console.log(`[${cveId}] DEBUG - Has .cve.configurations: ${!!vulnerability.cve?.configurations}`);
    
    // Method 1: Try configurations at root level (NVD API 2.0)
    if (vulnerability.configurations) {
      console.log(`[${cveId}] Found configurations at root level`);
      for (const config of vulnerability.configurations) {
        const nodes = config.nodes || [];
        
        for (const node of nodes) {
          const cpeMatches = node.cpeMatch || [];
          
          for (const match of cpeMatches) {
            if (match.criteria) {
              // CPE format: cpe:2.3:a:vendor:product:version:...
              const parts = match.criteria.split(':');
              if (parts.length >= 5) {
                const vendor = parts[3];
                const product = parts[4];
                
                if (vendor && vendor !== '*') {
                  vendors.add(vendor.toLowerCase());
                }
                if (product && product !== '*') {
                  products.add(product.toLowerCase());
                }
              }
            }
          }
        }
      }
    }
    
    // Method 2: Try cve.configurations (older structure)
    if (vendors.size === 0 && vulnerability.cve?.configurations) {
      console.log(`[${cveId}] Found configurations at cve level`);
      for (const config of vulnerability.cve.configurations) {
        const nodes = config.nodes || [];
        
        for (const node of nodes) {
          const cpeMatches = node.cpeMatch || [];
          
          for (const match of cpeMatches) {
            if (match.criteria) {
              const parts = match.criteria.split(':');
              if (parts.length >= 5) {
                const vendor = parts[3];
                const product = parts[4];
                
                if (vendor && vendor !== '*') {
                  vendors.add(vendor.toLowerCase());
                }
                if (product && product !== '*') {
                  products.add(product.toLowerCase());
                }
              }
            }
          }
        }
      }
    }
    
    // Method 3: Fallback - extract from description (more aggressive)
    if (vendors.size === 0 && vulnerability.cve?.descriptions) {
      console.log(`[${cveId}] Trying description extraction`);
      const descriptions = vulnerability.cve.descriptions || [];
      const englishDesc = descriptions.find(d => d.lang === 'en');
      if (englishDesc) {
        const desc = englishDesc.value.toLowerCase();
        
        // Common vendor patterns - much more comprehensive
        const vendorPatterns = [
          /\b(microsoft|ms)\b/gi,
          /\b(cisco|webex)\b/gi,
          /\b(apache|httpd)\b/gi,
          /\b(oracle|java|mysql)\b/gi,
          /\b(adobe|flash|acrobat)\b/gi,
          /\b(google|chrome|android)\b/gi,
          /\b(apple|ios|macos|safari)\b/gi,
          /\b(ibm|vmware|dell|hp|lenovo)\b/gi,
          /\b(linux|redhat|red hat|ubuntu|debian|centos)\b/gi,
          /\b(mozilla|firefox|thunderbird)\b/gi,
          /\b(nvidia|amd|intel)\b/gi,
          /\b(aws|amazon)\b/gi,
          /\b(sap|salesforce|servicenow)\b/gi
        ];
        
        vendorPatterns.forEach(pattern => {
          const matches = desc.match(pattern);
          if (matches) {
            matches.forEach(v => {
              let normalized = v.toLowerCase().trim();
              // Normalize MS -> microsoft
              if (normalized === 'ms') normalized = 'microsoft';
              vendors.add(normalized.replace(/\s+/g, '_'));
            });
          }
        });
      }
    }
    
    if (vendors.size > 0 || products.size > 0) {
      const vendorList = Array.from(vendors).join(', ');
      console.log(`[${cveId}] Extracted ${vendors.size} vendors: [${vendorList}], ` +
        `${products.size} products`);
    } else {
      console.log(`[${cveId}] WARNING: No vendors or products extracted!`);
    }
    
  } catch (error) {
    console.error('Error extracting vendors/products:', error);
  }
  
  return {
    vendors: Array.from(vendors),
    products: Array.from(products)
  };
}

/**
 * Extract CVSS score and severity
 */
function extractCVSSInfo(cve) {
  try {
    const metrics = cve.cve?.metrics || {};
    
    // Try CVSS v3.1 first
    if (metrics.cvssMetricV31 && metrics.cvssMetricV31.length > 0) {
      const cvssData = metrics.cvssMetricV31[0].cvssData;
      return {
        cvssScore: cvssData.baseScore,
        severity: cvssData.baseSeverity,
        vector: cvssData.vectorString
      };
    }
    
    // Fallback to CVSS v3.0
    if (metrics.cvssMetricV30 && metrics.cvssMetricV30.length > 0) {
      const cvssData = metrics.cvssMetricV30[0].cvssData;
      return {
        cvssScore: cvssData.baseScore,
        severity: cvssData.baseSeverity,
        vector: cvssData.vectorString
      };
    }
    
    // Fallback to CVSS v2
    if (metrics.cvssMetricV2 && metrics.cvssMetricV2.length > 0) {
      const cvssData = metrics.cvssMetricV2[0].cvssData;
      const score = cvssData.baseScore;
      let severity = 'UNKNOWN';
      if (score >= 9.0) severity = 'CRITICAL';
      else if (score >= 7.0) severity = 'HIGH';
      else if (score >= 4.0) severity = 'MEDIUM';
      else severity = 'LOW';
      
      return {
        cvssScore: score,
        severity: severity,
        vector: cvssData.vectorString
      };
    }
  } catch (error) {
    console.error('Error extracting CVSS info:', error);
  }
  
  return {
    cvssScore: 0,
    severity: 'UNKNOWN',
    vector: null
  };
}

/**
 * Parse CVE data and store in Firestore
 */
async function processCVE(vulnerability) {
  try {
    const cve = vulnerability.cve;
    const cveId = cve.id;
    
    // Check if CVE already exists
    const cveRef = admin.firestore().collection('cves').doc(cveId);
    const existingDoc = await cveRef.get();
    
    if (existingDoc.exists) {
      console.log(`CVE ${cveId} already exists, skipping`);
      return { processed: false, critical: false };
    }
    
    // Extract description
    const descriptions = cve.descriptions || [];
    const englishDesc = descriptions.find(d => d.lang === 'en');
    const description = englishDesc ? englishDesc.value : 'No description available';
    
    // Extract vendors and products
    const { vendors, products } = extractVendorsAndProducts(vulnerability);
    
    // Extract CVSS information
    const cvssInfo = extractCVSSInfo(vulnerability);
    
    // Extract references
    const references = (cve.references || []).map(ref => ({
      url: ref.url,
      source: ref.source
    }));
    
    // Create CVE document
    const cveData = {
      cveId: cveId,
      description: description,
      vendors: vendors,
      products: products,
      cvssScore: cvssInfo.cvssScore,
      severity: cvssInfo.severity,
      cvssVector: cvssInfo.vector,
      publishedDate: admin.firestore.Timestamp.fromDate(new Date(cve.published)),
      lastModifiedDate: admin.firestore.Timestamp.fromDate(new Date(cve.lastModified)),
      references: references,
      collectedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await cveRef.set(cveData);
    
    console.log(`Processed CVE: ${cveId} (${cvssInfo.severity})`);
    
    return {
      processed: true,
      critical: cvssInfo.severity === 'CRITICAL' || cvssInfo.cvssScore >= 9.0,
      cveData: cveData
    };
  } catch (error) {
    console.error('Error processing CVE:', error);
    return { processed: false, critical: false };
  }
}

/**
 * Main function to collect CVEs daily
 */
async function collectDailyCVEs(daysBack = 1, startOffset = 0, userId = null) {
  console.log('========== CVE COLLECTION START ==========');
  console.log(`Requested: ${daysBack} days, offset ${startOffset}`);
  console.log(`User ID: ${userId || 'ALL USERS (scheduled job)'}`);
  
  try {
    // LOAD WATCH LIST (one user or all users for scheduled jobs)
    const allWatchListItems = [];
    
    if (userId) {
      // Load only the specific user's watch list
      console.log(`Loading watch list for user: ${userId}`);
      const watchListSnapshot = await admin.firestore()
        .collection('users')
        .doc(userId)
        .collection('watchList')
        .get();
      
      watchListSnapshot.docs.forEach(doc => {
        allWatchListItems.push(doc.data());
      });
    } else {
      // Load ALL users' watch lists (for scheduled jobs only)
      console.log('Loading watch lists for ALL USERS (scheduled job)');
      const usersSnapshot = await admin.firestore().collection('users').get();
      
      for (const userDoc of usersSnapshot.docs) {
        const watchListSnapshot = await admin.firestore()
          .collection('users')
          .doc(userDoc.id)
          .collection('watchList')
          .get();
        
        watchListSnapshot.docs.forEach(doc => {
          allWatchListItems.push(doc.data());
        });
      }
    }
    
    // Remove duplicates and get unique vendors
    const uniqueVendors = [...new Set(
      allWatchListItems
        .map(item => (item.vendor || '').toLowerCase().trim())
        .filter(v => v && v !== '*')
    )];
    
    console.log(`Loaded watch list: ${uniqueVendors.length} unique vendors`);
    uniqueVendors.forEach(vendor => {
      console.log(`  - ${vendor}`);
    });
    
    // Fetch CVEs for EACH vendor separately using NVD keywordSearch
    let allVulnerabilities = [];
    for (const vendor of uniqueVendors) {
      console.log(`Fetching CVEs for vendor: ${vendor}...`);
      const vendorCVEs = await fetchRecentCVEsByVendor(daysBack, vendor);
      console.log(`  Found ${vendorCVEs.length} CVEs for ${vendor}`);
      allVulnerabilities = allVulnerabilities.concat(vendorCVEs);
    }
    
    // Remove duplicates by CVE ID
    const uniqueCVEs = Array.from(
      new Map(allVulnerabilities.map(v => [v.cve.id, v])).values()
    );
    console.log(`Total unique CVEs across all vendors: ${uniqueCVEs.length}`);
    
    const vulnerabilities = uniqueCVEs;
    console.log(`NVD returned ${vulnerabilities.length} vulnerabilities`);
    
    // Skip only "Rejected" CVEs, keep everything else (including "Awaiting Analysis")
    const validCVEs = vulnerabilities.filter(vuln => {
      const status = vuln.cve?.vulnStatus;
      const cveId = vuln.cve?.id || 'unknown';
      
      if (status === 'Rejected') {
        console.log(`[${cveId}] Skipping - status: Rejected`);
        return false;
      }
      return true;
    });
    
    const skippedCount = vulnerabilities.length - validCVEs.length;
    console.log(`Will process ${validCVEs.length} CVEs (rejected: ${skippedCount})`);
    
    let newCVEs = 0;
    let criticalCount = 0;
    const criticalCVEs = [];
    let processedCount = 0;
    
    for (const vulnerability of validCVEs) {
      // No longer filter by watch list - we already fetched only relevant vendors!
      const result = await processCVE(vulnerability);
      processedCount++;
      
      if (processedCount % 10 === 0) {
        console.log(`Progress: ${processedCount}/${validCVEs.length} CVEs processed`);
      }
      
      if (result.processed) {
        newCVEs++;
        
        if (result.critical) {
          criticalCount++;
          criticalCVEs.push(result.cveData);
        }
      }
    }
    
    // Log collection summary
    await admin.firestore().collection('audit').add({
      action: 'cve_collection_completed',
      newCVEs: newCVEs,
      criticalCount: criticalCount,
      totalFetched: vulnerabilities.length,
      validCVEs: validCVEs.length,
      skipped: vulnerabilities.length - validCVEs.length,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('========== CVE COLLECTION COMPLETE ==========');
    console.log(`Total unique CVEs fetched: ${vulnerabilities.length}`);
    console.log(`Rejected/skipped: ${skippedCount}`);
    console.log(`New CVEs saved to database: ${newCVEs}`);
    console.log(`Critical: ${criticalCount}`);
    console.log('===========================================');
    
    return {
      newCVEs: newCVEs,
      criticalCount: criticalCount,
      criticalCVEs: criticalCVEs
    };
  } catch (error) {
    console.error('Error in CVE collection:', error);
    throw error;
  }
}

/**
 * Reprocess existing CVEs to fix vendor/product extraction
 */
async function reprocessExistingCVEs() {
  console.log('Starting reprocessing of existing CVEs...');
  
  try {
    // Fetch recent CVEs again
    const vulnerabilities = await fetchRecentCVEs();
    console.log(`Fetched ${vulnerabilities.length} vulnerabilities to reprocess`);
    
    let updated = 0;
    
    for (const vulnerability of vulnerabilities) {
      const cveId = vulnerability.cve?.id;
      if (!cveId) continue;
      
      // Extract vendors and products with new logic
      const { vendors, products } = extractVendorsAndProducts(vulnerability);
      
      // Update existing document
      const cveRef = admin.firestore().collection('cves').doc(cveId);
      const doc = await cveRef.get();
      
      if (doc.exists) {
        await cveRef.update({
          vendors: vendors,
          products: products,
          reprocessedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        updated++;
        console.log(`Updated ${cveId}: ${vendors.length} vendors, ${products.length} products`);
      }
    }
    
    console.log(`Reprocessing complete: ${updated} CVEs updated`);
    return { updated };
    
  } catch (error) {
    console.error('Error reprocessing CVEs:', error);
    throw error;
  }
}

module.exports = {
  collectDailyCVEs,
  fetchRecentCVEs,
  processCVE,
  reprocessExistingCVEs
};
