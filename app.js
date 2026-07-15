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
const dns = require('dns');
dns.setServers(['8.8.8.8']);
const flash = require('connect-flash');
const { loginCheck, loginPresist } = require("./middelware.js");
const Razorpay = require('razorpay');
const crypto = require("crypto");

const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

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

app.use((req,res,next)=>{
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  next();
})
  // all routs

app.get("/", async (req, res) => {

  const products = await Products.find();
  res.render("main/index.ejs", { products });
})
app.get("/policy",(req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'Policy.pdf'));
})

app.get("/contact", (req, res) => {
  res.render("main/contact.ejs", { title: "Contact Us" });
});

app.post("/contact", (req, res) => {
  const { name, email, message } = req.body;
  // TODO: Save to DB or send email
  console.log("Contact form submitted:", name, email, message);
  res.redirect("main/contact.ejs");
});

// Pricing route
app.get("/pricing",(req,res)=>{
  res.render("main/pricing.ejs", { title: "Pricing - Apni Dukan" });
})

// features route
app.get("/features", (req, res) => {
  res.render("main/features.ejs", { title: "Features - Apni Dukan" });
});


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

app.get("/user/otp_verification_form", (req, res) => {
  res.render("main/otp_verification_form.ejs");

})
app.post("/user/otp_verification_submit_form",async(req,res)=>{
  const {userMobile} = req.body;

  const user= await Users.findOne({"userMobile" : userMobile});
  console.log(user);
  if(user){
    try{
client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications
      .create({to: `+91${userMobile}`, channel: 'sms'})
      .then(verification => {console.log(verification.sid);
        req.flash('success', 'OTP sent Successfully');
        res.locals.success = req.flash('success');
 res.render("main/otp_verification_submit_form.ejs",{userMobile});
      });
    }
    catch(error){
      next(error);
    } 
  }
  else{
    req.flash('error', 'No user found with this Mobile No. ! Please Signup First');
    console.log("no user found ");
    res.redirect("/user/signup");
  }
  
})

// OTP verification route
app.post("/user/otp_verification", async (req, res, next) => {
  try {
    const { userMobile, code } = req.body;

    // Check OTP with Twilio
    const check = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks
      .create({ to: `+91${userMobile}`, code });

    if (check.status === "approved") {
      // Find or create user in DB
      let user = await Users.findOne({"userMobile" : userMobile});
      
      // Passport login
      req.login(user, (err) => {
        if (err) return next(err);
        return res.redirect("/");
      });
    } else {
      req.flash("error","Invalid OTP send again !");
    res.redirect("/user/otp_verification_form");
    }
  } catch (err) {
    next(err);
  }
});




app.post("/user/signup", async (req, res) => {

  let user_Data = req.body;
  let { name, userMobile, password, email } = req.body;
  console.log(user_Data);
  try {
    const user = await Users.register({ name: name, userMobile: userMobile, email: email }, password);
    console.log("successfuly resistered");

    req.login(user, (err) => {
      if (err) {
        req.flash('error', 'Login !');
        res.redirect("/user/login");
      }
      else{
        req.flash('success', 'Registerd Successfully & Loged In ');
      res.redirect("/");
      }
    })

  }
  catch (error) {
    console.log(error.message);
    let err = `Registration Failed ! Register Again - ${error.message}`;
    req.flash('error', err);
    res.redirect("/user/signup");
  }

});

app.get("/user/login", (req, res) => {
  res.render("main/login.ejs");
})

app.post("/user/login", loginPresist, passport.authenticate("local", { failureRedirect: "/user/login",failureFlash: true }), (req, res) => {
  
  if (res.locals.targetUrl) {
    req.flash("success", "Thank You - login successfull !");
    res.redirect(res.locals.targetUrl);
  }
  else {
    req.flash("success", "Thank You - login successfull !");
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
      req.flash('error', 'Logout Failed ! Logout again');
      res.redirect("/")
    }
    req.flash('success', 'Successfully Loged out - Thank You visit again ! ');
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
    amount: quantity * productById.price * 100,  // Amount is in currency subunits.
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