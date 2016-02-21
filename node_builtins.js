import * as plt_lib from './plt_lib';

export var builtins = {
  foo: plt_lib.toFunctionToken(() => {
    console.log('o_o;');
  })
};
