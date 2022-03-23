const mongoose= require('mongoose');
const { schema } = require('./itemModel');
const Schema=mongoose.Schema;

const reportSchema = new Schema({
    uid: {
        type: String,
       // required: true
    },
    type:{
        type:String,
        required: true
    },
    description:{
        type:String,
        required:true
    }
}, {timestamps: true});

const reportModel = mongoose.model('Report', reportSchema);
module.exports = reportModel;