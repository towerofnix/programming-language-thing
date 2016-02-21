const pltLib = require('./plt_lib');

module.exports = {
  foo: pltLib.toFunctionToken(() => {
    console.log('o_o;');
  })
};
