// ==UserScript==
// @name         Vecorder
// @namespace    https://www.joi-club.cn/
// @version      0.70
// @description  直播间内容记录 https://github.com/Xinrea/Vecorder
// @author       Xinrea
// @license      MIT
// @match        https://live.bilibili.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @requere      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/moment@2.29.1/moment.min.js
// @run-at 		 document-end
// ==/UserScript==

function vlog(msg) {
    console.log("[Vecorder]" + msg);
}

function p(msg) {
    return {
        time: new Date().getTime(),
        content: msg,
    };
}

var dbname = "vdb" + getRoomID();

var db = JSON.parse(GM_getValue(dbname, "[]"));
var Option = JSON.parse(GM_getValue("vop", '{"reltime":false,"toffset":0}'));

function nindexOf(n) {
    for (let i in db) {
        if (!db[i].del && db[i].name == n) return i;
    }
    return -1;
}

function tindexOf(id, t) {
    for (let i in db[id].lives) {
        if (!db[id].lives[i].del && db[id].lives[i].title == t) return i;
    }
    return -1;
}

function gc() {
    for (let i = db.length - 1; i >= 0; i--) {
        if (db[i].del) {
            db.splice(i, 1);
            continue;
        }
        for (let j = db[i].lives.length - 1; j >= 0; j--) {
            if (db[i].lives[j].del) {
                db[i].lives.splice(j, 1);
                continue;
            }
        }
    }
    GM_setValue(dbname, JSON.stringify(db));
}

function addPoint(t, msg) {
    console.log("addPoint", t, msg);
    let ltime = t * 1000;
    if (ltime == 0) return;
    let [name, link, title] = getRoomInfo();
    console.log("CurrentRoom:", name, link, title);
    let id = nindexOf(name);
    if (id == -1) {
        db.push({
            name: name,
            link: link,
            del: false,
            lives: [
                {
                    title: title,
                    time: ltime,
                    del: false,
                    points: [p(msg)],
                },
            ],
        });
    } else {
        let lid = tindexOf(id, title);
        if (lid == -1) {
            db[id].lives.push({
                title: title,
                time: ltime,
                points: [p(msg)],
            });
        } else {
            db[id].lives[lid].points.push(p(msg));
        }
    }
    GM_setValue(dbname, JSON.stringify(db));
    $(`#vecorder-list`).replaceWith(dbToListview());
}

function getMsg(body) {
    var vars = body.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] == "msg") {
            return decodeURI(pair[1]);
        }
    }
    return false;
}

function getRoomInfo() {
    let resp = $.ajax({
        url: "https://api.live.bilibili.com/xlive/web-room/v1/index/getH5InfoByRoom?room_id="+getRoomID(),
        async: false}).responseJSON.data;
    console.log("RoomInfo:",resp);
    return [resp.anchor_info.base_info.uname, "https://space.bilibili.com/" + resp.room_info.uid, resp.room_info.title]
}

// 根据当前地址获取直播间ID
function getRoomID() {
    let roomid = window.location.pathname.substring(1);
    return roomid; //获取当前房间号
}

function tryAddPoint(msg) {
    // https://api.live.bilibili.com/room/v1/Room/room_init?id={roomID}
    console.log(msg, getRoomID());
    $.ajax({
        url:
        "https://api.live.bilibili.com/room/v1/Room/room_init?id=" + getRoomID(),
        async: true,
        success: function (resp) {
            let t = 0;
            if (resp.data.live_status != 1) t = 0;
            else t = resp.data.live_time;
            addPoint(t, msg);
        },
    });
}

let toggle = false;

waitForKeyElements(
    "#control-panel-ctnr-box > div.chat-input-ctnr-new.p-relative > div.right-actions.border-box > button",
    (n) => {
        const input = $(`<div id="point-input"><textarea placeholder="输入内容并回车添加时间点"></textarea></div>`);
        input.bind("keypress", function (event) {
            if (event.keyCode == "13") {
                window.event.returnValue = false;
                console.log("Enter detected");
                tryAddPoint($("#point-input > textarea").val());
                $("#point-input > textarea").val("");
            }
        });
        $(`#control-panel-ctnr-box`).append(input);
    }
);

waitForKeyElements(
    "#control-panel-ctnr-box > div.control-panel-icon-row-new.f-clear.p-relative.superChat > div.icon-left-part-new",
    (n) => {
        // Resize superchat/like buttons
        n[0].style = "width: 70%; align-items: center;";
        n[0].children[0].style = "margin: 0; width: 54px; height: 28px;";
        n[0].children[0].children[0].remove();
        n[0].children[0].children[0].innerText = "留言";
        n[0].children[1].style = "margin: 0; width: 54px; height: 28px; margin-left: 3px;";
        n[0].children[1].children[0].remove();

        $("#control-panel-ctnr-box > div.chat-input-ctnr-new.p-relative > div.chat-input-new.border-box.p-relative").css("height", "30px");
        $("#control-panel-ctnr-box > div.chat-input-ctnr-new.p-relative > div.chat-input-new.border-box.p-relative > textarea").css({"height": "30px", "line-height": "13px", "white-space": "nowrap"});
        // create panel
        let panel = $(
            '<div id="vPanel"><p style="font-size:20px;font-weight:bold;margin:0px;" class="vName">🍊直播笔记</p></div>'
        );
        let contentList = dbToListview();
        panel.append(contentList);
        let clearBtn = $('<button><span class="txt">清空</span></button>');
        clearBtn.attr(
            "style",
            "font-family: sans-serif;\
text-transform: none;\
position: relative;\
box-sizing: border-box;\
line-height: 1;\
margin: 0;\
margin-left: 3px;\
padding: 6px 12px;\
border: 0;\
cursor: pointer;\
outline: none;\
overflow: hidden;\
background-color: #23ade5;\
color: #fff;\
border-radius: 4px;\
min-width: 40px;\
height: 24px;\
font-size: 12px;"
        );
        clearBtn.hover(
            function () {
                clearBtn.css("background-color", "#58bae2");
            },
            function () {
                clearBtn.css("background-color", "#23ade5");
            }
        );
        clearBtn.click(function () {
            contentList.empty();
            db = [];
            GM_deleteValue(dbname);
        });
        panel.append(clearBtn);
        let closeBtn = $(
            '<a style="position:absolute;right:7px;top:5px;font-size:20px;" class="vName">&times;</a>'
        );
        closeBtn.click(function () {
            console.log("Close clicked");
            $("#vPanel").hide()
            gc();
            toggle = false;
            recordBtn.css("background-color", "#23ade5");
        });
        panel.append(closeBtn);
        let timeop = $(`<hr style="border:0;height:1px;background-color:#58bae2;margin-top:10px;margin-bottom:10px;"/><div id="timeop">\
<div><input type="checkbox" id="reltime" value="false" style="vertical-align:middle;margin-right:5px;"/><label for="reltime" class="vName" style="vertical-align:middle;">按相对时间导出</label></div>\
<div style="margin-top:10px;"><label for="toffset" class="vName" style="vertical-align:middle;">时间偏移(秒)：</label><input type="number" id="toffset" value="${Option.toffset}" style="vertical-align:middle;width:35px;outline-color:#23ade5;"/></div>\
</div>`);
        panel.append(timeop);
        // Setup recordButton
        let recordBtn = $('<div><span class="txt">记录</span></div>');
        recordBtn.attr(
            "style",
            "font-family: sans-serif;\
display: flex;\
align-items: center;\
position: relative;\
box-sizing: border-box;\
margin-left: 3px;\
padding: 6px 12px;\
cursor: pointer;\
outline: none;\
overflow: hidden;\
background-color: #23ade5;\
color: #fff;\
border-radius: 36px;\
width: 54px;\
height: 28px;\
font-size: 14px;"
        );
        $("#chat-control-panel-vm > div").append(panel);
        $("#vPanel").hide();
        recordBtn.hover(
            function () {
                if (!toggle) recordBtn.css("background-color", "#58bae2");
            },
            function () {
                if (!toggle) recordBtn.css("background-color", "#23ade5");
            }
        );
        recordBtn.click(function () {
            if (toggle) {
                $("#vPanel").hide();
                gc();
                toggle = false;
                $(this).css("background-color", "#58bae2");
                return;
            }
            console.log("Toggle panel");
            $("#vPanel").show();
            if (Option.reltime) {
                $("#reltime").attr("checked", true);
            }
            $("#reltime").change(function () {
                Option.reltime = $(this).prop("checked");
                GM_setValue("vop", JSON.stringify(Option));
            });
            $("#toffset").change(function () {
                Option.toffset = $(this).val();
                GM_setValue("vop", JSON.stringify(Option));
            });
            $(this).css("background-color", "#0d749e");
            toggle = true;
        });
        n.append(recordBtn);

        let styles = $(`<style type="text/css"></style>`);
        styles.text(
            "#vPanel {\
line-height: 1.15;\
font-size: 12px;\
font-family: Arial,Microsoft YaHei,Microsoft Sans Serif,Microsoft SanSerf,\\5FAE8F6F96C59ED1!important;\
display: block;\
box-sizing: border-box;\
background: #fff;\
border: 1px solid #e9eaec;\
border-radius: 8px;\
box-shadow: 0 6px 12px 0 rgba(106,115,133,.22);\
animation: scale-in-ease cubic-bezier(.22,.58,.12,.98) .4s;\
padding: 16px;\
position: absolute;\
right: 4px;\
bottom: 150px;\
z-index: 999;\
transform-origin: right bottom;\
}\
#vPanel ul {\
list-style-type: none;\
padding-inline-start: 0px;\
color: #666;\
}\
#vPanel li {\
margin-top: 10px;\
white-space: nowrap;\
}\
.vName {\
color: #23ade5;\
cursor: pointer;\
}\
#control-panel-ctnr-box > div.chat-input-ctnr-new.p-relative > div.medal-section {\
height: 30px;\
line-height: 13px;\
}\
#point-input {\
padding: 4px 8px;\
background-color: var(--bg2);\
border-radius: 6px;\
border: 1px solid transparent;\
margin-top: 6px;\
}\
#point-input > textarea {\
width: 100%;\
border: 0;\
outline: 0;\
resize: none;\
background-color: var(--bg2);\
color: var(--text2);\
font-size: 13px;\
height: 24px;\
}\
"
        );
        $("head").prepend(styles);
    }
);

function dbToListview() {
    let urlObject = window.URL || window.webkitURL || window;
    let content = $(`<ul id="vecorder-list"></ul>`);
    for (let i in db) {
        let list = $("<li></li>");
        if (db[i].del) {
            continue;
        }
        let innerlist = $("<ul></ul>");
        for (let j in db[i].lives) {
            if (db[i].lives[j].del) continue;
            let item = $(
                "<li>" +
                `[${moment(db[i].lives[j].time).format("YYYY/MM/DD")}]` +
                db[i].lives[j].title +
                "[" +
                db[i].lives[j].points.length +
                "]" +
                "</li>"
            );
            let ep = $('<a class="vName" style="font-weight:bold;">[导出]</a>');
            let cx = $(
                '<a class="vName" style="color:red;font-weight:bold;">[删除]</a>'
            );
            ep.click(function () {
                exportRaw(
                    db[i].lives[j],
                    db[i].name,
                    `[${db[i].name}][${db[i].lives[j].title}][${moment(
                        db[i].lives[j].time
                    ).format("YYYY-MM-DD")}]`
        );
            });
            cx.click(function () {
                if (db[i].lives.length == 1) {
                    db[i].del = true;
                    item.remove();
                    list.remove();
                } else {
                    db[i].lives[j].del = true;
                    item.remove();
                }
                GM_setValue(dbname, JSON.stringify(db));
            });
            item.append(ep);
            item.prepend(cx);
            innerlist.append(item);
        }
        list.append(innerlist);
        content.append(list);
    }
    return content;
}

function exportRaw(live, v, fname) {
    var urlObject = window.URL || window.webkitURL || window;
    var export_blob = new Blob([rawToString(live, v)]);
    var save_link = document.createElementNS("http://www.w3.org/1999/xhtml", "a");
    save_link.href = urlObject.createObjectURL(export_blob);
    save_link.download = fname;
    save_link.click();
}

function rawToString(live, v) {
    let r =
        "# 由Vecorder自动生成，不妨关注下可爱的@轴伊Joi_Channel：https://space.bilibili.com/61639371/\n";
    r += `# ${v} \n`;
    r += `# ${live.title} - 直播开始时间：${moment(live.time).format(
        "YYYY-MM-DD HH:mm:ss"
    )}\n\n`;
    for (let i in live.points) {
        if (!Option.reltime)
            r += `[${moment(live.points[i].time)
                .add(Option.toffset, "seconds")
                .format("HH:mm:ss")}] ${live.points[i].content}\n`;
        else {
            let seconds =
                moment(live.points[i].time).diff(moment(live.time), "second") +
                Number(Option.toffset);
            let minutes = Math.floor(seconds / 60);
            let hours = Math.floor(minutes / 60);
            seconds = seconds % 60;
            minutes = minutes % 60;
            r += `[${f(hours)}:${f(minutes)}:${f(seconds)}] ${
        live.points[i].content
        }\n`;
        }
    }
    return r;
}

function f(num) {
    if (String(num).length > 2) return num;
    return (Array(2).join(0) + num).slice(-2);
}

function waitForKeyElements(
selectorTxt /* Required: The jQuery selector string that
                        specifies the desired element(s).
                    */,
    actionFunction /* Required: The code to run when elements are
                        found. It is passed a jNode to the matched
                        element.
                    */,
    bWaitOnce /* Optional: If false, will continue to scan for
                        new elements even after the first match is
                        found.
                    */,
    iframeSelector /* Optional: If set, identifies the iframe to
                        search.
                    */
) {
    var targetNodes, btargetsFound;

    if (typeof iframeSelector == "undefined") targetNodes = $(selectorTxt);
    else targetNodes = $(iframeSelector).contents().find(selectorTxt);

    if (targetNodes && targetNodes.length > 0) {
        btargetsFound = true;
        /*--- Found target node(s).  Go through each and act if they
            are new.
        */
        targetNodes.each(function () {
            var jThis = $(this);
            var alreadyFound = jThis.data("alreadyFound") || false;

            if (!alreadyFound) {
                //--- Call the payload function.
                var cancelFound = actionFunction(jThis);
                if (cancelFound) btargetsFound = false;
                else jThis.data("alreadyFound", true);
            }
        });
    } else {
        btargetsFound = false;
    }

    //--- Get the timer-control variable for this selector.
    var controlObj = waitForKeyElements.controlObj || {};
    var controlKey = selectorTxt.replace(/[^\w]/g, "_");
    var timeControl = controlObj[controlKey];

    //--- Now set or clear the timer as appropriate.
    if (btargetsFound && bWaitOnce && timeControl) {
        //--- The only condition where we need to clear the timer.
        clearInterval(timeControl);
        delete controlObj[controlKey];
    } else {
        //--- Set a timer, if needed.
        if (!timeControl) {
            timeControl = setInterval(function () {
                waitForKeyElements(
                    selectorTxt,
                    actionFunction,
                    bWaitOnce,
                    iframeSelector
                );
            }, 300);
            controlObj[controlKey] = timeControl;
        }
    }
    waitForKeyElements.controlObj = controlObj;
}
