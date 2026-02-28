const fs = require('fs');

// === SHORTENING MAPS ===

// Animation names: original → short
const animMap = {
  'modal-reveal-in': 'mri',
  'vt-name-flicker': 'vnf',
  'vt-name-mask': 'vnm',
  'blurb-ticker-left': 'btl',
  'blurb-ticker-right': 'btr',
  'blurb-drift-a': 'bda',
  'blurb-drift-b': 'bdb',
  'blurb-drift-c': 'bdc',
  'blurb-drift-d': 'bdd',
  'glitch-tear-down': 'gtd',
  'glitch-rgb-a': 'gra',
  'glitch-rgb-b': 'grb',
  'glitch-skew-a': 'gka',
  'glitch-skew-b': 'gkb',
  'glitch-slice-r': 'gsr',
  'glitch-slice-l': 'gsl',
  'glitch-slice-s': 'gss',
  'glitch-blocks-c': 'gbc',
  'glitch-blocks-d': 'gbd',
};

// CSS variable names: original → short (without --)
const varMap = {
  'chamfer-shape': 'cs',
  'chamfer-lg': 'cl',
  'chamfer-md': 'cmd',
  'chamfer-sm': 'cm',
  'chamfer': 'cf',       // must come AFTER chamfer-shape/lg/md/sm
  'card-border': 'cb',
  'card': 'cd',           // must come AFTER card-border
  'border-w': 'bw',
  'avatar-size': 'avs',
  'avatar-border': 'avb',
  'avatar-offset': 'avo',
  'ink-muted': 'im',
  'ink': 'ik',             // must come AFTER ink-muted
  'accent-2': 'a2',
  'accent': 'ac',          // must come AFTER accent-2
  'glow': 'gl',
  'hex': 'hx',
  'static-image': 'si',
  'static-size': 'sz',
  'si-header-h': 'sh',
};

// === HELPERS ===

// Remove a @keyframes block by name (handles nested braces in minified CSS)
function removeKeyframes(cssStr, name) {
  const marker = '@keyframes ' + name + '{';
  const start = cssStr.indexOf(marker);
  if (start === -1) return cssStr;
  let depth = 1;
  let i = start + marker.length;
  while (i < cssStr.length && depth > 0) {
    if (cssStr[i] === '{') depth++;
    else if (cssStr[i] === '}') depth--;
    i++;
  }
  return cssStr.slice(0, start) + cssStr.slice(i);
}

// === @PROPERTY ANIMATION APPROACH ===
// Instead of animating transforms directly on HTML elements (which restart when
// React re-renders the blurb), we animate CSS custom properties on the STABLE
// parent (.card-body) and the HTML elements just inherit the current value via
// transform:translateX(var(--dN)). When React destroys/recreates the HTML elements,
// they immediately pick up the parent's current animated property value — no restart.

// 9 @property declarations (2 tickers + 7 diamonds)
const propertyDecls = [
  "@property --tl{syntax:'<percentage>';inherits:true;initial-value:0%}",
  "@property --tr{syntax:'<percentage>';inherits:true;initial-value:-50%}",
  "@property --d1{syntax:'<length>';inherits:true;initial-value:0px}",
  "@property --d2{syntax:'<length>';inherits:true;initial-value:0px}",
  "@property --d3{syntax:'<length>';inherits:true;initial-value:0px}",
  "@property --d4{syntax:'<length>';inherits:true;initial-value:0px}",
  "@property --d5{syntax:'<length>';inherits:true;initial-value:0px}",
  "@property --d6{syntax:'<length>';inherits:true;initial-value:0px}",
  "@property --d7{syntax:'<length>';inherits:true;initial-value:0px}",
].join('');

// New keyframes that animate custom properties instead of transform
const newKeyframes = [
  // Tickers
  "@keyframes tl{from{--tl:0%}to{--tl:-50%}}",
  "@keyframes tr{from{--tr:-50%}to{--tr:0%}}",
  // d1: pattern A (◇ 7.5s alternate)
  "@keyframes d1{0%{--d1:-110px}18%{--d1:-25px}32%{--d1:-45px}55%{--d1:20px}72%{--d1:65px}86%{--d1:40px}100%{--d1:110px}}",
  // d2: pattern B (◇ 5.5s alternate-reverse)
  "@keyframes d2{0%{--d2:-55px}22%{--d2:-5px}38%{--d2:-28px}58%{--d2:18px}78%{--d2:45px}100%{--d2:55px}}",
  // d3: pattern C (◇ 10s alternate)
  "@keyframes d3{0%{--d3:-85px}28%{--d3:-55px}48%{--d3:8px}65%{--d3:-10px}82%{--d3:50px}100%{--d3:85px}}",
  // d4: pattern D (◇ 7s alternate-reverse)
  "@keyframes d4{0%{--d4:-40px}20%{--d4:10px}42%{--d4:-18px}68%{--d4:28px}85%{--d4:12px}100%{--d4:40px}}",
  // d5: pattern A (◆ 9s alternate-reverse)
  "@keyframes d5{0%{--d5:-110px}18%{--d5:-25px}32%{--d5:-45px}55%{--d5:20px}72%{--d5:65px}86%{--d5:40px}100%{--d5:110px}}",
  // d6: pattern C (◆ 6s alternate)
  "@keyframes d6{0%{--d6:-85px}28%{--d6:-55px}48%{--d6:8px}65%{--d6:-10px}82%{--d6:50px}100%{--d6:85px}}",
  // d7: pattern B (◆ 11s alternate)
  "@keyframes d7{0%{--d7:-55px}22%{--d7:-5px}38%{--d7:-28px}58%{--d7:18px}78%{--d7:45px}100%{--d7:55px}}",
].join('');

// Animation shorthand on the stable parent — drives ALL custom properties
// Each line corresponds to: ticker-left, ticker-right, then diamonds 1-7
// with their original durations, delays, easing, and directions preserved
// Non-modal view: drive --tl and --tr for the .rev marquee scrolls
// (slower speed ~50s to match original marquee scrollamount="2")
const cardBodyAnimBase = '.card:has(.profile-custom-html)>.card-body{'
  + 'animation:tl 50s linear infinite,tr 50s linear infinite}';

// Modal view: higher specificity overrides animation — drives tickers (faster)
// + all 7 diamond drift properties
const cardBodyAnimModal = '.container:has(~ .modal-overlay) .profile-right .card:has(.blurb-content)>.card-body{'
  + 'animation:'
  + 'tl 32s linear infinite,'
  + 'tr 40s linear infinite,'
  + 'd1 7.5s ease-in-out -2s infinite alternate,'
  + 'd2 5.5s ease-in-out -3s infinite alternate-reverse,'
  + 'd3 10s ease-in-out -6s infinite alternate,'
  + 'd4 7s ease-in-out -1s infinite alternate-reverse,'
  + 'd5 9s ease-in-out -5s infinite alternate-reverse,'
  + 'd6 6s ease-in-out -3s infinite alternate,'
  + 'd7 11s ease-in-out -7s infinite alternate}';

// === PROCESS CSS ===
let css = fs.readFileSync('./wired-new/custom.css', 'utf8');
const originalLen = css.length;

// Step 1: Shorten animation names (longest first to avoid partial matches)
const animKeys = Object.keys(animMap).sort((a, b) => b.length - a.length);
for (const old of animKeys) {
  css = css.split(old).join(animMap[old]);
}

// Step 2: Shorten CSS variable names (longest first)
const varKeys = Object.keys(varMap).sort((a, b) => b.length - a.length);
for (const old of varKeys) {
  css = css.split('--' + old).join('--' + varMap[old]);
}

// Step 3: Remove old drift + ticker keyframes (replaced by @property approach)
for (const name of ['bda', 'bdb', 'bdc', 'bdd', 'btl', 'btr']) {
  css = removeKeyframes(css, name);
}

// Step 4: Prepend @property declarations
css = propertyDecls + css;

// Step 5: Insert card-body animation rules before @media
const mediaIdx = css.indexOf('@media');
css = css.slice(0, mediaIdx) + cardBodyAnimBase + cardBodyAnimModal + css.slice(mediaIdx);

// Step 6: Append new keyframes at end
css += newKeyframes;

fs.writeFileSync('./wired-new/custom-v3.css', css);

// === PROCESS HTML ===
// Use the ORIGINAL html — tickers and diamonds stay in their original positions.
// Instead of animation: on each element, they use transform:translateX(var(--dN))
// to inherit the animated value from the stable parent.
let html = fs.readFileSync('./wired-new/custom.html', 'utf8');

// Replace diamond animation inline styles with CSS variable references
// Each diamond has a unique animation string → maps to a unique --dN variable
const diamondReplacements = [
  ['animation:blurb-drift-a 7.5s ease-in-out -2s infinite alternate', 'transform:translateX(var(--d1))'],
  ['animation:blurb-drift-b 5.5s ease-in-out -3s infinite alternate-reverse', 'transform:translateX(var(--d2))'],
  ['animation:blurb-drift-c 10s ease-in-out -6s infinite alternate', 'transform:translateX(var(--d3))'],
  ['animation:blurb-drift-d 7s ease-in-out -1s infinite alternate-reverse', 'transform:translateX(var(--d4))'],
  ['animation:blurb-drift-a 9s ease-in-out -5s infinite alternate-reverse', 'transform:translateX(var(--d5))'],
  ['animation:blurb-drift-c 6s ease-in-out -3s infinite alternate', 'transform:translateX(var(--d6))'],
  ['animation:blurb-drift-b 11s ease-in-out -7s infinite alternate', 'transform:translateX(var(--d7))'],
];
for (const [from, to] of diamondReplacements) {
  html = html.split(from).join(to);
}

// Replace ticker animation inline styles with CSS variable references
html = html.split('animation:blurb-ticker-left 32s linear infinite').join('transform:translateX(var(--tl))');
html = html.split('animation:blurb-ticker-right 40s linear infinite').join('transform:translateX(var(--tr))');

// Replace <marquee> elements with div+span using same --tl/--tr variables
// The marquees in .rev use the same scroll pattern as tickers, just at different speed
// (speed is controlled by the non-modal card-body animation rule at 50s)
const marqueeStyle = 'flex:1;overflow:hidden;-webkit-mask-image:linear-gradient(to right,transparent,white 15%,white 85%,transparent);mask-image:linear-gradient(to right,transparent,white 15%,white 85%,transparent)';
html = html.split('<marquee direction="left" scrollamount="2" style="' + marqueeStyle + ';">')
  .join('<div style="' + marqueeStyle + ';"><span style="display:inline-block;white-space:nowrap;transform:translateX(var(--tl));">');
html = html.split('<marquee direction="right" scrollamount="2" style="' + marqueeStyle + ';">')
  .join('<div style="' + marqueeStyle + ';"><span style="display:inline-block;white-space:nowrap;transform:translateX(var(--tr));">');
html = html.split('</marquee>').join('</span></div>');

fs.writeFileSync('./wired-new/custom-v3.html', html);

// === REPORT ===
const newCssLen = css.length;
const newHtmlLen = html.length;
const propDeclLen = propertyDecls.length;
const newKfLen = newKeyframes.length;
const animRuleLen = cardBodyAnimBase.length + cardBodyAnimModal.length;
console.log('=== CSS ===');
console.log(`  Original:       ${originalLen} chars`);
console.log(`  After shorten:  (saved ${originalLen - css.length + propDeclLen + newKfLen + animRuleLen} from names)`);
console.log(`  @property decls: +${propDeclLen} chars`);
console.log(`  New keyframes:  +${newKfLen} chars`);
console.log(`  Card-body anim: +${animRuleLen} chars`);
console.log(`  Final:          ${newCssLen} chars`);
console.log(`  Budget:         ${50000 - newCssLen} remaining`);
console.log('');
console.log('=== HTML ===');
console.log(`  Original: ${fs.readFileSync('./wired-new/custom.html','utf8').length} chars`);
console.log(`  New:      ${newHtmlLen} chars`);
console.log(`  Budget:   ${50000 - newHtmlLen} remaining`);

// === GENERATE LEGEND ===
let legend = '# Shortening Legend\n\n';
legend += '## Animation Names\n| Original | Short |\n|----------|-------|\n';
for (const [orig, short] of Object.entries(animMap)) {
  legend += `| ${orig} | ${short} |\n`;
}
legend += '\n## CSS Variables\n| Original | Short |\n|----------|-------|\n';
for (const [orig, short] of Object.entries(varMap)) {
  legend += `| --${orig} | --${short} |\n`;
}
legend += '\n## @property Custom Properties\n| Property | Used By | Pattern |\n|----------|---------|----------|\n';
legend += '| --tl | Ticker left scroll | 0% → -50% |\n';
legend += '| --tr | Ticker right scroll | -50% → 0% |\n';
legend += '| --d1 | ◇ diamond 1 | drift-a (7.5s alt) |\n';
legend += '| --d2 | ◇ diamond 2 | drift-b (5.5s alt-rev) |\n';
legend += '| --d3 | ◇ diamond 3 | drift-c (10s alt) |\n';
legend += '| --d4 | ◇ diamond 4 | drift-d (7s alt-rev) |\n';
legend += '| --d5 | ◆ diamond 5 | drift-a (9s alt-rev) |\n';
legend += '| --d6 | ◆ diamond 6 | drift-c (6s alt) |\n';
legend += '| --d7 | ◆ diamond 7 | drift-b (11s alt) |\n';
fs.writeFileSync('./wired-new/shortening-legend.md', legend);
console.log('\n=== Files written ===');
console.log('  wired-new/custom-v3.css');
console.log('  wired-new/custom-v3.html');
console.log('  wired-new/shortening-legend.md');
