import automationHandler from "./automation.js";

function parseQuery(requestUrl) {
  try {
    const url = new URL(String(requestUrl || "/"), "https://gemassist.invalid");
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  Object.defineProperty(req, "query", {
    configurable: true,
    enumerable: true,
    writable: false,
    value: parseQuery(req.url),
  });

  return automationHandler(req, res);
}
