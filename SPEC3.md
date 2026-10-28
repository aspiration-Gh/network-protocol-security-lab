# 三幕剧本规范（v4 数据格式，严格照做）

目标：每个协议一份 `scripts/<id>.script.json`，代码统一渲染，你只写内容。写完必须用 python 校验并打印结果。

## 文件结构

```json
{
  "id": "dns",
  "notes": { "QNAME": {"short":"≤18字短注","more":"40~90字完整解释","sec":"一句安全视角"} },
  "acts": [
    {"key":"normal","no":"第 1 幕","title":"它正常怎么工作","desc":"一句话副标题","lead":"本幕导语",
     "scenes":[{"name":"场景名","steps":[STEP],"cmds":{"linux":[CMD],"ps":[CMD],"cmd":[CMD]}}]},
    {"key":"attack","no":"第 2 幕","title":"它会被怎么打","desc":"…","lead":"…",
     "scenes":[{"name":"攻击甲","steps":[…],"cmds":{…}},{"name":"攻击乙","steps":[…],"cmds":{…}}]},
    {"key":"defend","no":"第 3 幕","title":"防护在哪一步掐断它","desc":"…","lead":"…",
     "scenes":[{"name":"防护生效","steps":[…],"cmds":{…}}]}
  ]
}
```

- `acts` 必须正好 3 个，`key` 依次为 normal / attack / defend，`no` 用「第 1 幕 / 第 2 幕 / 第 3 幕」。
- attack 幕给 2 个场景（该协议有两个以上著名攻击时），否则 1 个。
- 步数：normal 4~6 步，每个攻击场景 4~5 步，defend 4~6 步。

## STEP 字段

```json
{"who":"客户端","to":"服务器","bubble":"SYN","evil":true,
 "pkt":0,"hl":["Sequence Number","Flags"],
 "vals":{"Sequence Number":"x = 0x3a2c17","Flags":"SYN"},
 "say":"一句话，≤60 字","sub":"补充一句，≤40 字"}
```

- `who` / `to`：具体角色（客户端 / 服务器 / 攻击者 / 受害者 / 网关 / DNS 服务器 / CA …）。无接收方用 `"—"`。
- `evil:true` 只给「攻击者发出的那一步」，节点会变红。
- `pkt` 必须是该协议数据里**存在的包下标**（见下）；`hl` 与 `vals` 的字段名必须与那个包的字段**完全一致**（区分大小写、含空格）。
- `vals` 是这一步想突出的语义值（如 `"y"`、`"cookie"`、`"x+1"`、`"随机"`、`"0x1122"`）。没给的字段会自动显示报文里的真实字节。
- `say` 是主句（≤60 字，讲清这一步做了什么、代价在哪），`sub` 是补充（≤40 字，讲机制或后果）。**不要写成段落**。
- 同一个攻击要在 defend 幕里重放一遍，用防护机制把它掐断（这是三幕的闭环）。

## CMD 字段

```json
{"c":"ss -tan state syn-recv | wc -l","n":"半连接条数，被泛洪时上千","s":"《系统》Linux.md · ss"}
```

- 每场景 `cmds` 至少：linux 2 条、ps 1 条、cmd 1 条。
- `c` 必须是**能直接复制运行**的真实命令；`n` 一句话说明作用 + 预期输出怎么看；`s` 写来源：
  - 出自用户 Obsidian《系统》仓库，格式 `《系统》Linux.md · 小节名` / `《系统》PowerShell.md · Cmdlet` / `《系统》Windows CMD.md · 小节名`
  - 仓库里没有的工具（tcpdump / nmap / hping3 / dig / openssl 等）写 `补充（理由）`
- 常用可引用项：《系统》Linux.md（ss、ip、curl、ping、ps、systemctl），《系统》PowerShell.md（Test-NetConnection、Get-NetTCPConnection、Get-NetIPAddress、Get-NetNeighbor、Get-Process），《系统》Windows CMD.md（netstat、netsh、arp、nslookup、tracert、ipconfig）。

## notes 字段（可选但推荐）

给该协议里**语义唯一的字段**补短注：`short`≤18 字（是什么 + 攻击者怎么用），`more` 40~90 字（机制），`sec` 一句安全视角。全文只写新出现的字段名，已存在的全局表会覆盖同名项，不必重复。

## 取材与准确性

1. 先读协议数据确认包结构与字段名：``data/*.json`（仓库内）`（用 python 打印 `packets[i].title` 与 `fields[*].name`）。
2. 再读讲义对应章节（知识点、攻击、防御）：``notes/`（本仓库）` 下同名章节 md。
3. 字段长度 / 攻击细节不确定就查 RFC 原文（curl 拉取，本机 web_extract 后端只能搜不能抽）。
4. **不编造**：描述与字段名冲突时以数据里的字段名为准；确实没有的机制不要写。

## 自检（必须执行）

```python
import json
p = json.load(open(r"…\scripts\<id>.script.json", encoding="utf-8"))
# 1) 3 幕、key 正确  2) 每步 pkt 下标存在、hl/vals 字段名都在
# 3) say/sub 长度  4) 每场景 cmds 三种环境齐全  5) 打印统计
```

## 交付

- 文件：``scripts/<id>.script.json`（仓库内）`（一个协议一个文件）
- 回报：每个协议 幕数/场景数/步数/命令数，以及自检发现并修正的问题。
