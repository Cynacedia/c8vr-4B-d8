/**
 * Minify custom.css and custom.html from the profile folder.
 *
 * Usage:
 *   node .tools/minify.js          — from the profile folder
 *   node minify.js                 — from inside .tools/
 *
 * Reads:  ../custom.css, ../custom.html
 * Writes: ../custom.min.css, ../custom.min.html
 *
 * Reports char counts and budget remaining (50,000 each).
 */

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..'); // profile folder (parent of .tools)
const BUDGET = 50000;

// ============================================================
// CSS MINIFICATION
// ============================================================

function minifyCSS(css) {
   // Remove /* ... */ comments
   css = css.replace(/\/\*[\s\S]*?\*\//g, '');

   // Collapse all whitespace (newlines, tabs, multiple spaces) to single space
   css = css.replace(/\s+/g, ' ');

   // Remove spaces around CSS punctuation
   css = css.replace(/\s*([{}:;,>~+])\s*/g, '$1');

   // Remove trailing semicolons before closing brace
   css = css.replace(/;}/g, '}');

   // Remove leading/trailing whitespace
   css = css.trim();

   return css;
}

// ============================================================
// HTML MINIFICATION
// ============================================================

function minifyHTML(html) {
   // Remove HTML comments (but keep conditional comments <!--[if)
   html = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');

   // Collapse whitespace between tags
   html = html.replace(/>\s+</g, '><');

   // Collapse remaining runs of whitespace to single space
   html = html.replace(/\s+/g, ' ');

   // Trim
   html = html.trim();

   return html;
}

// ============================================================
// RUN
// ============================================================

const cssPath = path.join(DIR, 'custom.css');
const htmlPath = path.join(DIR, 'custom.html');
const cssOutPath = path.join(DIR, 'custom.min.css');
const htmlOutPath = path.join(DIR, 'custom.min.html');

let anyWork = false;

if (fs.existsSync(cssPath)) {
   const raw = fs.readFileSync(cssPath, 'utf8');
   if (raw.trim().length > 0) {
      const min = minifyCSS(raw);
      fs.writeFileSync(cssOutPath, min, 'utf8');
      const saved = raw.length - min.length;
      console.log('=== CSS ===');
      console.log(`  Source:    ${raw.length} chars`);
      console.log(`  Minified:  ${min.length} chars (saved ${saved})`);
      console.log(`  Budget:    ${BUDGET - min.length} remaining`);
      anyWork = true;
   } else {
      console.log('=== CSS ===  (empty, skipped)');
   }
}

if (fs.existsSync(htmlPath)) {
   const raw = fs.readFileSync(htmlPath, 'utf8');
   if (raw.trim().length > 0) {
      const min = minifyHTML(raw);
      fs.writeFileSync(htmlOutPath, min, 'utf8');
      const saved = raw.length - min.length;
      console.log('=== HTML ===');
      console.log(`  Source:    ${raw.length} chars`);
      console.log(`  Minified:  ${min.length} chars (saved ${saved})`);
      console.log(`  Budget:    ${BUDGET - min.length} remaining`);
      anyWork = true;
   } else {
      console.log('=== HTML === (empty, skipped)');
   }
}

if (!anyWork) {
   console.log('Nothing to minify. Place custom.css and/or custom.html in the profile folder.');
}
