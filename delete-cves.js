// Script to delete all CVEs from Firestore
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteAllCVEs() {
  console.log('Deleting all CVEs from database...');
  
  const batch = db.batch();
  const snapshot = await db.collection('cves').get();
  
  console.log(`Found ${snapshot.size} CVEs to delete`);
  
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log('All CVEs deleted!');
  process.exit(0);
}

deleteAllCVEs().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
