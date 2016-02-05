## PhypeDoc table of contents ##
  1. PhypeDoc
  1. [The Phype Project](ThePhypeProject.md)
  1. [Implementation](Implementation.md)
  1. [Testing](Testing.md)
  1. Conclusions

# Conclusions #

## Pros and Cons ##
The following sections will focus on some of the pros and cons of our chosen implementation.

### JS/CC ###
The most obvious advantage of choosing to use the JS/CC parser generator, is that we get a LALR(1) parser based on our own grammar, rather than relying on something unknown like the output from parsekit. The benefits of the LALR(1) parser have been described previously.

On the other hand, we have spent a lot of time getting the grammar to work. This is time that could otherwise have been spent optimizing the interpreter, bugfixes or implementing extra features.

We still think that using JS/CC was the best choice for this project, but had not expected the grammar to take up that much time. The advantages of using an automatic parser generator far exceeds the amount of time spent on creating the grammar, especially when considering that there was no real way to compile PHP to interpretable bytecodes from JavaScript.

### Interpreting ###
As mentioned previously, we interpret PHP-scripts directly on the generated parse-tree. Instead of interpreting nodes directly, we could have chosen to generate opcodes, which we could then interpret. This would allow us to clearly distinguish between performance-issues in connection with parsing the PHP script, and performance-issues in connection with executing it. Another advantage of generating opcodes, which we could interpret on, is allowing users to write opcodes directly in pages, giving better performance.

The reason we chose to interpret directly on our parse-tree, was the ease of doing so, combined with the performance-gain of executing PHP-code directly.

Another advantage of interpreting directly on the parse-tree, is that we have alot of information about the original program, which would allow us to provide alot of relevant information for debugging of the PHP-script. Phype throws exceptions when it fails, and these exceptions could easily be extended to include more verbose debugging information. We have not focused a lot on on this during the project, but it is definitely possible to implement.

### JavaScript ###
We chose JavaScript because it's an easy language to write, has it's own garbage collection,, does not impose any type system and includes good debugging information. Also it was one of the few languages that we were better acquainted with, as opposed to C or C++.

Implementing a VM on top of another VM, yields some definite advantages, but also has some disadvantages.

The underlying VM provides, among other things, automatic memory allocation. This means that we do not have to worry about memory consumption until we decide to, which would probably be when we would be implementing the GC.

We also use JavaScripts conditional expressions and loops for Phype, which means that we do not have to worry about labels and goto's in Phype, but reuse the way JavaScript branches.

A disadvantage of piggybacking on the JS engine, is that our performance results include the startup and runtime usage of the VM itself. Although this is minimal, we still get somewhat slower performance on the JS VM, than we would have seen, had we used C or C++.

Furthermore it means that we have to interpret twice. Once for Phype to interpret PHP, and then once again to interpret Phype to run on the JS VM. Had we used, fx Java, we could have compiled to Java bytecodes, which, most likely, would run faster than interpreting code.

## Further progress ##
Phype is, naturally, not completely finished. The implementation so far is the parser and interpreter, and we still need a proper garbage collector, to be able to call Phype a complete Virtual Machine.

The interpreter itself still needs some work. As mentioned above, there are some semantic differences between Phype and PHP, as well as some bugs, which will need fixing. The omitted features would have to be implemented, and the interpreter should be optimized to yield some better performance. All of this should be adressed before a GC is implemented.

### Optimizations ###
The interpreter, as it is now, is not optimized at all, which shows in the benchmark tests. To make the interpreter run faster, we would implement some techniques of JIT compilation.

In JavaScript, code that is interpreted using eval is directly translated to bytecode, so that next time it is used, it can be accessed and used fast. We can use this to implement JIT compilation in Phype. For example, if we have a loop, the same JavaScript code will be executed several times through the automatic branching between the opcode implementations. Instead of doing this branching, we could concatenate all the JavaScript-implementations of the used opcodes into a string and eval this. Then we would be able to call this translated code for each of the iterations in the loop, and not have to branch each time.

We would also implement an invocation counter on all functions in the interpreted PHP-script for JIT compilation of function calls. This is a simple solution, that starts to pay off quickly after the script is started. If we were to choose a sample based profiling implementation to find hotspots in the code, the script would have to run for longer, for the JIT compilation to take effect. Since most PHP-scripts do not run for very long, sample based profiling would not be effective.

JIT compilation builds up a code cache, and it would have to be determined when it should be emptied. As most scripts do not run for very long, it could be good enough to just empty it out when a script has finished running. For scripts using alot of functions or many loops, this would not be efficient, and and it would probably be more beneficial to implement a LRU code cache cleanup. This could possibly be combined with sweeps in the GC cycles.

### GC ###
PHP has no real garbage collection, as it only frees memory when a script has finished running, and if a script uses more than the allowed amount of memory during execution, it will fail. PHP also cleans up all variables from within scope of a function, when the function terminates.

Phype wraps all variables, functions and objects in an object. The object table refers to these objects, and when an object is no longer live, it should be tagged and removed by a GC. Phype has no GC, but implements a way of removing objects based on reference counting, where objects that are no longer referenced are removed. When an object is assigned to a variable, we increment its reference count, while we decrement the reference count of an object if a value is assigned into a variable pointing to this object. Whenever we decrement the reference count of an object, we check if the reference count is zero. If it is, we delete the object from our list of objects using JavaScript's delete-function.

This algorithm does not actually help us when we run out of memory, as it is only run when we assign new objects. At the moment we piggyback on the garbage collection of the underlying JavaScript engine.

Phype references all variables in other tables, in the symbol table. This could be used in a simple mark-and-sweep GC. The symbol table contains references to all live objects in the other tables, and the mark phase would consist of traversing the objects referenced in the symboltable and marking them as live. Afterwards, the sweep phase would remove all objects not marked as live.

The above GC scheme cannot handle cycles, which would have to be taken care of specifically. Because the objects referenced are in different tables, we could GC one table at at time, which would make the GC cycles shorter, interrupting the program for shorter periods of time.

## Lessons learnt ##
We have not used many of the topics discussed in the course for implementing Phype, since these mainly seemed to touch upon subjects that were out of our reach until we had implemented an interpreter that would actually run, and since this was our primary concern, optimizations, garbage collection, JIT compilation and inline caching are things on our to-do-lists.

We've come away from this projects with a greater sense of where to start when implementing a virtual machine, and we can see the points wherein Phype will benefit from the techniques taught in the course. It's interesting to see that the basics of interpretation, and the following garbage collection and various optimizations, are not unfathomable, and that it's possible to get something up and running fairly fast.