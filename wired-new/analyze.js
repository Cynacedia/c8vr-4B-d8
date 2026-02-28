const css = require('fs').readFileSync('./wired-new/custom.css','utf8');

// Find all animation names
const keyframeNames = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]);
console.log('=== @keyframes names ===');
keyframeNames.forEach(name => {
  const re = new RegExp(name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
  const count = (css.match(re) || []).length;
  console.log(`  ${name} (${name.length}ch, ${count}x, save ~${(name.length - 3) * count} if 3ch)`);
});

// Find long repeated patterns
console.log('\n=== Repeated long patterns ===');
const patterns = [
  '.container:has(~ .modal-overlay)',
  '.profile-right',
  '.profile-left',
  '.profile-custom-html',
  '.profile-main-card',
  '.profile-contact-links',
  '.blurb-content',
  '.blurb-section',
  '.card-header',
  '.card-body',
  '.friends-grid',
  '.friend-item',
  '-webkit-clip-path',
  'clip-path',
  'var(--chamfer-shape)',
  'var(--hex)',
  'drop-shadow',
  'backdrop-filter',
  '-webkit-backdrop-filter',
  'rgba(255,255,255,',
  'rgba(0,0,0,',
];
patterns.forEach(p => {
  const re = new RegExp(p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
  const count = (css.match(re) || []).length;
  if (count > 1) console.log(`  "${p}" (${p.length}ch x ${count} = ${p.length * count})`);
});

// CSS variable names
const varMatches = [...css.matchAll(/--([a-z][\w-]*)/g)];
const varCounts = {};
varMatches.forEach(m => { varCounts[m[1]] = (varCounts[m[1]] || 0) + 1; });
console.log('\n=== CSS variables ===');
Object.entries(varCounts)
  .sort((a, b) => (b[0].length * b[1]) - (a[0].length * a[1]))
  .forEach(([name, count]) => {
    console.log(`  --${name} (${name.length}ch, ${count}x)`);
  });

// Class names in selectors that could be shortened
console.log('\n=== Total file size ===');
console.log(`  ${css.length} chars`);
console.log(`  Budget remaining: ${50000 - css.length}`);
