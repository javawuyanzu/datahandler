"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var ByteField_1 = require("./ByteField");
var DeviceFieldForUI_1 = require("./DeviceFieldForUI");
var comms_1 = require("@sdcsoft/comms");
//namespace DevicesLib.meta {
var ExceptionField = /** @class */ (function (_super) {
    __extends(ExceptionField, _super);
    function ExceptionField() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        /**
         * 异常等级
         */
        _this.level = 0;
        return _this;
    }
    ExceptionField.prototype.setDeviceFieldForUIKey = function (fieldForUI) {
        fieldForUI.setKey(comms_1.GroupKeys.KEY_EXCEPTION);
    };
    ExceptionField.prototype.getExceptionLevel = function () {
        return this.level;
    };
    ExceptionField.prototype.getDeviceFieldForUI = function (value) {
        var fieldForUI = new DeviceFieldForUI_1.DeviceFieldForUI();
        this.setDeviceFieldForUIKey(fieldForUI);
        fieldForUI.setName(this.getName());
        fieldForUI.setTitle(this.getTitle());
        fieldForUI.setExcptionLevel(this.level);
        return fieldForUI;
    };
    ExceptionField.Exception_NULL = -1;
    ExceptionField.Exception_Waring = 0;
    ExceptionField.Exception_Error = 1;
    return ExceptionField;
}(ByteField_1.ByteField));
exports.ExceptionField = ExceptionField;
//}
