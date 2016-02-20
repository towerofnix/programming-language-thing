// const plt = require('./plt');

console.log(plt.printTokens(plt.parse(`

  o => obj()
  k => 'key'
  o:k => 'Hello!'
  print(o.k)

`)));
