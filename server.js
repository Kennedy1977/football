const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (_req, res) => {
  res
    .status(200)
    .type("html")
    .send("<!doctype html><html><body><h1>Coming soon...</h1></body></html>");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
