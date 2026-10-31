// Pêche : ton appli d'origine (HTML et code inchangés), livrée en plugin.
// Ses données sont dans le dossier du plugin, que NeoBase sauvegarde (synchro cloud et sauvegardes) ; à la première ouverture elle reprend ce que tu avais dans NeoBase.
// Elle demande l'accès complet pour utiliser les outils d'interface de NeoBase. NeoBase ne l'ouvre que si elle est signée.
const HTML = "<div class=\"appWrap wide\">\n      <div class=\"agHead\"><span class=\"label\">Pêche</span><span class=\"hint\" id=\"fiInfo\"></span><div class=\"agNav\"><select class=\"f gSel\" id=\"fiSpot\"></select><select class=\"f gSel\" id=\"fiBait\"></select><button class=\"btn px\" id=\"fiShopBtn\">BOUTIQUE</button><button class=\"btn px\" id=\"fiDexBtn\">COLLECTION</button><button class=\"btn px\" id=\"fiQuestBtn\">DÉFIS</button></div></div>\n      <div class=\"gameBox g169\"><canvas id=\"fiCanvas\" width=\"384\" height=\"216\"></canvas></div>\n      <div id=\"fiShop\" class=\"fiPanel\" style=\"display:none\"></div>\n      <div id=\"fiDex\" class=\"fiPanel\" style=\"display:none\"></div>\n      <div id=\"fiQuest\" class=\"fiPanel\" style=\"display:none\"></div>\n      <div class=\"hint\">Maintiens clic ou espace pour doser le lancer, attends la vraie touche (pas les frémissements) et clique vite : un ferrage parfait fatigue déjà le poisson. Maintiens pour remonter, relâche quand il tire ou saute, et contre ses départs avec ← → (ou la souris). Niveau de pêcheur, défis du jour, séries de prises et trésors. Chaque espèce a ses lieux, ses heures, sa météo et ses appâts. La partie est sauvegardée et synchronisée.</div>\n    </div>";
/*CSS-MOVED*/ const CSS = `.gameBox{display:grid;place-items:center;padding:10px;background:#05010b;box-shadow:0 0 0 3px var(--line2)}
.gameBox canvas{width:min(100%,1152px);aspect-ratio:384/144;image-rendering:pixelated;cursor:var(--cp,pointer)}
.gameBox.tall canvas{width:auto;height:min(720px,72vh);aspect-ratio:240/320}
.gSel{width:auto;font-size:14px;padding:6px 10px;margin-right:8px}
.gameBox.g169 canvas{aspect-ratio:384/216;width:min(100%,calc((100vh - 250px) * 1.777))}
#fiQuest .fiItem.done{--c:#2f8f5a;opacity:.85}
.fiPanel{display:flex;flex-direction:column;gap:14px}
.fiItem .btn{height:36px;font-size:15px;margin-top:auto}
.fiTabs .btn{height:34px;font-size:14px;padding:0 10px}
.fiGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
.fiCell{--fill:var(--win);--c:var(--line);border:0;padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:var(--cp,pointer);color:#fff;font:14px var(--text);min-height:96px;justify-content:center}
.fiCell img{max-width:100%;image-rendering:pixelated}
.fiCell:not(.unknown){--c:var(--rc)}
.fiCell.unknown span{color:var(--muted)}
.fiCell.on{--fill:var(--btnh)}
.fiDetail{flex-direction:row;align-items:center;gap:20px;flex-wrap:wrap}
.fiDetail img{image-rendering:pixelated;max-width:240px}
`;  // le style de ce plugin (il utilise les variables du thème de NeoBase)
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoBase pour s'ouvrir."; return; }
  const host = ctx.host, { el, toast, sfx, ask, newTab, pixIcon, PIX, WX } = host;
  const folder = ctx.folder, legacy = ctx.legacy || {};
  ctx.host.addStyle(CSS);
  view.innerHTML = HTML;
  const $ = id => id === "fishingApp" ? view : (view.querySelector('#' + id) || document.getElementById(id));  // les identifiants de ta vue d'abord, puis ceux de la page (fenêtres, menus)
  const doc = async n => { try { return await folder.read(n); } catch { return null; } };
  const __icon = () => ctx.icon;  // l'icône de ce plugin
  const LEGACY_GAMES = {"top":["fish","aquarium"],"best":"^$"};
  let games = await doc('games');
  if (games == null) {  // première ouverture : tu retrouves tes records et tes parties d'avant
    const old = legacy.api ? await legacy.api('games').catch(() => null) : null; games = { best: {} };
    if (old) { const re = new RegExp(LEGACY_GAMES.best); for (const [k, v] of Object.entries(old.best || {})) if (re.test(k)) games.best[k] = v; for (const k of LEGACY_GAMES.top) if (old[k] !== undefined) games[k] = old[k]; await folder.write('games', games); }
  }
  games = { best: {}, ...games };
  let gamesTimer = null;
  const saveGames = () => { clearTimeout(gamesTimer); gamesTimer = setTimeout(() => { gamesTimer = null; folder.write('games', games).catch(() => {}); }, 500); };
  const best = (k, v, higher = true) => { const b = games.best[k]; if (b == null || (higher ? v > b : v < b)) { games.best[k] = v; saveGames(); return true; } return false; };
  const gstore = (k, init) => (games[k] ??= init);  // la section d'un jeu
function gameLoop(st, appKey, update, draw) {
  cancelAnimationFrame(st.raf);
  const STEP = 1000 / 60; let acc = 0, last = performance.now();
  const frame = t => {
    if (!view.classList.contains('on')) { st.raf = 0; if (st.mode === 'play') st.mode = 'pause'; return; }  // leaving the tab pauses the game
    st.raf = requestAnimationFrame(frame);
    acc += Math.min(200, t - last); last = t;
    while (acc >= STEP) { if (st.mode === 'play') update(); st.tick++; acc -= STEP; }
    draw();
  };
  st.raf = requestAnimationFrame(frame);
}
function gameText(g, w, lines, y0) {  // centred pixel-font lines over a dark band
  g.fillStyle = 'rgba(11,3,28,.72)'; g.fillRect(0, y0 - 14, w, lines.length * 14 + 14);
  g.textAlign = 'center';
  lines.forEach(([text, color, size], i) => { g.fillStyle = color; g.font = (size || 8) + 'px "Press Start 2P", monospace'; g.fillText(text, w / 2, y0 + i * 14); });
  g.textAlign = 'left';
}
const px = (g, color, x, y, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), w, h); };
function sprite(g, rows, x, y, pal) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c) px(g, c, x + i, y + j); } }); }
  // ---- ton code d'origine ----
const seeded = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const pxFont = (g, text, x, y, color, size = 8, align = 'left') => { g.font = size + 'px "Press Start 2P", monospace'; g.textAlign = align; g.fillStyle = '#05010b'; g.fillText(text, x + 1, y + 1); g.fillStyle = color; g.fillText(text, x, y); g.textAlign = 'left'; };

/* NeoBase games, part 5: Pêche. 7 places, 128 species drawn by code in pixel art, day / night and weather, rods and baits, a collection.
   The whole game (money, gear, places, collection, clock) is saved in games.fish, so it follows you between PCs. */

/* name | places | time (J day, A dawn & dusk, N night, * any) | weather (* any, P rain or storm, S clear, N snow) | rarity 1-5 | size cm | shape | back, belly, fins | pattern | baits it likes */
const FI_DATA = `Gardon|E|*|*|1|12-30|f|8a9,dde,c55|-|pv
Rotengle|E|J|*|1|12-28|f|8a6,eed,e44|-|pv
Ablette|ER|J|*|1|8-18|f|9ab,eef,ccd|h|pa
Perche commune|EL|J|*|2|15-45|f|7a4,ed9,e63|s|vl
Tanche|E|A|*|2|20-60|f|564,9a5,453|-|v
Brème|ER|*|*|2|30-70|h|776,cc9,554|-|pv
Carpe commune|E|*|*|2|35-90|h|875,db8,a64|-|pv
Carpe miroir|E|N|*|3|40-100|h|986,ec9,b75|d|pv
Carpe koï|E|J|S|4|40-90|h|f84,fff,f84|m|p
Carassin doré|E|J|*|2|10-30|h|ea3,fd8,e83|-|p
Poisson-chat|E|N|*|2|20-45|w|443,776,332|-|va
Brochet|ELR|A|*|3|50-120|g|6a5,dd9,797|d|l
Sandre|EL|N|*|3|40-90|g|796,dda,575|b|l
Black-bass|E|J|S|3|25-60|f|5a4,dd9,464|h|l
Silure glane|ER|N|P|4|100-250|w|554,aa9,443|m|vk
Pseudorasbora|E|J|*|1|5-10|f|aa9,eed,887|h|pa
Bouvière|E|J|S|2|5-9|h|9ab,fcd,e6a|-|p
Amour blanc|E|J|S|3|50-120|g|8a8,ddd,797|-|p
Carpe céleste|E|N|S|5|80-130|h|7cf,fff,f6e|n|p
Truite fario|RL|A|*|2|20-60|f|875,ec9,c74|d|va
Truite arc-en-ciel|RL|J|*|2|25-70|f|797,eee,e7a|h|vl
Ombre commun|R|J|*|3|25-50|f|889,ddd,a6c|d|a
Chevesne|R|J|*|1|20-60|f|788,ddd,e85|-|pva
Barbeau|R|*|*|2|25-80|w|974,dc9,b64|-|va
Goujon|R|J|*|1|8-15|f|998,ddd,887|d|va
Vairon|R|J|*|1|5-10|f|675,ec8,e44|-|pa
Hotu|R|J|*|1|25-45|f|889,eee,e66|-|p
Vandoise|R|J|*|1|15-30|f|8ab,eef,ddd|-|pa
Spirlin|R|J|S|2|8-13|f|897,eed,e75|h|a
Loche franche|R|N|*|2|8-12|l|986,dc9,764|d|va
Chabot|R|N|*|2|10-15|w|875,cb9,764|m|v
Anguille|REC|N|P|3|50-120|l|564,cc9,453|-|va
Saumon atlantique|R|A|P|4|60-120|f|79a,eee,9ab|d|lc
Esturgeon|R|N|*|4|100-250|g|776,dcb,665|h|lk
Lamproie|R|N|P|3|40-90|l|776,aa9,665|m|v
Aspe|R|J|*|3|40-80|g|889,eee,c88|-|l
Brochet fantôme|R|N|P|5|120-160|g|cdf,fff,9bf|n|l
Omble chevalier|L|A|*|3|25-60|f|687,f84,f84|d|vl
Corégone|L|J|*|2|30-60|f|99a,eee,aab|-|a
Cristivomer|L|N|*|3|50-100|f|575,ddc,686|d|lk
Ombre arctique|L|J|S|3|30-50|f|778,ddd,b8d|d|a
Lotte de rivière|L|N|*|3|30-70|w|775,cc9,664|m|v
Truite dorée|L|J|S|4|25-50|f|fc4,fe9,f84|h|a
Vendace|L|J|*|1|15-25|f|9ab,eef,bbc|-|a
Épinoche|LE|J|*|1|4-8|f|786,e66,998|s|a
Truite marbrée|L|A|P|4|50-100|f|796,ddc,797|m|l
Perche soleil|LE|J|S|2|10-20|h|5a8,fb4,e83|h|v
Saumon de fontaine|L|A|*|2|20-40|f|575,f95,e63|d|v
Huchon|L|N|N|4|60-120|g|877,edc,b77|d|l
Ide mélanote|L|J|*|2|25-50|f|888,eee,e66|-|pa
Truite fardée|L|J|*|3|30-60|f|887,ecb,e55|d|v
Dragon des cimes|L|A|N|5|90-150|g|8df,fff,fd7|n|lg
Bar|C|A|*|2|30-80|f|9ab,eee,889|-|lc
Dorade royale|C|J|S|2|25-60|h|aab,eee,fc5|-|c
Maquereau|C|J|*|1|20-40|f|486,eee,9ab|s|lc
Sardine|C|J|*|1|12-20|f|68a,eef,9ab|d|c
Anchois|C|J|*|1|8-15|f|79a,eef,aab|h|c
Mulet|C|*|*|1|30-60|f|889,ddd,888|h|p
Lieu jaune|C|A|*|2|40-90|f|775,ddb,fc5|h|l
Cabillaud|C|N|*|3|50-120|f|897,eed,796|d|kv
Merlan|C|J|*|1|25-45|f|998,eee,887|-|c
Sole|C|N|*|2|25-50|p|875,edc,654|d|v
Turbot|C|N|*|3|40-80|p|776,ddc,665|d|k
Plie|C|J|*|2|25-50|p|875,edc,e64|d|v
Raie bouclée|C|N|*|3|50-100|y|987,edc,765|d|k
Rouget-barbet|C|J|*|2|15-30|f|e75,fdc,ea8|-|v
Congre|C|N|P|3|80-200|l|667,bbb,556|-|k
Saint-pierre|C|*|*|3|30-60|h|998,ddc,776|d|c
Grondin perlon|C|J|*|2|25-60|f|e66,fcc,59c|-|c
Vieille|C|J|S|1|25-50|f|8a5,ec8,9b6|d|c
Baudroie|C|N|*|4|50-150|a|875,cb9,654|m|k
Thon rouge|C|J|S|4|100-250|f|335,ccd,eb4|-|lk
Espadon|C|A|*|4|150-300|e|557,ccd,446|-|k
Léviathan d'argent|C|N|P|5|200-400|e|cdf,fff,8bf|n|k
Poisson-clown|T|J|*|2|6-11|f|f72,fff,f72|b|c
Chirurgien bleu|T|J|*|2|15-30|h|35d,36d,fd3|-|c
Poisson-ange royal|T|J|S|3|15-25|h|e93,fd5,47c|s|c
Poisson-papillon|T|J|*|1|10-20|h|fd5,fff,333|s|c
Poisson-perroquet|T|J|*|2|30-70|f|3c9,7ec,f6c|m|c
Baliste picasso|T|J|*|3|15-30|h|ecb,fff,47c|h|c
Mérou géant|T|*|*|4|100-250|f|775,cb9,554|d|k
Barracuda|T|J|*|3|60-150|g|99a,eee,778|s|l
Poisson-lion|T|A|*|3|20-38|h|e75,fdc,e75|s|c
Murène javanaise|T|N|*|3|80-250|l|9a5,cc8,775|d|k
Hippocampe|T|J|S|3|8-20|x|fd5,fe9,eb4|-|c
Raie manta|T|J|S|4|200-500|y|334,eee,223|-|c
Poisson-coffre|T|J|*|2|15-35|r|fe4,ffb,333|d|c
Poisson-globe|T|N|*|2|15-40|r|cb8,fff,987|d|c
Napoléon|T|J|*|4|80-200|h|3a8,8dc,36a|m|k
Idole des Maures|T|J|*|2|15-25|h|fe6,fff,222|b|c
Demoiselle bleue|T|J|*|1|5-10|f|36f,47f,fd4|-|c
Labre nettoyeur|T|J|*|1|8-14|g|ccd,fff,36d|h|c
Requin à pointes noires|T|A|*|4|100-180|s|889,eee,222|-|k
Coryphène|T|J|S|3|60-150|f|5c6,fe5,3a8|d|l
Carangue géante|T|A|*|3|60-170|h|99a,ddd,666|-|l
Dragon de corail|T|N|*|5|30-50|x|f8c,fdf,8fd|n|c
Morue polaire|B|*|*|1|15-35|f|889,ddd,778|-|c
Flétan du Groenland|B|N|*|3|60-120|p|445,ccc,334|-|k
Omble arctique|B|J|*|2|30-70|f|577,f85,f85|d|v
Poisson des glaces|B|N|N|3|25-50|f|cdf,fff,bcd|-|c
Capelan|B|J|*|1|12-20|f|8ab,eef,9ab|-|c
Lompe|B|J|*|2|30-50|r|8a6,dc8,675|d|c
Loup atlantique|B|N|*|3|60-120|l|778,bbb,556|b|k
Requin du Groenland|B|N|N|4|250-500|s|556,aaa,445|-|k
Sébaste|B|A|*|2|25-50|f|e65,fcb,d54|-|c
Hareng|B|J|*|1|20-35|f|79a,eef,9ab|-|c
Églefin|B|J|*|2|30-60|f|889,eee,666|-|c
Chimère arctique|B|N|*|3|40-90|g|bbc,eee,99a|-|k
Grenadier|B|N|*|2|40-80|g|889,bbb,778|-|k
Saumon rouge|B|A|*|3|50-80|f|e44,fbb,575|-|l
Plie arctique|B|J|*|1|20-40|p|887,edd,765|d|v
Léviathan des glaces|B|N|N|5|300-600|s|cef,fff,9cf|n|k
Poisson-lanterne|A|*|*|1|5-15|f|335,446,7ff|n|g
Poisson-hache|A|*|*|2|5-12|h|aab,ccd,7ff|n|g
Grandgousier|A|*|*|3|40-80|l|222,333,f6e|n|g
Baudroie abyssale|A|*|*|3|10-40|a|332,443,7fd|n|g
Dragon noir|A|*|*|3|20-40|l|112,223,f5f|n|g
Poisson-vipère|A|*|*|2|20-35|g|445,556,7df|n|g
Calmar géant|A|N|*|4|300-1200|c|e66,fbb,e66|-|k
Cœlacanthe|A|*|*|4|100-200|f|459,8ab,9cd|d|k
Régalec|A|*|P|4|300-800|l|ccd,eee,f45|-|k
Poisson-ogre|A|*|*|2|10-16|a|432,543,ccc|-|g
Chimère abyssale|A|*|*|2|50-100|g|99a,bbc,778|-|k
Requin-lutin|A|*|*|4|200-400|s|eaa,fcc,c88|-|k
Poisson-tripode|A|*|*|2|20-35|g|776,998,665|-|g
Pieuvre Dumbo|A|*|*|3|10-30|c|f9b,fcd,f9b|-|g
Kraken|A|N|P|5|800-1500|c|a34,e78,f6a|n|k
Poisson-NeoBase|A|N|*|5|50-80|f|e1c,fff,7fe|n|g
Vairon|ER|J|*|1|6-12|f|9a8,dde,c66|-|pa
Goujon|R|J|*|1|8-15|g|987,cca,ba6|-|pa
Épinoche|EL|J|*|1|4-8|f|7a5,cd9,e63|-|pv
Truite arc-en-ciel|RL|J|S|3|25-70|f|8a9,fdd,f5a|-|pa
Omble chevalier|L|A|*|3|25-60|f|576,fb8,f64|-|pa
Silure géant|EL|N|*|4|100-250|l|665,aa8,886|-|k
Esturgeon|RL|*|*|4|100-300|g|678,ccd,99a|d|g
Maquereau|C|J|*|1|20-40|f|58c,cde,9bd|-|pa
Sardine|CT|J|*|1|12-22|f|7ac,eef,bce|-|pa
Bar commun|C|A|*|2|30-90|f|99a,dde,aab|-|pv
Dorade royale|CT|J|*|2|25-60|h|9aa,eed,fc4|-|pv
Rouget barbet|CT|J|*|2|15-35|f|e66,fcb,f87|-|pv
Raie pastenague|C|*|*|3|40-150|r|987,ddb,765|-|g
Poisson-clown|T|J|S|2|6-12|h|f84,fff,fa4|s|pa
Poisson-ange royal|T|J|*|3|15-40|y|48f,fd4,4cf|s|pa
Poisson-perroquet|T|J|*|3|30-80|h|4cb,fa6,6df|-|pv
Raie manta|T|*|*|4|200-500|x|445,eee,667|-|g
Thon rouge|CT|*|*|4|100-250|f|358,cde,a44|-|k
Espadon|CT|A|S|4|150-350|e|568,dde,445|-|k
Phoque-poisson givré|B|*|N|3|40-90|h|9bd,eef,cff|-|g
Morue arctique|B|*|*|2|40-100|g|987,eed,775|-|pv
Lompe des glaces|B|N|*|3|10-30|h|9ac,def,6bd|-|pv
Anguille lanterne|A|N|*|3|40-120|l|235,5f9,4fa|n|k
Baudroie fantôme|A|N|*|4|40-120|c|333,a6c,f9f|n|k
Poisson-hache cristal|A|*|*|3|8-20|y|79c,cff,9ef|n|pv`;
const FI_SPOTS = {
  E: {name: 'Étang des saules', price: 0, water: ['#3d6e7a', '#244a58', '#102632'], sky: 1, shore: 'wood', decor: 'saules', weather: {clair: 4, nuageux: 3, pluie: 2, orage: .5, brouillard: 1}},
  R: {name: 'Rivière claire', price: 600, water: ['#4a8a96', '#2b6070', '#14343f'], shore: 'wood', decor: 'collines', flow: true, weather: {clair: 4, nuageux: 3, pluie: 2.5, orage: .6, brouillard: 1}},
  L: {name: 'Lac de montagne', price: 1800, water: ['#4a7aa8', '#2b5080', '#142a4a'], shore: 'wood', decor: 'montagnes', weather: {clair: 4, nuageux: 3, pluie: 1.5, neige: 1.5, brouillard: 1}},
  C: {name: 'Côte rocheuse', price: 3500, water: ['#3a7f9c', '#215672', '#0e2c40'], shore: 'rock', decor: 'falaises', weather: {clair: 3, nuageux: 3, pluie: 2.5, orage: 1.2, brouillard: 1}},
  T: {name: 'Lagon tropical', price: 8000, water: ['#4fd8cc', '#24a0ae', '#0e5c72'], shore: 'wood', decor: 'palmiers', weather: {clair: 6, nuageux: 2, pluie: 1.5, orage: .6}},
  B: {name: 'Banquise', price: 14000, water: ['#6a9cbc', '#3d6c92', '#1c3856'], shore: 'ice', decor: 'icebergs', weather: {clair: 3, nuageux: 2, neige: 4, brouillard: 1.5}},
  A: {name: 'Abysses', price: 30000, water: ['#16205a', '#0b1236', '#04061a'], shore: 'boat', decor: 'large', dark: true, weather: {clair: 4, nuageux: 2, pluie: 2, orage: 1.2}},
};
const FI_RODS = [
  {name: 'Canne en bambou', price: 0, str: 1, reel: 1, luck: 0},
  {name: 'Canne en fibre', price: 400, str: 1.3, reel: 1.15, luck: .06},
  {name: 'Canne en carbone', price: 1800, str: 1.7, reel: 1.3, luck: .12},
  {name: 'Canne de compétition', price: 6000, str: 2.2, reel: 1.5, luck: .2},
  {name: 'Canne stellaire', price: 18000, str: 3, reel: 1.8, luck: .32},
];
const FI_BAITS = {  // pack = how many casts you get for the price; bread is free
  p: {name: 'Pain', price: 0, pack: 0, wait: 1},
  v: {name: 'Vers de terre', price: 30, pack: 20, wait: .8},
  a: {name: 'Asticots', price: 40, pack: 20, wait: .75},
  c: {name: 'Crevettes', price: 80, pack: 15, wait: .8},
  l: {name: 'Leurre', price: 150, pack: 25, wait: .9},
  k: {name: 'Calamar', price: 250, pack: 10, wait: .85},
  g: {name: 'Appât lumineux', price: 600, pack: 10, wait: .7},
};
const FI_RARITY = [null, ['Commun', '#c9bdf0', 100, 12], ['Peu commun', '#8ee8a0', 45, 35], ['Rare', '#7fe0ee', 15, 100], ['Épique', '#ff5ad9', 4.5, 380], ['Légendaire', '#ffd07a', 1.2, 1800]];  // label, colour, weight, base price
const FI_TIMES = {J: 'le jour', A: 'à l\'aube et au crépuscule', N: 'la nuit', '*': 'à toute heure'};
const FI_WEATHER = {'*': '', P: 'sous la pluie', S: 'par beau temps', N: 'quand il neige'};
const hex3 = h => '#' + [...h].map(c => c + c).join('');
const FISH = FI_DATA.trim().split('\n').map((line, id) => {
  const [name, spots, time, weather, rar, size, shape, cols, pattern, likes] = line.split('|'), [min, max] = size.split('-').map(Number), [back, belly, fin] = cols.split(',').map(hex3);
  return {id, name, spots, time, weather, rarity: +rar, min, max, shape, back, belly, fin, pattern, likes};
});
console.assert(FISH.length >= 100 && FISH.every(f => f.spots && f.max >= f.min && FI_RARITY[f.rarity]), 'FISH: 100+ well-formed species');
console.assert(Object.keys(FI_SPOTS).every(s => [...'JAN'].every(t => FISH.some(f => f.spots.includes(s) && f.rarity < 5 && f.weather === '*' && (f.time === '*' || f.time.includes(t))))), 'FISH: every place has something to catch at every hour');

/* ---------- species drawn by code: a body outline per shape, fins, shading, pattern and eye; cached as small canvases ---------- */
const mixc = (a, b, k) => { const p = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)), x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const FI_SEAHORSE = ['....bbb.....', '...bbebb....', '..bbbbbbbb..', '...bbbb.....', '....bbbf....', '....bbbff...', '...bbbbff...', '...bbbbbf...', '...bbbbbf...', '....bbbbf...', '....bbbb....', '.....bbb....', '.....bbb....', '......bb....', '......bbb...', '.......bb...', '.....b.bb...', '.....bbb....', '......b.....', '............', '............', '............'];
const fiArtCache = new Map();
function fiArt(f, silhouette) {
  const k = f.id + (silhouette ? 's' : ''); if (fiArtCache.has(k)) return fiArtCache.get(k);
  const D = {f: [26, 11], g: [32, 8], h: [22, 17], l: [36, 7], p: [24, 15], y: [30, 22], r: [18, 15], s: [38, 13], e: [40, 13], a: [24, 15], w: [32, 9], x: [12, 22], c: [30, 15]}[f.shape];
  const [W, H] = D, m = Array.from({length: H}, () => Array(W).fill(''));  // '' empty, b body, f fin, e eye, w white, k dark, g glow
  const rnd = seeded(f.id * 977 + 13), cy = (H - 1) / 2, set = (x, y, v, over) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H && (over || !m[y][x])) m[y][x] = v; };
  const side = 'fghseawr'.includes(f.shape);
  if (side) {
    const P = {f: [.55, .3, .2], g: [.5, .32, .2], h: [.48, .22, .22], s: [.42, .2, .18], e: [.45, .25, .22], a: [.78, .28, .2], w: [.62, .32, .18], r: [.5, .45, .12]}[f.shape];
    const [c, ped, tailK] = P, bill = f.shape === 'e' ? 9 : 0, x0 = Math.round(W * tailK), x1 = W - 1 - bill, hb = (H - 3) / 2;
    const hh = t => hb * Math.max(ped * (1 - t), Math.sqrt(Math.max(0, 1 - ((t - c) / (t < c ? c : 1 - c)) ** 2)));
    for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0), h = hh(t), top = f.shape === 'w' && t > .6 ? cy - h * .7 : cy - h; for (let y = Math.ceil(top - .3); y <= cy + h + .3; y++) set(x, y, 'b'); }
    for (let x = 0; x < x0; x++) {  // tail fin
      const u = (x0 - x) / x0, reach = hb * ped + u * hb * (f.shape === 'r' ? .6 : .95);
      for (let y = 0; y < H; y++) {
        const dy = y - cy, ad = Math.abs(dy);
        if (ad > reach) continue;
        if ('fgse'.includes(f.shape) && u > .45 && ad < (u - .45) * hb * 1.8) continue;  // forked
        if (f.shape === 's' && dy > 0 && u > .55) continue;  // shark: longer upper lobe
        set(x, y, 'f');
      }
    }
    const dorsal = f.shape === 'e' ? [.25, .7, hb * 1.1] : f.shape === 's' ? [.42, .58, hb * .9] : f.shape === 'h' ? [.2, .7, hb * .35] : [.35, .6, hb * .55];
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0); if (t < dorsal[0] || t > dorsal[1]) continue;
      const k = (t - dorsal[0]) / (dorsal[1] - dorsal[0]), hgt = dorsal[2] * (f.shape === 's' || f.shape === 'e' ? (1 - k) : Math.sin(k * Math.PI)), top = Math.ceil(cy - hh(t));
      for (let y = 1; y <= hgt; y++) set(x, top - y, 'f');
      if (t > .3 && t < .45) for (let y = 1; y <= hgt * .5 + 1; y++) set(x, Math.floor(cy + hh(t)) + y, 'f');  // anal fin
    }
    const px0 = x0 + (x1 - x0) * .68;
    for (let i = 0; i < 3; i++) set(px0 - i, cy + 1 + i * .6, 'f', true);  // pectoral fin
    const ex = x0 + (x1 - x0) * (f.shape === 'a' ? .9 : .86), ey = cy - hh(.86) * .35;
    if (f.shape === 'a') { for (let i = 0; i < 6; i++) set(ex - i * .6, ey - 3 - i * .4 - (i > 3 ? (i - 3) : 0), 'k', true); set(ex - 3, ey - 6, 'g', true); set(x1, cy + 1, 'w', true); set(x1 - 2, cy + 1, 'w', true); }
    if (f.shape === 'w') for (let i = 1; i < 5; i++) { set(x1 + 1 - i * .2, cy + i * .5, 'k', true); set(x1 - i, cy + 1 + i * .4, 'k', true); }
    if (bill) for (let x = x1 + 1; x < W; x++) set(x, cy - .5, 'k');
    if (H >= 10) for (let y = cy - hh(.75) * .6; y <= cy + hh(.75) * .6; y++) set(x0 + (x1 - x0) * .75, y, 'k', true);  // gill
    set(ex, ey, 'e', true); if (H >= 13) { set(ex + 1, ey, 'e', true); set(ex, ey + 1, 'e', true); set(ex + 1, ey + 1, 'e', true); }
    set(x1, cy + (f.shape === 'w' ? 0 : .5), 'k', true);
  } else if (f.shape === 'l') {  // eel: a thick wavy line
    for (let x = 0; x < W; x++) { const t = x / (W - 1), yc = cy + Math.sin(t * Math.PI * 2) * 1.2, th = 2.2 * Math.min(1, t * 4, (1 - t) * 6 + .3); for (let y = Math.ceil(yc - th); y <= yc + th; y++) set(x, y, 'b'); if (t < .6) { set(x, yc - th - 1, 'f'); set(x, yc + th + 1, 'f'); } }
    set(W - 4, cy - 1 + Math.sin(Math.PI * 2 * (W - 4) / (W - 1)) * 1.2, 'e', true); set(W - 1, cy, 'k', true);
  } else if (f.shape === 'p') {  // flatfish, seen from above
    for (let y = 0; y < H; y++) for (let x = 4; x < W; x++) { const v = ((x - 14) / 10) ** 2 + ((y - cy) / (H / 2)) ** 2; if (v <= .7) set(x, y, 'b'); else if (v <= 1) set(x, y, 'f'); }
    for (let x = 0; x < 5; x++) for (let y = cy - (5 - x) * .6 - 1; y <= cy + (5 - x) * .6 + 1; y++) set(x, y, 'f');
    set(20, cy - 2, 'e', true); set(21, cy, 'e', true);
  } else if (f.shape === 'y') {  // ray: a diamond and a long tail
    for (let y = 0; y < H; y++) for (let x = 8; x < W; x++) { const v = Math.abs(x - 19) / 11 + Math.abs(y - cy) / (H / 2); if (v <= 1 && !(x > 26 && Math.abs(y - cy) > 4)) set(x, y, 'b'); }
    for (let x = 0; x < 9; x++) set(x, cy, 'f');
    set(25, cy - 2, 'e', true); set(25, cy + 2, 'e', true);
  } else if (f.shape === 'x') {
    FI_SEAHORSE.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') set(x, y, ch === 'e' ? 'e' : ch); }));
  } else if (f.shape === 'c') {  // squid / octopus: mantle on the left, tentacles to the right
    for (let x = 0; x < 16; x++) { const h = 1 + x * .32; for (let y = Math.ceil(cy - h); y <= cy + h; y++) set(x + 1, y, 'b'); }
    for (let y = cy - 4; y <= cy + 4; y++) set(0, y, 'f'); for (let y = cy - 3; y <= cy + 3; y++) set(1, y, 'f');
    for (let x = 16; x < 20; x++) for (let y = cy - 4; y <= cy + 4; y++) set(x, y, 'b');
    for (let i = 0; i < 6; i++) { const y0 = cy - 3.5 + i * 1.4, len = 8 + (i * 7) % 5; for (let x = 0; x < len; x++) set(20 + x, y0 + Math.sin(x / 2 + i) * 1.2 + (i - 2.5) * x * .08, 'b'); }
    set(17, cy - 2, 'e', true);
  }
  // colours: back / belly with dithering, highlight on top, pattern, then a dark outline around everything
  const out = document.createElement('canvas'); out.width = W + 2; out.height = H + 2;
  const g = out.getContext('2d'), line = mixc(f.back, '#05010b', .72), dark = mixc(f.back, '#05010b', .35), light = mixc(f.back, '#ffffff', .35);
  const dots = new Set(); for (let i = 0; i < W * H / 14; i++) dots.add(Math.floor(rnd() * W) + ',' + Math.floor(rnd() * H));
  for (let x = 0; x < W; x++) {
    let top = -1, bot = -1; for (let y = 0; y < H; y++) if (m[y][x] === 'b') { if (top < 0) top = y; bot = y; }
    for (let y = 0; y < H; y++) {
      const v = m[y][x]; if (!v) continue;
      let c = f.fin;
      if (v === 'b') {
        const k = bot > top ? (y - top) / (bot - top) : 0;
        c = k < .45 ? f.back : k > .65 ? f.belly : (x + y) % 2 ? f.back : f.belly;
        if (y === top) c = light;
        const p = f.pattern;
        if (p === 's' && x % 5 < 2 && k < .8) c = dark;
        if (p === 'b' && x % 7 < 2) c = f.belly;
        if (p === 'h' && Math.abs(y - (top + bot) / 2) < .8) c = f.fin;
        if ((p === 'd' || p === 'n') && dots.has(x + ',' + y) && k > .1) c = p === 'n' ? f.fin : dark;
        if (p === 'm' && (Math.sin(x * .9 + f.id) + Math.cos(y * 1.3 + f.id * 2)) > 1.1) c = f.fin;
        if (p === 'n' && Math.abs(y - (top + bot) / 2) < .6) c = f.fin;
      }
      if (v === 'e') c = '#0b031c'; if (v === 'w') c = '#ffffff'; if (v === 'k') c = line; if (v === 'g') c = '#ffffaa';
      g.fillStyle = silhouette ? '#1c1238' : c; g.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  if (!silhouette) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y][x] === 'e' && (x === 0 || m[y][x - 1] !== 'e') && (y === 0 || m[y - 1][x] !== 'e') && H >= 13) { g.fillStyle = '#ffffff'; g.fillRect(x + 1, y + 1, 1, 1); }
  const img = g.getImageData(0, 0, W + 2, H + 2), d = img.data, filled = i => d[i * 4 + 3] > 0;
  const edge = [];
  for (let y = 0; y < H + 2; y++) for (let x = 0; x < W + 2; x++) { const i = y * (W + 2) + x; if (filled(i)) continue; if ((x > 0 && filled(i - 1)) || (x < W + 1 && filled(i + 1)) || (y > 0 && filled(i - W - 2)) || (y < H + 1 && filled(i + W + 2))) edge.push([x, y]); }
  g.fillStyle = silhouette ? '#0b031c' : line; for (const [x, y] of edge) g.fillRect(x, y, 1, 1);
  fiArtCache.set(k, out); return out;
}
const fiUrlCache = new Map();
const fiArtUrl = (f, s, scale = 3) => { const key = f.id + ',' + !!s + ',' + scale; if (fiUrlCache.has(key)) return fiUrlCache.get(key); const a = fiArt(f, s), c = document.createElement('canvas'); c.width = a.width * scale; c.height = a.height * scale; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(a, 0, 0, c.width, c.height); fiUrlCache.set(key, c.toDataURL()); return fiUrlCache.get(key); };

/* ---------- the save ---------- */
let fi = null;
const fiSave = () => gstore('fish', {money: 0, rod: 0, baits: {}, bait: 'p', spots: ['E'], spot: 'E', dex: {}, clock: 8 * 60, weather: 'clair', wUntil: 11 * 60, total: 0, earned: 0, best: null, xp: 0, streak: 0, perfect: 0, chests: 0, quests: null});
const fiHour = () => (fiSave().clock / 60) % 24;
const fiPhase = h => h >= 5 && h < 8 ? 'A' : h >= 8 && h < 18 ? 'J' : h >= 18 && h < 21 ? 'A' : 'N';
const fiPhaseName = h => h >= 5 && h < 8 ? 'Aube' : h >= 8 && h < 18 ? 'Jour' : h >= 18 && h < 21 ? 'Crépuscule' : 'Nuit';
const FI_WNAMES = {clair: 'Ciel clair', nuageux: 'Nuageux', pluie: 'Pluie', orage: 'Orage', brouillard: 'Brouillard', neige: 'Neige'};
function fiNewWeather() {
  const s = fiSave(), opts = Object.entries(FI_SPOTS[s.spot].weather); let r = Math.random() * opts.reduce((a, o) => a + o[1], 0);
  s.weather = opts.find(o => (r -= o[1]) < 0)[0]; s.wUntil = s.clock + 120 + Math.floor(Math.random() * 240);
}
const fiWeatherOk = (f, w) => f.weather === '*' || (f.weather === 'P' && (w === 'pluie' || w === 'orage')) || (f.weather === 'S' && w === 'clair') || (f.weather === 'N' && w === 'neige');
const fiTimeOk = (f, h) => f.time === '*' || f.time.includes(fiPhase(h));
function fiPick(power) {  // which fish bites: place, hour, weather, bait, rod and how far you cast
  const s = fiSave(), h = fiHour(), rod = FI_RODS[s.rod];
  const pool = FISH.filter(f => f.spots.includes(s.spot) && fiTimeOk(f, h) && fiWeatherOk(f, s.weather) && (f.rarity < 5 || s.rod >= 3));
  const ws = pool.map(f => FI_RARITY[f.rarity][2] * (f.likes.includes(s.bait) ? 2.6 : 1) * (f.rarity >= 3 ? (1 + (rod.luck + fiLevel().luck) * f.rarity) * (.6 + power * .8) : 1));
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  return pool[ws.findIndex(w => (r -= w) < 0)] || pool[0];
}
// angler level from the experience: each level reels a little faster and brings a little more luck with the rare fish
const fiLevel = (xp = fiSave().xp || 0) => { const lv = Math.floor(Math.sqrt(xp / 60)) + 1, cur = 60 * (lv - 1) ** 2, next = 60 * lv ** 2; return {lv, k: (xp - cur) / (next - cur), reel: Math.min(.4, (lv - 1) * .02), luck: Math.min(.3, (lv - 1) * .015)}; };
// three challenges a day (the same all day), rewarded in coins and experience
const FI_QUESTS = [
  ['catch', n => 'Pêcher ' + n + ' poissons', [5, 8, 12]], ['rare', n => 'Pêcher ' + n + ' poisson' + (n > 1 ? 's' : '') + ' rare' + (n > 1 ? 's' : '') + ' ou mieux', [1, 2]],
  ['perfect', n => 'Réussir ' + n + ' ferrages parfaits', [3, 5]], ['big', n => 'Pêcher ' + n + ' poisson' + (n > 1 ? 's' : '') + ' presque à la taille maximale de son espèce', [1, 2]],
  ['new', n => 'Découvrir ' + n + ' nouvelle' + (n > 1 ? 's' : '') + ' espèce' + (n > 1 ? 's' : ''), [1, 2]], ['streak', n => 'Faire une série de ' + n + ' prises sans en rater', [4, 6]],
  ['night', n => 'Pêcher ' + n + ' poissons la nuit', [3, 5]], ['chest', () => 'Remonter un coffre au trésor', [1]],
];
function fiQuests() {
  const s = fiSave(), d = new Date(), day = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  if (s.quests?.day !== day) {
    const r = seeded(day.split('-').reduce((a, x) => a * 41 + +x, 7)), kinds = [...FI_QUESTS].sort(() => r() - .5).slice(0, 3);
    s.quests = {day, list: kinds.map(([kind, , ns]) => { const n = ns[Math.floor(r() * ns.length)]; return {kind, n, got: 0, done: false, coins: Math.round((60 + n * 35) * (1 + 'ERLCTBA'.indexOf(s.spots.at(-1)) * .4) / 10) * 10, xp: 40 + n * 15}; })};
  }
  return s.quests;
}
const fiQuestText = q => FI_QUESTS.find(x => x[0] === q.kind)[1](q.n);
function fiQuestEvent(kind, amount = 1, value) {  // something happened: the matching challenges advance
  const s = fiSave();
  for (const q of fiQuests().list) {
    if (q.done || q.kind !== kind) continue;
    q.got = kind === 'streak' ? Math.max(q.got, value) : q.got + amount;
    if (q.got >= q.n) { q.done = true; s.money += q.coins; s.xp = (s.xp || 0) + q.xp; fi.questMsg = {text: 'DÉFI RÉUSSI : ' + fiQuestText(q) + ' · +' + q.coins + ' pièces', t: 240}; sfx('launch'); }
  }
}
const fiValue = (f, cm) => Math.max(1, Math.round(FI_RARITY[f.rarity][3] * (.6 + .8 * (cm - f.min) / Math.max(1, f.max - f.min)) * (1 + 'ERLCTBA'.indexOf(f.spots[0]) * .25)));

/* ---------- the scene ---------- */
const FI = {W: 384, H: 216, WY: 108, SHORE: 92};
const FI_SKY = [[0, '#06041a', '#141038'], [4.5, '#0a0828', '#2a1a50'], [6, '#4a3a8a', '#f08a6a'], [8, '#3a7ad0', '#9ad0f0'], [12, '#2a6ac8', '#8ac8f0'], [17, '#3a6ac0', '#a0c8e8'], [19, '#4a2a7a', '#ff8a5a'], [20.5, '#1a1040', '#5a2a6a'], [22, '#06041a', '#141038'], [24, '#06041a', '#141038']];
function fiSkyAt(h) { const i = FI_SKY.findIndex(k => k[0] > h), a = FI_SKY[i - 1], b = FI_SKY[i], k = (h - a[0]) / (b[0] - a[0]); return [mixc(a[1], b[1], k), mixc(a[2], b[2], k)]; }
const fiDisc = (g, x, y, r, c) => { for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); px(g, c, x - w, y + dy, w * 2, 1); } };
const fiNight = h => h >= 21 || h < 4.5 ? .62 : h < 7 ? .62 * (7 - h) / 2.5 : h > 19 ? .62 * (h - 19) / 2 : 0;
function fiDecor(spot) {  // the far landscape, drawn once per place
  const c = document.createElement('canvas'); c.width = FI.W; c.height = FI.WY; const g = c.getContext('2d'), r = seeded(spot.charCodeAt(0) * 101);
  const ridge = (base, amp, col, rough) => { g.fillStyle = col; for (let x = 0; x < FI.W; x++) { const y = base - amp * (Math.sin(x / 47 + r() * .05 + base) * .5 + Math.sin(x / 19 + base * 2) * .3 * rough + .5); g.fillRect(x, Math.round(y), 1, FI.WY - y); } };
  const d = FI_SPOTS[spot].decor;
  if (d === 'saules' || d === 'collines') {
    ridge(96, 14, '#2c4a3a', .4); ridge(102, 8, '#1f3a2c', .6);
    for (let i = 0; i < (d === 'saules' ? 7 : 4); i++) {  // trees
      const x = 110 + r() * 270, h = 18 + r() * 14;
      g.fillStyle = '#3a2a1c'; g.fillRect(Math.round(x), Math.round(FI.WY - h * .5), 2, Math.round(h * .5));
      for (let k = 0; k < 60; k++) { const a = r() * Math.PI * 2, rr = r() * h * .4; g.fillStyle = r() < .5 ? '#2f5a3a' : '#3f7046'; g.fillRect(Math.round(x + Math.cos(a) * rr * (d === 'saules' ? 1.1 : .8)), Math.round(FI.WY - h * .55 + Math.sin(a) * rr * .7 + (d === 'saules' && Math.sin(a) > 0 ? rr * .6 : 0)), 2, 2); }
    }
  }
  if (d === 'montagnes') {
    for (const [base, amp, col, snow] of [[70, 50, '#5a6a9a', true], [92, 36, '#3a4a78', false], [104, 12, '#2a3a5a', false]]) {
      const peaks = Array.from({length: 4}, () => [r() * FI.W, amp * (.6 + r() * .4)]);
      for (let x = 0; x < FI.W; x++) { const y = base - Math.max(...peaks.map(([px0, a]) => a - Math.abs(x - px0) * .9)), top = Math.round(Math.min(base, y)); g.fillStyle = col; g.fillRect(x, top, 1, FI.WY - top); if (snow && base - y > amp * .55) { g.fillStyle = '#e6eeff'; g.fillRect(x, top, 1, Math.round((base - y - amp * .55) * .6) + 1); } }
    }
  }
  if (d === 'falaises') { ridge(84, 30, '#4a3c4a', 1.2); ridge(98, 14, '#3a2e3c', 1); g.fillStyle = '#e6dcff'; g.fillRect(330, 70, 6, 30); g.fillStyle = '#ff4f6d'; g.fillRect(330, 74, 6, 4); g.fillRect(330, 84, 6, 4); g.fillStyle = '#ffd07a'; g.fillRect(331, 66, 4, 4); }  // a lighthouse
  if (d === 'palmiers') {
    g.fillStyle = '#e8d090'; for (let x = 200; x < 360; x++) { const y = 102 - Math.sin((x - 200) / 160 * Math.PI) * 8; g.fillRect(x, Math.round(y), 1, FI.WY - y); }
    g.fillStyle = '#3a8a4a'; for (let x = 215; x < 345; x++) { const y = 100 - Math.sin((x - 215) / 130 * Math.PI) * 12; g.fillRect(x, Math.round(y), 1, 3); }
    for (const x of [240, 285, 318]) { g.fillStyle = '#8a5a2a'; for (let i = 0; i < 22; i++) g.fillRect(Math.round(x + Math.sin(i / 7) * 3), 98 - i, 2, 1); g.fillStyle = '#3faa4a'; for (const a of [-2.6, -2, -1.2, -.6, 0]) for (let i = 0; i < 12; i++) g.fillRect(Math.round(x + Math.cos(a) * i), Math.round(76 + Math.sin(a) * i * .5 + i * i * .04), 2, 1); }
  }
  if (d === 'large') { g.fillStyle = '#1a1438'; for (let x = 0; x < FI.W; x++) g.fillRect(x, FI.WY - 2 - Math.round(Math.sin(x / 31) * 1.5), 1, 4); }
  if (d === 'icebergs') { for (const [x, w, h] of [[150, 60, 26], [260, 40, 16], [330, 70, 34]]) { g.fillStyle = '#d6e6ff'; for (let i = 0; i < w; i++) { const y = FI.WY - h * Math.min(1, Math.min(i, w - i) / (w * .35)) * (.88 + .12 * ((i >> 2) % 2)); g.fillRect(x + i, Math.round(y), 1, FI.WY - y); } g.fillStyle = '#a6c0e8'; g.fillRect(x + w * .6, FI.WY - h * .7, w * .25, h * .7); } }
  const px = g.getImageData(0, 0, FI.W, FI.WY).data;
  c.horizon = Array.from({length: FI.W}, (_, x) => { for (let y = 0; y < FI.WY; y++) if (px[(y * FI.W + x) * 4 + 3]) return y; return FI.WY; });  // stars and moon stay above it
  return c;
}
function fiStart() {
  fi = fi || {raf: 0};
  const s = fiSave();
  Object.assign(fi, {g: $('fiCanvas').getContext('2d'), mode: 'play', tick: 0, phase: 'idle', power: 0, bob: null, msg: null, shadows: [], rain: [], decor: fiDecor(s.spot), decorSpot: s.spot, flash: 0, card: null, holding: false,
    stars: Array.from({length: 80}, () => [Math.random() * FI.W, Math.random() * 80, Math.random()]), clouds: Array.from({length: 6}, () => [Math.random() * FI.W, 8 + Math.random() * 40, 20 + Math.random() * 30])});
  for (let i = 0; i < 6; i++) fi.shadows.push({x: 130 + Math.random() * 240, y: FI.WY + 20 + Math.random() * 80, vx: (Math.random() - .5) * .3, w: 8 + Math.random() * 16});
  fiUi(); gameLoop(fi, 'neodyme:fishing', fiUpdate, fiDraw);
}
function fiSay(text, color = '#ffffff', t = 150) { fi.msg = {text, color, t}; }
function fiPress(down) {
  if (!fi) return;
  fi.holding = down;
  if (fi.mode !== 'play') { if (down) fi.mode = 'play'; return; }
  const s = fiSave();
  if (down && fi.card) { fi.card = null; fi.phase = 'idle'; return; }
  if (fi.phase === 'idle' && down) {
    if (s.bait !== 'p' && !(s.baits[s.bait] > 0)) { s.bait = 'p'; fiUi(); fiSay('Plus d\'appât : retour au pain', '#ffd07a'); }
    fi.phase = 'charge'; fi.power = 0; fi.pdir = 1; return;
  }
  if (fi.phase === 'charge' && !down) {  // release: cast
    fi.phase = 'cast'; fi.castT = 0; fi.target = 120 + fi.power * 245; fi.castPower = fi.power; sfx('click');
    if (s.bait !== 'p') { s.baits[s.bait]--; fiUi(); }
    return;
  }
  if (fi.phase === 'wait' && down && fi.nibble) { fi.biteIn += 240 + Math.random() * 240; fi.nibble = 0; fiSay('Trop tôt ! Ce n\'était qu\'une touche : le poisson se méfie', '#ffd07a', 120); sfx('error'); return; }
  if (fi.phase === 'wait' && down) { fi.phase = 'idle'; fi.bob = null; fiSay('Ligne remontée', '#8f7bb8', 60); return; }
  if (fi.phase === 'bite' && down) {  // strike in time: the fight starts
    const f = fi.fish, k = (fi.cm - f.min) / Math.max(1, f.max - f.min);
    const perfect = fi.biteMax - fi.biteT <= 14;  // struck within a quarter of a second
    fi.phase = 'fight'; fi.T = .35; fi.D = .35 + fi.castPower * .65; fi.slack = 0; fi.rush = false; fi.rushT = 60; fi.stam = perfect ? .75 : 1; fi.perfect = perfect;
    fi.S = fi.special ? .25 : .3 + f.rarity * .13 + k * .15 + ('sey'.includes(f.shape) ? .1 : 0); fi.erratic = 'lc'.includes(f.shape) ? 1.6 : 1;
    fi.dir = 0; fi.dirT = 40; fi.fx = 0; fi.jump = 0; fi.jumpy = !fi.special && 'fgseaw'.includes(f.shape) && f.min >= 25; fi.steer = fi.steer || 0;
    if (perfect) { fi.D -= .08; s.perfect = (s.perfect || 0) + 1; fiQuestEvent('perfect'); }
    sfx('open'); fiSay(perfect ? 'FERRAGE PARFAIT ! Il est déjà fatigué' : 'Ferré ! Maintiens pour remonter, contre ses départs avec ← →', perfect ? '#8ee8a0' : '#ffd07a', 140); return;
  }
}
// One 1/60 s step of the fight; returns 'win', 'break', 'escape' or null. The fish runs left or right: pulling the other way
// (← → or the mouse) reels faster with less tension and tires it; pulling the same way strains the line. Big sporty fish jump:
// hold during a jump and the tension soars, give slack and it tires. A worn-out fish (no stamina left) comes in fast.
function fiFightStep(hold) {
  const rod = FI_RODS[fiSave().rod], lv = fiLevel(), S = fi.S * (.55 + .45 * fi.stam), tired = fi.stam <= 0;
  if (--fi.rushT <= 0) {
    fi.rush = tired ? false : !fi.rush; fi.rushT = fi.rush ? (25 + Math.random() * 60) * (.6 + S) : (50 + Math.random() * 120) / (fi.erratic * (.6 + S));
    if (fi.rush) { fi.dir = Math.random() < .5 ? -1 : 1; fi.dirT = fi.rushT; if (fi.jumpy && Math.random() < .4) { fi.jump = 48; fi.jumpHeld = false; } }
  }
  if (--fi.dirT <= 0) { fi.dir = tired ? 0 : [-1, 0, 1][Math.floor(Math.random() * 3)]; fi.dirT = 50 + Math.random() * 100; }
  const good = fi.dir && fi.steer === -fi.dir, bad = fi.dir && fi.steer === fi.dir;
  let dT = hold ? (.0045 + S * .0105 * (fi.rush ? 1.9 : .55)) / rod.str : -.013, dD = hold ? -.0038 * rod.reel * (1 + lv.reel) * (fi.rush ? .15 : 1) / (.7 + S * .6) : fi.rush ? S * .006 : .0005;
  if (good) { if (hold) { dT *= .6; dD *= 1.5; } else dD *= .6; fi.stam -= .0009; }
  if (bad && hold) dT *= 1.5;
  if (tired) { if (hold) { dD *= 1.8; dT *= .6; } else dD *= .4; }
  if (fi.jump > 0) { if (hold) { dT += .012; fi.jumpHeld = true; } if (--fi.jump === 0 && !fi.jumpHeld) { fi.stam -= .12; fiSay('Saut maîtrisé ! Il fatigue', '#8ee8a0', 90); } }
  fi.T += dT; fi.D += dD;
  if (fi.rush && hold) fi.stam -= .0012;
  fi.stam = Math.max(0, fi.stam);
  fi.fx = Math.max(-46, Math.min(46, (fi.fx || 0) + fi.dir * (fi.rush ? .7 : .3) - (fi.fx || 0) * .015));  // where the fish swims
  fi.T = Math.max(0, fi.T);
  fi.slack = fi.T < .06 ? fi.slack + 1 : 0;
  if (fi.T >= 1) return 'break';
  if (fi.D >= 1.15 || fi.slack > 100) return 'escape';
  if (fi.D <= 0) return 'win';
  return null;
}
const FI_SPECIAL = {
  chest: {name: 'Coffre au trésor', color: '#ffd07a', rows: ['..oooooooo..', '.oyyyyyyyyo.', 'oybbbbbbbbyo', 'oyyyyyyyyyyo', 'ooooowwooooo', 'obbbbwwbbbbo', 'obbbbbbbbbbo', 'oyyyyyyyyyyo', 'oooooooooooo'], pal: {o: '#3a2a1c', y: '#ffd07a', b: '#8a5a2a', w: '#fff0c8'}},
  junk: {name: 'Vieille botte', color: '#8f7bb8', rows: ['....oooo....', '....obbo....', '....obbo....', '....obbo....', '....obbo....', '...obbbbo...', '..obbbbbbooo', '.obbbbbbbbbo', 'oooooooooooo'], pal: {o: '#1c1238', b: '#5e4d85'}},
};
function fiLandSpecial(kind) {
  const s = fiSave(), lv = fiLevel().lv, coins = kind === 'chest' ? 150 + Math.round(Math.random() * 120) * lv : 5, xp = kind === 'chest' ? 40 : 5;
  let extra = '';
  if (kind === 'chest') { const k = ['v', 'a', 'c', 'l', 'k', 'g'][Math.floor(Math.random() * 6)]; s.baits[k] = (s.baits[k] || 0) + 5; extra = '+ 5 ' + FI_BAITS[k].name.toLowerCase(); s.chests = (s.chests || 0) + 1; fiQuestEvent('chest'); }
  s.money += coins; s.earned += coins; s.xp = (s.xp || 0) + xp;
  fi.card = {special: kind, val: coins, extra, t: 0, xp};
  saveGames(); sfx(kind === 'chest' ? 'launch' : 'notify'); fiUi();
}
function fiLand() {
  if (fi.special) return fiLandSpecial(fi.special);
  const s = fiSave(), f = fi.fish, cm = fi.cm, d = s.dex[f.id], isNew = !d, lv0 = fiLevel().lv;
  s.streak = (s.streak || 0) + 1;
  const mult = 1 + Math.min(.5, (s.streak - 1) * .1), val = Math.round(fiValue(f, cm) * mult), xp = Math.round((8 + f.rarity ** 2 * 6) * (isNew ? 2 : 1) * (fi.perfect ? 1.3 : 1));
  s.xp = (s.xp || 0) + xp;
  fiQuestEvent('catch'); if (f.rarity >= 3) fiQuestEvent('rare'); if (isNew) fiQuestEvent('new'); fiQuestEvent('streak', 0, s.streak);
  if (cm >= f.min + (f.max - f.min) * .9) fiQuestEvent('big'); if (fiPhase(fiHour()) === 'N') fiQuestEvent('night');
  s.dex[f.id] = {n: (d?.n || 0) + 1, best: Math.max(d?.best || 0, cm), t: d?.t || Date.now()};
  s.money += val; s.total++; s.earned += val;
  if (!s.best || f.rarity > s.best.rarity || (f.rarity === s.best.rarity && cm > s.best.cm)) s.best = {id: f.id, cm, rarity: f.rarity};
  fi.card = {f, cm, val, isNew, rec: !isNew && cm > d.best, t: 0, xp, mult, up: fiLevel().lv > lv0};
  saveGames(); sfx(isNew ? 'launch' : 'notify'); fiUi();
}
function fiUpdate() {
  const s = fiSave();
  if (fi.tick % 60 === 0) { s.clock += 1; if (s.clock >= s.wUntil) { fiNewWeather(); fiUi(); } if (fi.tick % 1800 === 0) saveGames(); }  // 1 s = 1 minute in the game
  if (fi.decorSpot !== s.spot) { fi.decor = fiDecor(s.spot); fi.decorSpot = s.spot; }
  if (fi.msg && --fi.msg.t <= 0) fi.msg = null;
  if (fi.flash) fi.flash--;
  if (s.weather === 'orage' && Math.random() < .002) fi.flash = 10;
  for (const sh of fi.shadows) { sh.x += sh.vx; if (sh.x < 110 || sh.x > FI.W + 10) sh.vx = -sh.vx; if (Math.random() < .005) sh.vx = (Math.random() - .5) * .4; }
  const pr = s.weather === 'pluie' || s.weather === 'orage' ? 3 : s.weather === 'neige' ? 1 : 0;
  for (let i = 0; i < pr; i++) fi.rain.push({x: Math.random() * (FI.W + 40), y: -4, snow: s.weather === 'neige'});
  for (const p of fi.rain) { if (p.splash) { p.y += p.vy; p.vy += .2; continue; } p.y += p.snow ? .6 : 5; p.x += p.snow ? Math.sin((p.y + p.x) / 9) * .3 : -1.5; }
  fi.rain = fi.rain.filter(p => p.splash ? p.y <= FI.WY : p.y < (p.snow ? FI.H : FI.WY + 4 + Math.random() * 60));
  if (fi.phase === 'charge') { fi.power += fi.pdir * .018; if (fi.power >= 1) { fi.power = 1; fi.pdir = -1; } if (fi.power <= 0) { fi.power = 0; fi.pdir = 1; } }
  if (fi.phase === 'cast') {
    fi.castT += 1 / 40; const k = Math.min(1, fi.castT), x0 = 100, x1 = fi.target;
    fi.bob = {x: x0 + (x1 - x0) * k, y: 70 + (FI.WY - 70) * k - Math.sin(k * Math.PI) * 50};
    if (k >= 1) { fi.phase = 'wait'; fi.bob = {x: x1, y: FI.WY}; fi.biteIn = (180 + Math.random() * 540) * FI_BAITS[s.bait].wait; fi.nibble = 0; for (let i = 0; i < 6; i++) fi.rain.push({x: x1 + (Math.random() - .5) * 8, y: FI.WY - 1, vy: -1 - Math.random() * 1.5, splash: true}); sfx('click'); }
  }
  if (fi.phase === 'wait') {
    if (--fi.biteIn <= 0) { fi.fish = fiPick(fi.castPower); const f = fi.fish; fi.cm = Math.round((f.min + (f.max - f.min) * Math.random() ** 1.6) * 10) / 10; fi.phase = 'bite'; fi.biteT = fi.biteMax = Math.round(60 - fi.fish.rarity * 5); const sp = Math.random(); fi.special = sp < .03 ? 'chest' : sp < .07 ? 'junk' : null; sfx('notify'); }
    else if (Math.random() < .006) fi.nibble = 12;  // a false alarm
    if (fi.nibble) fi.nibble--;
  }
  if (fi.phase === 'bite' && --fi.biteT <= 0) { fi.phase = 'idle'; fi.bob = null; s.streak = 0; fiSay('Trop tard… il s\'est échappé', '#ff4f6d'); sfx('error'); }
  if (fi.phase === 'fight') {
    const r = fiFightStep(fi.holding);
    fi.bob = {x: Math.max(110, Math.min(FI.W - 8, 100 + fi.D * (fi.target - 100) + fi.fx)), y: FI.WY + Math.sin(fi.tick / 3) * (fi.rush ? 2 : .6)};
    if (r === 'win') { fi.phase = 'landed'; fi.bob = null; fiLand(); }
    if (r === 'break' || r === 'escape') s.streak = 0;
    if (r === 'break') { fi.phase = 'idle'; fi.bob = null; fiSay('Le fil a cassé ! Relâche quand la tension monte', '#ff4f6d', 200); sfx('error'); }
    if (r === 'escape') { fi.phase = 'idle'; fi.bob = null; fiSay('Le poisson s\'est décroché…', '#ff4f6d', 160); sfx('error'); }
  }
  if (fi.card) fi.card.t++;
  if (fi.questMsg && --fi.questMsg.t <= 0) fi.questMsg = null;
}
function fiFisher(g, x, y, pose) {  // 12 x 18, standing on the shore
  const P = {o: '#130a20', h: '#ffd07a', H: '#b8641c', s: '#f0c8a0', j: '#ff5ad9', J: '#8a1a7a', p: '#2b2468', b: '#3a2a1c'};
  const rows = ['...hhhhh....', '..HHHHHHH...', '...ossso....', '...sssss....', '....sss.....', '...jjjjj....', '..jjJjjjj...', '..jJjjjjj' + (pose ? 's' : '.') + '..', '..jjjjjjj...', '...jjjjj....', '...ppppp....', '...pp.pp....', '...pp.pp....', '...pp.pp....', '...bb.bb....'];
  sprite(g, rows, x, y, P);
}
function fiLine(g, x0, y0, x1, y1, color, w = 1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) px(g, color, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, w, w); }
function fiUnder(g, spot, key) {  // sous l'eau : rayons de lumière, fond sableux, algues qui ondulent, bulles qui montent
  const {W, H, WY} = FI, [w1, , w3] = spot.water, t = fi.tick;
  for (let i = 0; i < 4; i++) { const x = (i * 97 + 30 + Math.sin(t / 150 + i) * 10) % W; for (let y = WY + 1; y < H - 22; y += 2) px(g, 'rgba(255,255,255,.045)', x + (y - WY) / 5, y, 7 + i, 2); }
  const sand = spot.dark ? '#1a2250' : key === 'B' ? '#8fb2d2' : key === 'T' ? '#e8d8a0' : '#6a6a5a';
  for (let x = 0; x < W; x += 2) { const h = 14 + Math.round(Math.sin(x / 23) * 3 + Math.sin(x / 7) * 1.2); px(g, mixc(sand, w3, .35), x, H - h, 2, h); px(g, sand, x, H - h, 2, 1); }
  const kelp = key === 'B' ? '#6ac0c0' : key === 'T' ? '#f08a9a' : spot.dark ? '#2a6a8a' : '#4a9a5a';
  for (let i = 0; i < 12; i++) { const bx = 100 + ((i * 53) % (W - 110)), len = 10 + (i * 7) % 16; for (let j = 0; j < len; j += 2) px(g, mixc(kelp, w3, j / len * .6), bx + Math.sin(t / 30 + i + j / 5) * (1 + j / 8), H - 14 - j, 2, 2); }
  if (key === 'T') for (const x of [150, 230, 300]) { px(g, '#ff6a8a', x, H - 20, 8, 6); px(g, '#ffb06a', x + 2, H - 24, 4, 4); }
  for (let i = 0; i < 10; i++) { const y = H - ((t * (.12 + i % 4 * .04) + i * 31) % (H - WY)), x = 110 + (i * 71) % (W - 120) + Math.sin(t / 20 + i) * 2; px(g, 'rgba(255,255,255,.4)', x, y, 1 + i % 2, 1 + i % 2); }
}
function fiDraw() {
  const g = fi.g, {W, H, WY} = FI, s = fiSave(), h = fiHour(), spot = FI_SPOTS[s.spot], night = Math.max(fiNight(h), spot.dark ? .45 : 0), [top, bot] = fiSkyAt(h);
  for (let y = 0; y < WY; y += 4) { const k = y / WY; g.fillStyle = mixc(top, bot, Math.round(k * 8) / 8); g.fillRect(0, y, W, 4); }  // banded sky
  const sunA = ((h - 6) / 12) * Math.PI, moonA = ((h - 18 + (h < 6 ? 24 : 0)) / 12) * Math.PI;
  if (h >= 5.5 && h <= 18.5) { const x = 30 + (W - 60) * (h - 6) / 12, y = 90 - Math.sin(sunA) * 70; fiDisc(g, x, y, 9, 'rgba(255,208,122,.22)'); fiDisc(g, x, y, 6, '#ffd07a'); fiDisc(g, x - 1, y - 1, 4, '#fff0c8'); }
  g.drawImage(fi.decor, 0, 0);
  const [w1, w2, w3] = spot.water;  // water: three bands, shimmer lines, light reflection
  for (let y = WY; y < H; y += 2) { const k = (y - WY) / (H - WY); g.fillStyle = k < .3 ? mixc(w1, w2, k / .3) : mixc(w2, w3, (k - .3) / .7); g.fillRect(0, y, W, 2); }
  for (let i = 0; i < 40; i++) { const y = WY + 2 + (i * 37) % (H - WY - 4), x = ((i * 91 + fi.tick * (spot.flow ? .6 : .15) * (1 + i % 3)) % (W + 40)) - 20; px(g, 'rgba(255,255,255,.12)', x, y, 6 + i % 5, 1); }
  px(g, mixc(w1, '#ffffff', .35), 0, WY, W, 1);
  fiUnder(g, spot, s.spot);
  if (h >= 6 && h <= 18) { const x = 30 + (W - 60) * (h - 6) / 12; for (let y = WY + 2; y < WY + 40; y += 3) px(g, 'rgba(255,240,200,.35)', x - 4 + Math.sin(y + fi.tick / 10) * 3, y, 8 - (y - WY) / 8, 1); }
  for (const sh of fi.shadows) { g.fillStyle = 'rgba(5,1,20,.22)'; g.fillRect(Math.round(sh.x - sh.w / 2), Math.round(sh.y), Math.round(sh.w), 3); g.fillRect(Math.round(sh.x - sh.w / 2 - (sh.vx > 0 ? 3 : -sh.w)), Math.round(sh.y - 1), 3, 5); }
  if (fi.phase === 'fight' && fi.bob && fi.jump > 0 && !fi.special) {  // the fish leaps out of the water
    const art = fiArt(fi.fish), k = 1 - fi.jump / 48, jy = WY - 6 - Math.sin(k * Math.PI) * 30, sc = Math.max(1, Math.min(2, Math.floor(40 / art.width)));
    g.save(); g.translate(Math.round(fi.bob.x), Math.round(jy)); g.rotate((k - .5) * (fi.dir || 1) * 1.2); g.imageSmoothingEnabled = false; g.drawImage(art, -art.width * sc / 2, -art.height * sc / 2, art.width * sc, art.height * sc); g.restore();
    if (fi.jump > 44 || fi.jump < 4) for (let i = 0; i < 6; i++) px(g, '#ffffff', fi.bob.x - 10 + Math.random() * 20, WY - Math.random() * 6, 1, 2);
  }
  if (fi.phase === 'fight' && fi.bob) { g.fillStyle = 'rgba(5,1,20,.45)'; g.fillRect(Math.round(fi.bob.x - 10), WY + 6, 20, 4); if (fi.rush && fi.tick % 6 < 3) for (let i = 0; i < 4; i++) px(g, '#ffffff', fi.bob.x - 8 + Math.random() * 16, WY - 2 - Math.random() * 4, 1, 1); }
  if (fi.phase === 'wait' && fi.biteIn < 120 && fi.bob) { g.fillStyle = 'rgba(5,1,20,.3)'; g.fillRect(Math.round(fi.bob.x - 30 + (120 - fi.biteIn) / 4.6), WY + 10, 12, 3); }
  // the shore and the angler
  const sh = spot.shore, SX = FI.SHORE;
  if (sh === 'wood') { px(g, '#3a2a1c', 0, WY - 6, SX, 6); px(g, '#8a5a2a', 0, WY - 8, SX, 3); for (let x = 2; x < SX; x += 8) px(g, '#6a4220', x, WY - 8, 1, 3); for (const x of [10, 44, 78]) px(g, '#2a1c10', x, WY - 3, 4, 20); }
  if (sh === 'rock') { for (let i = 0; i < 9; i++) { const x = i * 11, hh = 10 + (i * 7) % 9; px(g, '#4a3c4a', x, WY - hh, 14, hh + 10); px(g, '#6a5a6a', x + 2, WY - hh, 8, 2); } }
  if (sh === 'ice') { px(g, '#d6e6ff', 0, WY - 10, SX + 6, 14); px(g, '#ffffff', 0, WY - 10, SX + 6, 2); px(g, '#a6c0e8', 0, WY + 2, SX + 6, 3); }
  if (sh === 'boat') { px(g, '#3a2a1c', 4, WY - 8, SX, 10); px(g, '#8a5a2a', 0, WY - 10, SX + 8, 3); px(g, '#6a4220', 14, WY - 2, SX - 20, 3); px(g, '#2a1c10', 10, WY - 30, 2, 22); px(g, (fi.tick >> 4) % 2 ? '#ffd07a' : '#ffbf5a', 8, WY - 34, 6, 5); g.fillStyle = 'rgba(255,208,122,.12)'; g.beginPath(); g.arc(11, WY - 31, 22, 0, Math.PI * 2); g.fill(); }
  const fx = 64, fy = WY - 8 - 15, pose = fi.phase === 'charge' ? 1 : 0;
  fiFisher(g, fx, fy, pose);
  const hand = [fx + 9, fy + 7], ang = fi.phase === 'charge' ? -2.2 - fi.power * .6 : fi.phase === 'fight' ? -.35 - (fi.T || 0) * .5 + (fi.rush ? Math.sin(fi.tick / 2) * .08 : 0) : -.75;
  const tip = [hand[0] + Math.cos(ang) * 34, hand[1] + Math.sin(ang) * 34];
  fiLine(g, hand[0], hand[1], tip[0], tip[1], '#6a4220', 2); fiLine(g, hand[0] + (tip[0] - hand[0]) * .6, hand[1] + (tip[1] - hand[1]) * .6, tip[0], tip[1], FI_RODS[s.rod].str >= 2.2 ? '#ffd07a' : '#c9a070', 1);
  if (fi.bob) {
    const b = fi.bob, dip = fi.phase === 'bite' ? 3 + Math.sin(fi.tick) * 1.5 : fi.nibble ? 1.5 : Math.sin(fi.tick / 25) * .6, by = b.y + (fi.phase === 'wait' || fi.phase === 'bite' ? dip : 0);
    const taut = fi.phase === 'fight', col = taut ? (fi.T > .8 ? '#ff4f6d' : fi.T > .55 ? '#ffd07a' : '#e6dcff') : '#c9bdf0';
    for (let i = 0; i <= 40; i++) { const k = i / 40, sag = taut ? 0 : Math.sin(k * Math.PI) * 10; px(g, col, tip[0] + (b.x - tip[0]) * k, tip[1] + (by - tip[1]) * k + sag, 1, 1); }
    if (fi.phase !== 'fight') { px(g, '#ffffff', b.x - 1, by - 4, 3, 3); px(g, '#ff4f6d', b.x - 1, by - 2, 3, 3); }
    if (fi.phase === 'wait' && fi.tick % 90 < 30) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(b.x, WY + 1, 4 + (fi.tick % 90) / 3, 1.5, 0, 0, Math.PI * 2); g.stroke(); }
  }
  for (const p of fi.rain) { if (p.splash) { px(g, '#ffffff', p.x, p.y, 1, 1); continue; } if (p.snow) px(g, '#ffffff', p.x, p.y, 2, 2); else px(g, 'rgba(200,210,255,.6)', p.x, p.y, 1, 4); }
  if (night) { g.fillStyle = `rgba(8,4,32,${night})`; g.fillRect(0, 0, W, H); }
  const hz = fi.decor.horizon;
  if (night > .2) for (const [x, y, z] of fi.stars) if (y < hz[Math.floor(x)] - 1 && (fi.tick / 20 + z * 50) % 9 > .6) px(g, z > .7 ? '#ffffff' : '#9d8bd0', x, y, 1, 1);
  if (!(h >= 5.5 && h <= 18.5)) { const x = 30 + (W - 60) * ((h - 18 + 24) % 24) / 12, y = 90 - Math.sin(moonA) * 70; if (y + 5 < hz[Math.max(0, Math.min(W - 1, Math.round(x)))]) { fiDisc(g, x, y, 8, 'rgba(230,220,255,.12)'); fiDisc(g, x, y, 5, '#e6dcff'); px(g, '#c9bdf0', x - 2, y - 3, 2, 2); px(g, '#c9bdf0', x + 1, y + 1, 2, 2); } }
  const cloudy = {clair: 2, nuageux: 6, pluie: 6, orage: 6, brouillard: 4, neige: 6}[s.weather], grey = mixc(s.weather === 'orage' || s.weather === 'pluie' ? '#6a6a8a' : '#e6e6f6', '#0b0820', night * .85);  // clouds pass in front of the stars and the moon
  fi.clouds.slice(0, cloudy).forEach(cl => { cl[0] = (cl[0] + .04) % (W + 60); const x = cl[0] - 30, y = cl[1], w = cl[2]; px(g, mixc(grey, top, .3), x, y + 3, w, 5); px(g, grey, x + 4, y, w - 10, 5); px(g, grey, x + w * .3, y - 3, w * .4, 4); });
  if (s.weather === 'brouillard') { g.fillStyle = 'rgba(200,200,230,.22)'; g.fillRect(0, 50, W, 90); g.fillStyle = 'rgba(200,200,230,.12)'; g.fillRect(0, 30, W, 130); }
  if (s.weather === 'orage' || s.weather === 'pluie') { g.fillStyle = 'rgba(40,40,70,.18)'; g.fillRect(0, 0, W, H); }
  if (fi.flash) { g.fillStyle = `rgba(255,255,255,${fi.flash / 14})`; g.fillRect(0, 0, W, H); }
  if (spot.dark || night > .3) { const lan = s.spot === 'A' ? [11, WY - 31] : null; if (lan) { g.fillStyle = 'rgba(255,208,122,.18)'; g.beginPath(); g.arc(lan[0], lan[1], 26, 0, Math.PI * 2); g.fill(); } }
  // interface drawn over the scene
  px(g, 'rgba(11,3,28,.75)', 0, 0, W, 13);
  pxFont(g, String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((s.clock % 60))).padStart(2, '0') + ' · ' + fiPhaseName(h) + ' · ' + FI_WNAMES[s.weather], 4, 9, '#d9c6ff', 6);
  const lvl = fiLevel(); pxFont(g, s.money + ' pièces', W - 4, 9, '#ffd07a', 6, 'right'); pxFont(g, 'NIV ' + lvl.lv, W - 92, 9, '#8ee8a0', 6, 'right'); px(g, '#1c1238', W - 88, 5, 24, 3); px(g, '#8ee8a0', W - 88, 5, 24 * lvl.k, 3);
  if ((s.streak || 0) >= 2 && fi.phase !== 'fight') pxFont(g, 'SÉRIE ×' + s.streak + ' (+' + Math.min(50, (s.streak - 1) * 10) + ' %)', 4, 21, '#ffd07a', 6);
  if (fi.phase === 'idle' && !fi.card && !fi.msg) pxFont(g, 'Maintiens clic ou espace pour lancer', W / 2, H - 8, '#ffffff', 6, 'center');
  if (fi.phase === 'charge') { px(g, '#05010b', W / 2 - 61, H - 16, 122, 9); px(g, '#2a1d52', W / 2 - 60, H - 15, 120, 7); px(g, fi.power > .8 ? '#ff5ad9' : '#7fe0ee', W / 2 - 60, H - 15, 120 * fi.power, 7); pxFont(g, 'Relâche pour lancer · plus loin = plus gros', W / 2, H - 20, '#ffffff', 6, 'center'); }
  if (fi.phase === 'wait') pxFont(g, 'Patience… (clic : remonter la ligne)', W / 2, H - 8, '#c9bdf0', 6, 'center');
  if (fi.phase === 'bite') { pxFont(g, '!', fx + 6, fy - 6, '#ffd07a', 12, 'center'); pxFont(g, 'ÇA MORD ! CLIQUE !', W / 2, H - 10, '#ffd07a', 9, 'center'); }
  if (fi.phase === 'fight') {
    const gx = W / 2 - 70, gy = H - 22;  // tension gauge with its danger zone, then the distance left
    px(g, '#05010b', gx - 1, gy - 1, 142, 9); px(g, '#1c1238', gx, gy, 140, 7); px(g, 'rgba(255,79,109,.35)', gx + 112, gy, 28, 7); px(g, 'rgba(255,79,109,.2)', gx, gy, 8, 7);
    px(g, fi.T > .8 ? '#ff4f6d' : fi.T > .55 ? '#ffd07a' : '#8ee8a0', gx, gy, Math.min(140, fi.T * 140), 7);
    pxFont(g, 'TENSION', gx - 4, gy + 6, '#d9c6ff', 6, 'right');
    px(g, '#1c1238', gx, gy + 10, 140, 3); px(g, '#7fe0ee', gx, gy + 10, Math.max(0, Math.min(1, 1 - fi.D)) * 140, 3);
    px(g, '#1c1238', gx, gy + 15, 140, 2); px(g, fi.stam <= 0 ? '#8ee8a0' : '#ff9a3c', gx, gy + 15, Math.max(0, fi.stam) * 140, 2); pxFont(g, fi.stam <= 0 ? 'ÉPUISÉ' : 'FORCE', gx - 4, gy + 18, fi.stam <= 0 ? '#8ee8a0' : '#ff9a3c', 5, 'right');
    if (fi.dir && fi.bob) {  // where it runs: a pixel arrow above it, green once you pull the other way
      const ax = Math.round(fi.bob.x + fi.dir * 14), ay = WY - 14, c = fi.steer === -fi.dir ? '#8ee8a0' : fi.steer === fi.dir ? '#ff4f6d' : '#ffffff';
      for (let i = 0; i < 5; i++) px(g, c, ax + fi.dir * i, ay - 4 + i, 1, 9 - i * 2);
      px(g, c, ax - fi.dir * 6, ay - 1, 6 * 1, 3);
    }
    const tip = fi.jump > 0 ? ['IL SAUTE ! RELÂCHE !', '#ff4f6d'] : fi.rush ? ['IL TIRE ! RELÂCHE' + (fi.dir ? ' OU CONTRE ' + (fi.dir > 0 ? '<' : '>') : ''), '#ff4f6d'] : fi.stam <= 0 ? ['IL EST ÉPUISÉ : REMONTE !', '#8ee8a0'] : fi.dir ? ['Il part ' + (fi.dir > 0 ? 'à droite : contre avec <' : 'à gauche : contre avec >'), '#ffd07a'] : [fi.holding ? 'Remonte…' : 'Maintiens pour remonter', '#ffffff'];
    pxFont(g, tip[0], W / 2, gy - 5, tip[1], 7, 'center');
  }
  if (fi.msg) pxFont(g, fi.msg.text, W / 2, H - 8, fi.msg.color, 6, 'center');
  if (fi.questMsg) { px(g, 'rgba(11,3,28,.85)', 0, 14, W, 12); pxFont(g, fi.questMsg.text, W / 2, 23, '#8ee8a0', 6, 'center'); }
  if (fi.card?.special) {  // a chest or junk
    const c = fi.card, sp = FI_SPECIAL[c.special], bw = 200, bx = (W - bw) / 2, by = 46, bh = 104;
    px(g, '#05010b', bx - 2, by - 2, bw + 4, bh + 4); px(g, '#120922', bx, by, bw, bh); px(g, sp.color, bx, by, bw, 2);
    g.save(); g.translate(W / 2 - 18, by + 26 + Math.sin(c.t / 10) * 2); g.scale(3, 3); sprite(g, sp.rows, 0, 0, sp.pal); g.restore();
    pxFont(g, c.special === 'chest' ? 'UN TRÉSOR !' : 'Ce n\'est pas un poisson…', W / 2, by + 14, sp.color, 7, 'center');
    pxFont(g, sp.name, W / 2, by + 74, '#ffffff', 8, 'center');
    pxFont(g, '+' + c.val + ' pièces ' + c.extra + ' · +' + c.xp + ' XP', W / 2, by + 92, '#ffd07a', 6, 'center');
  }
  if (fi.card && !fi.card.special) {  // the catch
    const c = fi.card, f = c.f, [rl, rc] = FI_RARITY[f.rarity], art = fiArt(f), sc = Math.max(1, Math.min(4, Math.floor(150 / art.width))), bw = 230, bx = (W - bw) / 2, bh = 128, by = 40 - Math.max(0, 20 - c.t * 2);
    px(g, '#05010b', bx - 2, by - 2, bw + 4, bh + 4); px(g, '#120922', bx, by, bw, bh); px(g, rc, bx, by, bw, 2);
    g.imageSmoothingEnabled = false; const ax = Math.round(W / 2 - art.width * sc / 2), ay = Math.round(by + 48 - art.height * sc / 2 + Math.sin(c.t / 12) * 2);
    if (f.pattern === 'n') { g.fillStyle = f.fin + '33'; g.fillRect(ax - 6, ay - 6, art.width * sc + 12, art.height * sc + 12); }
    g.drawImage(art, ax, ay, art.width * sc, art.height * sc);
    pxFont(g, c.isNew ? 'NOUVELLE ESPÈCE !' : c.rec ? 'NOUVEAU RECORD DE TAILLE !' : 'Belle prise !', W / 2, by + 14, c.isNew ? '#ffd07a' : '#d9c6ff', 7, 'center');
    pxFont(g, f.name, W / 2, by + 90, '#ffffff', 8, 'center');
    pxFont(g, rl + ' · ' + (c.cm >= 100 ? (c.cm / 100).toFixed(2) + ' m' : c.cm + ' cm'), W / 2, by + 104, rc, 6, 'center');
    pxFont(g, '+' + c.val + ' pièces' + (c.mult > 1 ? ' (série +' + Math.round((c.mult - 1) * 100) + ' %)' : '') + ' · +' + c.xp + ' XP' + (c.up ? ' · NIVEAU ' + fiLevel().lv + ' !' : ''), W / 2, by + 118, '#ffd07a', 6, 'center');
  }
  if (fi.mode === 'pause') gameText(g, W, [['PAUSE', '#ffffff', 12], ['Clic : reprendre', '#d9c6ff']], H / 2);
}

/* ---------- shop, collection and controls (page side) ---------- */
let fiPanel = '';
function fiUi() {
  if (!games) return;
  const s = fiSave(), caught = Object.keys(s.dex).length;
  $('fiSpot').replaceChildren(...s.spots.map(k => { const o = el('option', '', FI_SPOTS[k].name); o.value = k; return o; })); $('fiSpot').value = s.spot;
  $('fiBait').replaceChildren(...Object.entries(FI_BAITS).filter(([k]) => k === 'p' || s.baits[k] > 0).map(([k, b]) => { const o = el('option', '', b.name + (k === 'p' ? '' : ' (' + s.baits[k] + ')')); o.value = k; return o; }));
  $('fiBait').value = s.bait in s.baits || s.bait === 'p' ? s.bait : 'p';
  $('fiInfo').textContent = 'Niveau ' + fiLevel().lv + ' · ' + s.money + ' pièces · ' + FI_RODS[s.rod].name + ' · collection ' + caught + ' / ' + FISH.length + ' · ' + s.total + ' prises';
  $('fiDexBtn').textContent = 'COLLECTION ' + caught + '/' + FISH.length;
  $('fiShopBtn').classList.toggle('main', fiPanel === 'shop'); $('fiDexBtn').classList.toggle('main', fiPanel === 'dex');
  $('fiShop').style.display = fiPanel === 'shop' ? '' : 'none'; $('fiDex').style.display = fiPanel === 'dex' ? '' : 'none'; $('fiQuest').style.display = fiPanel === 'quest' ? '' : 'none';
  const qs = fiQuests().list; $('fiQuestBtn').textContent = 'DÉFIS ' + qs.filter(q => q.done).length + '/' + qs.length; $('fiQuestBtn').classList.toggle('main', fiPanel === 'quest');
  if (fiPanel === 'quest') fiQuestPanel();
  if (fiPanel === 'shop') fiShop(); if (fiPanel === 'dex') fiDex();
}
function fiBuy(price, then) { const s = fiSave(); if (s.money < price) return toast('Pas assez de pièces', true); s.money -= price; then(s); saveGames(); sfx('notify'); fiUi(); }
function fiShop() {
  const s = fiSave(), card = (title, sub, label, price, on, disabled) => { const c = el('div', 'sysCard px fiItem'), b = el('button', 'btn px' + (disabled ? '' : ' main'), label); b.disabled = !!disabled || s.money < price; b.onclick = on; c.append(el('b', '', title), el('span', 'hint', sub), b); return c; };
  const rods = FI_RODS.map((r, i) => card(r.name, 'Solidité ×' + r.str + ' · moulinet ×' + r.reel + (r.luck ? ' · chance +' + Math.round(r.luck * 100) + ' %' : '') + (i >= 3 ? ' · attire les légendaires' : ''), i <= s.rod ? (i === s.rod ? 'Équipée' : 'Possédée') : 'Acheter · ' + r.price, r.price, () => fiBuy(r.price, s => s.rod = i), i <= s.rod || i > s.rod + 1));
  const baits = Object.entries(FI_BAITS).filter(([k]) => k !== 'p').map(([k, b]) => card(b.name, b.pack + ' lancers · mord ' + Math.round((1 - b.wait) * 100) + ' % plus vite · aimé par ' + FISH.filter(f => f.likes.includes(k)).length + ' espèces' + (s.baits[k] ? ' · tu en as ' + s.baits[k] : ''), 'Acheter · ' + b.price, b.price, () => fiBuy(b.price, s => { s.baits[k] = (s.baits[k] || 0) + b.pack; s.bait = k; })));
  const spots = Object.entries(FI_SPOTS).map(([k, p]) => card(p.name, FISH.filter(f => f.spots.includes(k)).length + ' espèces · ' + FISH.filter(f => f.spots.includes(k) && s.dex[f.id]).length + ' trouvées', s.spots.includes(k) ? (s.spot === k ? 'Tu y es' : 'Y aller') : 'Débloquer · ' + p.price, s.spots.includes(k) ? 0 : p.price, () => s.spots.includes(k) ? fiGo(k) : fiBuy(p.price, s => { s.spots.push(k); fiGo(k); }), s.spot === k));
  $('fiShop').replaceChildren(el('span', 'label', 'Cannes'), el('div', 'sysGrid', ''), el('span', 'label', 'Appâts'), el('div', 'sysGrid', ''), el('span', 'label', 'Lieux de pêche'), el('div', 'sysGrid', ''));
  const grids = $('fiShop').querySelectorAll('.sysGrid'); grids[0].append(...rods); grids[1].append(...baits); grids[2].append(...spots);
}
function fiGo(k) { const s = fiSave(); s.spot = k; fiNewWeather(); saveGames(); if (fi) { fi.phase = 'idle'; fi.bob = null; fi.card = null; } fiUi(); }
function fiQuestPanel() {
  const s = fiSave(), lv = fiLevel(), cards = fiQuests().list.map(q => { const c = el('div', 'sysCard px fiItem' + (q.done ? ' done' : '')); c.append(el('b', '', (q.done ? '✓ ' : '') + fiQuestText(q)), el('span', 'hint', Math.min(q.got, q.n) + ' / ' + q.n + ' · récompense ' + q.coins + ' pièces et ' + q.xp + ' XP')); return c; });
  const grid = el('div', 'sysGrid'); grid.append(...cards);
  $('fiQuest').replaceChildren(el('span', 'label', 'Défis du jour (nouveaux chaque jour)'), grid,
    el('span', 'hint', 'Pêcheur niveau ' + lv.lv + ' (' + Math.round(lv.k * 100) + ' % du suivant) · moulinet +' + Math.round(lv.reel * 100) + ' % · ' + (s.perfect || 0) + ' ferrages parfaits · ' + (s.chests || 0) + ' coffres · série actuelle ' + (s.streak || 0)),
    el('span', 'hint', 'Astuces : ferre dans le quart de seconde après la touche (parfait), ne clique pas sur les simples frémissements, contre les départs du poisson avec ← → (ou la souris à gauche / à droite), et relâche quand il saute.'));
}
let fiDexSel = null, fiDexFilter = '';
function fiDex() {
  const s = fiSave(), list = FISH.filter(f => !fiDexFilter || f.spots.includes(fiDexFilter));
  const tabs = el('div', 'row fiTabs'); for (const [k, label] of [['', 'Tout'], ...Object.entries(FI_SPOTS).map(([k, p]) => [k, p.name])]) { const b = el('button', 'btn px' + (fiDexFilter === k ? ' main' : ''), label + (k ? ' ' + FISH.filter(f => f.spots.includes(k) && s.dex[f.id]).length + '/' + FISH.filter(f => f.spots.includes(k)).length : '')); b.onclick = () => { fiDexFilter = k; fiDex(); }; tabs.append(b); }
  const grid = el('div', 'fiGrid');
  for (const f of list) {
    const d = s.dex[f.id], c = el('button', 'fiCell px' + (d ? '' : ' unknown') + (fiDexSel === f.id ? ' on' : '')), img = el('img'); img.src = fiArtUrl(f, !d, 3);
    c.style.setProperty('--rc', FI_RARITY[f.rarity][1]); c.append(img, el('span', '', d ? f.name : '???'));
    c.onclick = () => { fiDexSel = f.id; fiDex(); }; grid.append(c);
  }
  const f = FISH[fiDexSel], d = f && s.dex[f.id], det = el('div', 'sysCard px fiDetail');
  if (f) {
    const img = el('img'); img.src = fiArtUrl(f, !d, 4);
    const where = f.spots.split('').map(k => FI_SPOTS[k].name).join(', ') + ' · ' + FI_TIMES[f.time] + (FI_WEATHER[f.weather] ? ' · ' + FI_WEATHER[f.weather] : '');
    det.append(img, el('b', '', d ? f.name : 'Espèce inconnue'), el('span', 'hint', FI_RARITY[f.rarity][0] + ' · ' + where), el('span', 'hint', d ? 'Pêché ' + d.n + ' fois · record ' + d.best + ' cm · taille ' + f.min + ' à ' + f.max + ' cm · vaut environ ' + fiValue(f, (f.min + f.max) / 2) + ' pièces' : 'Taille ' + f.min + ' à ' + f.max + ' cm · appâts préférés : ' + [...f.likes].map(k => FI_BAITS[k].name).join(', ')));
  } else det.append(el('span', 'hint', 'Clique une espèce pour voir où et quand la pêcher.'));
  $('fiDex').replaceChildren(tabs, det, grid);
}
$('fiCanvas').onpointerdown = e => { e.preventDefault(); fiPress(true); const up = () => { fiPress(false); removeEventListener('pointerup', up); }; addEventListener('pointerup', up); };
$('fiSpot').onchange = () => fiGo($('fiSpot').value);
$('fiBait').onchange = () => { fiSave().bait = $('fiBait').value; saveGames(); };
$('fiShopBtn').onclick = () => { fiPanel = fiPanel === 'shop' ? '' : 'shop'; fiUi(); };
$('fiDexBtn').onclick = () => { fiPanel = fiPanel === 'dex' ? '' : 'dex'; fiUi(); };
$('fiQuestBtn').onclick = () => { fiPanel = fiPanel === 'quest' ? '' : 'quest'; fiUi(); };
document.addEventListener('keydown', e => { if (!view.classList.contains('on') || !fi || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; const k = e.key.toLowerCase(); if (['arrowleft', 'q', 'a'].includes(k)) { e.preventDefault(); fi.steer = -1; } if (['arrowright', 'd'].includes(k)) { e.preventDefault(); fi.steer = 1; } if (e.key === ' ') { e.preventDefault(); if (!e.repeat) fiPress(true); } if ((e.key === 'p' || e.key === 'Escape') && fi.mode === 'play') fi.mode = 'pause'; });
document.addEventListener('keyup', e => { if (e.key === ' ' && fi) fiPress(false); const k = e.key.toLowerCase(); if (fi && (['arrowleft', 'q', 'a'].includes(k) && fi.steer < 0 || ['arrowright', 'd'].includes(k) && fi.steer > 0)) fi.steer = 0; });
$('fiCanvas').onpointermove = e => { if (!fi || fi.phase !== 'fight' || !fi.holding || !e.pointerType.startsWith('mouse')) return; const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width; fi.steer = x < .38 ? -1 : x > .62 ? 1 : 0; };
const fiOpen = () => fi ? (fiUi(), gameLoop(fi, 'neodyme:fishing', fiUpdate, fiDraw)) : fiStart();

const aqSave = () => gstore('aquarium', {tanks: [{water: 'douce', size: 0, filter: false, feeder: false, decor: [], food: 100, dirt: 0, fish: []}], pool: [], cash: 0, last: Date.now(), gift: false, earned: 0, visitors: 0, seq: 1});
const aqKeep = (id, cm) => { const s = aqSave(); s.pool.push({id, cm, k: s.seq++}); if (s.pool.length > 60) s.pool.shift(); };
{ const real = fiLand; fiLand = function () { const f = !fi.special && fi.fish, cm = fi.cm; real(); if (f && games) { aqKeep(f.id, cm); saveGames(); } }; }  // (non indenté : les textes sur plusieurs lignes restent exactement les tiens)
  // ---- fin ----
  ctx.onOpen(() => { fiOpen(); });
}
