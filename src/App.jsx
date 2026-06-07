import { useState, useEffect, useRef } from "react";

const MONTHLY_BUDGET = 500;
const MONTHLY_SAVINGS = 20;
const START_MONTH = 5;
const START_YEAR = 2026;

const CATEGORIES = [
  { id:"food",    name:"Food & Drinks", emoji:"🧋", color:"#FF6B6B", bg:"#FFF0F0", budget:238.17 },
  { id:"fun",     name:"Fun & Games",   emoji:"🎮", color:"#6C63FF", bg:"#F0EFFF", budget:67.5   },
  { id:"gifts",   name:"Gifts",         emoji:"🎁", color:"#FF9F43", bg:"#FFF5E6", budget:45.0   },
  { id:"charity", name:"Giving Back",   emoji:"❤️", color:"#EE5A87", bg:"#FFF0F5", budget:6.67   },
];

const DEFAULT_FUTURE = [
  { id:"fe1", name:"Escape Room", emoji:"🚪", costPerUse:50,   timesPerYear:1,  monthly:4.00,   type:"limited",   note:"$50 · 1x/year"         },
  { id:"fe2", name:"Mini Golf",   emoji:"⛳", costPerUse:15,   timesPerYear:2,  monthly:2.50,   type:"limited",   note:"$15 · 2x/year"          },
  { id:"fe3", name:"Hyperspace",  emoji:"🚀", costPerUse:20,   timesPerYear:6,  monthly:10.00,  type:"limited",   note:"$20 · 6x/year"          },
  { id:"fe4", name:"Video Games", emoji:"🕹️", costPerUse:13,   timesPerYear:12, monthly:13.00,  type:"recurring", note:"$13/month"              },
  { id:"fe5", name:"Movies",      emoji:"🎬", costPerUse:20,   timesPerYear:4,  monthly:6.00,   type:"limited",   note:"$20 · 4x/year"          },
  { id:"fe6", name:"Skiing",      emoji:"⛷️", costPerUse:40,   timesPerYear:5,  monthly:16.67,  type:"limited",   note:"$40 · 5x/year"          },
  { id:"fe7", name:"Disney Trip", emoji:"🏰", costPerUse:1435, timesPerYear:1,  monthly:119.58, type:"limited",   note:"Park+Hotel+Flights+Food" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const STORAGE_KEY = "jai_budget_v6";

function loadData() {
  try {
    const r=localStorage.getItem(STORAGE_KEY);
    if(r) {
      const stored=JSON.parse(r);
      // Always re-apply DEFAULT_FUTURE fields (name, emoji, costPerUse, timesPerYear, monthly, type, note)
      // but keep any user-logged uses. User-added items (not in DEFAULT_FUTURE) are kept as-is.
      const defaultIds=new Set(DEFAULT_FUTURE.map(f=>f.id));
      const storedById=Object.fromEntries((stored.futureItems||[]).map(f=>[f.id,f]));
      const mergedDefaults=DEFAULT_FUTURE.map(def=>({
        ...def,                                      // always use latest defaults
        uses:(storedById[def.id]?.uses)||[],         // keep logged uses
      }));
      const userAdded=(stored.futureItems||[]).filter(f=>!defaultIds.has(f.id));
      return { ...stored, futureItems:[...mergedDefaults,...userAdded] };
    }
  } catch {}
  return { transactions:[], earnings:[], closedMonths:[], savingsJar:0, savingsLog:[], futureItems:DEFAULT_FUTURE.map(f=>({...f,uses:[]})) };
}
function saveData(d) { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(d)); } catch {} }

function availableMonths() {
  const now=new Date(); const months=[]; let m=START_MONTH,y=START_YEAR;
  while(y<now.getFullYear()||(y===now.getFullYear()&&m<=now.getMonth())) { months.push({m,y}); m++; if(m>11){m=0;y++;} }
  return months;
}
function monthsElapsed(upToMonth) { return Math.max(1, upToMonth - START_MONTH + 1); }

export default function App() {
  const [view,setView]               = useState("home");
  const [data,setData]               = useState(loadData);
  const [selMonth,setSelMonth]       = useState(new Date().getMonth());
  const [selectedCat,setSelectedCat] = useState(null);
  const [amount,setAmount]           = useState("");
  const [note,setNote]               = useState("");
  const [earnAmt,setEarnAmt]         = useState("");
  const [earnNote,setEarnNote]       = useState("");
  const [toast,setToast]             = useState(null);
  const [jarModal,setJarModal]       = useState(false);
  const [jarAction,setJarAction]     = useState("withdraw");
  const [jarAmt,setJarAmt]           = useState("");
  const [jarNote,setJarNote]         = useState("");
  const [rolloverModal,setRolloverModal] = useState(null);
  const [editTxn,setEditTxn]         = useState(null);
  const [futureModal,setFutureModal] = useState(false);
  const [useModal,setUseModal]       = useState(null);
  const [useAmt,setUseAmt]           = useState("");
  const [useNote,setUseNote]         = useState("");
  const [addFutureModal,setAddFutureModal] = useState(false);
  const [nfName,setNfName]   = useState("");
  const [nfEmoji,setNfEmoji] = useState("🎯");
  const [nfCost,setNfCost]   = useState("");
  const [nfTimes,setNfTimes] = useState("");
  const [nfType,setNfType]   = useState("limited");
  const [nfNote,setNfNote]   = useState("");
  // Edit future item
  const [editFutureItem,setEditFutureItem] = useState(null); // item being edited
  // Edit/delete a logged use
  const [editUseModal,setEditUseModal]     = useState(null); // {item, use}
  // Report / AI coach
  const [reportView,setReportView]   = useState(false);
  const [chatMsgs,setChatMsgs]       = useState([]);
  const [chatInput,setChatInput]     = useState("");
  const [chatLoading,setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const now=new Date(); const currentYear=START_YEAR;
  const monthKey=(m,y)=>`${y}-${m}`;

  useEffect(()=>{ saveData(data); },[data]);

  useEffect(()=>{
    const prevM=now.getMonth()===0?11:now.getMonth()-1;
    const prevY=now.getMonth()===0?now.getFullYear()-1:now.getFullYear();
    if(prevM<START_MONTH&&prevY<=START_YEAR) return;
    const key=monthKey(prevM,prevY);
    if(data.closedMonths.includes(key)) return;
    const prevTxns=data.transactions.filter(t=>{const d=new Date(t.date);return d.getMonth()===prevM&&d.getFullYear()===prevY&&!t.isRollover;});
    if(!prevTxns.length) return;
    const prevEarned=data.earnings.filter(e=>{const d=new Date(e.date);return d.getMonth()===prevM&&d.getFullYear()===prevY;}).reduce((s,e)=>s+e.amount,0)+MONTHLY_BUDGET;
    const leftover=parseFloat((prevEarned-prevTxns.reduce((s,t)=>s+t.amount,0)).toFixed(2));
    if(leftover>0) setRolloverModal({m:prevM,y:prevY,leftover});
  },[]);

  useEffect(()=>{
    const key=monthKey(selMonth,currentYear);
    if(!data.savingsLog.some(s=>s.type==="monthly"&&s.monthKey===key)) {
      const entry={id:Date.now()+Math.random(),amount:MONTHLY_SAVINGS,note:`📅 Monthly savings — ${MONTHS[selMonth]}`,date:new Date(currentYear,selMonth,1,0,0,1).toISOString(),type:"monthly",monthKey:key};
      setData(d=>({...d,savingsJar:d.savingsJar+MONTHLY_SAVINGS,savingsLog:[entry,...d.savingsLog]}));
    }
  },[selMonth]);

  useEffect(()=>{ if(chatEndRef.current) chatEndRef.current.scrollIntoView({behavior:"smooth"}); },[chatMsgs]);

  function showToast(msg,color="#00C9A7") { setToast({msg,color}); setTimeout(()=>setToast(null),2800); }

  const futureMonthlyTotal=(data.futureItems||[]).reduce((s,f)=>s+(f.monthly||0),0);
  const effectiveBudget=MONTHLY_BUDGET-futureMonthlyTotal-MONTHLY_SAVINGS;
  const monthTxns=data.transactions.filter(t=>{const d=new Date(t.date);return d.getMonth()===selMonth&&d.getFullYear()===currentYear;});
  const monthEarns=data.earnings.filter(e=>{const d=new Date(e.date);return d.getMonth()===selMonth&&d.getFullYear()===currentYear;});
  const totalSpent=monthTxns.filter(t=>!t.isRollover).reduce((s,t)=>s+t.amount,0);
  const totalEarned=effectiveBudget+monthEarns.reduce((s,e)=>s+e.amount,0);
  const remaining=parseFloat((totalEarned-totalSpent).toFixed(2));
  const isClosed=data.closedMonths.includes(monthKey(selMonth,currentYear));
  function spentInCat(catId) { return monthTxns.filter(t=>t.catId===catId&&!t.isRollover).reduce((s,t)=>s+t.amount,0); }

  function itemStats(item) {
    const elapsed=monthsElapsed(selMonth);
    const pool=parseFloat((item.monthly*elapsed).toFixed(2));
    const uses=item.uses||[];
    const totalUsed=parseFloat(uses.reduce((s,u)=>s+u.amount,0).toFixed(2));
    const useCount=uses.length;
    const annualAllowed=item.type==="recurring"?null:item.timesPerYear;
    const usesLeft=annualAllowed!==null?Math.max(0,annualAllowed-useCount):null;
    const balance=parseFloat((pool-totalUsed).toFixed(2));
    return {pool,totalUsed,useCount,annualAllowed,usesLeft,balance};
  }

  // ── Build context string for AI ──
  function buildFinancialContext() {
    const catBreakdown = CATEGORIES.map(cat => {
      const spent = spentInCat(cat.id);
      const pct = Math.round(spent/cat.budget*100);
      return `  ${cat.name}: spent $${spent.toFixed(2)} of $${cat.budget.toFixed(2)} budget (${pct}%)`;
    }).join("\n");
    const futureBreakdown = (data.futureItems||[]).map(item => {
      const s = itemStats(item);
      return `  ${item.name}: pool $${s.pool.toFixed(2)}, used $${s.totalUsed.toFixed(2)}, ${item.type==="limited"?`${s.usesLeft} uses left of ${item.timesPerYear}`:"monthly sub"}`;
    }).join("\n");
    return `
Jai's Budget Snapshot — ${MONTHS[selMonth]} ${currentYear}:
- Monthly income: $500 (chores + allowance)
- Savings auto-deducted: $20/month
- Future expenses auto-deducted: $${futureMonthlyTotal.toFixed(2)}/month
- Spendable budget this month: $${effectiveBudget.toFixed(2)}
- Total spent: $${totalSpent.toFixed(2)}
- Remaining: $${remaining.toFixed(2)}
- Month closed: ${isClosed?"yes":"no"}

Spending by category:
${catBreakdown}

Future expense pools (${MONTHS[selMonth]}):
${futureBreakdown}

Savings jar total: $${data.savingsJar.toFixed(2)}
All-time future uses logged: ${(data.futureItems||[]).reduce((s,f)=>s+(f.uses||[]).length,0)}
`.trim();
  }

  // ── AI Report / Coach ──
  async function startReport() {
    setReportView(true);
    if (chatMsgs.length > 0) return; // already loaded
    setChatLoading(true);
    const ctx = buildFinancialContext();
    const systemPrompt = `You are "Coach Jai" — a fun, hype, money-savvy coach for a kid named Jai who is around 12-14 years old. You sound like a mix between a podcast host and a cool social media finance influencer — energetic, encouraging, uses emojis naturally, casual but actually helpful. You give REAL money advice, celebrate wins, call out areas to improve, and make budgeting feel exciting not boring.

Jai earns ~$500/month from chores (sometimes less if they miss some), automatically saves $20/month, and pre-allocates money for future fun things. The goal is to spend smart, save consistently, and hit fun goals like the Disney trip.

Here is Jai's current financial data:
${ctx}

When giving the opening report:
- Open with hype and a headline-style summary (like a podcast intro)
- Celebrate specific wins (categories under budget, money saved, etc.)
- Flag any areas of concern clearly but kindly
- Give 2-3 specific, actionable tips Jai can use THIS month
- End with a motivating closer about a goal (Disney trip, savings jar, etc.)
- Keep it conversational, use line breaks for readability
- Total length: aim for ~250-350 words, punchy paragraphs

After the opening report, Jai can ask follow-up questions. Keep answers short, specific to their data, and always end with encouragement or a tip.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system: systemPrompt,
          messages:[{role:"user",content:"Give me my monthly money report!"}]
        })
      });
      const d = await res.json();
      const text = d.content?.find(c=>c.type==="text")?.text || "Couldn't load report right now. Try again!";
      setChatMsgs([{role:"assistant",text}]);
    } catch(e) {
      setChatMsgs([{role:"assistant",text:"Oops! Couldn't connect right now. Make sure you're online and try again 🔌"}]);
    }
    setChatLoading(false);
  }

  async function sendChatMsg() {
    const msg = chatInput.trim();
    if (!msg||chatLoading) return;
    const newMsgs = [...chatMsgs, {role:"user",text:msg}];
    setChatMsgs(newMsgs);
    setChatInput("");
    setChatLoading(true);

    const ctx = buildFinancialContext();
    const systemPrompt = `You are "Coach Jai" — a fun, energetic money coach for a kid named Jai (12-14 yrs old). Sound like a podcast host mixed with a finance influencer. Be real, be helpful, use emojis naturally. Keep answers SHORT and punchy (under 120 words unless a list is needed). Always tie back to Jai's actual numbers.

Jai's current financial data:
${ctx}`;

    const apiMsgs = newMsgs.map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.text}));

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:systemPrompt,messages:apiMsgs})
      });
      const d = await res.json();
      const text = d.content?.find(c=>c.type==="text")?.text || "Hmm, try asking again!";
      setChatMsgs(prev=>[...prev,{role:"assistant",text}]);
    } catch {
      setChatMsgs(prev=>[...prev,{role:"assistant",text:"Connection issue! Try again 🔌"}]);
    }
    setChatLoading(false);
  }

  // ── Standard actions ──
  function addSpend() {
    const val=parseFloat(amount); if(!val||val<=0||!selectedCat) return;
    setData(d=>({...d,transactions:[{id:Date.now(),catId:selectedCat,amount:val,note:note||CATEGORIES.find(c=>c.id===selectedCat)?.name,date:new Date().toISOString()},...d.transactions]}));
    setAmount(""); setNote(""); setSelectedCat(null); showToast("💸 Spend tracked!"); setView("home");
  }
  function addEarning() {
    const val=parseFloat(earnAmt); if(!val||val<=0) return;
    setData(d=>({...d,earnings:[{id:Date.now(),amount:val,note:earnNote||"Extra earnings",date:new Date().toISOString()},...d.earnings]}));
    setEarnAmt(""); setEarnNote(""); showToast("🌟 Earnings added!","#FFD93D"); setView("home");
  }
  function closeMonth(m,y,leftover) {
    const key=monthKey(m,y);
    const entry={id:Date.now(),amount:leftover,note:`🔄 Rollover from ${MONTHS[m]} ${y}`,date:new Date(y,m+1,0,23,59,59).toISOString(),type:"rollover",monthKey:key};
    setData(d=>({...d,savingsJar:d.savingsJar+leftover,savingsLog:[entry,...d.savingsLog],closedMonths:[...d.closedMonths,key]}));
    showToast(`🐷 $${leftover.toFixed(2)} saved!`,"#FFD93D"); setRolloverModal(null);
  }
  function closeNoLeftover(m,y) { setData(d=>({...d,closedMonths:[...d.closedMonths,monthKey(m,y)]})); showToast("Month closed!"); }
  function reopenMonth(m,y) {
    const key=monthKey(m,y); const re=data.savingsLog.find(s=>s.type==="rollover"&&s.monthKey===key);
    setData(d=>({...d,closedMonths:d.closedMonths.filter(k=>k!==key),savingsJar:re?Math.max(0,d.savingsJar-re.amount):d.savingsJar,savingsLog:re?d.savingsLog.filter(s=>!(s.type==="rollover"&&s.monthKey===key)):d.savingsLog}));
    showToast(`🔓 ${MONTHS[m]} reopened!`,"#6C63FF");
  }
  function submitJar() {
    const val=parseFloat(jarAmt); if(!val||val<=0) return;
    if(jarAction==="withdraw"&&val>data.savingsJar){showToast("Not enough! 😅","#FF6B6B");return;}
    const entry={id:Date.now(),amount:val,note:jarNote||(jarAction==="withdraw"?"Withdrawal":"Deposit"),date:new Date().toISOString(),type:jarAction};
    setData(d=>({...d,savingsJar:parseFloat((jarAction==="withdraw"?d.savingsJar-val:d.savingsJar+val).toFixed(2)),savingsLog:[entry,...d.savingsLog]}));
    showToast(jarAction==="withdraw"?`💸 $${val.toFixed(2)} taken out`:`🐷 $${val.toFixed(2)} added`,jarAction==="withdraw"?"#FF6B6B":"#FFD93D");
    setJarAmt(""); setJarNote(""); setJarModal(false);
  }
  function logUse() {
    if(!useModal) return;
    const val=parseFloat(useAmt)||useModal.costPerUse; if(!val||val<=0) return;
    const entry={id:Date.now(),date:new Date().toISOString(),amount:val,note:useNote||useModal.name};
    setData(d=>({...d,futureItems:d.futureItems.map(f=>f.id===useModal.id?{...f,uses:[entry,...(f.uses||[])]}:f)}));
    showToast(`✅ ${useModal.name} logged!`,"#00C9A7"); setUseAmt(""); setUseNote(""); setUseModal(null);
  }
  function deleteUse(itemId, useId) {
    setData(d=>({...d,futureItems:d.futureItems.map(f=>f.id===itemId?{...f,uses:(f.uses||[]).filter(u=>u.id!==useId)}:f)}));
    showToast("Use removed!","#aaa"); setEditUseModal(null);
  }
  function addFutureItem() {
    if(!nfName||!nfCost||!nfTimes) return;
    const cost=parseFloat(nfCost),times=parseFloat(nfTimes);
    const monthly=nfType==="recurring"?cost:parseFloat((cost*times/12).toFixed(2));
    setData(d=>({...d,futureItems:[...d.futureItems,{id:`fe${Date.now()}`,name:nfName,emoji:nfEmoji||"🎯",costPerUse:cost,timesPerYear:times,monthly,type:nfType,note:nfNote||`$${cost} · ${times}x/year`,uses:[]}]}));
    showToast("✨ Added!","#6C63FF");
    setNfName(""); setNfEmoji("🎯"); setNfCost(""); setNfTimes(""); setNfType("limited"); setNfNote(""); setAddFutureModal(false);
  }
  function saveFutureItemEdit() {
    if(!editFutureItem) return;
    const cost=parseFloat(editFutureItem.costPerUse)||0, times=parseFloat(editFutureItem.timesPerYear)||1;
    const monthly=editFutureItem.type==="recurring"?cost:parseFloat((cost*times/12).toFixed(2));
    setData(d=>({...d,futureItems:d.futureItems.map(f=>f.id===editFutureItem.id?{...editFutureItem,monthly}:f)}));
    showToast("Updated! ✅"); setEditFutureItem(null);
  }
  function deleteFutureItem(id) {
    setData(d=>({...d,futureItems:d.futureItems.filter(f=>f.id!==id)}));
    showToast("Removed!","#aaa"); setEditFutureItem(null);
  }
  function saveEditTxn() {
    const val=parseFloat(editTxn.amount); if(!val||val<=0) return;
    setData(d=>({...d,transactions:d.transactions.map(t=>t.id===editTxn.id?{...t,amount:val,note:editTxn.note}:t)}));
    showToast("Updated! ✅"); setEditTxn(null);
  }
  function deleteTxn(id) { setData(d=>({...d,transactions:d.transactions.filter(t=>t.id!==id)})); showToast("Deleted!","#aaa"); setEditTxn(null); }

  const avail=availableMonths();
  const allHistory=[...data.transactions.map(t=>({...t,kind:"spend"})),...data.earnings.map(e=>({...e,kind:"earn"}))].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,60);

  // ── Shared styles ──
  const OL={position:"fixed",inset:0,background:"rgba(0,0,0,.56)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,animation:"fadeIn .2s"};
  const MB={background:"#fff",borderRadius:26,padding:"22px 18px",maxWidth:390,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.3)",maxHeight:"88vh",overflowY:"auto"};
  const INP={width:"100%",padding:"11px 13px",borderRadius:12,border:"2px solid #e8e8e8",fontSize:15,fontWeight:700,fontFamily:"inherit",outline:"none",boxSizing:"border-box",color:"#333",marginBottom:8};
  const BTN=(bg,col="#fff",mb=8)=>({width:"100%",padding:"13px",background:bg,color:col,border:"none",borderRadius:13,fontSize:14,fontWeight:900,cursor:"pointer",fontFamily:"inherit",marginBottom:mb});

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#667eea,#764ba2)",fontFamily:"'Nunito',system-ui,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-18px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes pop{from{transform:scale(.93);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .card{animation:pop .2s ease}.bp:active{transform:scale(.95)}
        ::-webkit-scrollbar{width:0} input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        .typing span{display:inline-block;animation:pulse 1.2s infinite}.typing span:nth-child(2){animation-delay:.2s}.typing span:nth-child(3){animation-delay:.4s}
      `}</style>

      {toast&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:toast.color,color:"#fff",borderRadius:999,padding:"11px 26px",fontWeight:800,fontSize:15,zIndex:1002,boxShadow:"0 8px 30px rgba(0,0,0,.2)",animation:"slideDown .3s ease",whiteSpace:"nowrap"}}>{toast.msg}</div>}

      {/* ══ REPORT / AI COACH VIEW ══ */}
      {reportView&&(
        <div style={{position:"fixed",inset:0,zIndex:1000,background:"#0f0c29",display:"flex",flexDirection:"column",maxWidth:430,margin:"0 auto"}}>
          {/* Report header */}
          <div style={{background:"linear-gradient(135deg,#1a1a2e,#16213e)",padding:"18px 18px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div>
              <div style={{fontWeight:900,fontSize:17,color:"#fff"}}>🎙️ Coach Jai</div>
              <div style={{fontWeight:600,fontSize:11,color:"rgba(255,255,255,.5)"}}>Your personal money hype coach</div>
            </div>
            <button onClick={()=>setReportView(false)} className="bp" style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:999,padding:"8px 16px",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
          </div>

          {/* Chat messages */}
          <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
            {chatMsgs.length===0&&!chatLoading&&(
              <div style={{textAlign:"center",padding:"40px 20px",color:"rgba(255,255,255,.4)"}}>
                <div style={{fontSize:48,marginBottom:10}}>🎙️</div>
                <div style={{fontWeight:800,fontSize:15,color:"rgba(255,255,255,.6)"}}>Coach Jai is loading your report...</div>
              </div>
            )}
            {chatMsgs.map((m,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start"}}>
                {m.role==="assistant"&&<div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",marginBottom:4,marginLeft:4}}>🎙️ Coach Jai</div>}
                <div style={{
                  maxWidth:"88%",padding:"12px 15px",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                  background:m.role==="user"?"linear-gradient(135deg,#667eea,#764ba2)":"rgba(255,255,255,.08)",
                  color:"#fff",fontSize:14,fontWeight:600,lineHeight:1.6,
                  border:m.role==="assistant"?"1px solid rgba(255,255,255,.08)":"none",
                  whiteSpace:"pre-wrap",
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {chatLoading&&(
              <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                <div style={{background:"rgba(255,255,255,.08)",borderRadius:"18px 18px 18px 4px",padding:"12px 18px",border:"1px solid rgba(255,255,255,.08)"}}>
                  <div className="typing" style={{color:"rgba(255,255,255,.6)",fontSize:18,letterSpacing:3}}>
                    <span>●</span><span>●</span><span>●</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>

          {/* Suggested questions */}
          {chatMsgs.length===1&&!chatLoading&&(
            <div style={{padding:"0 14px 10px",flexShrink:0}}>
              <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",marginBottom:7}}>ASK ME ANYTHING:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {["Where am I overspending?","How close am I to Disney?","What should I cut back on?","How much will I save by Dec?","Am I on track this month?"].map(q=>(
                  <button key={q} onClick={()=>{setChatInput(q);}} className="bp" style={{background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.8)",border:"1px solid rgba(255,255,255,.15)",borderRadius:999,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"auto",marginBottom:0}}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input bar */}
          <div style={{padding:"12px 14px 16px",background:"rgba(0,0,0,.3)",flexShrink:0,display:"flex",gap:8}}>
            <input
              value={chatInput} onChange={e=>setChatInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&sendChatMsg()}
              placeholder="Ask Coach Jai anything..."
              style={{flex:1,padding:"12px 15px",borderRadius:999,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.08)",color:"#fff",fontSize:14,fontWeight:600,fontFamily:"inherit",outline:"none"}}
            />
            <button onClick={sendChatMsg} disabled={!chatInput.trim()||chatLoading} className="bp" style={{background:chatInput.trim()&&!chatLoading?"linear-gradient(135deg,#667eea,#764ba2)":"rgba(255,255,255,.1)",color:"#fff",border:"none",borderRadius:999,padding:"0 18px",fontSize:18,cursor:"pointer",fontFamily:"inherit",width:"auto",marginBottom:0,opacity:chatInput.trim()&&!chatLoading?1:.5}}>
              →
            </button>
          </div>
        </div>
      )}

      {/* ══ MODALS ══ */}

      {rolloverModal&&<div style={OL}><div style={MB}><div style={{textAlign:"center"}}>
        <div style={{fontSize:50,marginBottom:6}}>🐷</div>
        <div style={{fontWeight:900,fontSize:18,color:"#333",marginBottom:7}}>{MONTHS[rolloverModal.m]} ended!</div>
        <div style={{fontWeight:600,fontSize:13,color:"#666",marginBottom:16,lineHeight:1.5}}>You had <span style={{color:"#00C9A7",fontWeight:900}}>${rolloverModal.leftover.toFixed(2)}</span> left. Save it?</div>
        <button onClick={()=>closeMonth(rolloverModal.m,rolloverModal.y,rolloverModal.leftover)} className="bp" style={BTN("linear-gradient(135deg,#FFD93D,#FF9F43)","#5a3e00")}>Yes! +${rolloverModal.leftover.toFixed(2)} 🐷</button>
        <button onClick={()=>{setData(d=>({...d,closedMonths:[...d.closedMonths,monthKey(rolloverModal.m,rolloverModal.y)]}));setRolloverModal(null);}} className="bp" style={BTN("#f5f5f5","#999",0)}>Skip</button>
      </div></div></div>}

      {jarModal&&<div style={OL}><div style={MB}>
        <div style={{fontWeight:900,fontSize:18,color:"#333",marginBottom:12,textAlign:"center"}}>🐷 Edit Savings Jar</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:11}}>
          {["withdraw","deposit"].map(a=><button key={a} onClick={()=>setJarAction(a)} className="bp" style={{padding:"10px",borderRadius:12,border:`2px solid ${jarAction===a?(a==="withdraw"?"#FF6B6B":"#FFD93D"):"#eee"}`,background:jarAction===a?(a==="withdraw"?"#FFF0F0":"#FFFBE6"):"#fafafa",fontWeight:800,fontSize:13,color:jarAction===a?(a==="withdraw"?"#FF6B6B":"#FF9F43"):"#bbb",cursor:"pointer",fontFamily:"inherit"}}>{a==="withdraw"?"💸 Take Out":"➕ Add"}</button>)}
        </div>
        <div style={{fontWeight:700,fontSize:12,color:"#888",marginBottom:7}}>Balance: <span style={{color:"#FF9F43",fontWeight:900}}>${data.savingsJar.toFixed(2)}</span></div>
        <input type="number" value={jarAmt} onChange={e=>setJarAmt(e.target.value)} placeholder="Amount" style={{...INP,fontSize:20,fontWeight:800}}/>
        <input type="text" value={jarNote} onChange={e=>setJarNote(e.target.value)} placeholder="What for?" style={INP}/>
        <button onClick={submitJar} className="bp" style={BTN(jarAction==="withdraw"?"linear-gradient(135deg,#FF6B6B,#e05050)":"linear-gradient(135deg,#FFD93D,#FF9F43)",jarAction==="withdraw"?"#fff":"#5a3e00")}>{jarAction==="withdraw"?"💸 Take out":"🐷 Add"}</button>
        <button onClick={()=>setJarModal(false)} className="bp" style={BTN("#f5f5f5","#999",0)}>Cancel</button>
      </div></div>}

      {/* Future Panel */}
      {futureModal&&<div style={OL}><div style={{...MB,maxWidth:420}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:11}}>
          <div style={{fontWeight:900,fontSize:18,color:"#333"}}>🎯 Future Expenses</div>
          <button onClick={()=>setFutureModal(false)} className="bp" style={{background:"#f0f0f0",border:"none",borderRadius:999,width:28,height:28,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>×</button>
        </div>
        <div style={{background:"#F0EFFF",borderRadius:13,padding:"9px 13px",marginBottom:12,fontSize:12,color:"#6C63FF",fontWeight:700}}>
          💰 <span style={{fontWeight:900}}>${futureMonthlyTotal.toFixed(2)}/mo</span> auto-set aside from your $500
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:11}}>
          {(data.futureItems||[]).map(item=>{
            const s=itemStats(item);
            const isRec=item.type==="recurring";
            const poolPct=s.pool>0?Math.min(100,(s.totalUsed/s.pool)*100):0;
            const overPool=s.balance<0;
            const allUsed=!isRec&&s.usesLeft===0;
            return (
              <div key={item.id} style={{background:"#fff",borderRadius:15,padding:"12px 13px",boxShadow:"0 2px 10px rgba(0,0,0,.06)",borderLeft:`4px solid ${allUsed?"#ccc":"#6C63FF"}`,opacity:allUsed?.7:1}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:7}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flex:1}}>
                    <span style={{fontSize:20}}>{item.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:13,color:"#333"}}>{item.name}</div>
                      <div style={{fontWeight:600,fontSize:10,color:"#aaa"}}>{item.note} · <span style={{color:"#6C63FF"}}>${item.monthly.toFixed(2)}/mo</span></div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
                    {!isRec&&<div style={{background:allUsed?"#f0f0f0":s.usesLeft<=1?"#FFF0F0":"#E6FFF9",borderRadius:9,padding:"3px 9px",textAlign:"center",minWidth:44}}>
                      <div style={{fontWeight:900,fontSize:17,color:allUsed?"#bbb":s.usesLeft<=1?"#FF6B6B":"#00A085",lineHeight:1}}>{s.usesLeft}</div>
                      <div style={{fontWeight:700,fontSize:9,color:allUsed?"#bbb":s.usesLeft<=1?"#FF6B6B":"#00A085"}}>left</div>
                    </div>}
                    {/* Edit button */}
                    <button onClick={()=>{setEditFutureItem({...item});setFutureModal(false);}} className="bp" style={{background:"#f5f5f5",border:"none",borderRadius:9,padding:"5px 9px",fontSize:13,cursor:"pointer",fontFamily:"inherit",width:"auto",marginBottom:0}}>✏️</button>
                  </div>
                </div>
                <div style={{marginBottom:5}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,fontWeight:700,color:"#aaa",marginBottom:2}}>
                    <span>Pool: <span style={{color:overPool?"#FF6B6B":"#6C63FF",fontWeight:900}}>${s.balance.toFixed(2)} left</span></span>
                    <span>${s.totalUsed.toFixed(2)} used / ${s.pool.toFixed(2)}</span>
                  </div>
                  <div style={{background:"#f0f0f0",borderRadius:999,height:6}}>
                    <div style={{width:`${poolPct}%`,background:overPool?"#FF6B6B":allUsed?"#bbb":"#6C63FF",height:6,borderRadius:999,transition:"width .4s"}}/>
                  </div>
                </div>
                {/* Uses log with delete */}
                {(item.uses||[]).length>0&&(
                  <div style={{borderTop:"1px solid #f5f5f5",paddingTop:5,marginTop:3,marginBottom:5}}>
                    {(item.uses||[]).slice(0,3).map(u=>{
                      const d=new Date(u.date);
                      return (
                        <div key={u.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"2px 0"}}>
                          <span style={{fontSize:11,fontWeight:700,color:"#00A085"}}>✅ {MONTHS[d.getMonth()]} {d.getDate()} — {u.note} (${u.amount.toFixed(2)})</span>
                          <button onClick={()=>setEditUseModal({item,use:u})} className="bp" style={{background:"none",border:"none",cursor:"pointer",fontSize:13,padding:"0 3px",marginBottom:0,width:"auto",color:"#FF6B6B"}}>✕</button>
                        </div>
                      );
                    })}
                    {(item.uses||[]).length>3&&<div style={{fontSize:10,color:"#bbb",fontWeight:700}}>+{(item.uses||[]).length-3} more</div>}
                  </div>
                )}
                {!allUsed&&(
                  <button onClick={()=>{setUseModal(item);setUseAmt(String(item.costPerUse));setFutureModal(false);}} className="bp" style={{...BTN(s.balance<item.costPerUse?"#FFF0F0":"linear-gradient(135deg,#6C63FF,#4a41dd)",s.balance<item.costPerUse?"#FF6B6B":"#fff"),width:"100%",padding:"8px",fontSize:12,marginBottom:0}}>
                    {s.balance<item.costPerUse?"⚠️ Low funds — log anyway":"✅ I used this!"}
                  </button>
                )}
                {allUsed&&<div style={{fontSize:11,color:"#bbb",fontWeight:700,textAlign:"center",paddingTop:2}}>🎉 All {item.timesPerYear}x used this year!</div>}
              </div>
            );
          })}
        </div>
        <button onClick={()=>{setAddFutureModal(true);setFutureModal(false);}} className="bp" style={BTN("linear-gradient(135deg,#6C63FF,#4a41dd)")}>+ Add Future Expense</button>
        <button onClick={()=>setFutureModal(false)} className="bp" style={BTN("#f5f5f5","#999",0)}>Close</button>
      </div></div>}

      {/* Log Use Modal */}
      {useModal&&<div style={OL}><div style={MB}>
        {(()=>{const s=itemStats(useModal); return(<>
          <div style={{textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:42}}>{useModal.emoji}</div>
            <div style={{fontWeight:900,fontSize:18,color:"#333",marginTop:3}}>I used {useModal.name}!</div>
            <div style={{fontWeight:600,fontSize:11,color:"#aaa",marginTop:2}}>{useModal.type==="limited"?`${s.usesLeft} uses left · pool $${s.balance.toFixed(2)}`:`Pool: $${s.balance.toFixed(2)}`}</div>
          </div>
          {s.balance<useModal.costPerUse&&<div style={{background:"#FFF0F0",borderRadius:11,padding:"9px 13px",marginBottom:11,fontSize:12,fontWeight:700,color:"#FF6B6B"}}>⚠️ Pool only has ${s.balance.toFixed(2)}, this costs ~${useModal.costPerUse}!</div>}
          <input type="number" value={useAmt} onChange={e=>setUseAmt(e.target.value)} placeholder={`$${useModal.costPerUse}`} style={{...INP,fontSize:20,fontWeight:800}}/>
          <input type="text" value={useNote} onChange={e=>setUseNote(e.target.value)} placeholder="Any details? (optional)" style={INP}/>
          <button onClick={logUse} className="bp" style={BTN("linear-gradient(135deg,#00C9A7,#00A085)")}>✅ Log this use</button>
          <button onClick={()=>{setUseModal(null);setFutureModal(true);}} className="bp" style={BTN("#f5f5f5","#999",0)}>← Back</button>
        </>);})()}
      </div></div>}

      {/* Edit Use Modal (delete logged use) */}
      {editUseModal&&<div style={OL}><div style={MB}>
        <div style={{fontWeight:900,fontSize:17,color:"#333",marginBottom:5}}>Remove this use?</div>
        <div style={{background:"#f5f5f5",borderRadius:12,padding:"11px 14px",marginBottom:14}}>
          <div style={{fontWeight:800,fontSize:14,color:"#333"}}>{editUseModal.item.emoji} {editUseModal.item.name}</div>
          <div style={{fontWeight:700,fontSize:13,color:"#666",marginTop:2}}>{editUseModal.use.note} — ${editUseModal.use.amount.toFixed(2)}</div>
          <div style={{fontWeight:600,fontSize:11,color:"#aaa",marginTop:2}}>{new Date(editUseModal.use.date).toLocaleDateString()}</div>
        </div>
        <button onClick={()=>deleteUse(editUseModal.item.id,editUseModal.use.id)} className="bp" style={BTN("linear-gradient(135deg,#FF6B6B,#e05050)")}>🗑️ Yes, remove it</button>
        <button onClick={()=>{setEditUseModal(null);setFutureModal(true);}} className="bp" style={BTN("#f5f5f5","#999",0)}>Keep it</button>
      </div></div>}

      {/* Edit Future Item Modal */}
      {editFutureItem&&<div style={OL}><div style={MB}>
        <div style={{fontWeight:900,fontSize:18,color:"#333",marginBottom:14}}>✏️ Edit {editFutureItem.name}</div>
        <div style={{display:"flex",gap:7,marginBottom:0}}>
          <input type="text" value={editFutureItem.emoji} onChange={e=>setEditFutureItem({...editFutureItem,emoji:e.target.value})} style={{...INP,width:50,textAlign:"center",fontSize:22,padding:"9px 5px"}}/>
          <input type="text" value={editFutureItem.name} onChange={e=>setEditFutureItem({...editFutureItem,name:e.target.value})} style={{...INP,flex:1}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:0}}>
          {["limited","recurring"].map(t=><button key={t} onClick={()=>setEditFutureItem({...editFutureItem,type:t})} className="bp" style={{padding:"9px",borderRadius:12,border:`2px solid ${editFutureItem.type===t?"#6C63FF":"#eee"}`,background:editFutureItem.type===t?"#F0EFFF":"#fafafa",fontWeight:800,fontSize:11,color:editFutureItem.type===t?"#6C63FF":"#bbb",cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>
            {t==="limited"?"🎯 Limited":"🔄 Monthly"}
          </button>)}
        </div>
        <div style={{fontWeight:700,fontSize:11,color:"#aaa",marginBottom:4}}>COST PER USE ($)</div>
        <input type="number" value={editFutureItem.costPerUse} onChange={e=>setEditFutureItem({...editFutureItem,costPerUse:e.target.value})} style={INP}/>
        <div style={{fontWeight:700,fontSize:11,color:"#aaa",marginBottom:4}}>TIMES PER YEAR</div>
        <input type="number" value={editFutureItem.timesPerYear} onChange={e=>setEditFutureItem({...editFutureItem,timesPerYear:e.target.value})} style={INP}/>
        <div style={{fontWeight:700,fontSize:11,color:"#aaa",marginBottom:4}}>NOTE</div>
        <input type="text" value={editFutureItem.note} onChange={e=>setEditFutureItem({...editFutureItem,note:e.target.value})} style={INP}/>
        {editFutureItem.costPerUse&&editFutureItem.timesPerYear&&<div style={{background:"#F0EFFF",borderRadius:11,padding:"8px 13px",marginBottom:9,fontSize:12,fontWeight:700,color:"#6C63FF"}}>
          New monthly set-aside: <span style={{fontWeight:900}}>${(parseFloat(editFutureItem.costPerUse||0)*parseFloat(editFutureItem.timesPerYear||0)/12).toFixed(2)}/mo</span>
        </div>}
        <button onClick={saveFutureItemEdit} className="bp" style={BTN("linear-gradient(135deg,#6C63FF,#4a41dd)")}>Save Changes ✅</button>
        <button onClick={()=>deleteFutureItem(editFutureItem.id)} className="bp" style={BTN("linear-gradient(135deg,#FF6B6B,#e05050)")}>🗑️ Delete this item</button>
        <button onClick={()=>{setEditFutureItem(null);setFutureModal(true);}} className="bp" style={BTN("#f5f5f5","#999",0)}>← Back</button>
      </div></div>}

      {/* Add Future Modal */}
      {addFutureModal&&<div style={OL}><div style={MB}>
        <div style={{fontWeight:900,fontSize:18,color:"#333",marginBottom:12}}>✨ New Future Expense</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:11}}>
          {["limited","recurring"].map(t=><button key={t} onClick={()=>setNfType(t)} className="bp" style={{padding:"10px",borderRadius:12,border:`2px solid ${nfType===t?"#6C63FF":"#eee"}`,background:nfType===t?"#F0EFFF":"#fafafa",fontWeight:800,fontSize:11,color:nfType===t?"#6C63FF":"#bbb",cursor:"pointer",fontFamily:"inherit",marginBottom:0}}>
            {t==="limited"?"🎯 Limited (X/yr)":"🔄 Monthly sub"}
          </button>)}
        </div>
        <div style={{display:"flex",gap:7}}>
          <input type="text" value={nfEmoji} onChange={e=>setNfEmoji(e.target.value)} placeholder="🎯" style={{...INP,width:50,textAlign:"center",fontSize:22,padding:"9px 5px"}}/>
          <input type="text" value={nfName} onChange={e=>setNfName(e.target.value)} placeholder="Name" style={{...INP,flex:1}}/>
        </div>
        <input type="number" value={nfCost} onChange={e=>setNfCost(e.target.value)} placeholder="Cost per use ($)" style={INP}/>
        <input type="number" value={nfTimes} onChange={e=>setNfTimes(e.target.value)} placeholder={nfType==="limited"?"Times per year":"1"} style={INP}/>
        {nfCost&&nfTimes&&<div style={{background:"#F0EFFF",borderRadius:11,padding:"8px 13px",marginBottom:9,fontSize:12,fontWeight:700,color:"#6C63FF"}}>Monthly set-aside: <span style={{fontWeight:900}}>${(parseFloat(nfCost||0)*parseFloat(nfTimes||0)/12).toFixed(2)}/mo</span></div>}
        <input type="text" value={nfNote} onChange={e=>setNfNote(e.target.value)} placeholder="Note (optional)" style={INP}/>
        <button onClick={addFutureItem} className="bp" style={BTN("linear-gradient(135deg,#6C63FF,#4a41dd)")}>Add ✨</button>
        <button onClick={()=>{setAddFutureModal(false);setFutureModal(true);}} className="bp" style={BTN("#f5f5f5","#999",0)}>← Back</button>
      </div></div>}

      {/* Edit Txn Modal */}
      {editTxn&&<div style={OL}><div style={MB}>
        <div style={{fontWeight:900,fontSize:18,color:"#333",marginBottom:12}}>✏️ Edit Transaction</div>
        <input type="number" value={editTxn.amount} onChange={e=>setEditTxn({...editTxn,amount:e.target.value})} style={{...INP,fontSize:20,fontWeight:800}}/>
        <input type="text" value={editTxn.note} onChange={e=>setEditTxn({...editTxn,note:e.target.value})} style={INP}/>
        <button onClick={saveEditTxn} className="bp" style={BTN("linear-gradient(135deg,#667eea,#764ba2)")}>Save ✅</button>
        <button onClick={()=>deleteTxn(editTxn.id)} className="bp" style={BTN("linear-gradient(135deg,#FF6B6B,#e05050)")}>🗑️ Delete</button>
        <button onClick={()=>setEditTxn(null)} className="bp" style={BTN("#f5f5f5","#999",0)}>Cancel</button>
      </div></div>}

      {/* ════ MAIN APP ════ */}
      <div style={{maxWidth:430,margin:"0 auto",minHeight:"100vh",background:"#F7F5FF",display:"flex",flexDirection:"column"}}>

        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#667eea,#764ba2)",padding:"18px 16px 22px",color:"#fff"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
            <div style={{fontSize:12,fontWeight:700,opacity:.8,letterSpacing:1,textTransform:"uppercase"}}>Jai's Money Tracker 💰</div>
            <button onClick={()=>{ startReport(); }} className="bp" style={{background:"rgba(255,255,255,.18)",border:"1px solid rgba(255,255,255,.3)",borderRadius:999,padding:"6px 13px",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,width:"auto",marginBottom:0,backdropFilter:"blur(4px)"}}>
              📊 Run Report
            </button>
          </div>
          <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:3}}>
            {avail.map(({m,y})=><button key={`${y}-${m}`} onClick={()=>setSelMonth(m)} className="bp" style={{background:selMonth===m?"#fff":"rgba(255,255,255,.2)",color:selMonth===m?"#764ba2":"#fff",border:"none",borderRadius:999,padding:"4px 12px",fontSize:12,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",flexShrink:0}}>{MONTHS[m]}</button>)}
          </div>
          <div style={{marginTop:11,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[{label:"Spendable",val:totalEarned,emoji:"⭐"},{label:"Spent",val:totalSpent,emoji:"💸"},{label:isClosed?"Closed":"Left",val:remaining,emoji:isClosed?"🔒":remaining>=0?"😊":"😬"}].map(s=>(
              <div key={s.label} style={{background:"rgba(255,255,255,.18)",borderRadius:14,padding:"9px",textAlign:"center"}}>
                <div style={{fontSize:17}}>{s.emoji}</div>
                <div style={{fontSize:15,fontWeight:900}}>${s.val.toFixed(0)}</div>
                <div style={{fontSize:10,opacity:.8,fontWeight:700}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:9}}>
            <div style={{background:"rgba(255,255,255,.2)",borderRadius:999,height:7}}>
              <div style={{width:`${Math.min(100,totalSpent/Math.max(1,totalEarned)*100)}%`,background:totalSpent>totalEarned?"#FF6B6B":"#FFD93D",height:7,borderRadius:999,transition:"width .5s"}}/>
            </div>
          </div>
          <div style={{marginTop:6,fontSize:10,fontWeight:700,opacity:.65,textAlign:"center"}}>
            $500 − ${futureMonthlyTotal.toFixed(0)} future − $20 savings = <span style={{fontWeight:900,opacity:1}}>${effectiveBudget.toFixed(0)} spendable</span>
          </div>
        </div>

        {/* Body */}
        <div style={{flex:1,padding:"12px",overflowY:"auto"}}>
          {view==="home"&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
              {[{label:"Track Spend",emoji:"💸",v:"spend",color:"#FF6B6B"},{label:"Add Earnings",emoji:"⭐",v:"earn",color:"#FF9F43"},{label:"History",emoji:"📋",v:"history",color:"#6C63FF"}].map(b=>(
                <button key={b.v} onClick={()=>setView(b.v)} className="bp" style={{background:b.color,color:"#fff",border:"none",borderRadius:16,padding:"12px 5px",cursor:"pointer",fontFamily:"inherit",fontWeight:800,fontSize:12,display:"flex",flexDirection:"column",alignItems:"center",gap:3,boxShadow:`0 4px 14px ${b.color}55`}}>
                  <span style={{fontSize:20}}>{b.emoji}</span>{b.label}
                </button>
              ))}
            </div>
            {/* Future card */}
            <div onClick={()=>setFutureModal(true)} style={{background:"linear-gradient(135deg,#6C63FF,#4a41dd)",borderRadius:18,padding:"14px 17px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 6px 20px #6C63FF44",cursor:"pointer"}}>
              <div>
                <div style={{fontWeight:900,fontSize:15,color:"#fff"}}>🎯 Future Expenses</div>
                <div style={{fontWeight:700,fontSize:11,color:"rgba(255,255,255,.75)",marginTop:2}}>
                  {(()=>{const items=data.futureItems||[];const used=items.reduce((s,f)=>s+(f.uses||[]).length,0);const left=items.reduce((s,f)=>f.type==="recurring"?s:s+Math.max(0,f.timesPerYear-(f.uses||[]).length),0);return `${used} used · ${left} uses left this year`;})()}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:900,fontSize:22,color:"#fff"}}>${futureMonthlyTotal.toFixed(0)}<span style={{fontSize:11,opacity:.8}}>/mo</span></div>
                <div style={{fontWeight:700,fontSize:11,color:"rgba(255,255,255,.7)"}}>tap to manage ✏️</div>
              </div>
            </div>
            {/* Savings jar */}
            <div onClick={()=>setJarModal(true)} style={{background:"linear-gradient(135deg,#FFD93D,#FF9F43)",borderRadius:18,padding:"14px 17px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 6px 20px #FFD93D44",cursor:"pointer"}}>
              <div><div style={{fontWeight:900,fontSize:15,color:"#5a3e00"}}>🐷 Savings Jar</div><div style={{fontWeight:700,fontSize:11,color:"#7a5500"}}>Tap to add or take out</div></div>
              <div style={{textAlign:"right"}}><div style={{fontWeight:900,fontSize:24,color:"#5a3e00"}}>${data.savingsJar.toFixed(2)}</div><div style={{fontWeight:700,fontSize:11,color:"#7a5500"}}>total saved ✏️</div></div>
            </div>
            {!isClosed
              ?<button onClick={()=>remaining>0?closeMonth(selMonth,currentYear,remaining):closeNoLeftover(selMonth,currentYear)} className="bp" style={{width:"100%",padding:"11px",background:remaining>0?"linear-gradient(135deg,#00C9A7,#00A085)":"#eee",color:remaining>0?"#fff":"#aaa",border:"none",borderRadius:13,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginBottom:10,boxShadow:remaining>0?"0 4px 14px #00C9A755":"none"}}>
                {remaining>0?`🔒 Close ${MONTHS[selMonth]} & save $${remaining.toFixed(2)} →`:`🔒 Close ${MONTHS[selMonth]} (no leftover)`}
              </button>
              :<div style={{marginBottom:10,display:"flex",gap:7,alignItems:"center"}}>
                <div style={{flex:1,background:"#E6FFF9",borderRadius:12,padding:"9px 12px",display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:14}}>✅</span><span style={{fontWeight:800,fontSize:12,color:"#00A085"}}>{MONTHS[selMonth]} closed!</span>
                </div>
                <button onClick={()=>reopenMonth(selMonth,currentYear)} className="bp" style={{padding:"9px 12px",background:"#F0EFFF",color:"#6C63FF",border:"none",borderRadius:12,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>🔓 Reopen</button>
              </div>
            }
            <div style={{fontWeight:900,fontSize:14,color:"#333",marginBottom:8}}>This Month's Buckets</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {CATEGORIES.map(cat=>{
                const spent=spentInCat(cat.id),pct=Math.min(100,(spent/cat.budget)*100),over=spent>cat.budget;
                return(
                  <div key={cat.id} className="card" style={{background:"#fff",borderRadius:16,padding:"11px 13px",boxShadow:"0 2px 9px rgba(0,0,0,.06)",borderLeft:`5px solid ${cat.color}`}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:18}}>{cat.emoji}</span><span style={{fontWeight:800,fontSize:13,color:"#333"}}>{cat.name}</span></div>
                      <div><span style={{fontWeight:900,fontSize:13,color:over?"#FF6B6B":"#333"}}>${spent.toFixed(2)}</span><span style={{fontWeight:600,fontSize:11,color:"#aaa"}}> /${cat.budget.toFixed(0)}</span></div>
                    </div>
                    <div style={{background:"#f0f0f0",borderRadius:999,height:6}}><div style={{width:`${pct}%`,background:over?"#FF6B6B":cat.color,height:6,borderRadius:999,transition:"width .4s"}}/></div>
                    {over&&<div style={{fontSize:10,color:"#FF6B6B",fontWeight:700,marginTop:2}}>⚠️ Over by ${(spent-cat.budget).toFixed(2)}!</div>}
                  </div>
                );
              })}
            </div>
          </>}

          {view==="spend"&&<div className="card">
            <button onClick={()=>setView("home")} style={{background:"none",border:"none",fontWeight:800,fontSize:13,color:"#764ba2",cursor:"pointer",marginBottom:10,padding:0,fontFamily:"inherit"}}>← Back</button>
            <div style={{fontWeight:900,fontSize:20,color:"#333",marginBottom:3}}>Track a Spend 💸</div>
            <div style={{fontWeight:600,fontSize:12,color:"#888",marginBottom:14}}>Pick a category</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              {CATEGORIES.map(cat=>(
                <button key={cat.id} onClick={()=>setSelectedCat(cat.id)} className="bp" style={{background:selectedCat===cat.id?cat.color:cat.bg,color:selectedCat===cat.id?"#fff":"#333",border:`2px solid ${selectedCat===cat.id?cat.color:"transparent"}`,borderRadius:14,padding:"12px 8px",cursor:"pointer",fontFamily:"inherit",fontWeight:800,fontSize:12,display:"flex",flexDirection:"column",alignItems:"center",gap:3,boxShadow:selectedCat===cat.id?`0 4px 14px ${cat.color}55`:"0 2px 7px rgba(0,0,0,.05)",transition:"all .15s"}}>
                  <span style={{fontSize:23}}>{cat.emoji}</span>
                  <span style={{textAlign:"center",lineHeight:1.2}}>{cat.name}</span>
                  <span style={{fontSize:10,opacity:.7}}>${spentInCat(cat.id).toFixed(0)} / ${cat.budget.toFixed(0)}</span>
                </button>
              ))}
            </div>
            {selectedCat&&<>
              <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="$0.00" style={{...INP,fontSize:20,fontWeight:800}}/>
              <input type="text" value={note} onChange={e=>setNote(e.target.value)} placeholder="What was it for? (optional)" style={INP}/>
              <button onClick={addSpend} disabled={!amount||parseFloat(amount)<=0} className="bp" style={{...BTN("linear-gradient(135deg,#667eea,#764ba2)"),opacity:(!amount||parseFloat(amount)<=0)?.5:1}}>Add Spend ✅</button>
            </>}
          </div>}

          {view==="earn"&&<div className="card">
            <button onClick={()=>setView("home")} style={{background:"none",border:"none",fontWeight:800,fontSize:13,color:"#764ba2",cursor:"pointer",marginBottom:10,padding:0,fontFamily:"inherit"}}>← Back</button>
            <div style={{fontWeight:900,fontSize:20,color:"#333",marginBottom:3}}>Log Earnings ⭐</div>
            <div style={{fontWeight:600,fontSize:12,color:"#888",marginBottom:14}}>Base is $500/mo. Add extra here!</div>
            <div style={{background:"#F7F5FF",borderRadius:12,padding:"11px",marginBottom:14}}>
              <div style={{fontWeight:800,fontSize:12,color:"#764ba2",marginBottom:4}}>💡 Ways to earn extra:</div>
              {["Got good grades? 🎉","Did extra chores? 🧹","Birthday money? 🎂","Other gift? 🎁"].map(tip=><div key={tip} style={{fontSize:12,color:"#555",fontWeight:600,padding:"2px 0"}}>• {tip}</div>)}
            </div>
            <input type="number" value={earnAmt} onChange={e=>setEarnAmt(e.target.value)} placeholder="$0.00" style={{...INP,fontSize:20,fontWeight:800}}/>
            <input type="text" value={earnNote} onChange={e=>setEarnNote(e.target.value)} placeholder="Why did you earn it?" style={INP}/>
            <button onClick={addEarning} disabled={!earnAmt||parseFloat(earnAmt)<=0} className="bp" style={{...BTN("linear-gradient(135deg,#FFD93D,#FF9F43)","#5a3e00"),opacity:(!earnAmt||parseFloat(earnAmt)<=0)?.5:1}}>Add Earnings 🌟</button>
          </div>}

          {view==="history"&&<div className="card">
            <button onClick={()=>setView("home")} style={{background:"none",border:"none",fontWeight:800,fontSize:13,color:"#764ba2",cursor:"pointer",marginBottom:10,padding:0,fontFamily:"inherit"}}>← Back</button>
            <div style={{fontWeight:900,fontSize:20,color:"#333",marginBottom:3}}>History 📋</div>
            <div style={{fontWeight:600,fontSize:11,color:"#aaa",marginBottom:12}}>Tap any spend to edit or delete</div>
            {data.savingsLog.length>0&&<>
              <div style={{fontWeight:800,fontSize:12,color:"#FF9F43",marginBottom:6}}>🐷 Savings Log</div>
              <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:14}}>
                {data.savingsLog.slice(0,7).map(s=>{const d=new Date(s.date);return(
                  <div key={s.id} style={{background:"#FFFBE6",borderRadius:12,padding:"9px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 2px 6px rgba(0,0,0,.04)",borderLeft:"4px solid #FFD93D"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:15}}>{s.type==="withdraw"?"💸":"🐷"}</span><div><div style={{fontWeight:800,fontSize:12,color:"#333"}}>{s.note}</div><div style={{fontWeight:600,fontSize:10,color:"#aaa"}}>{MONTHS[d.getMonth()]} {d.getDate()}</div></div></div>
                    <div style={{fontWeight:900,fontSize:13,color:s.type==="withdraw"?"#FF6B6B":"#FF9F43"}}>{s.type==="withdraw"?"-":"+"}${s.amount.toFixed(2)}</div>
                  </div>
                );})}
              </div>
            </>}
            <div style={{fontWeight:800,fontSize:12,color:"#6C63FF",marginBottom:6}}>💸 Spending & Earnings</div>
            {allHistory.length===0
              ?<div style={{textAlign:"center",padding:"28px 20px",color:"#aaa"}}><div style={{fontSize:44,marginBottom:9}}>📭</div><div style={{fontWeight:800,fontSize:14}}>Nothing yet!</div></div>
              :<div style={{display:"flex",flexDirection:"column",gap:5}}>
                {allHistory.map(item=>{const cat=CATEGORIES.find(c=>c.id===item.catId);const d=new Date(item.date);return(
                  <div key={item.id} onClick={()=>item.kind==="spend"&&setEditTxn({...item})} style={{background:"#fff",borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 2px 7px rgba(0,0,0,.05)",borderLeft:`4px solid ${item.kind==="earn"?"#FFD93D":(cat?.color||"#ccc")}`,cursor:item.kind==="spend"?"pointer":"default"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:18}}>{item.kind==="earn"?"⭐":(cat?.emoji||"💸")}</span><div><div style={{fontWeight:800,fontSize:12,color:"#333"}}>{item.note}</div><div style={{fontWeight:600,fontSize:10,color:"#bbb"}}>{MONTHS[d.getMonth()]} {d.getDate()}{item.kind==="spend"?" · tap to edit":""}</div></div></div>
                    <div style={{fontWeight:900,fontSize:13,color:item.kind==="earn"?"#FF9F43":"#FF6B6B"}}>{item.kind==="earn"?"+":"-"}${item.amount.toFixed(2)}</div>
                  </div>
                );})}
              </div>
            }
          </div>}
        </div>
      </div>
    </div>
  );
}
