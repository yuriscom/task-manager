PATH = __dirname;

const express = require('express');
const app = express();
const http = require('http');
const url = require('url');
var tasks = require('./tasks');

var WebSocket = require('ws');
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8080});
var fs = require('fs');

app.get('/', function (req, res) {
  var ws = new WebSocket('ws://localhost:8080');

  var qAr = [];
  for (var k in req.query) {
    console.log(k);
    console.log(req.query[k]);
    qAr.push(k + "=" + req.query[k]);
  }

  var args = qAr.join(" ");

  ws.on('open', function () {
    ws.send("ds " + args);
  });

  ws.on('message', function (message) {
    var data = fs.readFileSync(message).toString();

    res.writeHead(200, {
      'Content-Type': "application/vnd.ms-excel",
      'Content-disposition': 'attachment;filename=data.xlsx',
      'Content-Length': data.length
    });
    res.end(new Buffer(data, 'binary'));
  });

})

app.listen(3000, function () {
  console.log('Start Application Service');
});


wss.on('connection', function (ws) {
  ws.on('message', function (message) {
    tasks.runCommand(message, function (res) {
      ws.send(res);
    });
  });
});