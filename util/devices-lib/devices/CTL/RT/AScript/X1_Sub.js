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
var X1_NoSub_1 = require("./X1_NoSub");
/**
 * 需要进一步明确类型的X1设备类型
 * 如控制器类型为 CTL_RT_X1_BKSR,在处理时需要调用getSubDeviceType，来确定具体型号进行二次加载解析
 * 如确认是1-9那种模式
 */
var CTL_RT_X1_Sub_Ts = /** @class */ (function (_super) {
    __extends(CTL_RT_X1_Sub_Ts, _super);
    function CTL_RT_X1_Sub_Ts() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CTL_RT_X1_Sub_Ts.prototype.getSubDeviceType = function () {
        var t = this.getSettingFields().getItem('se_dangqianmoshi').getValue().toString();
        return t;
    };
    return CTL_RT_X1_Sub_Ts;
}(X1_NoSub_1.CTL_RT_X1_NoSub_Ts));
exports.CTL_RT_X1_Sub_Ts = CTL_RT_X1_Sub_Ts;
