const POSTS = [
  {
    title: "Security habit of the day",
    body: "Turn on multi-factor authentication for your email, cloud storage, and financial accounts. Prefer an authenticator app or security key over SMS when available.",
  },
  {
    title: "Real-estate fraud alert",
    body: "Never rely on emailed wire instructions alone. Confirm payment details through a trusted phone number obtained independently before transferring funds.",
  },
  {
    title: "Creator workflow",
    body: "Use one simple system: plan in Google Docs, design in Canva, track progress in Google Sheets, and publish consistently instead of trying every tool at once.",
  },
  {
    title: "Phishing check",
    body: "Pause before opening urgent links. Verify the sender, inspect the destination, and visit the official website directly instead of signing in through an unexpected message.",
  },
  {
    title: "Opportunity research",
    body: "Use official career pages and recognized platforms. Verify the organization and never pay an upfront fee to receive a job, grant, or award.",
  },
  {
    title: "Business resilience",
    body: "Keep tested backups of critical documents and verify that at least one copy is separate from your everyday devices and accounts.",
  },
  {
    title: "Account protection",
    body: "Use a password manager to create unique passwords. Reusing one password across several services allows a single breach to spread.",
  },
  {
    title: "Property-title awareness",
    body: "Review official property records and investigate unexpected filing notices promptly. Early verification can reduce the impact of title-related fraud.",
  },
  {
    title: "Creator growth principle",
    body: "Publish something useful before asking people to follow. A checklist, warning, template, or short tutorial gives people a clear reason to share your work.",
  },
  {
    title: "Device security",
    body: "Install operating-system and browser updates promptly, especially on devices used for business, banking, email, or client information.",
  },
  {
    title: "Vendor verification",
    body: "Before sharing business data with a new provider, review its official domain, privacy terms, support contacts, and account-security controls.",
  },
  {
    title: "Weekly planning",
    body: "Choose one goal, three priority tasks, and one measurable result for the week. A smaller completed plan is more valuable than a large unfinished list.",
  },
  {
    title: "Incident response reminder",
    body: "When something suspicious happens, preserve messages, screenshots, timestamps, and logs before making major changes. Evidence improves investigation and recovery.",
  },
  {
    title: "Free resource spotlight",
    body: "The GemAssist premium guide organizes 50 tools and opportunity platforms into a practical 30-day starter plan.",
    guide: true,
  },
];

function dayNumber(date) {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000);
}

export function dailyPost(date = new Date()) {
  const post = POSTS[Math.abs(dayNumber(date)) % POSTS.length];
  const dateKey = date.toISOString().slice(0, 10);
  return {
    key: `evergreen-${dateKey}`,
    dateKey,
    title: post.title,
    body: post.body,
    guide: Boolean(post.guide),
  };
}
