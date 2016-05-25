// This file is part of nbind, copyright (C) 2014-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import {setEvil, prepareNamespace} from 'emscripten-library-decorator';
import {_nbind as _type} from './BindingType';
import {_nbind as _std} from './BindingStd';
import {_nbind as _caller} from './Caller';
import {_nbind as _resource} from './Resource';

// Let decorators run eval in current scope to read function source code.
setEvil((code: string) => eval(code));

// Namespace that will be made available inside Emscripten compiled module.

export namespace _nbind {

	// Generic table and list of functions.

	export type Func = (...args: any[]) => any;
	export type FuncTbl = { [name: string]: Func };
	export type FuncList = { (...args: any[]): any }[];
	export type Invoker = (ptr: number, ...args: any[]) => any;
	export type TypeIDList = (number | string)[];

	export var ArrayType: typeof _std.ArrayType;

	export var resources: typeof _resource.resources;
	export var listResources: typeof _resource.listResources;

	export var makeOverloader: typeof _caller.makeOverloader;

	function getComplexType(id: number) {
		var placeholderFlag = HEAPU8[id as number];

		if(placeholderFlag == 0) throw(new Error('Unbound type ' + id));

		var memberId = HEAPU32[((id as number) >> 2) + 1];
		var memberType = _nbind.typeList[memberId as number];
		var type: _type.BindType;

		if(!memberType) throw(new Error('Unbound member type ' + memberId));

		// These numbers must match TypeStd.h
		switch(placeholderFlag) {
			case 1: // Vector
				type = new _nbind.ArrayType(id, memberType);
				break;
			case 2: // Array
				var size = HEAPU32[((id as number) >> 2) + 2];
				type = new _nbind.ArrayType(id, memberType, size);
				break;
			default:
				throw(new Error('Corrupt type ' + id + ' with flag ' + placeholderFlag));
		}

		console.log(type.name);

		_nbind.typeList[id] = type;
		return(type);
	}

	// Look up a list of type objects based on their numeric typeID or name.

	export function getTypes(idList: TypeIDList) {
		return(idList.map((id: number | string) => {
			if(typeof(id) == 'number') {
				var type = _nbind.typeList[id as number];
				return(type || getComplexType(id as number));
			} else return(_nbind.typeTbl[id as string]);
		}));
	}

	// Generate a mangled signature from argument types.
	// Asm.js functions can only be called though Emscripten-generated invoker functions,
	// with slightly mangled type signatures appended to their names.

	export function makeSignature(typeList: _type.BindType[]) {
		var mangleMap: { [name: string]: string; } = {
			float64_t: 'd',
			float32_t: 'f',
			void: 'v'
		}

		return(typeList.map((type: _type.BindType) => (mangleMap[type.name] || 'i')).join(''));
	}

	// Add a method to a C++ class constructor (for static methods) or prototype,
	// or overload an existing method.

	export function addMethod(obj: FuncTbl, name: string, func: Func, arity: number) {
		var overload = obj[name] as any;

		// Check if the function has been overloaded.

		if(overload) {
			if(overload.arity || overload.arity === 0) {
				// Found an existing function, but it's not an overloader.
				// Make a new overloader and add the existing function to it.

				overload = makeOverloader(overload, overload.arity);
				obj[name] = overload;
			}

			// Add this function as an overload.

			overload.addMethod(func, arity);
		} else {
			// Add a new function and store its arity in case it gets overloaded.

			(func as any).arity = arity;

			obj[name] = func;
		}
	}

	// Mapping from numeric typeIDs and type names to objects with type information.

	export var typeTbl: { [name: string]: _type.BindType } = {};
	export var typeList: _type.BindType[] = [];

	// Enum specifying if a method is a getter or setter or not.

	export var MethodType: {
		method: number;
		getter: number;
		setter: number;
	} = {} as any;

	export var value: any;

	export function throwError(message: string) {
		throw(new Error(message));
	}

	// Export the namespace to Emscripten compiled output.
	// This must be at the end of the namespace!
	// The dummy class is needed because unfortunately namespaces can't have decorators.
	// Everything after it inside the namespace will be discarded.

	@prepareNamespace('_nbind')
	export class _ {}
}
