// server/index.js

const express = require("express");

const PORT = process.env.PORT || 3001;

const app = express();

app.get("/api", (req, res) => {
  res.json({ message: "Hello from server!" });
});

app.get("/api/tags", (req, res) => {
  res.json({tags: [
      { name: 'Who', id: 1, notes: 0, parent: 0},
      { name: 'אורי', id: 2, notes: 120, parent: 1},
      {name: 'יעל', id: 3, notes: 514, parent: 1},
      {name: 'ליאור', id: 4, notes: 10, parent: 1},
      {name: 'test', id: 5, notes: 0, parent: 2}]})
})


app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
