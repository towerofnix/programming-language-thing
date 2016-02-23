const fs = require('fs');
const path = require('path');

const pltLib = require('./plt_lib');

const PATH = path.resolve(__dirname);
const BUILTINS = PATH + '/builtins/';

let _console;

const init = function(args) {
  if (typeof args === 'undefined') args = {};
  if (!('console' in args)) args['console'] = console;
  _console = args['console'];
};

init();

const builtins = {
  print: pltLib.toBuiltinFunction(token => {
    if (token.type === 'string' || token.type === 'number') {
      _console.log('(print)', token.value);
    } else {
      _console.log('(print)', token);
    }
  }),

  use: pltLib.toBuiltinFunction(token => {
    if (token.type === 'string') {
      _console.log('use ' + token.value);

      let filePath;

      if (fs.existsSync(token.value)) {
        // File exists relative to running program's file.
        filePath = path.resolve(token.value);
      } else if (fs.existsSync(BUILTINS + token.value)) {
        // File exists in builtins path.
        filePath = path.resolve(BUILTINS + token.value);
      } else {
        // File does not exist.
        filePath = null;
      }

      if (filePath !== null) {
        const extension = pltLib.last(filePath.split('.'));
        if (extension === 'js') {
          // JavaScript file, use `require`
          const result = require(filePath);
          return result;
        } else if (extension === 'plt') {
          // PLT file, call as though it were a function
          // TODO
        } else {
          // Some other file, throw error
          console.error('Invalid imported file type:', extension);
          console.error('Path:', filePath);
          throw new Error;
        }
      }
    }
  }),

  obj: pltLib.toBuiltinFunction(() => {
    return {type: 'object', map: new Map};
  }),

  // Control structures -----------------------------------------------------
  // See also: #5
  'if': pltLib.toBuiltinFunction((n, fn) => {
    if (+n.value) {
      pltLib.callFunction(fn);
    }
  }),
  ifel: pltLib.toBuiltinFunction((n, ifFn, elseFn) => {
    if (+n.value) {
      return pltLib.callFunction(ifFn);
    } else {
      return pltLib.callFunction(elseFn);
    }
  }),

  // Comparison operators ---------------------------------------------------
  // See also: #6
  gt: pltLib.toBuiltinFunction((x, y) => {
    return pltLib.toNumberToken(+x.value > +y.value);
  }),
  lt: pltLib.toBuiltinFunction((x, y) => {
    return pltLib.toNumberToken(x.value < y.value);
  }),
  eq: pltLib.toBuiltinFunction((x, y) => {
    return pltLib.toNumberToken(x.value === y.value);
  }),

  // Boolean operators ------------------------------------------------------
  // See also: #6
  not: pltLib.toBuiltinFunction((x) => {
    return pltLib.toNumberToken(+!+x.value);
  }),
  and: pltLib.toBuiltinFunction((x, y) => {
    return pltLib.toNumberToken(+x.value && +y.value);
  }),
  or: pltLib.toBuiltinFunction((x, y) => {
    return pltLib.toNumberToken(+x.value || +y.value);
  }),

  // add: pltLib.toBuiltinFunction(function({ value: x }, { value: y }) {
  add: pltLib.toBuiltinFunction((x, y) => {
    const number = +x.value + +y.value;
    return pltLib.toNumberToken(number);
  }),
  subtract: pltLib.toBuiltinFunction((x, y) => {
    const number = +x.value - +y.value;
    return pltLib.toNumberToken(number);
  }),
  multiply: pltLib.toBuiltinFunction((x, y) => {
    const number = +x.value * +y.value;
    return pltLib.toNumberToken(number);
  }),
  divide: pltLib.toBuiltinFunction((x, y) => {
    const number = +x.value / +y.value;
    return pltLib.toNumberToken(number);
  }),
  exp: pltLib.toBuiltinFunction((x, y) => {
    const number = Math.pow(+x.value, +y.value);
    return pltLib.toNumberToken(number);
  }),
  mod: pltLib.toBuiltinFunction((x, y) => {
    const number = x.value % y.value;
    return pltLib.toNumberToken(number);
  })
};

builtins.mul = builtins.multiply;
builtins.sub = builtins.subtract;

module.exports = {builtins, init};
