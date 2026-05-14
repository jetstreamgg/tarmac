#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runGenerate(attempt = 1) {
  console.log(`\n🔄 Attempt ${attempt}/${MAX_RETRIES}: Running wagmi generate...`);

  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['run', 'generate'], {
      cwd: path.resolve(__dirname),
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', data => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', data => {
      const text = data.toString();
      errorOutput += text;
      process.stderr.write(text);
    });

    child.on('close', code => {
      if (code === 0) {
        console.log('\n✅ Successfully generated wagmi hooks!');
        resolve(true);
      } else {
        // Check if it's a rate limit error
        const combinedOutput = output + errorOutput;
        if (combinedOutput.includes('rate limit') || combinedOutput.includes('Max calls per sec')) {
          if (attempt < MAX_RETRIES) {
            console.log(`\n⏳ Rate limit hit. Waiting ${RETRY_DELAY}ms before retry...`);
            reject({ rateLimited: true });
          } else {
            console.error('\n❌ Max retries reached. Generation failed.');
            reject({ rateLimited: false });
          }
        } else {
          console.error('\n❌ Generation failed with non-rate-limit error.');
          reject({ rateLimited: false });
        }
      }
    });

    child.on('error', error => {
      console.error('Failed to start process:', error);
      reject({ rateLimited: false });
    });
  });
}

async function main() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await runGenerate(attempt);
      process.exit(0);
    } catch (error) {
      if (error.rateLimited && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY);
        continue;
      } else {
        process.exit(1);
      }
    }
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
