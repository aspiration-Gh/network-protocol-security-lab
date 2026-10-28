(function(){
"use strict";
var D = JSON.parse(document.getElementById("pdata").textContent);
var ALL = D.protos;                       // [{proto, script}]
var CUR = 0;
var S = { act:0, scene:0, step:0, tab:"linux", openCmd:false, treeOpen:true, hexOpen:true,
          theme:localStorage.getItem("npsec3.theme")||"dark" };
document.documentElement.setAttribute("data-theme", S.theme);

function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }
function fmt(s){
  var h = esc(s).replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>").replace(/`([^`]+)`/g,"<code>$1</code>");
  return h.split(/\n{2,}/).map(function(p){ return "<p>"+p.replace(/\n/g,"<br>")+"</p>"; }).join("");
}
function el(id){ return document.getElementById(id); }
function P(){ return ALL[CUR].proto; }
function SC(){ return ALL[CUR].script; }
function act(){ return SC().acts[S.act]; }
function scene(){ return act().scenes[S.scene]; }
function steps(){ return scene().steps; }
function step(){ return steps()[S.step]; }
function hex2(n){ return ("0"+n.toString(16)).slice(-2); }
function hexBytes(h){ return String(h||"").trim().split(/\s+/).filter(Boolean); }

/* 短注/详解：全局表（跨协议共享同名含义）+ 协议自带 desc 兜底 */
var SHORT = window.__SHORT__ || {};
var MORE  = window.__MORE__  || {};
function keyOf(f){ return (P().id||"")+"::"+f.name; }
function noteOf(f){
  var k = keyOf(f);
  if(SHORT[k]) return SHORT[k];
  if(SHORT[f.name]) return SHORT[f.name];
  return clip(f.desc||"");
}
function moreOf(f){
  var k = keyOf(f);
  return MORE[k] || MORE[f.name] || f.desc || "";
}
function secOf(f){ return f.sec || (window.__SEC__||{})[keyOf(f)] || (window.__SEC__||{})[f.name] || ""; }
function clip(s){
  s = String(s||"").replace(/\s+/g," ").trim();
  if(!s) return "";
  var segs = s.split(/[。；;，,]/).filter(function(x){ return x.trim().length>=8; });
  var m = segs.length ? segs[0].trim() : s.slice(0,24);
  return m.length>22 ? m.slice(0,22)+"…" : m;
}

/* ---------------- 顶栏协议导航 ---------------- */
var LAYERS = [{id:"link",label:"接口层"},{id:"network",label:"网络层"},{id:"transport",label:"传输层"},
              {id:"application",label:"应用层"},{id:"extension",label:"拓展"}];
function drawNav(){
  var h = '<div class="navwrap">';
  LAYERS.forEach(function(L){
    var items = ALL.map(function(o,i){ return {o:o,i:i}; }).filter(function(x){ return x.o.proto.layer===L.id; });
    if(!items.length) return;
    h += '<div class="navrow"><span class="navlab">'+L.label+'</span>'+
         items.map(function(x){
           var p=x.o.proto;
           return '<button class="pchip'+(x.i===CUR?" on":"")+'" data-p="'+x.i+'">'+
                  esc(p.name)+(p.extra?'<i>课外</i>':'')+'</button>';
         }).join("")+'</div>';
  });
  h += '</div>';
  el("nav").innerHTML = h;
  document.querySelectorAll("[data-p]").forEach(function(b){
    b.onclick=function(){ stop(); CUR=+b.dataset.p; S.act=0; S.scene=0; S.step=0; render(); };
  });
}

/* ---------------- 渲染 ---------------- */
function render(){
  var p=P(), a=act(), sc=scene(), st=step();
  var pk = p.packets[st.pkt || 0] || p.packets[0];
  var fields = buildFields(pk, st);

  drawNav();
  var h='';
  h += '<h1>'+esc(p.name)+'<small>'+esc(p.en||"")+' · '+esc(p.cn||"")+'</small></h1>'+
       '<p class="one">'+esc(p.oneLine||"")+'</p>';
  h += '<div class="acts">'+SC().acts.map(function(x,i){
      return '<div class="act '+x.key+(i===S.act?" on":"")+'" data-act="'+i+'">'+
             '<div class="k">'+esc(x.no)+'</div><div class="t">'+esc(x.title)+'</div>'+
             '<div class="d">'+esc(x.desc||"")+'</div></div>'; }).join("")+'</div>';
  if(a.scenes.length>1){
    h += '<div class="scenes">'+a.scenes.map(function(x,i){
      return '<div class="scene'+(i===S.scene?" on":"")+'" data-scene="'+i+'">'+esc(x.name)+'</div>'; }).join("")+'</div>';
  }
  h += '<div class="stage'+(S.treeOpen?"":" noflex")+'"><div class="topo" id="topo"></div>'+
       '<div class="wire"><div class="panehd"><button class="minitog" data-pane="tree">'+
         (S.treeOpen?"▾":"▸")+' 报文结构 <em>'+fields.length+' 字段</em></button>'+
         '<span class="hint" id="selhint">悬停字段 → 对应字节亮起；点 ? 看完整解释</span></div>'+
         '<div class="tree'+(S.treeOpen?"":" hidden")+'" id="tree"></div></div>'+
       '<div class="hexblock"><div class="hexwrap"><div class="hexhdr">'+
         '<button class="minitog" data-pane="hex">'+(S.hexOpen?"▾":"▸")+' HEX</button>'+
         '<span class="hdinfo">'+hexBytes(pk.hex).length+' 字节 · '+esc(pk.title||"")+'</span>'+
         '<span class="hxascii" title="可打印字符原样，其余显示为 ·">ASCII（可打印字符，其余 ·）</span></div>'+
         '<div class="hexbody'+(S.hexOpen?"":" hidden")+'" id="hexbody"></div></div></div></div>';
  h += '<div class="say">'+esc(st.say)+(st.sub?'<span class="sub">'+esc(st.sub)+'</span>':'')+'</div>';
  h += '<div class="bar"><i style="width:'+Math.round((S.step+1)/steps().length*100)+'%"></i></div>';
  h += '<div class="ctrl">'+
       '<button class="btn" id="prev"'+(S.step===0?" disabled":"")+'>◀</button>'+
       '<button class="btn primary" id="next">下一步 ▶</button>'+
       '<button class="btn ghost" id="play">'+(S.playing?"⏸ 暂停":"▶ 自动播放")+'</button>'+
       '<span class="dots">'+steps().map(function(s,i){
          return '<i class="'+(i===S.step?"on":"")+(s.evil?" evil":"")+'" data-jump="'+i+'"></i>'; }).join("")+'</span>'+
       '<span class="stepno">第 '+(S.step+1)+' / '+steps().length+' 步</span>'+
       '<span class="spacer"></span>'+
       '<button class="btn" id="actNext">'+(S.act<SC().acts.length-1?"下一幕 →":"回到第 1 幕 ⟲")+'</button></div>';

  var cmds = st.cmds || sc.cmds || {};
  var tabs = [["linux","Linux"],["ps","PowerShell"],["cmd","CMD"]].filter(function(t){ return cmds[t[0]]; });
  if(tabs.length){
    if(tabs.map(function(t){return t[0];}).indexOf(S.tab)<0) S.tab=tabs[0][0];
    h += '<details class="panel cmdp"'+(S.openCmd?" open":"")+'><summary>动手验证 · 在这一步就能敲的命令<span class="k">Linux / PowerShell / CMD</span></summary>'+
         '<div class="bd"><div class="cmdtabs">'+tabs.map(function(t){
            return '<span class="cmdt'+(S.tab===t[0]?" on":"")+'" data-cmdtab="'+t[0]+'">'+t[1]+'</span>'; }).join("")+'</div>'+
         '<div class="cmdlist">'+(cmds[S.tab]||[]).map(function(c){
            return '<div class="cmdrow"><code>'+esc(c.c)+'</code><div class="cmdn">'+esc(c.n)+
                   (c.s?'<span class="src">'+esc(c.s)+'</span>':'')+'</div>'+
                   '<button class="btn ghost mini" data-copy="'+esc(c.c)+'">复制</button></div>'; }).join("")+
         '</div></div></details>';
  }
  h += '<details class="panel"><summary>深读：设计动机与细节<span class="k">'+(p.sections||[]).length+' 段</span></summary>'+
       '<div class="bd deep">'+(p.sections||[]).map(function(s){ return '<div class="sec"><h4>'+esc(s.h)+'</h4>'+fmt(s.p)+'</div>'; }).join("")+'</div></details>';
  h += '<details class="panel"><summary>字段全表<span class="k">'+p.packets.reduce(function(n,k){return n+k.fields.length;},0)+' 个字段</span></summary>'+
       '<div class="bd">'+fieldTables()+'</div></details>';
  h += '<div class="panel"><div class="hd">防护手段与局限<span class="k">'+(p.defenses||[]).length+' 条</span></div><div class="bd"><div class="defs">'+
       (p.defenses||[]).map(function(d){
         return '<div class="def"><b>'+esc(d.name)+'</b><p>'+esc(d.how||"")+'</p>'+
                (d.limit?'<div class="lim">局限：'+esc(d.limit)+'</div>':'')+'</div>'; }).join("")+'</div></div></div>';
  h += '<div class="panel"><div class="hd">小测<span class="k">'+(p.quiz||[]).length+' 题</span></div><div class="bd">'+
       (p.quiz||[]).map(function(q,qi){
         return '<div class="q" data-q="'+qi+'"><div class="qt">'+(qi+1)+'. '+esc(q.q)+'</div>'+
           q.options.map(function(o,oi){
             return '<button class="opt" data-q="'+qi+'" data-o="'+oi+'">'+String.fromCharCode(65+oi)+'. '+esc(o)+'</button>'; }).join("")+
           '<div class="why" id="why'+qi+'"></div></div>'; }).join("")+'</div></div>';

  var keepY = window.scrollY;
  el("main").innerHTML = h;
  drawTopo(st); drawTree(fields, pk); drawHex(pk, fields); bind();
  window.scrollTo(0, keepY);
}

/* 构造字段列表：值优先用本步语义值，否则用报文实际字节解出来的值 */
function buildFields(pk, st){
  var bytes = hexBytes(pk.hex), out = [], vals = st.vals||{};
  (pk.fields||[]).forEach(function(f,i){
    var L = Math.max(1, Math.round(f.len));
    var raw = bytes.slice(f.off, f.off+L).join(" ");
    var val = vals[f.name];
    if(val==null) val = raw || "—";
    out.push({ name:f.name, cn:f.cn||f.name, off:f.off, len:f.len, bits:f.bits||"",
               val:val, raw:raw, desc:f.desc||"", sec:f.sec||"", idx:i,
               short:noteOf(f), more:moreOf(f), tone:f.tone||"t12",
               hl:(st.hl||[]).indexOf(f.name)>=0 });
  });
  return out;
}

/* ---------------- 拓扑 + 箭头 ---------------- */
function drawTopo(st){
  var topo=el("topo"), names=[];
  steps().forEach(function(s){ [s.who,s.to].forEach(function(n){ if(n&&n!=="—"&&names.indexOf(n)<0) names.push(n); }); });
  var evil={}; steps().forEach(function(s){ if(s.evil) evil[s.who]=1; });
  var N=names.length||1, H=Math.max(320, N*88);
  topo.style.height=H+"px";
  var html = names.map(function(nm,i){
    var top = 16 + i*((H-90)/Math.max(1,N-1||1));
    var on = (nm===st.who||nm===st.to)?" on":"";
    return '<div class="node'+(evil[nm]?" evil":"")+on+'" data-n="'+esc(nm)+'" style="top:'+top+'px">'+
           '<span class="dot"></span><span>'+esc(nm)+'</span>'+
           '<span class="role">'+(evil[nm]?"攻击方":"参与方")+'</span></div>';
  }).join("")+'<div class="pkchip" id="pkchip"></div><svg class="arrowsvg" id="arrowsvg"></svg>'+
  '<div class="legend"><span><i class="sw" style="background:var(--t6)"></i>链路</span>'+
  '<span><i class="sw" style="background:var(--t1)"></i>网络</span>'+
  '<span><i class="sw" style="background:var(--t2)"></i>传输/应用</span></div>';
  topo.innerHTML = html;
  drawArrow(st);
  var chip=el("pkchip"), from=topo.querySelector('.node[data-n="'+CSS.escape(st.who||"")+'"]');
  var to = st.to && st.to!=="—" ? topo.querySelector('.node[data-n="'+CSS.escape(st.to)+'"]') : null;
  chip.textContent = st.bubble || "报文";
  chip.className = "pkchip show"+(st.evil?" bad":"")+(act().key==="defend"?" ok":"");
  if(from){ chip.style.top=(from.offsetTop+6)+"px";
    if(to) requestAnimationFrame(function(){ chip.style.top=(to.offsetTop+6)+"px"; });
  }
}
function drawArrow(st){
  var topo=el("topo"), svg=el("arrowsvg"); if(!svg) return;
  var from=topo.querySelector('.node[data-n="'+CSS.escape(st.who||"")+'"]');
  var to = st.to && st.to!=="—" ? topo.querySelector('.node[data-n="'+CSS.escape(st.to)+'"]') : null;
  svg.setAttribute("width", topo.clientWidth); svg.setAttribute("height", topo.clientHeight);
  svg.setAttribute("viewBox","0 0 "+topo.clientWidth+" "+topo.clientHeight);
  if(!from||!to||from===to){ svg.innerHTML=""; return; }
  var x = from.offsetLeft + from.offsetWidth + 30;
  var y1 = from.offsetTop + from.offsetHeight/2, y2 = to.offsetTop + to.offsetHeight/2;
  var dir = y2>y1?1:-1;
  var color = st.evil? "#ff6b6b" : (act().key==="defend"? "#7ee787" : "#ffb454");
  svg.innerHTML = '<defs><marker id="ah" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">'+
    '<path d="M0,0 L9,4.5 L0,9 z" fill="'+color+'"/></marker></defs>'+
    '<line x1="'+x+'" y1="'+y1+'" x2="'+x+'" y2="'+(y2-dir*18)+'" stroke="'+color+'" stroke-width="2.5" '+
    'stroke-dasharray="8 6" marker-end="url(#ah)" class="dashline"/>';
}

/* ---------------- 树 / hex ---------------- */
function drawTree(fields){
  var h='';
  fields.forEach(function(f){
    h += '<div class="trow'+(f.hl?" hl":"")+'" data-off="'+f.off+'" data-len="'+f.len+'" data-cn="'+esc(f.cn)+'" '+
         'data-tip="'+esc(f.short||"")+'">'+
         '<div class="tmain"><span class="tn"><b>'+esc(f.cn)+'</b><i>'+esc(f.name)+'</i></span>'+
         '<span class="tv">'+esc(f.val)+'</span>'+
         '<span class="toff">'+f.off+'–'+(f.off+Math.max(1,f.len)-1)+'</span>'+
         '<span class="tq" title="展开完整解释">?</span></div>'+
         '<div class="tshort">'+esc(f.short||"")+'</div>'+
         '<div class="tmore"><p>'+esc(f.more||"")+'</p>'+(f.sec?'<p class="tsec">安全视角：'+esc(f.sec)+'</p>':'')+'</div></div>';
  });
  el("tree").innerHTML = h;
}
function hexPerRow(){
  var w = window.innerWidth;
  if(w < 520) return 8;          // 手机：每行 8 字节，避免横向滚动
  if(w >= 2200) return 32;
  if(w >= 1500) return 24;
  return 16;
}
function drawHex(pk, fields){
  var b=hexBytes(pk.hex), rows="", PER=hexPerRow();

  for(var i=0;i<b.length;i+=PER){
    var line='<div class="hxrow"><span class="hxoff">'+("0000"+i).slice(-4)+'</span><span class="hxbytes">', asc="";
    for(var j=i;j<i+PER&&j<b.length;j++){
      var f=fieldAt(fields,j);
      line += '<span class="hb g-'+layerClass(f)+'" data-o="'+j+'">'+esc(b[j])+'</span>';
      var v=parseInt(b[j],16);
      asc += (v>=32&&v<127)? String.fromCharCode(v).replace("<","&lt;") : "·";
    }
    line += '</span><span class="hxasc">'+asc+'</span></div>';
    rows += line;
  }
  el("hexbody").innerHTML = rows;
}
function fieldAt(fields,o){
  for(var i=fields.length-1;i>=0;i--){
    var f=fields[i]; if(o>=f.off && o<f.off+f.len) return f;
  }
  return {tone:"t12"};
}
function layerClass(f){
  var t=f.tone||"t12";
  if(t==="t6") return "eth";
  if(t==="t1"||t==="t10") return "ip";
  if(t==="t8"||t==="t12") return "data";
  return "tcp";
}
function highlight(off,len){
  document.querySelectorAll(".hb.on").forEach(function(x){ x.classList.remove("on"); });
  document.querySelectorAll(".trow.on").forEach(function(x){ x.classList.remove("on"); });
  if(off==null) return;
  document.querySelectorAll(".hb").forEach(function(x){
    var o=+x.getAttribute("data-o"); if(o>=off&&o<off+len) x.classList.add("on");
  });
  document.querySelectorAll('.trow[data-off="'+off+'"][data-len="'+len+'"]').forEach(function(x){ x.classList.add("on"); });
}
function fieldTables(){
  return P().packets.map(function(pk){
    return '<h4 style="margin:14px 0 6px;font-size:14px;color:var(--cyan)">'+esc(pk.title)+'</h4>'+
      '<table class="fl"><thead><tr><th>字段</th><th>偏移</th><th>长</th><th>位域</th><th>含义与利用方式</th><th>安全相关性</th></tr></thead><tbody>'+
      pk.fields.map(function(f){
        return '<tr><td class="fname"><span class="sw" style="background:var(--'+(f.tone||"t12")+')"></span>'+esc(f.name)+
          '<div style="font-family:var(--sans);font-weight:400;color:var(--dim);font-size:12px">'+esc(f.cn||"")+'</div></td>'+
          '<td class="mono">'+f.off+'–'+(f.off+Math.max(1,Math.round(f.len))-1)+'</td><td class="mono">'+f.len+'</td>'+
          '<td class="mono" style="font-size:11.5px;color:var(--t10)">'+esc(f.bits||"")+'</td>'+
          '<td style="font-size:13px">'+esc(f.desc||"")+'</td>'+
          '<td class="fsec" style="font-size:12.5px">'+esc(f.sec||"")+'</td></tr>'; }).join("")+'</tbody></table>';
  }).join("");
}

/* ---------------- 绑定 ---------------- */
function bind(){
  document.querySelectorAll("[data-pane]").forEach(function(b){
    b.onclick=function(){
      if(b.dataset.pane==="tree") S.treeOpen=!S.treeOpen; else S.hexOpen=!S.hexOpen;
      window.__y=window.scrollY; render();
    };
  });
  document.querySelectorAll("[data-act]").forEach(function(n){
    n.onclick=function(){ stop(); S.act=+n.dataset.act; S.scene=0; S.step=0; render(); }; });
  document.querySelectorAll("[data-scene]").forEach(function(n){
    n.onclick=function(){ stop(); S.scene=+n.dataset.scene; S.step=0; render(); }; });
  document.querySelectorAll("[data-jump]").forEach(function(n){
    n.onclick=function(){ stop(); S.step=+n.dataset.jump; render(); }; });
  document.querySelectorAll("[data-cmdtab]").forEach(function(n){
    n.onclick=function(){ S.tab=n.dataset.cmdtab; window.__y=window.scrollY; render(); }; });
  document.querySelectorAll("[data-copy]").forEach(function(n){
    n.onclick=function(){
      var t=n.getAttribute("data-copy");
      if(navigator.clipboard) navigator.clipboard.writeText(t);
      n.textContent="已复制"; setTimeout(function(){ n.textContent="复制"; },1200); }; });
  var cp=document.querySelector(".cmdp");
  if(cp) cp.addEventListener("toggle", function(){ S.openCmd=cp.open; });
  document.querySelectorAll(".tg-hd").forEach(function(hd){
    hd.onclick=function(){ hd.parentNode.classList.toggle("closed"); }; });
  document.querySelectorAll(".tq").forEach(function(q){
    q.onclick=function(e){ e.stopPropagation(); q.closest(".trow").classList.toggle("open"); }; });
  document.querySelectorAll(".trow").forEach(function(r){
    r.onmouseenter=function(){
      highlight(+r.dataset.off,+r.dataset.len);
      var s=el("selhint"); if(s) s.textContent=r.dataset.cn+" · "+(r.dataset.tip||"");
    };
  });
  document.querySelectorAll(".hb").forEach(function(x){
    x.onmouseenter=function(){
      var o=+x.dataset.o;
      var row=[].slice.call(document.querySelectorAll(".trow")).reverse().find(function(r){
        return o>=+r.dataset.off && o<+r.dataset.off + +r.dataset.len; });
      if(row){ highlight(+row.dataset.off,+row.dataset.len);
        var s=el("selhint"); if(s) s.textContent=row.dataset.cn+" · "+(row.dataset.tip||""); }
    };
  });
  el("prev").onclick=function(){ if(S.step>0){ stop(); S.step--; render(); } };
  el("next").onclick=function(){ if(S.step<steps().length-1){ stop(); S.step++; render(); } else nextScene(); };
  el("play").onclick=function(){
    if(S.playing){ stop(); render(); return; }
    S.playing=setInterval(function(){
      if(S.step<steps().length-1){ S.step++; render(); } else { stop(); nextScene(true); }
    }, 3200);
    render();
  };
  el("actNext").onclick=function(){
    stop();
    if(S.act<SC().acts.length-1){ S.act++; S.scene=0; S.step=0; } else { S.act=0; S.scene=0; S.step=0; }
    render(); };
  bindQuiz();
}
function nextScene(auto){
  var a=act();
  if(S.scene<a.scenes.length-1){ S.scene++; S.step=0; render(); return; }
  if(S.act<SC().acts.length-1){ S.act++; S.scene=0; S.step=0; render(); return; }
  if(!auto){ S.act=0; S.scene=0; S.step=0; render(); }
}
function stop(){ if(S.playing){ clearInterval(S.playing); S.playing=null; } }
function bindQuiz(){
  var done={};
  document.querySelectorAll(".opt").forEach(function(b){
    b.onclick=function(){
      var qi=+b.dataset.q, oi=+b.dataset.o;
      if(done[qi]) return; done[qi]=true;
      var q=P().quiz[qi], box=document.querySelector('.q[data-q="'+qi+'"]');
      box.querySelectorAll(".opt").forEach(function(x,xi){ if(xi===q.a) x.classList.add("right"); });
      if(oi!==q.a) b.classList.add("wrong");
      var w=el("why"+qi); w.innerHTML="<b>解析：</b>"+esc(q.why||""); w.classList.add("show");
    };
  });
}

el("themeBtn").onclick=function(){
  S.theme = S.theme==="dark"?"light":"dark";
  document.documentElement.setAttribute("data-theme",S.theme);
  localStorage.setItem("npsec3.theme",S.theme);
  el("themeBtn").textContent = S.theme==="dark"?"☾ 暗色":"☀ 亮色";
};
el("themeBtn").textContent = S.theme==="dark"?"☾ 暗色":"☀ 亮色";
document.onkeydown=function(e){
  if(e.target.tagName==="INPUT") return;
  if(e.key==="ArrowRight"){ var n=el("next"); if(n) n.click(); }
  if(e.key==="ArrowLeft"){ var p=el("prev"); if(p&&!p.disabled) p.click(); }
  if(e.key===" "){ e.preventDefault(); var b=el("play"); if(b) b.click(); }
};
window.addEventListener("resize", function(){ if(el("topo")) drawArrow(step()); });
render();
})();
