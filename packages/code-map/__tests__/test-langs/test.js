const _Greeter = {
  greet(name) {
    throw new Error('Method not implemented')
  },
}

class Greeting {
  constructor(prefix) {
    this.prefix = prefix
  }

  greet(name) {
    return `${this.prefix}, ${name}!`
  }

  static printGreeting(greeter, name) {
    console.log(greeter.greet(name))
  }
}

function createGreeter(prefix) {
  return new Greeting(prefix)
}

const greetAsync = async (greeter, name) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(greeter.greet(name))
    }, 100)
  })
}

;(async function main() {
  const greeting = createGreeter('Hello')
  Greeting.printGreeting(greeting, 'World')

  const asyncResult = await greetAsync(greeting, 'Async World')
  console.log(asyncResult)

  const names = ['Alice', 'Bob', 'Charlie']
  const greetings = names.map((name) => greeting.greet(name))
  console.log(greetings)
})()
