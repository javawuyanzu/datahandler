"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var NumberHashMap = /** @class */ (function () {
    function NumberHashMap(map) {
        this.map = {};
        if (map) {
            this.map = map;
        }
    }
    NumberHashMap.prototype.addItem = function (key, value) {
        this.map[key] = value;
    };
    NumberHashMap.prototype.getItem = function (key) {
        return this.map[key];
    };
    NumberHashMap.prototype.each = function (func) {
        for (var k in this.map) {
            func(new Number(k).valueOf(), this.map[k]);
        }
    };
    NumberHashMap.prototype.containsKey = function (key) {
        return this.map[key] ? true : false;
    };
    return NumberHashMap;
}());
exports.NumberHashMap = NumberHashMap;
// export class StringHashMap<TValue>{
//     private map: { [key: string]: TValue } = {}
//     addItem(key: string, value: TValue) {
//         this.map[key] = value
//     }
//     getItem(key: string) {
//         return this.map[key]
//     }
//     get count(): number {
//         let i = 0
//         this.each(function(){
//             i++
//         })
//         return i
//     }
//     // get Keys(): string[] {
//     //     // let keys: string[] = []
//     //     // this.each((k, v) => {
//     //     //     keys.push(k)
//     //     // })
//     //     //return keys
//     //     return this.map2.keys()
//     // }
//     each(func: (key: string, value: TValue) => void) {
//         for (const key in this.map) {
//             func(key, this.map[key])
//         }
//     }
//     containsKey(key: string): boolean {
//         return this.map[key] ? true : false
//     }
//     remove(key: string): void {
//         delete this.map[key]
//     }
//     clear(): void {
//         this.map = {}
//     }
// }
var List = /** @class */ (function () {
    function List() {
        this.list = [];
    }
    List.prototype.push = function (item) {
        if (item) {
            this.list.push(item);
        }
    };
    List.prototype.insert = function (index, item) {
        this.list.splice(index, 0, item);
    };
    List.prototype.each = function (func) {
        for (var i in this.list) {
            func(this.list[i]);
        }
    };
    List.prototype.item = function (index) {
        return this.list[index];
    };
    List.prototype.toArray = function () {
        return this.list;
    };
    return List;
}());
exports.List = List;
//}
