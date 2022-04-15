const mongoose = require('mongoose');// connect to db
const Schema = mongoose.Schema; //build schema

//the form of the schema
const reportSchema = new Schema({
    reporterID: { // report maker
        type: String,
       // required: true
    },
    recipientID: { // report on
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