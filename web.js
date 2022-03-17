const mongoose = require('mongoose');

// connect to mongodb & listen for requests
const dbURI = 'mongodb+srv://bidiy:bidit8@cluster0.ybuco.mongodb.net/bidit?retryWrites=true&w=majority';

mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(result => app.listen(3000))
  .catch(err => console.log(err));