require("dotenv").config();
const express = require("express");
const router = express.Router();
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});
const convertToBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.data.toString("base64")}`;
};
const Users = require("../models/users");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const uid2 = require("uid2");
const isAuthenticated = require("../middlewares/middleware");
const Offer = require("../models/offers");
const mongoose = require("mongoose");

//HP du projetss
router.get("/", async (req, res) => {
  try {
    return res.status(200).json("bienvenue sur le serveur vinted");
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
///////// auth

//// creation d'un compte user
router.post("/user/signup", fileUpload(), async (req, res) => {
  try {
    const existingUserEmail = await Users.findOne({ email: req.body.email });
    const existingUseName = await Users.findOne({
      account: { username: req.body.username },
    });
    const pictureToUpload = req.files.picture;

    if (req.body.username === "") {
      res.status(400).json({
        message: "please enter username",
      });
    } else if (existingUserEmail) {
      {
        res.status(400).json({
          message: "user email already exist",
        });
      }
    } else if (existingUseName) {
      {
        {
          res.status(400).json({
            message: "username already exist",
          });
        }
      }
    } else {
      const password = req.body.password;
      const salt = uid2(64);
      const hash = SHA256(password + salt).toString(encBase64);
      const token = uid2(64);
      const newUser = new Users({
        account: { username: req.body.username },
        email: req.body.email,
        token: token,
        hash: hash,
        salt: salt,
        newsletter: req.body.newsletter,
      });
      await newUser.save();
      const result = await cloudinary.uploader.upload(
        convertToBase64(pictureToUpload),
        { folder: `/vinted/avatar/${newUser._id}` }
      );

      newUser.account.avatar = result.secure_url;
      await newUser.save();

      let aftercreation = {
        _id: newUser._id,
        token: newUser.token,
        account: {
          username: newUser.account.username,
        },
      };
      console.log("user created");
      return res.status(200).json({ aftercreation });
    }
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

////// route login
router.post("/user/login", fileUpload(), async (req, res) => {
  try {
    const user = await Users.findOne({ email: req.body.email });
    const genhash = SHA256(req.body.password + user.salt).toString(encBase64);
    const afterlogin = {
      _id: user.id,
      token: user.token,
      account: {
        username: user.account.username,
      },
    };

    if (genhash === user.hash) {
      return res.status(200).json(afterlogin);
    } else {
      return res.status(400).json({ message: "erreur de mdp" });
    }
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

// publish offer

router.post(
  "/offer/publish",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    try {
      const user = await Users.findOne({
        token: req.headers.authorization.replace("Bearer ", ""),
      });
      const owner = user._id;
      const maxLengtDescription = 500;
      const maxLengthTitle = 50;
      if (req.body.description.length > maxLengtDescription) {
        return res.status(400).json({ message: "description trop longue" });
      }
      if (req.body.title.length > maxLengthTitle) {
        return res.status(400).json({ message: "titre trop long" });
      }
      if (req.body.price > 100000) {
        return res.status(400).json({ message: "prix trop grand" });
      }
      const newOffer = new Offer({
        product_name: req.body.title,
        product_description: req.body.description,
        product_price: req.body.price,
        product_details: [
          { product_brand: req.body.brand },
          { product_size: req.body.size },
          { product_color: req.body.color },
          { product_state: req.body.state },
          { product_city: req.body.city },
        ],
        owner: owner,
      });
      await newOffer.save();
      // Si on ne reçoit qu'une image (req.files.picture n'est donc pas un tableau)
      if (!Array.isArray(req.files.picture)) {
        // On vérifie qu'on a bien affaire à une image
        if (req.files.picture.mimetype.slice(0, 5) !== "image") {
          return res.status(400).json({ message: "You must send images" });
        }
        // Envoi de l'image à cloudinary
        const result = await cloudinary.uploader.upload(
          convertToBase64(req.files.picture),
          {
            // Dans le dossier suivant
            folder: `api/vinted-v2/offers/${newOffer._id}`,
            // Avec le public_id suivant
            public_id: "preview",
          }
        );

        // ajout de l'image dans newOffer
        newOffer.product_image = result;
        // On rajoute l'image à la clef product_pictures
        newOffer.product_pictures.push(result);
      } else {
        // Si on a affaire à un tableau, on le parcourt
        for (let i = 0; i < req.files.picture.length; i++) {
          const picture = req.files.picture[i];
          // Si on a afaire à une image
          if (picture.mimetype.slice(0, 5) !== "image") {
            return res.status(400).json({ message: "You must send images" });
          }
          if (i === 0) {
            // On envoie la première image à cloudinary et on en fait l'image principale (product_image)
            const result = await cloudinary.uploader.upload(
              convertToBase64(picture),
              {
                folder: `api/vinted-v2/offers/${newOffer._id}`,
                public_id: "preview",
              }
            );
            // ajout de l'image dans newOffer
            newOffer.product_image = result;
            newOffer.product_pictures.push(result);
          } else {
            // On envoie toutes les autres à cloudinary et on met les résultats dans product_pictures
            const result = await cloudinary.uploader.upload(
              convertToBase64(picture),
              {
                folder: `api/vinted-v2/offers/${newOffer._id}`,
              }
            );
            newOffer.product_pictures.push(result);
          }
        }
      }
      await newOffer.save();

      // const result = await cloudinary.uploader.upload(
      //   convertToBase64(pictureToUpload),
      //   { folder: `/vinted/offers/${newOffer._id}` }
      // );
      // newOffer.product_image = result.secure_url;
      // await newOffer.save();
      return res.status(200).json({ message: "offer created" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// route update

router.put("/offer/update", isAuthenticated, fileUpload(), async (req, res) => {
  try {
    const maxDescriptionLength = 500;
    const maxTitleLength = 50;
    const maxPrice = 100000;

    if (req.body.description.length > maxDescriptionLength) {
      return res.status(400).json({ message: "Description trop longue" });
    }
    if (req.body.title.length > maxTitleLength) {
      return res.status(400).json({ message: "Titre trop long" });
    }
    if (req.body.price > maxPrice) {
      return res.status(400).json({ message: "Prix trop élevé" });
    }

    const offerToUpdate = await Offer.findOne({ _id: req.query.id });

    if (!offerToUpdate) {
      return res.status(404).json({ message: "Offre non trouvée" });
    }

    const pictureToUpload = req.files.picture;
    const fieldsToUpdate = {
      product_name: req.body.title || offerToUpdate.product_name,
      product_description:
        req.body.description || offerToUpdate.product_description,
      product_price: req.body.price || offerToUpdate.product_price,
      product_details: [
        {
          product_brand:
            req.body.brand || offerToUpdate.product_details[0].product_brand,
          product_size:
            req.body.size || offerToUpdate.product_details[0].product_size,
          product_color:
            req.body.color || offerToUpdate.product_details[0].product_color,
          product_state:
            req.body.state || offerToUpdate.product_details[0].product_state,
          product_city:
            req.body.city || offerToUpdate.product_details[0].product_city,
        },
      ],
    };

    for (const field in fieldsToUpdate) {
      if (fieldsToUpdate[field]) {
        if (field === "product_details") {
          offerToUpdate.product_details = fieldsToUpdate[field];
        } else {
          offerToUpdate[field] = fieldsToUpdate[field];
        }
      }
    }

    await offerToUpdate.save();

    if (req.files.picture) {
      const result = await cloudinary.uploader.upload(
        convertToBase64(pictureToUpload),
        { folder: `/vinted/offers/${offerToUpdate._id}` }
      );
      offerToUpdate.product_image = result.secure_url;
      await offerToUpdate.save();
    }

    return res.status(200).json({ message: "Offre mise à jour" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/offers", fileUpload(), async (req, res) => {
  try {
    const filters = {};

    // Liste des filtres possibles avec leur équivalent dans les paramètres de requête
    const filterFields = {
      title: "product_name",
      category: "category",
      // Ajouter d'autres filtres si nécessaire
    };

    // Construire dynamiquement l'objet de filtres à partir des paramètres de requête
    for (const [param, field] of Object.entries(filterFields)) {
      if (req.query[param]) {
        filters[field] = req.query[param];
      }
    }

    const query = Offer.find();

    // Filtrer les annonces
    query.find(filters);

    if (req.query.title) {
      const regex = new RegExp(req.query.title, "i"); // "i" pour une recherche insensible à la casse
      query.find({ product_name: regex });
    }
    // Tri sur le prix
    if (req.query.sortPrice) {
      const sortPrice = req.query.sortPrice === "asc" ? 1 : -1;
      query.sort({ product_price: sortPrice });
    }

    // Tri sur le titre
    if (req.query.sortTitle) {
      const sortTitle = req.query.sortTitle === "asc" ? 1 : -1;
      query.sort({ product_name: sortTitle });
    }

    // Filtrer par la ville (product_city)
    if (req.query.city) {
      query.find({ "product_details.product_city": req.query.city });
    }
    // Filtrer par etat
    if (req.query.state) {
      query.find({ "product_details.product_state": req.query.state });
    }

    // Pagination
    const page = parseInt(req.query.page) || 1; // Page actuelle (par défaut : page 1)
    const limit = 5; // Nombre d'annonces par page
    const skip = (page - 1) * limit; // Nombre d'annonces à sauter

    query.skip(skip).limit(limit);

    const results = await query.exec();

    // Compter le nombre total d'annonces
    const totalCount = await Offer.countDocuments(filters);

    const totalPages = Math.ceil(totalCount / limit); // Nombre total de pages

    res.status(200).json({
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalCount,
      results: results,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// offer par id

router.get("/offers/:id", fileUpload(), async (req, res) => {
  try {
    const offerId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(400).json({ message: "ID d'annonce invalide" });
    }

    const offer = await Offer.findById(offerId);

    if (!offer) {
      return res.status(404).json({ message: "Annonce non trouvée" });
    }

    res.status(200).json(offer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

////////// route all
router.all("*", (req, res) => {
  try {
    return res.status(404).json("not found");
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});
////////////////////////
module.exports = router;
