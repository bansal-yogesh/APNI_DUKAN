// all imports
const express = require("express");
const mongoose = require("mongoose");
const app = express();
const port = process.env.PORT || 8080;
const env = require('dotenv').config();
const Products = require("./models/products.js");
const Users = require("./models/users.js");
const Orders = require("./models/orders.js");
const Reviews = require("./models/reviews.js");
const ejs = require("ejs");
const engine = require('ejs-mate');
const path = require("path");
const flash = require('connect-flash');
const { loginCheck, loginPresist } = require("./middelware.js");
const Razorpay = require('razorpay');
const crypto = require("crypto");

const passport = require("passport");
const passportLocal = require("passport-local");
const session = require('express-session');
const { checkServerIdentity } = require("tls");



// ejs fileds & other nessassry conectsg
app.engine('ejs', engine);
app.set("view-engine", ejs);
app.set("views", path.join(__dirname, "views"));

app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());




app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(flash());
app.use(passport.initialize());

app.use(passport.session());



passport.serializeUser(Users.serializeUser());
passport.deserializeUser(Users.deserializeUser());





// all conections 
mongoose.connect(process.env.mongo_url)
  .then(() => console.log('Connected!')).catch(() => {
    console.log("error in connenting with database")
  });

passport.use(Users.createStrategy({
  usernameField: "userMobile"
}
));

app.use((req, res, next) => {
  res.locals.req = req;
  next();
})

//   all routs

app.get("/", async (req, res) => {

  const products = await Products.find();
  res.render("main/index.ejs", { products });
})

app.get("/product/buy", loginCheck, (req, res) => {
  const { productId, quantity } = req.query;
  console.log(productId, quantity);
  console.log("i am here");
  res.render("main/address.ejs", { productId,
    quantity});

});


app.get("/product/:id", async (req, res) => {
  const { id } = req.params;

  const product = await Products.findById(id);
  console.log(product);
  res.render("main/product.ejs", { product });

})


app.post("/product/:productId/buy", async (req, res) => {
  let { quantity, selectedAddress } = req.body;
  // selectedAddress = JSON.parse(selectedAddress);
  let { productId } = req.params;

  console.log(quantity, productId);
  console.log(selectedAddress);
  let user = req.user;
  let deliveryAddress = await user.address.id(selectedAddress);
  let productById = await Products.findById(productId);

  console.log(deliveryAddress);
  console.log(productById);
  res.render("main/summaryPage.ejs", { quantity, deliveryAddress, productById });

})




app.post("/user/cart/add", (req, res) => {

})

//user routs

app.get("/user/signup", (req, res) => {
  res.render("main/signup.ejs");
})


app.post("/user/signup", async (req, res) => {

  let user_Data = req.body;
  let { name, userMobile, password, email } = req.body;
  console.log(user_Data);
  try {
    const user = await Users.register({ name: name, userMobile: userMobile, email: email }, password);
    console.log("successfuly resistered");

    req.login(user, (err) => {
      if (err) {
        console.log(err.message);
      }
      res.redirect("/");
    })

  }
  catch (error) {
    console.log(error.message);
    res.redirect("/user/signup");
  }

});

app.get("/user/login", (req, res) => {
  res.render("main/login.ejs");
})

app.post("/user/login", loginPresist, passport.authenticate("local", { failureRedirect: "/user/login" }), (req, res) => {
  req.flash("success", "login successfull");
  if (res.locals.targetUrl) {
    res.redirect(res.locals.targetUrl);
  }
  else {
    res.redirect("/");
  }

}
)

app.get("/user/new-address", (req, res) => {
  const {productId,quantity} = req.query;
  res.render("main/newAddress.ejs",{productId,quantity});
})

app.get("/user/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      res.redirect("/")
    }
    res.redirect("/");
  })
});


app.post("/user/new-address", async (req, res) => {
  let newAddress = req.body;
  const {productId,quantity} = req.query;
  console.log("i am in new-address");
  console.log(productId,quantity);
  let userid = req.user._id;
  console.log(userid);
  await Users.findByIdAndUpdate(userid, { $push: { address: newAddress } });
  res.redirect(`/product/buy?productId=${productId}&quantity=${quantity}`);

})

app.post("/payment", async (req, res) => {
  let { quantity, productId, addressId } = req.body;
  let productById = await Products.findById(productId);
  let user = req.user;
  let deliveryAddress = await user.address.id(addressId);

  console.log(addressId);
  console.log("da:  ", deliveryAddress);
  console.log(quantity);

  let order = {
    user: req.user._id,
    products: [{
      product: productId,
      quantity: quantity
    }],
    totalAmount: quantity * productById.price,
    address: {
      name: deliveryAddress.name,
      mobileNumber: deliveryAddress.mobileNumber,
      city: deliveryAddress.city,
      pincode: deliveryAddress.pincode,
      houseNumber: deliveryAddress.houseNumber,
    }

  };

  console.log(order);
  let newOrder = new Orders(order);
  let createdOrder = await newOrder.save();
  console.log(createdOrder);

  var instance = new Razorpay({
    key_id: process.env.Razorpay_key,
    key_secret: process.env.Razorpay_secret,
  });

  var options = {
    amount: quantity * productById.price * 100,  // Amount is in currency subunits. Default currency is INR. Hence, 50000 refers to 50000 paise
    currency: "INR",
    receipt: createdOrder._id
  };

  let ordercreated = await instance.orders.create(options);

  res.render("main/finalpayment.ejs", {
    order: ordercreated,
    key_id: process.env.Razorpay_key,
    createdorder: createdOrder._id
  });
});

app.post("/payment/verify", async (req,res) => {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    createdorder,// This must be your MongoDB order _id
  } = req.body;

  const generated_signature = crypto
    .createHmac("sha256", process.env.Razorpay_secret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");
  console.log("order id " + createdorder);

  if (generated_signature === razorpay_signature) {
    let updatedorder = await Orders.findByIdAndUpdate(createdorder, {
      status: "processing",
      paymentId: razorpay_payment_id
    });
    console.log(updatedorder);

    // let productId = updatedorder.products[0].product;
    // let productquantity = updatedorder.products[0].quantity;
    // let abliablequantity = Products.findById(productId);
    // let updatedProduct = await Products.findByIdAndUpdate(productId,{stock : abliablequantity-productquantity });
    // console.log(updatedProduct);
    console.log("befor resjson");
    res.json({ message: "success" });
    console.log("afterresjson");

  } else {
    res.status(400).json({ error: "Signature verification failed" });
  }

});

app.get("/payment/success/:createdorder", async(req, res) => {
  let {createdorder} = req.params;
  let order = await Orders.findById(createdorder);

  res.render("main/success.ejs",{order});
})

app.get("/user/orders",async (req,res)=>{
  let userId = req.user._id;
  console.log(userId);
  let Order = await Orders.find({user : userId});
  console.log(Order);
  res.render("main/orders.ejs",{Order});
})
// app listing
app.listen(port, () => {
  console.log(`listing port${port}`);
});