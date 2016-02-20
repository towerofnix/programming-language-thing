// const plt = require('./plt');

console.log(plt.printTokens(plt(`

  x => 5
  fn() {
    x -> 4
    print(x)
  }()
  print(x)

`)));
