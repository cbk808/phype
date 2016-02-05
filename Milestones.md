# Introduction #
This page contains the milestones that were set for the project. Of most interest is the deprecated milestones for the initial, parsekit based, implementation of Phype, and the current milestones can also be found in the PhypeDoc [here](ThePhypeProject.md).

## Milestones (Interpreter) -- CURRENT ##
These are the milestones for Phype that we are following now. They will be updated as the project progresses.

This is an overview of the goals and the progress of this project:
  * Reading PHP-code within `<script>`-tags: **Done**.
  * Parsing PHP via LALR(1)-translatable grammar: **Done**.
    * We are using [JSCC](http://jscc.jmksf.com/) for translating our version of a context free PHP grammar into a PHP-parser.
    * We have found inspiration in [PHC's abstract PHP grammar](http://www.phpcompiler.org/doc/latest/grammar.html) for our context free grammar.
  * Interpreting PHP:
    * Echoing: **Done**.
    * Binary and unary operations: **Partially done**.
      * Multiplication/division and adding/subtracting works with precedence.
      * Concatenation works.
    * Type handling: **Partially done**.
      * Border-line cases has not been tested. There is probably some differences in semantics in border-line cases.
    * Assigning and reading variables: **Done**.
      * Global variables can be accessed and declared.
      * Recursively defined variables ($$a) can be accessed.
    * Array declaration and access: **Partially done**.
      * Single and multi-dimensional arrays supported.
      * Looking up a character in a string using array-notation is not (yet) supported.
    * Declaring and calling functions: **Done**.
      * Functions can be declared and called.
      * Functions can be called recursively ($a()).
      * Function return halts function-execution and returns correct value.
    * Variable scope rules: **Done**.
      * Function-local variables are function-local.
    * Conditional expressions and loops: **Partially done**.
      * Boolean expression evaluation.
      * Branching.
    * Declaring and accessing objects: **In progress**.
    * Constant declaration and acces: **Pending**.
    * Requires and includes: **Pending**.
  * Garbage collection: **Pending**.
  * Library functions: **Pending**.

## Milestones (Parsekit) -- DEPRECATED ##
Originally we were making a VM based on the PHP-extension parsekit, which translates PHP scripts into ZEND-opcode arrays. Unfortunately, the array-form lacks the symbol tables internal to the ZEND-engine, but the opcodes still contain references to the table. Instead of trying to translate references by examining the PHP-code via (a lot of UGLY) regular expressions, we decided to parse and interpret the PHP-code directly.

The source of the parsekit-based VM can be checked out from SVN in trunk/parsekit.

  * Compiling PHP to opcode-format: **Done**.
    * At the moment Phype makes use of a PHP-script that uses the PECL extension [parsekit](http://pecl.php.net/package/parsekit) to compile PHP code into a JSON opcode-array via AJAX.
  * Reading PHP-code within `<script>`-tags: **Done**.
  * Parsing opcodes: **Done**.
  * Executing opcodes
    * Echoing: **Done**.
    * Variables: **Done**.
      * Global variables can be accessed and declared.
      * Function-local variables can be accessed and declared preserving scope-rules.
      * Nested variables ($$a) can be accessed.
    * Declaring and calling functions: **In progress**.
      * Functions can be declared and called.
      * Functions can be called dynamically ($a()).
    * Conditional expressions and loops: **Pending**.
    * Array declaration and access: **Pending**.
    * Constant declaration and acces: **Pending**.
    * Requires and includes: **Pending**.
    * Declaring and accessing objects: **Pending**.
  * Garbage collection: **Pending**.
  * Library functions: **Pending**.