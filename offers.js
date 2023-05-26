const mongoose = require("mongoose");

const Offer = mongoose.model("Offer", {
  offer_id: String,
  product_name: String,
  product_description: String,
  product_price: Number,
  product_details: Array,
  product_image: Object,
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
});

module.exports = Offer;
