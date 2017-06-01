var readline = require('readline')
  , readlineInterface = readline.createInterface(
    process.stdin,
    process.stdout
  );

readlineInterface.setPrompt('OHAI> ');
readlineInterface.prompt();

readlineInterface.on('line', function(command) {
  runCommand(command);
  readlineInterface.prompt();
}).on('close', close);

function runCommand(line, callback) {
  var lineAr = line.split(" ");
  var command = lineAr.shift();
  var args = lineAr;
  var argObj = {};
  for (var k in args) {
    var argAr = args[k].split("=");
    if (argAr.length == 2) {
      argObj[argAr[0]] = argAr[1];
    }
  }

  console.log(argObj);
  switch (command) {
    case 'bla':
      console.log("blabla");
      break;
    case 'ds':
      var propercallback = function(res) {
        console.log("done.");
        readlineInterface.prompt();
        if (callback) {
          callback(res);
        }
      }

      require('./generators/ds.js')(argObj, propercallback);
    case 'quit':
    case 'q':
      close();
      break;
    case 'rs':
      break;
    default:
      console.log('Unknown command!');
      break;
  }
}

function close() {
  //console.log('Exit Application Server');
  //readlineInterface.close();
  //process.exit();
}



module.exports.runCommand = runCommand;
