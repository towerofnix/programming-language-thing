/*global plt*/

console.log(plt(`

  f => fn(x) {
    ^ add(x 2)
  }

  print(f(add(3 2)))

`));
