# Assign vs. Change

In PLT, there are three ways of using variables:

* **accessing** (`variable_name`)
* **assigning** (`variable_name => value`)
* **changing** (`variable_name -> value`)

**Accessing** works the same way as it does in any other programming language - it gets the value of a variable. If you assigned `x` to `42`, accessing `x` gets you `42`.

**Assigning** also works the same as most other programming languages. It's JavaScript's equivalent of `let`; a variable created via assignment is local to the scope it was created in. You should always create a variable with assignment.

Assigning a variable and then accessing it:

	x => 5
	print(x) # 5

Assigning a variable inside a scope, then attempting to access it:

	fn() {
		x => 3
		print(x) # 3
	}()
	
	print(x) # Variable not defined, so error


**Changing** is different in that it modifies the value of an already created variable. This makes it so that when you access the variable later, it takes the value assigned by the change.

Assigning a variable outside a scope, changing it inside a scope, and then accessing it:

	x => 42
	
	fn() {
		x -> 15
	}()
	
	print(x) # 15

Now, the question is, how is this useful? You don't want a function changing some variable it shouldn't have access to!

Because _everything_ you can do in PLT is a function. Let's look at this example...

	some_condition => lt(3 5)
	some_variable => 'default'
	
	if(some_condition fn() {
		# do something with some_variable
	    some_variable => 'new value'
	})
	
	print(some_variable) # default

Yikes! We did something to `some_variable` inside our `if` handler, but it wasn't changed outside! The solution is change:

	some_condition => lt(3 5)
	some_variable => 'default'
	
	if(some_condition fn() {
		# do something with some_variable
	    some_variable -> 'new value'
	})
	
	print(some_variable) # new value

As you can tell it did as would be expected. Assigning creates a new variable from a scope, while changing changes the value of a variable in any scope it has access to.
