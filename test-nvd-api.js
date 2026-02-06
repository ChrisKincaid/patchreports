const fetch = require('node-fetch');

async function testNVDAPI() {
  const apiUrl = 'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=1';
  
  console.log('Fetching from NVD API...\n');
  
  const response = await fetch(apiUrl, {
    headers: { 'User-Agent': 'CVE-Alert-System/1.0' }
  });
  
  const data = await response.json();
  
  if (data.vulnerabilities && data.vulnerabilities.length > 0) {
    const vuln = data.vulnerabilities[0];
    console.log('Sample CVE Structure:');
    console.log(JSON.stringify(vuln, null, 2));
  }
}

testNVDAPI().catch(console.error);
