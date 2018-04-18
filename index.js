PATH = __dirname;

const express = require('express');
const app = express();
app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');

const http = require('http');
const url = require('url');
var tasks = require('./tasks');

const config = require(__dirname + "/config.json");

var isLocal = false;
if (config.env == "local") {
  isLocal = true;
}

var WebSocket = require('ws');
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({host:config.wshost ,port: 9090});
var fs = require('fs');


app.get('/', function(req, res){
  res.render("form.html", { });
})

app.get('/scrape', function (req, res) {
  //var ws = new WebSocket('ws://localhost:8081');

  var qAr = [];
  for (var k in req.query) {
    qAr.push(k + "=" + req.query[k]);
  }

  var args = qAr.join(" ");
  res.render("data.html", { command: "ds " + args, wshost: config.wshost });
  // fs.readFile('data.html', function (err, data) {
  //   res.writeHead(200, {
  //     'Content-Type': 'text/html',
  //     'Content-Length': data.length
  //   });
  //   res.write(data);
  //   res.end();
  // });

  // ws.on('open', function () {
  //   ws.send("ds " + args);
  // });
  //
  // ws.on('message', function (message) {
  //   change(message);
  //   //var data = fs.readFileSync(message).toString();
  //
  // });
})

app.get('/getfile', function(req, res){
  var path = req.query['path'];
  path = new Buffer(path, 'base64').toString('ascii');
  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.download(path);

  // var data = fs.readFileSync(path).toString();
  // res.writeHead(200, {
  //   'Content-Type': "application/vnd.ms-excel",
  //   'Content-disposition': 'attachment;filename=data.xlsx',
  //   'Content-Length': data.length
  // });
  //res.end(new Buffer(data, 'binary'));
})

var port = isLocal ? 4000 : 80;
app.listen(port, function () {
  console.log('Start Application Service');
});


wss.on('connection', function (ws) {
  ws.on('message', function (message) {
    console.log("message received. starting task.");
    tasks.runCommand(message, function (res) {
      ws.send(res);
    });
  });
});
