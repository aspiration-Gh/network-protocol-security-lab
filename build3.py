#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""三幕剧本版 v4：多协议合并为单个自包含 HTML。"""
import json, os, sys, glob

BASE = os.path.dirname(os.path.abspath(__file__))
SRC, DATA, SCRIPTS = (os.path.join(BASE,x) for x in ("src3","data","scripts"))
OUT = sys.argv[1] if len(sys.argv)>1 else os.path.join(BASE,"build-v4.html")

order = {"link":0,"network":1,"transport":2,"application":3,"extension":4}
# 课程顺序（层内按教学顺序排，不按字母）
SEQ = ["ethernet","vlan","ppp","pppoe","l2tp",
       "ipv4","ipv6","arp","icmp","ipsec",
       "tcp","udp","tls","tls13","quic",
       "dns","http","mail","dhcp","ftp","ssh","telnet","snmp","sava"]
POS = {k:i for i,k in enumerate(SEQ)}
protos = {}
for f in sorted(glob.glob(os.path.join(DATA,"*.json"))):
    for p in json.load(open(f,encoding="utf-8"))["protocols"]:
        protos[p["id"]] = p

items, problems = [], []
extra_short, extra_more, extra_sec = {}, {}, {}
for f in sorted(glob.glob(os.path.join(SCRIPTS,"*.script.json"))):
    sc = json.load(open(f,encoding="utf-8"))
    sid = sc.get("id") or os.path.basename(f).split(".")[0]
    nb = sc.get("notes") or {}
    for k,v in nb.items():
        if isinstance(v, dict):
            key = f"{sid}::{k}"          # 同名不同义：按协议隔离
            if v.get("short"): extra_short[key] = v["short"]
            if v.get("more"):  extra_more[key]  = v["more"]
            if v.get("sec"):   extra_sec[key]   = v["sec"]
    pid = sc.get("id") or os.path.basename(f).split(".")[0]
    p = protos.get(pid)
    if not p:
        problems.append(f"[缺协议数据] {pid}"); continue
    # 校验剧本字段引用与步长
    for ai,a in enumerate(sc["acts"]):
        for si,scene in enumerate(a["scenes"]):
            for ki,st in enumerate(scene["steps"]):
                pk = p["packets"][st.get("pkt",0)] if p["packets"] else None
                names = [x["name"] for x in (pk or {}).get("fields",[])]
                for n in st.get("hl",[])+list((st.get("vals") or {}).keys()):
                    if n not in names:
                        problems.append(f"[字段不存在] {pid} 幕{ai}景{si}步{ki}: {n}")
                if len(st.get("say",""))>90:
                    problems.append(f"[主句过长] {pid} 幕{ai}景{si}步{ki}: {len(st['say'])} 字")
                if not st.get("say"): problems.append(f"[缺主句] {pid} 幕{ai}景{si}步{ki}")
            if not (scene.get("cmds") or {}):
                problems.append(f"[缺命令] {pid} 幕{ai}景{si} {scene.get('name')}")
    items.append({"proto":p,"script":sc})

items.sort(key=lambda x:(POS.get(x["proto"]["id"], 99), x["proto"]["name"]))
for it in items:
    if it["proto"]["id"]=="sava": it["proto"]["extra"] = False   # 拓展课内容，不是课外补充
notes = json.load(open(os.path.join(SRC,"notes.json"),encoding="utf-8"))
# 全局兜底只保留“跨协议同义”的字段，其余一律走本协议命名空间
SAFE = {"Source Port","Destination Port","Sequence Number","Acknowledgment Number","Checksum",
        "Window","Urgent Pointer","Data Offset / Reserved","MSS Option","SACK-Permitted Option",
        "Timestamps Option","NOP Option","Window Scale Option","TCP Length","Zero","Protocol"}
for k in ("SHORT","MORE","SEC"):
    d = notes.get(k, {})
    notes[k] = {a: b for a, b in d.items() if a in SAFE or "::" in a}
for k,v in extra_short.items(): notes.setdefault("SHORT",{})[k]=v
for k,v in extra_more.items():  notes.setdefault("MORE",{})[k]=v
for k,v in extra_sec.items():   notes.setdefault("SEC",{})[k]=v
css = open(os.path.join(SRC,"style.css"),encoding="utf-8").read()
js  = open(os.path.join(SRC,"app.js"),encoding="utf-8").read()
tpl = open(os.path.join(SRC,"template.html"),encoding="utf-8").read()

def dump(o): return json.dumps(o,ensure_ascii=False,separators=(",",":")).replace("</","<\\/")
out = (tpl.replace("/*__CSS__*/",css)
          .replace("/*__DATA__*/",dump({"protos":items}))
          .replace("/*__SHORT__*/",dump(notes.get("SHORT",{})))
          .replace("/*__MORE__*/",dump(notes.get("MORE",{})))
          .replace("/*__SEC__*/",dump(notes.get("SEC",{})))
          .replace("/*__JS__*/",js))
open(OUT,"w",encoding="utf-8").write(out)

nsteps = sum(len(sc["steps"]) for it in items for a in it["script"]["acts"] for sc in a["scenes"])
print(f"协议 {len(items)} 个 / 剧本步数 {nsteps} / 字段 {sum(len(p['fields']) for it in items for p in it['proto']['packets'])}")
print("输出:",OUT,f"{os.path.getsize(OUT)//1024} KB")
print("缺剧本的协议:", [i for i in protos if i not in {it["proto"]["id"] for it in items}])
if problems:
    print(f"⚠ 问题 {len(problems)} 条:")
    for x in problems[:60]: print("  -",x)
else:
    print("校验通过")
