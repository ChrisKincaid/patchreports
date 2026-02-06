const admin = require('firebase-admin');

/**
 * Check if a CVE matches a user's watch list
 */
function matchesWatchList(cve, watchList) {
  for (const item of watchList) {
    const vendorMatch = item.vendor.toLowerCase();
    const productMatch = item.product.toLowerCase();
    
    // Check if CVE vendors/products match watch list item
    const hasVendor = cve.vendors.some(v => v.includes(vendorMatch) || vendorMatch.includes(v));
    const hasProduct = cve.products.some(p => p.includes(productMatch) || productMatch.includes(p));
    
    if (hasVendor && hasProduct) {
      return true;
    }
  }
  
  return false;
}

/**
 * Send email alerts for critical CVEs that match user watch lists
 */
async function sendCriticalAlerts(criticalCVEs) {
  console.log(`Processing alerts for ${criticalCVEs.length} critical CVEs`);
  
  try {
    // Get all users with notifications enabled
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('notificationsEnabled', '==', true)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('No users with notifications enabled');
      return;
    }
    
    const alertPromises = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      // Get user's watch list
      const watchListSnapshot = await admin.firestore()
        .collection('users').doc(userId)
        .collection('watchList')
        .get();
      
      const watchList = watchListSnapshot.docs.map(doc => doc.data());
      
      if (watchList.length === 0) {
        continue;
      }
      
      // Find matching CVEs
      const matchingCVEs = criticalCVEs.filter(cve => matchesWatchList(cve, watchList));
      
      if (matchingCVEs.length > 0) {
        // In a production environment, you would send actual emails here
        // using SendGrid, AWS SES, or similar service
        // For now, we'll just log and create a notification document
        
        console.log(`User ${userId} has ${matchingCVEs.length} matching critical CVEs`);
        
        const notificationPromise = admin.firestore().collection('notifications').add({
          userId: userId,
          type: 'critical_cve_alert',
          cveIds: matchingCVEs.map(cve => cve.cveId),
          count: matchingCVEs.length,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false
        });
        
        alertPromises.push(notificationPromise);
        
        // Log audit event
        await admin.firestore().collection('audit').add({
          userId: userId,
          action: 'critical_alert_created',
          cveCount: matchingCVEs.length,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    
    await Promise.all(alertPromises);
    console.log(`Created ${alertPromises.length} alert notifications`);
    
  } catch (error) {
    console.error('Error sending critical alerts:', error);
    throw error;
  }
}

/**
 * Format email content for critical CVE alert
 * This is a template - integrate with your email service provider
 */
function formatAlertEmail(matchingCVEs, userEmail) {
  const cveList = matchingCVEs.map(cve => {
    return `
      CVE ID: ${cve.cveId}
      Severity: ${cve.severity} (CVSS ${cve.cvssScore})
      Description: ${cve.description.substring(0, 200)}...
      Published: ${cve.publishedDate.toDate().toLocaleDateString()}
    `;
  }).join('\n---\n');
  
  return {
    to: userEmail,
    subject: `[CRITICAL] ${matchingCVEs.length} Critical CVE Alert(s)`,
    text: `
Critical CVE Alert

You have ${matchingCVEs.length} critical vulnerability alert(s) matching your watch list:

${cveList}

Login to your CVE Alert Dashboard for full details.

---
This is an automated alert from CVE Alert System
To manage your alerts, visit your dashboard settings
    `.trim()
  };
}

module.exports = {
  sendCriticalAlerts,
  matchesWatchList,
  formatAlertEmail
};
