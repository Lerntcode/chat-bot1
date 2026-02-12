const axios = require('axios');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '.env') });

const apiKey = process.env.QWEN_API_KEY;

if (!apiKey) {
    fs.writeFileSync('models_error.log', 'No QWEN_API_KEY found in .env');
    process.exit(1);
}

async function listModels() {
    try {
        const response = await axios.get('https://api.studio.nebius.ai/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const models = response.data.data.map(m => m.id).sort();
        const output = `Status: ${response.status}\n\nAvailable Models:\n${models.join('\n')}`;
        fs.writeFileSync('available_models.txt', output);
        console.log('Successfully wrote models to available_models.txt');

    } catch (error) {
        const errorMsg = error.response
            ? `Status: ${error.response.status}\nData: ${JSON.stringify(error.response.data, null, 2)}`
            : error.message;

        fs.writeFileSync('models_error.log', errorMsg);
        console.error('Error fetching models. Check models_error.log');
    }
}

listModels();
