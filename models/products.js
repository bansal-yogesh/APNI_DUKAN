const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        maxlength: 1000
    },
    category: {
        type: String,
        required: true,
        enum :["electronics","home","grocery","personal-care","yoga","stationary"]
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    stock: {
        type: Number,
        default: 0,
        min: 0
    },
    images: [
        {
url :{
    type :String,
    default :"https://images.unsplash.com/photo-1591280063444-d3c514eb6e13?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8aW1hZ2VzfGVufDB8fDB8fHww"
},
title :{
    type : String,
}
      
    }
],

 created_at: {
    type: Date,
    default: Date.now,
  },
    // ratings: {
    //     type: Number,
    //     default: 0,
    //     min: 0,
    //     max: 5
    // },
    // reviewsCount: {
    //     type: Number,
    //     default: 0
    // }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);