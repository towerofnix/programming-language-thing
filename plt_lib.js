let interp = function() {
  console.log('Not initialized!!!');
  throw new Error;
};

const pltLib = {
  deepEqual(x, y) {
    // http://stackoverflow.com/a/32922084/4633828
    return (x && y && typeof x === 'object' && typeof y === 'object') ?
      (Object.keys(x).length === Object.keys(y).length) &&
        Object.keys(x).reduce(function(isEqual, key) {
          return isEqual && pltLib.deepEqual(x[key], y[key]);
        }, true) : (x === y);
  },

  last(array) {
    return array[array.length - 1];
  },

  includes(array, item) {
    return array.indexOf(item) > -1;
  },

  isDefined(n) {
    return typeof n !== 'undefined';
  },

  toFunctionToken(cb) {
    return {
      type: 'function_expr',
      code: function(...args) {
        // debugger;
        const result = cb(...args);
        // debugger;
        if (result instanceof Array) {
          return result;
        } else {
          return [result];
        }
      }
    };
  },

  toNumberToken(n) {
    return {type: 'number', value: +n};
  },

  toVariableToken(v) {
    return {type: 'variable', value: v};
  },

  toBuiltinFunction(f) {
    return pltLib.toVariableToken(pltLib.toFunctionToken(f));
  },

  callFunction(functionExpr, args) {
    const functionCode = functionExpr.code;
    // console.log('Call function', functionExpr, 'with arguments', args);

    let result;
    if (functionCode instanceof Function) {
      result = functionCode(...args);
    } else {
      const functionArgs = functionExpr.args;
      const functionScopeArgs = {};
      // console.log('args are', args);
      for (let [ i, argName ] of Object.entries(functionArgs)) {
        const argValue = i in args ? args[i] : null;
        functionScopeArgs[argName] = argValue;
      }
      // console.log('function scope args are', functionScopeArgs);

      const functionScope = Object.assign(
        {}, functionExpr.variables, functionScopeArgs);
      // console.log('function scope is', functionScope);

      result = interp(functionCode.value, functionScope);
    }

    return result;
  },

  printTokens(tokens, indent = 1) {
    return JSON.stringify(tokens, [
      // General tokens
      'type', 'value',

      // Function call
      'name', 'args',

      // Function expression
      'args', 'code',

      // Debugging
      'done'
    ], indent);
  },

  initLib({interp: _interp}) {
    if (_interp instanceof Function) interp = _interp;
  }
};

module.exports = pltLib;
