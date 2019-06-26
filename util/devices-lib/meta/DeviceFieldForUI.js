"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ExceptionField_1 = require("./ExceptionField");
//namespace DevicesLib.meta {
var DeviceFieldForUI = /** @class */ (function () {
    function DeviceFieldForUI(valueMap) {
        this.name = '';
        this.value = 0;
        this.key = '';
        this.title = '';
        this.valueString = null;
        this.exceptionLevel = null;
        this.valueMap = null;
        this.unit = '';
        if (valueMap) {
            this.valueMap = valueMap;
        }
    }
    DeviceFieldForUI.prototype.getValueMap = function () {
        return this.valueMap;
    };
    DeviceFieldForUI.prototype.getUnit = function () {
        return this.unit;
    };
    DeviceFieldForUI.prototype.setUnit = function (unit) {
        this.unit = unit;
    };
    DeviceFieldForUI.prototype.setExcptionLevel = function (level) {
        this.exceptionLevel = level;
    };
    // setNeedFormat(needFormat: boolean) {
    //     this.needFormat = needFormat
    // }
    //private needFormat: boolean =false
    DeviceFieldForUI.prototype.getKey = function () {
        return this.key;
    };
    DeviceFieldForUI.prototype.setKey = function (key) {
        this.key = key;
    };
    DeviceFieldForUI.prototype.getName = function () {
        return this.name;
    };
    DeviceFieldForUI.prototype.setName = function (name) {
        this.name = name;
    };
    DeviceFieldForUI.prototype.getValue = function () {
        if (this.value)
            return this.value;
        return 0;
    };
    DeviceFieldForUI.prototype.setValue = function (value) {
        this.value = value;
        if (this.valueMap) {
            this.valueString = this.valueMap.getItem(value);
        }
    };
    DeviceFieldForUI.prototype.getTitle = function () {
        return this.title;
    };
    DeviceFieldForUI.prototype.setTitle = function (title) {
        this.title = title;
    };
    DeviceFieldForUI.prototype.getValueString = function () {
        // if (this.needFormat){
        //     return this.valueString.replace('%s', this.value.toString())
        // }
        if (this.valueString)
            return this.valueString;
        return '';
    };
    DeviceFieldForUI.prototype.setValueString = function (valueString) {
        this.valueString = valueString;
    };
    DeviceFieldForUI.prototype.getExceptionLevel = function () {
        if (this.exceptionLevel)
            return this.exceptionLevel;
        return ExceptionField_1.ExceptionField.Exception_NULL;
    };
    return DeviceFieldForUI;
}());
exports.DeviceFieldForUI = DeviceFieldForUI;
//}
