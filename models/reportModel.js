const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reportSchema = new Schema({
    repoerterID: { // report maker
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