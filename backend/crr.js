// merge.js
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// Only include these extensions
const ALLOWED_EXT = new Set(['.js', '.html', '.env', '.css','.ts','.tsx',]);
// Directory names to ignore
const IGNORE_DIR = new Set(['node_modules','.next','public']);

async function collectFiles(dir, ignoreFiles) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (let entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIR.has(entry.name)) continue;
      results = results.concat(await collectFiles(fullPath, ignoreFiles));

    } else {
      const ext = path.extname(entry.name).toLowerCase();
      // skip unwanted extensions or explicitly ignored filenames
      if (ALLOWED_EXT.has(ext) && !ignoreFiles.has(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

(async () => {
  try {
    // Ask the user whether to ignore specific filenames
    const ans = (await askQuestion('Ignore file names? (y/n): '))
      .trim()
      .toLowerCase();

    // Build a set of filenames to ignore
    let ignoreFiles = new Set();
    if (ans === 'y' || ans === 'yes') {
      const list = await askQuestion(
        'Enter file names to ignore, separated by commas (e.g. dhkm.js, djksm.js): '
      );
      list
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0)
        .forEach(name => ignoreFiles.add(name));
      console.log(`Ignoring files: ${[...ignoreFiles].join(', ')}`);
    }

    // Determine base directory
    const baseDir = process.argv[2]
      ? path.resolve(process.argv[2])
      : __dirname;
    console.log(`Scanning folder: ${baseDir}`);

    // Collect and filter files
    const files = await collectFiles(baseDir, ignoreFiles);

    if (files.length === 0) {
      console.log('No files to merge.');
      process.exit(0);
    }

    // Read and merge contents
    let merged = '';
    for (let filePath of files) {
      const content = await fs.readFile(filePath, 'utf8');
      const rel = path
        .relative(baseDir, filePath)
        .split(path.sep)
        .join('/');
      merged += `${rel}\n${content}\n\n`;
    }

    // Write out merged.txt
    const outPath = path.join(baseDir, 'merged.txt');
    await fs.writeFile(outPath, merged, 'utf8');
    console.log(`✅ Merged ${files.length} files into ${outPath}`);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
