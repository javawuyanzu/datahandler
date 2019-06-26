"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var comms_1 = require("@sdcsoft/comms");
var map = /** @class */ (function () {
    function map() {
        this.pointMap = new comms_1.StringHashMap();
        //protected commandMap: StringHashMap<Command[] | null> = new StringHashMap<Command[] | null>()
        this.commandMap = new comms_1.StringHashMap();
    }
    //protected subTypes: StringHashMap<string> = new StringHashMap<string>()
    //protected warningMsg:string = ''
    map.prototype.getPointMap = function () {
        return this.pointMap;
    };
    map.prototype.getCommandsMap = function () {
        return this.commandMap;
    };
    map.prototype.addPoint = function (byteField, key) {
        if (key) {
            this.pointMap.addItem(key, byteField);
            return;
        }
        this.pointMap.addItem(byteField.getName(), byteField);
    };
    map.prototype.addCommand = function (groupKey, cmd) {
        if (this.commandMap.containsKey(groupKey)) {
            var cmds = this.commandMap.getItem(groupKey);
            cmds.push(cmd);
        }
        else {
            var cmds = [cmd];
            this.commandMap.addItem(groupKey, cmds);
        }
    };
    // static readonly KEY_BASE = 'baseInfo'
    // static readonly KEY_RUN = 'runInfo'
    // static readonly KEY_EXCEPTION = 'exceptionInfo'
    // static readonly KEY_MOCK = 'mockInfo'
    // static readonly KEY_SETTING = 'settingInfo'
    // static readonly KEY_START_STOP = 'startStopInfo'
    // static readonly KEY_DEVICE = 'deviceInfo'
    // static readonly KEY_OPEN_CLOSE = 'openclose'
    /**
     * 计算属性的KEY
     */
    map.KEY_Count_Fields = 'countfields';
    map.KEY_POINT_SYSTEM_STATUS = 'o_system_status';
    map.KEY_POINT_POWER = 'o_power';
    map.KEY_POINT_MEDIA = 'o_media';
    map.KEY_POINT_RUN_LIFE = 'ba_yunxingshijian';
    map.KEY_POINT_RUN_DAYS = 'ba_yunxingtianshu';
    map.KEY_POINT_RUN_HOURS = 'ba_yunxingxiaoshishu';
    return map;
}());
exports.map = map;
