const mongoose = require('mongoose');

const categories = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    }
},
    { timestamps: true }
);

const Categories = mongoose.model('categories', categories);

module.exports = Categories;