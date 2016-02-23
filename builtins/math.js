const pltLib = require('../plt_lib');

module.exports = pltLib.toObjectToken({
  sign: pltLib.toFunctionToken(num => {
    console.log('Get the sign of', num);
  })
});
