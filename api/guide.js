function esc(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function textLine(text, x, y, size = 11) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET\n`;
}

function makeContent(lines) {
  let y = 770;
  let out = "";
  for (const line of lines) {
    if (line === "") {
      y -= 14;
      continue;
    }
    const isTitle = line.startsWith("# ");
    const isHeading = line.startsWith("## ");
    const clean = line.replace(/^# /, "").replace(/^## /, "");
    out += textLine(clean, 50, y, isTitle ? 20 : isHeading ? 15 : 10.5);
    y -= isTitle ? 28 : isHeading ? 22 : 15;
  }
  return out;
}

function buildPdf(pages) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = add("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = add("");
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const pageIds = [];
  const contentIds = [];

  for (const pageLines of pages) {
    const stream = makeContent(pageLines);
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}endstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    contentIds.push(contentId);
    pageIds.push(pageId);
  }

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}

const pages = [
  [
    "# 50 Free Tools & Opportunities Every Creator Should Know",
    "A simple GemAssist guide for creators, learners, entrepreneurs, and builders.",
    "",
    "## Start Here",
    "This guide helps you discover useful tools, free resources, and opportunity platforms.",
    "Pick one tool, one habit, or one opportunity and use it today.",
    "",
    "## AI Tools",
    "1. ChatGPT - Writing, planning, brainstorming, learning, and content ideas.",
    "2. Claude - Long-form writing, editing, summaries, and document work.",
    "3. Perplexity - Research and source-backed discovery.",
    "4. Google Gemini - AI assistance connected to Google tools.",
    "5. Microsoft Copilot - Productivity help for Microsoft users.",
    "",
    "## Design & Content Creation",
    "6. Canva - Designs, PDFs, flyers, social posts, and presentations.",
    "7. CapCut - Short video editing for TikTok, Reels, and Shorts.",
    "8. Adobe Express - Simple designs, graphics, and short videos.",
    "9. Remove.bg - Fast image background removal.",
    "10. Pexels - Free photos and videos for creative work."
  ],
  [
    "## More Creative Tools",
    "11. Unsplash - High-quality free photos.",
    "12. Pixabay - Images, videos, music, and graphics.",
    "",
    "## Productivity & Organization",
    "13. Google Docs - Writing, notes, scripts, and proposals.",
    "14. Google Sheets - Track leads, content, goals, and opportunities.",
    "15. Google Drive - Store and share documents, PDFs, and files.",
    "16. Notion - Organize projects, notes, and resource libraries.",
    "17. Trello - Simple visual project boards.",
    "18. Todoist - Daily tasks, reminders, and habits.",
    "19. Google Calendar - Deadlines, planning, and focus time.",
    "",
    "## Scheduling & Growth",
    "20. Telegram Scheduling - Schedule posts directly inside your channel.",
    "21. Postiz - Schedule and cross-post content across platforms.",
    "22. Buffer - Simple social media scheduling.",
    "23. Metricool - Scheduling plus analytics.",
    "24. Linktree - Put your bot, channel, and resources in one bio link.",
    "25. Beacons - Creator link page and simple digital presence."
  ],
  [
    "## Learning Platforms",
    "26. YouTube - Free tutorials for almost any skill.",
    "27. Coursera - Structured courses from companies and universities.",
    "28. edX - Professional and academic online learning.",
    "29. Khan Academy - Free foundational learning.",
    "30. HubSpot Academy - Marketing, sales, and business training.",
    "31. Google Digital Garage - Digital skills and online marketing basics.",
    "32. LinkedIn Learning - Career and professional skill courses.",
    "",
    "## Opportunity Platforms",
    "33. LinkedIn - Jobs, networking, learning, and professional growth.",
    "34. Indeed - Jobs, internships, and alerts.",
    "35. Glassdoor - Company research and salary insight.",
    "36. Wellfound - Startup jobs and remote opportunities.",
    "37. Startup job boards - Early company roles and growth opportunities.",
    "38. Remote OK - Remote work listings.",
    "39. We Work Remotely - Remote roles across categories.",
    "40. FlexJobs - Flexible and remote job opportunities."
  ],
  [
    "## Freelance & Creator Platforms",
    "41. Upwork - Freelance work and client projects.",
    "42. Fiverr - Packaged services and creator gigs.",
    "43. Contra - Portfolio and freelance discovery.",
    "44. Gumroad - Sell digital guides, templates, and resources.",
    "45. Ko-fi - Support, memberships, and digital products.",
    "",
    "## Research & Discovery",
    "46. Google Alerts - Track grants, jobs, topics, and updates.",
    "47. Product Hunt - Discover new tools and startups.",
    "48. Futurepedia - AI tool directory by category.",
    "49. GitHub - Open-source projects, tools, and examples.",
    "50. Telegram Communities - Find learning groups, tools, and opportunities.",
    "",
    "## Simple 30-Day Starter Plan",
    "Use only five tools first: ChatGPT, Canva, Google Sheets, Telegram, and YouTube.",
    "Create something useful, track opportunities, and share helpful content consistently.",
    "",
    "Join the GemAssist channel for more tools, tips, and opportunity drops."
  ]
];

export default async function handler(req, res) {
  const pdf = buildPdf(pages);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=gemassist-free-tools-guide.pdf");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).send(pdf);
}
