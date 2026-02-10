const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new mongoose.Schema({


    name :{
        type : String,
        required : true,
        minlength : 2
    },
    userMobile: {
        type: String,
        required: true,
        unique: true,
        match: [/^\d{10}$/, 'Must be a valid 10-digit number'],
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
    }, 
    address: [
        {
            name: {
                type: String,
                required: true,
            },
            mobileNumber: {
                type: Number,
                required: true,
                
            },
            city : String,
            pincode :{
                type : Number,
                
            },
            houseNumber : String,
        }
    ],
    
    isAdmin: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

userSchema.plugin(passportLocalMongoose,{
    usernameField : "userMobile"
});

module.exports = mongoose.model('User', userSchema);
