function adaptLegacyApi(handler) {
  return async function netlifyHandler(event) {
    const headers = {};
    const requestHeaders = event.headers || {};
    for (const [name, value] of Object.entries(requestHeaders)) {
      headers[String(name).toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value);
    }

    let body = event.body || null;
    if (body && event.isBase64Encoded) {
      body = Buffer.from(body, "base64").toString("utf8");
    }

    const req = {
      method: event.httpMethod || "GET",
      headers,
      body,
    };

    const res = {
      statusCode: 200,
      headers: {},
      body: "",
      setHeader(name, value) {
        this.headers[name] = String(value);
        return this;
      },
      status(code) {
        this.statusCode = Number(code) || 200;
        return this;
      },
      json(value) {
        this.headers["Content-Type"] = "application/json; charset=utf-8";
        this.body = JSON.stringify(value);
        return this;
      },
      end(value) {
        this.body = value == null ? "" : String(value);
        return this;
      },
    };

    await handler(req, res);

    return {
      statusCode: res.statusCode,
      headers: res.headers,
      body: res.body,
      isBase64Encoded: false,
    };
  };
}

module.exports = { adaptLegacyApi };
