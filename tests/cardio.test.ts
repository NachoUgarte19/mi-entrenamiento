import { test } from "node:test";
import assert from "node:assert/strict";
import { cardioSchema, cardioPace, cardioWeek, cardioDuration, backupParse, type Cardio } from "../lib/model";
const base:Cardio={id:"cardio-test",activity:"run",date:"2026-09-28",distanceKm:5,durationSeconds:1800,rpe:null,notes:""};
test("cardio validates real dates, positive measurements and optional effort",()=>{
 assert.equal(cardioSchema.safeParse(base).success,true);
 for(const patch of [{distanceKm:0},{distanceKm:-1},{durationSeconds:0},{durationSeconds:1.5},{rpe:11},{date:"2026-02-30"}]) assert.equal(cardioSchema.safeParse({...base,...patch}).success,false);
 assert.equal(cardioSchema.safeParse({...base,distanceKm:null}).success,true);
});
test("pace and speed use the proper units, rounding carries seconds",()=>{
 assert.equal(cardioPace(base),"6:00 min/km");
 assert.equal(cardioPace({...base,activity:"bike"}),"10 km/h");
 assert.equal(cardioPace({...base,distanceKm:null}),"Sin distancia");
 assert.equal(cardioPace({...base,distanceKm:1,durationSeconds:359.7}),"6:00 min/km");
 assert.equal(cardioDuration(3661),"1:01:01");
});
test("weekly totals start Monday and exclude future and prior dates",()=>{
 assert.deepEqual(cardioWeek([base,{...base,date:"2026-09-27"},{...base,date:"2026-09-29"},{...base,distanceKm:null}],"2026-09-28"),{count:2,km:5,minutes:60});
});
test("cardio round trips in backups while previous backups remain valid",()=>{
 assert.deepEqual(backupParse({version:1,records:[{kind:"cardio",data:base}]}),[{kind:"cardio",data:base}]);
 assert.deepEqual(backupParse({version:1,records:[]}),[]);
});
