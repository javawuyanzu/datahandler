var express = require('express');
var app = express();
var mysql = require('mysql');
var  lib = require('./util/devices-lib/index.js');
var  gfrm = require('@sdcsoft/gfrm');
var  comms = require('@sdcsoft/comms');
var RunInfoDB = require('./RunInfoDB.js');
var BksrDB = require('./BksrDB.js');
var HashMap   = require ('hashmap');
var RunInfoconnection = mysql.createConnection(RunInfoDB.db);
var Bksrconnection = mysql.createConnection(BksrDB.db);



const Eureka = require('eureka-js-client').Eureka;
const client = new Eureka({
    filename: 'eureka-client',
    cwd: __dirname
});

client.start(function(error) {
    console.log(error || 'Node server register completed');
});

app.get('/info',function(req, res){
    res.json({name:'book service',status:'ok'});
} );
app.get('/getreportdata',function(req,res){
    var RunInfoconn = mysql.createConnection(RunInfoDB.db);
    if(typeof eval(req.query.deviceType+"_RunInfojson")!="function"){
        res.json({
            err_code: 400,
            data: "设备类型不存在"
        })
    }else{
        var typeJson=eval(req.query.deviceType+"_RunInfojson"+"()")
        var begintime=req.query.begintime
        var endtime=req.query.endtime
        var deviceNo=req.query.deviceNo
        var cls = [];
        var sql='SELECT deviceNo, createDate ,'
        for( var i in typeJson){
            cls.push(typeJson[i]+" as "+i)
        }
        sql = sql+cls.join(',')+" from RunInfos WHERE  DeviceNo="+deviceNo+" AND CreateDate BETWEEN '"+begintime+"' AND '"+endtime+"'"
        RunInfoconn.query(sql, function(err, results) {
            if (err) return res.json({
                err_code: 1,
                data: '数据不存在',
                affextedRows: 0
            })
            if(results.length>0){
                res.json({
                    err_code: 200,
                    data: results,
                    affextedRows: results.affextedRows
                })
            }else {
                res.json({
                    err_code: 400,
                    data: "数据不存在"
                })
            }
        });
        RunInfoconn.end()
    }
});
app.get('/hello',function(req,res){
    res.json({
        err_code: 200,
        data: "hi",
    })
});

function createDevice(type){
    var strs = type.split('_')
    var path = './util/devices-lib/devices/' + strs.join('/');
    var deviceType = require(path);
    var d = new deviceType();
    return d;
}
function createMap(lang,type) {
    var strs = type.split('_')
    var path = './util/devices-lib/map/' + lang + '/' + strs.join('/');
    var mapType = require(path);
    var d = new mapType();
    return d;
}
lib.DeviceAdapterUtil.InjectFunc(createDevice, createMap)
var map = new HashMap();
var schedule = require('node-schedule');
var RunInfoconnection = mysql.createConnection(RunInfoDB.db);
var Bksrconnection = mysql.createConnection(BksrDB.db);
var  gf = new gfrm.GroupFieldsRelationalMapping;
Bksrconnection.query('select DeviceSuffix,DeviceType from `Device`', function(err, rows) {
    var list;
    for (var i = 0; i < rows.length; i++) {
        map.set(rows[i].DeviceSuffix,rows[i].DeviceType);
    }
    RunInfoconnection.query('select * from `Temp_RunInfos` where Id=1', function(err, rows) {
        if (err) throw err;
        var type_RunInfojson=""
        var type_ExceptionInfosJson=""
        var type_DeviceInfosJson=""
        var deviceType=""
        for (var i = 0; i < rows.length; i++) {
            var byte=rows[i].ByteData
            var no=rows[i].DeviceNo
            if(rows[i].DeviceNo>0){
                var type=map.get(rows[i].DeviceNo)
                var data = lib.DeviceAdapterUtil.getSdcSoftDevice('zh-cn',type, new Uint8Array(byte))

                var array=gf.getSelectFieldsArray()
                for(var s in array){
                    data.getFieldsMap(array[s]).each(function(k,v){
                       if(gf.groupMap.getItem(array[s]).has(v.getName())){
                           console.log(v.getName()+"----"+k+v.getTitle()+v.getValue())
                       }
                    })
                }
                //console.log(data)
            }
        }
        Bksrconnection.end();
        RunInfoconnection.end();
    });
});



function scheduleCronstyle(){
    schedule.scheduleJob('0 1 * * * ?', function(){
        var RunInfoconnection = mysql.createConnection(RunInfoDB.db);
        var Bksrconnection = mysql.createConnection(BksrDB.db);
        Bksrconnection.query('select DeviceSuffix,DeviceType from `Device`', function(err, rows) {
            var list;
            for (var i = 0; i < rows.length; i++) {
                map.set(rows[i].DeviceSuffix,rows[i].DeviceType);
            }
            RunInfoconnection.query('select * from `Temp_RunInfos`', function(err, rows) {
                if (err) throw err;
                var type_RunInfojson=""
                var type_ExceptionInfosJson=""
                var type_DeviceInfosJson=""
                var deviceType=""
                for (var i = 0; i < rows.length; i++) {
                    var byte=rows[i].ByteData
                    var no=rows[i].DeviceNo
                    if(rows[i].DeviceNo>0){
                        var type=map.get(rows[i].DeviceNo)
                        if(typeof(type)!=="undefined"){

                            //运行信息处理
                            try{
                                var data = lib.DeviceAdapterUtil.getSdcSoftDevice('zh-cn',type, new Uint8Array(byte))
                                if(typeof eval(type+"_RunInfojson")=="function"){
                                    type_RunInfojson=eval(type+"_RunInfojson"+"()")
                                    var mock=data.getMockFields()
                                    var  params = []
                                    var cls = [];
                                    var vs = []
                                    cls.push("DeviceNo")
                                    cls.push("CreateDate")
                                    vs.push('?')
                                    vs.push('?')
                                    params.push(rows[i].DeviceNo)
                                    params.push(rows[i].CreateDate)
                                    var sql = 'insert RunInfos('
                                    var sql2 = ' ) values ('
                                    var sql3 = ')'
                                    mock.each(function (k,v) {
                                        cls.push(type_RunInfojson[k])
                                        vs.push('?')
                                        params.push(v.getValue().toFixed(2))
                                    })

                                    sql = sql+cls.join(',')+sql2+vs.join(',')+sql3;
                                    // console.log(sql)

                                    RunInfoconnection.query(sql,params,function(err, result) {
                                        if(err){
                                            console.log(no+type+'[INSERT ERROR] - ',err.message+sql);
                                            return;
                                        }
                                    });
                                }
                            }catch(e){
                                continue;
                            }
                            //设备信息处理
                            try{
                                if(typeof eval(type+"_DeviceInfosJson")=="function"){
                                    type_DeviceInfosJson=eval(type+"_DeviceInfosJson"+"()")
                                    var baseInfo=data.getBaseInfoFields()
                                    var deviceInfo=data.getDeviceFields()
                                    var openCloseInfo=data.getOpenCloseFields()
                                    var  params = []
                                    var cls = [];
                                    var vs = []
                                    cls.push("DeviceNo")
                                    cls.push("CreateDate")
                                    vs.push('?')
                                    vs.push('?')
                                    params.push(rows[i].DeviceNo)
                                    params.push(rows[i].CreateDate)
                                    var sql = 'insert DeviceInfos('
                                    var sql2 = ' ) values ('
                                    var sql3 = ')'
                                    baseInfo.each(function (k,v) {
                                        if(typeof(type_DeviceInfosJson[k])!=="undefined"){
                                            cls.push(type_DeviceInfosJson[k])
                                            vs.push('?')
                                            params.push(v.getValue())
                                        }
                                    })
                                    deviceInfo.each(function (k,v) {
                                        if(typeof(type_DeviceInfosJson[k])!=="undefined"){
                                            cls.push(type_DeviceInfosJson[k])
                                            vs.push('?')
                                            params.push(v.getValue())
                                        }

                                    })
                                    openCloseInfo.each(function (k,v) {
                                        if(typeof(type_DeviceInfosJson[k])!=="undefined"){
                                            cls.push(type_DeviceInfosJson[k])
                                            vs.push('?')
                                            params.push(v.getValue())
                                        }
                                    })

                                    sql = sql+cls.join(',')+sql2+vs.join(',')+sql3;
                                    // console.log(sql)

                                    RunInfoconnection.query(sql,params,function(err, result) {
                                        if(err){
                                            console.log(no+type+'[INSERT ERROR] - ',err.message+sql);
                                            return;
                                        }
                                    });
                                }
                            }catch(e){
                                continue;
                            }
                            //异常信息信息处理
                            var ex=data.getExceptionFields()
                            if(data.getExceptionCount()>0){
                                try{
                                    if(typeof eval(type+"_ExceptionInfosJson")=="function"){
                                        type_ExceptionInfosJson=eval(type+"_ExceptionInfosJson"+"()")
                                        var  params = []
                                        var cls = [];
                                        var vs = []
                                        cls.push("DeviceNo")
                                        cls.push("CreateDate")
                                        vs.push('?')
                                        vs.push('?')
                                        params.push(rows[i].DeviceNo)
                                        params.push(rows[i].CreateDate)
                                        var sql = 'insert ExceptionInfos('
                                        var sql2 = ' ) values ('
                                        var sql3 = ')'
                                        ex.each(function (k,v) {
                                            cls.push(type_ExceptionInfosJson[k])
                                            vs.push('?')
                                            params.push(v.getValue())
                                        })
                                        sql = sql+cls.join(',')+sql2+vs.join(',')+sql3;
                                        // console.log(sql)
                                        RunInfoconnection.query(sql,params,function(err, result) {
                                            if(err){
                                                console.log(no+type+'[INSERT ERROR] - ',err.message+sql);
                                                return;
                                            }
                                        });
                                    }
                                }catch(e){
                                    continue;
                                }
                            }

                        }
                    }
                }
                RunInfoconnection.query('truncate table Temp_RunInfos',function(err, result) {
                    console.log("truncate success");
                    if(err){
                        console.log('[truncate error] - ',err.message+sql);
                        return;
                    }
                });
                Bksrconnection.end();
                RunInfoconnection.end();
            });
        });
    });
}
scheduleCronstyle();



var PLC_YuReZhengQi_DeviceInfosJson= function(){
    var PLC_YuReZhengQi={
        "o_system_status":"col1",
        "ba_shuiweizhuangtai":"col2",
        "ba_ranshaoqizhuangtai":"col3",
        "de_1_addshuibeng_start_stop":"col4",
        "de_2_addshuibeng_start_stop":"col5",
        "de_1_chuyangbeng_start_stop":"col6",
        "de_2_chuyangbeng_start_stop":"col7",
    }
    return PLC_YuReZhengQi
}
var PLC_RanYouZhenKong_DeviceInfosJson= function(){
    var PLC_RanYouZhenKong={
        "o_system_status":"col1",
        "ba_shuiweizhuangtai":"col2",
        "ba_ranshaoqizhuangtai":"col3",
        "de_1_xunhuanbeng_start_stop":"col4",
        "de_2_xunhuanbeng_start_stop":"col5",
        "de_1_addshuibeng_start_stop":"col6",
        "de_2_addshuibeng_start_stop":"col7",
        "de_zhenkongbeng_start_stop":"col8",
    }
    return PLC_RanYouZhenKong
}
var PLC_RanYouZhengQi_DeviceInfosJson= function(){
    var PLC_RanYouZhengQi={
        "o_system_status":"col1",
        "ba_shuiweizhuangtai":"col2",
        "ba_ranshaoqizhuangtai":"col3",
        "de_1_addshuibeng_start_stop":"col4",
        "de_2_addshuibeng_start_stop":"col5",
        "de_1_jienengbeng_start_stop":"col6",
        "de_2_jienengbeng_start_stop":"col7",
        "de_1_chuyangbeng_start_stop":"col8",
        "de_2_chuyangbeng_start_stop":"col9",
        "de_1_zhaoqifengji_start_stop":"col10",
        "de_2_zhaoqifengji_start_stop":"col11",
    }
    return PLC_RanYouZhengQi
}
var PLC_RanYouReShui_DeviceInfosJson= function(){
    var PLC_RanYouReShui={
        "o_system_status":"col1",
        "ba_shuiweizhuangtai":"col2",
        "ba_ranshaoqizhuangtai":"col3",
        "de_1_addshuibeng_start_stop":"col4",
        "de_2_addshuibeng_start_stop":"col5",
        "de_1_xunhuanbeng_start_stop":"col6",
        "de_2_xunhuanbeng_start_stop":"col7",
    }
    return PLC_RanYouReShui
}
var PLC_RanYouDaoReYou_DeviceInfosJson= function(){
    var PLC_RanYouDaoReYou={
        "o_system_status":"col1",
        "ba_shuiweizhuangtai":"col2",
        "ba_ranshaoqizhuangtai":"col3",
        "de_1_xunhuanbeng_start_stop":"col4",
        "de_2_xunhuanbeng_start_stop":"col5",
        "de_3_xunhuanbeng_start_stop":"col6",
        "de_zhuyoubeng_start_stop":"col7"
    }
    return PLC_RanYouDaoReYou
}
var PLC_RanMeiZhengQi_DeviceInfosJson= function(){
    var PLC_RanMeiZhengQi={
        "o_system_status":"col1",
        "ba_shuiweizhuangtai":"col2",
        "ba_ranshaoqizhuangtai":"col3",
        "de_1_yinfengji_start_stop":"col5",
        "de_1_gufengji_start_stop":"col6",
        "de_lupai_start_stop":"col7",
        "de_chuzha_start_stop":"col8",
        "de_1_addshuibeng_start_stop":"col9",
        "de_2_addshuibeng_start_stop":"col10",
        "de_1_chuyangbeng_start_stop":"col11",
        "de_2_chuyangbeng_start_stop":"col12",
    }
    return PLC_RanMeiZhengQi
}
var PLC_DianZhengQi_DeviceInfosJson= function(){
    var PLC_DianZhengQi={
        "o_system_status":"col1",
        "ba_shuiweizhuangtai":"col2",
        "ba_ranshaoqizhuangtai":"col3",
        "de_1_addshuibeng_start_stop":"col4",
        "de_2_addshuibeng_start_stop":"col5",
        "de_1_xunhuanbeng_start_stop":"col6",
        "de_2_xunhuanbeng_start_stop":"col7",
    }
    return PLC_DianZhengQi
}
var PLC_DianReShui_DeviceInfosJson= function(){
    var PLC_DianReShui={
        "o_system_status":"col1",
        "ba_shuiweizhuangtai":"col2",
        "ba_ranshaoqizhuangtai":"col3",
        "de_1_addshuibeng_start_stop":"col4",
        "de_2_addshuibeng_start_stop":"col5",
        "de_1_xunhuanbeng_start_stop":"col6",
        "de_2_xunhuanbeng_start_stop":"col7",
    }
    return PLC_DianReShui
}
var CTL_RT_X6_RYRS_DeviceInfosJson= function(){
    var CTL_RT_X6_RYRS={
        "o_system_status":"col1",
        "oc_ranshaoqiqitingkongzhi":"col2",
        "oc_1_addshuibeng_start_stop":"col3",
        "oc_1_xunhuanbeng_start_stop":"col4",
    }
    return CTL_RT_X6_RYRS
}
var CTL_RT_X1_RYZQ_EDH_6_DeviceInfosJson= function(){
    var CTL_RT_X1_RYZQ_EDH_6={
        "o_system_status":"col1",
        "oc_ranshaoqiqitingkongzhi":"col2",
        "oc_1_addshuibeng_start_stop":"col3",
    }
    return CTL_RT_X1_RYZQ_EDH_6
}
var CTL_RT_X1_RYZQ_EDH_5_DeviceInfosJson= function(){
    var CTL_RT_X1_RYZQ_EDH_5={
        "o_system_status":"col1",
        "oc_ranshaoqiqitingkongzhi":"col2",
        "oc_1_addshuibeng_start_stop":"col3",
    }
    return CTL_RT_X1_RYZQ_EDH_5
}
var CTL_RT_X1_RYRSGW_EDH_DeviceInfosJson= function(){
    var CTL_RT_X1_RYRSGW_EDH={
        "o_system_status":"col1",
        "oc_bushuibengkongzhixinhao":"col2",
        "oc_ranshaoqiqitingkongzhi":"col3",
        "oc_1_reshuibeng_start_stop":"col4",
    }
    return CTL_RT_X1_RYRSGW_EDH
}
var CTL_RT_X1_RYRS_YDH_DeviceInfosJson= function(){
    var CTL_RT_X1_RYRS_YDH={
        "o_system_status":"col1",
        "oc_bushuibengkongzhixinhao":"col2",
        "oc_ranshaoqiqitingkongzhi":"col3",
        "oc_1_addshuibeng_start_stop":"col4",
        "oc_1_reshuibeng_start_stop":"col5",
    }
    return CTL_RT_X1_RYRS_YDH
}
var CTL_RT_X1_RYRS_EDH_DeviceInfosJson= function(){
    var CTL_RT_X1_RYRS_EDH={
        "o_system_status":"col1",
        "oc_ranshaoqiqitingkongzhi":"col2",
        "oc_1_reshuibeng_start_stop":"col3",
        "oc_bushuibengkongzhixinhao":"col4",
    }
    return CTL_RT_X1_RYRS_EDH
}
var CTL_RT_X1_RYKS_YDH_DeviceInfosJson= function(){
    var CTL_RT_X1_RYKS_YDH={
        "o_system_status":"col1",
        "oc_ranshaoqiqitingkongzhi":"col2",
        "oc_1_addshuibeng_start_stop":"col3",
        "oc_1_reshuibeng_start_stop":"col4",
    }
    return CTL_RT_X1_RYKS_YDH
}
var CTL_RT_X1_RYCYRS_EDH_DeviceInfosJson= function(){
    var CTL_RT_X1_RYCYRS_EDH={
        "o_system_status":"col1",
        "oc_ranshaoqiqitingkongzhi":"col2",
        "oc_1_reshuibeng_start_stop":"col3",
    }
    return CTL_RT_X1_RYCYRS_EDH
}
var CTL_RT_X1_DZQ_DeviceInfosJson= function(){
    var CTL_RT_X1_DZQ={
        "o_system_status":"col1",
        "oc_jiarezu1kongzhi":"col2",
        "oc_jiarezu2kongzhi":"col3",
        "oc_1_addshuibeng_start_stop":"col4"
    }
    return CTL_RT_X1_DZQ
}
var CTL_RT_X1_DRS_DeviceInfosJson= function(){
    var CTL_RT_X1_DRS={
        "o_system_status":"col1",
        "oc_bushuibengkongzhixinhao":"col2",
        "oc_jiarezu1kongzhi":"col3",
        "oc_jiarezu2kongzhi":"col4",
        "oc_1_reshuibeng_start_stop":"col5",
    }
    return CTL_RT_X1_DRS
}
var CTL_RT_T4_RYZQ_4_DeviceInfosJson= function(){
    var CTL_RT_T4_RYZQ_4={
        "o_system_status":"col1",
        "oc_1_addshuibeng_start_stop":"col2",
        "oc_2_addshuibeng_start_stop":"col3",
        "oc_1_lengningxunhuanbeng_start_stop":"col4",
        "oc_ranshaoqiqitingkongzhi":"col5",
    }
    return CTL_RT_T4_RYZQ_4
}
var CTL_RT_T3_RYZQ_YLKZQ_DeviceInfosJson= function(){
    var CTL_RT_T3_RYZQ_YLKZQ={
        "o_system_status":"col1",
        "oc_1_addshuibeng_start_stop":"col2",
        "oc_2_addshuibeng_start_stop":"col3",
        "oc_1_lengningxunhuanbeng_start_stop":"col4",
        "oc_ranshaoqiqitingkongzhi":"col5",
    }
    return CTL_RT_T3_RYZQ_YLKZQ
}
var CTL_RT_T3_RYZQ_YLBSQ_DeviceInfosJson= function(){
    var CTL_RT_T3_RYZQ_YLBSQ={
        "o_system_status":"col1",
        "oc_1_addshuibeng_start_stop":"col2",
        "oc_2_addshuibeng_start_stop":"col3",
        "oc_1_lengningxunhuanbeng_start_stop":"col4",
        "oc_ranshaoqiqitingkongzhi":"col5",
    }
    return CTL_RT_T3_RYZQ_YLBSQ
}
var CTL_RT_T2_RYZQ_YLKZQ_190244133_DeviceInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLKZQ_190244133={
        "o_system_status":"col1",
        "oc_1_addshuibeng_start_stop":"col2",
        "oc_2_addshuibeng_start_stop":"col3",
        "oc_1_lengningxunhuanbeng_start_stop":"col4",
        "oc_ranshaoqiqitingkongzhi":"col5",

    }
    return CTL_RT_T2_RYZQ_YLKZQ_190244133
}
var CTL_RT_T2_RYZQ_YLKZQ_180839008_DeviceInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLKZQ_180839008={
        "o_system_status":"col1",
        "oc_1_addshuibeng_start_stop":"col2",
        "oc_2_addshuibeng_start_stop":"col3",
        "oc_1_lengningxunhuanbeng_start_stop":"col4",
        "oc_ranshaoqiqitingkongzhi":"col5",

    }
    return CTL_RT_T2_RYZQ_YLKZQ_180839008
}
var CTL_RT_T2_RYZQ_YLKZQ_180436007_DeviceInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLKZQ_180436007={
        "o_system_status":"col1",
        "oc_1_addshuibeng_start_stop":"col2",
        "oc_2_addshuibeng_start_stop":"col3",
        "oc_1_lengningxunhuanbeng_start_stop":"col4",
        "oc_ranshaoqiqitingkongzhi":"col5",

    }
    return CTL_RT_T2_RYZQ_YLKZQ_180436007
}
var CTL_RT_T2_RYZQ_YLKZQ_171013102_DeviceInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLKZQ_171013102={
        "o_system_status":"col1",
        "oc_1_addshuibeng_start_stop":"col2",
        "oc_2_addshuibeng_start_stop":"col3",
        "oc_1_lengningxunhuanbeng_start_stop":"col4",
        "oc_ranshaoqiqitingkongzhi":"col5",

    }
    return CTL_RT_T2_RYZQ_YLKZQ_171013102
}
var CTL_RT_T2_RYZQ_YLKZQ_DeviceInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLKZQ={
        "o_system_status":"col1",
        "oc_1_addshuibeng_start_stop":"col2",
        "oc_2_addshuibeng_start_stop":"col3",
        "oc_1_lengningxunhuanbeng_start_stop":"col4",
        "oc_ranshaoqiqitingkongzhi":"col5",

    }
    return CTL_RT_T2_RYZQ_YLKZQ
}
var CTL_RT_T2_RYZQ_YLBSQ_190244133_DeviceInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLBSQ_190244133={
        "o_system_status":"col1",
        "oc_ranshaoqiqitingkongzhi":"col2",
        "oc_1_addshuibeng_start_stop":"col3",
        "oc_2_addshuibeng_start_stop":"col4",
        "oc_1_lengningxunhuanbeng_start_stop":"col5",
    }
    return CTL_RT_T2_RYZQ_YLBSQ_190244133
}
var CTL_RT_T2_RYZQ_YLBSQ_180839008_DeviceInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLBSQ_180839008={
        "o_system_status":"col1",
        "oc_ranshaoqiqitingkongzhi":"col2",
        "oc_1_addshuibeng_start_stop":"col3",
        "oc_2_addshuibeng_start_stop":"col4",
        "oc_1_lengningxunhuanbeng_start_stop":"col5",
    }
    return CTL_RT_T2_RYZQ_YLBSQ_180839008
}
var CTL_RT_T2_RYZQ_YLBSQ_180436007_DeviceInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLBSQ_180436007={
        "o_system_status":"col1",
        "oc_ranshaoqiqitingkongzhi":"col2",
        "oc_1_addshuibeng_start_stop":"col3",
        "oc_2_addshuibeng_start_stop":"col4",
        "oc_1_lengningxunhuanbeng_start_stop":"col5",
    }
    return CTL_RT_T2_RYZQ_YLBSQ_180436007
}
var CTL_RT_T2_RYZQ_YLBSQ_171013102_DeviceInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLBSQ_171013102={
        "o_system_status":"col1",
        "oc_ranshaoqiqitingkongzhi":"col2",
        "oc_1_addshuibeng_start_stop":"col3",
        "oc_2_addshuibeng_start_stop":"col4",
        "oc_1_lengningxunhuanbeng_start_stop":"col5",
    }
    return CTL_RT_T2_RYZQ_YLBSQ_171013102
}
var CTL_RT_T2_RYZQ_YLBSQ_DeviceInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLBSQ={
        "o_system_status":"col1",
        "oc_1_addshuibeng_start_stop":"col2",
        "oc_2_addshuibeng_start_stop":"col3",
        "oc_1_lengningxunhuanbeng_start_stop":"col4",
    }
    return CTL_RT_T2_RYZQ_YLBSQ
}
var CTL_RT_T2_RYRS_18126024_DeviceInfosJson= function(){
    var CTL_RT_T2_RYRS_18126024={
        "o_system_status":"col1",
        "oc_1_addshuibeng_start_stop":"col2",
        "oc_2_addshuibeng_start_stop":"col3",
        "oc_1_lengningxunhuanbeng_start_stop":"col4",
        "oc_2_lengningxunhuanbeng_start_stop":"col5",
    }
    return CTL_RT_T2_RYRS_18126024
}
var CTL_RT_H1_RYZQ_DeviceInfosJson= function(){
    var CTL_RT_H1_RYZQ={
        "o_system_status":"col1",
        "oc_1_addshuibeng_start_stop":"col2",
        "oc_2_addshuibeng_start_stop":"col3",
    }
    return CTL_RT_H1_RYZQ
}
var CTL_HNWE_485_DeviceInfosJson= function(){
    var CTL_HNWE_485={
        "o_system_status":"col1",
        "oc_fengji":"col2",
        "oc_shuibeng":"col3",
        "级联泵":"col4",
    }
    return CTL_HNWE_485
}
var CTL_RT_H1_RYRS_DeviceInfosJson= function(){
    var CTL_RT_H1_RYRS={
        "o_system_status":"col1",
        "燃烧器启停控制":"col2"
    }
    return CTL_RT_H1_RYRS
}





var PLC_YuReZhengQi_ExceptionInfosJson= function(){
    var PLC_YuReZhengQi={
        "ex_shuiweiweidibaojingdianji":"col1",
        "ex_shuiweijidibaojingdianji":"col2",
        "ex_shuiweijigaobaojingdianji":"col3",
        "ex_shuiweijidibaojingshedingzhi":"col4",
        "ex_shuiweijigaobaojingshedingzhi":"col5",
        "ex_chaoyabaojingyalikaiguan":"col6",
        "ex_chaoyabaojingshedingzhi":"col7",
        "ex_paiyanchaowenbaojing":"col8",
        "ex_ruanshuixiangqueshuibaojing":"col9",
        "ex_shuidianjiluojicuobaojing":"col10",
        "ex_yalibiansongqiguzhangbaojing":"col11",
        "ex_shuiweibiansongqiguzhangbaojing":"col12",
        "ex_paiyanwenduchuanganqiguzhangbaojing":"col13",
        "ex_chuyangqiqueshuibaojing":"col14",
        "ex_chuyangqigaoshuiweibaojing":"col15",
        "ex_addshuibengbianpinqiguzhang":"col16",
        "ex_chuyangbengbianpinqiguzhang":"col17",
        "ex_bushuibeng1guzhang":"col18",
        "ex_bushuibeng2guzhang":"col19",
        "ex_chuyangbeng1guzhang":"col20",
        "ex_chuyangbeng2guzhang":"col21"
    }
    return PLC_YuReZhengQi
}
var PLC_RanYouZhenKong_ExceptionInfosJson= function(){
    var PLC_RanYouZhenKong={
        "ex_lubichaowenbaojing":"col1",
        "ex_remeishuiwenduchuanganqiguzhang":"col2",
        "ex_paiyanwenduchuanganqiguzhang":"col3",
        "ex_cainuanchushuiwenduchuanganqiguzhang":"col4",
        "ex_shenghuochushuiwenduchuanganqiguzhang":"col5",
        "ex_wendushedingcuowubaojing":"col6",
        "ex_xunhuanbengliansuoduankaibaojing":"col7",
        "ex_waibuliansuoduankaibaojing":"col8",
        "ex_ranshaojiguzhang":"col9",
        "ex_ranqixielou":"col10",
        "ex_ranqiyaliyichang":"col11",
        "ex_luneiyaligaobaojingshedingzhi":"col12",
        "ex_luneiyaligaobaojingyalikaiguan":"col13",
        "ex_paiyanwenduchaogaobaojing":"col14",
        "ex_remeishuiwenduchaogaobaojing":"col15",
        "ex_queshuibaohubaojing":"col16",

    }
    return PLC_RanYouZhenKong
}
var PLC_RanYouZhengQi_ExceptionInfosJson= function(){
    var PLC_RanYouZhengQi={
        "ex_chaoyabaojingyalikaiguan":"col1",
        "ex_chaoyabaojingshedingzhi":"col2",
        "ex_paiyanchaowenbaojing":"col3",
        "ex_ruanshuixiangqueshuibaojing":"col4",
        "ex_shuidianjiluojicuobaojing":"col5",
        "ex_yalibiansongqiguzhangbaojing":"col6",
        "ex_shuiweibiansongqiguzhangbaojing":"col7",
        "ex_paiyanwenduchuanganqiguzhangbaojing":"col8",
        "ex_ranshaoqiguzhang":"col9",
        "ex_ranqixielou":"col10",
        "ex_ranqiyaliyichang":"col11",
        "ex_shuiweiweidibaojingdianji":"col12",
        "ex_shuiweijidibaojingdianji":"col13",
        "ex_shuiweijigaobaojingdianji":"col14",
        "ex_shuiweijidibaojingshedingzhi":"col15",
        "ex_shuiweijigaobaojingshedingzhi":"col16",
        "ex_addshuibeng1guzhang":"col17",
        "ex_addshuibeng2guzhang":"col18",
        "ex_zhaoqifengjibianpinqiguzhang":"col19",
        "ex_chuyangqiqueshuibaojing":"col20",
        "ex_chuyangqigaoshuiweibaojing":"col21",
        "ex_addshuibengbianpinqiguzhang":"col22",
        "ex_chuyangbengbianpinqiguzhang":"col23",
        "ex_zhufengjibianpinqiguzhang":"col24",
        "ex_xunhuanfengjibianpinqiguzhang":"col25",
        "ex_jienengbeng1guzhang":"col26",
        "ex_jienengbeng2guzhang":"col27",

    }
    return PLC_RanYouZhengQi
}
var PLC_RanYouReShui_ExceptionInfosJson= function(){
    var PLC_RanYouReShui={
        "ex_lubichaowenbaojing":"col1",
        "ex_chushuiwenduchuanganqiguzhang":"col2",
        "ex_huishuiwenduchuanganqiguzhang":"col3",
        "ex_paiyanwenduchuanganqiguzhang":"col4",
        "ex_wendushedingcuowubaojing":"col5",
        "ex_xunhuanbengliansuoduankaibaojing":"col6",
        "ex_waibuliansuoduankaibaojing":"col7",
        "ex_chushuiyalibiansongqiguzhang":"col8",
        "ex_ranshaojiguzhang":"col9",
        "ex_ranqixielou":"col10",
        "ex_ranqiyaliyichang":"col11",
        "ex_yalichaogaobaojing":"col12",
        "ex_yalichaodibaojing":"col13",
        "ex_paiyanwenduchaogaobaojing":"col14",
        "ex_chushuiwenduchaogaobaojing":"col15",
        "ex_queshuibaohubaojing":"col16",
        "ex_huishuiyalibiansongqiguzhang":"col17",
    }
    return PLC_RanYouReShui
}
var PLC_RanYouDaoReYou_ExceptionInfosJson= function(){
    var PLC_RanYouDaoReYou={
        "ex_ranshaoqiguzhang":"col1",
        "ex_ranqixielou":"col2",
        "ex_ranqiyaliyichang":"col3",
        "ex_fengjiguzhang":"col4",
        "ex_1_xunhuanbengguzhang":"col5",
        "ex_2_xunhuanbengguzhang":"col6",
        "ex_3_xunhuanbengguzhang":"col7",
        "ex_zhuyoubengguzhang":"col8",
        "ex_jinchukouyachachaogao":"col9",
        "ex_jinchukouyachachaodi":"col10",
        "ex_paiyanwenduchaogao":"col11",
        "ex_chukouwenduchaogao":"col12",
        "ex_liuliangxiaxianbaojing":"col13",
        "ex_liuliangjidibaojing":"col14",
        "ex_queyoubaojingfuqiu":"col15",
        "ex_chuyouwenduchuanganqibaojing":"col16",
        "ex_huiyouwenduchuanganqibaojing":"col17",
        "ex_paiyanwenduchuanganqiguzhang":"col18",
        "ex_xunhuanbengliansuoguzhang":"col19",
        "ex_wendushedingcuowuguzhang":"col20",
        "ex_gaoweiyoucaoyouweidibaojing":"col21",
        "ex_gaoweiyoucaoyouweigaobaojing":"col22",
        "ex_1_zhiguanchaowenbaojing":"col23",
        "ex_2_zhiguanchaowenbaojing":"col24",
        "ex_3_zhiguanchaowenbaojing":"col25",
        "ex_4_zhiguanchaowenbaojing":"col26",
        "ex_5_zhiguanchaowenbaojing":"col27",
        "ex_6_zhiguanchaowenbaojing":"col28",
        "ex_7_zhiguanchaowenbaojing":"col29",
        "ex_8_zhiguanchaowenbaojing":"col30",
        "ex_9_zhiguanchaowenbaojing":"col31",
        "ex_10_zhiguanchaowenbaojing":"col32",
        "ex_plcguzhangbaojing":"col33",
    }
    return PLC_RanYouDaoReYou
}
var PLC_RanMeiZhengQi_ExceptionInfosJson= function(){
    var PLC_RanMeiZhengQi={
        "ex_shuiweijidibaojing_shedingzhi":"col1",
        "ex_shuiweijigaobaojing_shedingzhi":"col2",
        "ex_chaoyabaojing_yalikaiguan":"col3",
        "ex_chaoyabaojing_shedingzhi":"col4",
        "ex_paiyanchaowenbaojing":"col5",
        "ex_ruanshuixiangqueshuibaojing":"col6",
        "ex_shuidianjiluojicuobaojing":"col7",
        "ex_yalibiansongqiguzhangbaojing":"col8",
        "ex_yinfengjibianpinqiguzhang":"col9",
        "ex_gufengjibianpinqiguzhang":"col10",
        "ex_lupaibianpinqiguzhang":"col11",
        "ex_chuzhabianpinqiguzhang":"col12",
        "ex_jishuibianpinqiguzhang":"col13",
        "ex_shuiweiweidibaojing":"col14",
        "ex_shuiweijidibaojing_dianji":"col15",
        "ex_shuiweijigaobaojing_dianji":"col16",
        "ex_shuiweibiansongqiguzhangbaojing":"col17",
        "ex_paiyanwenduchuanganqiguzhangbaojing":"col18",
        "ex_chuyangqiqueshuibaojing":"col19",
        "ex_chuyangqigaoshuiweibaojing":"col20",
    }
    return PLC_RanMeiZhengQi
}
var PLC_DianZhengQi_ExceptionInfosJson= function(){
    var PLC_DianZhengQi={
        "ex_shuidianjiluojicuobaojing":"col1",
        "ex_yalibiansongqiguzhangbaojing":"col2",
        "ex_shuiweibiansongqiguzhangbaojing":"col3",
        "ex_geishuibengbianpinqiguzhang":"col4",
        "ex_loudianbaojing":"col5",
        "ex_qianyabaojing":"col6",
        "ex_shuiweiweidibaojing_dianji":"col7",
        "ex_shuiweijidibaojing_dianji":"col8",
        "ex_shuiweijigaobaojing_dianji":"col9",
        "ex_shuiweijidibaojing_shedingzhi":"col10",
        "ex_shuiweijigaobaojing_shedingzhi":"col11",
        "ex_chaoyabaojing_yalikaiguan":"col12",
        "ex_chaoyabaojing_shedingzhi":"col13",
        "ex_ruanshuixiangqueshuibaojing":"col14",
    }
    return PLC_DianZhengQi
}
var PLC_DianReShui_ExceptionInfosJson= function(){
    var PLC_DianReShui={
        "ex_shuiweijidibaojing（dianji）":"col1",
        "ex_xitongchaoyabaojing（shedingzhi）":"col2",
        "ex_xitongyalidibaojing（shedingzhi）":"col3",
        "ex_xitongchaoyabaojing（dianjiedianyalibiao）":"col4",
        "ex_xitongyalidibaojing（dianjiedianyalibiao）":"col5",
        "ex_chushuiwenduchuanganqiguzhang":"col6",
        "ex_huishuiwenduchuanganqiguzhang":"col7",
        "ex_chushuiyalibiansongqiguzhang":"col8",
        "ex_huishuiyalibiansongqiguzhang":"col9",
        "ex_lubichaowenbaojing":"col10",
        "ex_waibuliansuoduankaibaojing":"col11",
        "ex_xunhuanbengliansuoduankaibaojing":"col12",
        "ex_loudianbaojing":"col13",
        "ex_qianyabaojing":"col14",
        "ex_chushuichaowenbaojing":"col15",
        "ex_wendushedingcuowubaojing":"col16",
        "ex_Axiangguoliubaojing":"col17",
        "ex_Bxiangguoliubaojing":"col18",
        "ex_Cxiangguoliubaojing":"col19"
    }
    return PLC_DianReShui
}
var CTL_RT_X6_RYRS_ExceptionInfosJson= function(){
    var CTL_RT_X6_RYRS={
        "ex_jixiandishuiweibao":"col1",
        "ex_lubichaowen_changbiduankaibaojing_":"col2",
        "ex_ranshaoqiguzhangbaojing":"col3",
        "ex_chushuiwenduchuanganqibaojing":"col4",
        "ex_huishuiwenduchuanganqibaojing":"col5",
        "ex_paiyanwenduchuanganqibaojing":"col6",
        "ex_chushuiwendugaobaojing":"col7",
        "ex_shuiweichuanganqiguzhang":"col8",
        "ex_paiyanwendugaobaojing":"col9",
        "":"col10"
    }
    return CTL_RT_X6_RYRS
}
var CTL_RT_X1_RYZQ_EDH_6_ExceptionInfosJson= function(){
    var CTL_RT_X1_RYZQ_EDH_6={
        "ex_jixiandishuiweibaojing":"col1",
        "ex_gaoshuiweibaojing":"col2",
        "ex_shuiweichuanganqiguzhang":"col3",
        "ex_paiyanwenduchuanganqiguzhang":"col4",
        "ex_paiyanwendugao":"col5",
        "ex_chaoyabaojing":"col6",
        "ex_ranshaoqiguzhangbaojing":"col7",
    }
    return CTL_RT_X1_RYZQ_EDH_6
}
var CTL_RT_X1_RYZQ_EDH_5_ExceptionInfosJson= function(){
    var CTL_RT_X1_RYZQ_EDH_5={
        "ex_jixiandishuiweibaojing":"col1",
        "ex_gaoshuiweibaojing":"col2",
        "ex_shuiweichuanganqiguzhang":"col3",
        "ex_paiyanwenduchuanganqiguzhang":"col4",
        "ex_paiyanwendugao":"col5",
        "ex_chaoyabaojing":"col6",
        "ex_ranshaoqiguzhangbaojing":"col7",
    }
    return CTL_RT_X1_RYZQ_EDH_5
}
var CTL_RT_X1_RYRSGW_EDH_ExceptionInfosJson= function(){
    var CTL_RT_X1_RYRSGW_EDH={
        "ex_jixiandishuiweibaojing":"col1",
        "ex_chushuiwenduchuanganqiguzhang":"col2",
        "ex_chushuiwendugaobaojing":"col3",
        "ex_shuiweichuanganqiguzhang":"col4",
        "ex_chaoyabaojing":"col5",
        "ex_lubichaowenbaojing":"col6",
        "ex_ranshaoqiguzhangbaojing":"col7",

    }
    return CTL_RT_X1_RYRSGW_EDH
}
var CTL_RT_X1_RYRS_YDH_ExceptionInfosJson= function(){
    var CTL_RT_X1_RYRS_YDH={
        "ex_jixiandishuiweibaojing":"col1",
        "ex_chushuiwenduchuanganqiguzhang":"col2",
        "ex_chushuiwendugaobaojing":"col3",
        "ex_shuiweichuanganqiguzhang":"col4",
        "ex_chaoyabaojing":"col5",
        "ex_lubichaowenbaojing":"col6",
        "ex_ranshaoqiguzhangbaojing":"col7",
    }
    return CTL_RT_X1_RYRS_YDH
}
var CTL_RT_X1_RYRS_EDH_ExceptionInfosJson= function(){
    var CTL_RT_X1_RYRS_EDH={
        "ex_jixiandishuiweibaojing":"col1",
        "ex_chushuiwenduchuanganqiguzhang ":"col2",
        "ex_chushuiwendugaobaojing":"col3",
        "ex_shuiweichuanganqiguzhang":"col4",
        "ex_chaoyabaojing":"col5",
        "ex_lubichaowenbaojing":"col6",
        "ex_ranshaoqiguzhangbaojing":"col7",

    }
    return CTL_RT_X1_RYRS_EDH
}
var CTL_RT_X1_RYKS_YDH_ExceptionInfosJson= function(){
    var CTL_RT_X1_RYKS_YDH={
        "ex_jixiandishuiweibaojing":"col1",
        "ex_shuiweichuanganqiguzhang":"col2",
        "ex_chushuiwenduchuanganqiguzhang":"col3",
        "ex_chushuiwendugaobaojing":"col4",
        "ex_lubichaowenbaojing":"col5",
        "ex_ranshaoqiguzhangbaojing":"col6",
    }
    return CTL_RT_X1_RYKS_YDH
}
var CTL_RT_X1_RYCYRS_EDH_ExceptionInfosJson= function(){
    var CTL_RT_X1_RYCYRS_EDH={
        "ex_jixiandishuiweibaojing":"col1",
        "ex_chushuiwenduchuanganqiguzhang":"col2",
        "ex_chushuiwendugaobaojing":"col3",
        "ex_lubichaowenbaojing":"col4",
        "ex_ranshaoqiguzhangbaojing":"col5",
    }
    return CTL_RT_X1_RYCYRS_EDH
}
var CTL_RT_X1_DZQ_ExceptionInfosJson= function(){
    var CTL_RT_X1_DZQ={
        "ex_jixiandishuiweibaojing":"col1",
        "ex_gaoshuiweibaojing":"col2",
        "ex_shuiweichuanganqiguzhang":"col3",
        "ex_chaoyabaojing":"col4",
    }
    return CTL_RT_X1_DZQ
}
var CTL_RT_X1_DRS_ExceptionInfosJson= function(){
    var CTL_RT_X1_DRS={
        "ex_jixiandishuiweibaojing":"col1",
        "ex_chushuiwenduchuanganqiguzhang":"col2",
        "ex_chushuiwendugaobaojing":"col3",
        "ex_shuiweichuanganqiguzhang":"col4",
        "ex_chaoyabaojing":"col5",
        "ex_lubichaowenbaojing":"col6",
    }
    return CTL_RT_X1_DRS
}
var CTL_RT_T4_RYZQ_4_ExceptionInfosJson= function(){
    var CTL_RT_T4_RYZQ_4={
        "ex_zhengqiyalibiansongqiguzhang":"col1",
        "ex_paiyanwenduchuanganqiguzhang":"col2",
        "ex_paiyanwendugaobaojing":"col3",
        "ex_shuiweichuanganqiguzhang":"col4",
        "ex_chaoyabaojing":"col5",
        "ex_gaoshuiweibaojing":"col6",
        "ex_jixiandishuiweibaojing":"col7",
        "ex_bianpinqiguzhang":"col8",
        "ex_ranshaoqiguzhang":"col9",
        "ex_qingranshaoqifuwei":"col10",
        "ex_xitongguzhang":"col11",
        "ex_cunchuqiguzhang":"col12",
    }
    return CTL_RT_T4_RYZQ_4
}
var CTL_RT_T3_RYZQ_YLKZQ_ExceptionInfosJson= function(){
    var CTL_RT_T3_RYZQ_YLKZQ={
        "ex_shuiweichuanganqiduanlu1":"col1",
        "ex_shuiweichuanganqiduanlu":"col2",
        "ex_jixiandishuiweibaojing_dianliu_":"col3",
        "ex_gaoshuiweibaojing_dianliu_":"col4",
        "ex_paiyanwendugaobaojing":"col5",
        "ex_jixiandishuiweibaojing":"col6",
        "ex_shuiweidianjiluojicuo":"col7",
        "ex_dishuiweibaojing":"col8",
        "ex_gaoshuiweibaojing":"col9",
        "ex_bianpinqiguzhang":"col10",
        "ex_chaoyabaojing_kongzhiqi_":"col11",
        "ex_ranqiyalidibaojing":"col12",
        "ex_ranqiyaligaobaojing":"col13",
        "ex_ranqixieloubaojing":"col14",
        "ex_ranshaoqiguzhang":"col15"
    }
    return CTL_RT_T3_RYZQ_YLKZQ
}
var CTL_RT_T3_RYZQ_YLBSQ_ExceptionInfosJson= function(){
    var xxx={
        "ex_yalibiansongqiduanlu1":"col1",
        "ex_yalibiansongqiduanlu":"col2",
        "ex_chaoyabaojing_biansongqi_":"col3",
        "ex_shuiweichuanganqiduanlu1":"col4",
        "ex_shuiweichuanganqiduanlu":"col5",
        "ex_jixiandishuiweibaojing_dianliu_":"col6",
        "ex_gaoshuiweibaojing_dianliu_":"col7",
        "ex_paiyanwendugaobaojing":"col8",
        "ex_jixiandishuiweibaojing":"col9",
        "ex_shuiweidianjiluojicuo":"col10",
        "ex_dishuiweibaojing":"col11",
        "ex_gaoshuiweibaojing":"col12",
        "ex_bianpinqiguzhang":"col13",
        "ex_chaoyabaojing_kongzhiqi_":"col14",
        "ex_ranqiyalidibaojing":"col15",
        "ex_ranqiyaligaobaojing":"col16",
        "ex_ranqixieloubaojing":"col17",
        "ex_ranshaoqiguzhang":"col18"
    }
    return CTL_RT_T3_RYZQ_YLBSQ
}
var CTL_RT_T2_RYZQ_YLKZQ_190244133_ExceptionInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLKZQ_190244133={
        "ex_yalibiansongqiduanlu1":"col1",
        "ex_yalibiansongqiduanlu":"col2",
        "ex_chaoyabaojing_biansongqi_":"col3",
        "ex_shuiweichuanganqiduanlu1":"col4",
        "ex_shuiweichuanganqiduanlu":"col5",
        "ex_jixiandishuiweibaojing_dianliu_":"col6",
        "ex_gaoshuiweibaojing_dianliu_":"col7",
        "ex_paiyanwendugaobaojing":"col8",
        "ex_jixiandishuiweibaojing":"col9",
        "ex_shuiweidianjiluojicuo":"col10",
        "ex_dishuiweibaojing":"col11",
        "ex_gaoshuiweibaojing":"col12",
        "ex_bianpinqiguzhang":"col13",
        "ex_chaoyabaojing_kongzhiqi_":"col14",
        "ex_ranqiyalidibaojing":"col15",
        "ex_ranqiyaligaobaojing":"col16",
        "ex_ranqixieloubaojing":"col17",
        "ex_ranshaoqiguzhang":"col18",

    }
    return CTL_RT_T2_RYZQ_YLKZQ_190244133
}
var CTL_RT_T2_RYZQ_YLKZQ_171013102_ExceptionInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLKZQ_171013102={
        "ex_shuiweichuanganqiduanlu1":"col1",
        "ex_shuiweichuanganqiduanlu":"col2",
        "ex_jixiandishuiweibaojing_dianliu_":"col3",
        "ex_gaoshuiweibaojing_dianliu_":"col4",
        "ex_paiyanwendugaobaojing":"col5",
        "ex_jixiandishuiweibaojing":"col6",
        "ex_shuiweidianjiluojicuo":"col7",
        "ex_dishuiweibaojing":"col8",
        "ex_gaoshuiweibaojing":"col9",
        "ex_bianpinqiguzhang":"col10",
        "ex_chaoyabaojing_kongzhiqi_":"col11",
        "ex_ranqiyalidibaojing":"col12",
        "ex_ranqiyaligaobaojing":"col13",
        "ex_ranqixieloubaojing":"col14",
        "ex_ranshaoqiguzhang":"col15"
    }
    return CTL_RT_T2_RYZQ_YLKZQ_171013102
}
var CTL_RT_T2_RYZQ_YLKZQ_180436007_ExceptionInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLKZQ_180436007={
        "ex_shuiweichuanganqiduanlu1":"col1",
        "ex_shuiweichuanganqiduanlu":"col2",
        "ex_jixiandishuiweibaojing_dianliu_":"col3",
        "ex_gaoshuiweibaojing_dianliu_":"col4",
        "ex_paiyanwendugaobaojing":"col5",
        "ex_jixiandishuiweibaojing":"col6",
        "ex_shuiweidianjiluojicuo":"col7",
        "ex_dishuiweibaojing":"col8",
        "ex_gaoshuiweibaojing":"col9",
        "ex_bianpinqiguzhang":"col10",
        "ex_chaoyabaojing_kongzhiqi_":"col11",
        "ex_ranqiyalidibaojing":"col12",
        "ex_ranqiyaligaobaojing":"col13",
        "ex_ranqixieloubaojing":"col14",
        "ex_ranshaoqiguzhang":"col15"
    }
    return CTL_RT_T2_RYZQ_YLKZQ_180436007
}
var CTL_RT_T2_RYZQ_YLKZQ_180839008_ExceptionInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLKZQ_180839008={
        "ex_shuiweichuanganqiduanlu1":"col1",
        "ex_shuiweichuanganqiduanlu":"col2",
        "ex_jixiandishuiweibaojing_dianliu_":"col3",
        "ex_gaoshuiweibaojing_dianliu_":"col4",
        "ex_paiyanwendugaobaojing":"col5",
        "ex_jixiandishuiweibaojing":"col6",
        "ex_shuiweidianjiluojicuo":"col7",
        "ex_dishuiweibaojing":"col8",
        "ex_gaoshuiweibaojing":"col9",
        "ex_bianpinqiguzhang":"col10",
        "ex_chaoyabaojing_kongzhiqi_":"col11",
        "ex_ranqiyalidibaojing":"col12",
        "ex_ranqiyaligaobaojing":"col13",
        "ex_ranqixieloubaojing":"col14",
        "ex_ranshaoqiguzhang":"col15"
    }
    return CTL_RT_T2_RYZQ_YLKZQ_180839008
}
var CTL_RT_T2_RYZQ_YLKZQ_ExceptionInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLKZQ={
        "ex_shuiweichuanganqiduanlu1":"col1",
        "ex_shuiweichuanganqiduanlu":"col2",
        "ex_jixiandishuiweibaojing_dianliu_":"col3",
        "ex_gaoshuiweibaojing_dianliu_":"col4",
        "ex_paiyanwendugaobaojing":"col5",
        "ex_jixiandishuiweibaojing":"col6",
        "ex_shuiweidianjiluojicuo":"col7",
        "ex_dishuiweibaojing":"col8",
        "ex_gaoshuiweibaojing":"col9",
        "ex_bianpinqiguzhang":"col10",
        "ex_chaoyabaojing_kongzhiqi_":"col11",
        "ex_ranqiyalidibaojing":"col12",
        "ex_ranqiyaligaobaojing":"col13",
        "ex_ranqixieloubaojing":"col14",
        "ex_ranshaoqiguzhang":"col15",
        "ex_jixiandishuiweibaojing2":"col16",
    }
    return CTL_RT_T2_RYZQ_YLKZQ
}
var CTL_RT_T2_RYZQ_YLBSQ_171013102_ExceptionInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLBSQ_171013102={
        "ex_yalibiansongqiduanlu1":"col1",
        "ex_yalibiansongqiduanlu":"col2",
        "ex_chaoyabaojing_biansongqi_":"col3",
        "ex_shuiweichuanganqiduanlu1":"col4",
        "ex_shuiweichuanganqiduanlu":"col5",
        "ex_jixiandishuiweibaojing_dianliu_":"col6",
        "ex_gaoshuiweibaojing_dianliu_":"col7",
        "ex_paiyanwendugaobaojing":"col8",
        "ex_jixiandishuiweibaojing":"col9",
        "ex_shuiweidianjiluojicuo":"col10",
        "ex_dishuiweibaojing":"col11",
        "ex_gaoshuiweibaojing":"col12",
        "ex_bianpinqiguzhang":"col13",
        "ex_chaoyabaojing_kongzhiqi_":"col14",
        "ex_ranqiyalidibaojing":"col15",
        "ex_ranqiyaligaobaojing":"col16",
        "ex_ranqixieloubaojing":"col17",
        "ex_ranshaoqiguzhang":"col18",
    }
    return CTL_RT_T2_RYZQ_YLBSQ_171013102
}
var CTL_RT_T2_RYZQ_YLBSQ_180436007_ExceptionInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLBSQ_180436007={
        "ex_yalibiansongqiduanlu1":"col1",
        "ex_yalibiansongqiduanlu":"col2",
        "ex_chaoyabaojing_biansongqi_":"col3",
        "ex_shuiweichuanganqiduanlu1":"col4",
        "ex_shuiweichuanganqiduanlu":"col5",
        "ex_jixiandishuiweibaojing_dianliu_":"col6",
        "ex_gaoshuiweibaojing_dianliu_":"col7",
        "ex_paiyanwendugaobaojing":"col8",
        "ex_jixiandishuiweibaojing":"col9",
        "ex_shuiweidianjiluojicuo":"col10",
        "ex_dishuiweibaojing":"col11",
        "ex_gaoshuiweibaojing":"col12",
        "ex_bianpinqiguzhang":"col13",
        "ex_chaoyabaojing_kongzhiqi_":"col14",
        "ex_ranqiyalidibaojing":"col15",
        "ex_ranqiyaligaobaojing":"col16",
        "ex_ranqixieloubaojing":"col17",
        "ex_ranshaoqiguzhang":"col18",
    }
    return CTL_RT_T2_RYZQ_YLBSQ_180436007
}
var CTL_RT_T2_RYZQ_YLBSQ_180839008_ExceptionInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLBSQ_180839008={
        "ex_yalibiansongqiduanlu1":"col1",
        "ex_yalibiansongqiduanlu":"col2",
        "ex_chaoyabaojing_biansongqi_":"col3",
        "ex_shuiweichuanganqiduanlu1":"col4",
        "ex_shuiweichuanganqiduanlu":"col5",
        "ex_jixiandishuiweibaojing_dianliu_":"col6",
        "ex_gaoshuiweibaojing_dianliu_":"col7",
        "ex_paiyanwendugaobaojing":"col8",
        "ex_jixiandishuiweibaojing":"col9",
        "ex_shuiweidianjiluojicuo":"col10",
        "ex_dishuiweibaojing":"col11",
        "ex_gaoshuiweibaojing":"col12",
        "ex_bianpinqiguzhang":"col13",
        "ex_chaoyabaojing_kongzhiqi_":"col14",
        "ex_ranqiyalidibaojing":"col15",
        "ex_ranqiyaligaobaojing":"col16",
        "ex_ranqixieloubaojing":"col17",
        "ex_ranshaoqiguzhang":"col18",
    }
    return CTL_RT_T2_RYZQ_YLBSQ_180839008
}
var CTL_RT_T2_RYZQ_YLBSQ_190244133_ExceptionInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLBSQ_190244133={
        "ex_yalibiansongqiduanlu1":"col1",
        "ex_yalibiansongqiduanlu":"col2",
        "ex_chaoyabaojing_biansongqi_":"col3",
        "ex_shuiweichuanganqiduanlu1":"col4",
        "ex_shuiweichuanganqiduanlu":"col5",
        "ex_jixiandishuiweibaojing_dianliu_":"col6",
        "ex_gaoshuiweibaojing_dianliu_":"col7",
        "ex_paiyanwendugaobaojing":"col8",
        "ex_jixiandishuiweibaojing":"col9",
        "ex_shuiweidianjiluojicuo":"col10",
        "ex_dishuiweibaojing":"col11",
        "ex_gaoshuiweibaojing":"col12",
        "ex_bianpinqiguzhang":"col13",
        "ex_chaoyabaojing_kongzhiqi_":"col14",
        "ex_ranqiyalidibaojing":"col15",
        "ex_ranqiyaligaobaojing":"col16",
        "ex_ranqixieloubaojing":"col17",
        "ex_ranshaoqiguzhang":"col18",
    }
    return CTL_RT_T2_RYZQ_YLBSQ_190244133
}
var CTL_RT_T2_RYZQ_YLBSQ_ExceptionInfosJson= function(){
    var CTL_RT_T2_RYZQ_YLBSQ={
        "ex_yalibiansongqiduanlu1":"col1",
        "ex_yalibiansongqiduanlu":"col2",
        "ex_chaoyabaojing_biansongqi_":"col3",
        "ex_shuiweichuanganqiduanlu1":"col4",
        "ex_shuiweichuanganqiduanlu":"col5",
        "ex_jixiandishuiweibaojing_dianliu_":"col6",
        "ex_gaoshuiweibaojing_dianliu_":"col7",
        "ex_paiyanwendugaobaojing":"col8",
        "ex_jixiandishuiweibaojing":"col9",
        "ex_shuiweidianjiluojicuo":"col10",
        "ex_dishuiweibaojing":"col11",
        "ex_gaoshuiweibaojing":"col12",
        "ex_bianpinqiguzhang":"col13",
        "ex_chaoyabaojing_kongzhiqi_":"col14",
        "ex_ranqiyalidibaojing":"col15",
        "ex_ranqiyaligaobaojing":"col16",
        "ex_ranqixieloubaojing":"col17",
        "ex_ranshaoqiguzhang":"col18",
        "ex_jixiandishuiweibaojing2":"col19"
    }
    return CTL_RT_T2_RYZQ_YLBSQ
}
var CTL_RT_T2_RYRS_18126024_ExceptionInfosJson= function(){
    var CTL_RT_T2_RYRS_18126024={
        "ex_chushuiwenduchuanganqiduanlu1":"col1",
        "ex_chushuiwenduchuanganqiduanlu":"col2",
        "ex_chushuiwendugaobaojing_":"col3",
        "ex_huishuiwenduchuanganqiduanlu1":"col4",
        "ex_paiyanwendugaobaojing":"col5",
        "ex_jixiandishuiweibaojing":"col6",
        "ex_shuiweidianjiluojicuo":"col7",
        "ex_gaoshuiweibaojing":"col8",
        "ex_dianjiedianyalibiaoduanlu":"col9",
        "ex_chaoyabaojing_kongzhiqi_":"col10",
        "ex_ranqiyalidibaojing":"col11",
        "ex_ranqixieloubaojing":"col12",
        "ex_ranshaoqiguzhang":"col13"
    }
    return CTL_RT_T2_RYRS_18126024
}
var CTL_RT_H1_RYZQ_ExceptionInfosJson= function(){
    var CTL_RT_H1_RYZQ={
        "ex_jixiandishuiweibaojing":"col1",
        "ex_zhengqiyalibiansongqiduanlu":"col2",
        "ex_zhengqiyalibiansongqiduanlu1":"col3",
        "ex_chaoyabaojing_biansongqi_":"col4",
        "ex_paiyanwendugaobaojing":"col5",
        "ex_chaoyabaojing_kongzhiqi_":"col6",
        "ex_ranshaoqiguzhang":"col7",
        "ex_ranqiyalidi":"col8",
        "ex_ranqixieloubaojing":"col9",
        "ex_shuiweidianjiluojicuo":"col10",
        "ex_gaoshuiweibaojing":"col11",
        "ex_paiyanwenduchuanganqiduanlu":"col12",
        "ex_dishuiweibaojing":"col13",
        "ex_bianpinqiguzhangbaojing":"col14",
        "ex_shuiweichuanganqiduanlu":"col15",
        "ex_shuiweichuanganqiduanlu1":"col16",
        "ex_jixiandishuiweibaojing4-20mA":"col17",
        "ex_gaoshuiweibaojing4-20mA":"col18"
    }
    return CTL_RT_H1_RYZQ
}
var CTL_RT_H1_RYRS_ExceptionInfosJson= function(){
    var CTL_RT_H1_RYRS={
        "ex_jixiandishuiweibaojing":"col1",
        "ex_chushuiwenduchuanganqiduanlu":"col2",
        "ex_chushuiwenduchuanganqiduanlu1":"col3",
        "ex_huishuiwenduchuanganqiduanlu":"col4",
        "ex_chushuiwendugaobaojing":"col5",
        "ex_paiyanwendugaobaojing":"col6",
        "ex_chaoyabaojing":"col7",
        "ex_ranshaoqiguzhang":"col8",
        "ex_ranqiyalidibaojing":"col9",
        "ex_ranqixieloubaojing":"col10",
        "ex_dianjiedianyalibiaoduanlu":"col11",
        "ex_shuiweidianjiluojicuo":"col12",
        "ex_gaoshuiweibaojing":"col13",
        "ex_xunhuanbengguzhang":"col14",
    }
    return CTL_RT_H1_RYRS
}
var CTL_NJZJ_IPT2_ExceptionInfosJson= function(){
    var CTL_NJZJ_IPK2={
        "ex_paiyanwendugaobaojing":"col1",
        "ex_lushuiwendugaobaojing":"col2",
        "ex_chukouwendugaobaojing":"col3",
        "ex_chaoyabaojing":"col4",
        "ex_jixiandishuiweibaojing":"col5",
        "ex_dishuiweibaojing":"col6",
        "ex_gaoshuiweibaojing":"col7",
        "ex_shuiweixinhaoluojicuobaojing":"col8",
        "ex_lubiwendugaobaojing":"col9",
        "ex_fuyazhengqiwendugaobaojing":"col10",
        "ex_ranshaoqiguzhangbaojing":"col11",
        "ex_ranqixieloubaojing":"col12",
        "ex_ranqiyalidibaojing":"col13",
        "ex_ranqiyaliyichangbaojing":"col14",
        "ex_ranqiyaligaobaojing":"col15",
        "ex_jishuibianpinqiguzhangbaojing":"col16",
        "ex_xunhuanbianpinqiguzhangbaojing":"col17",
        "ex_yinfengbianpinqiguzhangbaojing":"col18",
        "ex_gufengbianpinqiguzhangbaojing":"col19",
        "ex_ecigufengbianpinqiguzhangbaojing":"col20",
        "ex_lupaibianpinqiguzhangbaojing":"col21",
        "ex_addshuibengguzhangbaojing":"col22",
        "ex_xunhuanbengguzhangbaojing":"col23",
        "ex_qianyabaojing":"col24",
        "ex_didianyabaojing":"col25",
        "ex_gaodianyabaojing":"col26",
        "ex_quexiangbaojing":"col27",
        "ex_loudianbaojing":"col28",
        "ex_biansongqiguoyabaohu":"col29",
        "ex_guanjiancanshuyichang":"col30",
        "ex_shedingcanshuyichang":"col31",
        "ex_shizhongguzhang":"col32",
        "ex_cunchuqiguzhang":"col33",
        "ex_waibuliansuobaojing":"col34",
        "ex_queyoubaojing":"col35",
        "ex_diyouweibaojing":"col36",
        "ex_bentipaiyanwendugaobaojing":"col37",
        "ex_bianpinqiguzhangbaojing":"col38",
        "ex_meishuiwendugaobaojing":"col39",
        "ex_1haoguoluguzhang":"col40",
        "ex_2haoguoluguzhang":"col41",
        "ex_3haoguoluguzhang":"col42",
        "ex_4haoguoluguzhang":"col43",
        "ex_5haoguoluguzhang":"col44",
        "ex_6haoguoluguzhang":"col45",
        "ex_7haoguoluguzhang":"col46",
        "ex_8haoguoluguzhang":"col47",
        "ex_bushuibianpinqiguzhangbaojing":"col48",
        "ex_shuiliukaiguanbaohubaojing":"col49",
        "ex_rukouwendudibaojing":"col50",
        "ex_xunhuanbengbianpinqiguzhang":"col51",
        "ex_ecixunhuanbengbianpinqiguzhang":"col52",
        "ex_reshuibengbianpinqiguzhang":"col53",
        "ex_buyoubengbianpinqiguzhang":"col54",
        "ex_ecigufengbianpinqiguzhang":"col55",
        "ex_songliaojibianpinqiguzhang":"col56",
        "ex_zhenkongbengbianpinqiguzhang":"col57",
        "ex_lengningbengbianpinqiguzhang":"col58",
        "ex_addshuibengguzhang":"col59",
        "ex_buyoubengguzhang":"col60",
        "ex_lengningbengguzhang":"col61",
        "ex_reshuibengguzhang":"col62",
        "ex_zhenkongbengguzhang":"col63",
        "ex_ecixunhuanbengguzhang":"col64",
        "ex_huilu1xunhuanbengguzhang":"col65",
        "ex_huilu2xunhuanbengguzhang":"col66",
        "ex_huilu3xunhuanbengguzhang":"col67",
        "ex_huilu4xunhuanbengguzhang":"col68",
        "ex_huilu5xunhuanbengguzhang":"col69",
        "ex_huilu1wendugaobaojing":"col70",
        "ex_huilu2wendugaobaojing":"col71",
        "ex_huilu3wendugaobaojing":"col72",
        "ex_huilu4wendugaobaojing":"col73",
        "ex_huilu5wendugaobaojing":"col74",
        "ex_panguan1wendugaobaojing":"col75",
        "ex_panguan2wendugaobaojing":"col76",
        "ex_panguan3wendugaobaojing":"col77",
        "ex_panguan4wendugaobaojing":"col78",
        "ex_panguan5wendugaobaojing":"col79",
        "ex_panguan6wendugaobaojing":"col80",
        "ex_panguan7wendugaobaojing":"col81",
        "ex_panguan8wendugaobaojing":"col82",
        "ex_panguan9wendugaobaojing":"col83",
        "ex_panguan10wendugaobaojing":"col84",
        "ex_shanzhengguanchaoyabaojing":"col85",
        "ex_lengningguanchaoyabaojing":"col86",
        "ex_pengzhangguanchaoyabaojing":"col87",
        "ex_shanzhengguanyeweigaobaojing":"col88",
        "ex_shanzhengguanyeweidibaojing":"col89",
        "ex_lengningguanyeweigaobaojing":"col90",
        "ex_lengningguanyeweidibaojing":"col91",
        "ex_pengzhangguanyeweigaobaojing":"col92",
        "ex_pengzhangguanyeweidibaojing":"col93",
        "ex_jinchukouyachadibaojing":"col94",
        "ex_jinchukouyachagaobaojing":"col95",
        "ex_zhenkongyalibuzubaojing":"col96",
        "ex_jinchukouwenchadibaojing":"col97",
        "ex_jinchukouwenchagaobaojing":"col98",
        "ex_guoluhuohuiluchukouyaligaobaojing":"col99",
        "ex_guoluhuohuiluchukouyalidibaojing":"col100",
        "ex_guoluhuohuilurukouyaligaobaojing":"col101",
        "ex_guoluhuohuilurukouyalidibaojing":"col102",
        "ex_dongzuofankuiyichangyinfengjiguzhangbaojing":"col103",
        "ex_paiyanwenduchuanganqiguzhang":"col104",
        "ex_lushuiwenduchuanganqiguzhang":"col105",
        "ex_chukouwenduchuanganqiguzhang":"col106",
        "ex_rukouwenduchuanganqiguzhang":"col107",
        "ex_jienengqichukouwenduchuanganqiguzhang":"col108",
        "ex_jienengqirukouwenduchuanganqiguzhang":"col109",
        "ex_jishuiwenduchuanganqiguzhang":"col110",
        "ex_lutangwenduchuanganqiguzhang":"col111",
        "ex_lutangchukouwenduchuanganqiguzhang":"col112",
        "ex_lubiwenduchuanganqiguzhang":"col113",
        "ex_ranliaowenduchuanganqiguzhang":"col114",
        "ex_refengwenduchuanganqiguzhang":"col115",
        "ex_fuyazhengqiwenduchuanganqiguzhang":"col116",
        "ex_guorezhengqiwenduchuanganqiguzhang":"col117",
        "ex_huilu1wenduchuanganqiguzhang":"col118",
        "ex_huilu2wenduchuanganqiguzhang":"col119",
        "ex_huilu3wenduchuanganqiguzhang":"col120",
        "ex_huilu4wenduchuanganqiguzhang":"col121",
        "ex_huilu5wenduchuanganqiguzhang":"col122",
        "ex_shiwaiwenduchuanganqiguzhang":"col123",
        "ex_zhengqiyalichuanganqiguzhang":"col124",
        "ex_jishuiyalichuanganqiguzhang":"col125",
        "ex_chukouyalichuanganqiguzhang":"col126",
        "ex_rukouyalichuanganqiguzhang":"col127",
        "ex_lutangyalichuanganqiguzhang":"col128",
        "ex_lutangchukouyalichuanganqiguzhang":"col129",
        "ex_ranqiyalichuanganqiguzhang":"col130",
        "ex_yicifengyachuanganqiguzhang":"col131",
        "ex_ecifengyachuanganqiguzhang":"col132",
        "ex_ranliaoliangchuanganqiguzhang":"col133",
        "ex_zhengqiliuliangchuanganqiguzhang":"col134",
        "ex_jishuiliuliangchuanganqiguzhang":"col135",
        "ex_xunhuanliuliangchuanganqiguzhang":"col136",
        "ex_bushuiliuliangchuanganqiguzhang":"col137",
        "ex_guoluyeweichuanganqiguzhang":"col138",
        "ex_shuixiangyeweichuanganqiguzhang":"col139",
        "ex_paiyanyanghanliangchuanganqiguzhang":"col140",
        "ex_lupaisudufankuichuanganqiguzhang":"col141",
        "ex_yinfengshuchufankuichuanganqiguzhang":"col142",
        "ex_gufengshuchufankuichuanganqiguzhang":"col143",
        "ex_jishuishuchufankuichuanganqiguzhang":"col144",
        "ex_meishuiwenduchuanganqiguzhang":"col145",
        "ex_shuixiangwenduchuanganqiguzhang":"col146",
        "ex_pengzhangguanyeweichuanganqiguzhang":"col147",
        "ex_shanzhengguanyeweichuanganqiguzhang":"col148",
        "ex_lengningyeguanyeweichuanganqiguzhang":"col149",
        "ex_chuguanyeweichuanganqiguzhang":"col150",
        "ex_pengzhangguanwenduchuanganqiguzhang":"col151",
        "ex_shanzhengguanwenduchuanganqiguzhang":"col152",
        "ex_lengningyeguanwenduchuanganqiguzhang":"col153",
        "ex_chuguanwenduchuanganqiguzhang":"col154",
        "ex_guoluyalichuanganqiguzhang":"col155",
        "ex_guorezhengqiyalichuanganqiguzhang":"col156",
        "ex_paiyanchuyalichuanganqiguzhang":"col157",
        "ex_fengshifengyachuanganqiguzhang":"col158",
        "ex_yinfengjidianliuchuanganqiguzhang":"col159",
        "ex_gufengjidianliuchuanganqiguzhang":"col160",
        "ex_jiliaojisudufankuichuanganqiguzhang":"col161",
        "ex_panguan1wenduchuanganqiguzhang":"col162",
        "ex_panguan2wenduchuanganqiguzhang":"col163",
        "ex_panguan3wenduchuanganqiguzhang":"col164",
        "ex_panguan4wenduchuanganqiguzhang":"col165",
        "ex_panguan5wenduchuanganqiguzhang":"col166",
        "ex_panguan6wenduchuanganqiguzhang":"col167",
        "ex_panguan7wenduchuanganqiguzhang":"col168",
        "ex_panguan8wenduchuanganqiguzhang":"col169",
        "ex_panguan9wenduchuanganqiguzhang":"col170",
        "ex_panguan10wenduchuanganqiguzhang":"col171",
    }
    return CTL_NJZJ_IPK2
}
var CTL_NJZJ_IPT2_485_ExceptionInfosJson= function(){
    var CTL_NJZJ_IPK2_485={
        "ex_paiyanwendugaobaojing":"col1",
        "ex_lushuiwendugaobaojing":"col2",
        "ex_chukouwendugaobaojing":"col3",
        "ex_chaoyabaojing":"col4",
        "ex_jixiandishuiweibaojing":"col5",
        "ex_dishuiweibaojing":"col6",
        "ex_gaoshuiweibaojing":"col7",
        "ex_shuiweixinhaoluojicuobaojing":"col8",
        "ex_lubiwendugaobaojing":"col9",
        "ex_fuyazhengqiwendugaobaojing":"col10",
        "ex_ranshaoqiguzhangbaojing":"col11",
        "ex_ranqixieloubaojing":"col12",
        "ex_ranqiyalidibaojing":"col13",
        "ex_ranqiyaliyichangbaojing":"col14",
        "ex_ranqiyaligaobaojing":"col15",
        "ex_jishuibianpinqiguzhangbaojing":"col16",
        "ex_xunhuanbianpinqiguzhangbaojing":"col17",
        "ex_yinfengbianpinqiguzhangbaojing":"col18",
        "ex_gufengbianpinqiguzhangbaojing":"col19",
        "ex_ecigufengbianpinqiguzhangbaojing":"col20",
        "ex_lupaibianpinqiguzhangbaojing":"col21",
        "ex_jishuibengguzhangbaojing":"col22",
        "ex_xunhuanbengguzhangbaojing":"col23",
        "ex_chaodiyabaojing":"col24",
        "ex_qiandianyabaojing":"col25",
        "ex_guodianyabaojing":"col26",
        "ex_quexiangbaojing":"col27",
        "ex_loudianbaojing":"col28",
        "ex_biansongqiguoyabaohu":"col29",
        "ex_guanjiancanshuyichang":"col30",
        "ex_shedingcanshuyichang":"col31",
        "ex_shizhongguzhang":"col32",
        "ex_cunchuqiguzhang":"col33",
        "ex_waibuliansuobaojing":"col34",
        "ex_queyoubaojing":"col35",
        "ex_diyouweibaojing":"col36",
        "ex_bentipaiyanwendugaobaojing":"col37",
        "ex_bianpinqiguzhangbaojing":"col38",
        "ex_meishuiwendugaobaojing":"col39",
        "ex_1#guoluguzhang":"col40",
        "ex_2#guoluguzhang":"col41",
        "ex_3#guoluguzhang":"col42",
        "ex_4#guoluguzhang":"col43",
        "ex_5#guoluguzhang":"col44",
        "ex_6#guoluguzhang":"col45",
        "ex_7#guoluguzhang":"col46",
        "ex_8#guoluguzhang":"col47",
        "ex_bushuibianpinqiguzhangbaojing":"col48",
        "ex_diliuliangbaojing":"col49",
        "ex_jinkouwendudibaojing":"col50",
        "ex_xunhuanbengbianpinqiguzhang":"col51",
        "ex_ecixunhuanbengbianpinqiguzhang":"col52",
        "ex_reshuibengbianpinqiguzhang":"col53",
        "ex_buyoubengbianpinqiguzhang":"col54",
        "ex_ecigufengbianpinqiguzhang":"col55",
        "ex_songliaojibianpinqiguzhang":"col56",
        "ex_zhenkongbengbianpinqiguzhang":"col57",
        "ex_lengningbengbianpinqiguzhang":"col58",
        "ex_bushuibengguzhang":"col59",
        "ex_buyoubengguzhang":"col60",
        "ex_lengningbengguzhang":"col61",
        "ex_reshuibengguzhang":"col62",
        "ex_zhenkongbengguzhang":"col63",
        "ex_ecixunhuanbengguzhang":"col64",
        "ex_huilu1xunhuanbengguzhang":"col65",
        "ex_huilu2xunhuanbengguzhang":"col66",
        "ex_huilu3xunhuanbengguzhang":"col67",
        "ex_huilu4xunhuanbengguzhang":"col68",
        "ex_huilu5xunhuanbengguzhang":"col69",
        "ex_huilu1wendugaobaojing":"col70",
        "ex_huilu2wendugaobaojing":"col71",
        "ex_huilu3wendugaobaojing":"col72",
        "ex_huilu4wendugaobaojing":"col73",
        "ex_huilu5wendugaobaojing":"col74",
        "ex_panguan1wendugaobaojing":"col75",
        "ex_panguan2wendugaobaojing":"col76",
        "ex_panguan3wendugaobaojing":"col77",
        "ex_panguan4wendugaobaojing":"col78",
        "ex_panguan5wendugaobaojing":"col79",
        "ex_panguan6wendugaobaojing":"col80",
        "ex_panguan7wendugaobaojing":"col81",
        "ex_panguan8wendugaobaojing":"col82",
        "ex_panguan9wendugaobaojing":"col83",
        "ex_panguan10wendugaobaojing":"col84",
        "ex_shanzhengguanchaoyabaojing":"col85",
        "ex_lengningguanchaoyabaojing":"col86",
        "ex_pengzhangguanchaoyabaojing":"col87",
        "ex_shanzhengguanyeweigaobaojing":"col88",
        "ex_shanzhengguanyeweidibaojing":"col89",
        "ex_lengningguanyeweigaobaojing":"col90",
        "ex_lengningguanyeweidibaojing":"col91",
        "ex_pengzhangguanyeweigaobaojing":"col92",
        "ex_pengzhangguanyeweidibaojing":"col93",
        "ex_jinchukouyachadibaojing":"col94",
        "ex_jinchukouyachagaobaojing":"col95",
        "ex_zhenkongyalibuzubaojing":"col96",
        "ex_jinchukouwenchadibaojing":"col97",
        "ex_jinchukouwenchagaobaojing":"col98",
        "ex_chukouyaligaobaojing_guoluhuohuilu_":"col99",
        "ex_chukouyalidibaojing_guoluhuohuilu_":"col100",
        "ex_jinkouyaligaobaojing_guoluhuohuilu_":"col101",
        "ex_jinkouyalidibaojing_guoluhuohuilu_":"col102",
        "ex_yinfengjiguzhangbaojing_dongzuofankuiyichang_":"col103",
        "ex_cainuanchukouwendugaobaojing":"col104",
        "ex_reshuichukouwendugaobaojing":"col105",
        "ex_jinkouwendugaobaojing":"col106",
        "ex_pengzhangguanwendugaobaojing":"col107",
        "ex_guodianliubaojing":"col108",
        "ex_jishuiyaligaobaojing":"col109",
        "ex_jienengqichukouyanwengaobaojing":"col110",
        "ex_lengningqichukouyanwengaobaojing":"col111",
        "ex_chushuiwendugaobaojing":"col112",
        "ex_gaowenbaohuwendugaobaojing":"col113",
        "ex_youwengaobaojing":"col114",
        "ex_wenchagaobaojing":"col115",
        "ex_shuibengguozaibaojing":"col116",
        "ex_jiarezuguozaibaojing":"col117",
        "ex_churexunhuanbengguzhangbaojing":"col118",
        "ex_yandaodiefaguzhang":"col119",
        "ex_nengliangshezhiwendugaobaojing":"col120",
        "ex_zhengqiwendugaobaojing":"col121",
        "ex_shuixiangwendugaobaojing":"col122",
        "ex_1#guodianliubaojing":"col123",
        "ex_2#guodianliubaojing":"col124",
        "ex_3#guodianliubaojing":"col125",
        "ex_4#guodianliubaojing":"col126",
        "ex_5#guodianliubaojing":"col127",
        "ex_gufengjiguzhangbaojing":"col128",
        "ex_jiezhigaowenbaojing":"col129",
        "ex_jiezhidiwenbaojing":"col130",
        "ex_bentipaiyanwenduchuanganqiguzhang":"col131",
        "ex_paiyanwenduchuanganqiguzhang":"col132",
        "ex_lushuiwenduchuanganqiguzhang":"col133",
        "ex_chukouwenduchuanganqiguzhang":"col134",
        "ex_jinkouwenduchuanganqiguzhang":"col135",
        "ex_jienengqichukouwenduchuanganqiguzhang(shui_":"col136",
        "ex_jienengqijinkouwenduchuanganqiguzhang(shui_":"col137",
        "ex_jishuiwenduchuanganqiguzhang":"col138",
        "ex_lutangwenduchuanganqiguzhang":"col139",
        "ex_lutangchukouwenduchuanganqiguzhang":"col140",
        "ex_lubiwenduchuanganqiguzhang":"col141",
        "ex_ranliaowenduchuanganqiguzhang":"col142",
        "ex_refengwenduchuanganqiguzhang_kongyuqichukou_":"col143",
        "ex_fuyazhengqiwenduchuanganqiguzhang":"col144",
        "ex_guorezhengqiwenduchuanganqiguzhang":"col145",
        "ex_huilu1wenduchuanganqiguzhang":"col146",
        "ex_huilu2wenduchuanganqiguzhang":"col147",
        "ex_huilu3wenduchuanganqiguzhang":"col148",
        "ex_huilu4wenduchuanganqiguzhang":"col149",
        "ex_huilu5wenduchuanganqiguzhang":"col150",
        "ex_shiwaiwenduchuanganqiguzhang":"col151",
        "ex_zhengqiyalichuanganqiguzhang":"col152",
        "ex_jishuiyalichuanganqiguzhang":"col153",
        "ex_chukouyalichuanganqiguzhang":"col154",
        "ex_jinkouyalichuanganqiguzhang":"col155",
        "ex_lutangyalichuanganqiguzhang":"col156",
        "ex_lutangchukouyalichuanganqiguzhang":"col157",
        "ex_ranqiyalichuanganqiguzhang":"col158",
        "ex_yicifengyachuanganqiguzhang":"col159",
        "ex_ecifengyachuanganqiguzhang":"col160",
        "ex_ranliaoliangchuanganqiguzhang_shunshizhi_":"col161",
        "ex_zhengqiliuliangchuanganqiguzhang_shunshizhi_":"col162",
        "ex_jishuiliuliangchuanganqiguzhang_shunshizhi_":"col163",
        "ex_xunhuanliuliangchuanganqiguzhang_shunshizhi_":"col164",
        "ex_bushuiliuliangchuanganqiguzhang_shunshizhi_":"col165",
        "ex_guoluyeweichuanganqiguzhang":"col166",
        "ex_shuixiangyeweichuanganqiguzhang":"col167",
        "ex_paiyanyanghanliangchuanganqiguzhang":"col168",
        "ex_lupaisudufankuichuanganqiguzhang":"col169",
        "ex_yinfengshuchufankuichuanganqiguzhang":"col170",
        "ex_gufengshuchufankuichuanganqiguzhang":"col171",
        "ex_jishuishuchufankuichuanganqiguzhang":"col172",
        "ex_meishuiwenduchuanganqiguzhang":"col173",
        "ex_shuixiangwenduchuanganqiguzhang":"col174",
        "ex_pengzhangguanyeweichuanganqiguzhang":"col175",
        "ex_shanzhengguanyeweichuanganqiguzhang":"col176",
        "ex_lengningyeguanyeweichuanganqiguzhang":"col177",
        "ex_chuguanyeweichuanganqiguzhang":"col178",
        "ex_pengzhangguanwenduchuanganqiguzhang":"col179",
        "ex_shanzhengguanwenduchuanganqiguzhang":"col180",
        "ex_lengningyeguanwenduchuanganqiguzhang":"col181",
        "ex_chuguanwenduchuanganqiguzhang":"col182",
        "ex_xitongyalichuanganqiguzhang":"col183",
        "ex_guorezhengqiyalichuanganqiguzhang":"col184",
        "ex_paiyanchuyalichuanganqiguzhang":"col185",
        "ex_fengshifengyachuanganqiguzhang":"col186",
        "ex_yinfengjidianliuchuanganqiguzhang":"col187",
        "ex_gufengjidianliuchuanganqiguzhang":"col188",
        "ex_jiliaojisudufankuichuanganqiguzhang":"col189",
        "ex_panguan1wenduchuanganqiguzhang":"col190",
        "ex_panguan2wenduchuanganqiguzhang":"col191",
        "ex_panguan3wenduchuanganqiguzhang":"col192",
        "ex_panguan4wenduchuanganqiguzhang":"col193",
        "ex_panguan5wenduchuanganqiguzhang":"col194",
        "ex_panguan6wenduchuanganqiguzhang":"col195",
        "ex_panguan7wenduchuanganqiguzhang":"col196",
        "ex_panguan8wenduchuanganqiguzhang":"col197",
        "ex_panguan9wenduchuanganqiguzhang":"col198",
        "ex_panguan10wenduchuanganqiguzhang":"col199",
        "ex_cainuanchukouwenduchuanganqiguzhang":"col200",
        "ex_reshuichukouwenduchuanganqiguzhang":"col201",
        "ex_jinchukouyachachuanganqiguzhang":"col202",
        "ex_1#chukouwenduchuanganqiguzhang":"col203",
        "ex_2#chukouwenduchuanganqiguzhang":"col204",
        "ex_jienengqichukouyanwenchuanganqiguzhang":"col205",
        "ex_jienengqijinkouyanwenchuanganqiguzhang":"col206",
        "ex_lengningqichukouwendu_shui_chuanganqiguzhang":"col207",
        "ex_lengningqijinkou_shui_chuanganqiguzhang":"col208",
        "ex_lengningqichukouyanwenchuanganqiguzhang":"col209",
        "ex_lengningqijinkouyanwenchuanganqiguzhang":"col210",
        "ex_cainuanjinkouwenduchuanganqiguzhang":"col211",
        "ex_reshuijinkouwenduchuanganqiguzhang":"col212",
        "ex_kongzhixiangwenduchuanganqiguzhang":"col213",
        "ex_zhenkongyalichuanganqiguzhang":"col214",
        "ex_chushuiwenduchuanganqiguzhang":"col215",
        "ex_jinshuiwenduchuanganqiguzhang":"col216",
        "ex_youwenjiancechuanganqiguzhang":"col217",
        "ex_gaowenbaohuchuanganqiguzhang":"col218",
        "ex_chukouyouwenchuanganqiguzhang":"col219",
        "ex_jinkouyouwenchuanganqiguzhang":"col220",
        "ex_huanrewenduchuanganqiguzhang":"col221",
        "ex_xitongwenduchuanganqiguzhang":"col222",
        "ex_nengliangshezhiwenduchuanganqiguzhang":"col223",
        "ex_zhengqiwenduchuanganqiguzhang":"col224",
        "ex_shineiwenduchuanganqiguzhang":"col225",
        "ex_1#dianliufankuichuanganqiguzhang":"col226",
        "ex_2#dianliufankuichuanganqiguzhang":"col227",
        "ex_3#dianliufankuichuanganqiguzhang":"col228",
        "ex_4#dianliufankuichuanganqiguzhang":"col229",
        "ex_5#dianliufankuichuanganqiguzhang":"col230",
        "ex_jiezhiwenduchuanganqiguzhang":"col231",
        "ex_xiyuwenduchuanganqiguzhang":"col232",
        "ex_huanjingwenduchuanganqiguzhang":"col233",
        "ex_jiezhiyalichuanganqiguzhang":"col234"
    }
    return CTL_NJZJ_IPK2_485
}
var CTL_NJZJ_IPK2_485_ExceptionInfosJson= function(){
    var CTL_NJZJ_IPK2_485={
        "ex_paiyanwendugaobaojing":"col1",
        "ex_lushuiwendugaobaojing":"col2",
        "ex_chukouwendugaobaojing":"col3",
        "ex_chaoyabaojing":"col4",
        "ex_jixiandishuiweibaojing":"col5",
        "ex_dishuiweibaojing":"col6",
        "ex_gaoshuiweibaojing":"col7",
        "ex_shuiweixinhaoluojicuobaojing":"col8",
        "ex_lubiwendugaobaojing":"col9",
        "ex_fuyazhengqiwendugaobaojing":"col10",
        "ex_ranshaoqiguzhangbaojing":"col11",
        "ex_ranqixieloubaojing":"col12",
        "ex_ranqiyalidibaojing":"col13",
        "ex_ranqiyaliyichangbaojing":"col14",
        "ex_ranqiyaligaobaojing":"col15",
        "ex_jishuibianpinqiguzhangbaojing":"col16",
        "ex_xunhuanbianpinqiguzhangbaojing":"col17",
        "ex_yinfengbianpinqiguzhangbaojing":"col18",
        "ex_gufengbianpinqiguzhangbaojing":"col19",
        "ex_ecigufengbianpinqiguzhangbaojing":"col20",
        "ex_lupaibianpinqiguzhangbaojing":"col21",
        "ex_jishuibengguzhangbaojing":"col22",
        "ex_xunhuanbengguzhangbaojing":"col23",
        "ex_chaodiyabaojing":"col24",
        "ex_qiandianyabaojing":"col25",
        "ex_guodianyabaojing":"col26",
        "ex_quexiangbaojing":"col27",
        "ex_loudianbaojing":"col28",
        "ex_biansongqiguoyabaohu":"col29",
        "ex_guanjiancanshuyichang":"col30",
        "ex_shedingcanshuyichang":"col31",
        "ex_shizhongguzhang":"col32",
        "ex_cunchuqiguzhang":"col33",
        "ex_waibuliansuobaojing":"col34",
        "ex_queyoubaojing":"col35",
        "ex_diyouweibaojing":"col36",
        "ex_bentipaiyanwendugaobaojing":"col37",
        "ex_bianpinqiguzhangbaojing":"col38",
        "ex_meishuiwendugaobaojing":"col39",
        "ex_1#guoluguzhang":"col40",
        "ex_2#guoluguzhang":"col41",
        "ex_3#guoluguzhang":"col42",
        "ex_4#guoluguzhang":"col43",
        "ex_5#guoluguzhang":"col44",
        "ex_6#guoluguzhang":"col45",
        "ex_7#guoluguzhang":"col46",
        "ex_8#guoluguzhang":"col47",
        "ex_bushuibianpinqiguzhangbaojing":"col48",
        "ex_diliuliangbaojing":"col49",
        "ex_jinkouwendudibaojing":"col50",
        "ex_xunhuanbengbianpinqiguzhang":"col51",
        "ex_ecixunhuanbengbianpinqiguzhang":"col52",
        "ex_reshuibengbianpinqiguzhang":"col53",
        "ex_buyoubengbianpinqiguzhang":"col54",
        "ex_ecigufengbianpinqiguzhang":"col55",
        "ex_songliaojibianpinqiguzhang":"col56",
        "ex_zhenkongbengbianpinqiguzhang":"col57",
        "ex_lengningbengbianpinqiguzhang":"col58",
        "ex_bushuibengguzhang":"col59",
        "ex_buyoubengguzhang":"col60",
        "ex_lengningbengguzhang":"col61",
        "ex_reshuibengguzhang":"col62",
        "ex_zhenkongbengguzhang":"col63",
        "ex_ecixunhuanbengguzhang":"col64",
        "ex_huilu1xunhuanbengguzhang":"col65",
        "ex_huilu2xunhuanbengguzhang":"col66",
        "ex_huilu3xunhuanbengguzhang":"col67",
        "ex_huilu4xunhuanbengguzhang":"col68",
        "ex_huilu5xunhuanbengguzhang":"col69",
        "ex_huilu1wendugaobaojing":"col70",
        "ex_huilu2wendugaobaojing":"col71",
        "ex_huilu3wendugaobaojing":"col72",
        "ex_huilu4wendugaobaojing":"col73",
        "ex_huilu5wendugaobaojing":"col74",
        "ex_panguan1wendugaobaojing":"col75",
        "ex_panguan2wendugaobaojing":"col76",
        "ex_panguan3wendugaobaojing":"col77",
        "ex_panguan4wendugaobaojing":"col78",
        "ex_panguan5wendugaobaojing":"col79",
        "ex_panguan6wendugaobaojing":"col80",
        "ex_panguan7wendugaobaojing":"col81",
        "ex_panguan8wendugaobaojing":"col82",
        "ex_panguan9wendugaobaojing":"col83",
        "ex_panguan10wendugaobaojing":"col84",
        "ex_shanzhengguanchaoyabaojing":"col85",
        "ex_lengningguanchaoyabaojing":"col86",
        "ex_pengzhangguanchaoyabaojing":"col87",
        "ex_shanzhengguanyeweigaobaojing":"col88",
        "ex_shanzhengguanyeweidibaojing":"col89",
        "ex_lengningguanyeweigaobaojing":"col90",
        "ex_lengningguanyeweidibaojing":"col91",
        "ex_pengzhangguanyeweigaobaojing":"col92",
        "ex_pengzhangguanyeweidibaojing":"col93",
        "ex_jinchukouyachadibaojing":"col94",
        "ex_jinchukouyachagaobaojing":"col95",
        "ex_zhenkongyalibuzubaojing":"col96",
        "ex_jinchukouwenchadibaojing":"col97",
        "ex_jinchukouwenchagaobaojing":"col98",
        "ex_chukouyaligaobaojing_guoluhuohuilu_":"col99",
        "ex_chukouyalidibaojing_guoluhuohuilu_":"col100",
        "ex_jinkouyaligaobaojing_guoluhuohuilu_":"col101",
        "ex_jinkouyalidibaojing_guoluhuohuilu_":"col102",
        "ex_yinfengjiguzhangbaojing_dongzuofankuiyichang_":"col103",
        "ex_cainuanchukouwendugaobaojing":"col104",
        "ex_reshuichukouwendugaobaojing":"col105",
        "ex_jinkouwendugaobaojing":"col106",
        "ex_pengzhangguanwendugaobaojing":"col107",
        "ex_guodianliubaojing":"col108",
        "ex_jishuiyaligaobaojing":"col109",
        "ex_jienengqichukouyanwengaobaojing":"col110",
        "ex_lengningqichukouyanwengaobaojing":"col111",
        "ex_chushuiwendugaobaojing":"col112",
        "ex_gaowenbaohuwendugaobaojing":"col113",
        "ex_youwengaobaojing":"col114",
        "ex_wenchagaobaojing":"col115",
        "ex_shuibengguozaibaojing":"col116",
        "ex_jiarezuguozaibaojing":"col117",
        "ex_churexunhuanbengguzhangbaojing":"col118",
        "ex_yandaodiefaguzhang":"col119",
        "ex_nengliangshezhiwendugaobaojing":"col120",
        "ex_zhengqiwendugaobaojing":"col121",
        "ex_shuixiangwendugaobaojing":"col122",
        "ex_1#guodianliubaojing":"col123",
        "ex_2#guodianliubaojing":"col124",
        "ex_3#guodianliubaojing":"col125",
        "ex_4#guodianliubaojing":"col126",
        "ex_5#guodianliubaojing":"col127",
        "ex_gufengjiguzhangbaojing":"col128",
        "ex_jiezhigaowenbaojing":"col129",
        "ex_jiezhidiwenbaojing":"col130",
        "ex_bentipaiyanwenduchuanganqiguzhang":"col131",
        "ex_paiyanwenduchuanganqiguzhang":"col132",
        "ex_lushuiwenduchuanganqiguzhang":"col133",
        "ex_chukouwenduchuanganqiguzhang":"col134",
        "ex_jinkouwenduchuanganqiguzhang":"col135",
        "ex_jienengqichukouwenduchuanganqiguzhang(shui_":"col136",
        "ex_jienengqijinkouwenduchuanganqiguzhang(shui_":"col137",
        "ex_jishuiwenduchuanganqiguzhang":"col138",
        "ex_lutangwenduchuanganqiguzhang":"col139",
        "ex_lutangchukouwenduchuanganqiguzhang":"col140",
        "ex_lubiwenduchuanganqiguzhang":"col141",
        "ex_ranliaowenduchuanganqiguzhang":"col142",
        "ex_refengwenduchuanganqiguzhang_kongyuqichukou_":"col143",
        "ex_fuyazhengqiwenduchuanganqiguzhang":"col144",
        "ex_guorezhengqiwenduchuanganqiguzhang":"col145",
        "ex_huilu1wenduchuanganqiguzhang":"col146",
        "ex_huilu2wenduchuanganqiguzhang":"col147",
        "ex_huilu3wenduchuanganqiguzhang":"col148",
        "ex_huilu4wenduchuanganqiguzhang":"col149",
        "ex_huilu5wenduchuanganqiguzhang":"col150",
        "ex_shiwaiwenduchuanganqiguzhang":"col151",
        "ex_zhengqiyalichuanganqiguzhang":"col152",
        "ex_jishuiyalichuanganqiguzhang":"col153",
        "ex_chukouyalichuanganqiguzhang":"col154",
        "ex_jinkouyalichuanganqiguzhang":"col155",
        "ex_lutangyalichuanganqiguzhang":"col156",
        "ex_lutangchukouyalichuanganqiguzhang":"col157",
        "ex_ranqiyalichuanganqiguzhang":"col158",
        "ex_yicifengyachuanganqiguzhang":"col159",
        "ex_ecifengyachuanganqiguzhang":"col160",
        "ex_ranliaoliangchuanganqiguzhang_shunshizhi_":"col161",
        "ex_zhengqiliuliangchuanganqiguzhang_shunshizhi_":"col162",
        "ex_jishuiliuliangchuanganqiguzhang_shunshizhi_":"col163",
        "ex_xunhuanliuliangchuanganqiguzhang_shunshizhi_":"col164",
        "ex_bushuiliuliangchuanganqiguzhang_shunshizhi_":"col165",
        "ex_guoluyeweichuanganqiguzhang":"col166",
        "ex_shuixiangyeweichuanganqiguzhang":"col167",
        "ex_paiyanyanghanliangchuanganqiguzhang":"col168",
        "ex_lupaisudufankuichuanganqiguzhang":"col169",
        "ex_yinfengshuchufankuichuanganqiguzhang":"col170",
        "ex_gufengshuchufankuichuanganqiguzhang":"col171",
        "ex_jishuishuchufankuichuanganqiguzhang":"col172",
        "ex_meishuiwenduchuanganqiguzhang":"col173",
        "ex_shuixiangwenduchuanganqiguzhang":"col174",
        "ex_pengzhangguanyeweichuanganqiguzhang":"col175",
        "ex_shanzhengguanyeweichuanganqiguzhang":"col176",
        "ex_lengningyeguanyeweichuanganqiguzhang":"col177",
        "ex_chuguanyeweichuanganqiguzhang":"col178",
        "ex_pengzhangguanwenduchuanganqiguzhang":"col179",
        "ex_shanzhengguanwenduchuanganqiguzhang":"col180",
        "ex_lengningyeguanwenduchuanganqiguzhang":"col181",
        "ex_chuguanwenduchuanganqiguzhang":"col182",
        "ex_xitongyalichuanganqiguzhang":"col183",
        "ex_guorezhengqiyalichuanganqiguzhang":"col184",
        "ex_paiyanchuyalichuanganqiguzhang":"col185",
        "ex_fengshifengyachuanganqiguzhang":"col186",
        "ex_yinfengjidianliuchuanganqiguzhang":"col187",
        "ex_gufengjidianliuchuanganqiguzhang":"col188",
        "ex_jiliaojisudufankuichuanganqiguzhang":"col189",
        "ex_panguan1wenduchuanganqiguzhang":"col190",
        "ex_panguan2wenduchuanganqiguzhang":"col191",
        "ex_panguan3wenduchuanganqiguzhang":"col192",
        "ex_panguan4wenduchuanganqiguzhang":"col193",
        "ex_panguan5wenduchuanganqiguzhang":"col194",
        "ex_panguan6wenduchuanganqiguzhang":"col195",
        "ex_panguan7wenduchuanganqiguzhang":"col196",
        "ex_panguan8wenduchuanganqiguzhang":"col197",
        "ex_panguan9wenduchuanganqiguzhang":"col198",
        "ex_panguan10wenduchuanganqiguzhang":"col199",
        "ex_cainuanchukouwenduchuanganqiguzhang":"col200",
        "ex_reshuichukouwenduchuanganqiguzhang":"col201",
        "ex_jinchukouyachachuanganqiguzhang":"col202",
        "ex_1#chukouwenduchuanganqiguzhang":"col203",
        "ex_2#chukouwenduchuanganqiguzhang":"col204",
        "ex_jienengqichukouyanwenchuanganqiguzhang":"col205",
        "ex_jienengqijinkouyanwenchuanganqiguzhang":"col206",
        "ex_lengningqichukouwendu_shui_chuanganqiguzhang":"col207",
        "ex_lengningqijinkou_shui_chuanganqiguzhang":"col208",
        "ex_lengningqichukouyanwenchuanganqiguzhang":"col209",
        "ex_lengningqijinkouyanwenchuanganqiguzhang":"col210",
        "ex_cainuanjinkouwenduchuanganqiguzhang":"col211",
        "ex_reshuijinkouwenduchuanganqiguzhang":"col212",
        "ex_kongzhixiangwenduchuanganqiguzhang":"col213",
        "ex_zhenkongyalichuanganqiguzhang":"col214",
        "ex_chushuiwenduchuanganqiguzhang":"col215",
        "ex_jinshuiwenduchuanganqiguzhang":"col216",
        "ex_youwenjiancechuanganqiguzhang":"col217",
        "ex_gaowenbaohuchuanganqiguzhang":"col218",
        "ex_chukouyouwenchuanganqiguzhang":"col219",
        "ex_jinkouyouwenchuanganqiguzhang":"col220",
        "ex_huanrewenduchuanganqiguzhang":"col221",
        "ex_xitongwenduchuanganqiguzhang":"col222",
        "ex_nengliangshezhiwenduchuanganqiguzhang":"col223",
        "ex_zhengqiwenduchuanganqiguzhang":"col224",
        "ex_shineiwenduchuanganqiguzhang":"col225",
        "ex_1#dianliufankuichuanganqiguzhang":"col226",
        "ex_2#dianliufankuichuanganqiguzhang":"col227",
        "ex_3#dianliufankuichuanganqiguzhang":"col228",
        "ex_4#dianliufankuichuanganqiguzhang":"col229",
        "ex_5#dianliufankuichuanganqiguzhang":"col230",
        "ex_jiezhiwenduchuanganqiguzhang":"col231",
        "ex_xiyuwenduchuanganqiguzhang":"col232",
        "ex_huanjingwenduchuanganqiguzhang":"col233",
        "ex_jiezhiyalichuanganqiguzhang":"col234"
    }
    return CTL_NJZJ_IPK2_485
}
var CTL_NJZJ_IPK2_ExceptionInfosJson= function(){
    var CTL_NJZJ_IPK2={
        "ex_paiyanwendugaobaojing":"col1",
        "ex_lushuiwendugaobaojing":"col2",
        "ex_chukouwendugaobaojing":"col3",
        "ex_chaoyabaojing":"col4",
        "ex_jixiandishuiweibaojing":"col5",
        "ex_dishuiweibaojing":"col6",
        "ex_gaoshuiweibaojing":"col7",
        "ex_shuiweixinhaoluojicuobaojing":"col8",
        "ex_lubiwendugaobaojing":"col9",
        "ex_fuyazhengqiwendugaobaojing":"col10",
        "ex_ranshaoqiguzhangbaojing":"col11",
        "ex_ranqixieloubaojing":"col12",
        "ex_ranqiyalidibaojing":"col13",
        "ex_ranqiyaliyichangbaojing":"col14",
        "ex_ranqiyaligaobaojing":"col15",
        "ex_jishuibianpinqiguzhangbaojing":"col16",
        "ex_xunhuanbianpinqiguzhangbaojing":"col17",
        "ex_yinfengbianpinqiguzhangbaojing":"col18",
        "ex_gufengbianpinqiguzhangbaojing":"col19",
        "ex_ecigufengbianpinqiguzhangbaojing":"col20",
        "ex_lupaibianpinqiguzhangbaojing":"col21",
        "ex_addshuibengguzhangbaojing":"col22",
        "ex_xunhuanbengguzhangbaojing":"col23",
        "ex_qianyabaojing":"col24",
        "ex_didianyabaojing":"col25",
        "ex_gaodianyabaojing":"col26",
        "ex_quexiangbaojing":"col27",
        "ex_loudianbaojing":"col28",
        "ex_biansongqiguoyabaohu":"col29",
        "ex_guanjiancanshuyichang":"col30",
        "ex_shedingcanshuyichang":"col31",
        "ex_shizhongguzhang":"col32",
        "ex_cunchuqiguzhang":"col33",
        "ex_waibuliansuobaojing":"col34",
        "ex_queyoubaojing":"col35",
        "ex_diyouweibaojing":"col36",
        "ex_bentipaiyanwendugaobaojing":"col37",
        "ex_bianpinqiguzhangbaojing":"col38",
        "ex_meishuiwendugaobaojing":"col39",
        "ex_1haoguoluguzhang":"col40",
        "ex_2haoguoluguzhang":"col41",
        "ex_3haoguoluguzhang":"col42",
        "ex_4haoguoluguzhang":"col43",
        "ex_5haoguoluguzhang":"col44",
        "ex_6haoguoluguzhang":"col45",
        "ex_7haoguoluguzhang":"col46",
        "ex_8haoguoluguzhang":"col47",
        "ex_bushuibianpinqiguzhangbaojing":"col48",
        "ex_shuiliukaiguanbaohubaojing":"col49",
        "ex_rukouwendudibaojing":"col50",
        "ex_xunhuanbengbianpinqiguzhang":"col51",
        "ex_ecixunhuanbengbianpinqiguzhang":"col52",
        "ex_reshuibengbianpinqiguzhang":"col53",
        "ex_buyoubengbianpinqiguzhang":"col54",
        "ex_ecigufengbianpinqiguzhang":"col55",
        "ex_songliaojibianpinqiguzhang":"col56",
        "ex_zhenkongbengbianpinqiguzhang":"col57",
        "ex_lengningbengbianpinqiguzhang":"col58",
        "ex_addshuibengguzhang":"col59",
        "ex_buyoubengguzhang":"col60",
        "ex_lengningbengguzhang":"col61",
        "ex_reshuibengguzhang":"col62",
        "ex_zhenkongbengguzhang":"col63",
        "ex_ecixunhuanbengguzhang":"col64",
        "ex_huilu1xunhuanbengguzhang":"col65",
        "ex_huilu2xunhuanbengguzhang":"col66",
        "ex_huilu3xunhuanbengguzhang":"col67",
        "ex_huilu4xunhuanbengguzhang":"col68",
        "ex_huilu5xunhuanbengguzhang":"col69",
        "ex_huilu1wendugaobaojing":"col70",
        "ex_huilu2wendugaobaojing":"col71",
        "ex_huilu3wendugaobaojing":"col72",
        "ex_huilu4wendugaobaojing":"col73",
        "ex_huilu5wendugaobaojing":"col74",
        "ex_panguan1wendugaobaojing":"col75",
        "ex_panguan2wendugaobaojing":"col76",
        "ex_panguan3wendugaobaojing":"col77",
        "ex_panguan4wendugaobaojing":"col78",
        "ex_panguan5wendugaobaojing":"col79",
        "ex_panguan6wendugaobaojing":"col80",
        "ex_panguan7wendugaobaojing":"col81",
        "ex_panguan8wendugaobaojing":"col82",
        "ex_panguan9wendugaobaojing":"col83",
        "ex_panguan10wendugaobaojing":"col84",
        "ex_shanzhengguanchaoyabaojing":"col85",
        "ex_lengningguanchaoyabaojing":"col86",
        "ex_pengzhangguanchaoyabaojing":"col87",
        "ex_shanzhengguanyeweigaobaojing":"col88",
        "ex_shanzhengguanyeweidibaojing":"col89",
        "ex_lengningguanyeweigaobaojing":"col90",
        "ex_lengningguanyeweidibaojing":"col91",
        "ex_pengzhangguanyeweigaobaojing":"col92",
        "ex_pengzhangguanyeweidibaojing":"col93",
        "ex_jinchukouyachadibaojing":"col94",
        "ex_jinchukouyachagaobaojing":"col95",
        "ex_zhenkongyalibuzubaojing":"col96",
        "ex_jinchukouwenchadibaojing":"col97",
        "ex_jinchukouwenchagaobaojing":"col98",
        "ex_guoluhuohuiluchukouyaligaobaojing":"col99",
        "ex_guoluhuohuiluchukouyalidibaojing":"col100",
        "ex_guoluhuohuilurukouyaligaobaojing":"col101",
        "ex_guoluhuohuilurukouyalidibaojing":"col102",
        "ex_dongzuofankuiyichangyinfengjiguzhangbaojing":"col103",
        "ex_paiyanwenduchuanganqiguzhang":"col104",
        "ex_lushuiwenduchuanganqiguzhang":"col105",
        "ex_chukouwenduchuanganqiguzhang":"col106",
        "ex_rukouwenduchuanganqiguzhang":"col107",
        "ex_jienengqichukouwenduchuanganqiguzhang":"col108",
        "ex_jienengqirukouwenduchuanganqiguzhang":"col109",
        "ex_jishuiwenduchuanganqiguzhang":"col110",
        "ex_lutangwenduchuanganqiguzhang":"col111",
        "ex_lutangchukouwenduchuanganqiguzhang":"col112",
        "ex_lubiwenduchuanganqiguzhang":"col113",
        "ex_ranliaowenduchuanganqiguzhang":"col114",
        "ex_refengwenduchuanganqiguzhang":"col115",
        "ex_fuyazhengqiwenduchuanganqiguzhang":"col116",
        "ex_guorezhengqiwenduchuanganqiguzhang":"col117",
        "ex_huilu1wenduchuanganqiguzhang":"col118",
        "ex_huilu2wenduchuanganqiguzhang":"col119",
        "ex_huilu3wenduchuanganqiguzhang":"col120",
        "ex_huilu4wenduchuanganqiguzhang":"col121",
        "ex_huilu5wenduchuanganqiguzhang":"col122",
        "ex_shiwaiwenduchuanganqiguzhang":"col123",
        "ex_zhengqiyalichuanganqiguzhang":"col124",
        "ex_jishuiyalichuanganqiguzhang":"col125",
        "ex_chukouyalichuanganqiguzhang":"col126",
        "ex_rukouyalichuanganqiguzhang":"col127",
        "ex_lutangyalichuanganqiguzhang":"col128",
        "ex_lutangchukouyalichuanganqiguzhang":"col129",
        "ex_ranqiyalichuanganqiguzhang":"col130",
        "ex_yicifengyachuanganqiguzhang":"col131",
        "ex_ecifengyachuanganqiguzhang":"col132",
        "ex_ranliaoliangchuanganqiguzhang":"col133",
        "ex_zhengqiliuliangchuanganqiguzhang":"col134",
        "ex_jishuiliuliangchuanganqiguzhang":"col135",
        "ex_xunhuanliuliangchuanganqiguzhang":"col136",
        "ex_bushuiliuliangchuanganqiguzhang":"col137",
        "ex_guoluyeweichuanganqiguzhang":"col138",
        "ex_shuixiangyeweichuanganqiguzhang":"col139",
        "ex_paiyanyanghanliangchuanganqiguzhang":"col140",
        "ex_lupaisudufankuichuanganqiguzhang":"col141",
        "ex_yinfengshuchufankuichuanganqiguzhang":"col142",
        "ex_gufengshuchufankuichuanganqiguzhang":"col143",
        "ex_jishuishuchufankuichuanganqiguzhang":"col144",
        "ex_meishuiwenduchuanganqiguzhang":"col145",
        "ex_shuixiangwenduchuanganqiguzhang":"col146",
        "ex_pengzhangguanyeweichuanganqiguzhang":"col147",
        "ex_shanzhengguanyeweichuanganqiguzhang":"col148",
        "ex_lengningyeguanyeweichuanganqiguzhang":"col149",
        "ex_chuguanyeweichuanganqiguzhang":"col150",
        "ex_pengzhangguanwenduchuanganqiguzhang":"col151",
        "ex_shanzhengguanwenduchuanganqiguzhang":"col152",
        "ex_lengningyeguanwenduchuanganqiguzhang":"col153",
        "ex_chuguanwenduchuanganqiguzhang":"col154",
        "ex_guoluyalichuanganqiguzhang":"col155",
        "ex_guorezhengqiyalichuanganqiguzhang":"col156",
        "ex_paiyanchuyalichuanganqiguzhang":"col157",
        "ex_fengshifengyachuanganqiguzhang":"col158",
        "ex_yinfengjidianliuchuanganqiguzhang":"col159",
        "ex_gufengjidianliuchuanganqiguzhang":"col160",
        "ex_jiliaojisudufankuichuanganqiguzhang":"col161",
        "ex_panguan1wenduchuanganqiguzhang":"col162",
        "ex_panguan2wenduchuanganqiguzhang":"col163",
        "ex_panguan3wenduchuanganqiguzhang":"col164",
        "ex_panguan4wenduchuanganqiguzhang":"col165",
        "ex_panguan5wenduchuanganqiguzhang":"col166",
        "ex_panguan6wenduchuanganqiguzhang":"col167",
        "ex_panguan7wenduchuanganqiguzhang":"col168",
        "ex_panguan8wenduchuanganqiguzhang":"col169",
        "ex_panguan9wenduchuanganqiguzhang":"col170",
        "ex_panguan10wenduchuanganqiguzhang":"col171",
    }
    return CTL_NJZJ_IPK2
}
var CTL_NJRT_E3_DianZhengQi_ExceptionInfosJson= function(){
    var CTL_NJRT_E3_DianZhengQi={
        "ex_zhengqichuanganqiguzhangbaojing":"col1",
        "ex_jixiandishuiweibaojing":"col2",
        "ex_gaoshuiweibaojing":"col3",
        "ex_shuiweichuanganqiguzhang":"col4",
        "ex_chaoyabaojing":"col5",
        "ex_xitongguzhang":"col6"}
    return CTL_NJRT_E3_DianZhengQi
}
var CTL_NJRT_E3_DianReShui_ExceptionInfosJson= function(){
    var CTL_NJRT_E3_DianReShui={
        "ex_chushuiwenduchuanganqiguzhang":"col1",
        "ex_chushuiwendugaobaojing":"col2",
        "ex_huishuiwenduchuanganqiguzhang":"col3",
        "ex_jixiandishuiweibaojing":"col4",
        "ex_shuiweichuanganqiguzhang":"col5",
        "ex_chaoyabaojing":"col6",
        "ex_lubichaowenbaojing":"col7",
        "ex_xitongguzhang":"col8"}
    return CTL_NJRT_E3_DianReShui
}
var CTL_HNWE_485_ExceptionInfosJson= function(){
    var CTL_HNWE_485={
        "ex_OEMcuowuhao":"col1"}
    return CTL_HNWE_485
}

var PLC_RanYouZhengQi_RunInfojson = function(){
    var PLC_RanYouZhengQi={"mo_zhengqiyali":"col1", "mo_guorezhengqiyali":"col2", "mo_zhengqiwendu":"col3", "mo_guorezhengqiwendu":"col4", "mo_guolushuiwei":"col5", "mo_zhengqishunshiliuliang":"col6", "mo_bushuishunshiliuliang":"col7", "mo_lutangwendu":"col8", "mo_lutangyali":"col9", "mo_lengningqijinkouyanwen":"col10", "mo_lengningqijinkouyanya":"col11", "mo_jienengqijinkouyanwen":"col12", "mo_jienengqijinkouyanya":"col13", "mo_zhengqileijiliuliang":"col14", "mo_bushuileijiliuliang":"col15", "mo_kongyuqijinyanwendu":"col16", "mo_kongyuqijinyanyali":"col17", "mo_zuizhongpaiyanwendu":"col18", "mo_zuizhongpaiyanyali":"col19", "mo_lengningqijinshuiwendu":"col20", "mo_lengningqichushuiwendu":"col21", "mo_jienengqijinshuiwendu":"col22", "mo_jienengqichushuiwendu":"col23", "mo_lengningqichushuiyali":"col24", "mo_jienengqichushuiyali":"col25", "mo_addshuibengpinlüfankui":"col26", "mo_ruanshuixiangyewei":"col27", "mo_chuyangqiyewei":"col28", "mo_chuyangqiwendu":"col29", "mo_bushuidiandongfafankui":"col30", "mo_guoreqijiangwendiandongfafa":"col31", "mo_zhufengjipinlüfankui":"col32", "mo_xunhuanfengjipinlüfankui":"col33", "mo_kongyuqijinfengwendu":"col34", "mo_kongyuqijinfengyali":"col35", "mo_kongyuqichufengwendu":"col36", "mo_kongyuqichufengyali":"col37", "mo_zhaoqiyali":"col38", "mo_zhaoqishunshiliuliang":"col39", "mo_zhaoqileijiliuliang":"col40", "mo_zhaoqifengjipinlvfankui":"col41"}
    return PLC_RanYouZhengQi
}
var PLC_YuReZhengQi_RunInfojson = function(){
    var PLC_YuReZhengQi={
        "mo_zhengqiyali":"col1",
        "mo_zhengqiwendu":"col2",
        "mo_guoluyewei":"col3",
        "mo_zhengqishunshiliuliang":"col4",
        "mo_bushuishunshiliuliang":"col5",
        "mo_zhengqileijiliuliang":"col6",
        "mo_bushuileijiliuliang":"col7",
        "mo_jinyanwendu":"col8",
        "mo_jinyanyali":"col9",
        "mo_chuyanwendu":"col10",
        "mo_chuyanyali":"col11",
        "mo_bushuiwendu":"col12",
        "mo_bushuiyali":"col13",
        "mo_bushuibengpinlvfankui":"col14",
        "mo_chushuibengpinlvfankui":"col15",
        "mo_ruanshuixiangyewei":"col16",
        "mo_chuyangqiyewei":"col17",
        "mo_chuyangqiwendu":"col18",
        "mo_chuyangqiyali":"col19",
        "mo_bushuidiandongfafankui":"col20",
        "mo_chuyangbushuidiandongfafankui":"col21",
        "mo_chuyangzhengqidiandongfafankui":"col22",
        "mo_jinyandiandongfafankui":"col23",
        "mo_chuyandiandongfafankui":"col24",
        "mo_guoluzhuzhengqitiaojiefafankui":"col25",
        "mo_shigufangshuidiandongfafankui":"col26",
        "mo_jinjipaiqidiandongfafankui":"col27",
        "mo_panyanwenduxianshi":"col28",
    }
    return PLC_YuReZhengQi
}
var PLC_RanYouZhenKong_RunInfojson = function(){
    var PLC_RanYouZhenKong={
        "mo_remeishuiwendu":"col1;",
        "mo_zhenkongyali;":"col2" ,
        "mo_jinyanwendu;":"col3" ,
        "mo_paiyanwendu;":"col4" ,
        "mo_shiwaiwendu;":"col5" ,
        "mo_cainuanchushuiwendu;":"col6" ,
        "mo_cainuanhuishuiwendu;":"col7" ,
        "mo_cainuanchushuiyali;":"col8" ,
        "mo_cainuanhuishuiyali;":"col9" ,
        "mo_shenghuochushuiwendu;":"col10",
        "mo_shenghuohuishuiwendu;":"col11",
        "mo_shenghuochushuiyali;":"col12",
        "mo_shenghuohuishuiyali;":"col13",
    }
    return PLC_RanYouZhenKong
}
var PLC_RanYouReShui_RunInfojson = function(){
    var PLC_RanYouReShui={
        "mo_chushuiwendu":"col1" ,
        "mo_huishuiwendu":"col2" ,
        "mo_paiyanwendu":"col3",
        "mo_chushuiyali":"col4" ,
        "mo_huishuiyali":"col5" ,
        "mo_yacha":"col6" ,
        "mo_lengningqijinyanwendu":"col7" ,
        "mo_lengningqijinyanyali":"col8" ,
        "mo_jienengqijinyanwendu":"col9" ,
        "mo_jienengqijinyanyali":"col10",
        "mo_lutangwendu":"col11",
        "mo_lutangyali":"col12",
        "mo_kongyuqijinyanwendu":"col13",
        "mo_kongyuqijinyanyali":"col14",
        "mo_kongyuqijinfengwendu":"col15",
        "mo_kongyuqijinfengyali":"col16",
        "mo_kongyuqichufengwendu":"col17",
        "mo_zhufengjipinlüfankui":"col18",
        "mo_xunhuanfengjipinlüfankui":"col19",
        "mo_addshuibengpinlüfankui":"col20",
        "mo_shiwaiwendu":"col21",
        "mo_xunhuanbeng1pinlüfankui":"col22",
        "mo_xunhuanbeng2pinlüfankui":"col23",
    }
    return PLC_RanYouReShui
}
var PLC_RanYouDaoReYou_RunInfojson = function(){
    var PLC_RanYouDaoReYou={
        "mo_jinkouwendu":"col1",
        "mo_chukouwendu":"col2" ,
        "mo_gaoweiyoucaowendu":"col3" ,
        "mo_paiyanwendu":"col4" ,
        "mo_lutangwendu":"col5" ,
        "mo_lutangchukouwendu":"col6" ,
        "mo_kongyuqianwendu":"col7" ,
        "mo_kongyuhouwendu":"col8" ,
        "mo_jinkouyali":"col9" ,
        "mo_chukouyali":"col10",
        "mo_danqiyali":"col11",
        "mo_lutangyali":"col12",
        "mo_gaoweiyoucaowei":"col13",
        "mo_chuyouguanyouwei":"col14",
        "mo_liuliangceliang":"col15",
        "mo_diandongtiaojiefashuchu":"col16",
        "mo_bianpinqipinlvshuchu":"col17",
    }
    return PLC_RanYouDaoReYou
}
var PLC_RanMeiZhengQi_RunInfojson = function(){
    var PLC_RanMeiZhengQi={
        "mo_zhengqiyali":"col1" ,
        "mo_guoluyewei":"col2" ,
        "mo_zhengqishunshiliuliang":"col3" ,
        "mo_bushuishunshiliuliang":"col4" ,
        "mo_lutangwendu":"col5" ,
        "mo_lutangyali":"col6" ,
        "mo_shengmeiqijinkouyanwen":"col7" ,
        "mo_zuizhongpaiyanwendu":"col8" ,
        "mo_zhengqileijiliuliang":"col9" ,
        "mo_bushuileijiliuliang":"col10",
        "mo_shengmeiqijinshuiwendu":"col11",
        "mo_shengmeiqichushuiwendu":"col12",
        "mo_bushuiwendu":"col13",
        "mo_paiyanyali":"col14",
        "mo_addshuibengpinlvfankui":"col15",
        "mo_yinfengjipinlvfankui":"col16",
        "mo_gufengjipinlvfankui":"col17",
        "mo_ruanshuixiangyewei":"col18",
        "mo_guorezhengqiyali":"col19",
        "mo_chuyangqiyewei":"col20",
        "mo_guoreqichukouyanwen":"col21",
        "mo_guoreqizhengqiwendu":"col22",
        "mo_baohezhengqiwendu":"col23",
        "mo_yureqijinyanwendu":"col24",
        "mo_yureqijinyanyali":"col25",
        "mo_chuyangqiwendu":"col26",
        "mo_chuyangqiyali":"col27",
        "mo_chuyangbengpinlvfankui":"col28",
        "mo_bushuidiandongfafankui":"col29",
        "mo_jianwenshuidiandongfafan":"col30",
        "mo_chuyangjiarediandongfafa":"col31",
        "mo_zhaoqiyali":"col32",
        "mo_lutangchukouyanwen":"col33",
        "mo_kongyuqichukouyanwen":"col34",
        "mo_shengmeiqichukouyanwen":"col35",
    }
    return PLC_RanMeiZhengQi
}
var PLC_DianZhengQi_RunInfojson = function(){
    var PLC_DianZhengQi={
        "mo_zhengqiyali":"col1" ,
        "mo_zhengqiwendu":"col2" ,
        "mo_guolushuiwei":"col3" ,
        "mo_zhengqishunshiliuliang":"col4" ,
        "mo_bushuishunshiliuliang":"col5" ,
        "mo_zhengqileijiliuliang":"col6" ,
        "mo_bushuileijiliuliang":"col7" ,
        "mo_jinshuiwendu":"col8" ,
        "mo_jinshuiyali":"col9" ,
        "mo_addshuibengpinlvfankui":"col10",
        "mo_ruanshuixiangyewei":"col11",
        "mo_qidongjiarezushu":"col12",
        "mo_qidongjiarezushubaifenbi":"col13",
    }
    return PLC_DianZhengQi
}
var PLC_DianReShui_RunInfojson = function(){
    var PLC_DianReShui={
        "mo_chushuiwendu":"col1",
        "mo_huishuiwendu":"col2",
        "mo_chushuiyali":"col3",
        "mo_huishuiyali":"col4",
        "mo_qidongjiarezushu":"col5",
        "mo_qidongjiarezushubaifenbi":"col6",
    }
    return PLC_DianReShui
}

var CTL_HNWE_485_RunInfojson = function(){
    var CTL_HNWE_485={
        "mo_jiarexuqiu":"col1",
        "mo_shedingzhi":"col2",
        "mo_CHgongshuiwendu":"col3",
        "mo_CHhuishuiwendu":"col4",
        "mo_OTCwendu":"col5",
        "mo_huoyandianliu":"col6",
        "mo_diaojieshuiping":"col7",
        "mo_jisuanhoudeshedi":"col8",
        "mo_CHzuidashedingzh":"col9",
    }
    return CTL_HNWE_485
}
var CTL_NJRT_E3_DianReShui_RunInfojson = function(){
    var CTL_NJRT_E3_DianReShui={"mo_chushuiwendu":"col1", "mo_huishuiwendu":"col2"}
    return CTL_NJRT_E3_DianReShui
}
var CTL_NJRT_E3_DianZhengQi_RunInfojson = function(){
    var CTL_NJRT_E3_DianZhengQi={"mo_zhengqiyali":"col1"}
    return CTL_NJRT_E3_DianZhengQi
}
var CTL_NJZJ_IPK2_RunInfojson = function(){
    var CTL_NJZJ_IPK2={
        "mo_bentipaiyanwendu":"col1",
        "mo_paiyanwendu":"col2",
        "mo_lushuiwendu":"col3",
        "mo_chukouwendu":"col4",
        "mo_rukouwendu":"col5",
        "mo_jienengqichukouwendu":"col6",
        "mo_jienengqirukouwendu":"col7",
        "mo_jishuiwendu":"col8",
        "mo_lutangwendu":"col9",
        "mo_lutangchukouwendu":"col10",
        "mo_lubiwendu":"col11",
        "mo_ranliaowendu":"col12",
        "mo_refengwendu":"col13",
        "mo_fuyazhengqiwendu":"col14",
        "mo_guorezhengqiwendu":"col15",
        "mo_huilu1wendu":"col16",
        "mo_huilu2wendu":"col17",
        "mo_huilu3wendu":"col18",
        "mo_huilu4wendu":"col19",
        "mo_huilu5wendu":"col20",
        "mo_shiwaiwendu":"col21",
        "mo_zhengqiyali":"col22",
        "mo_jishuiyali":"col23",
        "mo_chukouyali":"col24",
        "mo_rukouyali":"col25",
        "mo_lutangyali":"col26",
        "mo_lutangchukouyali":"col27",
        "mo_ranqiyali":"col28",
        "mo_yicifengya":"col29",
        "mo_ecifengya":"col30",
        "mo_ranliaoliang":"col31",
        "mo_zhengqiliuliang":"col32",
        "mo_jishuiliuliang":"col33",
        "mo_xunhuanliuliang":"col34",
        "mo_bushuiliuliang":"col35",
        "mo_guoluyewei":"col36",
        "mo_shuixiangyewei":"col37",
        "mo_paiyanyanghanliang":"col38",
        "mo_lupaisudufankui":"col39",
        "mo_yinfengshuchufankui":"col40",
        "mo_gufengshuchufankui":"col41",
        "mo_jishuishuchufankui":"col42",
        "mo_meishuiwendu":"col43",
        "mo_shuixiangwendu":"col44",
        "mo_pengzhangguanyewei":"col45",
        "mo_shanzhengguanyewei":"col46",
        "mo_lengningyeguanyewei":"col47",
        "mo_chuguanyewei":"col48",
        "mo_pengzhangguanwendu":"col49",
        "mo_shanzhengguanwendu":"col50",
        "mo_lengningyeguanwendu":"col51",
        "mo_chuguanwendu":"col52",
        "mo_guoluyali":"col53",
        "mo_guorezhengqiyali":"col54",
        "mo_paiyanchuyali":"col55",
        "mo_fengshifengya":"col56",
        "mo_yinfengjidianliu":"col57",
        "mo_gufengjidianliu":"col58",
        "mo_jiliaojisudufankui":"col59",
        "mo_panguan1wendu":"col60",
        "mo_panguan2wendu":"col61",
        "mo_panguan3wendu":"col62",
        "mo_panguan4wendu":"col63",
        "mo_panguan5wendu":"col64",
        "mo_panguan6wendu":"col65",
        "mo_panguan7wendu":"col66",
        "mo_panguan8wendu":"col67",
        "mo_panguan9wendu":"col68",
        "mo_panguan10wendu":"col69"}
    return CTL_NJZJ_IPK2
}
var CTL_NJZJ_IPK2_485_RunInfojson = function(){
    var CTL_NJZJ_IPK2_485={
        "mo_bentipaiyanwendu":"col1",
        "mo_paiyanwendu":"col2",
        "mo_lushuiwendu":"col3",
        "mo_chukouwendu":"col4",
        "mo_jinkouwendu":"col5",
        "mo_jienengqichukouwendu(shui_":"col6",
        "mo_jienengqijinkouwendu(shui_":"col7",
        "mo_jishuiwendu":"col8",
        "mo_lutangwendu":"col9",
        "mo_lutangchukouwendu":"col10",
        "mo_lubiwendu":"col11",
        "mo_ranliaowendu":"col12",
        "mo_refengwendu_kongyuqichukou_":"col13",
        "mo_fuyazhengqiwendu":"col14",
        "mo_guorezhengqiwendu":"col15",
        "mo_huilu1wendu":"col16",
        "mo_huilu2wendu":"col17",
        "mo_huilu3wendu":"col18",
        "mo_huilu4wendu":"col19",
        "mo_huilu5wendu":"col20",
        "mo_shiwaiwendu":"col21",
        "mo_zhengqiyali":"col22",
        "mo_jishuiyali":"col23",
        "mo_chukouyali":"col24",
        "mo_jinkouyali":"col25",
        "mo_lutangyali":"col26",
        "mo_lutangchukouyali":"col27",
        "mo_ranqiyali":"col28",
        "mo_yicifengya":"col29",
        "mo_ecifengya":"col30",
        "mo_ranliaoliang_shunshizhi_":"col31",
        "mo_zhengqiliuliang_shunshizhi_":"col32",
        "mo_jishuiliuliang_shunshizhi_":"col33",
        "mo_xunhuanliuliang_shunshizhi_":"col34",
        "mo_bushuiliuliang_shunshizhi_":"col35",
        "mo_guoluyewei":"col36",
        "mo_shuixiangyewei":"col37",
        "mo_paiyanyanghanliang":"col38",
        "mo_lupaisudufankui":"col39",
        "mo_yinfengshuchufankui":"col40",
        "mo_gufengshuchufankui":"col41",
        "mo_jishuishuchufankui":"col42",
        "mo_meishuiwendu":"col43",
        "mo_shuixiangwendu":"col44",
        "mo_pengzhangguanyewei":"col45",
        "mo_shanzhengguanyewei":"col46",
        "mo_lengningyeguanyewei":"col47",
        "mo_chuguanyewei":"col48",
        "mo_pengzhangguanwendu":"col49",
        "mo_shanzhengguanwendu":"col50",
        "mo_lengningyeguanwendu":"col51",
        "mo_chuguanwendu":"col52",
        "mo_xitongyali_yongyuchengyareshuiguolu_":"col53",
        "mo_guorezhengqiyali":"col54",
        "mo_paiyanchuyali":"col55",
        "mo_fengshifengya":"col56",
        "mo_yinfengjidianliu":"col57",
        "mo_gufengjidianliu":"col58",
        "mo_jiliaojisudufankui":"col59",
        "mo_panguan1wendu":"col60",
        "mo_panguan2wendu":"col61",
        "mo_panguan3wendu":"col62",
        "mo_panguan4wendu":"col63",
        "mo_panguan5wendu":"col64",
        "mo_panguan6wendu":"col65",
        "mo_panguan7wendu":"col66",
        "mo_panguan8wendu":"col67",
        "mo_panguan9wendu":"col68",
        "mo_panguan10wendu":"col69",
        "mo_cainuanchukouwendu":"col70",
        "mo_reshuichukouwendu":"col71",
        "mo_jinchukouyacha":"col72",
        "mo_1#chukouwendu":"col73",
        "mo_2#chukouwendu":"col74",
        "mo_jienengqichukouyanwen":"col75",
        "mo_jienengqijinkouyanwen":"col76",
        "mo_lengningqichukouwendu_shui_":"col77",
        "mo_lengningqijinkouwendu_shui_":"col78",
        "mo_lengningqichukouyanwen":"col79",
        "mo_lengningqijinkouyanwen":"col80",
        "mo_cainuanjinkouwendu":"col81",
        "mo_reshuijinkouwendu":"col82",
        "mo_kongzhixiangwendu":"col83",
        "mo_zhenkongyali":"col84",
        "mo_chushuiwendu":"col85",
        "mo_jinshuiwendu":"col86",
        "mo_youwenjiance":"col87",
        "mo_gaowenbaohu":"col88",
        "mo_chukouyouwen":"col89",
        "mo_jinkouyouwen":"col90",
        "mo_huanrewendu":"col91",
        "mo_xitongwendu":"col92",
        "mo_nengliangshezhiwendu":"col93",
        "mo_zhengqiwendu":"col94",
        "mo_shineiwendu":"col95",
        "mo_1#dianliufankui":"col96",
        "mo_2#dianliufankui":"col97",
        "mo_3#dianliufankui":"col98",
        "mo_4#dianliufankui":"col99",
        "mo_5#dianliufankui":"col100",
        "mo_jiezhiwendu":"col101",
        "mo_xiyuwendu":"col102",
        "mo_huanjingwendu":"col103",
        "mo_jiezhiyali":"col104",}
    return CTL_NJZJ_IPK2_485
}
var CTL_NJZJ_IPT2_RunInfojson = function(){
    var CTL_NJZJ_IPT2={
        "mo_bentipaiyanwendu":"col1",
        "mo_paiyanwendu":"col2",
        "mo_lushuiwendu":"col3",
        "mo_chukouwendu":"col4",
        "mo_rukouwendu":"col5",
        "mo_jienengqichukouwendu":"col6",
        "mo_jienengqirukouwendu":"col7",
        "mo_jishuiwendu":"col8",
        "mo_lutangwendu":"col9",
        "mo_lutangchukouwendu":"col10",
        "mo_lubiwendu":"col11",
        "mo_ranliaowendu":"col12",
        "mo_refengwendu":"col13",
        "mo_fuyazhengqiwendu":"col14",
        "mo_guorezhengqiwendu":"col15",
        "mo_huilu1wendu":"col16",
        "mo_huilu2wendu":"col17",
        "mo_huilu3wendu":"col18",
        "mo_huilu4wendu":"col19",
        "mo_huilu5wendu":"col20",
        "mo_shiwaiwendu":"col21",
        "mo_zhengqiyali":"col22",
        "mo_jishuiyali":"col23",
        "mo_chukouyali":"col24",
        "mo_rukouyali":"col25",
        "mo_lutangyali":"col26",
        "mo_lutangchukouyali":"col27",
        "mo_ranqiyali":"col28",
        "mo_yicifengya":"col29",
        "mo_ecifengya":"col30",
        "mo_ranliaoliang":"col31",
        "mo_zhengqiliuliang":"col32",
        "mo_jishuiliuliang":"col33",
        "mo_xunhuanliuliang":"col34",
        "mo_bushuiliuliang":"col35",
        "mo_guoluyewei":"col36",
        "mo_shuixiangyewei":"col37",
        "mo_paiyanyanghanliang":"col38",
        "mo_lupaisudufankui":"col39",
        "mo_yinfengshuchufankui":"col40",
        "mo_gufengshuchufankui":"col41",
        "mo_jishuishuchufankui":"col42",
        "mo_meishuiwendu":"col43",
        "mo_shuixiangwendu":"col44",
        "mo_pengzhangguanyewei":"col45",
        "mo_shanzhengguanyewei":"col46",
        "mo_lengningyeguanyewei":"col47",
        "mo_chuguanyewei":"col48",
        "mo_pengzhangguanwendu":"col49",
        "mo_shanzhengguanwendu":"col50",
        "mo_lengningyeguanwendu":"col51",
        "mo_chuguanwendu":"col52",
        "mo_guoluyali":"col53",
        "mo_guorezhengqiyali":"col54",
        "mo_paiyanchuyali":"col55",
        "mo_fengshifengya":"col56",
        "mo_yinfengjidianliu":"col57",
        "mo_gufengjidianliu":"col58",
        "mo_jiliaojisudufankui":"col59",
        "mo_panguan1wendu":"col60",
        "mo_panguan2wendu":"col61",
        "mo_panguan3wendu":"col62",
        "mo_panguan4wendu":"col63",
        "mo_panguan5wendu":"col64",
        "mo_panguan6wendu":"col65",
        "mo_panguan7wendu":"col66",
        "mo_panguan8wendu":"col67",
        "mo_panguan9wendu":"col68",
        "mo_panguan10wendu":"col69"}
    return CTL_NJZJ_IPT2
}
var CTL_NJZJ_IPT2_485_RunInfojson = function(){
    var CTL_NJZJ_IPT2_485={
        "mo_bentipaiyanwendu":"col1",
        "mo_paiyanwendu":"col2",
        "mo_lushuiwendu":"col3",
        "mo_chukouwendu":"col4",
        "mo_jinkouwendu":"col5",
        "mo_jienengqichukouwendu(shui_":"col6",
        "mo_jienengqijinkouwendu(shui_":"col7",
        "mo_jishuiwendu":"col8",
        "mo_lutangwendu":"col9",
        "mo_lutangchukouwendu":"col10",
        "mo_lubiwendu":"col11",
        "mo_ranliaowendu":"col12",
        "mo_refengwendu_kongyuqichukou_":"col13",
        "mo_fuyazhengqiwendu":"col14",
        "mo_guorezhengqiwendu":"col15",
        "mo_huilu1wendu":"col16",
        "mo_huilu2wendu":"col17",
        "mo_huilu3wendu":"col18",
        "mo_huilu4wendu":"col19",
        "mo_huilu5wendu":"col20",
        "mo_shiwaiwendu":"col21",
        "mo_zhengqiyali":"col22",
        "mo_jishuiyali":"col23",
        "mo_chukouyali":"col24",
        "mo_jinkouyali":"col25",
        "mo_lutangyali":"col26",
        "mo_lutangchukouyali":"col27",
        "mo_ranqiyali":"col28",
        "mo_yicifengya":"col29",
        "mo_ecifengya":"col30",
        "mo_ranliaoliang_shunshizhi_":"col31",
        "mo_zhengqiliuliang_shunshizhi_":"col32",
        "mo_jishuiliuliang_shunshizhi_":"col33",
        "mo_xunhuanliuliang_shunshizhi_":"col34",
        "mo_bushuiliuliang_shunshizhi_":"col35",
        "mo_guoluyewei":"col36",
        "mo_shuixiangyewei":"col37",
        "mo_paiyanyanghanliang":"col38",
        "mo_lupaisudufankui":"col39",
        "mo_yinfengshuchufankui":"col40",
        "mo_gufengshuchufankui":"col41",
        "mo_jishuishuchufankui":"col42",
        "mo_meishuiwendu":"col43",
        "mo_shuixiangwendu":"col44",
        "mo_pengzhangguanyewei":"col45",
        "mo_shanzhengguanyewei":"col46",
        "mo_lengningyeguanyewei":"col47",
        "mo_chuguanyewei":"col48",
        "mo_pengzhangguanwendu":"col49",
        "mo_shanzhengguanwendu":"col50",
        "mo_lengningyeguanwendu":"col51",
        "mo_chuguanwendu":"col52",
        "mo_xitongyali_yongyuchengyareshuiguolu_":"col53",
        "mo_guorezhengqiyali":"col54",
        "mo_paiyanchuyali":"col55",
        "mo_fengshifengya":"col56",
        "mo_yinfengjidianliu":"col57",
        "mo_gufengjidianliu":"col58",
        "mo_jiliaojisudufankui":"col59",
        "mo_panguan1wendu":"col60",
        "mo_panguan2wendu":"col61",
        "mo_panguan3wendu":"col62",
        "mo_panguan4wendu":"col63",
        "mo_panguan5wendu":"col64",
        "mo_panguan6wendu":"col65",
        "mo_panguan7wendu":"col66",
        "mo_panguan8wendu":"col67",
        "mo_panguan9wendu":"col68",
        "mo_panguan10wendu":"col69",
        "mo_cainuanchukouwendu":"col70",
        "mo_reshuichukouwendu":"col71",
        "mo_jinchukouyacha":"col72",
        "mo_1#chukouwendu":"col73",
        "mo_2#chukouwendu":"col74",
        "mo_jienengqichukouyanwen":"col75",
        "mo_jienengqijinkouyanwen":"col76",
        "mo_lengningqichukouwendu_shui_":"col77",
        "mo_lengningqijinkouwendu_shui_":"col78",
        "mo_lengningqichukouyanwen":"col79",
        "mo_lengningqijinkouyanwen":"col80",
        "mo_cainuanjinkouwendu":"col81",
        "mo_reshuijinkouwendu":"col82",
        "mo_kongzhixiangwendu":"col83",
        "mo_zhenkongyali":"col84",
        "mo_chushuiwendu":"col85",
        "mo_jinshuiwendu":"col86",
        "mo_youwenjiance":"col87",
        "mo_gaowenbaohu":"col88",
        "mo_chukouyouwen":"col89",
        "mo_jinkouyouwen":"col90",
        "mo_huanrewendu":"col91",
        "mo_xitongwendu":"col92",
        "mo_nengliangshezhiwendu":"col93",
        "mo_zhengqiwendu":"col94",
        "mo_shineiwendu":"col95",
        "mo_1#dianliufankui":"col96",
        "mo_2#dianliufankui":"col97",
        "mo_3#dianliufankui":"col98",
        "mo_4#dianliufankui":"col99",
        "mo_5#dianliufankui":"col100",
        "mo_jiezhiwendu":"col101",
        "mo_xiyuwendu":"col102",
        "mo_huanjingwendu":"col103",
        "mo_jiezhiyali":"col104",}
    return CTL_NJZJ_IPT2_485
}
var CTL_RT_H1_RYRS_RunInfojson = function(){
    var CTL_RT_H1_RYRS={
        "mo_chushuiwendu":"col1",
        "mo_huishuiwendu":"col2",
        "mo_paiyanwendu":"col3"}
    return CTL_RT_H1_RYRS
}
var CTL_RT_H1_RYZQ_RunInfojson = function(){
    var CTL_RT_H1_RYZQ={
        "mo_paiyanwendu":"col1",
        "mo_zhengqiyali":"col2",
        "20mAxinhaolianxujishui":"col3"}
    return CTL_RT_H1_RYZQ
}
var CTL_RT_T2_RYRS_18126024_RunInfojson = function(){
    var CTL_RT_T2_RYRS_18126024={
        "mo_chushuiwendu":"col1",
        "mo_huishuiwendu":"col2",
        "mo_paiyanwendu":"col3"}
    return CTL_RT_T2_RYRS_18126024
}
var CTL_RT_T2_RYZQ_YLBSQ_RunInfojson = function(){
    var CTL_RT_T2_RYZQ_YLBSQ={
        "mo_lengningqiyanwen":"col1",
        "mo_jishuiwendu":"col2",
        "mo_zhengqiyali":"col3",
        "mo_shuiweixinhao":"col4",
        "mo_paiyanwendu":"col5",
        "mo_jienengqiyanwen":"col6"}
    return CTL_RT_T2_RYZQ_YLBSQ
}
var CTL_RT_T2_RYZQ_YLBSQ_171013102_RunInfojson = function(){
    var CTL_RT_T2_RYZQ_YLBSQ_171013102={
        "mo_lengningqiyanwen":"col1",
        "mo_jishuiwendu":"col2",
        "mo_zhengqiyali":"col3",
        "mo_shuiweixinhao":"col4",
        "mo_paiyanwendu":"col5",
        "mo_jienengqiyanwen":"col6"}
    return CTL_RT_T2_RYZQ_YLBSQ_171013102
}
var CTL_RT_T2_RYZQ_YLBSQ_180436007_RunInfojson = function(){
    var CTL_RT_T2_RYZQ_YLBSQ_180436007={
        "mo_lengningqiyanwen":"col1",
        "mo_jishuiwendu":"col2",
        "mo_zhengqiyali":"col3",
        "mo_shuiweixinhao":"col4",
        "mo_paiyanwendu":"col5",
        "mo_jienengqiyanwen":"col6"}
    return CTL_RT_T2_RYZQ_YLBSQ_180436007
}
var CTL_RT_T2_RYZQ_YLBSQ_180839008_RunInfojson = function(){
    var CTL_RT_T2_RYZQ_YLBSQ_180839008={
        "mo_lengningqiyanwen":"col1",
        "mo_jishuiwendu":"col2",
        "mo_zhengqiyali":"col3",
        "mo_shuiweixinhao":"col4",
        "mo_paiyanwendu":"col5",
        "mo_jienengqiyanwen":"col6"}
    return CTL_RT_T2_RYZQ_YLBSQ_180839008
}
var CTL_RT_T2_RYZQ_YLBSQ_190244133_RunInfojson = function(){
    var CTL_RT_T2_RYZQ_YLBSQ_190244133={
        "mo_lengningqiyanwen":"col1",
        "mo_jishuiwendu":"col2",
        "mo_zhengqiyali":"col3",
        "mo_shuiweixinhao":"col4",
        "mo_paiyanwendu":"col5",
        "mo_jienengqiyanwen":"col6"}
    return CTL_RT_T2_RYZQ_YLBSQ_190244133
}
var CTL_RT_T2_RYZQ_YLKZQ_RunInfojson = function(){
    var CTL_RT_T2_RYZQ_YLKZQ={
        "mo_lengningqiyanwen":"col1",
        "mo_jishuiwendu":"col2",
        "mo_shuiweixinhao":"col3",
        "mo_paiyanwendu":"col4",
        "mo_jienengqiyanwen":"col5",
    }
    return CTL_RT_T2_RYZQ_YLKZQ
}
var CTL_RT_T2_RYZQ_YLKZQ_171013102_RunInfojson = function(){
    var CTL_RT_T2_RYZQ_YLKZQ_171013102={
        "mo_lengningqiyanwen":"col1",
        "mo_jishuiwendu":"col2",
        "mo_shuiweixinhao":"col3",
        "mo_paiyanwendu":"col4",
        "mo_jienengqiyanwen":"col5",
    }
    return CTL_RT_T2_RYZQ_YLKZQ_171013102
}
var CTL_RT_T2_RYZQ_YLKZQ_180436007_RunInfojson = function(){
    var CTL_RT_T2_RYZQ_YLKZQ_180436007={
        "mo_lengningqiyanwen":"col1",
        "mo_jishuiwendu":"col2",
        "mo_shuiweixinhao":"col3",
        "mo_paiyanwendu":"col4",
        "mo_jienengqiyanwen":"col5",
    }
    return CTL_RT_T2_RYZQ_YLKZQ_180436007
}
var CTL_RT_T2_RYZQ_YLKZQ_180839008_RunInfojson = function(){
    var CTL_RT_T2_RYZQ_YLKZQ_180839008={
        "mo_lengningqiyanwen":"col1",
        "mo_jishuiwendu":"col2",
        "mo_shuiweixinhao":"col3",
        "mo_paiyanwendu":"col4",
        "mo_jienengqiyanwen":"col5",
    }
    return CTL_RT_T2_RYZQ_YLKZQ_180839008
}
var CTL_RT_T2_RYZQ_YLKZQ_190244133_RunInfojson = function(){
    var CTL_RT_T2_RYZQ_YLKZQ_190244133={
        "mo_lengningqiyanwen":"col1",
        "mo_jishuiwendu":"col2",
        "mo_shuiweixinhao":"col3",
        "mo_paiyanwendu":"col4",
        "mo_jienengqiyanwen":"col5",
    }
    return CTL_RT_T2_RYZQ_YLKZQ_190244133
}
var CTL_RT_T3_RYZQ_YLBSQ_RunInfojson = function(){
    var CTL_RT_T3_RYZQ_YLBSQ={
        "mo_lengningqiyanwen":"col1",
        "mo_jishuiwendu":"col2",
        "mo_zhengqiyali":"col3",
        "mo_shuiweixinhao":"col4",
        "mo_paiyanwendu":"col5",
        "mo_jienengqiyanwen":"col6"}
    return CTL_RT_T3_RYZQ_YLBSQ
}
var CTL_RT_T3_RYZQ_YLKZQ_RunInfojson = function(){
    var CTL_RT_T3_RYZQ_YLKZQ={
        "mo_lengningqiyanwen":"col1",
        "mo_jishuiwendu":"col2",
        "mo_zhengqiyali":"col3",
        "mo_shuiweixinhao":"col4",
        "mo_paiyanwendu":"col5",
        "mo_jienengqiyanwen":"col6"}
    return CTL_RT_T3_RYZQ_YLKZQ
}
var CTL_RT_T4_RYZQ_4_RunInfojson = function(){
    var CTL_RT_T4_RYZQ_4={
        "mo_zhengqiyali":"col1",
        "mo_paiyanwendu":"col2",
        "mo_zhengqiwendu":"col3",
        "mo_qibaoshuiwei":"col4"}
    return CTL_RT_T4_RYZQ_4
}
var CTL_RT_X1_DRS_RunInfojson = function(){
    var CTL_RT_X1_DRS={
        "mo_chushuiwendu":"col1"}
    return CTL_RT_X1_DRS
}
var CTL_RT_X1_RYCYRS_EDH_RunInfojson = function(){
    var CTL_RT_X1_RYCYRS_EDH={
        "mo_chushuiwendu":"col1"}
    return CTL_RT_X1_RYCYRS_EDH
}
var CTL_RT_X1_RYKS_YDH_RunInfojson = function(){
    var CTL_RT_X1_RYKS_YDH={
        "mo_chushuiwendu":"col1"}
    return CTL_RT_X1_RYKS_YDH
}
var CTL_RT_X1_RYRS_EDH_RunInfojson = function(){
    var CTL_RT_X1_RYRS_EDH={
        "mo_chushuiwendu":"col1"}
    return CTL_RT_X1_RYRS_EDH
}
var CTL_RT_X1_RYRS_YDH_RunInfojson = function(){
    var CTL_RT_X1_RYRS_YDH={
        "mo_chushuiwendu":"col1"}
    return CTL_RT_X1_RYRS_YDH
}
var CTL_RT_X1_RYRSGW_EDH_RunInfojson = function(){
    var CTL_RT_X1_RYRSGW_EDH={
        "mo_chushuiwendu":"col1"}
    return CTL_RT_X1_RYRSGW_EDH
}
var CTL_RT_X1_RYZQ_EDH_5_RunInfojson = function(){
    var CTL_RT_X1_RYZQ_EDH_5={
        "mo_paiyanwendu":"col1"}
    return CTL_RT_X1_RYZQ_EDH_5
}
var CTL_RT_X1_RYZQ_EDH_6_RunInfojson = function(){
    var CTL_RT_X1_RYZQ_EDH_6={
        "mo_paiyanwendu":"col1"}
    return CTL_RT_X1_RYZQ_EDH_6
}
var CTL_RT_X6_RYRS_RunInfojson = function(){
    var CTL_RT_X6_RYRS={
        "mo_chushuiwendu":"col1",
        "mo_huishuiwendu":"col2",
        "mo_paiyanwendu":"col3"}
    return CTL_RT_X6_RYRS
}


module.exports = app;
