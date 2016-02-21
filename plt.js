'use strict';

const generalBuiltins = require('./general_builtins');
const nodeBuiltins = require('./node_builtins');

{

  // Shim a few not syntax related parts of ES7. Helps a tinny itsy bit with
  // compatibility.

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
  };

  const last = function(array) {
    return array[array.length - 1];
  };

  const includes = function(array, item) {
    return array.indexOf(item) > -1;
  };

  // ---

  const isDefined = function(n) {
    return typeof n !== 'undefined';
  };

  const toVariableToken = function(v) {
    return {type: 'variable', value: v};
  };

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
  };

  const topToken = function(tokens, needsChildren, pop) {
    let t = tokens[0];
    while (true) {
      if (t && t.value instanceof Array) {
        if (includes(t.value, pop)) {
          return t;
        }
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

    let i = 0;
    let inlineComment = false;
    while (i < code.length) {
      const char = code[i];
      const parentTop = topToken(tokens, true); // top that can have children
      const top = topToken(tokens, false);

      if (inlineComment) {
        if (char === '\n') {
          inlineComment = false;
        }

        i += 1;
        continue;
      } else {
        if (top.type !== 'string' && char === '#') {
          inlineComment = true;
          i += 1;
          continue;
        }
      }

      if (char === ' ' || char === '\n' || char === '\t') {
        // Ignore indentation and line breaks, unless in a string.
        if (!(top.type === 'string')) {
          if (top.type === 'text' || top.type === 'number') {
            top.done = true;
          }
          i += 1;
          continue;
        }
      }

      if (char === '(') {
        // Begin a paren token, unless in a string.
        if (!(top.type === 'string')) {
          pushToken({type: 'paren', value: [], done: false});
          i += 1;
          continue;
        }
      }

      if (char === ')') {
        // Close a paren token, unless in a string.
        if (!(top.type === 'string')) {
          if (parentTop.type === 'paren') {
            parentTop.done = true;
          } else {
            console.error(printTokens(tokens));
            console.error('Invalid paren close');
            debugger;
          }
          i += 1;
          continue;
        }
      }

      if (char === '{') {
        // Begin a block token, unless in a string.
        if (!(top.type === 'string')) {
          pushToken({type: 'block', value: [], done: false});
          i += 1;
          continue;
        }
      }

      if (char === '}') {
        // Close a block token, unless in a string.
        if (!(top.type === 'string')) {
          if (top.type === 'block') {
            top.done = true;
          } else {
            console.error(printTokens(tokens));
            console.error('Invalid block close');
            debugger;
          }
          i += 1;
          continue;
        }
      }

      if (char === '.') {
        const objectDot = {type: 'object_dot'};
        pushToken(objectDot);
        i += 1;
        continue;
      }

      if (char === ':') {
        const objectColon = {type: 'object_colon'};
        pushToken(objectColon);
        i += 1;
        continue;
      }

      if (char === '\'') {
        // If already in a string, close.
        // Else, start a string.
        if (top.type === 'string') {
          top.done = true;
        } else {
          pushToken({type: 'string', value: '', done: false});
        }
        i += 1;
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

      i += 1;
    }

    return tokens;
  };

  const interp = function(tokens, parentVariables) {
    // Allow just a token to be passed instead of an array of tokens.
    if (!(tokens instanceof Array)) {
      return interp([tokens], parentVariables);
    }

    // console.group('level of interp');

    tokens = tokens.slice();
    const variables = Object.assign({}, builtins, parentVariables);

    // Make all the passed arguments into variable tokens, just in case
    // non-variable tokens were passed.
    for (let vName in variables) {
      const v = variables[vName];
      if (v == undefined) {
        delete variables[vName];
      } else if (v.type === 'variable') {
        variables[vName] = v;
      } else {
        variables[vName] = toVariableToken(v);
      }
    }

    const setting = [];
    // console.log(printTokens(tokens))
    // console.log('--------');

    let returnTokens = [];
    let i = 0;

    const checkAssign = function() {
      // console.log('Setting:', setting.slice());
      // console.log('Return tokens:', returnTokens.slice());
      if (setting.length && returnTokens.length) {
        const settingA = setting.pop();
        const value = returnTokens.pop();
        const settingData = settingA[0];
        const settingType = settingA[1];
        // console.log('Got that setting data!');
        // console.log('Type:', settingType);
        // console.log('Data:', settingData);
        // console.log('Value:', value);
        if (settingType === 'return') {
          // console.log('Set return value to:', value);
          returnTokens = [value];
        } else if (settingType === 'assign') {
          variables[settingData] = {type: 'variable', value};
        } else if (settingType === 'change') {
          variables[settingData].value = value;
        } else if (settingType === 'object_colon_key') {
          // Create an object_property token based on the data given as well as
          // the return token, which should act as the key.
          if (!(value.type === 'string')) {
            console.error('Invalid key type:', value.type);
            console.error('Would have attempted to use key:', value);
            console.error('Data was:', settingData);
            throw new Error;
          }
          console.log('^.^;');
          const key = value.value;
          const obj = settingData.obj;
          const token = {type: 'object_property', obj, key};
          tokens.splice(i, 0, token);
        } else if (settingType === 'object_property') {
          const obj = settingData.obj;
          const key = settingData.key;
          const map = obj.map;
          map.set(key, value);
        } else {
          console.error('Invalid setting type:', settingType);
          console.error('Would have attempted to set to value:', value);
          console.error('Data was:', settingData);
          throw new Error;
        }
      }
    };

    do {

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

      // console.log(i, tokens[i]);
      // debugger;
      if (tokens[i] && tokens[i + 1] &&
          tokens[i].type     === 'text' &&
          tokens[i + 1].type === 'text' && tokens[i + 1].value === '=>') {
        if (!(last(setting) && last(setting)[1] === 'object_colon_key')) {
          const variableName = tokens[i].value;
          variables[variableName] = null;
          setting.push([variableName, 'assign']);
          tokens.splice(i, 2);
          continue;
        }
      }

      if (tokens[i] &&
          tokens[i].type === 'object_colon') {
        const objToken = returnTokens.pop();
        setting.push([{obj: objToken, key: null}, 'object_colon_key']);
        tokens.splice(i, 1);
        console.log('Huh?', tokens.slice());
        continue;
      }

      if (tokens[i] &&
          tokens[i].type === 'object_dot') {
        const objToken = returnTokens.pop();
        const keyToken = tokens.splice(i + 1, 1)[0];
        if (!(objToken && objToken.type === 'object')) {
          console.error('Token before dot is not object');
          console.error(objToken);
          debugger;
          throw new Error;
        }
        if (!(keyToken && keyToken.type === 'text')) {
          console.error('Token after dot is not text');
          console.error(keyToken);
          debugger;
          throw new Error;
        }
        const objPropertyToken = {
          type: 'object_property', obj: objToken, key: keyToken.value
        };
        tokens.splice(i, 1, objPropertyToken);
        continue;
      }

      if (tokens[i] && tokens[i + 1] &&
          tokens[i].type === 'object_property' &&
          tokens[i + 1].type === 'text' && tokens[i + 1].value === '=>') {
        const objPropertyToken = tokens[i];
        tokens.splice(i, 2);
        setting.push([objPropertyToken, 'object_property']);
        continue;
      }
      else if (tokens[i] &&
               tokens[i].type === 'object_property') {
        const objPropertyToken = tokens[i];
        // ES6 destructuring is failing me here, anybody know why? :(
        const obj = objPropertyToken.obj;
        const key = objPropertyToken.key;
        const map = obj.map;
        tokens.splice(i, 1);
        returnTokens.push(map.get(key));
        continue;
      }

      // Change variable, see #7
      if (tokens[i] && tokens[i + 1] &&
          tokens[i].type     === 'text' &&
          tokens[i + 1].type === 'text' && tokens[i + 1].value === '->') {
        const variableName = tokens[i].value;
        setting.push([variableName, 'change']);
        tokens.splice(i, 2);
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
            console.error('Invalid token inside argument list:', argToken);
            throw new Error;
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
        const functionExpr = tokens[i];
        const paren = tokens[i + 1];
        const args = interp(paren.value, variables);
        const result = callFunction(functionExpr, args);
        if (result.filter(isDefined).length) {
          tokens.splice(i, 2, ...result.filter(isDefined));
        } else {
          tokens.splice(i, 2);
        }
        continue;
      }

      if (tokens[i] && tokens[i + 1] &&
          tokens[i].type === 'text' && tokens[i].value === '^') {
        // Override return tokens with a new value;
        setting.push([null, 'return']);
        tokens.splice(i, 1);
        continue;
      }

      if (tokens[i] &&
          tokens[i].type === 'text') {
        // Just a variable.

        const variableName = tokens[i].value;

        // console.log(`Get variable ${variableName} from`, variables);

        if (variableName in variables) {
          const variableValue = variables[variableName].value;
          tokens.splice(i, 1, variableValue);
          continue;
        } else {
          console.error(`Variable ${variableName} is not defined`);
          debugger;
          throw new Error;
        }
      }

      returnTokens.push(tokens[i]);

      tokens.splice(i, 1);

      checkAssign();

    } while (i < tokens.length);

    // console.log('returned tokens:', returnTokens);

    // console.groupEnd('level of interp');

    return returnTokens;
  };

  const builtins = Object.assign({}, generalBuiltins.builtins, nodeBuiltins.builtins);

  // Builtin aliases:

  // Exports.
  const exportModule = Object.assign(function plt(code) {
    return interp(parse(code));
  }, {parse, interp, printTokens});
  module.exports = exportModule;
}
