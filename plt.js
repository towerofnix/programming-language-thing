"use strict";

{

  // Shim a few not syntax related parts of ES7. Helps a tinny itsy bit with
  // compatibility.
  if (typeof require !== 'undefined') {
    const shim = require('es7-shim');
    shim.shim();
  }

  let _console;
  const globalSpace = (
    typeof window !== 'undefined' ? window :
      typeof global !== 'undefined' ? global :
      typeof GLOBAL !== 'undefined' ? GLOBAL :
      {}
  );

  const deepEqual = function(x, y) {
    // http://stackoverflow.com/a/32922084/4633828
    return (x && y && typeof x === 'object' && typeof y === 'object') ?
      (Object.keys(x).length === Object.keys(y).length) &&
        Object.keys(x).reduce(function(isEqual, key) {
          return isEqual && deepEqual(x[key], y[key]);
        }, true) : (x === y);
  }

  // ---

  const isDefined = function(n) {
    return typeof n !== 'undefined';
  };

  const isUndefined = function(n) {
    return typeof n === 'undefined';
  };

  const toFunctionToken = function(cb) {
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
  };

  const toNumberToken = function(n) {
    return {type: 'number', value: +n};
  }

  const printTokens = function(tokens, indent = 1) {
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
  };

  const callFunction = function(functionExpr, args) {
    const functionCode = functionExpr.code;

    // console.log('function code is', functionCode);
    let result;
    if (functionCode instanceof Function) {
      result = functionCode(...args);
    } else {
      const functionArgs = functionExpr.args;
      const functionScopeArgs = {};
      // console.log('args are', args);
      for (let [ i, argName ] of Object.entries(functionArgs)) {
        const argValue = i in args ? args[i] : undefined;
        functionScopeArgs[argName] = argValue;
      }
      // console.log('function scope args are', functionScopeArgs);

      const functionScope = Object.assign(
        {}, functionExpr.variables, functionScopeArgs);
      // console.log('function scope is', functionScope);

      result = interp(functionCode.value, functionScope);
    }

    return result;
  }

  const topToken = function(tokens, needsChildren) {
    let t = tokens[0];
    while (true) {
      if (t && t.value instanceof Array) {
        const lastTokenInValue = t.value[t.value.length - 1];
        if (needsChildren && lastTokenInValue &&
            !(lastTokenInValue.value instanceof Array)) {
          return t;
        }
        if (lastTokenInValue && !(lastTokenInValue.done)) {
          t = t.value[t.value.length - 1];
          continue;
        }
      }
      return t;
    }
  };

  const parse = function(code) {
    const tokens = [{type: 'holder', value: [], done: false}];

    const pushToken = function(token) {
      topToken(tokens, true).value.push(token);
    };

    let index = 0;
    let inlineComment = false;
    while (index < code.length) {
      const char = code[index];
      const nextChar = code[index + 1];
      const lastChar = code[index - 1];
      const parentTop = topToken(tokens, true); // top that can have children
      const top = topToken(tokens, false);

      if (inlineComment) {
        if (char === '\n') {
          inlineComment = false;
        }

        index += 1;
        continue;
      } else {
        if (top.type !== 'string' && char === '#') {
          inlineComment = true;
          index += 1;
          continue;
        }
      }

      // console.log(index, `{${char}}`, top);

      if (char === ' ' || char === '\n' || char === '\t') {
        // Ignore indentation and line breaks, unless in a string.
        if (!(top.type === 'string')) {
          if (top.type === 'text' || top.type === 'number') {
            top.done = true;
          }
          index += 1;
          continue;
        }
      }

      if (char === '(') {
        // Begin a paren token, unless in a string.
        if (!(top.type === 'string')) {
          pushToken({type: 'paren', value: [], done: false});
          index += 1;
          continue;
        }
      }

      if (char === ')') {
        // Close a paren token, unless in a string.
        if (!(top.type === 'string')) {
          if (parentTop.type === 'paren') {
            parentTop.done = true;
          } else {
            console.error('Invalid paren close');
          }
          index += 1;
          continue;
        }
      }

      if (char === '{') {
        // Begin a block token, unless in a string.
        if (!(top.type === 'string')) {
          pushToken({type: 'block', value: [], done: false});
          index += 1;
          continue;
        }
      }

      if (char === '}') {
        // Close a block token, unless in a string.
        if (!(top.type === 'string')) {
          if (top.type === 'block') {
            top.done = true;
          } else {
            console.error('Invalid block close');
          }
          index += 1;
          continue;
        }
      }

      if (char == '\'') {
        // If already in a string, close.
        // Else, start a string.
        if (top.type === 'string') {
          top.done = true;
        } else {
          pushToken({type: 'string', value: '', done: false});
        }
        index += 1;
        continue;
      }

      if (top.type === 'string' || top.type === 'number' ||
          top.type === 'text') {
        top.value += char;
      } else {
        if (isNaN(char)) {
          pushToken({type: 'text', value: char, done: false});
        } else {
          pushToken({type: 'number', value: char, done: false});
        }
      }

      index += 1;
    }

    return tokens;
  };

  const interp = function(tokens, parentVariables) {
    // console.group('level of interp');

    // Allow just a token to be passed instead of an array of tokens.
    if (!(tokens instanceof Array)) {
      return interp([tokens], parentVariables);
    }

    // console.log('interp was passed variables', parentVariables);
    const variables = Object.assign({}, builtins, parentVariables);
    // console.log(printTokens(tokens))
    // console.log('--------');

    let returnTokens = [];
    let i = 0;
    let settingVariable = null;
    let settingVariableType = null;

    const checkAssign = function() {
      if (settingVariableType && returnTokens.length) {
        const value = returnTokens.pop();
        if (settingVariableType === 'return') {
          returnTokens = [value];
        } else if (settingVariableType === 'assign') {
          variables[settingVariable] = value;
        } else if (settingVariableType === 'change') {
          const variable = variables[settingVariable];
          if (value.type === variable.type) {
            Object.assign(variable, value);
          }
        }
      }
    }

    while (i < tokens.length) {

      // console.log(i, tokens[i]);
      // console.log(printTokens(tokens));

      checkAssign();

      if (tokens[i] &&
          tokens[i].type === 'holder') {
        // Holders are generated by parsers. They should basically just be
        // replaced with the code inside themselves.

        const holder = tokens[i];
        const code = holder.value;

        // Replace holder with it's code, i.e. delete 1 item at tokens[i] and
        // insert all of the code at i.
        tokens.splice(i, 1, ...code);

        continue;
      }

      if (tokens[i] && tokens[i + 1] &&
          tokens[i].type     === 'text' &&
          tokens[i + 1].type === 'text' && tokens[i + 1].value === '->') {
        // Variable set, i.e. `name -> value`.
        const variableName = tokens[i].value;
        variables[variableName] = null;
        settingVariable = variableName;
        settingVariableType = 'assign';
        i += 2;
        continue;
      }

      // Change variable, see #7
      if (tokens[i] && tokens[i + 1] &&
          tokens[i].type     === 'text' &&
          tokens[i + 1].type === 'text' && tokens[i + 1].value === '-=') {
        const variableName = tokens[i].value;
        settingVariable = variableName;
        settingVariableType = 'change';
        console.log('hmm', settingVariable);
        i += 2;
        continue;
      }

      if (tokens[i] && tokens[i + 1] && tokens[i + 2] &&
          tokens[i].type     === 'text'  && tokens[i].value === 'fn' &&
          tokens[i + 1].type === 'paren' &&
          tokens[i + 2].type === 'block') {

        // TODO: functions can have an argument called "fn"
        const argsToken = tokens[i + 1];
        const args = [];
        for (var argToken of argsToken.value) {
          if (argToken.type === 'text') {
            args.push(argToken.value);
          } else {
            throw 'Invalid token inside argument list';
          }
        }

        const code = tokens[i + 2];
        const functionExpr = {
          type: 'function_expr',
          variables: variables,
          args: args,
          code: code
        };
        tokens.splice(i, 3, functionExpr);
        continue;
      }

      if (tokens[i] && tokens[i + 1] &&
          tokens[i].type     === 'function_expr' &&
          tokens[i + 1].type === 'paren') {
        // TODO: do something related to function calling

        const functionExpr = tokens[i];
        // console.log('function call:', functionExpr);
        // console.group('argument list');
        const args = interp(tokens[i + 1].value, variables);
        // console.groupEnd('argument list');
        // console.log('interpreted arguments are', args);
        // debugger;
        const result = callFunction(functionExpr, args);

        if (result.filter(isDefined).length) {
          tokens.splice(i, 2, ...result);
        } else {
          tokens.splice(i, 2);
        }
        // i += 2;
        continue;
      };

      if (tokens[i] && tokens[i + 1] &&
          tokens[i].type === 'text' && tokens[i].value === '^') {
        // Override return tokens with a new value;
        settingVariableType = 'return';
        i += 1;
        continue;
      }

      if (tokens[i] &&
          tokens[i].type === 'text') {
        // Just a variable.

        const variableName = tokens[i].value;

        if (variableName in variables) {
          const variableValue = variables[variableName];
          tokens.splice(i, 1, variableValue);
          continue;
        } else {
          console.log('variables are', variables);
          throw `Variable ${variableName} is not defined`;
        }
      }

      returnTokens.push(tokens[i]);

      i += 1;
    }

    checkAssign();

    // console.log('returned tokens:', returnTokens);

    // console.groupEnd('level of interp');

    return returnTokens;
  };

  // ---

  const builtins = {
    print: toFunctionToken(token => {
        if(!token) {
          _console.log(undefined);
        } else if (token.type === 'string' || token.type === 'number') {
          _console.log(token.value);
        } else {
          _console.log(token);
        }
      }),

    // Control structures -----------------------------------------------------
    // See also: #5
    if: toFunctionToken((n, fn) => {
        if (!!+n.value) {
          callFunction(fn);
        }
      }),
    ifel: toFunctionToken((n, ifFn, elseFn) => {
        if (!!+n.value) {
          return callFunction(ifFn);
        } else {
          return callFunction(elseFn);
        }
      }),
    repeat: toFunctionToken((n, fn) => {
      for(let i = 0; i < parseInt(n.value); i++) {
        callFunction(fn, [toNumberToken(i)]);
      }
    }),

    // Comparison operators ---------------------------------------------------
    // See also: #6
    gt: toFunctionToken((x, y) => {
        return toNumberToken(+x.value > +y.value);
      }),
    lt: toFunctionToken((x, y) => {
        return toNumberToken(x.value < y.value);
      }),
    eq: toFunctionToken((x, y) => {
        return toNumberToken(x.value === y.value);
      }),

    // Boolean operators ------------------------------------------------------
    // See also: #6
    not: toFunctionToken((x) => {
        return toNumberToken(+!+x.value);
      }),
    and: toFunctionToken((x, y) => {
        return toNumberToken(+x.value && +y.value);
      }),
    or: toFunctionToken((x, y) => {
        return toNumberToken(+x.value || +y.value);
      }),

    add: toFunctionToken(function({ value: x }, { value: y }) {
        const number = (
          parseFloat(x) +
          parseFloat(y));
        return toNumberToken(number);
      }),
    subtract: toFunctionToken(function({ value: x }, { value: y }) {
        const number = (
          parseFloat(x) -
          parseFloat(y));
        return toNumberToken(number);
      }),
    multiply: toFunctionToken(function({ value: x }, { value: y }) {
        const number = (
          parseFloat(x) *
          parseFloat(y));
        return toNumberToken(number);
      }),
    divide: toFunctionToken(function({ value: x }, { value: y }) {
        const number = (
          parseFloat(x) /
          parseFloat(y));
        return toNumberToken(number);
      }),
    exp: toFunctionToken(function({ value: x }, { value: y }) {
        const number = Math.pow(
          parseFloat(x),
          parseFloat(y));
        return toNumberToken(number);
      }),
    mod: toFunctionToken(function({ value: x }, { value: y }) {
        const number = (
          parseFloat(x) %
          parseFloat(y));
        return toNumberToken(number);
      })
  };

  const init = function(args) {
    if (typeof args === 'undefined') args = {};
    if (!('console' in args)) args['console'] = globalSpace.console;
    _console = args['console'];
  };

  init();

  // Exports.
  const exportModule = Object.assign(function plt(code) {
    return interp(parse(code));
  }, {parse, interp, init});
  const exportSpace = globalSpace;
  if (typeof module !== 'undefined') {
    module.exports = exportModule;
  } else if (exportSpace !== '{}') {
    exportSpace.plt = exportModule;
  }
}
