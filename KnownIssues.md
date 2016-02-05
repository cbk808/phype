# Semantic Differences #
### Floats and doubles ###
At the moment, floats and doubles are parsed exactly as in Javascript, which differs from how PHP parses and interprets doubles and floats.

### String lookups with array syntax ###
PHP supports looking up characters in a string with array notation. I.e. `$foo = 'bar'; echo $foo[0]` will output `b`. Trying to treat a string as an array in phype yields an error for the time being.

### Objects in arrays are cloned ###
In PHP, objects are always passed by reference. Phype currently passes objects by reference in all cases but when fetching an object from an array.

# Shortcomings or Errors #
### Referencing variables ###
Variable referencing would speed up eg. assigning an array into a variable. These have not yet been implemented.

### Syntactic sugar ###
The phype implementation aims to be fairly broad at first. Syntactic sugar will be added later.

### Library functions ###
We have not yet found a smart solution to the problem of implementing support for PHP's extensive library functions.

### PHP error types and error handling ###
PHP operates with different types of errors, and the environment defines how these errors affect the run-time behaviour. At the moment, phype operates with parse-errors (alerted) and exceptions (thrown), and does not distinguish between error types.

See [the PHP manual on error constants](http://dk.php.net/manual/en/errorfunc.constants.php#errorfunc.constants.errorlevels.e-strict)