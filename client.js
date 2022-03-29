const https = require("https");
const http = require("http");
const { URL } = require("url");

const pingInterval = 1;
const pingUrlOptions = new URL("https://fundraiseup.com");
const serverUrlOptions = new URL("http://localhost:3020/data");
const statistics = {
  total: 0,
  ok: 0,
  server: 0,
  timeout: 0,
};
let pingId = 0;

const getRequest = async (options) => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = https.request(options, (res) => {
      res.on("data", () => {});
      res.on("end", () => resolve({ start, end: Date.now() }));
    });

    req.on("error", reject);
    req.end();
  });
};

const log = (data, status) => {
  const bodyEntries = Object.entries(data);
  if (status) {
    bodyEntries.push(["statusCode", status]);
  }
  const message = bodyEntries.map(([key, val]) => `${key}: ${val}`).join(" - ");
  console.log(message);
};

const sendRequest = async (url, data) => {
  const body = JSON.stringify(data);

  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    timeout: 10 * 1000,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      log(data, res.statusCode);
      statistics.total += 1;
      res.on("data", () => {});
      res.on("end", () => resolve(res.statusCode));
    });

    req.on("timeout", req.destroy);
    req.on("error", reject);
    req.write(body);
    req.end();
  });
};

const timeout = async (time) => {
  return new Promise((resolve) => setTimeout(resolve, time));
};

const sendPing = async (data) => {
  try {
    if (data.deliveryAttempt > 1) {
      await timeout(data.deliveryAttempt * 2);
    }

    const status = await sendRequest(serverUrlOptions, data);

    if (status === 500) {
      statistics.server += 1;
      data.deliveryAttempt += 1;
      await sendPing(data);
    } else {
      statistics.ok += 1;
    }
  } catch {
    statistics.timeout += 1;
    data.deliveryAttempt += 1;
    await sendPing(data);
  }
};

const interval = setInterval(async () => {
  pingId = pingId + 1;
  const { start, end } = await getRequest(pingUrlOptions);

  sendPing({
    pingId,
    deliveryAttempt: 1,
    date: start,
    responseTime: end - start,
  });
}, pingInterval * 1000);

process.on("SIGINT", () => {
  clearInterval(interval);
});

process.on("exit", () => {
  log(statistics);
});
