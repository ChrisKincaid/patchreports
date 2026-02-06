const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { collectDailyCVEs, reprocessExistingCVEs } = require('./src/cveCollector');
const { sendCriticalAlerts } = require('./src/emailAlerts');

admin.initializeApp();

// Scheduled function to collect CVEs daily at 6 AM UTC
exports.dailyCVECollection = functions.pubsub
  .schedule('0 6 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      console.log('Starting daily CVE collection...');
      const result = await collectDailyCVEs();
      console.log(`CVE collection completed: ${result.newCVEs} new CVEs processed`);
      
      // Send alerts for critical vulnerabilities
      if (result.criticalCount > 0) {
        await sendCriticalAlerts(result.criticalCVEs);
      }
      
      return null;
    } catch (error) {
      console.error('Error in daily CVE collection:', error);
      throw error;
    }
  });

// Manual trigger for CVE collection
exports.collectCVEsManual = functions.runWith({
  timeoutSeconds: 300,
  memory: '512MB'
}).https.onCall(async (data, context) => {
  // Only allow authenticated users
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  console.log('================================================');
  console.log('collectCVEsManual FUNCTION CALLED [v2]');
  console.log('Received data parameter:', JSON.stringify(data));
  
  try {
    console.log('==================== DEBUG START ====================');
    console.log('RAW data object:', data);
    console.log('data.daysBack value:', data ? data.daysBack : 'data is null');
    console.log('==================== DEBUG END ====================');
    
    // Get daysBack from request parameter, default to 30 if not provided
    let daysBack = 30; // default
    if (data && typeof data.daysBack !== 'undefined' && data.daysBack !== null) {
      daysBack = Math.min(parseInt(data.daysBack), 120);
    }
    console.log(`FINAL daysBack value: ${daysBack}`);
    
    // Get userId from authenticated user
    const userId = context.auth.uid;
    console.log(`User ID: ${userId}`);
    console.log('================================================');
    
    const result = await collectDailyCVEs(daysBack, 0, userId);
    return {
      success: true,
      newCVEs: result.newCVEs,
      criticalCount: result.criticalCount,
      daysCollected: daysBack
    };
  } catch (error) {
    console.error('Error in manual CVE collection:', error);
    throw new functions.https.HttpsError('internal', 'Failed to collect CVEs');
  }
});

// Load historical data in chunks
exports.loadHistoricalData = functions.runWith({
  timeoutSeconds: 540,
  memory: '1GB'
}).https.onCall(async (data, context) => {
  // Only allow authenticated users
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const months = data?.months || 6; // 6, 12, 60, 120 months
  const totalDays = months * 30;
  const chunkSize = 120; // NVD API max
  const chunks = Math.ceil(totalDays / chunkSize);
  
  console.log(`Loading ${months} months (${totalDays} days) in ${chunks} chunks...`);
  
  try {
    let totalNewCVEs = 0;
    let totalCritical = 0;
    
    for (let i = 0; i < chunks; i++) {
      const startDaysBack = i * chunkSize;
      const endDaysBack = Math.min((i + 1) * chunkSize, totalDays);
      const daysInChunk = endDaysBack - startDaysBack;
      
      console.log(`Chunk ${i + 1}/${chunks}: ${startDaysBack}-${endDaysBack} days back`);
      
      // Fetch CVEs for this chunk
      const userId = context.auth.uid;
      const result = await collectDailyCVEs(daysInChunk, startDaysBack, userId);
      
      totalNewCVEs += result.newCVEs;
      totalCritical += result.criticalCount;
      
      console.log(`Chunk ${i + 1} complete: ${result.newCVEs} new CVEs`);
    }
    
    return {
      success: true,
      totalNewCVEs: totalNewCVEs,
      totalCritical: totalCritical,
      monthsLoaded: months,
      chunksProcessed: chunks
    };
  } catch (error) {
    console.error('Error loading historical data:', error);
    throw new functions.https.HttpsError('internal', 'Failed to load historical data');
  }
});

// Reprocess existing CVEs with updated extraction logic
exports.reprocessCVEs = functions.https.onCall(async (data, context) => {
  // Only allow authenticated users
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  try {
    const result = await reprocessExistingCVEs();
    return {
      success: true,
      updated: result.updated
    };
  } catch (error) {
    console.error('Error reprocessing CVEs:', error);
    throw new functions.https.HttpsError('internal', 'Failed to reprocess CVEs');
  }
});

// Function to update user's last checked timestamp
exports.updateLastChecked = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const userId = context.auth.uid;
  
  try {
    await admin.firestore().collection('users').doc(userId).update({
      lastChecked: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Log audit event
    await admin.firestore().collection('audit').add({
      userId: userId,
      action: 'last_checked_updated',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating last checked:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update timestamp');
  }
});

// Function to export user data (GDPR compliance)
exports.exportUserData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const userId = context.auth.uid;
  
  try {
    // Get user profile
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    // Get watch list
    const watchListSnapshot = await admin.firestore()
      .collection('users').doc(userId)
      .collection('watchList')
      .get();
    
    const watchList = watchListSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return {
      profile: userDoc.data(),
      watchList: watchList,
      exportDate: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error exporting user data:', error);
    throw new functions.https.HttpsError('internal', 'Failed to export data');
  }
});

// Function to delete user data (GDPR compliance)
exports.deleteUserData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const userId = context.auth.uid;
  
  try {
    // Delete watch list items
    const watchListSnapshot = await admin.firestore()
      .collection('users').doc(userId)
      .collection('watchList')
      .get();
    
    const batch = admin.firestore().batch();
    watchListSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete user profile
    batch.delete(admin.firestore().collection('users').doc(userId));
    
    await batch.commit();
    
    // Delete auth account
    await admin.auth().deleteUser(userId);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting user data:', error);
    throw new functions.https.HttpsError('internal', 'Failed to delete data');
  }
});
