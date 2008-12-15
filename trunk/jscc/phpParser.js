[*
//////////////////////////////////////
// GLOBALLY USED VARS AND FUNCTIONS //
//////////////////////////////////////

// If defined, this variable tells whether we should parse and check assertions.
var phypeTestSuite;
// Contains scripts to execute
var phpScripts;

// Constants used for keeping track of states and variables.
var cons = {
	global : '.global',
	objGlobal : '.objGlobal',
	val : '.val#',
	arr : '.arr#',
	obj : '.obj#',
	unset : '.uns#'
}

// State object.
var pstate = {
	// ACTUAL VALUES AND OBJECTS
	symTables : {
		'.global' : {}
	},
	valTable : {},
	arrTable : {},
	objMapping : {},
	
	/**
	 * Table for keeping actual objects
	 */
	objList : [],
	
	
	// FORMAL DECLARATIONS
	/**
	 * Function table
	 */
	funTable : {},
	
	/**
	 * Class table
	 */
	classTable : {},
	
	
	// TEMPORARY STATE TRACKING VARIABLES
	/**
	 * Variable for keeping track of currently executing function.
	 */
	curFun : cons.global,
	curClass : '',
	curObj : -1,
	
	/**
	 * Variable for keeping track of formal parameters for a function declaration.
	 */
	curParams : [],
	
	/**
	 * Variable for keeping track of currently passed actual parameters of a function invocation.
	 */
	passedParams : 0,
	
	/**
	 * These variables keeps track of current members of the class being defined.
	 */
	curAttrs : [],
	curFuns : [],
	
	/**
	 * Variable telling whether a termination event has been received (i.e. a return).
	 */
	term : false,
	
	/**
	 * Variable for keeping track of most recent return value.
	 */
	'return' : '',
	
	
	// TEST SUITE VARIABLES
	/**
	 * Keeps track of assertions.
	 */
	assertion : null
}

var origState = clone(pstate);

function resetState() {
	pstate = clone(origState);
}


///////////////////
// STATE OBJECTS //
///////////////////
function NODE() {
	var type;
	var value;
	var children;
}

function FUNC() {
	var name;
	var params;
	var nodes;
}

function VAL() {
	var type;
	var value;
}

function MEMBER() {
	var mod;
	var member;
	var init;
}

function CLASS() {
	var mod;
	var name;
	var attrs;
	var funs;
}

function OBJECT() {
	var objListEntry;
	var references;
	var classDef;
}

function ASSERTION() {
	var type;
	var value;
}

/**
 * Function for creating node objects.
 */
function createNode( type, value, children ) {
	var n = new NODE();
	n.type = type;
	n.value = value;	
	n.children = new Array();
	
	for( var i = 2; i < arguments.length; i++ )
		n.children.push( arguments[i] );
		
	return n;
}

/**
 * Function for creating functions.
 */
function createFunction( name, params, nodes ) {
	var f = new FUNC();
	f.name = name;
	f.params = params;
	f.nodes = new Array();
	
	for( var i = 2; i < arguments.length; i++ )
		f.nodes.push( arguments[i] );
		
	return f;
}

/**
 * Function for creating values (constant types, arrays or objects).
 */
function createValue( type, value ) {
	var v = new VAL();
	v.type = type;
	v.value = value;
	
	return v;
}

/**
 * Creates member objects for the class model.
 */
function createMember( mod, member, init ) {
	var m = new MEMBER();
	m.mod = mod;
	m.member = member;
	if (init)
		m.init = init;
	
	return m;
}

/**
 * Creates a class model.
 */
function createClass( mod, name, attrs, funs ) {
	var c = new CLASS();
	c.mod = mod;
	c.name = name;
	c.attrs = attrs;
	c.funs = funs;
	
	return c;
}

/**
 * Creates an object.
 */
function createObject( objListEntry, classDefName ) {
	var obj = new OBJECT();
	obj.objListEntry = objListEntry;
	obj.references = 0;
	obj.classDef = classDefName;
	
	return obj;
}

/**
 * Create a deep clone of a value.
 * 
 * YES, it's expensive!! So is it in PHP.
 */
function clone( value ) {
	if(value == null || typeof(value) != 'object')
		return value;

	var tmp = {};
	for(var key in value)
		tmp[key] = clone(value[key]);

	return tmp;
}

/**
 * Create an assertion for testing against when we are in our test suite
 */
function createAssertion( type, value ) {
	var a = new ASSERTION();
	a.type = type;
	a.value = value;
	
	return a;
}


/////////////////
// VAR LINKING //
/////////////////
/**
 * For linking variable references to values, preserving scopes.
 */
var linker = {
	assignVar : function(varName, val, scope) {
		if (!scope)
			scope = pstate.curFun;

		if (typeof(pstate.symTables[scope]) != 'object')
			pstate.symTables[scope] = {};

		var refTable = linker.getRefTableByVal(val);
		var prefix = linker.getConsDefByVal(val);
		
		pstate.symTables[scope][varName] = prefix+scope+'#'+varName

		// If we are assigning an object, make a reference to the assigned object,
		// and increment the object's reference count.
		if (val.type == T_OBJECT) {
			var entry = val.value.objListEntry;
			pstate.objList[entry].value.references++;
			refTable[scope+'#'+varName] = entry;
		} else
			refTable[scope+'#'+varName] = val;
	},
	
	assignArr : function(varName, key, val, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		if (typeof(pstate.symTables[scope]) != 'object')
			pstate.symTables[scope] = {};
		
		// Initialize the variable as an array
		linker.unlinkVar(varName,scope);
		pstate.symTables[scope][varName] = cons.arr+scope+'#'+varName;
		
		// Check that the entry exists. Initialize it if it does not.
		var arrTableKey = scope+'#'+varName;
		if (!pstate.arrTable[arrTableKey]) {
			var valArr = {};
			valArr[key.value] = val;
			pstate.arrTable[arrTableKey] = createValue( T_ARRAY, valArr );
		}
		// Else insert the array key into the existing entry
		else {
			pstate.arrTable[arrTableKey]["value"][key.value] = val;
		}
	},
	
	assignArrMulti : function(varName, keys, val, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		if (typeof(pstate.symTables[scope]) != 'object')
			pstate.symTables[scope] = {};
		
		// Initialize the variable as an array
		linker.unlinkVar(varName,scope);
		pstate.symTables[scope][varName] = cons.arr+scope+'#'+varName;
		
		// Check that the entry exists. Initialize it if it does not.
		var arrTableKey = scope+'#'+varName;
		if (!pstate.arrTable[arrTableKey])
			pstate.arrTable[arrTableKey] = createValue( T_ARRAY, {} );

		var keyRef = 'pstate.arrTable[arrTableKey]["value"]';
		for ( var i=0; i<keys.length; i++ ) {
			eval('if (!'+keyRef+'["'+keys[i].value+'"]) '+keyRef+'["'+keys[i].value+'"] = createValue( T_ARRAY, {} );');
			keyRef = keyRef+'["'+keys[i].value+'"]["value"]';
		}

		keyRef = keyRef+' = val;';
		eval(keyRef);
	},

	getValue : function(varName, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		// Look up the potentially recursively defined variable.
		varName = linker.linkRecursively(varName);
		
		if (varName == 'this') {
			return pstate.objList[pstate.curObj];
		}
		
		var refTable = linker.getRefTableByVar(varName);
		
		if (typeof(pstate.symTables[scope])=='object' && typeof(pstate.symTables[scope][varName])=='string') {
			var lookupStr = pstate.symTables[scope][varName];
			lookupStr = lookupStr.substr(5,lookupStr.length);
			
			var ret = null;
			if (refTable == pstate.objMapping)
				ret = pstate.objList[refTable[lookupStr]];
			else
				ret = clone(refTable[lookupStr]);
				
			return ret;
		} else if (typeof(pstate.symTables[cons.global])=='string') {
			var lookupStr = pstate.symTables[cons.global][cleanVarName];
			lookupStr = lookupStr.substr(5, lookupStr.length);
			
			var ret = null;
			if (refTable == pstate.objMapping)
				ret = pstate.objList[refTable[lookupStr]];
			else
				ret = clone(refTable[lookupStr]);
			return ret;
		}
		
		throw varNotFound(varName);
	},
	
	getValueFromObj : function(targetObj, varName, scope) {
		// Look up the potentially recursively defined variable.
		varName = linker.linkRecursively(varName);
		varName = targetObj+'::'+varName;
		
		return linker.getValue(varName);
	},
	
	getArrValue : function(varName, key, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		var cleanVarName = varName.match(/[^\$]*/);

		var result = '';
		if (typeof(pstate.symTables[scope])=='object' && typeof(pstate.symTables[scope][cleanVarName])=='string') {
			var prefix = pstate.symTables[scope][cleanVarName].substring(0,5);
			// THIS IS NOT COMPLIANT WITH STANDARD PHP!
			// PHP will lookup the character at the position defined by the array key.
			if (prefix != cons.arr) {
				throw expectedArrNotFound(cleanVarName);
			}
			
			var lookupStr = pstate.symTables[scope][cleanVarName];
			lookupStr = lookupStr.substr(5, lookupStr.length);

			// Look up the value of the variable
			if (pstate.arrTable[lookupStr] && pstate.arrTable[lookupStr]["value"][key.value]) {
				result = pstate.arrTable[lookupStr]["value"][key.value];
			}
		} else if (typeof(pstate.symTables[cons.global][cleanVarName])=='string') {
			var lookupStr = pstate.symTables[cons.global][cleanVarName];
			lookupStr = lookupStr.substr(5, lookupStr.length);
			
			// Look up the value of the variable
			if (pstate.arrTable[lookupStr] && pstate.arrTable[lookupStr]["value"][key.value])
				result = pstate.arrTable[lookupStr]["value"][key.value];
		} else {
			throw varNotFound(varName);
		}

		// Look up the potentially recursively defined variable.
		if (varName != cleanVarName) {
			return linker.getValue(result);
		} else {
			return clone(result);
		}
	},
	
	getArrValueMulti : function(varName, keys, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		var cleanVarName = varName.match(/[^\$]*/);
		
		var result = '';
		if (typeof(pstate.symTables[scope])=='object' && typeof(pstate.symTables[scope][cleanVarName])=='string') {
			var prefix = pstate.symTables[scope][cleanVarName].substring(0,5);
			// THIS IS NOT COMPLIANT WITH STANDARD PHP!
			// PHP will lookup the character at the position defined by the array key.
			if (prefix != cons.arr) {
				throw expectedArrNotFound(cleanVarName);
			}
			
			var lookupStr = pstate.symTables[scope][cleanVarName];
			lookupStr = lookupStr.substr(5, lookupStr.length);

			// Generate key lookup-command
			var keyRef = 'pstate.arrTable[lookupStr]["value"]';
			for ( var i=0; i<keys.length; i++ ) {
				keyRef = keyRef+'["'+keys[i].value+'"]["value"]';
			}

			// Look up the value of the variable
			keyRef = 'result = '+keyRef+';';
			eval(keyRef);
		} else if (typeof(pstate.symTables[cons.global][cleanVarName])=='string') {
			var lookupStr = pstate.symTables[cons.global][cleanVarName];
			lookupStr = lookupStr.substr(5, lookupStr.length);
			
			// Generate key lookup-command
			var keyRef = 'pstate.arrTable[lookupStr]["value"]';
			for ( var i=0; i<keys.length; i++ ) {
				keyRef = keyRef+'["'+keys[i].value+'"]["value"]';
			}
			
			// Look up the value of the variable
			keyRef = 'result = '+keyRef+';';
			eval(keyRef);
		} else {
			throw varNotFound(varName);
		}
		
		// Look up the potentially recursively defined variable.
		if (varName != cleanVarName) {
			return linker.getValue(result);
		} else {
			return clone(result);
		}
	},
	
	/*
	 * For linking variable references (unsupported as of yet).
	linkVar : function(locVarName, varName, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		if (typeof(symTables[scope])!='object')
			pstate.symTables[scope] = {};
		
		pstate.symTables[scope][locVarName] = varName;
		if (typeof(pstate.valTable[scope+'#'+varName])!='string')
			pstate.valTable[scope+'#'+varName] = '';
	},
	*/
	
	unlinkVar : function(varName, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		var prefix = linker.getConsDefByVar(varName);
		if (prefix == cons.unset)
			return;
		
		delete pstate.valTable[pstate.symTables[scope][varName]];
		delete pstate.symTables[prefix+scope+'#'+varName];
	},
	
	getRefTableByVal : function(value) {
		// Check for sym type
		switch (value.type) {
			case T_INT:
			case T_FLOAT:
			case T_CONST:
				return pstate.valTable;
			case T_ARRAY:
				return pstate.arrTable;
			case T_OBJECT:
				return pstate.objMapping;
			default:
				return null;
		}
	},
	
	getRefTableByConsDef : function(consDef) {
		switch (consDef) {
			case cons.val:
				return pstate.valTable;
			case cons.arr:
				return pstate.arrTable;
			case cons.obj:
				return pstate.objMapping;
			default:
				return null;
		}
	},
	
	getRefTableByVar : function(varName, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		if (typeof(pstate.symTables[scope])!='object')
			pstate.symTables[scope] = {};
		
		// Get symbol name
		var symName = '';
		if (typeof(pstate.symTables[scope][varName])=='string')
			symName = pstate.symTables[scope][varName];
		else if (typeof(pstate.symTables[cons.global][varName])=='string')
			symName = pstate.symTables[cons.global][varName];
		else
			symName = cons.unset;
			
			
		// Check for sym type
		switch (symName.substring(0,5)) {
			case cons.val:
				return pstate.valTable;
			case cons.arr:
				return pstate.arrTable;
			case cons.obj:
				return pstate.objMapping;
			default:
				return null;
		}
	},
	
	linkRecursively : function(varName) {
		if (typeof(varName) != 'string' && varName.type != T_CONST)
			return varName;
		else if (typeof(varName) == 'string') {
			varNameVal = varName;
		} else varNameVal = varName.value;
		
		var firstChar = varNameVal.substring(0,1);
		if (firstChar == "$") {
			varName = linker.getValue( varNameVal.substring( 1,varNameVal.length ) );
		}
		
		return varName;
	},
	
	getConsDefByVal : function(val) {
		var intType = val.type;
		switch (intType) {
			case T_INT:
			case T_FLOAT:
			case T_CONST:
				return cons.val;
			case T_ARRAY:
				return cons.arr;
			case T_OBJECT:
				return cons.obj;
			default:
				return null;
		}
	},
	
	getConsDefByVar : function(varName, scope) {
		if (!scope)
			scope = pstate.curFun;
		
		if (typeof(pstate.symTables[scope])!='object')
			pstate.symTables[scope] = {};
		
		// Get symbol name
		var symName = '';
		if (typeof(pstate.symTables[scope][varName])=='string')
			symName = pstate.symTables[scope][varName];
		else if (typeof(pstate.symTables[cons.global][varName])=='string')
			symName = pstate.symTables[cons.global][varName];
		else
			symName = '.unset';
		
		return symName.substring(0,5);
	},
	
	getNumberFromNode : function(node) {
		var num = null;
		switch (node.type) {
			// TODO: Check for PHP-standard.
			case T_INT:
			case T_CONST:
				num = parseInt(node.value);
				break;
			case T_FLOAT:
				num = parseFloat(node.value);
				break;
		}

		return num;
	}
}


//////////////////////////
// CLASS/OBJECT LINKING //
//////////////////////////
var classLinker = {
	createObjectFromClass : function(classDef) {
		// Init object and add it to the list of objects.
		var objListLength = pstate.objList.length;
		var obj = createObject( objListLength, classDef.name );
		pstate.objList[pstate.objList.length] = createValue( T_OBJECT, obj );
		
		// Init variable list
		for (var attr in classDef.attrs) {
			var vName = classDef.attrs[attr].member;
			var vVal = execute( classDef.attrs[attr].init );
			if (!vVal || vVal == 'undefined')
				vVal = null;
			
			var lookupStr = objListLength+'::'+vName;
			pstate.symTables['.global'][objListLength+'::'+vName] = linker.getConsDefByVal(vVal)+lookupStr;
			
			var refTable = linker.getRefTableByVal(vVal);

			refTable[lookupStr] = vVal;
		}
		
		return obj;
	},
	
	decrementObjectRef : function(obj) {
		obj.references--;
		if (obj.references <= 0) {
			classLinker.deleteObject(obj);
		}
	},
	
	deleteObject : function(obj) {
		var className = pstate.objList[obj.objListEntry];
		
		// Remove from object list
		delete pstate.objList[obj.objListEntry];
		
		// Clear attributes
		for (var i=0; i<classDef.attrs; i++) {
			var vName = classDef.attrs[i].member.children[0];
			var r = pstate.symTables['.global'][obj.objListEntry+'::'+vName]
			var refTable = linker.getRefTableByConsDef(r.substring(0,5));
			delete refTable[r.substring(5,r.length)];
			delete pstate.symTables['.global'][obj.objListEntry+'::'+vName];
		}
		
		delete obj;
	},
	
	checkVisibility : function(invokerClassName, targetClassName, targetMemberName) {
		// get MOD
		var mod = -1;
		var fun = pstate.classTable[targetClassName]['funs'][targetMemberName];

		if (fun)
			mod = fun.mod;
		else {
			attr = pstate.classTable[targetClassName]['attrs'][targetMemberName];
			if (!attr) return false;
			mod = attr.mod;
		}
	
		switch (mod) {
			case MOD_PUBLIC:
				return true;
			case MOD_PRIVATE:
				return (invokerClassName == targetClassName);
			case MOD_PROTECTED:
				if (invokerClassName == targetClassName)
					return true;
				else throw 'Inheritance not yet supported.';
		}
	},
	
	assignObjToVar : function(varName, obj, scope) {
		if (!scope)
			scope = pstate.curFun;
			
		if (typeof(pstate.symTables[scope]) != 'object')
			pstate.symTables[scope] = {};

		var prefix = linker.getConsDefByVal(val);
		
		pstate.symTables[scope][varName] = prefix+scope+'#'+varName
		
	}
}



/////////////////////////////
// OP AND TYPE DEFINITIONS //
/////////////////////////////

// Value types
var T_CONST			= 0;
var T_ARRAY			= 1;
var T_OBJECT		= 2;
var T_INT			= 3;
var T_FLOAT			= 4;

// Node types
var NODE_OP			= 0;
var NODE_VAR		= 1;
var NODE_CONST		= 2;
var NODE_INT		= 3;
var NODE_FLOAT		= 4;

// Op types
var OP_NONE			= -1;
var OP_ASSIGN		= 0;
var OP_IF			= 1;
var OP_IF_ELSE		= 2;
var OP_WHILE_DO		= 3;
var OP_DO_WHILE		= 4;
var OP_FCALL		= 5;
var OP_PASS_PARAM	= 6;
var OP_RETURN		= 7;
var OP_ECHO			= 8;
var OP_ASSIGN_ARR	= 9;
var OP_FETCH_ARR	= 10;
var OP_ARR_KEYS_R	= 11;
var OP_OBJ_NEW		= 12;
var OP_OBJ_FCALL	= 13;
var OP_OBJ_FETCH	= 14;
var OP_ATTR_ASSIGN	= 15;
var OP_EQU			= 50;
var OP_NEQ			= 51;
var OP_GRT			= 52;
var OP_LOT			= 53;
var OP_GRE			= 54;
var OP_LOE			= 55;
var OP_ADD			= 56;
var OP_SUB			= 57;
var OP_DIV			= 58;
var OP_MUL			= 59;
var OP_NEG			= 60;
var OP_CONCAT		= 61;

// Moderation types
var MOD_PUBLIC		= 0;
var MOD_PROTECTED	= 1;
var MOD_PRIVATE		= 2;

// Member types
var MEMBER_ATTR		= 0;
var MEMBER_FUN		= 1;

// Assertion types
var ASS_ECHO		= 0;
var ASS_FAIL		= 1;


////////////////
// EXCEPTIONS //
////////////////
function classDefNotFound(className) {
	return 'No class definition found: '+className;
}

function funRedeclare(funName) {
	return 'Cannot redeclare '+funName;
}

function expectedArrNotFound(varName) {
	return 'The variable is not an array: '+funName;
}

function funNotFound(funName) {
	return 'Function not found: '+funName;
}

function funInvalidArgCount(argCount) {
	return 'Function '+pstate.curFun+'( ) expecting '+argCount+
			' arguments, but only found '+pstate.passedParams+'.';
} 

function funNameMustBeString(intType) {
	var type = '';
	switch (intType) {
		case T_ARRAY:
			type = 'Array';
			break;
		case T_OBJECT:
			type = 'Object';
			break;
		default:
			type = 'Unknown';
			break;
	}
	return 'Function name must be string. Found: '+type;
}

function invocationTargetInvalid(intType) {
	var type = '';
	switch (intType) {
		case T_FLOAT:
		case T_INT:
		case T_CONST:
			type = 'Const';
			break;
		case T_ARRAY:
			type = 'Array';
			break;
		default:
			type = 'Unknown';
			break;
	}
	return 'The target of an invocation must be an object. Found: '+type;
}

function fetchTargetInvalid() {
	return 'The target of the variable access was not an object.';
}

function memberNotVisible(memName) {
	return 'Call to a restricted member: '+memName;
}

function nonConstAttrInit(varName, className) {
	return 'Initialization value for attributes must be constant expressions.' +
			' A non-constant expression was used for "'+varName+'" in "'+className+'"';
}

function thisRedeclare() {
	return 'Cannot redeclare $this';
}

function valInvalid(varName, refType) {
	return 'Invalid value type of '+varName+': '+refType;
}

function varNotFound(varName) {
	return 'Variable not found: '+varName;
}


///////////////
// OPERATORS //
///////////////
var ops = {
	// OP_NONE
	'-1' : function(node) {
		var ret = null;
		if( node.children[0] )
			ret = execute( node.children[0] );
		if( node.children[1] )
			ret = ret+execute( node.children[1] );

		return ret;
	},
	
	// OP_ASSIGN
	'0' : function(node) {
		// $this cannot be redeclared.
		if (varName == 'this')
			throw thisRedeclare();
			
		// Look up potentially recursive variable name
		var varName = linker.linkRecursively(node.children[0]);
		
		// Check if the variable we are trying to assign to already contains an object;
		// decrement the reference count for the object if this is the case.
		var oldVal = null;
		try {
			oldVal = linker.getValue(varName);
		} catch (exception) {
			if (exception!=varNotFound(varName))
				throw exception;
			else
				oldVal = false;
		}
		
		if (oldVal && oldVal.type == T_OBJECT)
			classLinker.decrementObjectRef(linker.getValue(varName).value);
		
		try {
			var val = execute( node.children[1] );
		} catch(exception) {
			// If we get an undefined variable error, and the undefined variable is the variable
			// we are currently defining, initialize the current variable to 0, and try assigning again.
			if (exception == varNotFound(varName)) {
				execute( createNode( NODE_OP, OP_ASSIGN, varName, createValue( T_INT, 0 ) ) );
				val = execute( node.children[1] );
			} else {
				throw exception;
			}
		}
		
		// If we are assigning an object, increment its reference count.
		if (oldVal.value != val.value) {
			if (oldVal && oldVal.type == T_OBJECT)
				classLinker.decrementObjectRef(linker.getValue(varName));
			
			if (val.type == T_OBJECT && oldVal.value != val.value)
				val.value.references++;
		}
		
		linker.assignVar( node.children[0], val );
		
		return val;
	},
	
	// OP_IF
	'1' : function(node) {
		var condChild = execute(node.children[0]);
		if(condChild.value)
			return execute(node.children[1]);
	},
	
	// OP_IF_ELSE
	'2' : function(node) {
		if( execute( node.children[0] ) )
			return execute( node.children[1] );
		else
			return execute( node.children[2] );
	},
	
	// OP_WHILE_DO
	'3' : function(node) {
		var ret = false;
		var tmp = execute( node.children[0] );
		while( tmp.value ) {
			execute( node.children[1] );
			tmp = execute( node.children[0] );
		}
	},

	// OP_DO_WHILE
	'4' : function(node) {
		var ret = 0;
		do {
			execute( node.children[0] );
		} while( execute( node.children[1] ) );
	},
	
	// OP_FCALL
	'5' : function (node) {
		// State preservation
		var prevPassedParams = pstate.passedParams;
		pstate.passedParams = 0;
		
		// Check if function name is recursively defined
		var funName = linker.linkRecursively(node.children[0]);
		
		var prevFun = pstate.curFun;
		
		// If any className,
		var className = '';
		if (pstate.curClass && pstate.curClass != '')
			className = pstate.curClass+'::';
		
		// Set the name of the function (possibly with class name as prefix)
		if (funName.type == T_CONST)
			pstate.curFun = className+funName.value;
		else if (typeof(funName) == 'string') 
			pstate.curFun = className+funName;
		else 
			throw funNameMustBeString(funName.type);

		// Initialize parameters for the function scope
		if ( node.children[1] )
			execute( node.children[1] );
		
		var f = pstate.funTable[pstate.curFun];
		
		// If f expects no parameters, make sure params' length attribute is set correctly
		if (!f.params.length)
			f.params.length = 0;
		
		// Execute function
		if ( f && f.params.length <= pstate.passedParams ) {
			for ( var i=0; i<f.nodes.length; i++ )
				execute( f.nodes[i] );
		} else {
			if (!f) {
				throw funNotFound(funName);
			} else if (!(f.params.length <= pstate.passedParams))
				throw funInvalidArgCount(f.params.length);
		}
		
		// Clear parameters for the function scope
		for ( var i=0; i<f.params.length; i++ )
			linker.unlinkVar( f.params[i] );
		
		// State roll-back
		pstate.passedParams = prevPassedParams;
		pstate.curFun = prevFun;
		var ret = pstate['return'];
		pstate['return'] = 0;
		
		// Return the value saved in .return in our valTable.
		return ret;
	},

	// OP_PASS_PARAM
	'6' : function(node) {
		// Initialize parameter name
		var f = pstate.funTable[pstate.curFun];

		if (!f)
			throw funNotFound();
			
		// Link parameter name with passed value
		if ( node.children[0] ) {
			if ( node.children[0].value != OP_PASS_PARAM ) {
				// Initialize parameter name
				var paramName = '';
				if ( pstate.passedParams < f.params.length )
					paramName = f.params[pstate.passedParams].value;
				else
					paramName = '.arg'+pstate.passedParams;

				// Link
				linker.assignVar( paramName, execute( node.children[0] ) );
				pstate.passedParams++;
			} else {
				execute( node.children[0] );
			}
		}
		
		if ( node.children[1] ) {
			// Initialize parameter name
			var paramName = '';
			if ( pstate.passedParams < f.params.length )
				paramName = f.params[pstate.passedParams].value;
			else
				paramName = '.arg'+pstate.passedParams;
			
			// Link
			linker.assignVar( paramName, execute( node.children[1] ) );
			pstate.passedParams++;
		}
	},

	// OP_RETURN
	'7' : function(node) {
		if (node.children[0])
			pstate['return'] = execute( node.children[0] );
		
		pstate.term = true;
	},

	// OP_ECHO
	'8' : function(node) {
		var val = execute( node.children[0] );
		
		if (typeof(val) != 'string') {
			switch (val.type) {
				case T_INT:
				case T_FLOAT:
				case T_CONST:
					phypeOut( val.value );
					break;
				case T_ARRAY:
					phypeOut( 'Array' );
					break;
				case T_OBJECT:
					phypeOut( 'Object' );
					break;
			}
		} else {
			phypeOut( val );
		}
	},
	
	// OP_ASSIGN_ARR
	'9' : function(node) {
		var varName = node.children[0];
		var keys = execute( node.children[1] );
		var value = execute( node.children[2] );
		
		// If keys is an (javascript) array, assign it as a multi-dimensional array.
		if (typeof(keys) == 'object' && keys.length && keys.length != 'undefined')
			linker.assignArrMulti( varName, keys, value );
		// Otherwise, assign it ordinarily.
		else
			linker.assignArr( varName, keys, value );
		
		return value;
	},
	
	// OP_FETCH_ARR
	'10' : function(node) {
		var varName = node.children[0];
		var keys = execute( node.children[1] );
		
		var value = '';
		// If keys is a JS array, fetch the value as a multi-dimensional PHP array.
		if (typeof(keys) == 'object' && keys.length && keys.length != 'undefined')
			value = linker.getArrValueMulti(varName, keys);
		// Otherwise, fetch it ordinarily.
		else {
			value = linker.getArrValue(varName, keys);
		}

		return value;
	},
	
	// OP_ARR_KEYS_R
	'11' : function(node) {
		var arrKeys = new Array();
		
		if ( node.children[0] ) {
			// If the first child contains recursive array keys, fetch the the recursively defined array keys,
			// and join these with the existing array keys.
			if ( node.children[0].value == OP_ARR_KEYS_R ) {
				arrKeys.join( execute( node.children[0] ) );
			}
			// Otherwise, insert the array key at the end of our list of array.
			else {
				arrKeys.push( execute( node.children[0] ) );
			}
		}
		
		// Add the last array key (if it exists) to the list of array keys.
		if ( node.children[1] ) {
			arrKeys.push( execute( node.children[1] ) );
		}
		
		return arrKeys;
	},
	
	// OP_OBJ_NEW
	'12' : function(node) {
		// Lookup potentially recursively defined class name
		var className = linker.linkRecursively(node.children[0]);
		
		// Look up class in class table
		var realClass = pstate.classTable[node.children[0]];
		if (!realClass || realClass == 'undefined') {
			throw classDefNotFound(node.children[0]);
		}
		
		// Instantiate attributes
		var obj = classLinker.createObjectFromClass(realClass);
		
		// Set state
		pstate.curClass = className;
		pstate.curObj = obj.objListEntry;
		
		// Get and execute constructor
		var constructInvoke = null;
		// First look for __contruct-function (higher precedence than class-named function as
		// constructor)
		if (realClass['funs']['__construct']) {
			constructInvoke = createNode( NODE_OP, OP_OBJ_FCALL, createNode( NODE_VAR, 'this' ),
									className, '__construct' );
		}
		// Then look for class-named function as constructor
		else if (realClass['funs'][className]) {
			constructInvoke = createNode( NODE_OP, OP_OBJ_FCALL, createNode( NODE_VAR, 'this' ),
									className, className );
		}
		
		// Only invoke the constructor if it is defined
		if (constructInvoke)
			execute( constructInvoke );
		
		//State rollback
		pstate.curClass = '';
		pstate.curObj = -1;
		
		// Return the instantiated object
		return createValue( T_OBJECT, obj );
	},
	
	// OP_OBJ_FCALL
	'13' : function(node) {
		var target = execute( node.children[0] );
		if (!target) {
			return execute( createNode(NODE_OP, OP_FCALL, node.children[1], node.children[2]) );
		}
		
		// The function name can be defined by an expression. Execute it.
		if (typeof(node.children[1]) != 'string')
			node.children[1] = execute(node.children[1]);
		
		// Check if function name is recursively defined
		var funName = linker.linkRecursively(node.children[1]);
		
		var targetClass = null;
		var targetObj = -1;
		if (target == 'this') {
			targetClass = pstate.curClass;
			targetObj = pstate.curObj;
		} else {
			if (target.type != T_OBJECT) {
				throw invocationTargetInvalid(target.type);
			}
			
			targetClass = pstate.objList[target.value.objListEntry].value.classDef;
			targetObj = target.value.objListEntry;
		}
		
		// Invoke function
		{
			// State preservation
			var prevPassedParams = pstate.passedParams;
			pstate.passedParams = 0;
			
			// Check if function name is recursively defined
			var prevFun = pstate.curFun;
			var prevClass = pstate.curClass;
			var prevObj = pstate.curObj;
			
			// Set executing function and class
			pstate.curFun = pstate.curClass+'::'+funName;
			pstate.curClass = targetClass;
			pstate.curObj = targetObj;
	
			// Check visibility
			if (!classLinker.checkVisibility(pstate.curClass, targetClass, funName)) {
				throw memberNotVisible(funName);
			}
			
			// Fetch function
			var f = pstate.classTable[targetClass]['funs'][funName]['member'];
			// Initialize parameters for the function scope
			if ( node.children[2] )
				execute( node.children[2] );
			
			// If f expects no parameters, make sure params' length attribute is set correctly
			if (!f.params.length)
				f.params.length = 0;
		
			// Execute function
			if ( f && f.params.length <= pstate.passedParams ) {
				for ( var i=0; i<f.nodes.length; i++ )
					execute( f.nodes[i] );
			} else {
				if (!f) {
					throw funNotFound(funName);
				} else if (!(f.params.length <= pstate.passedParams))
					throw funInvalidArgCount(f.params.length);
			}
			
			// Clear parameters for the function scope
			for ( var i=0; i<f.params.length; i++ )
				linker.unlinkVar( f.params[i] );
			
			// State roll-back
			pstate.passedParams = prevPassedParams;
			pstate.curFun = prevFun;
			pstate.curClass = prevClass;
			pstate.curObj = prevObj;
			var ret = pstate['return'];
			pstate['return'] = 0;
			
			// Return the value saved in .return in our valTable.
			return ret;
		}
	},
	
	// OP_OBJ_FETCH
	'14' : function(node) {
		// The variable name can be defined by an expression. Execute it.
		if (typeof(node.children[1]) != 'string')
			node.children[1] = execute(node.children[1]);
		
		// Check if function name is recursively defined
		var varName = linker.linkRecursively(node.children[1]);
		
		var targetClass = null;
		var targetObj = -1;
		var target = execute( node.children[0] );
		if (target == 'this') {
			targetClass = pstate.curClass;
			targetObj = pstate.curObj;
		} else {
			if (target.type != T_OBJECT) {
				throw invocationTargetInvalid(target.type);
			}
			
			targetClass = pstate.objList[target.value.objListEntry];
			targetObj = target.value.objListEntry;
		}
		
		if (!classLinker.checkVisibility(pstate.curClass, targetClass.value.classDef, varName)) {
			throw memberNotVisible(varName);
		}
		
		if (targetObj == -1)
			throw fetchTargetInvalid();
			
		var lookupStr = pstate.symTables['.global'][targetObj+'::'+varName];
		if (lookupStr)
			var refTable = linker.getRefTableByConsDef(lookupStr.substring(0,5));
		
		if (refTable)
			return refTable[lookupStr.substring(5,lookupStr.length)];
	},
	
	// OP_ATTR_ASSIGN
	'15' : function(node) {
		// Look up potentially recursive variable name
		var varName = linker.linkRecursively(node.children[1]);
		
		// Figure out target object
		var targetClass = null;
		var targetObj = -1;
		var target = execute( node.children[0] );
		if (target == 'this') {
			targetClass = pstate.curClass;
			targetObj = pstate.curObj;
		} else {
			if (target.type != T_OBJECT) {
				throw invocationTargetInvalid(target.type);
			}
			
			targetClass = pstate.objList[target.value.objListEntry];
			targetObj = target.value.objListEntry;
		}
		
		if (targetObj == -1)
			throw fetchTargetInvalid();
		
		// Check if the variable we are trying to assign to already contains an object;
		// decrement the reference count for the object if this is the case.
		var oldVal = null;
		try {
			oldVal = linker.getValueFromObj(targetObj, varName);
		} catch (exception) {
			if (exception!=varNotFound(varName))
				throw exception;
			else
				oldVal = false;
		}
		
		try {
			var val = execute( node.children[2] );
		} catch(exception) {
			// If we get an undefined variable error, and the undefined variable is the variable
			// we are currently defining, initialize the current variable to 0, and try assigning again.
			if (exception == varNotFound(varName)) {
				execute( createNode( NODE_OP, OP_ASSIGN, varName, createValue( T_INT, 0 ) ) );
				val = execute( node.children[1] );
			} else {
				throw exception;
			}
		}
		
		// If we are assigning an object, increment its reference count.
		if (oldVal.value != val.value) {
			if (oldVal && oldVal.type == T_OBJECT)
				classLinker.decrementObjectRef(linker.getValue(varName));
			
			if (val.type == T_OBJECT && oldVal.value != val.value)
				val.value.references++;
		}
		
		linker.assignVar( node.children[0], val );
		
		return val;
	},
	
	// OP_EQU
	'50' : function(node) {
		var leftChild = execute(node.children[0]);
		var rightChild = execute(node.children[1]);
		var resultNode;
		if (leftChild.value == rightChild.value)
			resultNode = createValue(T_CONST, 1);
		else
			resultNode = createValue(T_CONST, 0);
		return resultNode;
	},
	
	// OP_NEQ
	'51' : function(node) {
		var leftChild = execute(node.children[0]);
		var rightChild = execute(node.children[1]);
		var resultNode;
		if (leftChild.value != rightChild.value)
			resultNode = createValue(T_CONST, 1);
		else
			resultNode = createValue(T_CONST, 0);
		return resultNode;
	},
	
	// OP_GRT
	'52' : function(node) {
		var leftChild = execute(node.children[0]);
		var rightChild = execute(node.children[1]);
		var resultNode;
		if (parseInt(leftChild.value) > parseInt(rightChild.value))
			resultNode = createValue(T_CONST, 1);
		else
			resultNode = createValue(T_CONST, 0);
		return resultNode;
		},
	
	// OP_LOT
	'53' : function(node) {
		var leftChild = execute(node.children[0]);
		var rightChild = execute(node.children[1]);
		var resultNode;
		if (linker.getNumberFromNode(leftChild) < linker.getNumberFromNode(rightChild))
			resultNode = createValue(T_CONST, 1);
		else
			resultNode = createValue(T_CONST, 0);

		return resultNode;
	},
	
	// OP_GRE
	'54' : function(node) {
				var leftChild = execute(node.children[0]);
		var rightChild = execute(node.children[1]);
		var resultNode;
		if (linker.getNumberFromNode(leftChild) >= linker.getNumberFromNode(rightChild))
			resultNode = createValue(T_CONST, 1);
		else
			resultNode = createValue(T_CONST, 0);
		return resultNode;
	},
	
	// OP_LOE
	'55' : function(node) {
		var leftChild = execute(node.children[0]);
		var rightChild = execute(node.children[1]);
		var resultNode;
		if (linker.getNumberFromNode(leftChild) <= linker.getNumberFromNode(rightChild))
			resultNode = createValue(T_CONST, 1);
		else
			resultNode = createValue(T_CONST, 0);
		return resultNode;
	},
	
	// OP_ADD
	'56' : function(node) {
		var leftChild = execute(node.children[0]);
		var rightChild = execute(node.children[1]);
		var leftValue;
		var rightValue;
		var type = T_INT;
		
		switch (leftChild.type) {
			// TODO: Check for PHP-standard.
			case T_INT:
			case T_CONST:
				leftValue = parseInt(leftChild.value);
				break;
			case T_FLOAT:
				leftValue = parseFloat(leftChild.value);
				type = T_FLOAT;
				break;
		}
		switch (rightChild.type) {
			// TODO: Check for PHP-standard.
			case T_INT:
			case T_CONST:
				rightValue = parseInt(rightChild.value);
				break;
			case T_FLOAT:
				rightValue = parseFloat(rightChild.value);
				type = T_FLOAT;
				break;
		}

		var result = leftValue + rightValue;
		var resultNode = createValue(type, result);

		return resultNode;
	},

	// OP_SUB
	'57' : function(node) {
		var leftChild = execute(node.children[0]);
		var rightChild = execute(node.children[1]);
		var result = leftChild.value - rightChild.value;
		var resultNode = createValue(T_CONST, result);

		return resultNode;
	},
	
	// OP_DIV
	'58' : function(node) {
		var leftChild = execute(node.children[0]);
		var rightChild = execute(node.children[1]);
		var result = leftChild.value / rightChild.value;
		var resultNode = createValue(T_CONST, result);

		return resultNode;
	},
	
	// OP_MUL
	'59' : function(node) {
		var leftChild = execute(node.children[0]);
		var rightChild = execute(node.children[1]);
		var result = leftChild.value * rightChild.value;
		var resultNode = createValue(T_CONST, result);

		return resultNode;
	},
	
	// OP_NEG
	'60' : function(node) {
		var child = execute(node.children[0]);
		var result = -(child.value);
		var resultNode = createValue(T_CONST, result);

		return resultNode;
	},
	
	// OP_CONCAT
	'61' : function(node) {
		var leftChild = execute( node.children[0] );
		var rightChild = execute( node.children[1] );

		return createValue( T_CONST, leftChild.value+rightChild.value );
	}
}

function execute( node ) {
	// Reset term-event boolean and terminate currently executing action, if a terminate-event
	// was received.
	if (pstate.term) {
		pstate.term = false;
		return;
	}
	
	var ret = 0;
	
	if( !node ) {
		return 0;
	}

	switch( node.type ) {
		case NODE_OP:
			var tmp = ops[node.value](node);
			if (tmp && tmp != 'undefined')
			ret = tmp;
			break;
			
		case NODE_VAR:
			ret = linker.getValue( node.value );
			break;
			
		case NODE_CONST:
			ret = createValue( T_CONST, node.value );
			break;
		
		case NODE_INT:
			ret = createValue( T_INT, node.value );
			break;
		
		case NODE_FLOAT:
			ret = createValue( T_FLOAT, node.value );
			break;
	}
	
	return ret;
}

*]

!	' |\n|\r|\t|\\( assertEcho ((\'[^\']*\')|("[^"]*"))\s*$| assertFail\s*$)'

	"IF"
	"ELSE"
	"WHILE"
	"DO"
	"ECHO"
	"RETURN"
	"NEW"							NewToken
	"CLASS"							ClassToken
	"PUBLIC"						PublicToken
	"PRIVATE"						PrivateToken
	"PROTECTED"						ProtectedToken
	'{'
	'}'
	'\['
	'\]'
	';'
	','
	'\.'
	'='
	'=='
	'!='
	'<!'
	'!>'
	'<='
	'>='
	'>'
	'<'
	'\+'
	'\-'
	'/'
	'\*'
	'\('
	'\)'
	'->'
	'::'
	'//'
	'\$[\$a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*'
									Variable
										[* %match = %match.substr(1,%match.length-1); *]
	'function [a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*'
									FunctionName
										[* %match = %match.substr(9,%match.length-1); *]
	'[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*'
									Identifier
	'((\'[^\']*\')|("[^"]*"))'		String
										[*
											%match = %match.substr(1,%match.length-2);
											%match = %match.replace( /\\'/g, "'" );
										*]
	'[0-9]+'						Integer
	'[0-9]+\.[0-9]*|[0-9]*\.[0-9]+'	Float
	'<\?'							ScriptBegin
	'\?>(([^<\?])|<[^\?])*'			ScriptEnd
	'\?>(([^<\?])|<[^\?])*<\?'		InternalNonScript
	;

##

PHPScript:	PHPScript Script
		|
		;
		
Script: 	ScriptBegin Stmt ScriptEnd
										[*	
											execute( %2 );
											if (%3.length > 2) {
												var strNode = createNode( NODE_CONST, %3.substring(2,%3.length) );
												execute( createNode( NODE_OP, OP_ECHO, strNode ) );
											}
										*]
		;
		
ClassDefinition:
			ClassToken Identifier '{' Member '}'
										[*	
											pstate.curClass = %2+'::';
											pstate.classTable[%2] =
												createClass( MOD_PUBLIC, %2, pstate.curAttrs, pstate.curFuns );
											pstate.curAttrs = [];
											pstate.curFuns = [];
											pstate.curClass = '';
										*]
		;
		
Member:		Member AttributeDefinition
		|	Member ClassFunctionDefinition
		|
		;

AttributeMod:
			PublicToken					[* %% = MOD_PUBLIC; *]
		|	ProtectedToken				[* %% = MOD_PROTECTED; *]
		|	PrivateToken				[* %% = MOD_PRIVATE; *]
		;
		
FunctionMod:
			PublicToken					[* %% = MOD_PUBLIC; *]
		|								[* %% = MOD_PUBLIC; *]
		|	ProtectedToken				[* %% = MOD_PROTECTED; *]
		|	PrivateToken				[* %% = MOD_PRIVATE; *]
		;

FunctionDefinition:
			FunctionName '(' FormalParameterList ')' '{' Stmt '}'
										[* 	
											// Check that the function is not defined twice.
											if (pstate.funTable[%1]) {
												throw funRedeclare(%1);
											}
											pstate.funTable[%1] =
												createFunction( %1, pstate.curParams, %6 );
											// Make sure to clean up param list
											// for next function declaration
											pstate.curParams = [];
										*]
		;

ClassFunctionDefinition:
			FunctionMod FunctionName '(' FormalParameterList ')' '{' Stmt '}'
										[* 	
											// Check that the function is not defined twice within
											// the same object
											if (pstate.curClass && pstate.curFuns[pstate.curClass+%2]) {
												throw funRedeclare(pstate.curClass+%2);
											}
											var fun = createFunction( %2, pstate.curParams, %7 );
											pstate.curFuns[%2] = createMember( %1, fun );
											// Make sure to clean up param list
											// for next function declaration
											pstate.curParams = [];
										*]
		;

AttributeDefinition:
			AttributeMod Variable ';'	[*
											pstate.curAttrs[%2] = createMember( %1, %2 );
										*]
		|	AttributeMod Variable '=' Expression ';'
										[*
											pstate.curAttrs[%2] = createMember( %1, %2, %4 );
										*]
		;

Stmt:		Stmt Stmt					[* %% = createNode ( NODE_OP, OP_NONE, %1, %2 ); *]
		|	Return ';'
		|	Expression ';'
		|	IF Expression Stmt 			[* %% = createNode( NODE_OP, OP_IF, %2, %3 ); *]
		|	IF Expression Stmt ELSE Stmt	
										[* %% = createNode( NODE_OP, OP_IF_ELSE, %2, %3, %5 ); *]
		|	WHILE Expression Stmt 	[* %% = createNode( NODE_OP, OP_WHILE_DO, %2, %3 ); *]
		|	DO Stmt WHILE Expression ';'	
										[* %% = createNode( NODE_OP, OP_DO_WHILE, %2, %4 ); *]
		|	ECHO Expression ';'			[* %% = createNode( NODE_OP, OP_ECHO, %2 ); *]
		|	Variable '=' Expression ';'	[* %% = createNode( NODE_OP, OP_ASSIGN, %1, %3 ); *]
		|	Target '->' AttributeAccess '=' Expression ';'
										[* %% = createNode( NODE_OP, OP_ATTR_ASSIGN, %1, %3, %5 ); *]
		|	ClassDefinition
		|	FunctionDefinition
		|	Variable ArrayIndices '=' Expression ';'
										[* %% = createNode( NODE_OP, OP_ASSIGN_ARR, %1, %2, %4 ); *]
		|	'{' Stmt '}'				[* %% = %2; *]
		|	InternalNonScript			[* 
											if (%1.length > 4) {
												var strNode = createNode( NODE_CONST, %1.substring(2,%1.length-2) );
												%% = createNode( NODE_OP, OP_ECHO, strNode );
											}
										*]
		|	'//' AssertStmt
		;
		
AssertStmt:	Identifier String
										[*	
											if (phypeTestSuite && %1 == "assertEcho") {
												pstate.assertion = createAssertion( ASS_ECHO, %2 );
											}
										*]
		|	Identifier					[*
											if (phypeTestSuite && %1 == "assertFail") {
												pstate.assertion = createAssertion( ASS_FAIL, 0 );
											}
										*]
		|
		;
		
FormalParameterList:
			FormalParameterList ',' Variable
										[*
											pstate.curParams[pstate.curParams.length] =
												createNode( NODE_CONST, %3 );
										*]
		|	Variable					[*
											pstate.curParams[pstate.curParams.length] =
												createNode( NODE_CONST, %1 );
										*]
		|
		;	

Return:		RETURN Expression			[* %% = createNode( NODE_OP, OP_RETURN, %2 ); *]
		|	RETURN						[* %% = createNode( NODE_OP, OP_RETURN ); *]
		;

Target:		Expression
		;

ExpressionNotFunAccess:
			BinaryOp
		|	NewToken FunctionInvoke ActualParameterList ')'
										[* %% = createNode( NODE_OP, OP_OBJ_NEW, %2, %3 ); *]
		|	Target '->' MemberAccess	[* %3.children[0] = %1; %% = %3; *]
		|	Variable ArrayIndices		[* %% = createNode( NODE_OP, OP_FETCH_ARR, %1, %2 ); *]
		|	'(' Expression ')'			[* %% = %2; *]
		;
		
Expression:	BinaryOp
		|	NewToken FunctionInvoke ActualParameterList ')'
										[* %% = createNode( NODE_OP, OP_OBJ_NEW, %2, %3 ); *]
		|	Target '->' MemberAccess	[* %3.children[0] = %1; %% = %3; *]
		|	FunctionAccess
		|	Variable ArrayIndices		[* %% = createNode( NODE_OP, OP_FETCH_ARR, %1, %2 ); *]
		|	'(' Expression ')'			[* %% = %2; *]
		;

FunctionInvoke:
			Identifier '('				[* %% = %1; *]
		|	Expression '('				[* %% = %1; *]
		;

MemberAccess:
			FunctionAccess
		|	AttributeAccess
		;
		
AttributeAccess:
			Identifier					[* %% = createNode( NODE_OP, OP_OBJ_FETCH, null, %1 ); *]
		|	ExpressionNotFunAccess		[* %% = createNode( NODE_OP, OP_OBJ_FETCH, null, %1 ); *]
		;

FunctionAccess:
			FunctionInvoke ActualParameterList ')'
										[* %% = createNode( NODE_OP, OP_OBJ_FCALL, null, %1, %2 ); *]
		|	Expression '(' ActualParameterList ')'
										[* %% = createNode( NODE_OP, OP_OBJ_FCALL, null, %1, %3 ); *]
		;
		
ActualParameterList:
			ActualParameterList ',' Expression
										[* %% = createNode( NODE_OP, OP_PASS_PARAM, %1, %3 ); *]
		|	Expression					[* %% = createNode( NODE_OP, OP_PASS_PARAM, %1 ); *]
		|
		;

ArrayIndices:
			ArrayIndices '[' Expression ']'
										[* %% = createNode( NODE_OP, OP_ARR_KEYS_R, %1, %3 ); *]
		|	'[' Expression ']'			[* %% = %2; *]
		;

BinaryOp:	Expression '==' AddSubExp	[* %% = createNode( NODE_OP, OP_EQU, %1, %3 ); *]
		|	Expression '<' AddSubExp	[* %% = createNode( NODE_OP, OP_LOT, %1, %3 ); *]
		|	Expression '>' AddSubExp	[* %% = createNode( NODE_OP, OP_GRT, %1, %3 ); *]
		|	Expression '<=' AddSubExp	[* %% = createNode( NODE_OP, OP_LOE, %1, %3 ); *]
		|	Expression '>=' AddSubExp	[* %% = createNode( NODE_OP, OP_GRE, %1, %3 ); *]
		|	Expression '!=' AddSubExp	[* %% = createNode( NODE_OP, OP_NEQ, %1, %3 ); *]
		|	Expression '.' Expression	[* %% = createNode( NODE_OP, OP_CONCAT, %1, %3 ); *]
		|	AddSubExp
		;

AddSubExp:	AddSubExp '-' MulDivExp		[* %% = createNode( NODE_OP, OP_SUB, %1, %3 ); *]
		|	AddSubExp '+' MulDivExp		[* %% = createNode( NODE_OP, OP_ADD, %1, %3 ); *]
		|	MulDivExp
		;
				
MulDivExp:	MulDivExp '*' UnaryOp		[* %% = createNode( NODE_OP, OP_MUL, %1, %3 ); *]
		|	MulDivExp '/' UnaryOp		[* %% = createNode( NODE_OP, OP_DIV, %1, %3 ); *]
		|	UnaryOp
		;
				
UnaryOp:	'-' Value					[* %% = createNode( NODE_OP, OP_NEG, %2 ); *]
		|	Value
		;

Value:		Variable					[* %% = createNode( NODE_VAR, %1 ); *]
		|	'(' Expression ')'			[* %% = %2; *]
		|	String						[* %% = createNode( NODE_CONST, %1 ); *]
		|	Integer						[* %% = createNode( NODE_INT, %1 ); *]
		|	Float						[* %% = createNode( NODE_FLOAT, %1 ); *]
		;

[*

//////////////////////
// PHYPE I/O-CHECKS //
//////////////////////
if (!phypeIn || phypeIn == 'undefined') {
	var phypeIn = function() {
		// Running from V8 or another shell JS-app
		if (typeof(alert) == 'undefined') {
			return '';
		}
		// Running from browser
		else
			return prompt( "Please enter a PHP-script to be executed:",
			//	"<? $a[1] = 'foo'; $foo = 'bar'; echo $a[1].$foo; ?>"
				//"<? $a=1; $b=2; $c=3; echo 'starting'; if ($a+$b == 3){ $r = $r + 1; if ($c-$b > 0) { $r = $r + 1; if ($c*$b < 7) {	$r = $r + 1; if ($c*$a+$c == 6) { $r = $r + 1; if ($c*$c/$b <= 5) echo $r; }}}} echo 'Done'; echo $r;?>"
				//"<? $a[0]['d'] = 'hej'; $a[0][1] = '!'; $b = $a; $c = $a; $b[0] = 'verden'; echo $a[0]['d']; echo $b[0]; echo $c[0][1]; echo $c[0]; echo $c; if ($c) { ?>C er sat<? } ?>"
				"<?" +
				"$i = 0;" +
				"while ($i < 10) {" +
				"	echo $i;" +
				"	$i = $i+1;" +
				"}" +
				"?>"
			);
	};
}

// Set phypeOut if it is not set.
if (!phypeOut || phypeOut == 'undefined') {
	// Running from V8 or another shell JS-app
	if (typeof(alert) == 'undefined')
		var phypeOut = print;
	else // Running from browser
		var phypeOut = alert;
}

/**
 * Creates an echo with non-PHP character data that precedes the first php-tag.
 */
function preParse(str) {
	var firstPhp = str.indexOf('<?');
	var res = '';
	if (firstPhp > 0 || firstPhp == -1) {
		if (firstPhp == -1) firstPhp = str.length;
		var echoStr = '<? ';
		echoStr += "echo '"+str.substring(0,firstPhp).replace("'","\'")+"';";
		echoStr += ' ?>';
		res = echoStr+str.substring(firstPhp,str.length);
	} else {
		res = str;
	}
	
	return res
}

function interpret(str) {
	var error_cnt 	= 0;
	var error_off	= new Array();
	var error_la	= new Array();
	
	if( ( error_cnt = __parse( preParse(str), error_off, error_la ) ) > 0 ) {
		for(var i=0; i<error_cnt; i++)
			phypeOut( "Parse error near >" 
				+ str.substr( error_off[i], 30 ) + "<, expecting \"" + error_la[i].join() + "\"<br/>\n" );
	}
}

/////////////
// PARSING //
/////////////

// If we are not in our test suite, load all the scripts all at once.
if (!phypeTestSuite) {
	var str = phypeIn();

	interpret(str);
	
	if (phypeDoc && phypeDoc.open) {
		phypeDoc.close();
	}
}
// If we are, parse it accordingly
else if (phpScripts) {
	for (var i=0; i<phpScripts.length; i++) {
		var script = phpScripts[i];

		var error_cnt 	= 0;
		var error_off	= new Array();
		var error_la	= new Array();
		
		if (i>0) __parse( preParse(script.code) );
		resetState();
		
		phypeEcho = '';
		
		var failed = false;
		var thrownException = null;
		try {
			if( ( error_cnt = __parse( preParse(script.code), error_off, error_la ) ) > 0 ) {
				for(var i=0; i<error_cnt; i++)
					throw  "Parse error near >" 
						+ script.code.substr( error_off[i], 30 ) + "<, expecting \"" + error_la[i].join() + "\"" ;
			}
		} catch(exception) {
			failed = true;
			thrownException = exception;
		}

		switch (pstate.assertion.type) {
			case ASS_ECHO:
				if (phypeEcho != pstate.assertion.value)
					phypeDoc.write('"'+script.name+'" failed assertion. Expected output: "'+
							pstate.assertion.value+'". Actual output: "'+phypeEcho+'".<br/>\n<br/>\n');
				if (thrownException)
					throw thrownException;
				break;
			case ASS_FAIL:
				if (!failed)
					phypeDoc.write('"'+script.name+'" failed assertion. Expected script to fail,'+
							' but no exceptions were raised.<br/>\n<br/>\n');
		}
		pstate.assertion = null;
	}
	if (phypeDoc && phypeDoc.open) {
		phypeDoc.write('Testing done!');
		phypeDoc.close();
	}
}

/*
log('SymTables');
var_log(pstate.symTables);
log('ObjList');
var_log(pstate.objList);
log('ObjMapping');
var_log(pstate.objMapping);
log('Values');
var_log(pstate.valTable);
*/

///////////////
// DEBUGGING //
///////////////
/**
 * Borrowed from http://snippets.dzone.com/posts/show/4296
 */
function var_dump(data,addwhitespace,safety,level) {
	var rtrn = '';
	var dt,it,spaces = '';
	if(!level) {level = 1;}
	for(var i=0; i<level; i++) {
		spaces += '   ';
	}//end for i<level
	if(typeof(data) != 'object') {
		dt = data;
		if(typeof(data) == 'string') {
			if(addwhitespace == 'html') {
				dt = dt.replace(/&/g,'&amp;');
				dt = dt.replace(/>/g,'&gt;');
				dt = dt.replace(/</g,'&lt;');
			}//end if addwhitespace == html
			dt = dt.replace(/\"/g,'\"');
			dt = '"' + dt + '"';
		}//end if typeof == string
		if(typeof(data) == 'function' && addwhitespace) {
			dt = new String(dt).replace(/\n/g,"<br/>"+spaces);
			if(addwhitespace == 'html') {
				dt = dt.replace(/&/g,'&amp;');
				dt = dt.replace(/>/g,'&gt;');
				dt = dt.replace(/</g,'&lt;');
			}//end if addwhitespace == html
		}//end if typeof == function
		if(typeof(data) == 'undefined') {
			dt = 'undefined';
		}//end if typeof == undefined
		if(addwhitespace == 'html') {
			if(typeof(dt) != 'string') {
				dt = new String(dt);
			}//end typeof != string
			dt = dt.replace(/ /g,"&nbsp;").replace(/\n/g,"<br/>");
		}//end if addwhitespace == html
		return dt;
	}//end if typeof != object && != array
	for (var x in data) {
		if(safety && (level > safety)) {
			dt = '*RECURSION*';
		} else {
			try {
			dt = var_dump(data[x],addwhitespace,safety,level+1);
			} catch (e) {continue;}
		}//end if-else level > safety
		it = var_dump(x,addwhitespace,safety,level+1);
		rtrn += it + ':' + dt + ',';
		if(addwhitespace) {
			rtrn += '<br/>'+spaces;
		}//end if addwhitespace
	}//end for...in
	if(addwhitespace) {
		rtrn = '{<br/>' + spaces + rtrn.substr(0,rtrn.length-(2+(level*3))) + '<br/>' +
					spaces.substr(0,spaces.length-3) + '}';
	} else {
		rtrn = '{' + rtrn.substr(0,rtrn.length-1) + '}';
	}//end if-else addwhitespace
	if(addwhitespace == 'html') {
		rtrn = rtrn.replace(/ /g,"&nbsp;").replace(/\n/g,"<br/>");
	}//end if addwhitespace == html
	return rtrn;
}

/**
 * Borrowed from http://ajaxcookbook.org/javascript-debug-log/
 */
function log(message) {
	if (!log.window_ || log.window_.closed) {
		var win = window.open("", null, "width=600,height=400," +
							"scrollbars=yes,resizable=yes,status=no," +
							"location=no,menubar=no,toolbar=no");
		if (!win) return;
		var doc = win.document;
		doc.write("<html><head><title>Debug Log</title></head>" +
				"<body></body></html>");
		doc.close();
		log.window_ = win;
	}
	var logLine = log.window_.document.createElement("div");
	logLine.appendChild(log.window_.document.createTextNode(message));
	log.window_.document.body.appendChild(logLine);
}

function var_log(variable) {
	log(var_dump(variable));
}
*]