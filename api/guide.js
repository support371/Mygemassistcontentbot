import { deflateSync } from "node:zlib";

const PAGE_W = 595;
const PAGE_H = 842;
const M = 36;
const C = {
  navy: [0.035, 0.082, 0.16],
  navy2: [0.055, 0.12, 0.23],
  ink: [0.06, 0.10, 0.18],
  slate: [0.30, 0.37, 0.48],
  muted: [0.48, 0.54, 0.64],
  paper: [0.965, 0.975, 0.992],
  white: [1, 1, 1],
  border: [0.86, 0.89, 0.94],
  green: [0.08, 0.78, 0.46],
  greenDark: [0.02, 0.45, 0.27],
  cyan: [0.12, 0.68, 0.91],
  blue: [0.27, 0.42, 0.94],
  purple: [0.58, 0.36, 0.94],
  orange: [0.98, 0.64, 0.16],
  pink: [0.94, 0.35, 0.65],
};

const WEBSITE = "https://gemcybersecurityassist.com";
const CHANNEL = "https://t.me/mycybersecureWealthsolution";

function esc(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/[\r\n]+/g, " ");
}

function num(n) { return Number(n).toFixed(2).replace(/\.00$/, ""); }
function color(c, stroke = false) { return `${c.map(num).join(" ")} ${stroke ? "RG" : "rg"}\n`; }
function rect(x, y, w, h, fill, stroke = null, lw = 1) {
  let s = "q\n";
  if (fill) s += color(fill);
  if (stroke) s += color(stroke, true) + `${lw} w\n`;
  s += `${num(x)} ${num(y)} ${num(w)} ${num(h)} re ${fill && stroke ? "B" : fill ? "f" : "S"}\nQ\n`;
  return s;
}
function roundRect(x, y, w, h, r, fill, stroke = null, lw = 1) {
  const k = 0.5522847498;
  const c = r * k;
  let s = "q\n";
  if (fill) s += color(fill);
  if (stroke) s += color(stroke, true) + `${lw} w\n`;
  s += `${num(x+r)} ${num(y)} m\n`;
  s += `${num(x+w-r)} ${num(y)} l\n${num(x+w-r+c)} ${num(y)} ${num(x+w)} ${num(y+r-c)} ${num(x+w)} ${num(y+r)} c\n`;
  s += `${num(x+w)} ${num(y+h-r)} l\n${num(x+w)} ${num(y+h-r+c)} ${num(x+w-r+c)} ${num(y+h)} ${num(x+w-r)} ${num(y+h)} c\n`;
  s += `${num(x+r)} ${num(y+h)} l\n${num(x+r-c)} ${num(y+h)} ${num(x)} ${num(y+h-r+c)} ${num(x)} ${num(y+h-r)} c\n`;
  s += `${num(x)} ${num(y+r)} l\n${num(x)} ${num(y+r-c)} ${num(x+r-c)} ${num(y)} ${num(x+r)} ${num(y)} c\n`;
  s += `h ${fill && stroke ? "B" : fill ? "f" : "S"}\nQ\n`;
  return s;
}
function line(x1, y1, x2, y2, c, lw = 1) {
  return `q\n${color(c, true)}${lw} w\n${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S\nQ\n`;
}
function circle(cx, cy, r, fill, stroke = null, lw = 1) {
  const k = 0.5522847498, c = r * k;
  let s = "q\n";
  if (fill) s += color(fill);
  if (stroke) s += color(stroke, true) + `${lw} w\n`;
  s += `${num(cx+r)} ${num(cy)} m\n`;
  s += `${num(cx+r)} ${num(cy+c)} ${num(cx+c)} ${num(cy+r)} ${num(cx)} ${num(cy+r)} c\n`;
  s += `${num(cx-c)} ${num(cy+r)} ${num(cx-r)} ${num(cy+c)} ${num(cx-r)} ${num(cy)} c\n`;
  s += `${num(cx-r)} ${num(cy-c)} ${num(cx-c)} ${num(cy-r)} ${num(cx)} ${num(cy-r)} c\n`;
  s += `${num(cx+c)} ${num(cy-r)} ${num(cx+r)} ${num(cy-c)} ${num(cx+r)} ${num(cy)} c\n`;
  s += `${fill && stroke ? "B" : fill ? "f" : "S"}\nQ\n`;
  return s;
}
function text(value, x, y, size = 10, font = "F1", fill = C.ink) {
  return `BT\n${color(fill)}/${font} ${num(size)} Tf\n1 0 0 1 ${num(x)} ${num(y)} Tm\n(${esc(value)}) Tj\nET\n`;
}
function approxWidth(value, size, bold = false) {
  let units = 0;
  for (const ch of String(value)) {
    if ("MW@#%&".includes(ch)) units += 0.85;
    else if ("ilI.,:;'!|".includes(ch)) units += 0.28;
    else if (ch === " ") units += 0.28;
    else units += bold ? 0.58 : 0.53;
  }
  return units * size;
}
function wrap(value, maxWidth, size, bold = false) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (approxWidth(candidate, size, bold) <= maxWidth || !current) current = candidate;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}
function paragraph(value, x, y, maxWidth, size = 10, leading = 14, font = "F1", fill = C.slate, maxLines = 20) {
  let s = "";
  const lines = wrap(value, maxWidth, size, font === "F2").slice(0, maxLines);
  lines.forEach((ln, i) => { s += text(ln, x, y - i * leading, size, font, fill); });
  return { stream: s, endY: y - lines.length * leading, lines };
}
function pill(value, x, y, fill, textFill = C.white, size = 7.5, padX = 10, h = 20) {
  const w = approxWidth(value, size, true) + padX * 2;
  return { width: w, stream: roundRect(x, y, w, h, h/2, fill) + text(value, x + padX, y + 6.2, size, "F2", textFill) };
}
function logo(x, y, dark = false) {
  const fg = dark ? C.white : C.ink;
  let s = roundRect(x, y, 11, 11, 3, C.green);
  s += text("✓", x + 2.2, y + 2.4, 7, "F2", C.white);
  s += text("GEMASSIST", x + 16, y + 1.8, 7.5, "F2", fg);
  return s;
}
function footer(page, label = "CREATOR RESOURCE GUIDE") {
  let s = text(label, M, 22, 6.5, "F2", C.muted);
  s += text("gemcybersecurityassist.com  |  @mycybersecureWealthsolution", 190, 22, 6.2, "F1", C.muted);
  s += text(String(page).padStart(2, "0"), 548, 22, 7, "F2", C.muted);
  return s;
}
function header(title, subtitle, accent, page) {
  let s = rect(0, 0, PAGE_W, PAGE_H, C.paper);
  s += circle(550, 806, 58, accent);
  s += circle(576, 792, 42, [Math.min(accent[0]+0.08,1), Math.min(accent[1]+0.08,1), Math.min(accent[2]+0.08,1)]);
  s += logo(M, 795, false);
  s += text(title, M, 738, 22, "F2", C.ink);
  const p = paragraph(subtitle, M, 718, 460, 8.7, 12, "F1", C.slate, 2); s += p.stream;
  s += roundRect(M, 696, 52, 4, 2, accent);
  s += footer(page);
  return s;
}

const tools = {
  ai: [
    [1,"ChatGPT","Writing, planning, brainstorming, learning, and content ideas."],
    [2,"Claude","Long-form writing, editing, summaries, and document work."],
    [3,"Perplexity","Research and source-backed discovery."],
    [4,"Google Gemini","AI assistance connected to Google tools."],
    [5,"Microsoft Copilot","Productivity help for Microsoft users."],
  ],
  design: [
    [6,"Canva","Designs, PDFs, flyers, social posts, and presentations."],
    [7,"CapCut","Short video editing for TikTok, Reels, and Shorts."],
    [8,"Adobe Express","Simple designs, graphics, and short videos."],
    [9,"Remove.bg","Fast image background removal."],
    [10,"Pexels","Free photos and videos for creative work."],
  ],
  creative: [[11,"Unsplash","High-quality free photos."],[12,"Pixabay","Images, videos, music, and graphics."]],
  productivity: [
    [13,"Google Docs","Writing, notes, scripts, and proposals."],
    [14,"Google Sheets","Track leads, content, goals, and opportunities."],
    [15,"Google Drive","Store and share documents, PDFs, and files."],
    [16,"Notion","Organize projects, notes, and resource libraries."],
    [17,"Trello","Simple visual project boards."],
    [18,"Todoist","Daily tasks, reminders, and habits."],
    [19,"Google Calendar","Deadlines, planning, and focus time."],
  ],
  growth: [
    [20,"Telegram Scheduling","Schedule posts directly inside your channel."],
    [21,"Postiz","Schedule and cross-post content across platforms."],
    [22,"Buffer","Simple social media scheduling."],
    [23,"Metricool","Scheduling plus analytics."],
    [24,"Linktree","Put your bot, channel, and resources in one bio link."],
    [25,"Beacons","Creator link page and simple digital presence."],
  ],
  learning: [
    [26,"YouTube","Free tutorials for almost any skill."],
    [27,"Coursera","Structured courses from companies and universities."],
    [28,"edX","Professional and academic online learning."],
    [29,"Khan Academy","Free foundational learning."],
    [30,"HubSpot Academy","Marketing, sales, and business training."],
    [31,"Google Digital Garage","Digital skills and online marketing basics."],
    [32,"LinkedIn Learning","Career and professional skill courses."],
  ],
  opportunity: [
    [33,"LinkedIn","Jobs, networking, learning, and professional growth."],
    [34,"Indeed","Jobs, internships, and alerts."],
    [35,"Glassdoor","Company research and salary insight."],
    [36,"Wellfound","Startup jobs and remote opportunities."],
    [37,"Startup job boards","Early company roles and growth opportunities."],
    [38,"Remote OK","Remote work listings."],
    [39,"We Work Remotely","Remote roles across categories."],
    [40,"FlexJobs","Flexible and remote job opportunities."],
  ],
  freelance: [
    [41,"Upwork","Freelance work and client projects."],
    [42,"Fiverr","Packaged services and creator gigs."],
    [43,"Contra","Portfolio and freelance discovery."],
    [44,"Gumroad","Sell digital guides, templates, and resources."],
    [45,"Ko-fi","Support, memberships, and digital products."],
  ],
  research: [
    [46,"Google Alerts","Track grants, jobs, topics, and updates."],
    [47,"Product Hunt","Discover new tools and startups."],
    [48,"Futurepedia","AI tool directory by category."],
    [49,"GitHub","Open-source projects, tools, and examples."],
    [50,"Telegram Communities","Find learning groups, tools, and opportunities."],
  ],
};

function toolCard(titleText, items, x, topY, w, accent) {
  const rowH = 43;
  const h = 54 + items.length * rowH;
  const y = topY - h;
  let s = roundRect(x, y, w, h, 10, C.white, C.border, 0.8);
  s += roundRect(x + 15, topY - 30, 4, 22, 2, accent);
  s += text(titleText, x + 27, topY - 23, 11.5, "F2", C.ink);
  const b = pill(`${items.length} RESOURCES`, x + w - 82, topY - 31, C.paper, C.muted, 5.7, 7, 16); s += b.stream;
  let yy = topY - 58;
  for (const [n, name, desc] of items) {
    s += circle(x + 23, yy + 4, 8, [Math.min(accent[0]+0.68,1), Math.min(accent[1]+0.68,1), Math.min(accent[2]+0.68,1)]);
    s += text(String(n), x + 19.2, yy + 1.3, 5.8, "F2", accent);
    s += text(name, x + 39, yy + 6.5, 7.8, "F2", C.ink);
    const d = paragraph(desc, x + 39, yy - 4, w - 55, 5.8, 7.4, "F1", C.muted, 2); s += d.stream;
    yy -= rowH;
    if (yy > y + 10) s += line(x + 18, yy + 18, x + w - 18, yy + 18, C.border, 0.35);
  }
  return { stream: s, y, h };
}

function pageCover() {
  let s = rect(0, 0, PAGE_W, PAGE_H, C.navy);
  s += circle(548, 802, 82, [0.04,0.22,0.28]);
  s += circle(580, 753, 60, [0.05,0.30,0.38]);
  s += logo(M, 792, true);
  const ed = pill("2026 CREATOR EDITION", M, 720, C.greenDark, C.green, 6.8, 12, 22); s += ed.stream;
  s += text("50 Free Tools", M, 622, 28, "F2", C.white);
  s += text("& Opportunities", M, 588, 28, "F2", C.white);
  s += text("Every Creator", M, 550, 27, "F2", C.green);
  s += text("Should Know", M, 516, 27, "F2", C.green);
  const p = paragraph("A practical GemAssist field guide for creators, learners, entrepreneurs, and builders who want to work smarter, learn faster, and discover new opportunities.", M, 448, 360, 9, 14, "F1", [0.76,0.82,0.9], 5); s += p.stream;
  s += line(M, 383, 172, 383, [0.13,0.23,0.38], 0.8);
  s += roundRect(M, 250, PAGE_W-2*M, 104, 14, C.navy2, [0.11,0.24,0.40], 0.8);
  const cols = [M+24, M+190, M+354];
  const labels = [["01","Discover","50 practical resources"],["02","Choose","Start with one useful tool"],["03","Build","Turn learning into action"]];
  labels.forEach((it,i)=>{s += text(it[0], cols[i], 321, 6, "F2", C.green);s += text(it[1], cols[i], 296, 11, "F2", C.white);s += text(it[2], cols[i], 278, 6.5, "F1", [0.64,0.72,0.84]);});
  s += text("Prepared by GEM Cybersecurity Assist", M, 48, 6.5, "F1", [0.60,0.68,0.78]);
  s += text("gemcybersecurityassist.com", 430, 48, 6.5, "F1", [0.60,0.68,0.78]);
  return { stream:s, links:[{x:421,y:39,w:138,h:18,url:WEBSITE}] };
}
function pageStart() {
  let s = header("Start Here", "A simple method for getting value from this guide.", C.green, 2);
  s += roundRect(M, 556, PAGE_W-2*M, 94, 12, C.navy);
  s += text("THE ONE-ONE-ONE METHOD", M+18, 626, 5.8, "F2", C.green);
  s += text("Pick one tool. Build one habit. Pursue one opportunity.", M+18, 602, 15, "F2", C.white);
  s += text("Do not try all 50 at once. Use the guide as a focused action menu.", M+18, 580, 7, "F1", [0.70,0.77,0.86]);
  const cards=[["1","SCAN","Read the category headings and mark what solves a current need.",C.green],["2","SELECT","Choose one resource you can test in less than 20 minutes.",C.cyan],["3","SHIP","Create, learn, apply, or publish one useful result today.",C.orange]];
  cards.forEach((c,i)=>{const x=M+i*179;s += roundRect(x, 400, 164, 126, 9, C.white, C.border, .8);s += circle(x+21,500,9,c[3]);s += text(c[0],x+18.2,497,6,"F2",C.white);s += text(c[1],x+38,496,7.2,"F2",C.ink);s += paragraph(c[2],x+17,466,130,7,11,"F1",C.slate,5).stream;});
  s += text("What is inside", M, 366, 9, "F2", C.ink);
  const cats=[["AI & research","01-05",C.green],["Design & content","06-12",C.cyan],["Productivity","13-19",C.blue],["Scheduling & growth","20-25",C.orange],["Learning","26-32",C.purple],["Jobs & opportunities","33-40",C.green],["Freelance & creator","41-45",C.cyan],["Research & discovery","46-50",C.orange]];
  cats.forEach((c,i)=>{const col=i%2,row=Math.floor(i/2),x=M+col*270,y=326-row*46;s += roundRect(x,y,252,32,16,C.white,C.border,.6);s += roundRect(x+7,y+7,4,18,2,c[2]);s += text(c[0],x+19,y+11,7,"F2",C.ink);s += text(c[1],x+219,y+11,6,"F2",C.muted);});
  s += text("Note: Free tiers and availability can change. Confirm current terms before relying on any platform.", M, 92, 6.5, "F3", C.muted);
  return {stream:s,links:[]};
}
function pageCreate() {let s=header("Create & Communicate","AI, design, and creative tools for faster content production.",C.green,3);s+=toolCard("AI Tools",tools.ai,M,650,250,C.green).stream;s+=toolCard("Design & Content Creation",tools.design,309,650,250,C.cyan).stream;s+=toolCard("More Creative Tools",tools.creative,167,350,260,C.pink).stream;return {stream:s,links:[]};}
function pageOrganize() {let s=header("Organize & Grow","Systems for planning, scheduling, publishing, and staying consistent.",C.blue,4);s+=toolCard("Productivity & Organization",tools.productivity,M,650,250,C.blue).stream;s+=toolCard("Scheduling & Growth",tools.growth,309,650,250,C.orange).stream;return {stream:s,links:[]};}
function pageLearn() {let s=header("Learn & Find Opportunities","Build skills, research employers, and discover flexible work.",C.purple,5);s+=toolCard("Learning Platforms",tools.learning,M,650,250,C.purple).stream;s+=toolCard("Opportunity Platforms",tools.opportunity,309,650,250,C.green).stream;return {stream:s,links:[]};}
function pageFreelance() {let s=header("Freelance & Discover","Platforms for client work, digital products, and continuous discovery.",C.cyan,6);s+=toolCard("Freelance & Creator Platforms",tools.freelance,M,650,250,C.cyan).stream;s+=toolCard("Research & Discovery",tools.research,309,650,250,C.orange).stream;return {stream:s,links:[]};}
function pageAction() {
  let s=rect(0,0,PAGE_W,PAGE_H,C.paper)+rect(0,580,PAGE_W,262,C.navy)+logo(M,795,true);
  s+=text("YOUR NEXT 30 DAYS",M,734,6.3,"F2",C.green)+text("Turn the list into momentum.",M,696,23,"F2",C.white);
  s+=paragraph("Use only five tools first: ChatGPT, Canva, Google Sheets, Telegram, and YouTube. Create something useful, track opportunities, and share helpful content consistently.",M,666,465,8.2,12,"F1",[0.75,0.82,0.9],5).stream;
  s+=text("30-day starter plan",M,546,9,"F2",C.ink);
  const steps=[["DAYS 1-3","SET UP","Choose the five starter tools and create a simple folder or dashboard.",C.green],["DAYS 4-10","CREATE","Make one post, resource, template, or learning note every day.",C.cyan],["DAYS 11-20","TRACK","Use Google Sheets to record opportunities, contacts, and results.",C.blue],["DAYS 21-30","PUBLISH","Share consistently, review what worked, and repeat the strongest activity.",C.orange]];
  steps.forEach((st,i)=>{const y=470-i*82;s+=line(M+8,y+8,M+8,y-58,[0.80,0.84,0.90],1)+circle(M+8,y+8,7,st[3])+roundRect(M+28,y-48,PAGE_W-M-56,64,9,C.white,C.border,.7)+text(st[0],M+44,y+1,5.5,"F2",st[3])+text(st[1],M+44,y-16,7.2,"F2",C.ink)+text(st[2],M+112,y-16,6.2,"F1",C.slate);});
  s+=roundRect(M,72,PAGE_W-2*M,86,11,C.navy)+text("Keep learning with GemAssist",M+18,128,10,"F2",C.white)+text("Join the channel for tools, tips, and opportunity drops.",M+18,108,6.8,"F1",[0.72,0.80,0.89])+roundRect(410,94,126,38,19,C.green)+text("OPEN CHANNEL",429,108,7,"F2",C.navy)+footer(7,"30-DAY ACTION PLAN");
  return {stream:s,links:[{x:405,y:88,w:140,h:50,url:CHANNEL},{x:180,y:13,w:280,h:18,url:WEBSITE}]};
}

function buildPdf() {
  const pages=[pageCover(),pageStart(),pageCreate(),pageOrganize(),pageLearn(),pageFreelance(),pageAction()];
  const objects=[];const add=(body)=>{objects.push(body);return objects.length;};
  const catalogId=add("");const pagesId=add("");const f1=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");const f2=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");const f3=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");
  const pageIds=[];
  for(const page of pages){
    const compressed=deflateSync(Buffer.from(page.stream,"binary"),{level:9});
    const contentId=add(Buffer.concat([Buffer.from(`<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`,`binary`),compressed,Buffer.from("\nendstream","binary")]));
    const annotIds=[];for(const a of page.links||[]) annotIds.push(add(`<< /Type /Annot /Subtype /Link /Rect [${a.x} ${a.y} ${a.x+a.w} ${a.y+a.h}] /Border [0 0 0] /A << /S /URI /URI (${esc(a.url)}) >> >>`));
    const annots=annotIds.length?` /Annots [${annotIds.map(id=>`${id} 0 R`).join(" ")}]`:"";
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${contentId} 0 R${annots} >>`));
  }
  objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const infoId=add(`<< /Title (${esc("50 Free Tools & Opportunities Every Creator Should Know")}) /Author (${esc("GEM Cybersecurity Assist")}) /Subject (${esc("Premium creator resource guide")}) /Creator (${esc("GemAssist PDF Engine")}) >>`);
  objects[catalogId-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R /PageMode /UseNone >>`;
  const chunks=[Buffer.from("%PDF-1.5\n%\xE2\xE3\xCF\xD3\n","binary")];const offsets=[0];let length=chunks[0].length;
  for(let i=0;i<objects.length;i++){offsets.push(length);const body=Buffer.isBuffer(objects[i])?objects[i]:Buffer.from(objects[i],"binary");const head=Buffer.from(`${i+1} 0 obj\n`,`binary`),tail=Buffer.from("\nendobj\n","binary");chunks.push(head,body,tail);length+=head.length+body.length+tail.length;}
  const xref=length;let trailer=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++) trailer+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;trailer+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF`;chunks.push(Buffer.from(trailer,"binary"));return Buffer.concat(chunks);
}

export default async function handler(req,res){
  const pdf=buildPdf();
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition","inline; filename=GemAssist-50-Free-Tools-Premium-Guide.pdf");
  res.setHeader("Cache-Control","public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
  res.setHeader("X-Content-Type-Options","nosniff");
  return res.status(200).send(pdf);
}
