import { useState, useMemo } from 'react';

interface RiceCalculatorProps {
  onBack: () => void;
}

const TEM = {
  orange:       "#FF3F10",
  orangeLight:  "#FFF1EE",
  orangeBorder: "#FFB09E",
  violet:       "#7035B9",
  violetLight:  "#F3EDFB",
  violetBorder: "#C9A8EE",
  navy:         "#2549C0",
  navyLight:    "#EBF0FB",
  navyBorder:   "#A0B3EC",
  plum:         "#945483",
  plumLight:    "#F7EFF5",
  plumBorder:   "#D4A8CA",
  black:        "#111111",
  gray700:      "#444444",
  gray500:      "#888888",
  gray300:      "#CCCCCC",
  gray200:      "#E8E8E8",
  gray100:      "#F5F5F5",
  white:        "#FFFFFF",
};

const font = "'Neue Montreal', 'Inter', system-ui, sans-serif";
const mono = "'JetBrains Mono', 'Fira Code', monospace";

const STEPS = ["Reach", "Impact", "Confidence", "Effort", "Result"];

const REACH_OPTIONS = [
  { value: 1, label: "One team only",              desc: "A single squad benefits from this initiative" },
  { value: 2, label: "Multiple teams",             desc: "More than one team, but not the whole engineering function" },
  { value: 4, label: "Whole engineering function", desc: "Every engineering team is meaningfully affected" },
  { value: 6, label: "Across multiple functions",  desc: "Engineering + Ops, Product, or other business functions" },
];
const CONFIDENCE_OPTIONS = [
  { value: 1.00, label: "Certain", emoji: "\u{1F512}", desc: "There is no realistic way this won't work." },
  { value: 0.75, label: "High",    emoji: "\u2705", desc: "Highly probable; risk is marginal and backed by data." },
  { value: 0.50, label: "Medium",  emoji: "\u{1F914}", desc: "Looks promising but we can't be sure until we try." },
  { value: 0.25, label: "Low",     emoji: "\u{1F3B2}", desc: "A long shot \u2014 experimental or speculative. No risk, no fun." },
];
const BASE_EFFORT_OPTIONS = [
  { value: 1, label: "Under one Beat", desc: undefined as string | undefined },
  { value: 2, label: "One to two Beats", desc: undefined as string | undefined },
  { value: 3, label: "Over two Beats", desc: undefined as string | undefined },
];
const SKILL_OPTIONS = [
  { value: 1, label: "One sub-team",            desc: "e.g. DevEx only, or Foundations only" },
  { value: 2, label: "Two sub-teams",           desc: "e.g. DevEx + QA" },
  { value: 3, label: "All of Platform Service", desc: "DevEx + Foundations + QA" },
];
const EXTERNAL_OPTIONS = [
  { value: 0, label: "Platform ships it alone",  desc: "No other teams need to get involved" },
  { value: 1, label: "One team needs to help",   desc: "One external team needs to contribute time" },
  { value: 2, label: "All teams involved",       desc: "All engineering teams need to allocate time" },
];
const NOTICEABILITY = [
  { value: 1, label: "Hard to notice",     desc: "The improvement exists but would be difficult to observe in data or feel in practice.", bg: TEM.gray100,    border: TEM.gray300,    text: TEM.gray700  },
  { value: 2, label: "Noticeable",         desc: "A clear, measurable improvement that engineers or stakeholders would recognise.",        bg: TEM.navyLight,  border: TEM.navyBorder, text: TEM.navy     },
  { value: 3, label: "Strong improvement", desc: "A significant shift that materially changes how the team operates or delivers.",         bg: TEM.violetLight,border: TEM.violetBorder,text: TEM.violet   },
  { value: 4, label: "Game-changer",       desc: "Transformational \u2014 redefines what's possible for this metric.",                     bg: TEM.orangeLight,border: TEM.orangeBorder,text: TEM.orange   },
];
const DEFAULT_METRICS = ["Deployment Frequency", "Lead Time for Changes", "Change Failure Rate", "MTTR"];

/* -- Shared primitives --------------------------------------------------- */

function Pill({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:700, letterSpacing:"0.02em", color, background:bg, border:`1px solid ${border}`, fontFamily:font, whiteSpace:"nowrap" }}>{children}</span>;
}

function RadioCard({ selected, onClick, children, accent, accentLight }: { selected: boolean; onClick: () => void; children: React.ReactNode; accent: string; accentLight: string }) {
  return <button onClick={onClick} style={{ width:"100%", textAlign:"left", padding:"12px 14px", borderRadius:10, border:`2px solid ${selected?accent:TEM.gray300}`, background:selected?accentLight:TEM.white, cursor:"pointer", transition:"border-color 0.15s, background 0.15s", fontFamily:font, outline:"none" }}>{children}</button>;
}

function Radio({ checked, accent }: { checked: boolean; accent: string }) {
  return <div style={{ width:18, height:18, borderRadius:"50%", flexShrink:0, marginTop:2, border:`2px solid ${checked?accent:TEM.gray300}`, background:checked?accent:TEM.white, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>{checked&&<div style={{ width:7, height:7, borderRadius:"50%", background:TEM.white }}/>}</div>;
}

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button onClick={()=>onChange(!on)} style={{ width:42, height:24, borderRadius:12, flexShrink:0, background:on?TEM.orange:TEM.gray300, border:"none", cursor:"pointer", padding:0, position:"relative", transition:"background 0.2s" }}><div style={{ width:18, height:18, borderRadius:"50%", background:TEM.white, position:"absolute", top:3, left:on?21:3, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/></button>;
}

function StepIndicator({ current }: { current: number }) {
  return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginBottom:28, fontFamily:font }}>{STEPS.map((s,i)=><div key={s} style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:i===current?28:24, height:i===current?28:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, background:i<current?TEM.orange:i===current?TEM.orange:TEM.gray100, color:i<=current?TEM.white:TEM.gray500, boxShadow:i===current?`0 0 0 3px ${TEM.orangeLight}`:"none", transition:"all 0.2s" }}>{i<current?"\u2713":i+1}</div>{i<STEPS.length-1&&<div style={{ width:24, height:2, borderRadius:2, background:i<current?TEM.orange:TEM.gray300 }}/>}</div>)}</div>;
}

function SectionHeader({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  const ac=[TEM.navy,TEM.orange,TEM.violet,TEM.plum,TEM.orange];
  return <div style={{ marginBottom:20, fontFamily:font }}><div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:99, marginBottom:8, background:ac[step], color:TEM.white, fontSize:11, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase" }}>Step {step+1} \u00b7 {STEPS[step]}</div><h2 style={{ margin:0, fontSize:20, fontWeight:700, color:TEM.black, lineHeight:1.2 }}>{title}</h2>{subtitle&&<p style={{ margin:"4px 0 0", fontSize:13, color:TEM.gray500 }}>{subtitle}</p>}</div>;
}

function ResultBlock({ icon, label, scoreText, bg, border, textColor, summary }: { icon: string; label: string; scoreText: string; bg: string; border: string; textColor: string; summary: string }) {
  return <div style={{ borderRadius:10, border:`1.5px solid ${border}`, background:bg, padding:"12px 14px", fontFamily:font }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}><span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:textColor, opacity:0.8 }}>{icon} {label}</span><span style={{ fontSize:14, fontWeight:800, color:textColor }}>{scoreText}</span></div><p style={{ margin:0, fontSize:12, color:TEM.gray700, lineHeight:1.6 }}>{summary}</p></div>;
}

function CopyButton({ markdown }: { markdown: string }) {
  const [copied,setCopied]=useState(false);
  function copy(){
    function fb(){const ta=document.createElement("textarea");ta.value=markdown;ta.style.cssText="position:fixed;opacity:0;top:0;left:0";document.body.appendChild(ta);ta.focus();ta.select();try{document.execCommand("copy")}catch(e){void e}document.body.removeChild(ta);setCopied(true);setTimeout(()=>setCopied(false),2000);}
    try{navigator.clipboard.writeText(markdown).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}).catch(fb);}catch{fb();}
  }
  return <button onClick={copy} style={{ width:"100%", padding:"12px 0", marginTop:10, borderRadius:8, border:`1.5px solid ${TEM.gray300}`, background:copied?"#22C55E":TEM.black, color:TEM.white, fontSize:13, fontWeight:700, cursor:"pointer", transition:"background 0.2s", display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontFamily:font }}>{copied?"\u2713 Copied to clipboard!":"\u{1F4CB} Copy Markdown summary"}</button>;
}

/* -- How it Works doc ----------------------------------------------------- */

function DocSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return <div style={{ marginBottom:28 }}><div style={{ display:"inline-flex", alignItems:"center", gap:8, marginBottom:12, padding:"3px 10px", borderRadius:99, background:color, color:TEM.white, fontSize:11, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase" }}>{title}</div>{children}</div>;
}

function DocTable({ headers, rows, accentCol=0, colBg, colColor }: { headers: string[]; rows: string[][]; accentCol?: number; colBg?: string; colColor?: string; colBorder?: string }) {
  return <div style={{ overflowX:"auto", marginBottom:4 }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:font }}><thead><tr>{headers.map(h=><th key={h} style={{ padding:"8px 10px", borderBottom:`2px solid ${TEM.gray300}`, textAlign:"left", fontWeight:700, color:TEM.black, whiteSpace:"nowrap" }}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} style={{ background:i%2===0?TEM.white:TEM.gray100 }}>{r.map((c,j)=><td key={j} style={{ padding:"8px 10px", border:`1px solid ${TEM.gray200}`, color:j===accentCol&&colColor?colColor:TEM.gray700, fontWeight:j===accentCol?700:400, background:j===accentCol&&colBg?colBg:"transparent" }}>{c}</td>)}</tr>)}</tbody></table></div>;
}

function Formula({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily:mono, fontSize:12, background:TEM.gray100, border:`1px solid ${TEM.gray300}`, borderRadius:8, padding:"10px 14px", margin:"8px 0", color:TEM.black, overflowX:"auto", whiteSpace:"pre-wrap" }}>{children}</div>;
}

function Tip({ children }: { children: React.ReactNode }) {
  return <div style={{ padding:"10px 14px", borderRadius:10, background:TEM.orangeLight, border:`1.5px solid ${TEM.orangeBorder}`, fontSize:12, color:TEM.gray700, lineHeight:1.6, marginTop:8 }}>{children}</div>;
}

function P({ children }: { children: React.ReactNode }) { return <p style={{ fontSize:13, color:TEM.gray700, lineHeight:1.7, margin:"6px 0" }}>{children}</p>; }
function H3({ children, color=TEM.black }: { children: React.ReactNode; color?: string }) { return <h3 style={{ fontSize:14, fontWeight:700, color, margin:"14px 0 6px" }}>{children}</h3>; }

function HowItWorks() {
  return (
    <div style={{ fontFamily:font, maxWidth:480, margin:"0 auto" }}>
      <P>RICE is a prioritisation framework that helps Platform Service evaluate and rank initiatives in a consistent, data-informed way. A higher score indicates higher priority. Scores are <strong>relative</strong> — most useful when comparing initiatives within the same planning cycle.</P>
      <Formula>{"RICE Score = (Reach \u00d7 Impact \u00d7 Confidence) / Effort\nEffort = (Base Effort \u00d7 Skill Multiplier) + External Dependency"}</Formula>

      <DocSection title="1 \u00b7 Reach" color={TEM.navy}>
        <P>Captures the organisational scope — not just who is touched indirectly, but who actively experiences the change.</P>
        <DocTable
          headers={["Score","Definition"]}
          rows={[["1","One team only"],["2","Multiple teams (not the whole function)"],["4","Whole engineering function"],["6","Across multiple functions (e.g. Eng + Ops + Product)"]]}
          accentCol={0} colBg={TEM.navyLight} colColor={TEM.navy}
        />
      </DocSection>

      <DocSection title="2 \u00b7 Impact" color={TEM.orange}>
        <P>Grounded in <strong>DORA metrics</strong> (Deployment Frequency, Lead Time for Changes, Change Failure Rate, MTTR) as the primary measure of engineering health.</P>
        <H3>Noticeability scale</H3>
        <DocTable
          headers={["Score","Level","Description"]}
          rows={[
            ["1","Hard to notice","The improvement exists but would be difficult to observe in data or feel in practice"],
            ["2","Noticeable","A clear, measurable improvement that engineers or stakeholders would recognise"],
            ["3","Strong improvement","A significant shift that materially changes how the team operates or delivers"],
            ["4","Game-changer","Transformational — redefines what's possible for this metric"],
          ]}
          accentCol={0} colBg={TEM.orangeLight} colColor={TEM.orange}
        />
        <H3>Formula</H3>
        <Formula>{"Impact = Primary metric score + (0.5 \u00d7 \u03a3 secondary metrics where score \u2265 2)"}</Formula>
        <Tip>The highest-scoring metric counts fully. Additional metrics count at 50%, but only if they score \u2265 2.</Tip>
        <H3>Examples</H3>
        <DocTable
          headers={["Scenario","Calculation","Score"]}
          rows={[
            ["Game-changer for Lead Time only","4","4.0"],
            ["Strong DF + noticeable MTTR","3 + (0.5 \u00d7 2)","4.0"],
            ["Game-changer LCT + noticeable Ops unlock","4 + (0.5 \u00d7 2)","5.0"],
            ["5 \u00d7 Hard to notice (excluded)","1 + 0","1.0"],
          ]}
        />
      </DocSection>

      <DocSection title="3 \u00b7 Confidence" color={TEM.violet}>
        <P>A multiplier that discounts the score when there is meaningful uncertainty.</P>
        <DocTable
          headers={["Multiplier","Level","Description"]}
          rows={[
            ["\u00d71.00","Certain","No realistic way this won't work."],
            ["\u00d70.75","High","Highly probable; risk is marginal and backed by data."],
            ["\u00d70.50","Medium","Can't be sure until we try, but the approach looks promising."],
            ["\u00d70.25","Low","A long shot — experimental or speculative."],
          ]}
          accentCol={0} colBg={TEM.violetLight} colColor={TEM.violet}
        />
        <Tip>Don't game Confidence upward to protect your score. Low-confidence bets can still score highly if their Reach and Impact are large enough.</Tip>
      </DocSection>

      <DocSection title="4 \u00b7 Effort" color={TEM.plum}>
        <Formula>{"Effort = (Base Effort \u00d7 Skill Multiplier) + External Dependency"}</Formula>
        <P>External Dependency is <strong>additive</strong> (not multiplicative) to avoid over-penalising ambitious cross-team initiatives. Total range: <strong>1\u201311</strong>.</P>
        <H3 color={TEM.plum}>Base Effort</H3>
        <DocTable headers={["Score","Duration"]} rows={[["1","Under one Beat"],["2","One to two Beats"],["3","Over two Beats"]]} accentCol={0} colBg={TEM.plumLight} colColor={TEM.plum} />
        <H3 color={TEM.plum}>Skill Multiplier</H3>
        <DocTable headers={["Multiplier","Scope"]} rows={[["\u00d71","One sub-team (e.g. DevEx only)"],["\u00d72","Two sub-teams (e.g. DevEx + QA)"],["\u00d73","All three sub-teams"]]} accentCol={0} colBg={TEM.plumLight} colColor={TEM.plum} />
        <H3 color={TEM.plum}>External Dependency</H3>
        <DocTable headers={["Addition","Situation"]} rows={[["+0","Platform ships end-to-end"],["+1","One other team needs to contribute time"],["+2","All engineering teams must allocate time"]]} accentCol={0} colBg={TEM.plumLight} colColor={TEM.plum} />
        <H3>Effort Examples</H3>
        <DocTable headers={["Scenario","Calculation","Score"]} rows={[["1-Beat, DevEx only, no external dep","(1\u00d71)+0","1"],["2-Beat, DevEx+Foundations, one team","(2\u00d72)+1","5"],["3-Beat, all of Platform, all teams","(3\u00d73)+2","11"]]} />
      </DocSection>

      <DocSection title="Worked Example" color={TEM.black}>
        <P><strong>Initiative:</strong> Unified test execution layer rolled out across all product teams</P>
        <DocTable
          headers={["Dimension","Value","Rationale"]}
          rows={[
            ["Reach","4","Whole engineering function"],
            ["Impact","4.0","Strong DF (3, primary) + noticeable MTTR (2 \u2192 \u00d70.5)"],
            ["Confidence","\u00d70.75","Backed by DevEx Survey; approach well understood"],
            ["Base Effort","2","1\u20132 Beats"],
            ["Skill Multiplier","\u00d72","DevEx + QA"],
            ["External Dep","+1","One team needs to support adoption"],
            ["Effort","5","(2\u00d72)+1"],
            ["RICE Score","2.4","(4 \u00d7 4.0 \u00d7 0.75) / 5"],
          ]}
        />
      </DocSection>
    </div>
  );
}

/* -- Calculator ----------------------------------------------------------- */

function Calculator() {
  const [step,setStep]=useState(0);
  const [reach,setReach]=useState<number|null>(null);
  const [metricEnabled,setMetricEnabled]=useState<Record<string,boolean>>(DEFAULT_METRICS.reduce((a,m)=>({...a,[m]:false}),{} as Record<string,boolean>));
  const [metricScore,setMetricScore]=useState<Record<string,number|null>>(DEFAULT_METRICS.reduce((a,m)=>({...a,[m]:null}),{} as Record<string,number|null>));
  const [customMetrics,setCustomMetrics]=useState<string[]>([]);
  const [newMetric,setNewMetric]=useState("");
  const [showMetricError,setShowMetricError]=useState(false);
  const [confidence,setConfidence]=useState<number|null>(null);
  const [baseEffort,setBaseEffort]=useState<number|null>(null);
  const [skill,setSkill]=useState<number|null>(null);
  const [external,setExternal]=useState<number|null>(null);

  const allMetricNames=useMemo(()=>[...DEFAULT_METRICS,...customMetrics],[customMetrics]);
  const activeMetrics=useMemo(()=>allMetricNames.filter(n=>metricEnabled[n]&&metricScore[n]!==null).map(n=>[n,metricScore[n]!] as [string,number]),[allMetricNames,metricEnabled,metricScore]);
  const enabledWithoutScore=useMemo(()=>allMetricNames.filter(n=>metricEnabled[n]&&metricScore[n]===null),[allMetricNames,metricEnabled,metricScore]);
  const anyEnabled=allMetricNames.some(n=>metricEnabled[n]);

  const impact=useMemo(()=>{
    if(!activeMetrics.length)return 0;
    const s=activeMetrics.map(([,v])=>v).sort((a,b)=>b-a);
    return s[0]+s.slice(1).filter(x=>x>=2).reduce((acc,v)=>acc+0.5*v,0);
  },[activeMetrics]);
  const effort=useMemo(()=>(!baseEffort||!skill||external===null)?null:(baseEffort*skill)+external,[baseEffort,skill,external]);
  const rice=useMemo(()=>(!reach||!impact||!confidence||!effort)?null:(reach*impact*confidence)/effort,[reach,impact,confidence,effort]);

  function toggleMetricEnabled(name: string,val: boolean){setMetricEnabled(p=>({...p,[name]:val}));if(!val)setMetricScore(p=>({...p,[name]:null}));setShowMetricError(false);}
  function setScore(name: string,val: number){setMetricScore(p=>({...p,[name]:p[name]===val?null:val}));setShowMetricError(false);}
  function addCustomMetric(){const t=newMetric.trim();if(!t||customMetrics.includes(t)||DEFAULT_METRICS.includes(t))return;setCustomMetrics(p=>[...p,t]);setMetricEnabled(p=>({...p,[t]:false}));setMetricScore(p=>({...p,[t]:null}));setNewMetric("");}

  const sortedActive=[...activeMetrics].sort((a,b)=>b[1]-a[1]);
  const primaryM=sortedActive[0];
  const secondaryMs=sortedActive.slice(1).filter(([,v])=>v>=2);
  const excludedMs=sortedActive.slice(1).filter(([,v])=>v<2);
  const extraActive=activeMetrics.filter(([n])=>!DEFAULT_METRICS.includes(n));
  const baseOpt=BASE_EFFORT_OPTIONS.find(o=>o.value===baseEffort);
  const skillOpt=SKILL_OPTIONS.find(o=>o.value===skill);

  const reachSummary=():string=>({1:"Scoped to a single team \u2014 minimal organisational footprint.",2:"Touches several teams but stays within engineering.",4:"Spans the whole engineering function \u2014 broad organisational reach.",6:"Crosses multiple functions, reaching beyond engineering into the wider business."}[reach!] ?? "");
  const impactSummary=():string=>{if(!primaryM)return"";const pL=NOTICEABILITY.find(n=>n.value===primaryM[1])?.label;let s=`Primary driver is ${primaryM[0]} (${pL}).`;if(secondaryMs.length)s+=` Also meaningfully affects ${secondaryMs.map(([n,v])=>`${n} (${NOTICEABILITY.find(x=>x.value===v)?.label?.toLowerCase()})`).join(", ")}.`;if(excludedMs.length)s+=` ${excludedMs.map(([n])=>n).join(", ")} ${excludedMs.length===1?"is":"are"} touched but too marginally to count.`;if(extraActive.length)s+=` Bonus: also impacts ${extraActive.map(([n])=>n).join(", ")} outside of DORA.`;return s;};
  const confidenceSummary=():string=>({1.00:"Fully validated \u2014 the outcome is as certain as it gets.",0.75:"Well-evidenced and highly likely to work. Some residual uncertainty, but the data backs this.",0.50:"Promising but unproven. The approach is reasonable \u2014 we won't know for sure until we try.",0.25:"A deliberate bet in the dark. High uncertainty; only worth it if Reach and Impact are compelling."}[confidence!] ?? "");
  const effortSummary=():string=>{if(!baseOpt||!skillOpt)return"";let s=`Takes ${baseOpt.label.toLowerCase()}, involving ${skillOpt.label.toLowerCase()}.`;s+=external===0?" Platform can ship this end-to-end with no external coordination needed.":external===1?" One external team needs to contribute time \u2014 moderate coordination overhead.":" All engineering teams need to allocate time \u2014 significant rollout coordination required.";return s;};

  const riceInfo=rice===null?{label:"\u2014",color:TEM.gray500}:rice>=6?{label:"Must do \u{1F680}",color:TEM.orange}:rice>=3?{label:"High priority \u2705",color:TEM.violet}:rice>=1.5?{label:"Worth considering \u{1F914}",color:TEM.navy}:{label:"Low priority \u2B07\uFE0F",color:TEM.gray500};
  const markdown=`# RICE Score Summary\n\n**Score: ${rice?.toFixed(2)} \u2014 ${riceInfo.label}**\n\n\`(${reach} \u00d7 ${impact.toFixed(1)} \u00d7 ${confidence?.toFixed(2)}) / ${effort} = ${rice?.toFixed(2)}\`\n\n---\n\n## Reach \u2014 ${reach} pts\n${reachSummary()}\n\n## Impact \u2014 ${impact.toFixed(1)} pts\n${impactSummary()}\n\n## Confidence \u2014 \u00d7${confidence?.toFixed(2)}\n${confidenceSummary()}\n\n## Effort \u2014 ${effort} pts\n\`(${baseEffort} \u00d7 ${skill}) + ${external} = ${effort}\`\n${effortSummary()}\n\n---\n*Scored using the Platform Service RICE Framework*`;

  function reset(){setStep(0);setReach(null);setMetricEnabled(DEFAULT_METRICS.reduce((a,m)=>({...a,[m]:false}),{} as Record<string,boolean>));setMetricScore(DEFAULT_METRICS.reduce((a,m)=>({...a,[m]:null}),{} as Record<string,number|null>));setCustomMetrics([]);setConfidence(null);setBaseEffort(null);setSkill(null);setExternal(null);setShowMetricError(false);}

  function handleNext(){
    if(step===1){if(!anyEnabled||enabledWithoutScore.length>0){setShowMetricError(true);return;}setShowMetricError(false);setStep(2);return;}
    setStep(s=>s+1);
  }
  const canNext=[reach!==null,true,confidence!==null,baseEffort!==null&&skill!==null&&external!==null,true][step];

  return <>
    <StepIndicator current={step}/>
    <div style={{ background:TEM.white, borderRadius:14, border:`1px solid ${TEM.gray300}`, padding:24, boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>

      {step===0&&<>
        <SectionHeader step={0} title="Who does this reach?" subtitle="Who actively experiences the change \u2014 not just who's touched indirectly."/>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {REACH_OPTIONS.map(o=><RadioCard key={o.value} selected={reach===o.value} onClick={()=>setReach(o.value)} accent={TEM.navy} accentLight={TEM.navyLight}><div style={{ display:"flex", gap:10, alignItems:"flex-start" }}><Radio checked={reach===o.value} accent={TEM.navy}/><div><div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:14, fontWeight:600, color:TEM.black }}>{o.label}</span><Pill color={TEM.navy} bg={TEM.navyLight} border={TEM.navyBorder}>{o.value} pts</Pill></div><p style={{ margin:"3px 0 0", fontSize:12, color:TEM.gray500 }}>{o.desc}</p></div></div></RadioCard>)}
        </div>
      </>}

      {step===1&&<>
        <SectionHeader step={1} title="What's the impact?" subtitle="Toggle on any metric this initiative meaningfully influences, then rate its noticeability."/>
        <div style={{ borderRadius:10, border:`1.5px solid ${TEM.gray200}`, background:TEM.gray100, padding:"12px 14px", marginBottom:16 }}>
          <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:TEM.gray500 }}>Noticeability scale</p>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {NOTICEABILITY.map(n=><div key={n.value} style={{ display:"flex", alignItems:"flex-start", gap:8 }}><span style={{ flexShrink:0, padding:"2px 7px", borderRadius:99, fontSize:11, fontWeight:700, color:n.text, background:n.bg, border:`1.5px solid ${n.border}` }}>{n.value} \u00b7 {n.label}</span><span style={{ fontSize:12, color:TEM.gray700, lineHeight:1.5, paddingTop:1 }}>{n.desc}</span></div>)}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {allMetricNames.map(name=>{
            const on=metricEnabled[name];const score=metricScore[name];const needsScore=on&&score===null;
            return <div key={name} style={{ borderRadius:10, border:`1.5px solid ${needsScore&&showMetricError?TEM.orange:on?TEM.gray300:TEM.gray200}`, background:on?TEM.white:TEM.gray100, overflow:"hidden", transition:"all 0.2s" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px" }}><span style={{ fontSize:13, fontWeight:600, color:on?TEM.black:TEM.gray500 }}>{name}</span><ToggleSwitch on={on} onChange={v=>toggleMetricEnabled(name,v)}/></div>
              {on&&<div style={{ padding:"0 14px 12px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>{NOTICEABILITY.map(n=>{const sel=score===n.value;return<button key={n.value} onClick={()=>setScore(name,n.value)} style={{ padding:"7px 6px", borderRadius:7, fontSize:12, fontWeight:sel?700:500, border:`1.5px solid ${sel?n.border:TEM.gray300}`, background:sel?n.bg:TEM.white, color:sel?n.text:TEM.gray700, cursor:"pointer", transition:"all 0.12s", fontFamily:font }}>{n.value} \u00b7 {n.label}</button>;})}</div>}
            </div>;
          })}
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <input value={newMetric} onChange={e=>setNewMetric(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCustomMetric()} placeholder="Add non-DORA metric\u2026" style={{ flex:1, fontSize:13, border:`1.5px solid ${TEM.gray300}`, borderRadius:8, padding:"8px 12px", outline:"none", fontFamily:font, color:TEM.black, background:TEM.white }}/>
            <button onClick={addCustomMetric} style={{ padding:"8px 14px", borderRadius:8, background:TEM.orange, color:TEM.white, fontSize:13, fontWeight:700, border:"none", cursor:"pointer", fontFamily:font }}>+ Add</button>
          </div>
          {showMetricError&&<div style={{ padding:"10px 14px", borderRadius:10, background:TEM.orangeLight, border:`1.5px solid ${TEM.orangeBorder}`, fontSize:12, color:TEM.orange, fontWeight:600 }}>{!anyEnabled?"\u26A0\uFE0F Toggle on at least one metric before continuing.":`\u26A0\uFE0F Please select a noticeability level for: ${enabledWithoutScore.join(", ")}.`}</div>}
          {activeMetrics.length>0&&(()=>{const s=[...activeMetrics].sort((a,b)=>b[1]-a[1]);const[pn,ps]=s[0];const secs=s.slice(1).filter(([,v])=>v>=2);return<div style={{ padding:"10px 14px", borderRadius:10, background:TEM.orangeLight, border:`1.5px solid ${TEM.orangeBorder}` }}><p style={{ margin:"0 0 4px", fontSize:11, fontWeight:700, color:TEM.orange, textTransform:"uppercase", letterSpacing:"0.05em" }}>Impact preview</p><p style={{ margin:0, fontSize:12, color:TEM.gray700 }}>Primary: <strong>{pn}</strong> \u2192 {ps}</p>{secs.length>0&&<p style={{ margin:"2px 0 0", fontSize:12, color:TEM.gray700 }}>Secondaries: {secs.map(([n,v])=>`${n} (${v}\u00d70.5=${v*0.5})`).join(", ")}</p>}<p style={{ margin:"6px 0 0", fontSize:13, fontWeight:800, color:TEM.orange }}>Impact = {impact.toFixed(1)}</p></div>;})()}
        </div>
      </>}

      {step===2&&<>
        <SectionHeader step={2} title="How confident are you?" subtitle="Reflects the strength of evidence. Don't game this upward to protect your score."/>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {CONFIDENCE_OPTIONS.map(o=><RadioCard key={o.value} selected={confidence===o.value} onClick={()=>setConfidence(o.value)} accent={TEM.violet} accentLight={TEM.violetLight}><div style={{ display:"flex", gap:10, alignItems:"flex-start" }}><Radio checked={confidence===o.value} accent={TEM.violet}/><div><div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:16 }}>{o.emoji}</span><span style={{ fontSize:14, fontWeight:600, color:TEM.black }}>{o.label}</span><Pill color={TEM.violet} bg={TEM.violetLight} border={TEM.violetBorder}>\u00d7{o.value.toFixed(2)}</Pill></div><p style={{ margin:"3px 0 0", fontSize:12, color:TEM.gray500 }}>{o.desc}</p></div></div></RadioCard>)}
        </div>
      </>}

      {step===3&&<>
        <SectionHeader step={3} title="How much effort is needed?" subtitle="Effort = (Base \u00d7 Skill) + External. Range: 1\u201311."/>
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          {([
            {label:"Base Effort",options:BASE_EFFORT_OPTIONS,val:baseEffort,set:setBaseEffort,badge:(v: number)=>`${v}`},
            {label:"Skill Multiplier",options:SKILL_OPTIONS,val:skill,set:setSkill,badge:(v: number)=>`\u00d7${v}`},
            {label:"External Dependency",options:EXTERNAL_OPTIONS,val:external,set:setExternal,badge:(v: number)=>`+${v}`},
          ] as const).map(g=><div key={g.label}><p style={{ margin:"0 0 8px", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:TEM.plum }}>{g.label}</p><div style={{ display:"flex", flexDirection:"column", gap:6 }}>{g.options.map(o=><RadioCard key={o.value} selected={g.val===o.value} onClick={()=>g.set(o.value)} accent={TEM.plum} accentLight={TEM.plumLight}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}><div style={{ display:"flex", gap:8, alignItems:"flex-start" }}><Radio checked={g.val===o.value} accent={TEM.plum}/><div><span style={{ fontSize:13, fontWeight:600, color:TEM.black }}>{o.label}</span>{o.desc&&<p style={{ margin:"2px 0 0", fontSize:12, color:TEM.gray500 }}>{o.desc}</p>}</div></div><Pill color={TEM.plum} bg={TEM.plumLight} border={TEM.plumBorder}>{g.badge(o.value)}</Pill></div></RadioCard>)}</div></div>)}
          {effort!==null&&<div style={{ padding:"10px 14px", borderRadius:10, background:TEM.plumLight, border:`1.5px solid ${TEM.plumBorder}`, fontSize:12, color:TEM.plum }}><span style={{ fontWeight:700 }}>Effort preview: </span>({baseEffort} \u00d7 {skill}) + {external} = <strong style={{ fontSize:14 }}>{effort}</strong></div>}
        </div>
      </>}

      {step===4&&<>
        <SectionHeader step={4} title="Your RICE Score" subtitle="(Reach \u00d7 Impact \u00d7 Confidence) / Effort"/>
        <div style={{ textAlign:"center", padding:"12px 0 16px" }}><div style={{ fontSize:64, fontWeight:900, color:TEM.orange, letterSpacing:"-0.04em", lineHeight:1 }}>{rice?.toFixed(2)??"\u2014"}</div><div style={{ fontSize:16, fontWeight:700, color:riceInfo.color, marginTop:6 }}>{riceInfo.label}</div></div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <ResultBlock icon="\u{1F4E1}" label="Reach"      scoreText={`${reach} pts`}              bg={TEM.navyLight}   border={TEM.navyBorder}   textColor={TEM.navy}   summary={reachSummary()}/>
          <ResultBlock icon="\u26A1"     label="Impact"     scoreText={`${impact.toFixed(1)} pts`}  bg={TEM.orangeLight} border={TEM.orangeBorder} textColor={TEM.orange} summary={impactSummary()}/>
          <ResultBlock icon="\u{1F3AF}" label="Confidence" scoreText={`\u00d7${confidence?.toFixed(2)}`} bg={TEM.violetLight} border={TEM.violetBorder} textColor={TEM.violet} summary={confidenceSummary()}/>
          <ResultBlock icon="\u{1F3D7}\uFE0F" label="Effort" scoreText={`${effort} pts`}            bg={TEM.plumLight}   border={TEM.plumBorder}   textColor={TEM.plum}   summary={effortSummary()}/>
        </div>
        <div style={{ margin:"12px 0 0", padding:"10px 14px", borderRadius:10, background:TEM.gray100, border:`1px solid ${TEM.gray300}`, textAlign:"center", fontFamily:mono, fontSize:12, color:TEM.gray700 }}>({reach} \u00d7 {impact.toFixed(1)} \u00d7 {confidence?.toFixed(2)}) / {effort} = <strong style={{ color:TEM.black }}>{rice?.toFixed(2)}</strong></div>
        <div style={{ margin:"10px 0 0", padding:"10px 14px", borderRadius:10, background:TEM.gray100, border:`1px solid ${TEM.gray300}`, fontSize:12 }}>
          <p style={{ margin:"0 0 6px", fontWeight:700, color:TEM.black, fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em" }}>Score guide (relative)</p>
          {[{t:"\u{1F680} \u2265 6.0",l:"Must do",c:TEM.orange},{t:"\u2705 3.0\u20135.9",l:"High priority",c:TEM.violet},{t:"\u{1F914} 1.5\u20132.9",l:"Worth considering",c:TEM.navy},{t:"\u2B07\uFE0F < 1.5",l:"Low priority",c:TEM.gray500}].map(r=><p key={r.t} style={{ margin:"2px 0", color:r.c, fontWeight:600 }}>{r.t} \u2014 {r.l}</p>)}
        </div>
        <CopyButton markdown={markdown}/>
        <button onClick={reset} style={{ width:"100%", padding:"11px 0", marginTop:8, borderRadius:8, border:`1.5px solid ${TEM.gray300}`, background:TEM.white, color:TEM.gray700, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font }}>\u21A9 Score another initiative</button>
      </>}
    </div>

    {step<4&&<div style={{ display:"flex", gap:10, marginTop:12 }}>
      {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{ flex:1, padding:"13px 0", borderRadius:8, border:`1.5px solid ${TEM.gray300}`, background:TEM.white, color:TEM.gray700, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:font }}>\u2190 Back</button>}
      <button onClick={handleNext} disabled={step!==1&&!canNext} style={{ flex:1, padding:"13px 0", borderRadius:8, border:"none", background:(step===1||canNext)?TEM.orange:TEM.gray300, color:(step===1||canNext)?TEM.white:TEM.gray500, fontSize:14, fontWeight:700, cursor:(step===1||canNext)?"pointer":"not-allowed", fontFamily:font }}>{step===3?"See Results \u2192":"Next \u2192"}</button>
    </div>}
  </>;
}

/* -- Main component ------------------------------------------------------- */

export default function RiceCalculator({ onBack }: RiceCalculatorProps) {
  const [tab,setTab]=useState<"calculator"|"how">("calculator");
  return (
    <div style={{ minHeight:"100vh", background:TEM.gray100, fontFamily:font }}>
      {/* Header */}
      <div style={{ background:TEM.white, borderBottom:`1px solid ${TEM.gray200}`, position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 0" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:TEM.orange, flexShrink:0 }}/>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:TEM.orange }}>tem.energy \u00b7 Platform Service</span>
            </div>
            <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, fontWeight:600, color:TEM.gray500, fontFamily:font, padding:"4px 8px" }}>\u2190 Back to Teams</button>
          </div>
          <h1 style={{ margin:"0 0 12px", fontSize:22, fontWeight:800, color:TEM.black, letterSpacing:"-0.02em" }}>RICE Framework</h1>
          <div style={{ display:"flex", gap:0 }}>
            {([{id:"calculator" as const,label:"\u{1F9EE} Calculator"},{id:"how" as const,label:"\u{1F4D6} How it Works"}]).map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:"8px 16px", fontSize:13, fontWeight:700, border:"none", cursor:"pointer",
                background:"transparent", fontFamily:font,
                color:tab===t.id?TEM.orange:TEM.gray500,
                borderBottom:`2.5px solid ${tab===t.id?TEM.orange:"transparent"}`,
                transition:"all 0.15s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:480, margin:"0 auto", padding:"24px 16px 48px" }}>
        {tab==="calculator"?<Calculator/>:<HowItWorks/>}
      </div>
    </div>
  );
}
