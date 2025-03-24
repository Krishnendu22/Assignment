const axios = require('axios');
const fs = require('fs').promises;
const alphabet = 'abcdefghijklmnopqrstuvwxyz';

// Configuration
const BASE_URL = 'http://35.200.185.69:8000/v1/autocomplete';
const MAX_REQUESTS_PER_MINUTE = 85;
const NAMES_OUTPUT_FILE = 'v1_names.txt';
const SLEEP_TIME = 100;

// Tracking variables
const uniqueNames = new Set();
let requestCount = 0;
let requestsInCurrentMinute = 0;
let minuteStartTime = Date.now();

// Helper functions
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  await fs.appendFile('v1_log.txt', `[${timestamp}] ${message}\n`)
    .catch(err => console.error('Error writing to log file:', err));
}

// Rate limit management
async function respectRateLimit() {
  const currentTime = Date.now();
  const elapsedTime = currentTime - minuteStartTime;
  
  if (elapsedTime >= 60000) {
    requestsInCurrentMinute = 0;
    minuteStartTime = currentTime;
  }
  
  if (requestsInCurrentMinute >= MAX_REQUESTS_PER_MINUTE) {
    const waitTime = 60000 - elapsedTime + 100;
    await log(`Rate limit approaching. Waiting ${waitTime}ms...`);
    await sleep(waitTime);
    requestsInCurrentMinute = 0;
    minuteStartTime = Date.now();
  }
  
  requestsInCurrentMinute++;
}

// Fetch autocomplete results
async function makeRequest(query) {
  await respectRateLimit();
  requestCount++;
  
  try {
    const response = await axios.get(BASE_URL, { params: { query }, timeout: 5000 });
    return response.data.results || [];
  } catch (error) {
    await log(`Request error: ${error.message}`);
    return [];
  }
}

// Recursive exploration based on efficient Python approach
async function explorePrefix(prefix, depth = 1) {
  await log(`Exploring prefix: ${prefix} (depth ${depth})`);
  const results = await makeRequest(prefix);
  
  for (const name of results) {
    if (!uniqueNames.has(name)) {
      uniqueNames.add(name);
      await log(`Discovered new name: ${name}`);
    }
  }
  
  if (results.length === 10 && depth < 3) {
    for (const char of alphabet) {
      await explorePrefix(prefix + char, depth + 1);
    }
  }
  
  await saveNamesToTextFile();
  await sleep(SLEEP_TIME);
}

// Save extracted names to a text file
async function saveNamesToTextFile() {
  const sortedNames = Array.from(uniqueNames).sort();
  await fs.writeFile(NAMES_OUTPUT_FILE, sortedNames.join('\n'));
}

// Main extraction function
async function extractNames() {
  await log('Starting V1 name extraction...');
  
  for (const first of alphabet) {
    for (const second of alphabet) {
      await explorePrefix(first + second);
    }
  }
  
  await log(`V1 extraction complete! Found ${uniqueNames.size} names.`);
  return { names: Array.from(uniqueNames), requests: requestCount };
}

// Run extraction
if (require.main === module) {
  (async () => {
    try {
      await fs.writeFile('v1_log.txt', `=== V1 Extraction Started at ${new Date().toISOString()} ===\n`);
      process.on('SIGINT', async () => {
        await log('Received interrupt signal. Saving progress before exit...');
        await saveNamesToTextFile();
        process.exit(0);
      });
      
      const result = await extractNames();
      console.log(`\nV1 FORM SUBMISSION:
No. of searches made for v1: ${result.requests}
No. of results in v1: ${result.names.length}`);
      
    } catch (error) {
      await log(`Fatal error: ${error.message}`);
      await saveNamesToTextFile();
    }
  })();
}

module.exports = { extractNames };