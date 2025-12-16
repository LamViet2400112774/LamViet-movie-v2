const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes");

const app = express();
app.use(cors());
app.use("/api", apiRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log("Backend running at http://localhost:" + PORT);
});