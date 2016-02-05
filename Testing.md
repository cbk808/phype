## PhypeDoc table of contents ##
  1. [PhypeDoc](PhypeDoc.md)
  1. [The Phype Project](ThePhypeProject.md)
  1. [Implementation](Implementation.md)
  1. Testing
  1. [Conclusions](Conclusions.md)

# Testing #
The following sections explain how we have tested Phype, and what the results of these tests were, and our conclusions based on these results.

## Benchmarks ##
Five benchmarks were created for Phype. Each benchmark includes a loop, and is run five times for 100, 500, 1000, 5000 and 10000 iterations. We have run Phype on the JavaScript VM's V8 and SpiderMonkey, and tested the benchmarks on PHP as well.

We made two benchmark suites, one for PHP and one for Phype running on a !Javascript VM. To be able to compare the performance of the benchmarks on the different VM's, we used the same technique on both platforms. We save the timestamp before invoking the interpreter and beginning execution of the benchmark, and the timestamp after interpretation and execution. In PHP we store the time using PHP's built-in microtime()-function, which returns the current time stamp, accurate down to microseconds. In !Javascript we used !Javascript's built-in Date-object, which in a similar fashion can return the timestamp, accurate down to miliseconds. This allows us to compare the performance of the Zend- and Phype-engine

### arrayConversion and manyFunCalls ###
The benchmark manyFunCalls invokes the same function several times within a loop, and arrayConversions assigns a variable as a three-dimensional array, then incrementally converts the three-dimensional array into a single-dimensional array

These two benchmarks show us that we're just not as good as PHP. Phype could be optimized with JIT compilation to make the manyFunCalls benchmark run significantly faster, but probably never as fast as PHP. It also shows our dependency on the underlying JavaScript VM, and Phype on V8 runs up to 5 times as fast as on SpiderMonkey!

### manyObjects and manyGCObjects ###
manyObjects invokes a lot of objects in a lot of different variables, while manyGCObjects invokes a lot of objects in a lot of different variables, then assigns another value to the variables, leaving the instantiated object unreferenced.

These benchmarks are interesting, because they test our fledgling GC scheme. Theres is a slowdown when we use our own GC scheme and do not rely on the underlying VM. There should be some saved memory expenditure, but that does not show in these tests.

### tripleDimArray ###
This benchmark assigns 'hello world' into a three dimensional array.

This benchmark mostly shows the difference between the underlying VM's, and does not show anything conclusive about Phype, that has not already been made obvious from the other testcases.

## Results ##
As mentioned, the five benchmarks have been run with five different sets of iterations, on both PHP and Phype on V8 and SpiderMonkey. The graphs are not included in the wiki, so we ask you to run the benchmark suite, as detailed [here](Implementation.md), to see some numbers for yourself.

Generally we can conclude that there is a significant slowdown from PHP by using Phype, no matter what JS VM Phype is running on. V8 is at least twice as fast as SpiderMonkey, and in the worst case SpiderMonkey is over five times as slow as V8. This is illustrated in the graphs showing runtimes for all three.

As the number of iterations increase, the difference between Phype and PHP is more pronounced, but when we look at the graphs showing only PHP, and then compare them to Phype on V8, we still see that the tendencies of PHP look alot like the how the graphs for Phype develop. We do experience a slowdown of quite a high factor compared to PHP, but it does not seem that we are unusually bad at something compared to PHP. This suggests that, although we will probably never be able to optimize Phype to the degree of performance shown by PHP, we still experience the same issues as PHP does.

These benchmarks also show us that we rely on the underlying VM for alot of operations, as well as garbage collection, since the slowdown is that much more pronounced on SpiderMonkey, as opposed to V8.

We will never be able to optimize away the slowdown experienced, but we may definitely improved on our performance, if we were to include fx JIT compilation. PHP is hard to compete with, and all things considered the results are not that unexpected.