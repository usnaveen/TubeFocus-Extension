// Test script for local dev container connectivity
// Run this in the browser console to test if the local dev container is accessible

const LOCAL_API_URL = 'http://localhost:8080';
const API_KEY = 'changeme';

console.log('🧪 Testing local dev container connectivity...');
console.log('📍 API URL:', LOCAL_API_URL);

// Test health endpoint
async function testHealth() {
  try {
    console.log('🔍 Testing /health endpoint...');
    const response = await fetch(`${LOCAL_API_URL}/health`);
    if (response.ok) {
      const text = await response.text();
      console.log('✅ Health check passed:', text);
      return true;
    } else {
      console.log('❌ Health check failed:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    console.log('💡 Make sure the dev container is running on localhost:8080');
    return false;
  }
}

// Test simple scoring endpoint
async function testSimpleScoring() {
  try {
    console.log('🔍 Testing /score/simple endpoint...');
    const response = await fetch(`${LOCAL_API_URL}/score/simple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      },
      body: JSON.stringify({
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        goal: 'Learn about productivity',
        mode: 'title_and_description'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Simple scoring test passed:', data);
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ Simple scoring test failed:', response.status, response.statusText);
      console.log('Error details:', errorText);
      return false;
    }
  } catch (error) {
    console.log('❌ Simple scoring test error:', error.message);
    return false;
  }
}

// Test detailed scoring endpoint
async function testDetailedScoring() {
  try {
    console.log('🔍 Testing /score/detailed endpoint...');
    const response = await fetch(`${LOCAL_API_URL}/score/detailed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      },
      body: JSON.stringify({
        video_id: 'dQw4w9WgXcQ',
        goal: 'Learn about productivity',
        parameters: ['title', 'description']
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Detailed scoring test passed:', data);
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ Detailed scoring test failed:', response.status, response.statusText);
      console.log('Error details:', errorText);
      return false;
    }
  } catch (error) {
    console.log('❌ Detailed scoring test error:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Starting local dev container tests...\n');
  
  const healthResult = await testHealth();
  if (!healthResult) {
    console.log('\n❌ Health check failed. Dev container may not be running.');
    console.log('💡 Start the dev container with: python api.py');
    return;
  }
  
  console.log('\n📊 Running scoring tests...\n');
  
  const simpleResult = await testSimpleScoring();
  const detailedResult = await testDetailedScoring();
  
  console.log('\n📋 Test Results:');
  console.log('Health Check:', healthResult ? '✅ PASS' : '❌ FAIL');
  console.log('Simple Scoring:', simpleResult ? '✅ PASS' : '❌ FAIL');
  console.log('Detailed Scoring:', detailedResult ? '✅ PASS' : '❌ FAIL');
  
  if (healthResult && simpleResult && detailedResult) {
    console.log('\n🎉 All tests passed! Local dev container is working correctly.');
    console.log('💡 You can now test the extension with local API endpoints.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the dev container logs for details.');
  }
}

// Export for use in console
window.testLocalDev = {
  testHealth,
  testSimpleScoring,
  testDetailedScoring,
  runAllTests
};

console.log('💡 Run testLocalDev.runAllTests() to test all endpoints');
console.log('💡 Or run individual tests: testLocalDev.testHealth()');
