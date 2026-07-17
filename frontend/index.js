// index.js
const express    = require("express");
const path       = require("path");
const serverless = require("serverless-http");

const app = express();
app.use(express.static(path.join(__dirname, "build")));

app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

module.exports.handler = serverless(app);

