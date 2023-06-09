require("dotenv").config();
const express = require("express");
const port = process.env.PORT;
const cors = require("cors");
const mongoose = require("mongoose");
mongoose.connect(process.env.MONGODB_URI);
const fileUpload = require("express-fileupload");
const app = express();
app.use(cors());
app.use(express.json());
//////////
const routes = require("./routes/routes");
app.use(routes);
const modeles = require("./models/users");
app.use(modeles);
////////

app.listen(port, () => {
  console.log(`Serveur vinted lancé sur le port : ${port} `);
});
