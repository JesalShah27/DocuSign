// 🔧 FRONTEND DEBUGGING SCRIPT FOR DOCUMENT HASH DISPLAY
// Add this to your browser console on the Documents page

console.log('🐛 Starting Document Hash Debug Session');
console.log('=======================================');

// 1. Check if we have a valid token
const token = localStorage.getItem('token');
console.log('🔑 Token status:', {
  exists: !!token,
  preview: token ? token.slice(0, 30) + '...' : 'None'
});

// 2. Test direct API call
async function testDirectApiCall() {
  console.log('\n📡 Testing direct API call...');
  
  try {
    const response = await fetch('http://localhost:4000/api/documents', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response successful!');
      console.log('📄 Documents returned:', data.length);
      
      if (data.length > 0) {
        const firstDoc = data[0];
        console.log('🔍 First document analysis:');
        console.log('  - Name:', firstDoc.originalName);
        console.log('  - originalHash present:', !!firstDoc.originalHash);
        console.log('  - originalHash type:', typeof firstDoc.originalHash);
        console.log('  - originalHash value:', firstDoc.originalHash);
        console.log('  - All keys:', Object.keys(firstDoc));
        
        // Show all documents with hash status
        console.log('\n📋 All documents hash status:');
        data.forEach((doc, index) => {
          console.log(`  ${index + 1}. ${doc.originalName}`);
          console.log(`     - Hash: ${doc.originalHash ? '✅ Present' : '❌ Missing'}`);
          if (doc.originalHash) {
            console.log(`     - Value: ${doc.originalHash.slice(0, 16)}...`);
          }
        });
        
        return data;
      } else {
        console.log('❌ No documents returned');
        return [];
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ API call failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return null;
    }
  } catch (error) {
    console.error('❌ Network error:', error);
    return null;
  }
}

// 3. Force update the documents state if React DevTools is available
function forceUpdateDocumentsDisplay(apiData) {
  console.log('\n🔄 Attempting to force update React state...');
  
  // Try to find the documents container
  const documentsContainer = document.querySelector('[data-testid="documents-list"], .space-y-4');
  
  if (documentsContainer && apiData && apiData.length > 0) {
    console.log('✅ Found documents container, will attempt manual update');
    
    // Create a visual indicator showing the hash data
    const debugDiv = document.createElement('div');
    debugDiv.id = 'hash-debug-display';
    debugDiv.style.cssText = `
      background: #fef3c7;
      border: 2px solid #f59e0b;
      padding: 16px;
      margin: 16px 0;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      max-height: 300px;
      overflow-y: auto;
    `;
    
    const hashInfo = apiData.map((doc, index) => 
      `📄 ${index + 1}. ${doc.originalName}\n   Hash: ${doc.originalHash || 'MISSING'}\n`
    ).join('\n');
    
    debugDiv.innerHTML = `
      <h3 style="margin: 0 0 8px 0; color: #92400e;">🐛 DEBUG: Document Hashes from API</h3>
      <pre style="margin: 0; white-space: pre-wrap;">${hashInfo}</pre>
      <button onclick="this.parentElement.remove()" style="margin-top: 8px; background: #f59e0b; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Close</button>
    `;
    
    // Remove any existing debug display
    const existingDebug = document.getElementById('hash-debug-display');
    if (existingDebug) {
      existingDebug.remove();
    }
    
    // Insert at the top of the documents container
    documentsContainer.parentElement?.insertBefore(debugDiv, documentsContainer);
    
    console.log('✅ Added visual debug display to page');
  } else {
    console.log('❌ Could not find documents container or no API data');
  }
}

// 4. Check what the React app is actually receiving
function analyzeReactState() {
  console.log('\n⚛️ Analyzing React application state...');
  
  // Try to find React fiber nodes (this is hacky but useful for debugging)
  const reactElements = document.querySelectorAll('[data-reactroot], [id="root"] > div');
  
  if (reactElements.length > 0) {
    console.log('✅ Found React elements');
    
    // Look for any elements that might contain document data
    const possibleDocElements = document.querySelectorAll('.border.rounded-lg, [class*="document"], [class*="hash"]');
    console.log(`🔍 Found ${possibleDocElements.length} possible document elements`);
    
    // Check for any text that looks like a hash
    const allText = document.body.innerText;
    const hashMatches = allText.match(/[a-f0-9]{64}/g);
    console.log('🔐 Hash-like strings found on page:', hashMatches?.length || 0);
    if (hashMatches) {
      hashMatches.forEach((hash, index) => {
        console.log(`  ${index + 1}. ${hash.slice(0, 16)}...`);
      });
    }
  }
}

// 5. Run all tests
async function runAllTests() {
  console.log('\n🚀 Running complete diagnostic...\n');
  
  const apiData = await testDirectApiCall();
  analyzeReactState();
  
  if (apiData) {
    forceUpdateDocumentsDisplay(apiData);
    
    console.log('\n✅ Diagnostic complete!');
    console.log('📋 Summary:');
    console.log(`  - Token: ${token ? 'Present' : 'Missing'}`);
    console.log(`  - API Response: ${apiData.length} documents`);
    console.log(`  - Hashes available: ${apiData.filter(d => d.originalHash).length}`);
    console.log('  - Debug display added to page');
    
    return apiData;
  } else {
    console.log('\n❌ Diagnostic failed - API call unsuccessful');
    return null;
  }
}

// Auto-run the diagnostic
runAllTests().then(result => {
  if (result) {
    console.log('\n💡 If hashes still don\'t show in the UI:');
    console.log('1. Check the React Developer Tools');
    console.log('2. Look for errors in the Network tab');
    console.log('3. The debug display above shows the actual API data');
  }
});

// Make functions available globally for manual testing
window.debugDocuments = {
  testApi: testDirectApiCall,
  analyzeState: analyzeReactState,
  runAll: runAllTests
};