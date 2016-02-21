const pltLib = {
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
  }
};

module.exports = pltLib;
