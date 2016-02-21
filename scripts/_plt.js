const plt = require('../plt');
const fs = require('fs');

const args = process.argv.slice(2);

fs.readFile(args[0], function(err, data) {
  if (err) {
    console.log(err);
    return;
  }

  const text = data.toString('utf-8');
  plt(text);
});
