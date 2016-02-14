const callFunction = function(tokenOrFunction, args = []) {
  const varArgs = {};

  if (tokenOrFunction instanceof Function) {
    const result = tokenOrFunction(args);
    return result;
  }

  const token = tokenOrFunction;

  console.log('token is', token);
  console.log('token args is', Object.entries(token.args));
  for (let [ i, nameToken ] of Object.entries(token.args)) {
    if (typeof args[i] !== 'undefined') {
      varArgs[nameToken.value] = args[i];
    }
  }
  const vars = Object.assign({}, token.vars, varArgs);
  const resultTokens = interp(token.code, vars);
  const result = resultTokens[resultTokens.length - 1];
  return result;
};

const parseToHigherTokens = function(tokens) {
  if (tokens[0] && tokens[0].type === 'holder') {
    return parseToHigherTokens(tokens[0].value);
  }

  const oldTokens = Object.assign({}, tokens);
  const returnTokens = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];

    if (token && tokens[index + 1] && tokens[index + 2] &&
        token.type === 'text' && tokens[index + 1].type === 'paren' &&
        tokens[index + 2].type === 'block' && token.value === 'fn') {

      // `function_expr` = `(text "fn") paren block`
      // -> {args: paren, code: block}

      const funcToken = {
        type: 'function_expr', args: tokens[index + 1].value,
        code: parseToHigherTokens(tokens[index + 2].value)};

      returnTokens.push(funcToken);
      index += 3;
      continue;
    }

    if (token && tokens[index + 1] &&
        token.type === 'function_expr' && tokens[index + 1].type === 'paren') {

      // `function_call` = `text paren`
      // -> {name: text, args: paren}

      const funcToken = {type: 'function_call', expr: token, args: tokens[index + 1].value};
      returnTokens.push(funcToken);
      index += 2;
      // console.log('add function', funcToken);
      continue;
    }

    if (token && tokens[index + 1] && tokens[index + 2] &&
        token.type === 'text'
        && tokens[index + 1].type === 'set_variable_symbol') {

      // `set_variable` = `text set_variable_symbol (any)`
      // -> {name: text, value: token}

      const setVarToken = {type: 'set_variable', name: token.value, value: tokens[index + 2]};
      returnTokens.push(setVarToken);
      index += 3;
      continue;
    }

    if (token && tokens[index + 1] && tokens[index + 2] &&
        token.type === 'text'
        && tokens[index + 1].type === 'change_variable_symbol') {

      // `set_variable` = `text set_variable_symbol (any)`
      // -> {name: text, value: token}

      const setVarToken = {type: 'change_variable', name: token.value, value: tokens[index + 2]};
      returnTokens.push(setVarToken);
      index += 3;
      continue;
    }

    if (token && token.type === 'block') {
      const blockToken = {type: 'block', value: parseToHigherTokens(token.value)};
      returnTokens.push(blockToken)
      index += 1;
      continue;
    }

    if (token) {
      // console.log('add token', token);
      returnTokens.push(token);
    }

    index += 1;
  }

  // console.log('return tokens are', printTokens(returnTokens));

  if (deepEqual(oldTokens, returnTokens)) {
    // Nothing has changed since the last run therefore nothing ever will
    // change, and as such the parser is done.
    return returnTokens;
  } else {
    // console.log('Keep it going!');
    return parseToHigherTokens(returnTokens);
  }
};

const interp = function(inTokens, variables) {
  // console.group('interp');
  const tokens = parseToHigherTokens(inTokens);
  // console.log(printTokens(tokens));
  // console.log('...');
  // console.log('variables are', variables);
  const vars = Object.assign({}, builtins, variables);

  const firstToken = tokens[0];
  const returnTokens = [];

  if (firstToken && firstToken.type === 'holder') {
    // console.log('skipping into holder');
    return interp(firstToken.value, variables);
  }

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];

    // console.log(index, token);

    if (token && token.type === 'set_variable') {
      const val = interp([token.value], vars)[0];
      console.log(`set variable ${token.name} to`, val);
      if (val.type === 'function_expr') {
        val.vars = Object.assign({}, vars, {[token.value]: val});
      }
      vars[token.name] = val;
      index += 1;
      continue;
    }

    if (token && token.type === 'change_variable') {
      const newToken = interp([token.value], vars)[0];
      const variable = vars[token.name];
      console.log(vars);
      console.log('change variable', token.name, 'to', newToken);
      if (newToken.type === variable.type) {
        Object.assign(variable, newToken);
      } else {
        throw `Attempt to change variable ${token.name} from type ${variable.type} to ${newToken.type}`;
      }
    }

    if (token && token.type === 'function_call') {
      // `text, paren` is a function call. Search through builtins for the
      // function and call it if found.

      // const name = token.name;
      // const args = interp(token.args, vars);
      // if (name in builtins) {
      //   const result = builtins[name](args);
      //   if (result) {
      //     returnTokens.push(result);
      //   }
      // } else if (name in vars) {
      //   const funcToken = vars[name];
      //   if (funcToken.type === 'function_expr') {
      //     // console.log('Interpreting code of user defined function', name);
      //     // console.log('Code is', printTokens(funcToken.code));
      //     const result = callFunction(funcToken, args);
      //     returnTokens.push(result);
      //     // console.log('Done calling', name);
      //   } else {
      //     throw 'Not a function: ' + name;
      //   }
      // } else {
      //   throw 'Invalid function call: ' + name;
      // }

      const expr = token.expr;
      const args = token.args;
      console.log('Call function', expr);
      console.log('Args', args);
      callFunction(expr, args);
      index += 1;
      continue;
    }

    if (token && token.type === 'text') {
      console.log('try to get variable', token.value);
      console.log('current variables are', vars);
      if (token.value in vars) {
        returnTokens.push(vars[token.value]);
      } else {
        throw 'Bad variable ' + token.value;
      }
    }

    if (token && (
        token.type === 'string' || token.type === 'function_expr' ||
        token.type === 'number' || token.type === 'block')
    ) {
      returnTokens.push(token);
    }

    index += 1;
  }

  // console.log('--------');
  // console.log(printTokens(returnTokens));
  // console.groupEnd('interp');

  // return {type: 'holder', value: returnTokens};
  return returnTokens;
};
