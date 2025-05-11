#!/usr/bin/env node

/**
 * mergeFiles.js
 *
 * Concatenates the contents of selected source files into a single file named
 * `codemerged.txt`, with each file's relative path written just above its
 * code.  Run the script from the monorepo root or pass the repo root as the
 * first argument:
 *
 *    node mergeFiles.js        # run from repo root
 *    node mergeFiles.js ../    # specify repo root explicitly
 */

const fs = require("fs");
const path = require("path");

// Base directory to resolve all relative paths (defaults to CWD)
const repoRoot = path.resolve(process.argv[2] || process.cwd());

//------------------------------------------------------------------------------
// List of files to merge — add or remove paths here as your project evolves
//------------------------------------------------------------------------------
const filesToMerge = [

'src/app.ts',
    'src/server.ts',
    'src/config/default.ts',
    'src/config/db.ts',
    'src/controllers/product.controller.ts',
    'src/controllers/admin.product.controller.ts',
    

    'src/models/product.model.ts',

    'src/modules/commerce/index.ts',
    'src/routes/product.routes.ts',
    'src/routes/finance.routes.ts',

    'src/services/product.service.ts',
    'src/services/notification.service.ts',
    'src/services/cron.service.ts',
    'src/services/init.service.ts',
    'src/utils/redis.ts',
    'src/utils/logger.ts',
];

const outputPath = path.join(repoRoot, "codemerged.txt");

//------------------------------------------------------------------------------
// Merge logic
//------------------------------------------------------------------------------
let output = "";
let processed = 0;

filesToMerge.forEach((relativePath) => {
  const absolutePath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(absolutePath)) {
    console.warn(`\u26A0\uFE0F  File not found: ${relativePath} — skipping`);
    return;
  }

  const fileContents = fs.readFileSync(absolutePath, "utf8");

  output += `${relativePath}\n`;
  output += `${fileContents}\n\n`;
  processed += 1;
});

fs.writeFileSync(outputPath, output);
console.log(`\u2705  Merged ${processed} files \u2192 ${outputPath}`);
