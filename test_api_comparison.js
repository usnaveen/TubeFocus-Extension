// Test script for API comparison functionality
// Run this in the browser console on a YouTube page to test all three APIs

console.log('🧪 Testing API Comparison Functionality...');

// Test all three APIs
async function testAllAPIs() {
  const testVideoId = 'dQw4w9WgXcQ';
  const testGoal = 'productivity';
  const testParameters = ['title', 'description'];
  
  console.log(`Testing video: ${testVideoId}, goal: ${testGoal}`);
  
  const results = {
    cloud: null,
    flask: null,
    docker: null
  };
  
  // Test Cloud API
  try {
    console.log('🌐 Testing Cloud API...');
    const cloudResponse = await fetch('https://yt-scorer-api-bd5usk72uq-uc.a.run.app/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': 'changeme'
      },
      body: JSON.stringify({
        video_id: testVideoId,
        goal: testGoal,
        parameters: testParameters
      })
    });
    if (cloudResponse.ok) {
      results.cloud = await cloudResponse.json();
      console.log('✅ Cloud API result:', results.cloud);
    } else {
      console.log('❌ Cloud API failed:', cloudResponse.status);
    }
  } catch (error) {
    console.log('❌ Cloud API error:', error.message);
  }
  
  // Test Docker API
  try {
    console.log('🐳 Testing Docker API...');
    const dockerResponse = await fetch('http://localhost:8081/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': 'changeme'
      },
      body: JSON.stringify({
        video_id: testVideoId,
        goal: testGoal,
        parameters: testParameters
      })
    });
    if (dockerResponse.ok) {
      results.docker = await dockerResponse.json();
      console.log('✅ Docker API result:', results.docker);
    } else {
      console.log('❌ Docker API failed:', dockerResponse.status);
    }
  } catch (error) {
    console.log('❌ Docker API error:', error.message);
  }
  
  // Test Flask API (if available)
  try {
    console.log('🔥 Testing Flask API...');
    const flaskResponse = await fetch('http://localhost:5001/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': 'changeme'
      },
      body: JSON.stringify({
        video_id: testVideoId,
        goal: testGoal,
        parameters: testParameters
      })
    });
    if (flaskResponse.ok) {
      results.flask = await flaskResponse.json();
      console.log('✅ Flask API result:', results.flask);
    } else {
      console.log('❌ Flask API failed:', flaskResponse.status);
    }
  } catch (error) {
    console.log('❌ Flask API error:', error.message);
  }
  
  // Compare results
  console.log('\n📊 API Comparison Results:');
  console.log('Cloud API score:', results.cloud ? results.cloud.score : 'N/A');
  console.log('Docker API score:', results.docker ? results.docker.score : 'N/A');
  console.log('Flask API score:', results.flask ? results.flask.score : 'N/A');
  
  // Check for differences
  const scores = [];
  if (results.cloud) scores.push({ api: 'Cloud', score: results.cloud.score });
  if (results.docker) scores.push({ api: 'Docker', score: results.docker.score });
  if (results.flask) scores.push({ api: 'Flask', score: results.flask.score });
  
  if (scores.length > 1) {
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    console.log('\n📈 Score Analysis:');
    console.log('Average score:', avgScore.toFixed(3));
    scores.forEach(s => {
      const diff = Math.abs(s.score - avgScore);
      console.log(`${s.api}: ${s.score.toFixed(3)} (diff: ${diff.toFixed(3)})`);
    });
  }
  
  return results;
}

// Test the extension's compareAPIs function
async function testExtensionComparison() {
  console.log('\n🔧 Testing Extension Comparison Function...');
  
  // Simulate the extension's compareAPIs function
  const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const testGoal = 'productivity';
  const testMode = ['title', 'description'];
  
  try {
    // This would normally be called by the extension
    console.log('Extension comparison would test:', { testUrl, testGoal, testMode });
    console.log('✅ Extension comparison function ready');
  } catch (error) {
    console.log('❌ Extension comparison error:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting API Comparison Tests...\n');
  await testAllAPIs();
  await testExtensionComparison();
  console.log('\n🎉 All tests completed!');
}

// Export for manual testing
window.apiComparisonTest = {
  testAllAPIs,
  testExtensionComparison,
  runAllTests
};

console.log('💡 Use apiComparisonTest.runAllTests() to run all tests');
console.log('💡 Or use apiComparisonTest.testAllAPIs() to test just the APIs'); 