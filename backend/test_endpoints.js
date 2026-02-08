const http = require('http');

// Script to simulate how the frontend might check token balances
// Since we can't get a valid JWT without logging in with password,
// we'll just make sure the endpoints are responding properly

function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = { statusCode: res.statusCode, headers: res.headers, data: JSON.parse(data) };
                    resolve(response);
                } catch (e) {
                    resolve({ statusCode: res.statusCode, headers: res.headers, data: data });
                }
            });
        });
        
        req.on('error', reject);
        req.end();
    });
}

async function testEndpoints() {
    try {
        console.log('Testing backend endpoints...\n');
        
        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const healthOptions = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/v1/health',
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        };
        
        const healthResponse = await makeRequest(healthOptions);
        console.log('✅ Health check:', healthResponse.data.status);
        
        // Test models endpoint (doesn't require auth)
        console.log('\n2. Testing models endpoint...');
        const modelsOptions = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/v1/models',
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        };
        
        const modelsResponse = await makeRequest(modelsOptions);
        console.log('✅ Available models:', Array.isArray(modelsResponse.data.models) ? modelsResponse.data.models.length : 'unknown');
        if (Array.isArray(modelsResponse.data.models)) {
            modelsResponse.data.models.forEach(model => {
                console.log(`   - ${model.id}: ${model.name} (${model.available ? 'available' : 'unavailable'})`);
            });
        }
        
        // Test user-status endpoint (requires auth - will return 401)
        console.log('\n3. Testing user-status endpoint (expected to return 401)...');
        const userStatusOptions = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/v1/user-status',
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        };
        
        const userStatusResponse = await makeRequest(userStatusOptions);
        if (userStatusResponse.statusCode === 401) {
            console.log('✅ User-status endpoint working (401 Unauthorized as expected without JWT)');
        } else {
            console.log('❌ Unexpected response from user-status:', userStatusResponse.statusCode);
        }
        
        console.log('\nBackend server is running and accessible.');
        console.log('\nNote: To properly test token balances, you need to:');
        console.log('1. Log in to the application with your email and password');
        console.log('2. The frontend will then call /api/v1/user-status or /api/v1/auth/me with your JWT token');
        console.log('3. This will return your token balances if authentication succeeds');
        
    } catch (error) {
        console.log('❌ Error testing endpoints:', error.message);
        console.log('Make sure the backend server is running on http://localhost:5000');
    }
}

testEndpoints();