const express = require("express");
const mongoose = require("mongoose");
const data = require("./data.js");
const Products = require("../models/products.js");
const env = require('dotenv').config();

const app = express();
const port = 8080;


mongoose.connect(process.env.mongo_url)
  .then(() => console.log('Connected!')).catch((err)=>{
    console.log("error in connenting with database",err)
  });


app.get("/",async(req,res)=>{
    await Products.insertMany(data);
    res.send("data initiated successfully");
    
})
app.listen(port,()=>{
    console.log(`listing port${port}`);
})