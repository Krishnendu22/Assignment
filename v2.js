const axios = require('axios');
const fs = require('fs').promises;

// Configuration
const BASE_URL = 'http://35.200.185.69:8000/v2/autocomplete';
const MAX_REQUESTS_PER_MINUTE = 85; // Adjusted for stability
const NAMES_OUTPUT_FILE = 'v2_names.txt';
const SLEEP_TIME = 100; // API rate limit delay in ms

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
  await fs.appendFile('v2_log.txt', `[${timestamp}] ${message}\n`)
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

// Fetch autocomplete results with retries
async function makeRequest(query, retries = 3) {
  await respectRateLimit();
  requestCount++;
  
  try {
    const response = await axios.get(BASE_URL, { params: { query }, timeout: 5000 });
    return response.data.results || [];
  } catch (error) {
    if (error.response && error.response.status === 429 && retries > 0) {
      await log(`Rate limit hit. Retrying after 60s...`);
      await sleep(60000);
      return makeRequest(query, retries - 1);
    }
    await log(`Request error: ${error.message}`);
    return [];
  }
}

// Recursive exploration of prefixes with optimization
async function explorePrefix(prefix, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return;
  await log(`Exploring prefix: ${prefix}`);
  const results = await makeRequest(prefix);
  
  for (const name of results) {
    if (!uniqueNames.has(name)) {
      uniqueNames.add(name);
      await log(`Discovered new name: ${name}`);
      
      if (name.startsWith(prefix)) {
        await explorePrefix(name, depth + 1, maxDepth);
      }
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
  await log('Starting V2 name extraction...');
  
  const startChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (const char of startChars) {
    await explorePrefix(char);
  }
  
  await log(`V2 extraction complete! Found ${uniqueNames.size} names.`);
  return { names: Array.from(uniqueNames), requests: requestCount };
}

// Run extraction
if (require.main === module) {
  (async () => {
    try {
      await fs.writeFile('v2_log.txt', `=== V2 Extraction Started at ${new Date().toISOString()} ===\n`);
      process.on('SIGINT', async () => {
        await log('Received interrupt signal. Saving progress before exit...');
        await saveNamesToTextFile();
        process.exit(0);
      });
      
      const result = await extractNames();
      console.log(`\nV2 FORM SUBMISSION:
No. of searches made for v2: ${result.requests}
No. of results in v2: ${result.names.length}`);
      
    } catch (error) {
      await log(`Fatal error: ${error.message}`);
      await saveNamesToTextFile();
    }
  })();
}

module.exports = { extractNames };