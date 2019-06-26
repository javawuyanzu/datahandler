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
var RT_1 = require("../../RT");
/**
 * 明确类型的T2设备的基类
 * 如 CTL_RT_T2_211,这种类型设备在处理上无需进行二次解析来明确具体类型
 */
var CTL_RT_T2_RYZQ_NoSub_Ts = /** @class */ (function (_super) {
    __extends(CTL_RT_T2_RYZQ_NoSub_Ts, _super);
    function CTL_RT_T2_RYZQ_NoSub_Ts() {
        var _this = _super.call(this) || this;
        _this.BYTE_ARRAY_LENGTH = 163;
        return _this;
    }
    return CTL_RT_T2_RYZQ_NoSub_Ts;
}(RT_1.CTL_RT));
exports.CTL_RT_T2_RYZQ_NoSub_Ts = CTL_RT_T2_RYZQ_NoSub_Ts;
