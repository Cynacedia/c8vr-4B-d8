/**
 * Usage:
 *   1. Paste page source HTML between the markers at the bottom of this file
 *   2. Run: node update.js
 *
 * Also inlines ./custom.html into the blurb section if the file exists.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DIR = path.resolve(__dirname, '..'); // profile folder (parent of .tools)
const PROFILE_PATH = path.join(DIR, 'profile.html');
const CUSTOM_HTML_PATH = path.join(DIR, 'custom.html');
const IMAGES_DIR = path.join(DIR, 'images');

/* ============================================================
   PASTE PAGE SOURCE BELOW THIS LINE
   (Right-click page → View Page Source → Select All → Copy → Paste here)
   ============================================================ */

const SOURCE = `
PASTE_HERE
`;












function stripComments(s) {
   return s.replace(/<!--\s*-->/g, '').trim();
}

function extractText(html, classOrPattern) {
   const re = new RegExp(`class="${classOrPattern}"[^>]*>([\\s\\S]*?)</div>`, 'i');
   const m = html.match(re);
   return m ? stripComments(m[1]) : '';
}

function extractAttr(tag, attr) {
   const re = new RegExp(`${attr}="([^"]*)"`, 'i');
   const m = tag.match(re);
   return m ? m[1] : '';
}

function matchAll(str, re) {
   const results = [];
   let m;
   const regex = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
   while ((m = regex.exec(str)) !== null) {
      results.push(m);
   }
   return results;
}

function findCard(html, headerPattern) {
   const headerRe = /class="card-header[^"]*"[^>]*>/gi;
   let hm;
   while ((hm = headerRe.exec(html)) !== null) {
      const afterHeader = html.substring(hm.index, Math.min(hm.index + 500, html.length));
      const textContent = afterHeader.replace(/<[^>]+>/g, '').replace(/<!--\s*-->/g, '').trim();
      if (!new RegExp(headerPattern, 'i').test(textContent)) continue;
      let cardStart = -1;
      let searchIdx = hm.index;
      while (searchIdx > 0) {
         const pos = html.lastIndexOf('<div class="card', searchIdx);
         if (pos === -1) break;
         const charAfterCard = html.charAt(pos + 16);
         if (charAfterCard === '"' || charAfterCard === ' ') { cardStart = pos; break; }
         searchIdx = pos - 1;
      }
      if (cardStart === -1) continue;
      let depth = 0;
      let i = cardStart;
      while (i < html.length) {
         if (html.substr(i, 4) === '<div') {
            depth++;
            i += 4;
         } else if (html.substr(i, 6) === '</div>') {
            depth--;
            if (depth === 0) return html.substring(cardStart, i + 6);
            i += 6;
         } else {
            i++;
         }
      }
   }
   return null;
}

function urlToFilename(url) {
   const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 10);
   const pathname = new URL(url).pathname;
   const ext = path.extname(pathname).split('?')[0] || '.jpg';
   return hash + ext;
}
async function downloadImage(url) {
   const filename = urlToFilename(url);
   const localPath = path.join(IMAGES_DIR, filename);
   const relativePath = './images/' + filename;
   if (fs.existsSync(localPath)) return relativePath;

   try {
      const res = await fetch(url);
      if (!res.ok) {
         console.warn(`  WARN: ${res.status} fetching ${url.substring(0, 80)}`);
         return null;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(localPath, buffer);
      return relativePath;
   } catch (err) {
      console.warn(`  WARN: failed to download ${url.substring(0, 80)}: ${err.message}`);
      return null;
   }
}
async function downloadAllImages(data) {
   const urls = new Set();

   if (data.avatarUrl) urls.add(data.avatarUrl);
   for (const f of data.friends) { if (f.avatarUrl) urls.add(f.avatarUrl); }
   for (const a of data.albums) { if (a.coverUrl) urls.add(a.coverUrl); }
   for (const g of data.groups) { if (g.coverUrl) urls.add(g.coverUrl); }
   for (const c of data.comments) {
      if (c.avatarUrl) urls.add(c.avatarUrl);
      if (c.reply && c.reply.avatarUrl) urls.add(c.reply.avatarUrl);
   }
   if (data.backgroundImage) urls.add(data.backgroundImage);

   const httpUrls = [...urls].filter(u => /^https?:\/\//.test(u));
   if (httpUrls.length === 0) return {};

   if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

   console.log(`  Downloading ${httpUrls.length} images...`);
   const urlMap = {};
   for (let i = 0; i < httpUrls.length; i += 5) {
      const batch = httpUrls.slice(i, i + 5);
      const results = await Promise.all(batch.map(u => downloadImage(u)));
      batch.forEach((u, idx) => {
         if (results[idx]) urlMap[u] = results[idx];
      });
   }

   const downloaded = Object.keys(urlMap).length;
   console.log(`  Downloaded: ${downloaded}/${httpUrls.length} images`);
   return urlMap;
}
function localizeImages(html, urlMap) {
   for (const [url, localPath] of Object.entries(urlMap)) {
      html = html.split(url).join(localPath);
   }
   return html;
}

function extractProfileData(source) {
   const data = {};
   const themeMatch = source.match(/class="profile-page\s+profile-custom-css\s+(theme-\w+)/);
   data.theme = themeMatch ? themeMatch[1] : 'theme-dark';
   const dnMatch = source.match(/class="profile-display-name"[^>]*>([\s\S]*?)<\/div>/i);
   data.displayName = dnMatch ? stripComments(dnMatch[1]) : 'Username';
   const unMatch = source.match(/class="profile-username"[^>]*>([\s\S]*?)<\/div>/i);
   data.username = unMatch ? stripComments(unMatch[1]).replace(/^@/, '') : 'username';
   const tlMatch = source.match(/class="profile-tagline"[^>]*>([\s\S]*?)<\/div>/i);
   if (tlMatch) {
      let raw = stripComments(tlMatch[1]);
      data.tagline = raw.replace(/^[""\u201C]|[""\u201D]$/g, '').trim();
   } else {
      data.tagline = 'Headline';
   }

   const omMatch = source.match(/class="profile-oshi-mark"[^>]*>([\s\S]*?)<\/div>/i);
   data.oshiMark = omMatch ? stripComments(omMatch[1]) : 'X';
   const moodMatch = source.match(/class="mood-text"[^>]*>([\s\S]*?)<\/div>/i);
   data.mood = moodMatch ? stripComments(moodMatch[1]) : 'Mood';
   const avatarMatch = source.match(/class="user-avatar\s+profile-avatar"\s+src="([^"]+)"/i)
      || source.match(/class="user-avatar profile-avatar"[^>]*src="([^"]+)"/i);
   data.avatarUrl = avatarMatch ? avatarMatch[1] : '';
   const osMatch = source.match(/class="profile-online-status"[^>]*>([\s\S]*?)<\/div>/i);
   data.onlineStatus = osMatch ? stripComments(osMatch[1]) : 'Last online recently';
   const boopMatch = source.match(/class="profile-boop-stats"[^>]*>([\s\S]*?)<\/div>/i);
   if (boopMatch) {
      const boopNum = boopMatch[1].match(/(\d+)\s*boop/i);
      data.boopCount = boopNum ? boopNum[1] : '0';
      const viewerMatch = boopMatch[1].match(/booped\s+(\d+)x/i);
      data.viewerBoops = viewerMatch ? viewerMatch[1] : null;
   } else {
      data.boopCount = '0';
      data.viewerBoops = null;
   }
   const bgMatch = source.match(/class="profile-page[^"]*"[^>]*style="[^"]*background-image:\s*url\(([^)]+)\)/i);
   data.backgroundImage = bgMatch ? bgMatch[1] : null;
   const friendsCard = findCard(source, "Top 8");
   data.friends = [];
   if (friendsCard) {
      const friendItems = matchAll(friendsCard, /<a\s+class="friend-item"\s+href="([^"]+)">([\s\S]*?)<\/a>/gi);
      for (const fi of friendItems) {
         const href = fi[1];
         const inner = fi[2];
         const imgMatch = inner.match(/src="([^"]+)"/);
         const altMatch = inner.match(/alt="([^"]+)"/);
         const nameMatch = inner.match(/class="friend-name"[^>]*>([\s\S]*?)<\/span>/i);
         data.friends.push({
            href,
            avatarUrl: imgMatch ? imgMatch[1] : '',
            name: nameMatch ? stripComments(nameMatch[1]) : (altMatch ? altMatch[1] : ''),
            alt: altMatch ? altMatch[1] : '',
         });
      }
   }

   const photosCard = findCard(source, "Photos");
   data.albums = [];
   if (photosCard) {
      const albumLinks = matchAll(photosCard, /<a\s[^>]*href="([^"]*\/photos\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
      for (const al of albumLinks) {
         const inner = al[2];
         const bgUrl = inner.match(/background:\s*url\(["']?([^"')]+)["']?\)/i);
         const titleMatch = inner.match(/font-weight:\s*600[^>]*>([^<]+)/i);
         const countMatch = inner.match(/(\d+)\s*photos?/i);
         data.albums.push({
            href: al[1],
            coverUrl: bgUrl ? bgUrl[1] : '',
            title: titleMatch ? titleMatch[1].trim() : 'Album',
            count: countMatch ? countMatch[1] : '0',
         });
      }
   }

   const groupsCard = findCard(source, "Groups");
   data.groups = [];
   if (groupsCard) {
      const groupLinks = matchAll(groupsCard, /<a\s[^>]*href="(\/groups\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
      for (const gl of groupLinks) {
         if (gl[1].includes('/top')) continue;
         const inner = gl[2];
         const bgUrl = inner.match(/background:\s*url\(["']?([^"')]+)["']?\)/i);
         const nameMatch = inner.match(/font-weight:\s*600[^>]*>([^<]+)/i);
         const countMatch = inner.match(/(\d+)\s*members?/i);
         data.groups.push({
            href: gl[1],
            coverUrl: bgUrl ? bgUrl[1] : '',
            name: nameMatch ? nameMatch[1].trim() : 'Group',
            members: countMatch ? countMatch[1] : '0',
         });
      }
   }
   const collabCard = findCard(source, "Collab Schedule");
   data.collabGrid = [];
   data.collabTags = [];
   data.collabDescription = '';
   if (collabCard) {
      const days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
      const rows = matchAll(collabCard, /<tr>([\s\S]*?)<\/tr>/gi);
      const bodyRows = rows.filter(r => r[1].includes('<td'));
      for (const row of bodyRows) {
         const cells = matchAll(row[1], /<td[^>]*style="[^"]*background:\s*var\(([^)]+)\)[^"]*"[^>]*>/gi);
         const daySlots = cells.map(c => c[1].includes('--vs-blue') ? 1 : 0);
         if (daySlots.length > 0) data.collabGrid.push(daySlots);
      }
      const tagMatches = matchAll(collabCard, /border-radius:\s*3px[^>]*>([^<]+)</gi);
      data.collabTags = tagMatches.map(t => t[1].trim());
      const descMatch = collabCard.match(/data-lexical-text="true">([^<]+)/i);
      data.collabDescription = descMatch ? descMatch[1] : '';
   }
   const detailsCard = findCard(source, "Details");
   data.generation = '';
   data.genTitle = '';
   data.friendsCount = '0';
   data.commentsCount = '0';
   data.affiliation = 'Affiliation';
   if (detailsCard) {
      const genMatch = detailsCard.match(/Generation[\s\S]*?title="([^"]*)"[\s\S]*?Gen\s*(?:<!--\s*-->)?\s*(\d+)/i);
      if (genMatch) {
         data.genTitle = genMatch[1];
         data.generation = genMatch[2];
      }
      const fcMatch = detailsCard.match(/Friends[\s\S]*?<a[^>]*>(\d+)<\/a>/i);
      if (fcMatch) data.friendsCount = fcMatch[1];
      const ccMatch = detailsCard.match(/Comments[\s\S]*?<a[^>]*>(\d+)<\/a>/i);
      if (ccMatch) data.commentsCount = ccMatch[1];
      const affMatch = detailsCard.match(/Affiliation[\s\S]*?<td>([^<]+)<\/td>/i);
      if (affMatch) data.affiliation = stripComments(affMatch[1]);
   }

   const badgesCard = findCard(source, "Badges");
   data.badges = [];
   if (badgesCard) {
      const badgeMatches = matchAll(badgesCard, /<div\s+title="([^"]+)"[^>]*>\s*(<svg[\s\S]*?<\/svg>)\s*<\/div>/gi);
      for (const bm of badgeMatches) {
         data.badges.push({ title: bm[1], svg: bm[2] });
      }
   }

   data.socialLinks = [];
   const linksCard = findCard(source, "Links");
   if (linksCard) {
      const linkMatches = matchAll(linksCard, /<a\s[^>]*class="social-link-item"[^>]*href="([^"]*)"[^>]*>[^<]*<span class="social-link-platform">([^<]+)<\/span>[^<]*<span class="social-link-name">([^<]+)<\/span>/gi);
      if (linkMatches.length === 0) {
         const linkMatches2 = matchAll(linksCard, /<a\s[^>]*href="([^"]*)"[^>]*class="social-link-item"[^>]*>[^<]*<span class="social-link-platform">([^<]+)<\/span>[^<]*<span class="social-link-name">([^<]+)<\/span>/gi);
         for (const lm of linkMatches2) linkMatches.push(lm);
      }
      for (const lm of linkMatches) {
         data.socialLinks.push({
            href: lm[1],
            platform: lm[2],
            name: lm[3],
         });
      }
   }

   const avatarInfoCard = findCard(source, "Avatar Info");
   data.modelType = '3d';
   if (avatarInfoCard) {
      const modelMatch = avatarInfoCard.match(/Model[\s\S]*?<td>([^<]+)<\/td>/i);
      if (modelMatch) data.modelType = modelMatch[1].trim();
   }

   const loreCard = findCard(source, "Lore");
   data.lore = '';
   if (loreCard) {
      // Extract all Lexical text spans
      const textSpans = matchAll(loreCard, /data-lexical-text="true">([^<]*)</gi);
      data.lore = textSpans.map(t => t[1]).join('\n') || '';
   }

   data.aboutMe = '';
   data.whoToMeet = '';
   const blurbsCard = findCard(source, "Blurbs");
   if (blurbsCard) {
      const aboutSection = blurbsCard.match(/About Me[\s\S]*?<div class="blurb-content">([\s\S]*?)<\/div>/i);
      if (aboutSection) {
         const texts = matchAll(aboutSection[1], /data-lexical-text="true">([^<]*)</gi);
         data.aboutMe = texts.map(t => t[1]).join('\n') || '';
      }
      const meetSection = blurbsCard.match(/Who I[^<]*Like to Meet[\s\S]*?<div class="blurb-content">([\s\S]*?)<\/div>/i);
      if (meetSection) {
         const texts = matchAll(meetSection[1], /data-lexical-text="true">([^<]*)</gi);
         data.whoToMeet = texts.map(t => t[1]).join('\n') || '';
      }
   }

   data.interests = {};
   const interestsCard = findCard(source, "Interests");
   if (interestsCard) {
      const categories = ['Music', 'Movies', 'Shows', 'Books', 'Games', 'Heroes'];
      for (const cat of categories) {
         const catRe = new RegExp(cat + ':[\\s\\S]*?<div class="[^"]*interest-content[^"]*"[^>]*>([\\s\\S]*?)</div>', 'i');
         const catMatch = interestsCard.match(catRe);
         if (catMatch) {
            const texts = matchAll(catMatch[1], /data-lexical-text="true">([^<]*)/gi);
            data.interests[cat] = texts.map(t => t[1]).join(', ');
         } else {
            const simpleRe = new RegExp(cat + '[\\s\\S]*?<div[^>]*>([^<]+)</div>', 'i');
            const simpleMatch = interestsCard.match(simpleRe);
            data.interests[cat] = simpleMatch ? simpleMatch[1].trim() : '';
         }
      }
   }

   data.songUrl = '';
   const songCard = findCard(source, "Profile Song");
   if (songCard) {
      const srcMatch = songCard.match(/src="([^"]+\.(mp3|wav|ogg|m4a|webm)[^"]*)"/i)
         || songCard.match(/<source\s+src="([^"]+)"/i)
         || songCard.match(/<audio[^>]+src="([^"]+)"/i);
      if (srcMatch) data.songUrl = srcMatch[1];
   }

   data.comments = [];
   data.commentTotal = '0';
   const commentsCard = findCard(source, "Friend Comments");
   if (commentsCard) {
      const totalMatch = commentsCard.match(/View All[^(]*\((?:<!--\s*-->)?\s*(\d+)/i);
      if (totalMatch) data.commentTotal = totalMatch[1];
      const commentStarts = matchAll(commentsCard, /<div class="profile-comment">/gi);
      const commentBlockTexts = [];
      for (const cs of commentStarts) {
         let depth = 1, ci = cs.index + cs[0].length;
         while (ci < commentsCard.length && depth > 0) {
            if (commentsCard.substr(ci, 4) === '<div') { depth++; ci += 4; }
            else if (commentsCard.substr(ci, 6) === '</div>') { depth--; if (depth === 0) break; ci += 6; }
            else ci++;
         }
         commentBlockTexts.push(commentsCard.substring(cs.index + cs[0].length, ci));
      }
      for (const inner of commentBlockTexts) {
         const authorLink = inner.match(/class="comment-author-name"[^>]*href="([^"]+)"[^>]*>([^<]+)/i)
            || inner.match(/href="([^"]+)"[^>]*class="comment-author-name"[^>]*>([^<]+)/i);
         const avatarMatch = inner.match(/comment-avatar"[^>]*src="([^"]+)"/i)
            || inner.match(/src="([^"]+)"[^>]*class="[^"]*comment-avatar/i);
         const timeMatch = inner.match(/class="comment-time"[^>]*>([^<]*(?:<!--\s*-->)?[^<]*)</i);
         // Extract body text — search for lexical text spans within the comment
         let bodyText = '';
         const lexTexts = matchAll(inner, /data-lexical-text="true">([^<]*)/gi);
         bodyText = lexTexts.map(t => t[1]).join(' ');

         // Check for reply
         let reply = null;
         const replyBlock = inner.match(/margin-top:\s*8px;\s*margin-left:\s*10px([\s\S]*?)(?=<div class="comment-actions"|$)/i);
         if (replyBlock) {
            const rAuthor = replyBlock[1].match(/font-weight:\s*600[^>]*href="([^"]+)"[^>]*>([^<]+)/i);
            const rAvatar = replyBlock[1].match(/src="([^"]+)"/i);
            const rTime = replyBlock[1].match(/font-size:\s*9px[^>]*>([^<]*(?:<!--\s*-->)?[^<]*)/i);
            const rText = matchAll(replyBlock[1], /data-lexical-text="true">([^<]*)/gi);
            reply = {
               authorHref: rAuthor ? rAuthor[1] : '',
               authorName: rAuthor ? rAuthor[2] : '',
               avatarUrl: rAvatar ? rAvatar[1] : '',
               time: rTime ? stripComments(rTime[1]) : '',
               text: rText.map(t => t[1]).join(' '),
            };
         }

         if (authorLink) {
            data.comments.push({
               authorHref: authorLink[1],
               authorName: authorLink[2],
               avatarUrl: avatarMatch ? avatarMatch[1] : '',
               time: timeMatch ? stripComments(timeMatch[1]) : '',
               body: bodyText,
               reply,
            });
         }
      }
   }

   return data;
}

function buildFriendsGrid(friends) {
   if (friends.length === 0) return '<div class="friends-grid"></div>';
   const items = friends.map(f => `
                           <a class="friend-item" href="${f.href}">
                              <img src="${f.avatarUrl}" alt="${f.alt || f.name}" class="user-avatar friend-avatar" style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;object-fit:cover">
                              <span class="friend-name">${f.name}</span>
                           </a>`).join('');
   return `<div class="friends-grid">${items}
                        </div>`;
}

function buildAlbums(albums) {
   if (albums.length === 0) return '';
   const items = albums.map(a => `
                           <a style="display:block;border:1px solid var(--vs-border);background:var(--vs-bg-white);transition:all 0.2s" href="${a.href}">
                              <div style="aspect-ratio:1;background:url(${a.coverUrl}) center/cover;display:flex;align-items:center;justify-content:center"></div>
                              <div style="padding:4px 6px">
                                 <div style="font-size:10px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.title}</div>
                                 <div style="font-size:9px;color:var(--vs-text-light)">${a.count} photos</div>
                              </div>
                           </a>`).join('');
   return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${items}
                        </div>`;
}

function buildGroups(groups) {
   if (groups.length === 0) return '';
   const items = groups.map(g => `
                           <a style="display:flex;flex-direction:column;aspect-ratio:1;overflow:hidden;border:1px solid var(--vs-border);background:var(--vs-bg-white);transition:all 0.2s" href="${g.href}">
                              <div style="flex:1;min-height:0;background:url(${g.coverUrl}) center/cover;display:flex;align-items:center;justify-content:center"></div>
                              <div style="padding:4px 6px;flex-shrink:0">
                                 <div style="font-size:10px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.name}</div>
                                 <div style="font-size:9px;color:var(--vs-text-light)">${g.members} members</div>
                              </div>
                           </a>`).join('');
   return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${items}
                        </div>`;
}

function buildCollabGrid(grid) {
   const days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
   const headers = `
                              <thead>
                                 <tr>
                                    <th style="width:24px"></th>
                                    <th style="padding:0;width:4px;text-align:center">12a</th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center">6a</th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center">12p</th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center">6p</th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                    <th style="padding:0;width:4px;text-align:center"></th>
                                 </tr>
                              </thead>`;

   let rows = '';
   for (let d = 0; d < days.length; d++) {
      const slots = grid[d] || new Array(24).fill(0);
      const cells = slots.map(s =>
         `<td style="width:4px;height:8px;padding:0;background:var(${s ? '--vs-blue' : '--vs-bg-muted'});border:1px solid var(--vs-border-lighter)"></td>`
      ).join('\n                                    ');
      rows += `
                                 <tr>
                                    <td style="font-size:8px;font-weight:bold;padding:0 2px">${days[d]}</td>
                                    ${cells}
                                 </tr>`;
   }

   return `<table style="width:100%;border-collapse:collapse;font-size:9px">${headers}
                              <tbody>${rows}
                              </tbody>
                           </table>`;
}

function buildCollabTags(tags) {
   if (tags.length === 0) return '';
   return `<div style="display:flex;flex-wrap:wrap;gap:3px">${tags.map(t =>
      `<span style="padding:1px 6px;background:var(--vs-bg-muted);border-radius:3px;font-size:9px">${t}</span>`
   ).join('')}</div>`;
}

function buildBadges(badges) {
   if (badges.length === 0) return '';
   return badges.map(b => `
                           <div title="${b.title}" style="width:32px;height:32px;flex-shrink:0">
                              ${b.svg}
                           </div>`).join('');
}

function buildSocialLinks(links) {
   if (links.length === 0) return '';
   return links.map(l =>
      `<a href="${l.href}" target="_blank" rel="noopener noreferrer" class="social-link-item"><span class="social-link-platform">${l.platform}</span><span class="social-link-name">${l.name}</span></a>`
   ).join('');
}

function buildComments(comments, displayName, username) {
   if (comments.length === 0) return '';
   return comments.map(c => {
      let replyHtml = '';
      if (c.reply) {
         replyHtml = `
                              <div style="margin-top:8px;margin-left:10px;padding:8px;background:var(--vs-bg-muted);border-left:2px solid var(--vs-border)">
                                 <div style="font-size:10px;margin-bottom:4px">
                                    <a href="${c.reply.authorHref}" style="font-weight:600">${c.reply.authorName}</a>
                                    <span style="color:var(--vs-text-light)"> ${c.reply.time}</span>
                                 </div>
                                 <div style="font-size:11px">${c.reply.text}</div>
                              </div>`;
      }
      return `
                        <div class="profile-comment">
                           <img class="user-avatar comment-avatar" src="${c.avatarUrl}" alt="${c.authorName}" style="width:50px;height:50px;object-fit:cover">
                           <div class="comment-content">
                              <div class="comment-meta">
                                 <a class="comment-author-name" href="${c.authorHref}">${c.authorName}</a>
                                 <span class="comment-time"> ${c.time}</span>
                              </div>
                              <div class="comment-body">${c.body}</div>${replyHtml}
                              <!-- HOST ONLY: Comment actions (Reply/Delete) -->
                              <div class="comment-actions">
                                 <a href="/${username}/comments?reply=cmt_example">Reply</a> · <a href="#" style="color:var(--vs-error)">Delete</a>
                              </div>
                           </div>
                        </div>`;
   }).join('');
}

async function updateProfile(data) {
   let html = fs.readFileSync(PROFILE_PATH, 'utf8');

   const name = data.displayName;
   const user = data.username;

   // --- Replace simple placeholders (global) ---
   html = html.replace(/Username's /g, `${name}'s `);
   html = html.replace(/>Username</g, `>${name}<`);
   html = html.replace(/<strong>Username<\/strong>/g, `<strong>${name}</strong>`);
   html = html.replace(/@username/g, `@${user}`);
   html = html.replace(/myoshi\.co\/username/g, `myoshi.co/${user}`);
   html = html.replace(/\/username\//g, `/${user}/`);
   html = html.replace(/to=username/g, `to=${user}`);

   // --- Display name ---
   html = html.replace(/>Display Name<\/div>/g, `>${name}</div>`);

   // --- Tagline ---
   html = html.replace(/"Headline"/g, `"${data.tagline}"`);

   // --- Oshi mark ---
   html = html.replace(/<div class="profile-oshi-mark">X<\/div>/,
      `<div class="profile-oshi-mark">${data.oshiMark}</div>`);

   // --- Mood ---
   html = html.replace(/<div class="mood-text">Mood<\/div>/,
      `<div class="mood-text">${data.mood}</div>`);

   // --- Avatar ---
   if (data.avatarUrl) {
      html = html.replace(/src="data:image\/svg\+xml[^"]*"(\s+style="width:100px)/,
         `src="${data.avatarUrl}"$1`);
      html = html.replace(/alt="Username"/g, `alt="${name}"`);
   }

   // --- Online status ---
   html = html.replace(/>Last online just now</, `>${data.onlineStatus}<`);

   // --- Boop stats ---
   html = html.replace(/14 boops received/, `${data.boopCount} boops received`);
   if (data.viewerBoops) {
      html = html.replace(/You've booped 9x/, `You've booped ${data.viewerBoops}x`);
   }

   // --- Theme ---
   html = html.replace(/profile-custom-css theme-dark/, `profile-custom-css ${data.theme}`);

   // --- Background image ---
   if (data.backgroundImage) {
      html = html.replace(
         /class="profile-page profile-custom-css/,
         `style="background-image:url(${data.backgroundImage});background-size:cover;background-position:center top;background-attachment:fixed;background-repeat:no-repeat" class="profile-page profile-custom-css`
      );
   }

   // --- Friends ---
   html = html.replace(
      /<div class="friends-grid">[\s\S]*?<\/div>\s*(?=<\/div>\s*<\/div>\s*\n\s*<!--\s*={10,}\s*Photos)/,
      buildFriendsGrid(data.friends) + '\n                        '
   );

   // --- Photos ---
   html = html.replace(
      /(<div class="card">\s*<div class="card-header hearted"[^>]*>\s*<span>[^<]*Photos<\/span>[\s\S]*?<div class="card-body">\s*)([\s\S]*?)(\s*<\/div>\s*<\/div>\s*\n\s*<!--\s*={10,}\s*Groups)/,
      (match, before, content, after) => `${before}${buildAlbums(data.albums)}${after}`
   );

   // --- Groups ---
   const groupsHtml = buildGroups(data.groups);
   const editTopGroups = `<!-- HOST ONLY: Edit Top Groups link -->\n                        <div style="text-align:center;margin-top:6px"><a href="/groups/top" style="font-size:9px;color:var(--vs-text-medium)">Edit Top Groups</a></div>`;
   html = html.replace(
      /(<div class="card">\s*<div class="card-header hearted"[^>]*>\s*<span>[^<]*Groups<\/span>[\s\S]*?<div class="card-body">\s*)([\s\S]*?)(<!-- HOST ONLY: Edit Top Groups[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\n\s*<!--\s*={10,}\s*Collab)/,
      (match, before, content, after) => `${before}${groupsHtml}\n                        ${editTopGroups}\n                     </div>\n                  </div>\n\n                  <!-- ==================== Collab`
   );

   // --- Collab schedule ---
   if (data.collabGrid.length > 0) {
      html = html.replace(
         /<table style="width:100%;border-collapse:collapse;font-size:9px">[\s\S]*?<\/table>/,
         buildCollabGrid(data.collabGrid)
      );
   }

   // --- Collab tags ---
   if (data.collabTags.length > 0) {
      html = html.replace(
         /<div style="display:flex;flex-wrap:wrap;gap:3px">[\s\S]*?<\/div>\s*(?=<\/div>\s*<\/div>\s*\n\s*<!--\s*={5,}\s*(?:Details|Badges))/,
         buildCollabTags(data.collabTags)
      );
   }

   // --- Collab description ---
   if (data.collabDescription) {
      html = html.replace(
         /Collab description here/,
         data.collabDescription
      );
   }

   // --- Details card ---
   html = html.replace(/title="N invites from founding"/, `title="${data.genTitle}"`);
   html = html.replace(/>Gen 1</, `>Gen ${data.generation || '1'}<`);
   html = html.replace(
      /(<td><a href="\/)[^"]*\/friends">(\d+)<\/a><\/td>/,
      `$1${user}/friends">${data.friendsCount}</a></td>`
   );
   html = html.replace(
      /(<td><a href="#comments">)\d+(<\/a><\/td>)/,
      `$1${data.commentsCount}$2`
   );
   html = html.replace(
      /<td>Affiliation<\/td>/,
      `<td>${data.affiliation}</td>`
   );

   // --- Badges ---
   if (data.badges.length > 0) {
      html = html.replace(
         /<div style="display:flex;flex-wrap:wrap;gap:8px">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*(?=\n\s*<!--\s*={5,}\s*Details)/,
         `<div style="display:flex;flex-wrap:wrap;gap:8px">${buildBadges(data.badges)}
                        </div>\n                     </div>\n                  </div>\n`
      );
   }

   // --- Social links ---
   if (data.socialLinks.length > 0) {
      html = html.replace(
         /<div class="social-links-list">[\s\S]*?<\/div>\s*(?=<\/div>\s*<\/div>\s*\n\s*<!--\s*={5,}\s*Avatar Info)/,
         `<div class="social-links-list">\n                           ${buildSocialLinks(data.socialLinks)}\n                        </div>\n                     `
      );
   }

   // --- Avatar Info ---
   html = html.replace(/<td>3d<\/td>/, `<td>${data.modelType}</td>`);

   // --- Lore ---
   if (data.lore) {
      html = html.replace(
         /Lore content goes here\./,
         data.lore
      );
   }

   // --- Blurbs ---
   if (data.aboutMe) {
      html = html.replace(/About me text goes here\./, data.aboutMe);
   }
   if (data.whoToMeet) {
      html = html.replace(/Who I'd like to meet text goes here\./, data.whoToMeet);
   }

   // --- Interests ---
   const categories = ['Music', 'Movies', 'Shows', 'Books', 'Games', 'Heroes'];
   for (const cat of categories) {
      const val = data.interests[cat] || `${cat}`;
      const placeholder = `${cat}1, ${cat}2`;
      html = html.replace(
         new RegExp(`>${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`),
         `>${val}<`
      );
      // Also try singular placeholder
      html = html.replace(
         new RegExp(`>Genre, Artist, Album<`),
         `>${data.interests['Music'] || 'Genre, Artist, Album'}<`
      );
   }

   // --- Profile song ---
   if (data.songUrl) {
      html = html.replace(/src="about:blank"/, `src="${data.songUrl}"`);
   }

   // --- Comments ---
   if (data.comments.length > 0) {
      html = html.replace(/View All \(\d+\)/, `View All (${data.commentTotal})`);
      html = html.replace(
         /Leave a comment for [^.]*\.\.\./,
         `Leave a comment for ${name}...`
      );
      // Replace all existing comments
      html = html.replace(
         /(Post Comment<\/button>\s*<\/div>)[\s\S]*?(\s*<\/div>\s*<\/div>\s*\n\s*<\/div><!-- \/profile-right -->)/,
         `$1${buildComments(data.comments, name, user)}$2`
      );
   }

   // --- Inline custom.html ---
   if (fs.existsSync(CUSTOM_HTML_PATH)) {
      const customHtml = fs.readFileSync(CUSTOM_HTML_PATH, 'utf8');
      html = html.replace(
         /<div class="blurb-content profile-custom-html">[\s\S]*?<\/div>/,
         `<div class="blurb-content profile-custom-html">${customHtml}</div>`
      );
   }

   // --- Download and localize images ---
   const urlMap = await downloadAllImages(data);
   if (Object.keys(urlMap).length > 0) {
      html = localizeImages(html, urlMap);
   }

   fs.writeFileSync(PROFILE_PATH, html, 'utf8');
   console.log(`Updated: ${PROFILE_PATH}`);
   console.log(`  Display name: ${name}`);
   console.log(`  Username: @${user}`);
   console.log(`  Friends: ${data.friends.length}`);
   console.log(`  Albums: ${data.albums.length}`);
   console.log(`  Groups: ${data.groups.length}`);
   console.log(`  Comments: ${data.comments.length}`);
   console.log(`  Social links: ${data.socialLinks.length}`);
   console.log(`  Badges: ${data.badges.length}`);
   console.log(`  Images: ${Object.keys(urlMap).length} localized`);
   if (fs.existsSync(CUSTOM_HTML_PATH)) console.log(`  custom.html: inlined`);
}

const fileArg = process.argv[2];
let source = SOURCE;
if (fileArg) {
   const filePath = path.resolve(DIR, fileArg);
   if (fs.existsSync(filePath)) {
      source = fs.readFileSync(filePath, 'utf8');
      console.log(`Reading source from: ${filePath}`);
   } else {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
   }
}

if (source.trim() === 'PASTE_HERE' || source.trim() === '') {
   console.log('No source HTML found.');
   console.log('  Option 1: Paste page source into the SOURCE constant at the top of this file');
   console.log('  Option 2: Run: node update.js <source-file.html>');

   if (fs.existsSync(CUSTOM_HTML_PATH) && fs.existsSync(PROFILE_PATH)) {
      const customHtml = fs.readFileSync(CUSTOM_HTML_PATH, 'utf8');
      let html = fs.readFileSync(PROFILE_PATH, 'utf8');
      html = html.replace(
         /<div class="blurb-content profile-custom-html">[\s\S]*?<\/div>/,
         `<div class="blurb-content profile-custom-html">${customHtml}</div>`
      );
      fs.writeFileSync(PROFILE_PATH, html, 'utf8');
      console.log('Inlined custom.html into profile.html');
   }
   process.exit(0);
}

const data = extractProfileData(source);
updateProfile(data).catch(err => { console.error(err); process.exit(1); });
