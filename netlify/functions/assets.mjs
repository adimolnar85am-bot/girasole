import assetsHandler from "../../api/assets.js";
import compatibility from "../compat/legacy-api.js";

const handler = compatibility.adaptLegacyApi(assetsHandler);

export default async function assets(request) {
  const headers = Object.fromEntries(request.headers.entries());
  const body = ["GET", "HEAD"].includes(request.method) ? null : await request.text();
  const result = await handler({
    httpMethod: request.method,
    headers,
    body,
  });
  const responseBody = [204, 304].includes(result.statusCode) ? null : (result.body || null);
  return new Response(responseBody, {
    status: result.statusCode,
    headers: result.headers,
  });
}

export const config = {
  path: "/api/assets",
  method: ["GET", "POST", "OPTIONS"],
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
