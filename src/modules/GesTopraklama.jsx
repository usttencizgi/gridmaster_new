import { useState } from 'react';
import NumInput from '../components/NumInput.jsx';
import { exportGesTopraklamaPDF, exportGesTopraklamaWord } from '../utils/export.js';

// ─── UTP Tablosu (ETT / IEC 60479) ───────────────────────────────
const UTP_TABLE = [
  {t:.05,U:900},{t:.10,U:750},{t:.20,U:500},{t:.50,U:200},
  {t:1,U:100},{t:2,U:75},{t:5,U:70},{t:10,U:70},
];
function getUtp(t) {
  if (t <= UTP_TABLE[0].t) return UTP_TABLE[0].U;
  if (t >= UTP_TABLE[UTP_TABLE.length-1].t) return UTP_TABLE[UTP_TABLE.length-1].U;
  for (let i=0;i<UTP_TABLE.length-1;i++){
    const a=UTP_TABLE[i],b=UTP_TABLE[i+1];
    if(t>=a.t&&t<=b.t){
      const ra=(Math.log(t)-Math.log(a.t))/(Math.log(b.t)-Math.log(a.t));
      return Math.round(a.U+ra*(b.U-a.U));
    }
  }
  return 100;
}
// Adım gerilimi sınırları (ETT — arazi OG)
const UA_LIM = {.5:400,1:200,2:150,5:140,10:140};
function getLimitUa(t){
  const k=Object.keys(UA_LIM).map(Number).sort((a,b)=>a-b);
  return UA_LIM[k.find(v=>v>=t)||k[k.length-1]]||200;
}

const R_SEL=[
  {label:'Sadece havai hat',r:.6},
  {label:'Karma (havai+yer altı)',r:.45},
  {label:'Sadece yer altı kablo',r:.3},
];
const TOPRAK=[
  {label:'Bataklık',r:30},{label:'Killi Toprak',r:100},
  {label:'Rutubetli Kum',r:200},{label:'Rutubetli Çakıl',r:500},
  {label:'Kuru Kum/Çakıl',r:1000},{label:'Taşlık Zemin',r:3000},
];

// ─── Formüller ────────────────────────────────────────────────────
function calcRg(rho,a,b,L){
  const A=a*b, D=Math.sqrt(4*A/Math.PI);
  return {Rg:rho/(2*D)+rho/L, D, A};
}
function calcRc(rho,n,Lc,dc){
  const Rc1=(rho/(2*Math.PI*Lc))*Math.log(4*Lc/dc);
  return {Rc1, Rc:Rc1/n};
}
function paralel(...Rs){
  const inv=Rs.filter(r=>r&&isFinite(r)&&r>0).reduce((s,r)=>s+1/r,0);
  return inv>0?1/inv:Infinity;
}
function calcBirim({rho,serit,a,b,L,kazik,n,Lc,dc}){
  let Rg=null,D=null,Rc1=null,Rc=null,Res=null;
  if(serit&&a>0&&b>0&&L>0){const g=calcRg(rho,a,b,L);Rg=g.Rg;D=g.D;}
  if(kazik&&n>0&&Lc>0&&dc>0){const c=calcRc(rho,n,Lc,dc);Rc1=c.Rc1;Rc=c.Rc;}
  if(Rg!==null&&Rc!==null) Res=(Rg*Rc/(Rg+Rc))*1.10;
  else if(Rg!==null) Res=Rg;
  else if(Rc!==null) Res=Rc;
  return {Rg,D,Rc1,Rc,Res};
}

// ─── UI yardımcıları ─────────────────────────────────────────────
function NI({label,value,onChange,unit,step,min}){
  return(
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{label}</label>
      <NumInput value={value} onChange={onChange} unit={unit} step={step??0.1} min={min??0}/>
    </div>
  );
}

function Check({ok,label,val,op,lim,unit,sub}){
  return(
    <div className={`rounded-xl border-2 p-4 ${ok?'bg-green-50 border-green-200':'bg-red-50 border-red-300'}`}>
      <div className="flex justify-between mb-2">
        <div>
          <p className="text-xs font-bold text-slate-700">{label}</p>
          {sub&&<p className="text-[10px] text-slate-400 font-mono mt-0.5">{sub}</p>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ok?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
          {ok?'✓ UYGUN':'✗ UYGUN DEĞİL'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 text-center rounded-lg px-3 py-2 border ${ok?'bg-green-50 border-green-200':'bg-red-50 border-red-200'}`}>
          <div className="text-[10px] text-slate-400 mb-0.5">Hesaplanan</div>
          <div className={`text-xl font-black font-mono ${ok?'text-green-700':'text-red-600'}`}>
            {typeof val==='number'?val.toFixed(2):val} {unit}
          </div>
        </div>
        <div className={`text-xl font-black ${ok?'text-green-500':'text-red-400'}`}>{op}</div>
        <div className="flex-1 text-center rounded-lg px-3 py-2 bg-white border border-slate-200">
          <div className="text-[10px] text-slate-400 mb-0.5">Sınır</div>
          <div className="text-xl font-black font-mono text-slate-700">{lim} {unit}</div>
        </div>
      </div>
    </div>
  );
}

// UTP eğrisi mini grafik
function UtpGraph({t,Utp,UE}){
  const W=360,H=150,lx=38,rx=W-10,ty=18,by=H-20;
  const tx=tv=>lx+(Math.log10(tv)-Math.log10(.03))/(Math.log10(10)-Math.log10(.03))*(rx-lx);
  const uy=uv=>by-(Math.log10(Math.min(Math.max(uv,50),1200))-Math.log10(50))/(Math.log10(1200)-Math.log10(50))*(by-ty);
  const pts=UTP_TABLE.map(p=>`${tx(p.t).toFixed(1)},${uy(p.U).toFixed(1)}`).join(' ');
  return(
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
      <rect width={W} height={H} fill="#f8fafc" rx="6"/>
      <text x={W/2} y={12} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#334155">UTP — Dokunma Gerilimi Sınırı (ETT)</text>
      {[70,100,200,500,1000].map(u=>(
        <g key={u}>
          <line x1={lx} y1={uy(u)} x2={rx} y2={uy(u)} stroke="#e2e8f0" strokeWidth="0.5"/>
          <text x={lx-3} y={uy(u)+3} textAnchor="end" fontSize="6.5" fill="#94a3b8">{u}</text>
        </g>
      ))}
      {[.05,.1,.2,.5,1,2,5,10].map(tv=>(
        <g key={tv}>
          <line x1={tx(tv)} y1={ty} x2={tx(tv)} y2={by} stroke="#e2e8f0" strokeWidth="0.5"/>
          <text x={tx(tv)} y={H-8} textAnchor="middle" fontSize="6.5" fill="#94a3b8">{tv}</text>
        </g>
      ))}
      <line x1={lx} y1={ty} x2={lx} y2={by} stroke="#94a3b8" strokeWidth="1"/>
      <line x1={lx} y1={by} x2={rx} y2={by} stroke="#94a3b8" strokeWidth="1"/>
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round"/>
      <line x1={tx(t)} y1={ty} x2={tx(t)} y2={by} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2"/>
      <circle cx={tx(t)} cy={uy(Utp)} r="3.5" fill="#f59e0b" stroke="white" strokeWidth="1"/>
      <text x={tx(t)+4} y={uy(Utp)-3} fontSize="7" fill="#92400e" fontWeight="bold">UTP={Utp}V</text>
      {UE>0&&UE<1500&&<line x1={lx} y1={uy(UE)} x2={rx} y2={uy(UE)} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,2"/>}
    </svg>
  );
}

// Birim paneli (arazi saha/köşk)
const BDEF=(isim)=>({isim,serit:true,a:7.3,b:2.5,L:19.6,kazik:true,n:4,Lc:1.5,dc:.05});
const KRENK=['blue','violet','orange','rose','cyan'];
const KR={
  emerald:{hd:'bg-emerald-600 text-white',bd:'border-emerald-200 bg-emerald-50/30'},
  blue:{hd:'bg-blue-600 text-white',bd:'border-blue-200 bg-blue-50/30'},
  violet:{hd:'bg-violet-600 text-white',bd:'border-violet-200 bg-violet-50/30'},
  orange:{hd:'bg-orange-500 text-white',bd:'border-orange-200 bg-orange-50/30'},
  rose:{hd:'bg-rose-500 text-white',bd:'border-rose-200 bg-rose-50/30'},
};
function BirimPanel({label,color,data,onChange,rho,sonuc,removable,onRemove}){
  const c=KR[color]||KR.blue;
  return(
    <div className={`border-2 rounded-xl overflow-hidden ${c.bd}`}>
      <div className={`px-4 py-2.5 flex items-center justify-between ${c.hd}`}>
        <input type="text" value={data.isim||label} onChange={e=>onChange('isim',e.target.value)}
          className="bg-transparent outline-none font-black text-sm w-full"/>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {sonuc?.Res!=null&&isFinite(sonuc.Res)&&(
            <span className="bg-white/20 px-3 py-0.5 rounded-lg font-mono font-bold text-sm">
              Reş={sonuc.Res.toFixed(3)} Ω
            </span>
          )}
          {removable&&(
            <button onClick={onRemove} className="bg-white/20 hover:bg-white/40 rounded-lg p-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">
        <button onClick={()=>onChange('serit',!data.serit)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${data.serit?'bg-teal-50 border-teal-400 text-teal-700':'border-slate-200 text-slate-400 bg-white'}`}>
          Topraklama Şeridi {data.serit?'✓':'○'}
        </button>
        {data.serit&&(
          <>
            <div className="grid grid-cols-3 gap-2">
              <NI label="a [m]" value={data.a} onChange={v=>onChange('a',v)} unit="m" step={.5} min={.1}/>
              <NI label="b [m]" value={data.b} onChange={v=>onChange('b',v)} unit="m" step={.5} min={.1}/>
              <NI label="L şerit [m]" value={data.L} onChange={v=>onChange('L',v)} unit="m" step={1} min={1}/>
            </div>
            {sonuc?.Rg!=null&&(
              <div className="bg-white/80 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-500">
                D=√(4×{(data.a*data.b).toFixed(0)}/π)={sonuc.D?.toFixed(2)}m &nbsp;|&nbsp;
                Rg=ρ/(2D)+ρ/L={sonuc.Rg?.toFixed(3)} Ω
              </div>
            )}
          </>
        )}
        <button onClick={()=>onChange('kazik',!data.kazik)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${data.kazik?'bg-amber-50 border-amber-400 text-amber-700':'border-slate-200 text-slate-400 bg-white'}`}>
          Topraklama Kazığı {data.kazik?'✓':'○'}
        </button>
        {data.kazik&&(
          <>
            <div className="grid grid-cols-3 gap-2">
              <NI label="n [adet]" value={data.n} onChange={v=>onChange('n',v)} unit="adet" step={1} min={1}/>
              <NI label="Lç [m]" value={data.Lc} onChange={v=>onChange('Lc',v)} unit="m" step={.5} min={.5}/>
              <NI label="dç [m]" value={data.dc} onChange={v=>onChange('dc',v)} unit="m" step={.005} min={.01}/>
            </div>
            {sonuc?.Rc!=null&&(
              <div className="bg-white/80 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-500">
                Rç_tek={sonuc.Rc1?.toFixed(3)} Ω → Rç={sonuc.Rc1?.toFixed(3)}/{data.n}={sonuc.Rc?.toFixed(3)} Ω
              </div>
            )}
          </>
        )}
        {sonuc?.Res!=null&&data.serit&&data.kazik&&sonuc.Rg&&sonuc.Rc&&(
          <div className="bg-white/80 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-500">
            Reş=(Rg×Rç)/(Rg+Rç)×1.10=({sonuc.Rg?.toFixed(3)}×{sonuc.Rc?.toFixed(3)})/({sonuc.Rg?.toFixed(3)}+{sonuc.Rc?.toFixed(3)})×1.10=<b>{sonuc.Res?.toFixed(3)} Ω</b>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ANA BİLEŞEN ─────────────────────────────────────────────────
export default function GesTopraklama({initialIk1=0}){
  const [mod,setMod]=useState('arazi');
  const [rho,setRho]=useState(100);

  // OG (Arazi) state
  const [Ik1,setIk1]=useState(initialIk1||.659);
  const [rIdx,setRIdx]=useState(2);
  const [t,setT]=useState(1.0);
  const [nInv,setNInv]=useState(8);
  const [saha,setSaha]=useState({isim:'GES Santral Sahası',serit:true,a:250,b:119,L:1040,kazik:true,n:12,Lc:1.5,dc:.05});
  const [koskler,setKoskler]=useState([{...BDEF('Trafo Köşkü 1'),id:1}]);
  const updSaha=(k,v)=>setSaha(p=>({...p,[k]:v}));
  const addKosk=()=>setKoskler(ks=>[...ks,{...BDEF(`Trafo Köşkü ${ks.length+1}`),id:Date.now()}]);
  const rmKosk=i=>setKoskler(ks=>ks.filter((_,j)=>j!==i));
  const updKosk=(i,k,v)=>setKoskler(ks=>ks.map((ko,j)=>j===i?{...ko,[k]:v}:ko));

  // AG (Çatı/TT) state
  const [iDn,setIDn]=useState(.3);         // RCD anma akımı A
  const [nInvAG,setNInvAG]=useState(8);    // evirici sayısı
  const [Rmev,setRmev]=useState(5.0);      // mevcut bina toprağı Ω
  const [cKazik,setCKazik]=useState({aktif:false,n:4,Lc:1.5,dc:.05});

  const [res,setRes]=useState(null);

  const hesapla=()=>{
    if(mod==='arazi'){
      // ─── OG TARAF — ETT Yönetmeliği / IEC EN 50522 ───────────
      // Arıza akımı: I"k1 (OG faz-toprak kısa devre)
      const Ik1A=Ik1*1000;
      const Utp=getUtp(t);
      const r=R_SEL[rIdx].r;

      const sahaSon=calcBirim({rho,...saha});
      const koskSon=koskler.map(k=>calcBirim({rho,...k}));
      const tumRes=[sahaSon.Res,...koskSon.map(k=>k.Res)].filter(x=>x&&isFinite(x));
      const Res=paralel(...tumRes);
      const It=r*Ik1A;
      const UE=Res*It;

      // Kontrol 1: UE < UTP(t)
      const dok_ok=UE<Utp;

      // Kontrol 2: Adım gerilimi (saha sınırı)
      const A=saha.a*saha.b;
      const rm=Math.sqrt(A/Math.PI);
      const Ua=rm>0?(rho*It/(2*Math.PI))*(1/rm-1/(rm+1)):rho*It/(4*Math.PI);
      const adim_ok=Ua<=getLimitUa(t);

      // Kontrol 3: RCD (OG normal işletme kaçak akımı ~0.3A/inv)
      const rcd_ok=Res<=50/(nInv*.3);

      // İletken kesit
      const qH=Ik1A*Math.sqrt(t)/115;
      const qS=[10,16,25,35,50,70,95,120,150,185].find(s=>s>=qH)||185;

      setRes({mod:'arazi',sahaSon,koskSon,Res,It,UE,Utp,
        dok_ok,adim_ok,Ua,rm,rcd_ok,qH,qS,Ik1A,r,t});

    } else {
      // ─── AG TARAF — IEC 60364-7-712 / IEC 60364-4-41 TT Sistemi ──
      // Arıza akımı = RCD anma kaçak akımı IΔn (mA mertebesi)
      // I"k1 KULLANILMAZ — bu AG tesisi
      const {Rc} = cKazik.aktif&&cKazik.n>0
        ? calcRc(rho,cKazik.n,cKazik.Lc,cKazik.dc)
        : {Rc:null};
      const aktif=[Rmev,Rc].filter(x=>x&&isFinite(x));
      const Res=paralel(...aktif); // ×1.10 YOK

      // Ana kontrol (IEC 60364-4-41 md.411.5.3):
      // Reş × IΔn,toplam ≤ 50V
      const Id=nInvAG*iDn;       // toplam kaçak akım (A)
      const UE=Res*Id;            // dokunma gerilimi (V)
      const sinir=50/Id;          // Reş sınırı (Ω)
      const dok_ok=UE<=50;        // UE ≤ 50V
      const rcd_ok=Res<=sinir;    // Reş ≤ 50/Id

      setRes({mod:'cati',Res,Rc,Id,UE,sinir,nInvAG,iDn,
        dok_ok,rcd_ok,
        qS:4,qH:0}); // AG min 4mm² (IEC 60364-7-712)
    }
  };

  const allOk=res&&res.dok_ok&&res.rcd_ok;
  const r_og=R_SEL[rIdx].r;

  return(
    <div className="space-y-5">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-5 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><path d="M8 6l4-4 4 4"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">GES Topraklama Hesabı</h2>
            <p className="text-emerald-100 text-sm">
              {mod==='arazi'
                ? 'Arazi GES — OG Taraf — ETT Yönetmeliği / IEC EN 50522'
                : 'Çatı GES — AG TT Sistemi — IEC 60364-7-712 / IEC 60364-4-41'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={hesapla}
            className="bg-white text-emerald-700 font-black py-2.5 px-6 rounded-xl shadow-lg hover:scale-105 text-sm">
            HESAPLA
          </button>
          {res&&(
            <>
              <button onClick={()=>exportGesTopraklamaPDF({mod,Ik1,rIdx,rho,t,nInv,nInvAG,iDn,saha,koskler,Rmev,cKazik},res)}
                className="bg-white/20 hover:bg-white/30 text-white font-bold py-2.5 px-4 rounded-xl text-sm">
                🖨 PDF
              </button>
              <button onClick={()=>exportGesTopraklamaWord({mod,Ik1,rIdx,rho,t,nInv,nInvAG,iDn,saha,koskler,Rmev,cKazik},res)}
                className="bg-white/20 hover:bg-white/30 text-white font-bold py-2.5 px-4 rounded-xl text-sm">
                📄 Word
              </button>
            </>
          )}
        </div>
      </div>

      {/* MOD */}
      <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
        {[
          ['arazi','🌄  Arazi GES','OG — ETT Yönetmeliği — I"k1 ile hesap'],
          ['cati', '🏢  Çatı GES', 'AG TT Sistemi — IEC 60364-4-41 — IΔn ile hesap'],
        ].map(([m,lbl,sub])=>(
          <button key={m} onClick={()=>{setMod(m);setRes(null);}}
            className={`flex-1 py-3 px-4 rounded-lg transition-all text-left ${mod===m?'bg-white shadow-sm':''}`}>
            <div className={`text-sm font-bold ${mod===m?'text-emerald-700':'text-slate-500'}`}>{lbl}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
          </button>
        ))}
      </div>

      {/* GENEL SONUÇ */}
      {res&&(
        <div className={`rounded-xl p-4 flex items-center gap-4 border-2 ${allOk?'bg-green-50 border-green-300':'bg-red-50 border-red-300'}`}>
          <div className={`text-3xl font-black ${allOk?'text-green-600':'text-red-600'}`}>{allOk?'✓':'✗'}</div>
          <div>
            <div className={`font-black ${allOk?'text-green-700':'text-red-700'}`}>
              {allOk?'Topraklama Sistemi Uygun':'Uyumsuzluk Var'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono">
              {res.mod==='arazi'
                ? `Reş=${res.Res?.toFixed(3)}Ω · It=${res.It?.toFixed(1)}A · UE=${res.UE?.toFixed(1)}V · UTP(${t}s)=${res.Utp}V`
                : `Reş=${res.Res?.toFixed(3)}Ω · Id=${res.Id?.toFixed(3)}A · UE=${res.UE?.toFixed(2)}V · Sınır=50V`}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* SOL */}
        <div className="xl:col-span-2 space-y-4">

          {/* Zemin */}
          <div className="bg-white p-5 rounded-xl border">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <div className="w-3 h-3 rounded-full bg-amber-400"/>
              <h3 className="font-black text-slate-700 text-sm uppercase">Zemin Özgül Direnci ρ</h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {TOPRAK.map(tp=>(
                <button key={tp.r} onClick={()=>setRho(tp.r)}
                  className={`text-left px-2.5 py-2 rounded-lg border text-xs transition-all ${rho===tp.r?'bg-amber-50 border-amber-400 text-amber-700 font-bold':'border-slate-200 text-slate-500'}`}>
                  <span className="font-mono font-bold">{tp.r}</span> — {tp.label}
                </button>
              ))}
            </div>
            <NI label="ρE [Ω·m]" value={rho} onChange={setRho} unit="Ω·m" step={10} min={10}/>
          </div>

          {/* ARAZİ: OG parametreleri */}
          {mod==='arazi'&&(<>
            <div className="bg-white p-5 rounded-xl border">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                <div className="w-3 h-3 rounded-full bg-red-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase">OG Arıza Akımı</h3>
                {initialIk1>0&&<span className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">OG modülünden</span>}
              </div>
              <NI label='Faz-Toprak I"k1 [kA]' value={Ik1} onChange={setIk1} unit="kA" step={.001} min={.001}/>
              <p className="text-[10px] text-slate-400 mt-1.5 font-mono">= {(Ik1*1000).toFixed(0)} A</p>
            </div>

            <div className="bg-white p-5 rounded-xl border">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                <div className="w-3 h-3 rounded-full bg-blue-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase">Bölünme Katsayısı r</h3>
              </div>
              {R_SEL.map((s,i)=>(
                <button key={i} onClick={()=>setRIdx(i)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border-2 mb-2 transition-all ${rIdx===i?'bg-blue-50 border-blue-500 text-blue-700':'border-slate-200 text-slate-600'}`}>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold">{s.label}</span>
                    <span className={`font-mono font-black ${rIdx===i?'text-blue-600':'text-slate-400'}`}>r={s.r}</span>
                  </div>
                </button>
              ))}
              {res&&<div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 text-[10px] font-mono text-blue-700">It={r_og}×{(Ik1*1000).toFixed(0)}=<b>{res.It?.toFixed(1)} A</b></div>}
            </div>

            <div className="bg-white p-5 rounded-xl border">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                <div className="w-3 h-3 rounded-full bg-violet-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase">Arıza Süresi & RCD</h3>
              </div>
              <div className="flex gap-2 mb-3">
                {[.5,1.0].map(tv=>(
                  <button key={tv} onClick={()=>setT(tv)}
                    className={`flex-1 py-2.5 rounded-xl border-2 font-black text-sm transition-all ${t===tv?'bg-violet-50 border-violet-500 text-violet-700':'border-slate-200 text-slate-500'}`}>
                    {tv} s
                  </button>
                ))}
              </div>
              <NI label="Evirici Sayısı" value={nInv} onChange={setNInv} unit="adet" step={1} min={1}/>
              <div className="mt-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5 text-[10px] font-mono text-violet-700">
                RCD eşik=50/({nInv}×0.3)={(50/(nInv*.3)).toFixed(2)} Ω
              </div>
            </div>
          </>)}

          {/* ÇATI: AG/TT parametreleri */}
          {mod==='cati'&&(
            <div className="bg-white p-5 rounded-xl border space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="w-3 h-3 rounded-full bg-sky-500"/>
                <h3 className="font-black text-slate-700 text-sm uppercase">AG TT Sistem Parametreleri</h3>
              </div>
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-700">
                <b>IEC 60364-7-712 / IEC 60364-4-41</b><br/>
                TT sistemde ana kontrol: <b>UE = Reş × Id ≤ 50V</b><br/>
                Id = evirici sayısı × IΔn (RCD kaçak akımı)<br/>
                <b>OG I"k1 kullanılmaz — bu AG tesisidir.</b>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">RCD Anma Kaçak Akımı IΔn</div>
                <div className="flex gap-2">
                  {[{v:.03,l:'30 mA (hassas)'},{v:.3,l:'300 mA (standart)'}].map(o=>(
                    <button key={o.v} onClick={()=>setIDn(o.v)}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all text-left px-3 ${iDn===o.v?'bg-sky-50 border-sky-500 text-sky-700':'border-slate-200 text-slate-500'}`}>
                      <div>{o.l}</div>
                      <div className="font-mono">{o.v} A</div>
                    </button>
                  ))}
                </div>
              </div>
              <NI label="Evirici Sayısı" value={nInvAG} onChange={setNInvAG} unit="adet" step={1} min={1}/>
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-600">
                Toplam Id = {nInvAG} × {iDn} = {(nInvAG*iDn).toFixed(3)} A<br/>
                Reş sınırı = 50 / {(nInvAG*iDn).toFixed(3)} = {(50/(nInvAG*iDn)).toFixed(2)} Ω
              </div>
              <NI label="Mevcut Bina Toprağı R_mev [Ω]" value={Rmev} onChange={setRmev} unit="Ω" step={.5} min={.01}/>
              <div>
                <button onClick={()=>setCKazik(p=>({...p,aktif:!p.aktif}))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 mb-2 transition-all ${cKazik.aktif?'bg-amber-50 border-amber-400 text-amber-700':'border-slate-200 text-slate-400 bg-white'}`}>
                  İlave Topraklama Kazığı {cKazik.aktif?'✓':'○'}
                </button>
                {cKazik.aktif&&(
                  <div className="grid grid-cols-3 gap-2">
                    <NI label="n [adet]" value={cKazik.n} onChange={v=>setCKazik(p=>({...p,n:v}))} unit="adet" step={1} min={1}/>
                    <NI label="Lç [m]" value={cKazik.Lc} onChange={v=>setCKazik(p=>({...p,Lc:v}))} unit="m" step={.5} min={.5}/>
                    <NI label="dç [m]" value={cKazik.dc} onChange={v=>setCKazik(p=>({...p,dc:v}))} unit="m" step={.005} min={.01}/>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SAĞ */}
        <div className="xl:col-span-3 space-y-4">

          {/* Arazi birim paneller */}
          {mod==='arazi'&&(<>
            <BirimPanel label="GES Santral Sahası" color="emerald"
              data={saha} onChange={updSaha} rho={rho}
              sonuc={res?.mod==='arazi'?res.sahaSon:null}/>
            {koskler.map((ko,i)=>(
              <BirimPanel key={ko.id||i}
                label={`Trafo Köşkü ${i+1}`}
                color={KRENK[i%KRENK.length]}
                data={ko} onChange={(k,v)=>updKosk(i,k,v)} rho={rho}
                sonuc={res?.mod==='arazi'?res.koskSon?.[i]:null}
                removable onRemove={()=>rmKosk(i)}/>
            ))}
            <button onClick={addKosk}
              className="w-full border-2 border-dashed border-slate-300 rounded-xl py-3 text-sm font-bold text-slate-400 hover:border-emerald-400 hover:text-emerald-500">
              + Trafo Köşkü Ekle
            </button>
          </>)}

          {/* Sonuçlar */}
          {res&&(<>
            {/* Final Reş */}
            <div className="bg-white p-5 rounded-xl border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500"/>
                <h3 className="font-black text-slate-700 text-sm uppercase">Eşdeğer Topraklama Direnci</h3>
              </div>
              {res.mod==='arazi'&&(
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between bg-emerald-50 rounded-lg px-4 py-2 text-xs">
                    <span className="font-bold text-emerald-700">{saha.isim}</span>
                    <span className="font-mono font-black text-emerald-700">{res.sahaSon?.Res?.toFixed(3)} Ω</span>
                  </div>
                  {res.koskSon?.map((ks,i)=>(
                    <div key={i} className="flex justify-between bg-blue-50 rounded-lg px-4 py-2 text-xs">
                      <span className="font-bold text-blue-700">{koskler[i]?.isim||`Köşk ${i+1}`}</span>
                      <span className="font-mono font-black text-blue-700">{ks?.Res?.toFixed(3)} Ω</span>
                    </div>
                  ))}
                  <div className="text-[10px] font-mono text-slate-400 px-1">
                    1/Reş={[res.sahaSon?.Res,...(res.koskSon||[]).map(k=>k?.Res)].filter(Boolean).map(v=>`1/${v?.toFixed(3)}`).join('+')} → Reş=<b>{res.Res?.toFixed(3)} Ω</b>
                  </div>
                </div>
              )}
              {res.mod==='cati'&&(
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between bg-emerald-50 rounded-lg px-4 py-2 text-xs">
                    <span className="font-bold text-emerald-700">Mevcut Bina Toprağı</span>
                    <span className="font-mono font-black text-emerald-700">{Rmev.toFixed(3)} Ω</span>
                  </div>
                  {cKazik.aktif&&res.Rc!=null&&(
                    <div className="flex justify-between bg-amber-50 rounded-lg px-4 py-2 text-xs">
                      <span className="font-bold text-amber-700">İlave Kazık ({cKazik.n} adet)</span>
                      <span className="font-mono font-black text-amber-700">{res.Rc?.toFixed(3)} Ω</span>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl px-4 py-3 text-center">
                <div className="text-[10px] text-emerald-600 font-bold uppercase mb-1">Final Reş</div>
                <div className="font-black font-mono text-emerald-700 text-3xl">{res.Res?.toFixed(3)}</div>
                <div className="text-xs text-emerald-500">Ω</div>
              </div>
            </div>

            {/* ARAZİ sonuç kartları */}
            {res.mod==='arazi'&&(
              <div className="bg-white p-5 rounded-xl border space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-orange-400"/>
                  <h3 className="font-black text-slate-700 text-sm uppercase">OG Dokunma Gerilimi — ETT Yönetmeliği</h3>
                </div>
                <UtpGraph t={t} Utp={res.Utp} UE={res.UE}/>
                <div className="bg-slate-50 rounded-lg px-3 py-2 text-[10px] font-mono text-slate-500">
                  UE=It×Reş={res.It?.toFixed(1)}×{res.Res?.toFixed(3)}={res.UE?.toFixed(2)}V &nbsp;|&nbsp; UTP({t}s)={res.Utp}V
                </div>
                <Check ok={res.dok_ok}
                  label={`Dokunma Gerilimi — t=${t}s | UTP=${res.Utp}V`}
                  val={res.UE} op="<" lim={res.Utp} unit="V"
                  sub={`UE=${res.UE?.toFixed(2)}V ${res.dok_ok?'<':'>'} UTP(${t}s)=${res.Utp}V`}/>
                <Check ok={res.adim_ok}
                  label={`Adım Gerilimi — t=${t}s | Sınır=${getLimitUa(t)}V`}
                  val={res.Ua} op="<" lim={getLimitUa(t)} unit="V"
                  sub={`Ua=ρ×It/(2π)×(1/r−1/(r+1))=${res.Ua?.toFixed(1)}V | r_mesh=${res.rm?.toFixed(1)}m`}/>
              </div>
            )}

            {/* ÇATI sonuç kartları */}
            {res.mod==='cati'&&(
              <div className="bg-white p-5 rounded-xl border space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-sky-500"/>
                  <h3 className="font-black text-slate-700 text-sm uppercase">AG TT Sistemi — IEC 60364-4-41</h3>
                </div>
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-700">
                  <b>Kontrol: UE = Reş × Id ≤ 50V</b><br/>
                  Id = {nInvAG} evirici × {iDn}A = {res.Id?.toFixed(3)}A (toplam kaçak akım)
                </div>
                <Check ok={res.dok_ok}
                  label="Dokunma Gerilimi — TT Sistemi sabit sınır 50V (IEC 60364-4-41)"
                  val={res.UE} op="≤" lim={50} unit="V"
                  sub={`UE=Reş×Id=${res.Res?.toFixed(3)}×${res.Id?.toFixed(3)}=${res.UE?.toFixed(2)}V ≤ 50V`}/>
              </div>
            )}

            {/* RCD */}
            <div className="bg-white p-5 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-violet-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase">
                  {res.mod==='arazi'?'RCD Kontrolü (OG — Normal İşletme)':'RCD Koşulu (AG TT — Ana Kontrol)'}
                </h3>
              </div>
              {res.mod==='arazi'
                ?<Check ok={res.rcd_ok}
                    label={`Reş ≤ 50/(${nInv}×0.3A) = ${(50/(nInv*.3)).toFixed(2)} Ω`}
                    val={res.Res} op="≤" lim={(50/(nInv*.3)).toFixed(2)} unit="Ω"/>
                :<Check ok={res.rcd_ok}
                    label={`Reş ≤ 50/Id = 50/${res.Id?.toFixed(3)} = ${res.sinir?.toFixed(2)} Ω  (IEC 60364-4-41 md.411.5.3)`}
                    val={res.Res} op="≤" lim={res.sinir?.toFixed(2)} unit="Ω"
                    sub={`Reş=${res.Res?.toFixed(3)}Ω ≤ 50/${res.Id?.toFixed(3)} = ${res.sinir?.toFixed(2)}Ω`}/>
              }
            </div>

            {/* İletken kesit */}
            <div className="bg-white p-5 rounded-xl border">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-amber-400"/>
                <h3 className="font-black text-slate-700 text-sm uppercase">Topraklama İletkeni Minimum Kesiti</h3>
              </div>
              {res.mod==='arazi'
                ?(<>
                    <div className="bg-slate-50 rounded-lg px-4 py-3 font-mono text-sm mb-3">
                      S=I"k1×√t/k={res.Ik1A?.toFixed(0)}×√{t}/115=<b>{res.qH?.toFixed(2)} mm²</b>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex justify-between">
                      <div>
                        <div className="text-xs font-bold">Seçilen Kesit</div>
                        <div className="text-[10px] text-slate-400">ETT min. 50mm² galvaniz şerit</div>
                      </div>
                      <div className="font-black text-amber-700 text-2xl font-mono">{res.qS} mm²</div>
                    </div>
                  </>)
                :(<div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
                    <div className="text-xs font-bold text-sky-700">AG — IEC 60364-7-712 Tablo 712.54.1</div>
                    <div className="text-[10px] text-slate-500 mt-1">AG tesisinde I"k1 ile kesit hesabı yapılmaz.<br/>
                      Minimum kesit: <b>4 mm²</b> (PE iletken, Cu)</div>
                  </div>)
              }
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}
