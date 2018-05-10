var express = require('express');
var cors = require('cors');
var bodyParser = require("body-parser");
var app = express();
var port = process.env.PORT || 3100;

app.use(bodyParser.json());
app.use(cors());

app.use(bodyParser.urlencoded({
    extended: false
}));

var Ideas = require('./Routes/Ideas');

app.use('/ideas',Ideas);

app.listen(port,function(){
    console.log("Microservicio Ideas, Corriendo en el puerto: "+port);
});