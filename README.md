# Programming language thing

This is a programming language thing (PLT). I created it. It's very new and
probably not worth using, but it's a fun project for myself.

PLT only works in Firefox Nightly from what I've tested. You can copy all the
code in `main.js` to the [babel REPL](http://babeljs.io/repl) and it should
also work.

## Syntax

Here's a simple example of a program written in PLT:

    print('Hello world!')

    add_one -> fn(x) {
      ^ add(x 1)
    }

    print('The answer to life, the universe, and everything is:')
    print(add_one(41))

Simply put, here are all the pieces of syntax that matter to you:

**Strings:** `'my_string'`
**Numbers:** `123`
**Variables:** `x -> 'baz'`
**Function expressions:** `fn(arg1 arg2 arg3...) {...}`

Note because functions are expressions, you can assign them to variables:

    foo -> fn() {
      ...
    }

**Function calls:** `function_expression(arg1 arg2 arg3...)`

You can think of `args` lining up with `fn_args`:

    fn_args: x  y baz
    args:    42 3
    result:  42 3 [null]

    fn_args: x  y baz
    args:    42 3 7   8
    result:  42 3 7

Extra arguments are ignored; arguments that are not passed are null.

**Function expression returns:** `fn() {... ^ 'baz'}`

`^` will replace all return tokens with the next token's value.
