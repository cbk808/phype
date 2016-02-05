## PhypeDoc table of contents ##
  1. [PhypeDoc](PhypeDoc.md)
  1. [The Phype Project](ThePhypeProject.md)
  1. Implementation
  1. [Testing](Testing.md)
  1. [Conclusions](Conclusions.md)

# Implementation #
In the following sections, we will describe some of the details of the Phype implementation. The grammar, and following parser generation, are not the most interesting part of the project, as they are a means to an end, namely to interpret PHP, so we will only touch on these briefly.

## Grammar and parser ##
As mentioned, Phype uses the JS/CC parser generator, and a context-free PHP grammar, to create a LALR(1) parser for PHP. As mentioned, we took some inspiration from PHC's abstract grammar for PHP, but modified to BNF and the syntax for JS/CC.

The grammar defines a number of tokens based on regular expressions, which are then passed into specific node types depending on how a piece of code matches a regular expression. These nodes are arranged in a parsetree, which we can then run through, and execute on each node. A node will at most have three children in the parsetree.

A node can be one of five types; operation, variable, constant, integer or float. An operation node, called node\_op, will contain a value depending on the opcode to execute. There are currently 28 opcodes in Phype. Variable nodes, node\_var, can either contain the value assigned to the variable, or a list of recursively linked nodes in the case of recursively defined variables, e.g. $$a. Constant, integer, and float nodes contain the value of the corresponding constant, integer or float in the PHP script.

When a script ends, the remaining parts of the file will be output as an echo, just as in PHP.

The grammar itself enables the JS/CC generated parser to parse a little more than the supported subset of language constructs in PHP, and should now be in a state where it is extensible.

## Interpretation ##
When the parser has generated its parsetree, the interpreter starts at the root node, and calls the execute function on the root. execute finds out which node type we are trying to execute; constant- and number-nodes are translated to value-nodes and returned to the invoker of execute, whereas op-nodes looks up the correct op in the ops-array, and lets the op-implementation perform its actions on the node and its children. In this fashion the parse-tree is traversed recursively. The probably most frequent node in the parse-tree is the op\_none-node, which is used to tie statement sequences together in the parse-tree.

Functions and classes are not present in the generated parse-tree. When we encounter a class- or function definition statement, we parse and generate a class- or function-object, and save this in either the function table or the class table. For classes the information stored is the access modifiers for all members of a class, and objects corresponding to the actual members. Function-objects consist of a list of formal parameters that the function requires, and the parsed body of a function, which is a parse-tree on its own. The bodies of functions are executed when the owning function is invoked via an op\_fcall or op\_obj\_fcall op-node.

To access variables and arrays, the interpreter will call the appropriate function on the linker object. This object handles all access to variables and arrays, and links an entry in the symbol table to its actual value in the corresponding variable- or array-table.

## Runtime state ##
Almost all objects in Phype are represented as JSON objects, since these provide easy and fast access to data and has a lower memory consumption. We have not implemented a stackbased machine, just as PHP does not rely on a stack for its runtime state. As PHP, we pass values directly to ops, rather than via a stack.

The runtime state of the program is saved in an object in the interpreter called pstate. This object manages all actual values and objects, by means of a symbol-, value-, array- and object-tables. Functions are stored in a function-table, and classes in a class-table.

The pstate object also keeps track of some intermediate variables used during parsing and interpretation.

## Architecture ##
The Phype project consists of three major parts which can be found in the folders; jscc, src and test, in our project. The jscc directory contain all the files necessary for building the parser with JS/CC. src contains sourcefiles, which are the only files needed for actually running Phype, and test contains the testsuite and benchmark-files.

The sourcefiles are phypeLoader.js and phypeParser.js:
  * phypeLoader reads scripts from the inputfile, and sets some used variables for input and output.
  * The phypeParser file contains all the code for the parser and interpreter, and is generated from the phpParser.js file in the jscc directory by JS/CC.

phypeParser is called each time a script is included in the inputfile, and takes input and produced output based on the functions defined by phypeLoader. phypeLoader must be called before phypeParser, since phypeParser depends on the output of phypeLoader.

phypeParser also includes some basic debugging code that can be included in tests as needed, but otherwise does not interfere with the interpreter.

## How-to ##
This section describes how to run and build Phype from the sourcecode. Phype can checked out from svn at code.google.com/p/phype/source, or accessed from the zip-file included with this report.

### Building Phype ###
The latest build from svn, and the zip-file, already include the generated parser, but if you want to do it yourself, here's how.

To build Phype using JS/CC:

  1. Open the jscc.html file located in the Phype.jscc directory.
  1. Open the phpParser.js file in the Phype.jscc directory.
  1. Copy all the code from phpParser.js into the top textfield of the JS/CC Web Environment page.
  1. Click build. JS/CC will now generate the parser.
  1. When build is done, click run.
  1. A dialog containing some code in an input field will appear. Click ok, and say hi to Phype.
  1. A window will appear containing the generated parser. Copy and paste this into the phypeParser.js file in the Phype.src directory.

### Running Phype ###
To run Phype from the generated parser:

  1. Include phypeLoader.js and phypeParser.js in any html-document, in that order.
  1. In the html-document, either include some php-files, or write native php-code, in `<script>` tags. Phype will load the scripts, and interpret them, leaving the html to be echoed.
  1. For examples, see the main.html and test.html files.

### Running benchmark suite ###
To run the benchmark suite, you will need to be able to execute bash shell scripts, php5 and smjs (SpiderMonkey). V8 bleeding edge 0.4.6 is included the project.

The suite can be found in the v8 directory of the project. Run the script stats/genStats.sh, to run the benchmark suite.