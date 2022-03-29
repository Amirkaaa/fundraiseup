const http = require("http");

const requestsHistory = [];
const requestsMap = new Map();
const probabilities = ["OK", "500", "OK", "DELAY", "OK"];
const probabilitiesLastIndex = probabilities.length - 1;
let probabilityCounter = 0;

const getProbability = () => {
  const probability = probabilities[probabilityCounter];
  probabilityCounter =
    probabilityCounter === probabilitiesLastIndex ? 0 : probabilityCounter + 1;
  return probability;
};

const getRawBody = (stream, callback) => {
  let buffers = [];

  stream.on("data", onData);
  stream.on("end", onEnd);
  stream.on("close", cleanup);

  function onData(chunk) {
    buffers.push(chunk);
  }

  function onEnd() {
    callback.apply(null, [Buffer.concat(buffers).toString()]);
    cleanup();
  }

  function cleanup() {
    buffers = [];

    stream.removeListener("data", onData);
    stream.removeListener("end", onEnd);
    stream.removeListener("close", cleanup);
  }
};

const bodyParser = async (req) => {
  const body = await new Promise((resolve) => {
    getRawBody(req, resolve);
  });

  return JSON.parse(body);
};

const dataRoute = async (req, res) => {
  const probability = getProbability();

  const body = await bodyParser(req);

  requestsHistory.push(body);

  if (requestsMap.has(body.pingId) === false) {
    requestsMap.set(body.pingId, body);
  }

  switch (probability) {
    case "OK":
      const bodyEntries = Object.entries(body);
      const message = bodyEntries
        .map(([key, val]) => `${key}: ${val}`)
        .join(" - ");
      console.log(message);
      res.writeHead(200);
      res.end("OK");
      break;
    case "500":
      res.writeHead(500);
      res.end();
      break;
    case "DELAY":
      break;
  }
};

const requestListener = async (req, res) => {
  if (req.url === "/data" && req.method === "POST") {
    await dataRoute(req, res);
  } else {
    res.writeHead(200);
    res.end("Hello World!");
  }
};

const server = http.createServer(requestListener);

server.listen(3020);

const median = (values) => {
  values.sort((a, b) => a - b);

  let half = Math.floor(values.length / 2);

  if (values.length % 2 !== 0) {
    return values[half];
  } else {
    return (values[half - 1] + values[half]) / 2;
  }
};

const middle = (values) => {
  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const showAnalytics = () => {
  const requests = [];
  requestsMap.forEach((value) => requests.push(value.responseTime));

  console.log("Middle value is", middle(requests) || 0);
  console.log("Median value is", median(requests) || 0);

  server.close();
};

process.on("SIGINT", showAnalytics);
