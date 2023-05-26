require("dotenv").config();
const express = require("express");
const port = process.env.port;
const cors = require("cors");
const mongoose = require("mongoose");
mongoose.connect(process.env.MONGODB_URI);
const fileUpload = require("express-fileupload");
const app = express();
app.use(cors());
app.use(express.json());
//////////
const routes = require("./routes");
app.use(routes);
const modeles = require("./modeles");
app.use(modeles);
/////////

app.listen(port, () => {
  console.log(`Serveur vinted lancé sur le port : ${port} `);
});
